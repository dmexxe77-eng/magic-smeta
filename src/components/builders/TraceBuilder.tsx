import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  Image,
  Dimensions,
  StyleSheet,
  PanResponder,
} from 'react-native';
import Svg, {
  Polygon as SvgPolygon,
  Line,
  Circle as SvgCircle,
  Text as SvgText,
  G,
  Defs,
  Pattern,
  Path as SvgPath,
  Rect,
} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calcPoly, fmt } from '../../utils/geometry';
import { generateId } from '../../utils/storage';
import { loadImagePixels, snapToCorner as pixelSnap } from '../../utils/cornerDetector';
import { nextRoomName } from '../../utils/roomName';
import PdfPicker from './PdfPicker';
import type { Room, Vertex } from '../../types';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SCREEN = Dimensions.get('window');
const SNAP_PX = 8;
const ROOM_COLORS = ['#4F46E5','#16a34a','#f59e0b','#dc2626','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

// ─── Types ──────────────────────────────────────────────────────────

export interface TracedRoom {
  id: string;
  points: Array<{ x: number; y: number }>;
  name: string;
  closed: boolean;
}

export interface TraceSession {
  imageUri: string;
  imageW: number;
  imageH: number;
  rooms: TracedRoom[];
  scale: number | null;
  pdfUri?: string | null;
}

interface TraceBuilderProps {
  existingNames: string[];
  onFinishAll: (rooms: Room[]) => void;
  onBack: () => void;
  session?: TraceSession | null;
  onSessionChange?: (session: TraceSession) => void;
}

// ─── Sub-screens ────────────────────────────────────────────────────

function PickSourceStep({ onImage, onPickPdf, onBack, insets }: {
  onImage: (uri: string, w: number, h: number) => void;
  onPickPdf: () => void;
  onBack: () => void;
  insets: { top: number };
}) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, selectionLimit: 1 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      onImage(a.uri, a.width, a.height);
    }
  };
  return (
    <View className="flex-1 bg-bg">
      <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={onBack} className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center">
            <Text className="text-navy text-xl font-bold">‹</Text>
          </Pressable>
          <Text className="text-[14px] font-bold text-navy">Обводка плана</Text>
        </View>
      </View>
      <View className="flex-1 items-center justify-center px-8 gap-3">
        <Text className="text-6xl">📐</Text>
        <Text className="text-xl font-black text-navy text-center mb-2">Выберите план</Text>
        <Pressable onPress={onPickPdf} className="bg-accent px-8 py-4 rounded-xl w-full items-center">
          <Text className="text-white font-bold text-base">📄 PDF проект</Text>
        </Pressable>
        <Pressable onPress={pickImage} className="bg-white border border-border px-8 py-4 rounded-xl w-full items-center">
          <Text className="text-navy font-bold text-base">📷 Фото из галереи</Text>
        </Pressable>
        <Text className="text-muted text-xs text-center mt-2">
          PDF даёт более точную обводку благодаря векторному качеству
        </Text>
      </View>
    </View>
  );
}

function CalibrationStep({ points, onCalibrate, insets }: {
  points: Array<{ x: number; y: number }>;
  onCalibrate: (sideIdx: number, cm: number) => void;
  insets: { top: number };
}) {
  const [input, setInput] = useState('');
  const [sel, setSel] = useState(0);
  const n = points.length;
  const submit = () => { const cm = parseFloat(input.replace(',', '.')); if (cm > 0) onCalibrate(sel, cm); };
  return (
    <View className="flex-1 bg-bg">
      <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
        <Text className="text-[14px] font-bold text-navy px-4">Калибровка</Text>
      </View>
      <View className="flex-1 items-center justify-center px-8 gap-4">
        <Text className="text-4xl">📏</Text>
        <Text className="text-sm text-muted">Выберите сторону</Text>
        <View className="flex-row flex-wrap gap-2 justify-center">
          {Array.from({ length: n }).map((_, i) => (
            <Pressable key={i} onPress={() => setSel(i)}
              style={{ backgroundColor: sel === i ? '#4F46E5' : '#f7f7f5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: sel === i ? '#4F46E5' : '#e8e8e4' }}>
              <Text style={{ color: sel === i ? '#fff' : '#555', fontSize: 13, fontWeight: '700' }}>
                {ALPHA[i]}–{ALPHA[(i + 1) % n]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row items-center gap-3">
          <TextInput value={input} onChangeText={setInput} placeholder="см" placeholderTextColor="#b0b0ba"
            keyboardType="number-pad" autoFocus onSubmitEditing={submit}
            className="bg-white border border-border rounded-xl px-4 py-3 text-navy text-2xl text-center w-32" />
          <Pressable onPress={submit} className="bg-navy px-6 py-3 rounded-xl">
            <Text className="text-white font-bold text-lg">OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function NameRoomStep({ area, perim, pointCount, defaultName, onConfirm, onBack, insets }: {
  area: number; perim: number; pointCount: number; defaultName: string;
  onConfirm: (name: string) => void; onBack: () => void; insets: { top: number };
}) {
  const [name, setName] = useState(defaultName);
  return (
    <View className="flex-1 bg-bg">
      <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={onBack} className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center">
            <Text className="text-navy text-xl font-bold">‹</Text>
          </Pressable>
          <Text className="text-[14px] font-bold text-navy">Помещение готово</Text>
        </View>
      </View>
      <View className="flex-1 px-6 pt-6 gap-4">
        <View className="bg-green-50 border border-green-200 rounded-xl p-4">
          <Text className="text-green-700 font-bold text-base mb-1">✓ Контур · {pointCount} точек</Text>
          <Text className="text-muted text-sm">{fmt(area)} м² · {fmt(perim)} м.п.</Text>
        </View>
        <TextInput value={name} onChangeText={setName} placeholder="Название" placeholderTextColor="#b0b0ba" autoFocus
          className="bg-white border border-border rounded-xl px-4 py-3 text-navy text-base" />
        <Pressable onPress={() => onConfirm(name.trim() || defaultName)} className="bg-navy rounded-xl py-3 items-center">
          <Text className="text-white font-bold">Добавить и продолжить →</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main TraceBuilder ──────────────────────────────────────────────
// Uses React state for zoom/pan (like web version), NOT Animated.View.
// Coordinate conversion: imgX = (screenX - panX) / zoom
//                        screenX = imgX * zoom + panX

export default function TraceBuilder({ existingNames, onFinishAll, onBack, session: initialSession, onSessionChange }: TraceBuilderProps) {
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(initialSession?.imageUri ?? null);
  const [imgNat, setImgNat] = useState({ w: initialSession?.imageW ?? 1, h: initialSession?.imageH ?? 1 });
  const [scale, setScale] = useState<number | null>(initialSession?.scale ?? null);
  const [tracedRooms, setTracedRooms] = useState<TracedRoom[]>(initialSession?.rooms ?? []);
  const [pdfUri, setPdfUri] = useState<string | null>(initialSession?.pdfUri ?? null);
  const [magnetEnabled, setMagnetEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const magnetRef = useRef(true);
  const gridRef = useRef(true);
  magnetRef.current = magnetEnabled;
  gridRef.current = showGrid;
  const GRID_STEP = 4; // image pixels — также шаг snap к сетке
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [step, setStep] = useState<'pick' | 'pickPdf' | 'trace' | 'calibrate' | 'name'>(initialSession?.imageUri ? 'trace' : 'pick');

  // Zoom/pan as React state (web approach)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs for gesture handlers (avoid stale closures)
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;
  const rafRef = useRef<number | null>(null);

  // Magnifier
  const [loupe, setLoupe] = useState<{ imgX: number; imgY: number; fingerX: number; fingerY: number } | null>(null);
  const loupeRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pixel data for real-time corner snap
  const [pixelsLoaded, setPixelsLoaded] = useState(false);

  // Header height — touch Y offset
  const headerH = useRef(0);

  // Gesture tracking
  const gestRef = useRef({ startX: 0, startY: 0, moved: false, isPinch: false, startDist: 0, startZoom: 1, lastX: 0, lastY: 0 });

  // ─── Initial fit ──────────────────────────────────────────────────

  useEffect(() => {
    if (imageUri && imgNat.w > 1) {
      const cw = SCREEN.width;
      const ch = SCREEN.height - insets.top - 100;
      const fz = Math.min(cw / imgNat.w, ch / imgNat.h, 1);
      setZoom(fz);
      setPan({ x: (cw - imgNat.w * fz) / 2, y: Math.max(0, (ch - imgNat.h * fz) / 2) });
    }
  }, [imageUri, imgNat]);

  // ─── Load pixel data for real-time corner snap ──────────────────

  useEffect(() => {
    if (imageUri && !pixelsLoaded) {
      loadImagePixels(imageUri).then(ok => setPixelsLoaded(ok));
    }
  }, [imageUri, pixelsLoaded]);

  // ─── Session sync ─────────────────────────────────────────────────

  useEffect(() => {
    if (imageUri) onSessionChange?.({ imageUri, imageW: imgNat.w, imageH: imgNat.h, rooms: tracedRooms, scale, pdfUri });
  }, [tracedRooms, scale, pdfUri, imageUri]);

  // ─── Coordinate conversion (web-style) ────────────────────────────

  // screen2img: from absolute touch coordinates to image pixels
  // Subtracts headerH because touch Y is screen-absolute but pan.y is canvas-relative
  const screen2img = useCallback((sx: number, sy: number) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: (sy - headerH.current - panRef.current.y) / zoomRef.current,
  }), []);

  // ─── Snap ─────────────────────────────────────────────────────────

  const snapPt = useCallback((ix: number, iy: number, useCorners: boolean) => {
    const thr = SNAP_PX / zoomRef.current;

    // Close polygon
    if (points.length >= 3) {
      const f = points[0];
      if (Math.hypot(ix - f.x, iy - f.y) < thr * 2) return { x: f.x, y: f.y, closing: true };
    }

    let x = ix, y = iy;

    // Real-time corner snap (Sobel, like web version)
    if (useCorners && pixelsLoaded && magnetRef.current) {
      const mode = useCorners ? 'loupe' : 'tap';
      const result = pixelSnap(ix, iy, imgNat.w, zoomRef.current, mode);
      if (result.snapped) {
        x = result.x;
        y = result.y;
      }
    }

    const cornerSnapped = x !== ix || y !== iy;

    // H/V align to current polygon (only if corner snap didn't fire)
    if (!cornerSnapped && points.length > 0) {
      const last = points[points.length - 1];
      if (Math.abs(ix - last.x) < thr) x = last.x;
      if (Math.abs(iy - last.y) < thr) y = last.y;
    }

    // Grid snap — fallback when nothing else matched
    if (!cornerSnapped && gridRef.current) {
      const gx = Math.round(x / GRID_STEP) * GRID_STEP;
      const gy = Math.round(y / GRID_STEP) * GRID_STEP;
      // Snap zone scales with zoom — feels consistent on screen
      const snapDist = 6 / zoomRef.current;
      if (Math.abs(x - gx) < snapDist) x = gx;
      if (Math.abs(y - gy) < snapDist) y = gy;
    }

    return { x, y, closing: false };
  }, [points, pixelsLoaded, imgNat.w]);

  // ─── Place point ──────────────────────────────────────────────────

  const placePoint = useCallback((ix: number, iy: number) => {
    if (ix < 0 || iy < 0 || ix > imgNat.w || iy > imgNat.h) return;
    setPoints(prev => [...prev, { x: ix, y: iy }]);
  }, [imgNat]);

  // ─── Touch handling via PanResponder (web-style) ──────────────────

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (_, gs) => {
      const g = gestRef.current;
      g.startX = gs.x0;
      g.startY = gs.y0;
      g.lastX = gs.x0;
      g.lastY = gs.y0;
      g.moved = false;
      g.isPinch = false;

      // Start hold timer for loupe
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        if (!g.moved && !g.isPinch) {
          loupeRef.current = true;
          const raw = screen2img(gs.x0, gs.y0);
          const snapped = snapPt(raw.x, raw.y, true);
          setLoupe({ imgX: snapped.x, imgY: snapped.y, fingerX: gs.x0, fingerY: gs.y0 });
        }
      }, 300);
    },

    onPanResponderMove: (evt, gs) => {
      const g = gestRef.current;
      const touches = evt.nativeEvent.touches;

      // Pinch zoom (2 fingers) — zoom toward center of fingers
      if (touches && touches.length >= 2) {
        g.isPinch = true;
        g.moved = true;
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
        loupeRef.current = false;
        setLoupe(null);

        const t0 = touches[0], t1 = touches[1];
        const dist = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);
        const cx = (t0.pageX + t1.pageX) / 2;
        const cy = (t0.pageY + t1.pageY) / 2 - headerH.current;

        if (!g.startDist) {
          g.startDist = dist;
          g.startZoom = zoomRef.current;
          g.lastX = cx;
          g.lastY = cy;
          return;
        }

        const oldZoom = zoomRef.current;
        const nz = Math.max(0.05, Math.min(15, g.startZoom * (dist / g.startDist)));

        // Zoom toward center of pinch (like web's handleWheel)
        const newPanX = cx - (cx - panRef.current.x) * (nz / oldZoom);
        const newPanY = cy - (cy - panRef.current.y) * (nz / oldZoom);

        // Also apply pan delta
        const dx = cx - g.lastX;
        const dy = cy - g.lastY;
        g.lastX = cx;
        g.lastY = cy;

        panRef.current = { x: newPanX + dx, y: newPanY + dy };
        zoomRef.current = nz;
        // Throttle via rAF — don't setState every touch move
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            setPan({ ...panRef.current });
            setZoom(zoomRef.current);
            rafRef.current = null;
          });
        }
        return;
      }

      // Single finger
      const dx = gs.moveX - g.lastX;
      const dy = gs.moveY - g.lastY;
      g.lastX = gs.moveX;
      g.lastY = gs.moveY;

      if (Math.hypot(gs.moveX - g.startX, gs.moveY - g.startY) > 5) {
        g.moved = true;
      }

      // Loupe mode — update loupe position
      if (loupeRef.current) {
        const raw = screen2img(gs.moveX, gs.moveY);
        const snapped = snapPt(raw.x, raw.y, true);
        setLoupe({ imgX: snapped.x, imgY: snapped.y, fingerX: gs.moveX, fingerY: gs.moveY });
        return;
      }

      // Pan mode (if moved enough) — throttled via rAF
      if (g.moved) {
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
        panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            setPan({ ...panRef.current });
            rafRef.current = null;
          });
        }
      }
    },

    onPanResponderRelease: (_, gs) => {
      const g = gestRef.current;
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      g.startDist = 0;

      // Loupe release — place point at loupe position (already snapped)
      if (loupeRef.current && loupe) {
        loupeRef.current = false;
        // Check closing
        if (points.length >= 3) {
          const f = points[0];
          const thr = SNAP_PX / zoomRef.current;
          if (Math.hypot(loupe.imgX - f.x, loupe.imgY - f.y) < thr * 2) {
            if (scale) setStep('name'); else setStep('calibrate');
            setLoupe(null);
            return;
          }
        }
        placePoint(loupe.imgX, loupe.imgY);
        setLoupe(null);
        return;
      }
      loupeRef.current = false;
      setLoupe(null);

      // Quick tap — place point
      if (!g.moved && !g.isPinch) {
        const raw = screen2img(gs.x0, gs.y0);
        const snapped = snapPt(raw.x, raw.y, false);
        if (snapped.closing) {
          if (scale) setStep('name'); else setStep('calibrate');
        } else {
          placePoint(snapped.x, snapped.y);
        }
      }
    },
  }), [screen2img, snapPt, placePoint, scale, loupe]);

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleImageSelected = useCallback((uri: string, w: number, h: number, sourcePdf?: string) => {
    setImageUri(uri); setImgNat({ w, h }); setStep('trace');
    if (sourcePdf !== undefined) setPdfUri(sourcePdf);
    // Reset points/scale when switching pages
    setPoints([]); setScale(null);
  }, []);

  const handleCalibrate = useCallback((sideIdx: number, cm: number) => {
    if (points.length < 2) return;
    const p1 = points[sideIdx], p2 = points[(sideIdx + 1) % points.length];
    setScale(Math.hypot(p2.x - p1.x, p2.y - p1.y) / cm);
    setStep('name');
  }, [points]);

  const handleConfirmRoom = useCallback((name: string) => {
    setTracedRooms(prev => [...prev, { id: generateId(), points: [...points], name, closed: true }]);
    setPoints([]);
    setStep('trace');
  }, [points]);

  const handleFinishAll = useCallback(() => {
    if (!scale || tracedRooms.length === 0) return;
    const rooms: Room[] = tracedRooms.map(tr => {
      const verts: Vertex[] = tr.points.map(p => ({ x: p.x / scale / 100, y: p.y / scale / 100 }));
      const poly = calcPoly(verts);
      return {
        id: tr.id,  // preserve original id so CalcScreen can dedupe
        name: tr.name,
        v: verts,
        aO: Math.round(poly.a * 100) / 100, pO: Math.round(poly.p * 100) / 100,
        canvas: { qty: Math.round(poly.a * 100) / 100 },
        mainProf: { qty: Math.round(poly.p * 100) / 100 },
        options: [],
      };
    });
    onFinishAll(rooms);
  }, [scale, tracedRooms, onFinishAll]);

  const undo = useCallback(() => setPoints(prev => prev.slice(0, -1)), []);

  const getSideCm = useCallback((pts: Array<{ x: number; y: number }>, i: number) => {
    if (!scale) return null;
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / scale);
  }, [scale]);

  // ─── Render: sub-screens ──────────────────────────────────────────

  if (step === 'pick') return <PickSourceStep onImage={handleImageSelected} onPickPdf={() => setStep('pickPdf')} onBack={onBack} insets={insets} />;
  if (step === 'pickPdf') return <PdfPicker onImage={handleImageSelected} onBack={() => setStep(imageUri ? 'trace' : 'pick')} insets={insets} initialPdfUri={pdfUri} />;
  if (step === 'calibrate') return <CalibrationStep points={points} onCalibrate={handleCalibrate} insets={insets} />;
  if (step === 'name') {
    const vs: Vertex[] = scale ? points.map(p => ({ x: p.x / scale / 100, y: p.y / scale / 100 })) : [];
    const poly = vs.length >= 3 ? calcPoly(vs) : { a: 0, p: 0 };
    return <NameRoomStep area={poly.a} perim={poly.p} pointCount={points.length}
      defaultName={nextRoomName([...existingNames, ...tracedRooms.map(r => r.name)])}
      onConfirm={handleConfirmRoom} onBack={() => setStep('trace')} insets={insets} />;
  }

  // ─── Render: main trace screen ────────────────────────────────────

  const imgW = imgNat.w;
  const imgH = imgNat.h;

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="bg-white/95 border-b border-border px-4 pb-2 z-10" style={{ paddingTop: insets.top + 4 }}
        onLayout={(e) => { headerH.current = e.nativeEvent.layout.height; }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Pressable onPress={onBack} className="w-8 h-8 rounded-lg bg-bg items-center justify-center">
              <Text className="text-navy text-lg font-bold">‹</Text>
            </Pressable>
            {pdfUri && (
              <Pressable onPress={() => setStep('pickPdf')} className="bg-bg px-2 py-1 rounded-lg">
                <Text className="text-accent text-xs font-semibold">📄 К листам</Text>
              </Pressable>
            )}
            <Text className="text-sm font-bold text-navy">
              {points.length > 0 ? `Точка ${ALPHA[points.length] ?? '?'}` : 'Обводка'}
            </Text>
            {points.length > 0 && (
              <Pressable onPress={undo} className="bg-red-50 px-2 py-1 rounded-lg">
                <Text className="text-red-500 text-xs font-semibold">↩</Text>
              </Pressable>
            )}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => setMagnetEnabled(v => !v)}
              style={{
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                backgroundColor: magnetEnabled ? '#16a34a' : '#e8e8e4',
              }}
            >
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: magnetEnabled ? '#fff' : '#6b6b7a',
              }}>
                🧲 {magnetEnabled ? 'ВКЛ' : 'ВЫКЛ'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowGrid(v => !v)}
              style={{
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                backgroundColor: showGrid ? '#4F46E5' : '#e8e8e4',
              }}
            >
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: showGrid ? '#fff' : '#6b6b7a',
              }}>
                ▦
              </Text>
            </Pressable>
            <Text className="text-muted text-xs ml-1">{tracedRooms.length}п.</Text>
          </View>
        </View>
      </View>

      {/* Canvas — PanResponder handles all touches */}
      <View style={{ flex: 1, overflow: 'hidden' }} {...panResponder.panHandlers}>
        {/* Image + SVG in same transformed container — SVG uses image coords */}
        {/* Only the container transform changes on pan/zoom, SVG content stays static */}
        <View style={{
          position: 'absolute',
          left: pan.x,
          top: pan.y,
          width: imgW,
          height: imgH,
          transform: [{ scale: zoom }],
          transformOrigin: 'top left',
        }}>
          <Image
            source={{ uri: imageUri! }}
            style={{ width: imgW, height: imgH }}
            resizeMode="stretch"
          />
          {/* SVG in image-pixel coords, scaled by transform */}
          <Svg width={imgW} height={imgH} viewBox={`0 0 ${imgW} ${imgH}`}
            style={StyleSheet.absoluteFill}>
            {/* Grid overlay — SVG Pattern (tiled, fast even with thousands of cells) */}
            {showGrid && (
              <>
                <Defs>
                  <Pattern id="grid" x="0" y="0" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                    <SvgPath d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`}
                      stroke="#4F46E5" strokeWidth={0.15} opacity={0.5} fill="none" />
                  </Pattern>
                </Defs>
                <Rect x={0} y={0} width={imgW} height={imgH} fill="url(#grid)" />
              </>
            )}
            {/* Traced rooms */}
            {tracedRooms.map((tr, ri) => {
              const color = ROOM_COLORS[ri % ROOM_COLORS.length];
              return (
                <G key={tr.id}>
                  <SvgPolygon points={tr.points.map(p => `${p.x},${p.y}`).join(' ')} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
                  {tr.points.map((p, i) => (
                    <G key={`tp-${ri}-${i}`}>
                      <SvgCircle cx={p.x} cy={p.y} r={4} fill={color} stroke="white" strokeWidth={1} />
                      <SvgText x={p.x} y={p.y - 7} textAnchor="middle" fill={color} fontSize={8} fontWeight="700">{ALPHA[i]}</SvgText>
                    </G>
                  ))}
                  {tr.points.map((p, i) => {
                    const cm = getSideCm(tr.points, i);
                    if (!cm) return null;
                    const p2 = tr.points[(i + 1) % tr.points.length];
                    return <SvgText key={`tl-${ri}-${i}`} x={(p.x+p2.x)/2} y={(p.y+p2.y)/2 - 5}
                      textAnchor="middle" fill={color} fontSize={8} fontWeight="600">{cm}</SvgText>;
                  })}
                  <SvgText x={tr.points.reduce((s,p)=>s+p.x,0)/tr.points.length}
                    y={tr.points.reduce((s,p)=>s+p.y,0)/tr.points.length}
                    textAnchor="middle" fill={color} fontSize={11} fontWeight="800">{tr.name}</SvgText>
                </G>
              );
            })}

            {/* Current polygon fill */}
            {points.length >= 3 && (
              <SvgPolygon points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(79,70,229,0.08)" stroke="none" />
            )}

            {/* Lines */}
            {points.map((p, i) => {
              if (i === 0) return null;
              return <Line key={`l-${i}`} x1={points[i-1].x} y1={points[i-1].y} x2={p.x} y2={p.y} stroke="#4F46E5" strokeWidth={2} />;
            })}

            {/* Side lengths */}
            {scale && points.map((p, i) => {
              if (i >= points.length - 1) return null;
              const cm = getSideCm(points, i);
              if (!cm) return null;
              const p2 = points[i + 1];
              return <SvgText key={`cl-${i}`} x={(p.x+p2.x)/2} y={(p.y+p2.y)/2 - 5}
                textAnchor="middle" fill="#4F46E5" fontSize={8} fontWeight="600">{cm}</SvgText>;
            })}

            {/* Points with letters */}
            {points.map((p, i) => (
              <G key={`p-${i}`}>
                <SvgCircle cx={p.x} cy={p.y} r={6} fill={i === 0 ? '#16a34a' : '#4F46E5'} stroke="white" strokeWidth={1.5} />
                <SvgText x={p.x} y={p.y - 10} textAnchor="middle" fill="#4F46E5" fontSize={10} fontWeight="800">{ALPHA[i]}</SvgText>
              </G>
            ))}

            {/* Loupe crosshair */}
            {loupe && <SvgCircle cx={loupe.imgX} cy={loupe.imgY} r={4} fill="none" stroke="#f59e0b" strokeWidth={2} />}
          </Svg>
        </View>

        {/* Loupe circle — follows finger, flips when near edge */}
        {loupe && imageUri && (() => {
          const sz = 130;
          const gap = 40; // distance from finger to loupe edge
          const fx = loupe.fingerX;
          const fy = loupe.fingerY;
          const sw = SCREEN.width;
          const sh = SCREEN.height;

          const d = 140; // 2x further from finger
          const offX = 30;
          const offY = d;
          const candidates = [
            { x: fx + offX - sz/2, y: fy - sz - offY, pri: 4 },     // above-right (best)
            { x: fx - offX - sz/2, y: fy - sz - offY, pri: 3 },     // above-left
            { x: fx + offX - sz/2, y: fy + offY, pri: 2 },           // below-right
            { x: fx - offX - sz/2, y: fy + offY, pri: 1 },           // below-left
          ];

          let best = candidates[0];
          let bestScore = -Infinity;
          for (const pos of candidates) {
            const fitsX = pos.x >= 5 && pos.x + sz <= sw - 5;
            const fitsY = pos.y >= insets.top + 45 && pos.y + sz <= sh - 60;
            const score = (fitsX && fitsY ? 10 : 0) + pos.pri;
            if (score > bestScore) { bestScore = score; best = pos; }
          }

          const lLeft = Math.max(5, Math.min(best.x, sw - sz - 5));
          const lTop = Math.max(insets.top + 45, Math.min(best.y, sh - sz - 60));
          const magZoom = Math.max(zoom * 2.5, 2);
          return (
            <View pointerEvents="none" style={{
              position: 'absolute', left: lLeft, top: lTop, width: sz, height: sz,
              borderRadius: sz / 2, borderWidth: 3, borderColor: '#4F46E5',
              overflow: 'hidden', backgroundColor: '#fff',
            }}>
              <Image source={{ uri: imageUri }} style={{
                width: imgW * magZoom,
                height: imgH * magZoom,
                marginLeft: -(loupe.imgX * magZoom - sz / 2),
                marginTop: -(loupe.imgY * magZoom - sz / 2),
              }} resizeMode="stretch" />
              <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: sz, height: 1.5, backgroundColor: 'rgba(79,70,229,0.3)', position: 'absolute' }} />
                <View style={{ width: 1.5, height: sz, backgroundColor: 'rgba(79,70,229,0.3)', position: 'absolute' }} />
                <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#4F46E5' }} />
              </View>
            </View>
          );
        })()}
      </View>

      {/* Bottom panel */}
      <View className="bg-white/95 border-t border-border px-4 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
        {tracedRooms.length > 0 && (
          <View className="flex-row gap-2 mb-2 flex-wrap">
            {tracedRooms.map(tr => (
              <View key={tr.id} className="bg-green-50 border border-green-200 px-2 py-1 rounded-lg flex-row items-center gap-1">
                <Text className="text-green-700 text-xs font-semibold">{tr.name}</Text>
                <Pressable onPress={() => setTracedRooms(prev => prev.filter(r => r.id !== tr.id))}>
                  <Text className="text-red-400 text-xs">✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View className="flex-row items-center justify-between">
          <Text className="text-muted text-xs">Тап · Зажми=лупа · 2п=двигать</Text>
          <View className="flex-row gap-2">
            {points.length >= 3 && (
              <Pressable onPress={() => { if (scale) setStep('name'); else setStep('calibrate'); }} className="bg-green-500 px-3 py-2 rounded-xl">
                <Text className="text-white font-bold text-xs">✓ Замкнуть</Text>
              </Pressable>
            )}
            {tracedRooms.length > 0 && points.length === 0 && (
              <Pressable onPress={handleFinishAll} className="bg-navy px-4 py-2 rounded-xl">
                <Text className="text-white font-bold text-xs">Готово →</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
