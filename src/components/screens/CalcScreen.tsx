import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polygon as SvgPolygon, Line, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';
import { useApp, useOrder } from '../../store/AppContext';
import { AppHeader, Button, Card, SectionHeader, Divider, EmptyState, Touchable, HeroCard, COLORS, SERIF } from '../ui';
import { ChevronLeft, RefreshCw, PenLine, Compass, Hand } from 'lucide-react-native';
import { calcPoly, countAngles, fmt } from '../../utils/geometry';
import { generateId } from '../../utils/storage';
import type { Room, Vertex } from '../../types';
import CompassBuilder from '../builders/CompassBuilder';
import TraceBuilder, { type TraceSession } from '../builders/TraceBuilder';
import PlanEditor from '../builders/PlanEditor';
import CalcBlockView from '../calc/CalcBlockView';
import RoomOptionsBlock from '../calc/RoomOptionsBlock';
import EstimatePreview from '../calc/EstimatePreview';
import { InnerCornerIcon, OuterCornerIcon } from '../ui/CornerIcons';
import { createDefaultBlocks, calcBlockTotal, setMergedNoms, type CalcBlock, type Preset } from '../../data/calcBlocks';
import { useNomenclature } from '../../hooks/useNomenclature';
import { nextRoomName } from '../../utils/roomName';
import { useResponsive } from '../../hooks/useResponsive';

// ─── Constants ────────────────────────────────────────────────────────

const ACC = '#0A84FF';
const DARK = '#F2F4FA';

// ─── Room Mini Preview ────────────────────────────────────────────────

function RoomMini({ verts, size = 80 }: { verts: Vertex[]; size?: number }) {
  if (!verts || verts.length < 2) {
    return (
      <View
        style={{ width: size, height: size }}
        className="bg-bg rounded-xl items-center justify-center border border-border"
      >
        <Text className="text-muted text-xs">—</Text>
      </View>
    );
  }

  const pad = 8;
  const xs = verts.map(v => v.x);
  const ys = verts.map(v => v.y);
  const mnx = Math.min(...xs), mny = Math.min(...ys);
  const mxx = Math.max(...xs), mxy = Math.max(...ys);
  const rw = Math.max(mxx - mnx, 0.1);
  const rh = Math.max(mxy - mny, 0.1);
  const sc = Math.min((size - 2 * pad) / rw, (size - 2 * pad) / rh);
  const ox = pad + (size - 2 * pad - rw * sc) / 2;
  const oy = pad + (size - 2 * pad - rh * sc) / 2;
  const pts = verts
    .map(v => `${ox + (v.x - mnx) * sc},${oy + (v.y - mny) * sc}`)
    .join(' ');

  return (
    <Svg width={size} height={size} style={{ borderRadius: 10, backgroundColor: COLORS.glass }}>
      <SvgPolygon points={pts} fill="rgba(10,132,255,0.10)" stroke={ACC} strokeWidth={1.5} />
    </Svg>
  );
}


// ─── Calc Screen ──────────────────────────────────────────────────────

interface CalcScreenProps {
  orderId: string;
}

export default function CalcScreen({ orderId }: CalcScreenProps) {
  const { state, dispatch, updateOrderRooms, updateSnapshot } = useApp();
  const order = useOrder(orderId);
  const router = useRouter();
  const { mergedNoms } = useNomenclature();

  // Sync merged noms to calcBlocks so getNom/getNomPrice use user-edited data
  useEffect(() => { setMergedNoms(mergedNoms); }, [mergedNoms]);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    order?.rooms?.[0]?.id ?? null
  );
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTracer, setShowTracer] = useState(false);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [editingPlanRoomId, setEditingPlanRoomId] = useState<string | null>(null);
  const [traceSession, setTraceSession] = useState<TraceSession | null>(null);
  // Initialise from order.calcState (если есть сохранённое состояние)
  const savedCalcState = order?.calcState;
  const [blocks, setBlocks] = useState<CalcBlock[]>(
    () => (savedCalcState?.blocks as CalcBlock[]) ?? createDefaultBlocks()
  );
  const [mainQtysAll, setMainQtysAll] = useState<Record<string, Record<string, number>>>(
    () => savedCalcState?.mainQtysAll ?? {}
  );
  const [optQtysAll, setOptQtysAll] = useState<Record<string, Record<string, number>>>(
    () => savedCalcState?.optQtysAll ?? {}
  );
  // Per-room preset overrides for blocks marked perRoomPreset (Полотно, Основной профиль)
  // perRoomPresets[roomId][blockId] = presetId
  const [perRoomPresets, setPerRoomPresets] = useState<Record<string, Record<string, string>>>(
    () => savedCalcState?.perRoomPresets ?? {}
  );
  // «Вычесть от основного профиля» — для доп. блоков с canSubtractFromMain
  const [subtractFromMain, setSubtractFromMain] = useState<Record<string, boolean>>(
    () => savedCalcState?.subtractFromMain ?? {}
  );

  const [showEstimate, setShowEstimate] = useState(false);
  const [estimateRoomId, setEstimateRoomId] = useState<string | null>(null);

  // Room options (protection, etc) — mini-block ABOVE canvas
  const [roomOptIds, setRoomOptIds] = useState<string[]>(
    () => savedCalcState?.roomOptIds ?? ['w_prot', 'w_floor']
  );
  // roomOptEnabled is per-room: Record<roomId, Record<nomId, boolean>>.
  // Migrate legacy flat shape (Record<nomId, boolean>) by copying to each existing room.
  const [roomOptEnabled, setRoomOptEnabled] = useState<Record<string, Record<string, boolean>>>(
    () => {
      const saved = savedCalcState?.roomOptEnabled ?? {};
      const values = Object.values(saved);
      const isNested = values.some(v => typeof v === 'object' && v !== null);
      if (isNested) return saved as unknown as Record<string, Record<string, boolean>>;
      // Legacy migration: apply flat state to every existing room
      const flat = saved as Record<string, boolean>;
      const next: Record<string, Record<string, boolean>> = {};
      const roomIds = order?.rooms.map(r => r.id) ?? [];
      for (const rid of roomIds) next[rid] = { ...flat };
      return next;
    }
  );
  const [roomOptBindings, setRoomOptBindings] = useState<Record<string, 'area' | 'perimeter'>>(
    () => savedCalcState?.roomOptBindings ?? { w_prot: 'perimeter', w_floor: 'area' }
  );

  // Sync activeRoomId when order loads from AsyncStorage
  useEffect(() => {
    if (order && activeRoomId == null && order.rooms.length > 0) {
      setActiveRoomId(order.rooms[0].id);
    }
  }, [order, activeRoomId]);

  // Будем держать ссылку на projectTotal-snapshot, чтобы не отправлять одно и то же
  const lastSnapshotTotalRef = useRef<number | null>(null);

  // ВАЖНО: все хуки должны вызываться до любых early-return,
  // иначе React уронит компонент с "Rendered fewer hooks than expected".
  const insets = useSafeAreaInsets();
  const { isLandscape } = useResponsive();

  if (!order) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Text className="text-muted">Проект не найден</Text>
      </View>
    );
  }

  const rooms = order.rooms;
  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? rooms[0];

  // Area/perimeter for active room
  const roomArea = activeRoom?.aO ?? (activeRoom ? calcPoly(activeRoom.v).a : 0);
  const roomPerim = activeRoom?.pO ?? (activeRoom ? calcPoly(activeRoom.v).p : 0);

  // Options total helper — per-room enabled
  const calcOptsTotalFor = (roomId: string | null, a: number, p: number) => {
    const enabled = roomId ? (roomOptEnabled[roomId] ?? {}) : {};
    return roomOptIds.reduce((sum, id) => {
      if (!enabled[id]) return sum;
      const nom = mergedNoms.find(n => n.id === id);
      if (!nom) return sum;
      const binding = roomOptBindings[id] || (nom.bindTo === 'area' ? 'area' : 'perimeter');
      const qty = binding === 'area' ? a : p;
      return sum + qty * nom.price;
    }, 0);
  };

  // qtys для активной комнаты
  const mainQtys = activeRoomId ? (mainQtysAll[activeRoomId] ?? {}) : {};
  const optQtys = activeRoomId ? (optQtysAll[activeRoomId] ?? {}) : {};

  // Helper: qty доп. блоков для конкретной комнаты + сумма для вычитания
  const subtractTotalFor = (roomId: string | null) => {
    const m = roomId ? (mainQtysAll[roomId] ?? {}) : {};
    return blocks.reduce((sum, b) => {
      if (!b.canSubtractFromMain || !subtractFromMain[b.id]) return sum;
      return sum + (m[b.id] ?? 0);
    }, 0);
  };

  // Effective qty основного профиля для конкретной комнаты
  const mainProfileQtyFor = (roomId: string | null, perimeter: number) => {
    const m = roomId ? (mainQtysAll[roomId] ?? {}) : {};
    if (m['main_profile'] != null) return m['main_profile'];
    return Math.max(0, perimeter - subtractTotalFor(roomId));
  };

  // Block total honoring per-room preset override + subtract from main + per-room qtys
  const blockTotalForRoom = (b: CalcBlock, roomId: string | null, a: number, p: number) => {
    const presetId = b.perRoomPreset && roomId
      ? (perRoomPresets[roomId]?.[b.id] ?? b.activePresetId)
      : b.activePresetId;
    const blockWithPreset = presetId !== b.activePresetId ? { ...b, activePresetId: presetId } : b;
    const roomMain = roomId ? (mainQtysAll[roomId] ?? {}) : {};
    const roomOpt = roomId ? (optQtysAll[roomId] ?? {}) : {};
    const overrideQty = b.id === 'main_profile'
      ? mainProfileQtyFor(roomId, p)
      : roomMain[b.id];
    return calcBlockTotal(blockWithPreset, a, p, overrideQty, roomOpt);
  };

  // Total for current (active) room
  const grand = blocks.reduce((sum, block) =>
    sum + blockTotalForRoom(block, activeRoomId, roomArea, roomPerim), 0
  ) + calcOptsTotalFor(activeRoomId, roomArea, roomPerim);

  // Total across all project rooms
  const projectTotal = rooms.reduce((sum, room) => {
    const a = room.aO ?? calcPoly(room.v).a;
    const p = room.pO ?? calcPoly(room.v).p;
    const blocksTotal = blocks.reduce((bs, b) =>
      bs + blockTotalForRoom(b, room.id, a, p), 0);
    return sum + blocksTotal + calcOptsTotalFor(room.id, a, p);
  }, 0);

  // Sync calcSnapshot + полный calcState в order — debounced
  useEffect(() => {
    if (!order) return;
    const timer = setTimeout(() => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      dispatch({
        type: 'UPDATE_ORDER',
        id: order.id,
        patch: {
          calcSnapshot: {
            total: projectTotal,
            materialsTotal: 0,
            worksTotal: 0,
            updatedAt: `${dd}.${mm}.${yyyy}`,
          },
          calcState: {
            blocks,
            mainQtysAll,
            optQtysAll,
            perRoomPresets,
            subtractFromMain,
            roomOptIds,
            roomOptEnabled,
            roomOptBindings,
          },
        },
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [
    projectTotal,
    blocks, mainQtysAll, optQtysAll, perRoomPresets, subtractFromMain,
    roomOptIds, roomOptEnabled, roomOptBindings,
    order?.id, dispatch,
  ]);

  // Block handlers
  const handleToggleExpanded = useCallback((blockId: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, expanded: !b.expanded } : b));
  }, []);

  const handleSelectPreset = useCallback((blockId: string, presetId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (block?.perRoomPreset && activeRoomId) {
      // Per-room override
      setPerRoomPresets(prev => ({
        ...prev,
        [activeRoomId]: { ...(prev[activeRoomId] ?? {}), [blockId]: presetId },
      }));
    } else {
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, activePresetId: presetId } : b));
    }
  }, [blocks, activeRoomId]);

  // Toggle "synced to project" checkbox for current room
  // ON  → удалить override этой комнаты (вернуться к глобальному) И применить current preset как global
  //       (так пресет, выбранный в этой комнате, становится «глобальным» и применяется ко всем,
  //        у которых стоит галочка / нет override)
  // OFF → записать override = текущий effective preset (отвязать от global)
  const handleToggleSync = useCallback((blockId: string, next: boolean) => {
    if (!activeRoomId) return;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const currentEffective = perRoomPresets[activeRoomId]?.[blockId] ?? block.activePresetId;

    if (next) {
      // Поставили галочку: текущий пресет становится глобальным; убираем override этой комнаты
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, activePresetId: currentEffective } : b));
      setPerRoomPresets(prev => {
        const roomOvs = { ...(prev[activeRoomId] ?? {}) };
        delete roomOvs[blockId];
        const next: Record<string, Record<string, string>> = { ...prev };
        if (Object.keys(roomOvs).length > 0) next[activeRoomId] = roomOvs;
        else delete next[activeRoomId];
        return next;
      });
    } else {
      // Сняли галочку: фиксируем текущий пресет как override для этой комнаты
      setPerRoomPresets(prev => ({
        ...prev,
        [activeRoomId]: { ...(prev[activeRoomId] ?? {}), [blockId]: currentEffective },
      }));
    }
  }, [blocks, activeRoomId, perRoomPresets]);

  // Get effective preset id for a block in given room (override or block default)
  const getEffectivePresetId = useCallback((block: CalcBlock, roomId: string | null): string => {
    if (block.perRoomPreset && roomId) {
      return perRoomPresets[roomId]?.[block.id] ?? block.activePresetId;
    }
    return block.activePresetId;
  }, [perRoomPresets]);

  const handleUpdatePresets = useCallback((blockId: string, presets: Preset[]) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const stillValid = presets.some(p => p.id === b.activePresetId);
      const activePresetId = stillValid ? b.activePresetId : (presets[0]?.id ?? '');
      return { ...b, presets, activePresetId };
    }));
  }, []);

  // Clone a block (create duplicate with different id)
  const handleDuplicateBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId);
      if (idx < 0) return prev;
      const src = prev[idx];
      // Generate unique id
      const baseId = src.id.replace(/_copy\d*$/, '');
      let n = 1;
      while (prev.some(b => b.id === `${baseId}_copy${n}`)) n++;
      const clone: CalcBlock = {
        ...src,
        id: `${baseId}_copy${n}`,
        title: `${src.title.replace(/\s+\(\d+\)$/, '')} (${n + 1})`,
        // Deep clone presets
        presets: src.presets.map(p => ({
          ...p,
          items: p.items.map(r => ({ ...r })),
          options: p.options.map(r => ({ ...r })),
        })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }, []);

  // Delete a cloned block
  const handleDeleteBlock = useCallback((blockId: string) => {
    Alert.alert('Удалить блок', 'Убрать эту копию блока?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: () => setBlocks(prev => prev.filter(b => b.id !== blockId)),
      },
    ]);
  }, []);

  const handleToggleNom = useCallback((blockId: string, side: 'items' | 'options', nomId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const activeId = b.perRoomPreset && activeRoomId
        ? (perRoomPresets[activeRoomId]?.[b.id] ?? b.activePresetId)
        : b.activePresetId;
      return {
        ...b,
        presets: b.presets.map(p => {
          if (p.id !== activeId) return p;
          return {
            ...p,
            [side]: p[side].map((r: any) => r.nomId === nomId ? { ...r, enabled: !r.enabled } : r),
          };
        }),
      };
    }));
  }, [activeRoomId, perRoomPresets]);

  const handleAddRoom = (room: Room) => {
    const updated = [...rooms, room];
    updateOrderRooms(order.id, updated);
    setActiveRoomId(room.id);
    setShowBuilder(false);
    setShowTracer(false);
  };

  const handleDeleteRoom = (roomId: string) => {
    Alert.alert('Удалить помещение?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          const updated = rooms.filter(r => r.id !== roomId);
          updateOrderRooms(order.id, updated);
          if (activeRoomId === roomId) {
            setActiveRoomId(updated[0]?.id ?? null);
          }
        },
      },
    ]);
  };

  // Обновить цены: сохранить структуру блоков/пресетов, но сбросить priceOverride
  // на каждой ссылке — getNomPrice вернёт актуальную цену из mergedNoms.
  const handleRefreshPrices = () => {
    Alert.alert(
      'Обновить цены',
      'Цены номенклатуры будут обновлены до актуальных. Структура пресетов и количества сохранятся.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Обновить',
          onPress: () => {
            setBlocks(prev => prev.map(b => ({
              ...b,
              presets: b.presets.map(p => ({
                ...p,
                items: p.items.map(r => ({ ...r, priceOverride: undefined })),
                options: p.options.map(r => ({ ...r, priceOverride: undefined })),
              })),
            })));
          },
        },
      ]
    );
  };

  // Trace builder
  if (showTracer) {
    return (
      <TraceBuilder
        existingNames={rooms.map(r => r.name)}
        onFinishAll={(newRooms) => {
          // Dedupe: replace rooms with same id, append truly new ones
          const newIds = new Set(newRooms.map(r => r.id));
          const kept = rooms.filter(r => !newIds.has(r.id));
          const updated = [...kept, ...newRooms];
          updateOrderRooms(order.id, updated);
          if (newRooms.length > 0) setActiveRoomId(newRooms[0].id);
          setShowTracer(false);
        }}
        onBack={() => setShowTracer(false)}
        session={traceSession}
        onSessionChange={setTraceSession}
      />
    );
  }

  // Compass builder
  if (showBuilder) {
    return (
      <CompassBuilder
        existingNames={rooms.map(r => r.name)}
        onFinish={handleAddRoom}
        onBack={() => setShowBuilder(false)}
      />
    );
  }

  // Plan editor (manual polygon editor)
  if (showPlanEditor) {
    const existing = editingPlanRoomId ? rooms.find(r => r.id === editingPlanRoomId) : null;
    return (
      <PlanEditor
        initialVerts={existing?.v}
        initialName={existing?.name || nextRoomName(rooms.map(r => r.name))}
        onFinish={(verts, name) => {
          const poly = calcPoly(verts);
          if (editingPlanRoomId && existing) {
            // Update existing room
            const updated = rooms.map(r => r.id === editingPlanRoomId ? {
              ...r,
              name,
              v: verts,
              aO: Math.round(poly.a * 100) / 100,
              pO: Math.round(poly.p * 100) / 100,
            } : r);
            updateOrderRooms(order.id, updated);
          } else {
            // New room
            const newRoom: Room = {
              id: generateId(),
              name,
              v: verts,
              aO: Math.round(poly.a * 100) / 100,
              pO: Math.round(poly.p * 100) / 100,
              canvas: { qty: Math.round(poly.a * 100) / 100 },
              mainProf: { qty: Math.round(poly.p * 100) / 100 },
              options: [],
            };
            const updated = [...rooms, newRoom];
            updateOrderRooms(order.id, updated);
            setActiveRoomId(newRoom.id);
          }
          setShowPlanEditor(false);
          setEditingPlanRoomId(null);
        }}
        onCancel={() => { setShowPlanEditor(false); setEditingPlanRoomId(null); }}
      />
    );
  }

  const builderModes: Array<{ key: string; label: string; icon: React.ComponentType<any>; onPress: () => void; show: boolean }> = [
    { key: 'trace', label: 'Обводка', icon: PenLine, onPress: () => { setTraceSession(null); setShowTracer(true); }, show: true },
    { key: 'edit',  label: 'Редакт.', icon: PenLine, onPress: () => setShowTracer(true), show: !!traceSession },
    { key: 'meas',  label: 'Замер',   icon: Compass, onPress: () => setShowBuilder(true), show: true },
    { key: 'manual',label: 'Ручной',  icon: Hand,    onPress: () => { setEditingPlanRoomId(null); setShowPlanEditor(true); }, show: true },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header — editorial */}
      <View style={{
        backgroundColor: COLORS.bg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      }}>
        {/* Row 1: back + brand + total */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 8, gap: 12 }}>
          <Touchable
            haptic="light"
            onPress={() => router.back()}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: COLORS.surface2,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={20} color={COLORS.ink} strokeWidth={2} />
          </Touchable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, color: COLORS.subtle }}>
              ОБЪЕКТ
            </Text>
            <Text style={{ fontFamily: SERIF, fontSize: 19, fontWeight: '700', color: COLORS.ink, lineHeight: 22 }} numberOfLines={1}>
              {order.name}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, color: COLORS.subtle }}>
              ПРОЕКТ
            </Text>
            <Text style={{ fontFamily: SERIF, fontSize: 22, fontWeight: '700', color: COLORS.ink, lineHeight: 26 }}>
              {fmt(projectTotal)}<Text style={{ fontSize: 14, color: COLORS.muted }}> ₽</Text>
            </Text>
            <Touchable haptic="light" onPress={handleRefreshPrices} style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={10} color={COLORS.accent} strokeWidth={2.2} />
              <Text style={{ fontSize: 10, color: COLORS.accent, fontWeight: '600' }}>обновить цены</Text>
            </Touchable>
          </View>
        </View>

        {/* Row 2: mode pills — unified, with lucide icons */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {builderModes.filter(m => m.show).map(m => {
                const Icon = m.icon;
                return (
                  <Touchable
                    key={m.key}
                    haptic="selection"
                    scale={0.96}
                    onPress={m.onPress}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: COLORS.card,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Icon size={13} color={COLORS.ink} strokeWidth={1.8} />
                    <Text style={{ fontSize: 12, color: COLORS.ink, fontWeight: '600', letterSpacing: 0.2 }}>
                      {m.label}
                    </Text>
                  </Touchable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Terracotta hairline (signature) */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5, backgroundColor: COLORS.accent }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Room tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: COLORS.bg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
        >
          {rooms.map(rm => {
            const active = rm.id === activeRoomId;
            return (
              <Touchable
                key={rm.id}
                haptic="selection"
                scale={0.97}
                onPress={() => setActiveRoomId(rm.id)}
                onLongPress={() => handleDeleteRoom(rm.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 12,
                  backgroundColor: active ? COLORS.accent : COLORS.glass,
                  borderWidth: 1,
                  borderColor: active ? COLORS.accent : COLORS.glassEdge,
                  minWidth: 64,
                  shadowColor: active ? COLORS.accent : undefined,
                  shadowOpacity: active ? 0.4 : 0,
                  shadowRadius: 12,
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '700',
                  color: active ? '#FFFFFF' : COLORS.ink,
                }}>
                  {rm.name}
                </Text>
                {rm.aO != null && (
                  <Text style={{
                    fontSize: 10, marginTop: 2, fontWeight: '500',
                    color: active ? 'rgba(255,255,255,0.7)' : COLORS.muted,
                  }}>
                    {fmt(rm.aO)} м²
                  </Text>
                )}
              </Touchable>
            );
          })}
          <Touchable
            haptic="light"
            scale={0.97}
            onPress={() => setShowBuilder(true)}
            style={{
              paddingHorizontal: 14, paddingVertical: 9,
              borderRadius: 12,
              borderWidth: 1, borderStyle: 'dashed',
              borderColor: COLORS.borderStrong,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '600' }}>+ Помещение</Text>
          </Touchable>
        </ScrollView>

        <View className="p-3 gap-3">
          {/* Room mini plan */}
          {activeRoom ? (
            <Card className="p-3">
              <View className="flex-row gap-3 items-start">
                <Pressable onPress={() => { setEditingPlanRoomId(activeRoom.id); setShowPlanEditor(true); }}>
                  <RoomMini verts={activeRoom.v} size={90} />
                  <Text style={{ color: COLORS.accent, fontSize: 10, textAlign: 'center', marginTop: 4, fontWeight: '600', letterSpacing: 0.3 }}>
                    Редактор
                  </Text>
                </Pressable>
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink mb-1">
                    {activeRoom.name}
                  </Text>
                  <View className="gap-1">
                    {(() => {
                      const rp = (activeRoom.aO == null || activeRoom.pO == null) ? calcPoly(activeRoom.v) : null;
                      const area = activeRoom.aO ?? rp!.a;
                      const perim = activeRoom.pO ?? rp!.p;
                      const angles = countAngles(activeRoom.v);
                      return (
                        <>
                          <View className="flex-row gap-2">
                            <Text className="text-muted text-xs">Площадь:</Text>
                            <Text className="text-accent text-xs font-bold">{fmt(area)} м²</Text>
                          </View>
                          <View className="flex-row gap-2">
                            <Text className="text-muted text-xs">Периметр:</Text>
                            <Text className="text-ink text-xs font-semibold">{fmt(perim)} м.п.</Text>
                          </View>
                          <View className="flex-row gap-3 mt-0.5">
                            <View className="flex-row gap-1 items-center">
                              <InnerCornerIcon size={14} />
                              <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '700' }}>{angles.inner}</Text>
                            </View>
                            <View className="flex-row gap-1 items-center">
                              <OuterCornerIcon size={14} />
                              <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '700' }}>{angles.outer}</Text>
                            </View>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                </View>
              </View>
            </Card>
          ) : (
            <EmptyState
              icon="📐"
              title="Нет помещений"
              desc="Добавьте помещение с помощью компаса, обводки или вручную"
              action={
                <View style={{ gap: 8 }}>
                  <Button label="🧭 Компас" onPress={() => setShowBuilder(true)} />
                  <Button label="✏️ Обводка" onPress={() => setShowTracer(true)} variant="secondary" />
                  <Button label="📐 Вручную (редактор чертежа)" onPress={() => { setEditingPlanRoomId(null); setShowPlanEditor(true); }} variant="ghost" />
                </View>
              }
            />
          )}

          {/* Room Options above Canvas — per-room state */}
          {rooms.length > 0 && activeRoomId && (
            <RoomOptionsBlock
              area={roomArea}
              perimeter={roomPerim}
              optionIds={roomOptIds}
              enabled={roomOptEnabled[activeRoomId] ?? {}}
              bindings={roomOptBindings}
              onToggle={(id) => setRoomOptEnabled(prev => {
                const current = prev[activeRoomId] ?? {};
                return {
                  ...prev,
                  [activeRoomId]: { ...current, [id]: !current[id] },
                };
              })}
              onUpdateOptions={(ids, bnds) => { setRoomOptIds(ids); setRoomOptBindings(bnds); }}
            />
          )}

          {/* Calculator blocks — в landscape 2 колонки */}
          <View style={isLandscape ? { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } : undefined}>
          {rooms.length > 0 && blocks.map(block => {
            const isClone = block.id.includes('_copy');
            const hasOverride = !!(block.perRoomPreset && activeRoomId && perRoomPresets[activeRoomId]?.[block.id]);
            const effectivePresetId = getEffectivePresetId(block, activeRoomId);
            const effectiveBlock = effectivePresetId !== block.activePresetId
              ? { ...block, activePresetId: effectivePresetId }
              : block;
            // For main_profile — show effective qty (perimeter minus subtractTotal) when no manual override
            const mainQtyShown = block.id === 'main_profile'
              ? mainProfileQtyFor(activeRoomId, roomPerim)
              : mainQtys[block.id];
            return (
              <View key={block.id} style={isLandscape ? { width: '49%' } : undefined}>
                <CalcBlockView
                  block={effectiveBlock}
                  area={roomArea}
                  perimeter={roomPerim}
                  mainQty={mainQtyShown}
                  optQtys={optQtys}
                  onToggleExpanded={() => handleToggleExpanded(block.id)}
                  onSelectPreset={presetId => handleSelectPreset(block.id, presetId)}
                  onUpdatePresets={presets => handleUpdatePresets(block.id, presets)}
                  onToggleNom={(side, nomId) => handleToggleNom(block.id, side, nomId)}
                  onChangeMainQty={qty => activeRoomId && setMainQtysAll(prev => ({
                    ...prev,
                    [activeRoomId]: { ...(prev[activeRoomId] ?? {}), [block.id]: qty },
                  }))}
                  onChangeOptQty={(nomId, qty) => activeRoomId && setOptQtysAll(prev => ({
                    ...prev,
                    [activeRoomId]: { ...(prev[activeRoomId] ?? {}), [nomId]: qty },
                  }))}
                  isSyncedToProject={block.perRoomPreset ? !hasOverride : undefined}
                  onToggleSyncToProject={block.perRoomPreset ? (next) => handleToggleSync(block.id, next) : undefined}
                  isSubtractFromMain={block.canSubtractFromMain ? !!subtractFromMain[block.id] : undefined}
                  onToggleSubtractFromMain={block.canSubtractFromMain
                    ? (next) => setSubtractFromMain(prev => ({ ...prev, [block.id]: next }))
                    : undefined}
                  onDuplicate={() => handleDuplicateBlock(block.id)}
                  onDelete={isClone ? () => handleDeleteBlock(block.id) : undefined}
                />
              </View>
            );
          })}
          </View>

          {/* Room total — tap → estimate for this room only */}
          {activeRoom && (
            <Touchable
              haptic="medium"
              scale={0.98}
              onPress={() => { setEstimateRoomId(activeRoom.id); setShowEstimate(true); }}
            >
              <HeroCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: COLORS.subtle, fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>
                      СМЕТА ПОМЕЩЕНИЯ →
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '700', marginTop: 4, letterSpacing: -0.3 }} numberOfLines={1}>
                      {activeRoom.name}
                    </Text>
                  </View>
                  <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 }}>
                    {fmt(grand)}<Text style={{ fontSize: 16, color: COLORS.muted, fontWeight: '600' }}> ₽</Text>
                  </Text>
                </View>
              </HeroCard>
            </Touchable>
          )}

          {/* Estimate preview button — full project */}
          {rooms.length > 0 && (
            <Touchable
              haptic="medium"
              onPress={() => { setEstimateRoomId(null); setShowEstimate(true); }}
              style={{
                backgroundColor: COLORS.accent,
                borderRadius: 999,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                shadowColor: COLORS.accent,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.4 }}>
                Смета по всему проекту →
              </Text>
            </Touchable>
          )}
        </View>

        <View className="h-16" />
      </ScrollView>

      <EstimatePreview
        visible={showEstimate}
        onClose={() => setShowEstimate(false)}
        orderName={order.name}
        rooms={estimateRoomId ? rooms.filter(r => r.id === estimateRoomId) : rooms}
        scope={estimateRoomId
          ? rooms.find(r => r.id === estimateRoomId)?.name ?? null
          : null}
        blocks={blocks}
        mainQtysAll={mainQtysAll}
        optQtysAll={optQtysAll}
        roomOptIds={roomOptIds}
        roomOptEnabled={roomOptEnabled}
        roomOptBindings={roomOptBindings}
        mergedNoms={mergedNoms}
        perRoomPresets={perRoomPresets}
        subtractFromMain={subtractFromMain}
      />
    </View>
  );
}
