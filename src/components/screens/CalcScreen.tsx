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
import { AppHeader, Button, Card, SectionHeader, Divider, EmptyState } from '../ui';
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

const ACC = '#4F46E5';
const DARK = '#1e2030';

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
    <Svg width={size} height={size} style={{ borderRadius: 10, backgroundColor: '#fff' }}>
      <SvgPolygon points={pts} fill="rgba(79,70,229,0.08)" stroke={ACC} strokeWidth={1.5} />
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
  const [roomOptEnabled, setRoomOptEnabled] = useState<Record<string, boolean>>(
    () => savedCalcState?.roomOptEnabled ?? {}
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

  // Options total helper — parameterised by area/perim so it works for any room
  const calcOptsTotalFor = (a: number, p: number) => {
    return roomOptIds.reduce((sum, id) => {
      if (!roomOptEnabled[id]) return sum;
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
  ) + calcOptsTotalFor(roomArea, roomPerim);

  // Total across all project rooms
  const projectTotal = rooms.reduce((sum, room) => {
    const a = room.aO ?? calcPoly(room.v).a;
    const p = room.pO ?? calcPoly(room.v).p;
    const blocksTotal = blocks.reduce((bs, b) =>
      bs + blockTotalForRoom(b, room.id, a, p), 0);
    return sum + blocksTotal + calcOptsTotalFor(a, p);
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
      return {
        ...b,
        presets: b.presets.map(p => {
          if (p.id !== b.activePresetId) return p;
          return {
            ...p,
            [side]: p[side].map((r: any) => r.nomId === nomId ? { ...r, enabled: !r.enabled } : r),
          };
        }),
      };
    }));
  }, []);

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

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="bg-white border-b border-border">
        <View className="flex-row items-center px-4 pb-2 gap-3" style={{ paddingTop: insets.top + 4 }}>
          {/* Back + logo */}
          <View className="flex-row items-center gap-2 flex-shrink-0">
            <Pressable
              onPress={() => router.back()}
              className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center"
            >
              <Text className="text-navy text-xl font-bold">‹</Text>
            </Pressable>
            <View className="w-9 h-9 rounded-[9px] bg-navy items-center justify-center">
              <View className="gap-[3px]">
                <View className="w-[14px] h-[2px] rounded-sm bg-accent" />
                <View className="w-[10px] h-[2px] rounded-sm bg-accent opacity-60" />
                <View className="w-[7px] h-[2px] rounded-sm bg-accent opacity-30" />
              </View>
            </View>
            <View>
              <Text className="text-[13px] font-bold tracking-widest text-navy">MAGIC</Text>
              <Text className="text-[9px] font-semibold tracking-[3px] text-accent -mt-0.5">КАЛЬКУЛЯТОР</Text>
            </View>
          </View>

          {/* Total + refresh */}
          <View className="flex-1 items-end">
            <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#9ca3af' }}>
              ПРОЕКТ
            </Text>
            <Text className="text-base font-black text-navy">{fmt(projectTotal)} ₽</Text>
            <Pressable onPress={handleRefreshPrices}>
              <Text className="text-[10px] text-accent">🔄 обновить цены</Text>
            </Pressable>
          </View>
        </View>

        {/* Order name + builder buttons */}
        <View className="flex-row items-center px-4 pb-2.5 gap-2">
          <View className="flex-1">
            <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#9ca3af' }}>
              ОБЪЕКТ
            </Text>
            <Text className="text-sm font-semibold text-navy" numberOfLines={1}>
              {order.name}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-shrink-0">
            <View className="flex-row gap-1.5">
              {[
                { label: 'Обводка', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.2)' },
                ...(traceSession ? [{ label: '✏️ Ред.', color: '#16a34a', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' }] : []),
                { label: 'Замер 🧭', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
                { label: 'Ручн.', color: '#888', bg: '#f2f3fa', border: '#eeeef8' },
              ].map(b => (
                <Pressable
                  key={b.label}
                  onPress={() => {
                    if (b.label === 'Обводка') {
                      setTraceSession(null);
                      setShowTracer(true);
                    } else if (b.label === '✏️ Ред.') {
                      setShowTracer(true);
                    } else if (b.label.includes('Замер')) {
                      setShowBuilder(true);
                    } else if (b.label === 'Ручн.') {
                      setEditingPlanRoomId(null);
                      setShowPlanEditor(true);
                    }
                  }}
                  style={{ backgroundColor: b.bg, borderColor: b.border, borderWidth: 0.5 }}
                  className="px-2.5 py-1.5 rounded-lg"
                >
                  <Text style={{ color: b.color }} className="text-[10px] font-semibold">
                    {b.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-accent" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Room tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="py-2 bg-white border-b border-border"
          contentContainerClassName="px-3 gap-2"
        >
          {rooms.map(rm => (
            <Pressable
              key={rm.id}
              onPress={() => setActiveRoomId(rm.id)}
              onLongPress={() => handleDeleteRoom(rm.id)}
              className={`px-3 py-2 rounded-xl border ${
                rm.id === activeRoomId
                  ? 'bg-navy border-navy'
                  : 'bg-white border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  rm.id === activeRoomId ? 'text-white' : 'text-muted'
                }`}
              >
                {rm.name}
              </Text>
              {rm.aO != null && (
                <Text
                  className={`text-[10px] mt-0.5 ${
                    rm.id === activeRoomId ? 'text-white/60' : 'text-muted'
                  }`}
                >
                  {fmt(rm.aO)} м²
                </Text>
              )}
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowBuilder(true)}
            className="px-3 py-2 rounded-xl border border-dashed border-border items-center justify-center"
          >
            <Text className="text-muted text-xs">+ Помещение</Text>
          </Pressable>
        </ScrollView>

        <View className="p-3 gap-3">
          {/* Room mini plan */}
          {activeRoom ? (
            <Card className="p-3">
              <View className="flex-row gap-3 items-start">
                <Pressable onPress={() => { setEditingPlanRoomId(activeRoom.id); setShowPlanEditor(true); }}>
                  <RoomMini verts={activeRoom.v} size={90} />
                  <Text style={{ color: '#4F46E5', fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: '600' }}>
                    ✏️ Редактор
                  </Text>
                </Pressable>
                <View className="flex-1">
                  <Text className="text-base font-bold text-navy mb-1">
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
                            <Text className="text-navy text-xs font-semibold">{fmt(perim)} м.п.</Text>
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

          {/* Room Options above Canvas */}
          {rooms.length > 0 && (
            <RoomOptionsBlock
              area={roomArea}
              perimeter={roomPerim}
              optionIds={roomOptIds}
              enabled={roomOptEnabled}
              bindings={roomOptBindings}
              onToggle={(id) => setRoomOptEnabled(prev => ({ ...prev, [id]: !prev[id] }))}
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
            <Pressable
              onPress={() => { setEstimateRoomId(activeRoom.id); setShowEstimate(true); }}
              className="bg-navy rounded-2xl p-4"
            >
              <View className="flex-row justify-between items-baseline">
                <View className="flex-1 mr-2">
                  <Text style={{ color: '#a5b4fc', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>
                    ПОМЕЩЕНИЕ  ›
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
                    {activeRoom.name}
                  </Text>
                  <Text style={{ color: '#a5b4fc', fontSize: 10, marginTop: 2 }}>
                    Тап — смета помещения
                  </Text>
                </View>
                <Text className="text-white text-xl font-black">{fmt(grand)} ₽</Text>
              </View>
            </Pressable>
          )}

          {/* Estimate preview button — full project */}
          {rooms.length > 0 && (
            <Pressable
              onPress={() => { setEstimateRoomId(null); setShowEstimate(true); }}
              className="bg-accent rounded-2xl p-4 flex-row items-center justify-center gap-2"
              style={{ elevation: 3 }}
            >
              <Text className="text-white text-base font-bold">📄 Смета по всему проекту</Text>
            </Pressable>
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
