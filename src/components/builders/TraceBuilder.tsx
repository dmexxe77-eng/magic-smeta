import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  Image,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, {
  Polygon as SvgPolygon,
  Line,
  Circle as SvgCircle,
  Text as SvgText,
  G,
} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calcPoly, fmt } from '../../utils/geometry';
import { generateId } from '../../utils/storage';
import type { Room, Vertex } from '../../types';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SCREEN = Dimensions.get('window');
const SNAP_THRESHOLD = 10; // px для привязки к горизонтали/вертикали

// ─── Types ──────────────────────────────────────────────────────────

export interface TracedRoom {
  points: Array<{ x: number; y: number }>; // in image pixel coords
  name: string;
  closed: boolean;
}

interface TraceBuilderProps {
  existingCount: number;
  onFinish: (room: Room) => void;
  onBack: () => void;
  initialScale?: number;
  onScaleSet?: (scale: number) => void;
  initialImageUri?: string;
  initialTracedRooms?: TracedRoom[];
  onTracedRoomsChange?: (rooms: TracedRoom[]) => void;
}

// ─── Main Component ─────────────────────────────────────────────────

export default function TraceBuilder({
  existingCount,
  onFinish,
  onBack,
  initialScale,
  onScaleSet,
  initialImageUri,
  initialTracedRooms,
  onTracedRoomsChange,
}: TraceBuilderProps) {
  const insets = useSafeAreaInsets();

  // Image state
  const [imageUri, setImageUri] = useState<string | null>(initialImageUri ?? null);
  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const [fitScale, setFitScale] = useState(1); // how image fits on screen

  // Points in image pixel coordinates
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [tracedRooms, setTracedRooms] = useState<TracedRoom[]>(initialTracedRooms ?? []);
  const [closed, setClosed] = useState(false);
  const [roomName, setRoomName] = useState(`Помещение ${existingCount + tracedRooms.length + 1}`);

  // Calibration
  const [scale, setScale] = useState<number | null>(initialScale ?? null); // px per cm
  const [calibSide, setCalibSide] = useState<number | null>(null); // which side to calibrate
  const [calibInput, setCalibInput] = useState('');

  // Mode: 'point' = tap places point, 'move' = pan/zoom
  const [mode, setMode] = useState<'point' | 'move'>('point');

  // Zoom/pan state synced to React for SVG
  const [viewZoom, setViewZoom] = useState(1);
  const [viewTx, setViewTx] = useState(0);
  const [viewTy, setViewTy] = useState(0);

  // Shared values for gestures
  const zoomScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // ─── Pick image ───────────────────────────────────────────────────

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const w = asset.width;
      const h = asset.height;
      setImageSize({ w, h });
      // Fit image to screen width
      const screenW = SCREEN.width;
      const fs = screenW / w;
      setFitScale(fs);
    }
  }, []);

  // Load image size if URI provided
  useEffect(() => {
    if (imageUri && imageSize.w === 1) {
      Image.getSize(imageUri, (w, h) => {
        setImageSize({ w, h });
        setFitScale(SCREEN.width / w);
      });
    }
  }, [imageUri]);

  // ─── Sync view state ──────────────────────────────────────────────

  const syncView = useCallback(() => {
    setViewZoom(zoomScale.value);
    setViewTx(translateX.value);
    setViewTy(translateY.value);
  }, []);

  // ─── Snap point to horizontal/vertical ────────────────────────────

  const snapPoint = useCallback((imgX: number, imgY: number): { x: number; y: number } => {
    if (points.length === 0) return { x: imgX, y: imgY };
    const lastPt = points[points.length - 1];
    let x = imgX;
    let y = imgY;
    const threshold = SNAP_THRESHOLD / (fitScale * viewZoom);

    if (Math.abs(imgX - lastPt.x) < threshold) x = lastPt.x;
    if (Math.abs(imgY - lastPt.y) < threshold) y = lastPt.y;

    // Also snap to first point for closing
    if (points.length >= 3) {
      const firstPt = points[0];
      const closeDist = Math.hypot(imgX - firstPt.x, imgY - firstPt.y);
      if (closeDist < threshold * 2) {
        return { x: firstPt.x, y: firstPt.y };
      }
    }

    return { x, y };
  }, [points, fitScale, viewZoom]);

  // ─── Screen to image coordinate conversion ───────────────────────

  const screenToImage = useCallback((sx: number, sy: number) => {
    const imgX = (sx - viewTx) / (fitScale * viewZoom);
    const imgY = (sy - viewTy) / (fitScale * viewZoom);
    return { x: imgX, y: imgY };
  }, [fitScale, viewZoom, viewTx, viewTy]);

  // ─── Handle tap to place point ────────────────────────────────────

  const handleTap = useCallback((screenX: number, screenY: number) => {
    if (closed || mode !== 'point') return;

    const raw = screenToImage(screenX, screenY);
    const snapped = snapPoint(raw.x, raw.y);

    // Check if closing
    if (points.length >= 3) {
      const firstPt = points[0];
      const dist = Math.hypot(snapped.x - firstPt.x, snapped.y - firstPt.y);
      const threshold = SNAP_THRESHOLD / (fitScale * viewZoom);
      if (dist < threshold * 2) {
        setClosed(true);
        if (scale) {
          // Skip calibration, go to name
        } else {
          setCalibSide(0); // calibrate first side
        }
        return;
      }
    }

    setPoints(prev => [...prev, snapped]);
  }, [closed, mode, screenToImage, snapPoint, points, fitScale, viewZoom, scale]);

  // ─── Calibration ──────────────────────────────────────────────────

  const handleCalibrate = useCallback(() => {
    if (calibSide == null || points.length < 2) return;
    const cm = parseFloat(calibInput.replace(',', '.'));
    if (!cm || cm <= 0) return;

    const p1 = points[calibSide];
    const p2 = points[(calibSide + 1) % points.length];
    const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const newScale = pxDist / cm;

    setScale(newScale);
    setCalibSide(null);
    setCalibInput('');
    onScaleSet?.(newScale);
  }, [calibSide, calibInput, points, onScaleSet]);

  // ─── Finish room ──────────────────────────────────────────────────

  const handleFinish = useCallback(() => {
    if (!scale || points.length < 3) return;

    // Convert image pixels to meters using scale
    const verts: Vertex[] = points.map(p => ({
      x: p.x / scale / 100, // px -> cm -> m
      y: p.y / scale / 100,
    }));

    const poly = calcPoly(verts);
    const room: Room = {
      id: generateId(),
      name: roomName.trim() || `Помещение ${existingCount + tracedRooms.length + 1}`,
      v: verts,
      aO: Math.round(poly.a * 100) / 100,
      pO: Math.round(poly.p * 100) / 100,
      canvas: { qty: Math.round(poly.a * 100) / 100 },
      mainProf: { qty: Math.round(poly.p * 100) / 100 },
      options: [],
    };

    // Save traced room for re-entry
    const newTraced: TracedRoom = { points: [...points], name: room.name, closed: true };
    const updatedTraced = [...tracedRooms, newTraced];
    setTracedRooms(updatedTraced);
    onTracedRoomsChange?.(updatedTraced);

    onFinish(room);
  }, [scale, points, roomName, existingCount, tracedRooms, onFinish, onTracedRoomsChange]);

  // ─── Undo ─────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (closed) {
      setClosed(false);
      setCalibSide(null);
    } else {
      setPoints(prev => prev.slice(0, -1));
    }
  }, [closed]);

  // ─── New room on same plan ────────────────────────────────────────

  const startNewRoom = useCallback(() => {
    setPoints([]);
    setClosed(false);
    setCalibSide(null);
    setRoomName(`Помещение ${existingCount + tracedRooms.length + 1}`);
  }, [existingCount, tracedRooms.length]);

  // ─── Gestures ─────────────────────────────────────────────────────

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      if (mode === 'point') {
        runOnJS(handleTap)(e.absoluteX, e.absoluteY - insets.top - 44); // offset for header
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = zoomScale.value;
    })
    .onUpdate((e) => {
      zoomScale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 10));
    })
    .onEnd(() => {
      runOnJS(syncView)();
    });

  const panGesture = Gesture.Pan()
    .minPointers(mode === 'move' ? 1 : 2)
    .onStart(() => {
      savedTx.value = translateX.value;
      savedTy.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTx.value + e.translationX;
      translateY.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(syncView)();
    });

  const composedGesture = Gesture.Simultaneous(
    tapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoomScale.value },
    ],
  }));

  // ─── Side length in cm ────────────────────────────────────────────

  const getSideCm = useCallback((i: number) => {
    if (!scale || i >= points.length) return null;
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    return Math.round(pxDist / scale);
  }, [scale, points]);

  // ─── Image to SVG coordinates ─────────────────────────────────────

  const imgToSvg = useCallback((imgX: number, imgY: number) => ({
    x: imgX * fitScale,
    y: imgY * fitScale,
  }), [fitScale]);

  // ─── Render: no image yet ─────────────────────────────────────────

  if (!imageUri) {
    return (
      <View className="flex-1 bg-bg">
        <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
          <View className="flex-row items-center gap-3">
            <Pressable onPress={onBack} className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center">
              <Text className="text-navy text-xl font-bold">‹</Text>
            </Pressable>
            <Text className="text-[14px] font-bold text-navy">Обводка</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8 gap-5">
          <Text className="text-6xl">📐</Text>
          <Text className="text-xl font-black text-navy text-center">Обводка плана</Text>
          <Text className="text-muted text-sm text-center leading-6">
            Загрузите чертёж или фото плана помещения.{'\n'}
            Расставьте точки по углам — обведите контур.
          </Text>
          <Pressable onPress={pickImage} className="bg-accent px-8 py-4 rounded-xl">
            <Text className="text-white font-bold text-base">📷 Выбрать из галереи</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Render: calibration ──────────────────────────────────────────

  if (calibSide != null) {
    const sideIdx = calibSide;
    return (
      <View className="flex-1 bg-bg">
        <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
          <View className="flex-row items-center gap-3">
            <Text className="text-[14px] font-bold text-navy">Калибровка</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8 gap-5">
          <Text className="text-4xl">📏</Text>
          <Text className="text-lg font-bold text-navy text-center">
            Введите длину стороны {ALPHA[sideIdx]}–{ALPHA[(sideIdx + 1) % points.length]}
          </Text>
          <Text className="text-muted text-sm text-center">в сантиметрах</Text>
          <TextInput
            value={calibInput}
            onChangeText={setCalibInput}
            placeholder="385"
            placeholderTextColor="#b0b0ba"
            keyboardType="decimal-pad"
            autoFocus
            className="bg-white border border-border rounded-xl px-4 py-3 text-navy text-2xl text-center w-40"
          />
          <Pressable onPress={handleCalibrate} className="bg-navy px-8 py-4 rounded-xl">
            <Text className="text-white font-bold text-base">Готово</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Render: closed, enter name ───────────────────────────────────

  if (closed && scale) {
    const verts: Vertex[] = points.map(p => ({
      x: p.x / scale / 100,
      y: p.y / scale / 100,
    }));
    const poly = calcPoly(verts);

    return (
      <View className="flex-1 bg-bg">
        <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
          <View className="flex-row items-center gap-3">
            <Pressable onPress={undo} className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center">
              <Text className="text-navy text-xl font-bold">‹</Text>
            </Pressable>
            <Text className="text-[14px] font-bold text-navy">Помещение готово</Text>
          </View>
        </View>
        <View className="flex-1 px-6 pt-6 gap-4">
          <View className="bg-green-50 border border-green-200 rounded-xl p-4">
            <Text className="text-green-700 font-bold text-base mb-1">
              ✓ Контур замкнут · {points.length} точек
            </Text>
            <Text className="text-muted text-sm">
              {fmt(poly.a)} м²  ·  {fmt(poly.p)} м.п.
            </Text>
          </View>

          <TextInput
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Название помещения"
            placeholderTextColor="#b0b0ba"
            className="bg-white border border-border rounded-xl px-4 py-3 text-navy text-base"
          />

          <View className="flex-row gap-3">
            <Pressable onPress={undo} className="flex-1 border border-border rounded-xl py-3 items-center">
              <Text className="text-muted font-semibold">↩ Изменить</Text>
            </Pressable>
            <Pressable onPress={handleFinish} className="flex-[2] bg-navy rounded-xl py-3 items-center">
              <Text className="text-white font-bold">Добавить →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ─── Render: main tracing screen ──────────────────────────────────

  const imgW = imageSize.w * fitScale;
  const imgH = imageSize.h * fitScale;
  const invZoom = 1 / viewZoom;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="bg-white/95 border-b border-border px-4 pb-2 z-10" style={{ paddingTop: insets.top + 4 }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Pressable onPress={onBack} className="w-8 h-8 rounded-lg bg-bg items-center justify-center">
                <Text className="text-navy text-lg font-bold">‹</Text>
              </Pressable>
              <Text className="text-sm font-bold text-navy">
                Точка {ALPHA[points.length] ?? '?'}
              </Text>
              {points.length > 0 && (
                <Pressable onPress={undo} className="bg-red-50 px-2 py-1 rounded-lg">
                  <Text className="text-red-500 text-xs font-semibold">↩</Text>
                </Pressable>
              )}
            </View>
            <Text className="text-muted text-xs">
              {points.length} точ. · {tracedRooms.length} пом.
            </Text>
          </View>
        </View>

        {/* Canvas */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            {/* Image */}
            <Image
              source={{ uri: imageUri }}
              style={{ width: imgW, height: imgH }}
              resizeMode="contain"
            />

            {/* SVG overlay — inside Animated.View so it moves with image */}
            <Svg
              width={imgW}
              height={imgH}
              style={StyleSheet.absoluteFill}
            >
              {/* Previously traced rooms */}
              {tracedRooms.map((tr, ri) => {
                const polyPts = tr.points.map(p => imgToSvg(p.x, p.y));
                return (
                  <G key={`tr-${ri}`}>
                    <SvgPolygon
                      points={polyPts.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(34,197,94,0.1)"
                      stroke="#22c55e"
                      strokeWidth={1.5 * invZoom}
                    />
                    {/* Room name */}
                    {polyPts.length > 0 && (
                      <SvgText
                        x={polyPts.reduce((s, p) => s + p.x, 0) / polyPts.length}
                        y={polyPts.reduce((s, p) => s + p.y, 0) / polyPts.length}
                        textAnchor="middle"
                        fill="#22c55e"
                        fontSize={11 * invZoom}
                        fontWeight="700"
                      >
                        {tr.name}
                      </SvgText>
                    )}
                  </G>
                );
              })}

              {/* Current polygon fill */}
              {points.length >= 3 && (
                <SvgPolygon
                  points={points.map(p => {
                    const s = imgToSvg(p.x, p.y);
                    return `${s.x},${s.y}`;
                  }).join(' ')}
                  fill="rgba(79,70,229,0.08)"
                  stroke="none"
                />
              )}

              {/* Lines between points */}
              {points.map((p, i) => {
                if (i === 0) return null;
                const s1 = imgToSvg(points[i - 1].x, points[i - 1].y);
                const s2 = imgToSvg(p.x, p.y);
                return (
                  <Line
                    key={`line-${i}`}
                    x1={s1.x} y1={s1.y}
                    x2={s2.x} y2={s2.y}
                    stroke="#4F46E5"
                    strokeWidth={2 * invZoom}
                  />
                );
              })}

              {/* Closing line if closed */}
              {closed && points.length >= 3 && (() => {
                const s1 = imgToSvg(points[points.length - 1].x, points[points.length - 1].y);
                const s2 = imgToSvg(points[0].x, points[0].y);
                return (
                  <Line
                    x1={s1.x} y1={s1.y}
                    x2={s2.x} y2={s2.y}
                    stroke="#4F46E5"
                    strokeWidth={2 * invZoom}
                  />
                );
              })()}

              {/* Side lengths */}
              {scale && points.map((p, i) => {
                if (i === points.length - 1 && !closed) return null;
                const p2 = points[(i + 1) % points.length];
                const s1 = imgToSvg(p.x, p.y);
                const s2 = imgToSvg(p2.x, p2.y);
                const mx = (s1.x + s2.x) / 2;
                const my = (s1.y + s2.y) / 2;
                const cm = getSideCm(i);
                if (!cm) return null;
                return (
                  <SvgText
                    key={`len-${i}`}
                    x={mx}
                    y={my - 6 * invZoom}
                    textAnchor="middle"
                    fill="#4F46E5"
                    fontSize={9 * invZoom}
                    fontWeight="600"
                  >
                    {cm}
                  </SvgText>
                );
              })}

              {/* Points with letters */}
              {points.map((p, i) => {
                const s = imgToSvg(p.x, p.y);
                const isFirst = i === 0;
                const isLast = i === points.length - 1;
                return (
                  <G key={`pt-${i}`}>
                    <SvgCircle
                      cx={s.x}
                      cy={s.y}
                      r={6 * invZoom}
                      fill={isFirst ? '#16a34a' : isLast ? '#f59e0b' : '#4F46E5'}
                      stroke="white"
                      strokeWidth={1.5 * invZoom}
                    />
                    <SvgText
                      x={s.x}
                      y={s.y - 10 * invZoom}
                      textAnchor="middle"
                      fill="#4F46E5"
                      fontSize={10 * invZoom}
                      fontWeight="800"
                    >
                      {ALPHA[i]}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </Animated.View>
        </GestureDetector>

        {/* Bottom panel */}
        <View className="bg-white/95 border-t border-border px-4 py-3" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="flex-row items-center justify-between">
            {/* Mode toggle */}
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setMode('point')}
                style={{
                  backgroundColor: mode === 'point' ? '#4F46E5' : '#f7f7f5',
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                }}
              >
                <Text style={{ color: mode === 'point' ? '#fff' : '#888', fontSize: 12, fontWeight: '700' }}>
                  ✏️ Точки
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('move')}
                style={{
                  backgroundColor: mode === 'move' ? '#f59e0b' : '#f7f7f5',
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                }}
              >
                <Text style={{ color: mode === 'move' ? '#fff' : '#888', fontSize: 12, fontWeight: '700' }}>
                  ✋ Двигать
                </Text>
              </Pressable>
            </View>

            {/* Close button */}
            {points.length >= 3 && !closed && (
              <Pressable
                onPress={() => {
                  setClosed(true);
                  if (!scale) setCalibSide(0);
                }}
                className="bg-green-500 px-4 py-2 rounded-xl"
              >
                <Text className="text-white font-bold text-xs">✓ Замкнуть</Text>
              </Pressable>
            )}

            {/* Info */}
            <Text className="text-muted text-xs">
              {scale ? `1px = ${(1/scale).toFixed(3)}см` : 'нет масштаба'}
            </Text>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
