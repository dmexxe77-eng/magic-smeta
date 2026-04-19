/**
 * Plan Editor — manual polygon editor matching web version.
 * Features:
 * - Drag vertices, insert/delete vertices
 * - Edge length editing via bottom bar
 * - 90° alignment button
 * - Area/perimeter/corner display
 */
import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, Pressable, PanResponder, ScrollView,
  Modal, TextInput, Alert, Dimensions,
} from 'react-native';
import Svg, {
  Polygon as SvgPolygon, Line, Circle as SvgCircle,
  Text as SvgText, G,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Vertex } from '../../types';
import { calcPoly, countAngles, getAngles, fmt } from '../../utils/geometry';
import { InnerCornerIcon, OuterCornerIcon } from '../ui/CornerIcons';

const SCREEN = Dimensions.get('window');
const ACC = '#4F46E5';
const GREEN = '#16a34a';
const RED = '#dc2626';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface PlanEditorProps {
  initialVerts?: Vertex[];
  initialName?: string;
  onFinish: (verts: Vertex[], name: string) => void;
  onCancel: () => void;
}

// Default: 3×4 rectangle
const DEFAULT_VERTS: Vertex[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

export default function PlanEditor({
  initialVerts, initialName, onFinish, onCancel,
}: PlanEditorProps) {
  const insets = useSafeAreaInsets();
  const [verts, setVerts] = useState<Vertex[]>(
    initialVerts && initialVerts.length >= 3 ? initialVerts : DEFAULT_VERTS
  );
  const [name, setName] = useState(initialName || 'Помещение');
  const [editingSide, setEditingSide] = useState<number | null>(null);
  const [sideInput, setSideInput] = useState('');
  const [canvasSize, setCanvasSize] = useState({ w: SCREEN.width, h: SCREEN.height - 240 });
  const vertsRef = useRef(verts);
  vertsRef.current = verts;

  // ─── Compute view transform ─────────────────────────────────────────
  // Fit polygon into canvas with padding
  const transform = useMemo(() => {
    if (verts.length < 2) return { scale: 50, ox: canvasSize.w / 2, oy: canvasSize.h / 2 };
    const xs = verts.map(v => v.x), ys = verts.map(v => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX || 1, h = maxY - minY || 1;
    const pad = 80;
    const scale = Math.min((canvasSize.w - pad * 2) / w, (canvasSize.h - pad * 2) / h);
    const ox = canvasSize.w / 2 - ((minX + maxX) / 2) * scale;
    const oy = canvasSize.h / 2 - ((minY + maxY) / 2) * scale;
    return { scale, ox, oy };
  }, [verts, canvasSize]);

  const toScreen = useCallback((v: Vertex) => ({
    x: v.x * transform.scale + transform.ox,
    y: v.y * transform.scale + transform.oy,
  }), [transform]);

  const fromScreen = useCallback((sx: number, sy: number): Vertex => ({
    x: (sx - transform.ox) / transform.scale,
    y: (sy - transform.oy) / transform.scale,
  }), [transform]);

  // ─── Stats ────────────────────────────────────────────────────────
  const poly = useMemo(() => calcPoly(verts), [verts]);
  const angles = useMemo(() => countAngles(verts), [verts]);

  // ─── Drag handler ─────────────────────────────────────────────────
  const dragIdx = useRef<number | null>(null);
  const canvasOffset = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      const sx = evt.nativeEvent.locationX;
      const sy = evt.nativeEvent.locationY;
      // Find closest vertex within 30px
      let best = -1, bestDist = 30;
      for (let i = 0; i < vertsRef.current.length; i++) {
        const p = {
          x: vertsRef.current[i].x * transform.scale + transform.ox,
          y: vertsRef.current[i].y * transform.scale + transform.oy,
        };
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      dragIdx.current = best;
    },

    onPanResponderMove: (evt) => {
      if (dragIdx.current === null || dragIdx.current < 0) return;
      const sx = evt.nativeEvent.locationX;
      const sy = evt.nativeEvent.locationY;
      const v = {
        x: (sx - transform.ox) / transform.scale,
        y: (sy - transform.oy) / transform.scale,
      };
      setVerts(prev => prev.map((p, i) => i === dragIdx.current ? v : p));
    },

    onPanResponderRelease: () => { dragIdx.current = null; },
  }), [transform]);

  // ─── Actions ──────────────────────────────────────────────────────

  // Insert new vertex at midpoint of edge i..i+1
  const insertAtEdge = useCallback((i: number) => {
    setVerts(prev => {
      const next = (i + 1) % prev.length;
      const mid: Vertex = {
        x: (prev[i].x + prev[next].x) / 2,
        y: (prev[i].y + prev[next].y) / 2,
      };
      const copy = [...prev];
      copy.splice(i + 1, 0, mid);
      return copy;
    });
  }, []);

  // Delete vertex (only if >3 remain)
  const deleteVertex = useCallback((i: number) => {
    setVerts(prev => {
      if (prev.length <= 3) {
        Alert.alert('Минимум 3 угла');
        return prev;
      }
      return prev.filter((_, j) => j !== i);
    });
  }, []);

  // Add corner at end (duplicates last vertex, user moves it)
  const addCorner = useCallback(() => {
    setVerts(prev => {
      if (prev.length < 1) return prev;
      const last = prev[prev.length - 1];
      const first = prev[0];
      return [...prev, { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 }];
    });
  }, []);

  // Align all angles to 90° (snap edges to horizontal/vertical)
  const align90 = useCallback(() => {
    setVerts(prev => {
      const result: Vertex[] = [{ ...prev[0] }];
      for (let i = 1; i < prev.length; i++) {
        const p = result[i - 1];
        const c = prev[i];
        const dx = c.x - p.x;
        const dy = c.y - p.y;
        // Snap to horizontal or vertical: whichever is longer
        if (Math.abs(dx) > Math.abs(dy)) {
          result.push({ x: p.x + dx, y: p.y }); // horizontal
        } else {
          result.push({ x: p.x, y: p.y + dy }); // vertical
        }
      }
      return result;
    });
  }, []);

  // Edit side length
  const openSideEditor = useCallback((idx: number) => {
    const len = Math.hypot(
      verts[(idx + 1) % verts.length].x - verts[idx].x,
      verts[(idx + 1) % verts.length].y - verts[idx].y,
    );
    setEditingSide(idx);
    setSideInput(len.toFixed(2));
  }, [verts]);

  const applySideLength = useCallback(() => {
    if (editingSide === null) return;
    const newLen = parseFloat(sideInput.replace(',', '.'));
    if (!isFinite(newLen) || newLen <= 0) { setEditingSide(null); return; }
    setVerts(prev => {
      const i = editingSide;
      const n = prev.length;
      const curr = prev[i];
      const next = prev[(i + 1) % n];
      const oldLen = Math.hypot(next.x - curr.x, next.y - curr.y);
      if (oldLen < 1e-6) return prev;
      const scale = newLen / oldLen;
      // Move `next` along current edge direction
      const dx = (next.x - curr.x) * scale;
      const dy = (next.y - curr.y) * scale;
      const newNext = { x: curr.x + dx, y: curr.y + dy };
      const shift = { x: newNext.x - next.x, y: newNext.y - next.y };
      // Shift all subsequent vertices by the same amount to preserve shape
      return prev.map((p, j) => {
        const k = (j - (i + 1) + n) % n;
        if (k === n - 1 && j !== (i + 1) % n) return p; // don't shift the "before" vertex
        if (j === (i + 1) % n) return newNext;
        // For vertices after (i+1) but before i, shift by delta
        const afterNext = ((j - (i + 1) + n) % n);
        if (afterNext > 0 && afterNext < n - 1) {
          return { x: p.x + shift.x, y: p.y + shift.y };
        }
        return p;
      });
    });
    setEditingSide(null);
  }, [editingSide, sideInput]);

  // ─── Render ───────────────────────────────────────────────────────

  const screenVerts = verts.map(toScreen);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f7f5' }}>
      {/* Top bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingTop: insets.top + 8, paddingBottom: 10,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1, borderBottomColor: '#e8e8e4',
        gap: 8,
      }}>
        <Pressable onPress={onCancel} style={{ paddingHorizontal: 6 }}>
          <Text style={{ color: '#6b6b7a', fontSize: 16 }}>Отмена</Text>
        </Pressable>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: ACC }}>
          Редактор чертежа
        </Text>
        <Pressable onPress={addCorner} style={btnStyle}>
          <Text style={btnTextStyle}>+ Угол</Text>
        </Pressable>
        <Pressable onPress={align90} style={btnStyle}>
          <Text style={btnTextStyle}>90° Выровнять</Text>
        </Pressable>
        <Pressable
          onPress={() => onFinish(verts, name)}
          style={{ ...btnStyle, backgroundColor: ACC, borderColor: ACC }}
        >
          <Text style={{ ...btnTextStyle, color: '#ffffff' }}>Готово</Text>
        </Pressable>
      </View>

      {/* Name field */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e8e8e4' }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Название помещения"
          style={{
            backgroundColor: '#f7f7f5', borderWidth: 1, borderColor: '#e8e8e4',
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
            fontSize: 13, color: '#1e2030',
          }}
        />
      </View>

      {/* Canvas */}
      <View
        style={{ flex: 1, backgroundColor: '#fafafe' }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCanvasSize({ w: width, h: height });
        }}
        {...panResponder.panHandlers}
      >
        <Svg width={canvasSize.w} height={canvasSize.h} style={{ position: 'absolute' }}>
          {/* Grid */}
          {Array.from({ length: 30 }, (_, i) => (
            <Line
              key={`gv-${i}`}
              x1={(i - 15) * transform.scale + transform.ox}
              y1={0} y2={canvasSize.h}
              x2={(i - 15) * transform.scale + transform.ox}
              stroke="#e8e8e4" strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: 30 }, (_, i) => (
            <Line
              key={`gh-${i}`}
              x1={0} x2={canvasSize.w}
              y1={(i - 15) * transform.scale + transform.oy}
              y2={(i - 15) * transform.scale + transform.oy}
              stroke="#e8e8e4" strokeWidth={0.5}
            />
          ))}

          {/* Polygon */}
          {verts.length >= 3 && (
            <SvgPolygon
              points={screenVerts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(79,70,229,0.15)"
              stroke={ACC}
              strokeWidth={2}
            />
          )}

          {/* Edge labels + midpoints */}
          {verts.map((_, i) => {
            const p1 = screenVerts[i];
            const p2 = screenVerts[(i + 1) % verts.length];
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const len = Math.hypot(
              verts[(i + 1) % verts.length].x - verts[i].x,
              verts[(i + 1) % verts.length].y - verts[i].y,
            );
            const sideLabel = `${ALPHA[i]}${ALPHA[(i + 1) % verts.length]}: ${len.toFixed(2)}м`;
            return (
              <G key={`edge-${i}`}>
                <SvgText x={mx} y={my - 10} textAnchor="middle" fontSize={10} fill="#6b6b7a">
                  {sideLabel}
                </SvgText>
                <SvgCircle cx={mx} cy={my} r={8} fill="#c7c4f8" opacity={0.8} />
                <SvgText x={mx} y={my + 3.5} textAnchor="middle" fontSize={11} fontWeight="700" fill={ACC}>+</SvgText>
              </G>
            );
          })}

          {/* Vertex circles with labels — use web algorithm with ±15° tolerance */}
          {(() => {
            const vertAngs = getAngles(verts);
            return verts.map((_, i) => {
              const p = screenVerts[i];
              const deg = vertAngs[i];
              const is90 = deg === 90;
              const is270 = deg === 270;
              const color = is90 ? GREEN : is270 ? RED : '#6b6b7a';
              const angLabel = `${deg}°`;
              return (
                <G key={`v-${i}`}>
                  <SvgCircle cx={p.x} cy={p.y} r={10} fill={color} stroke="#ffffff" strokeWidth={2} />
                  <SvgText x={p.x} y={p.y - 14} textAnchor="middle" fontSize={12} fontWeight="800" fill={color}>
                    {ALPHA[i]}
                  </SvgText>
                  <SvgText x={p.x + 14} y={p.y + 4} fontSize={9} fill="#9ca3af">
                    {angLabel}
                  </SvgText>
                </G>
              );
            });
          })()}
        </Svg>

        {/* Transparent buttons for edge "+" taps */}
        {verts.map((_, i) => {
          const p1 = screenVerts[i];
          const p2 = screenVerts[(i + 1) % verts.length];
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          return (
            <Pressable
              key={`btn-${i}`}
              onPress={() => insertAtEdge(i)}
              style={{
                position: 'absolute',
                left: mx - 16, top: my - 16,
                width: 32, height: 32,
              }}
            />
          );
        })}

        {/* Long-press buttons on vertices for delete */}
        {verts.map((_, i) => {
          const p = screenVerts[i];
          return (
            <Pressable
              key={`vbtn-${i}`}
              onLongPress={() => deleteVertex(i)}
              delayLongPress={500}
              style={{
                position: 'absolute',
                left: p.x - 14, top: p.y - 14,
                width: 28, height: 28,
              }}
            />
          );
        })}
      </View>

      {/* Bottom bar — stats + per-side lengths */}
      <View style={{
        backgroundColor: '#ffffff',
        borderTopWidth: 1, borderTopColor: '#e8e8e4',
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <Text style={{ fontSize: 11, color: '#6b6b7a' }}>S:</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: ACC }}>{fmt(poly.a)}</Text>
          <Text style={{ fontSize: 11, color: '#6b6b7a' }}>м²</Text>
          <Text style={{ fontSize: 11, color: '#6b6b7a', marginLeft: 8 }}>P:</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#1e2030' }}>{fmt(poly.p)}</Text>
          <Text style={{ fontSize: 11, color: '#6b6b7a' }}>м</Text>
          {angles.total > 0 && (
            <>
              <View style={{ marginLeft: 8 }}><InnerCornerIcon size={14} /></View>
              <Text style={{ fontSize: 11, color: GREEN, fontWeight: '700' }}>{angles.inner}</Text>
              <OuterCornerIcon size={14} />
              <Text style={{ fontSize: 11, color: RED, fontWeight: '700' }}>{angles.outer}</Text>
              <Text style={{ fontSize: 11, color: '#6b6b7a' }}>{verts.length} углов</Text>
            </>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {verts.map((_, i) => {
            const next = (i + 1) % verts.length;
            const len = Math.hypot(
              verts[next].x - verts[i].x,
              verts[next].y - verts[i].y,
            );
            return (
              <Pressable
                key={i}
                onPress={() => openSideEditor(i)}
                style={{
                  borderWidth: 1, borderColor: '#e8e8e4',
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
                  backgroundColor: '#f7f7f5',
                }}
              >
                <Text style={{ fontSize: 10, color: '#1e2030', fontWeight: '600' }}>
                  {ALPHA[i]}{ALPHA[next]}:{len.toFixed(2)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Side length editor modal */}
      <Modal
        visible={editingSide !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSide(null)}
      >
        <Pressable
          onPress={() => setEditingSide(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Pressable onPress={() => {}} style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 20, width: 280 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e2030', marginBottom: 10 }}>
              Длина {editingSide !== null ? `${ALPHA[editingSide]}${ALPHA[(editingSide + 1) % verts.length]}` : ''} (м)
            </Text>
            <TextInput
              value={sideInput}
              onChangeText={setSideInput}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              style={{
                backgroundColor: '#f7f7f5', borderWidth: 1, borderColor: '#e8e8e4',
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                fontSize: 16, color: '#1e2030', textAlign: 'center',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => setEditingSide(null)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e8e8e4', alignItems: 'center' }}
              >
                <Text style={{ color: '#6b6b7a', fontWeight: '600' }}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={applySideLength}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: ACC, alignItems: 'center' }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>OK</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const btnStyle = {
  paddingHorizontal: 10, paddingVertical: 6,
  borderRadius: 8, borderWidth: 1, borderColor: '#e8e8e4',
  backgroundColor: '#ffffff',
};

const btnTextStyle = {
  fontSize: 12, fontWeight: '700' as const, color: ACC,
};
