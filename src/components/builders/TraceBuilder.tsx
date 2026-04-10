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
  FlatList,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
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
// DocumentPicker requires native rebuild — disabled for now
// import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calcPoly, fmt } from '../../utils/geometry';
import { generateId } from '../../utils/storage';
import { detectCorners, type DetectedCorner } from '../../utils/cornerDetector';
import type { Room, Vertex } from '../../types';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SCREEN = Dimensions.get('window');
const SNAP_PX = 10;
const ROOM_COLORS = [
  '#4F46E5', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

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
  scale: number | null; // px per cm
}

interface TraceBuilderProps {
  existingCount: number;
  onFinishAll: (rooms: Room[]) => void;
  onBack: () => void;
  session?: TraceSession | null;
  onSessionChange?: (session: TraceSession) => void;
}

// ─── Step: Pick Source ──────────────────────────────────────────────

function PickSourceStep({
  onImage,
  onPdf,
  onBack,
  insets,
}: {
  onImage: (uri: string, w: number, h: number) => void;
  onPdf: () => void;
  onBack: () => void;
  insets: { top: number };
}) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      onImage(a.uri, a.width, a.height);
    }
  };

  const pickPdf = async () => {
    Alert.alert('PDF', 'PDF поддержка будет добавлена после пересборки. Пока выберите скриншот плана из галереи.');
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
      <View className="flex-1 items-center justify-center px-8 gap-5">
        <Text className="text-6xl">📐</Text>
        <Text className="text-xl font-black text-navy text-center">Выберите план</Text>
        <Text className="text-muted text-sm text-center leading-6">
          Загрузите чертёж или фото плана помещения.{'\n'}
          Расставьте точки по углам — обведите контур.
        </Text>
        <Pressable onPress={pickImage} className="bg-accent px-8 py-4 rounded-xl w-full items-center">
          <Text className="text-white font-bold text-base">📷 Фото из галереи</Text>
        </Pressable>
        <Pressable onPress={pickPdf} className="bg-navy px-8 py-4 rounded-xl w-full items-center">
          <Text className="text-white font-bold text-base">📄 PDF документ</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step: Calibration ──────────────────────────────────────────────

function CalibrationStep({
  points,
  onCalibrate,
  insets,
}: {
  points: Array<{ x: number; y: number }>;
  onCalibrate: (sideIdx: number, cm: number) => void;
  insets: { top: number };
}) {
  const [input, setInput] = useState('');
  const [selectedSide, setSelectedSide] = useState(0);
  const numSides = points.length;

  const submit = () => {
    const cm = parseFloat(input.replace(',', '.'));
    if (cm > 0) onCalibrate(selectedSide, cm);
  };

  return (
    <View className="flex-1 bg-bg">
      <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
        <Text className="text-[14px] font-bold text-navy px-4">Калибровка</Text>
      </View>
      <View className="flex-1 items-center justify-center px-8 gap-5">
        <Text className="text-4xl">📏</Text>
        <Text className="text-sm text-muted">Выберите сторону и введите длину</Text>

        {/* Side selector */}
        <View className="flex-row flex-wrap gap-2 justify-center">
          {Array.from({ length: numSides }).map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setSelectedSide(i)}
              style={{
                backgroundColor: selectedSide === i ? '#4F46E5' : '#f7f7f5',
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                borderWidth: 1, borderColor: selectedSide === i ? '#4F46E5' : '#e8e8e4',
              }}
            >
              <Text style={{ color: selectedSide === i ? '#fff' : '#555', fontSize: 13, fontWeight: '700' }}>
                {ALPHA[i]}–{ALPHA[(i + 1) % numSides]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-lg font-bold text-navy">
          Сторона {ALPHA[selectedSide]}–{ALPHA[(selectedSide + 1) % numSides]}
        </Text>
        <View className="flex-row items-center gap-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="см"
            placeholderTextColor="#b0b0ba"
            keyboardType="number-pad"
            autoFocus
            onSubmitEditing={submit}
            className="bg-white border border-border rounded-xl px-4 py-3 text-navy text-2xl text-center w-32"
          />
          <Pressable onPress={submit} className="bg-navy px-6 py-3 rounded-xl">
            <Text className="text-white font-bold text-lg">OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Step: Name Room ────────────────────────────────────────────────

function NameRoomStep({
  area,
  perim,
  pointCount,
  defaultName,
  onConfirm,
  onBack,
  insets,
}: {
  area: number;
  perim: number;
  pointCount: number;
  defaultName: string;
  onConfirm: (name: string) => void;
  onBack: () => void;
  insets: { top: number };
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
          <Text className="text-green-700 font-bold text-base mb-1">
            ✓ Контур замкнут · {pointCount} точек
          </Text>
          <Text className="text-muted text-sm">{fmt(area)} м²  ·  {fmt(perim)} м.п.</Text>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Название помещения"
          placeholderTextColor="#b0b0ba"
          autoFocus
          className="bg-white border border-border rounded-xl px-4 py-3 text-navy text-base"
        />
        <Pressable
          onPress={() => onConfirm(name.trim() || defaultName)}
          className="bg-navy rounded-xl py-3 items-center"
        >
          <Text className="text-white font-bold">Добавить и продолжить обводку →</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main TraceBuilder ──────────────────────────────────────────────

export default function TraceBuilder({
  existingCount,
  onFinishAll,
  onBack,
  session: initialSession,
  onSessionChange,
}: TraceBuilderProps) {
  const insets = useSafeAreaInsets();

  // Session state
  const [imageUri, setImageUri] = useState<string | null>(initialSession?.imageUri ?? null);
  const [imageSize, setImageSize] = useState({ w: initialSession?.imageW ?? 1, h: initialSession?.imageH ?? 1 });
  const [fitScale, setFitScale] = useState(1);
  const [scale, setScale] = useState<number | null>(initialSession?.scale ?? null);
  const [tracedRooms, setTracedRooms] = useState<TracedRoom[]>(initialSession?.rooms ?? []);

  // Corner detection
  const [detectedCorners, setDetectedCorners] = useState<DetectedCorner[]>([]);
  const [cornerStatus, setCornerStatus] = useState<'idle' | 'detecting' | 'done'>('idle');

  // Current tracing state
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [step, setStep] = useState<'pick' | 'trace' | 'calibrate' | 'name'>('pick');

  // Zoom/pan synced to React
  const [vZoom, setVZoom] = useState(1);
  const [vTx, setVTx] = useState(0);
  const [vTy, setVTy] = useState(0);

  // Magnifier state
  const [mag, setMag] = useState<{ visible: boolean; screenX: number; screenY: number; imgX: number; imgY: number }>({
    visible: false, screenX: 0, screenY: 0, imgX: 0, imgY: 0,
  });
  const magStartRef = useRef<{ x: number; y: number } | null>(null);
  const magImgRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);

  // Canvas layout offset (measured from onLayout)
  const canvasTopRef = useRef(0);

  // Gesture shared values
  const zs = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedZs = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // ─── Init from session ─────────────────────────────────────────────

  useEffect(() => {
    if (initialSession?.imageUri) {
      setStep('trace');
      const fs = SCREEN.width / initialSession.imageW;
      setFitScale(fs);
    }
  }, []);

  // ─── Notify parent of session changes ──────────────────────────────

  const updateSession = useCallback(() => {
    if (!imageUri) return;
    onSessionChange?.({
      imageUri,
      imageW: imageSize.w,
      imageH: imageSize.h,
      rooms: tracedRooms,
      scale,
    });
  }, [imageUri, imageSize, tracedRooms, scale, onSessionChange]);

  useEffect(() => { updateSession(); }, [tracedRooms, scale]);

  // ─── Detect corners when image is loaded ────────────────────────────

  useEffect(() => {
    if (imageUri && cornerStatus === 'idle') {
      setCornerStatus('detecting');
      detectCorners(imageUri, 300).then(corners => {
        setDetectedCorners(corners);
        setCornerStatus('done');
      }).catch(() => {
        setCornerStatus('done');
      });
    }
  }, [imageUri, cornerStatus]);

  // ─── Handle image selected ─────────────────────────────────────────

  const handleImageSelected = useCallback((uri: string, w: number, h: number) => {
    setImageUri(uri);
    setImageSize({ w, h });
    setFitScale(SCREEN.width / w);
    setStep('trace');
  }, []);

  // ─── Sync view ─────────────────────────────────────────────────────

  const syncView = useCallback(() => {
    setVZoom(zs.value);
    setVTx(tx.value);
    setVTy(ty.value);
  }, []);

  // ─── Screen to image (uses shared values for freshness) ────────────

  const screenToImg = useCallback((sx: number, sy: number) => {
    // Read shared values directly — React state may be stale during gestures
    const curZoom = zs.value;
    const curTx = tx.value;
    const curTy = ty.value;
    const imgX = (sx - curTx) / (fitScale * curZoom);
    const imgY = (sy - curTy) / (fitScale * curZoom);
    return { x: imgX, y: imgY };
  }, [fitScale, zs, tx, ty]);

  // ─── Snap ─────────────────────────────────────────────────────────

  // Simple snap: close polygon + h/v align to CURRENT polygon only
  const snapPt = useCallback((ix: number, iy: number) => {
    let x = ix, y = iy;
    const thr = SNAP_PX / (fitScale * vZoom);

    // Close polygon
    if (points.length >= 3) {
      const first = points[0];
      if (Math.hypot(ix - first.x, iy - first.y) < thr * 2) {
        return { x: first.x, y: first.y, closing: true };
      }
    }

    // H/V align ONLY with current polygon's last point
    if (points.length > 0) {
      const last = points[points.length - 1];
      if (Math.abs(ix - last.x) < thr) x = last.x;
      if (Math.abs(iy - last.y) < thr) y = last.y;
    }

    return { x, y, closing: false };
  }, [points, fitScale, vZoom]);

  // Magnetic snap: for magnifier mode — snaps to detected corners on plan
  const magSnapPt = useCallback((ix: number, iy: number) => {
    let x = ix, y = iy;
    const thr = (SNAP_PX * 0.6) / (fitScale * vZoom); // tight threshold — only very close snaps

    // 1. Close polygon
    if (points.length >= 3) {
      const first = points[0];
      if (Math.hypot(ix - first.x, iy - first.y) < thr * 2) {
        return { x: first.x, y: first.y, closing: true };
      }
    }

    // 2. Snap to detected corners (only the closest within threshold)
    let bestCorner: DetectedCorner | null = null;
    let bestDist = thr;
    for (const c of detectedCorners) {
      const d = Math.hypot(ix - c.x, iy - c.y);
      if (d < bestDist) {
        bestDist = d;
        bestCorner = c;
      }
    }
    if (bestCorner) {
      x = bestCorner.x;
      y = bestCorner.y;
    }

    // 3. H/V align to CURRENT polygon only (weaker threshold)
    if (x === ix && y === iy && points.length > 0) {
      const hvThr = thr * 0.7;
      const last = points[points.length - 1];
      if (Math.abs(ix - last.x) < hvThr) x = last.x;
      if (Math.abs(iy - last.y) < hvThr) y = last.y;
    }

    return { x, y, closing: false };
  }, [points, detectedCorners, fitScale, vZoom]);

  // ─── Handle tap (quick) ────────────────────────────────────────────

  const handleTap = useCallback((absX: number, absY: number) => {
    const canvasY = absY - canvasTopRef.current;
    const raw = screenToImg(absX, canvasY);
    const snapped = snapPt(raw.x, raw.y);

    if (snapped.closing) {
      if (scale) {
        setStep('name');
      } else {
        setStep('calibrate');
      }
      return;
    }
    setPoints(prev => [...prev, { x: snapped.x, y: snapped.y }]);
  }, [screenToImg, snapPt, scale]);

  // ─── Magnifier handlers ───────────────────────────────────────────

  const handleMagStart = useCallback((absX: number, absY: number) => {
    if (isPinchingRef.current) return; // don't show magnifier during zoom
    magStartRef.current = { x: absX, y: absY };
    const canvasY = absY - canvasTopRef.current;
    const raw = screenToImg(absX, canvasY);
    setMag({ visible: true, screenX: absX, screenY: absY, imgX: raw.x, imgY: raw.y });
  }, [screenToImg]);

  const handleMagMove = useCallback((absX: number, absY: number) => {
    if (isPinchingRef.current) return;
    const canvasY = absY - canvasTopRef.current;
    const raw = screenToImg(absX, canvasY);
    const snapped = magSnapPt(raw.x, raw.y);
    magImgRef.current = { x: snapped.x, y: snapped.y };
    setMag({ visible: true, screenX: absX, screenY: absY, imgX: snapped.x, imgY: snapped.y });
  }, [screenToImg, magSnapPt]);

  const handleMagEnd = useCallback(() => {
    const imgPos = magImgRef.current; // always fresh from ref
    const snapped = magSnapPt(imgPos.x, imgPos.y);

    if (snapped.closing) {
      if (scale) setStep('name'); else setStep('calibrate');
    } else {
      setPoints(prev => [...prev, { x: imgPos.x, y: imgPos.y }]);
    }

    setMag(prev => ({ ...prev, visible: false }));
  }, [magSnapPt, scale]);

  // ─── Calibrate ────────────────────────────────────────────────────

  const handleCalibrate = useCallback((sideIdx: number, cm: number) => {
    if (points.length < 2) return;
    const p1 = points[sideIdx];
    const p2 = points[(sideIdx + 1) % points.length];
    const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const newScale = pxDist / cm;
    setScale(newScale);
    setStep('name');
  }, [points]);

  // ─── Confirm room name → add to tracedRooms → continue ───────────

  const handleConfirmRoom = useCallback((name: string) => {
    const newRoom: TracedRoom = {
      id: generateId(),
      points: [...points],
      name,
      closed: true,
    };
    setTracedRooms(prev => [...prev, newRoom]);
    setPoints([]);
    setStep('trace');
  }, [points]);

  // ─── Finish all → convert traced rooms to Room[] → send to calc ──

  const handleFinishAll = useCallback(() => {
    if (!scale || tracedRooms.length === 0) return;

    const rooms: Room[] = tracedRooms.map((tr, idx) => {
      const verts: Vertex[] = tr.points.map(p => ({
        x: p.x / scale / 100,
        y: p.y / scale / 100,
      }));
      const poly = calcPoly(verts);
      return {
        id: generateId(),
        name: tr.name,
        v: verts,
        aO: Math.round(poly.a * 100) / 100,
        pO: Math.round(poly.p * 100) / 100,
        canvas: { qty: Math.round(poly.a * 100) / 100 },
        mainProf: { qty: Math.round(poly.p * 100) / 100 },
        options: [],
      };
    });

    onFinishAll(rooms);
  }, [scale, tracedRooms, onFinishAll]);

  // ─── Undo ─────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    setPoints(prev => prev.slice(0, -1));
  }, []);

  // ─── Delete traced room ───────────────────────────────────────────

  const deleteTracedRoom = useCallback((id: string) => {
    setTracedRooms(prev => prev.filter(r => r.id !== id));
  }, []);

  // ─── Gestures ─────────────────────────────────────────────────────

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      runOnJS(handleTap)(e.absoluteX, e.absoluteY);
    });

  // Magnifier: long press + drag
  const magPanGesture = Gesture.Pan()
    .maxPointers(1)
    .activateAfterLongPress(300)
    .onStart((e) => {
      runOnJS(handleMagStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      runOnJS(handleMagMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(handleMagEnd)();
    });

  const setPinching = useCallback((v: boolean) => { isPinchingRef.current = v; if (v) setMag(m => ({ ...m, visible: false })); }, []);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => { savedZs.value = zs.value; runOnJS(setPinching)(true); })
    .onUpdate((e) => { zs.value = Math.max(0.5, Math.min(savedZs.value * e.scale, 10)); })
    .onEnd(() => { runOnJS(setPinching)(false); runOnJS(syncView)(); });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onStart(() => { savedTx.value = tx.value; savedTy.value = ty.value; })
    .onUpdate((e) => { tx.value = savedTx.value + e.translationX; ty.value = savedTy.value + e.translationY; })
    .onEnd(() => { runOnJS(syncView)(); });

  const gesture = Gesture.Race(
    magPanGesture,
    Gesture.Simultaneous(tapGesture, Gesture.Simultaneous(pinchGesture, panGesture))
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: zs.value }],
  }));

  // ─── Helpers ──────────────────────────────────────────────────────

  const imgToSvg = useCallback((ix: number, iy: number) => ({
    x: ix * fitScale,
    y: iy * fitScale,
  }), [fitScale]);

  const getSideCm = useCallback((pts: Array<{ x: number; y: number }>, i: number) => {
    if (!scale) return null;
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / scale);
  }, [scale]);

  // ─── Render: pick source ──────────────────────────────────────────

  if (step === 'pick') {
    return (
      <PickSourceStep
        onImage={handleImageSelected}
        onPdf={() => {}}
        onBack={onBack}
        insets={insets}
      />
    );
  }

  // ─── Render: calibration ──────────────────────────────────────────

  if (step === 'calibrate') {
    return (
      <CalibrationStep
        points={points}
        onCalibrate={handleCalibrate}
        insets={insets}
      />
    );
  }

  // ─── Render: name room ────────────────────────────────────────────

  if (step === 'name') {
    const verts: Vertex[] = scale
      ? points.map(p => ({ x: p.x / scale / 100, y: p.y / scale / 100 }))
      : [];
    const poly = verts.length >= 3 ? calcPoly(verts) : { a: 0, p: 0 };
    const defaultName = `Помещение ${existingCount + tracedRooms.length + 1}`;

    return (
      <NameRoomStep
        area={poly.a}
        perim={poly.p}
        pointCount={points.length}
        defaultName={defaultName}
        onConfirm={handleConfirmRoom}
        onBack={() => setStep('trace')}
        insets={insets}
      />
    );
  }

  // ─── Render: main tracing ─────────────────────────────────────────

  const imgW = imageSize.w * fitScale;
  const imgH = imageSize.h * fitScale;
  const inv = 1 / vZoom;

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
                {points.length > 0 ? `Точка ${ALPHA[points.length] ?? '?'}` : 'Обводка'}
              </Text>
              {points.length > 0 && (
                <Pressable onPress={undo} className="bg-red-50 px-2 py-1 rounded-lg">
                  <Text className="text-red-500 text-xs font-semibold">↩</Text>
                </Pressable>
              )}
            </View>
            <Text className="text-muted text-xs">
              {cornerStatus === 'detecting' ? '🔍' : cornerStatus === 'done' ? `🧲${detectedCorners.length}` : ''} · {tracedRooms.length} пом.
            </Text>
          </View>
        </View>

        {/* Canvas */}
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            // layout.y is relative to parent (the outer View with flex:1)
            // Header height = insets.top + 4 (padding) + ~36 (content)
            // But absoluteY in gestures is from screen top
            // So canvasTop = header height
            canvasTopRef.current = insets.top + 44;
          }}
        >
          <GestureDetector gesture={gesture}>
            <Animated.View style={[{ flex: 1 }, animStyle]}>
              <Image
                source={{ uri: imageUri! }}
                style={{ width: imgW, height: imgH }}
                resizeMode="contain"
              />
              <Svg width={imgW} height={imgH} style={StyleSheet.absoluteFill}>
                {/* Previously traced rooms — each in unique color */}
                {tracedRooms.map((tr, ri) => {
                  const color = ROOM_COLORS[ri % ROOM_COLORS.length];
                  const svgPts = tr.points.map(p => imgToSvg(p.x, p.y));
                  return (
                    <G key={tr.id}>
                      <SvgPolygon
                        points={svgPts.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={`${color}18`}
                        stroke={color}
                        strokeWidth={1.5 * inv}
                      />
                      {/* Corner points with letters */}
                      {svgPts.map((s, i) => (
                        <G key={`trPt-${ri}-${i}`}>
                          <SvgCircle cx={s.x} cy={s.y} r={4 * inv} fill={color} stroke="white" strokeWidth={1 * inv} />
                          <SvgText x={s.x} y={s.y - 7 * inv} textAnchor="middle"
                            fill={color} fontSize={8 * inv} fontWeight="700">{ALPHA[i]}</SvgText>
                        </G>
                      ))}
                      {/* Side lengths */}
                      {tr.points.map((p, i) => {
                        const cm = getSideCm(tr.points, i);
                        if (!cm) return null;
                        const s1 = imgToSvg(p.x, p.y);
                        const p2 = tr.points[(i + 1) % tr.points.length];
                        const s2 = imgToSvg(p2.x, p2.y);
                        return (
                          <SvgText key={`trLen-${ri}-${i}`} x={(s1.x + s2.x) / 2} y={(s1.y + s2.y) / 2 - 5 * inv}
                            textAnchor="middle" fill={color} fontSize={8 * inv} fontWeight="600">{cm}</SvgText>
                        );
                      })}
                      {/* Room name label */}
                      <SvgText
                        x={svgPts.reduce((s, p) => s + p.x, 0) / svgPts.length}
                        y={svgPts.reduce((s, p) => s + p.y, 0) / svgPts.length}
                        textAnchor="middle" fill={color} fontSize={11 * inv} fontWeight="800"
                      >{tr.name}</SvgText>
                    </G>
                  );
                })}

                {/* Current polygon fill */}
                {points.length >= 3 && (
                  <SvgPolygon
                    points={points.map(p => { const s = imgToSvg(p.x, p.y); return `${s.x},${s.y}`; }).join(' ')}
                    fill="rgba(79,70,229,0.08)" stroke="none"
                  />
                )}

                {/* Lines */}
                {points.map((p, i) => {
                  if (i === 0) return null;
                  const s1 = imgToSvg(points[i - 1].x, points[i - 1].y);
                  const s2 = imgToSvg(p.x, p.y);
                  return <Line key={`l-${i}`} x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke="#4F46E5" strokeWidth={2 * inv} />;
                })}

                {/* Side lengths for current */}
                {scale && points.map((p, i) => {
                  if (i >= points.length - 1) return null;
                  const cm = getSideCm(points, i);
                  if (!cm) return null;
                  const s1 = imgToSvg(p.x, p.y);
                  const p2 = points[i + 1];
                  const s2 = imgToSvg(p2.x, p2.y);
                  return (
                    <SvgText key={`cl-${i}`} x={(s1.x + s2.x) / 2} y={(s1.y + s2.y) / 2 - 5 * inv}
                      textAnchor="middle" fill="#4F46E5" fontSize={8 * inv} fontWeight="600">{cm}</SvgText>
                  );
                })}

                {/* Points with letters */}
                {points.map((p, i) => {
                  const s = imgToSvg(p.x, p.y);
                  return (
                    <G key={`p-${i}`}>
                      <SvgCircle cx={s.x} cy={s.y} r={6 * inv}
                        fill={i === 0 ? '#16a34a' : '#4F46E5'} stroke="white" strokeWidth={1.5 * inv} />
                      <SvgText x={s.x} y={s.y - 10 * inv} textAnchor="middle"
                        fill="#4F46E5" fontSize={10 * inv} fontWeight="800">{ALPHA[i]}</SvgText>
                    </G>
                  );
                })}
              </Svg>
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Magnifier overlay */}
        {mag.visible && imageUri && (() => {
          const magSize = 120;
          const headerH = insets.top + 44;
          const screenH = SCREEN.height;
          // Show below finger if near top, above if near bottom
          const showBelow = mag.screenY < screenH * 0.4;
          const magTop = showBelow ? mag.screenY + 40 : mag.screenY - magSize - 20;
          // Clamp to screen bounds
          const clampedTop = Math.max(headerH + 10, Math.min(magTop, screenH - magSize - 80));
          const clampedLeft = Math.max(10, Math.min(mag.screenX - magSize / 2, SCREEN.width - magSize - 10));
          return (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: clampedLeft,
              top: clampedTop,
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 3,
              borderColor: '#4F46E5',
              overflow: 'hidden',
              backgroundColor: '#fff',
            }}
          >
            {(() => {
              // Magnify 2.5x relative to current zoom level (read from shared value)
              const magScale = fitScale * zs.value * 2.5;
              return (
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: imageSize.w * magScale,
                    height: imageSize.h * magScale,
                    marginLeft: -(mag.imgX * magScale - 60),
                    marginTop: -(mag.imgY * magScale - 60),
                  }}
                  resizeMode="contain"
                />
              );
            })()}
            {/* Crosshair */}
            <View style={{ position: 'absolute', left: 58, top: 0, width: 2, height: 120, backgroundColor: 'rgba(79,70,229,0.3)' }} />
            <View style={{ position: 'absolute', left: 0, top: 58, width: 120, height: 2, backgroundColor: 'rgba(79,70,229,0.3)' }} />
            <View style={{ position: 'absolute', left: 55, top: 55, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#4F46E5' }} />
          </View>
          );
        })()}

        {/* Bottom panel */}
        <View className="bg-white/95 border-t border-border px-4 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
          {/* Traced rooms list */}
          {tracedRooms.length > 0 && (
            <View className="flex-row gap-2 mb-2 flex-wrap">
              {tracedRooms.map(tr => (
                <View key={tr.id} className="bg-green-50 border border-green-200 px-2 py-1 rounded-lg flex-row items-center gap-1">
                  <Text className="text-green-700 text-xs font-semibold">{tr.name}</Text>
                  <Pressable onPress={() => deleteTracedRoom(tr.id)}>
                    <Text className="text-red-400 text-xs">✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View className="flex-row items-center justify-between">
            <Text className="text-muted text-xs">
              Тап = точка · Зажми = лупа · 2 пальца = двигать
            </Text>
            <View className="flex-row gap-2">
              {points.length >= 3 && (
                <Pressable
                  onPress={() => { if (scale) setStep('name'); else setStep('calibrate'); }}
                  className="bg-green-500 px-3 py-2 rounded-xl"
                >
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
    </GestureHandlerRootView>
  );
}
