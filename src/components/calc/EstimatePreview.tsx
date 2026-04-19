import { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Alert } from 'react-native';
import Svg, { Polygon as SvgPolygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt, calcPoly } from '../../utils/geometry';
import { buildEstimate, MODE_LABELS, type EstimateMode, type EstimateLine, type EstimateData } from '../../utils/estimate';
import type { CalcBlock } from '../../data/calcBlocks';
import type { Room, NomItem, Vertex } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  orderName: string;
  rooms: Room[];
  scope?: string | null;
  blocks: CalcBlock[];
  mainQtysAll: Record<string, Record<string, number>>;
  optQtysAll: Record<string, Record<string, number>>;
  roomOptIds: string[];
  roomOptEnabled: Record<string, boolean>;
  roomOptBindings: Record<string, 'area' | 'perimeter'>;
  mergedNoms: NomItem[];
  perRoomPresets?: Record<string, Record<string, string>>;
  subtractFromMain?: Record<string, boolean>;
}

const MODES: EstimateMode[] = ['client', 'cost', 'installer', 'purchase'];
type Grouping = 'aggregate' | 'per-room';

interface Cols { qty: boolean; price: boolean; total: boolean; }

export default function EstimatePreview({
  visible, onClose, orderName, rooms, scope, blocks,
  mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms,
  perRoomPresets, subtractFromMain,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<EstimateMode>('client');
  const [grouping, setGrouping] = useState<Grouping>('aggregate');
  const [withDrawings, setWithDrawings] = useState(false);
  const [cols, setCols] = useState<Cols>({ qty: true, price: true, total: true });

  // Aggregate over all (or scoped) rooms
  const aggregateData = useMemo(
    () => buildEstimate(rooms, blocks, mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets, subtractFromMain),
    [rooms, blocks, mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets, subtractFromMain]
  );

  // Per-room: для каждой комнаты строим отдельную EstimateData
  const perRoomData: Array<{ room: Room; data: EstimateData }> = useMemo(() => {
    return rooms.map(room => ({
      room,
      data: buildEstimate([room], blocks, mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets, subtractFromMain),
    }));
  }, [rooms, blocks, mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets, subtractFromMain]);

  const grandTotal = grouping === 'aggregate'
    ? aggregateData.total
    : perRoomData.reduce((s, x) => s + x.data.total, 0);

  const handleExport = () => {
    Alert.alert('Экспорт сметы', 'Выберите формат', [
      { text: 'PDF', onPress: () => Alert.alert('Скоро', 'Экспорт в PDF') },
      { text: 'Word (.docx)', onPress: () => Alert.alert('Скоро', 'Экспорт в Word') },
      { text: 'Excel (.xlsx)', onPress: () => Alert.alert('Скоро', 'Экспорт в Excel') },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-bg">
        {/* Header */}
        <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#9ca3af' }}>
                {scope ? 'СМЕТА ПОМЕЩЕНИЯ' : 'СМЕТА ПРОЕКТА'}
              </Text>
              <Text className="text-base font-bold text-navy" numberOfLines={1}>
                {scope ? scope : orderName}
              </Text>
              {scope && <Text className="text-muted text-[10px]">{orderName}</Text>}
            </View>
            <Pressable onPress={onClose} className="px-3 py-2">
              <Text className="text-accent text-sm font-semibold">Закрыть</Text>
            </Pressable>
          </View>

          {/* Mode segmented control */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MODES.map(m => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: mode === m ? '#1e2030' : '#f7f7f5',
                  borderWidth: 1, borderColor: mode === m ? '#1e2030' : '#e8e8e4',
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '700',
                  color: mode === m ? '#fff' : '#6b6b7a',
                }}>{MODE_LABELS[m]}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Группировка + чертёж — disabled when scope (single room preview) */}
          {!scope && (
            <View className="flex-row items-center mt-2 gap-2">
              <View className="flex-row" style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e8e8e4' }}>
                <Pressable
                  onPress={() => setGrouping('aggregate')}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5,
                    backgroundColor: grouping === 'aggregate' ? '#4F46E5' : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: grouping === 'aggregate' ? '#fff' : '#6b6b7a' }}>
                    Общая
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setGrouping('per-room')}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5,
                    backgroundColor: grouping === 'per-room' ? '#4F46E5' : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: grouping === 'per-room' ? '#fff' : '#6b6b7a' }}>
                    По помещениям
                  </Text>
                </Pressable>
              </View>
              <ColToggle label="С чертежом" on={withDrawings} onPress={() => setWithDrawings(v => !v)} />
            </View>
          )}

          {/* Column toggles */}
          <View className="flex-row items-center mt-2 gap-2">
            <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>Колонки:</Text>
            <ColToggle label="Кол-во" on={cols.qty} onPress={() => setCols(c => ({ ...c, qty: !c.qty }))} />
            <ColToggle label="Цена" on={cols.price} onPress={() => setCols(c => ({ ...c, price: !c.price }))} />
            <ColToggle label="Итого" on={cols.total} onPress={() => setCols(c => ({ ...c, total: !c.total }))} />
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}>
          {grandTotal === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16 gap-3">
              <Text className="text-4xl">📭</Text>
              <Text className="text-muted text-center text-sm">
                В этом разделе нет позиций.{'\n'}Выберите пресеты в калькуляторе.
              </Text>
            </View>
          ) : grouping === 'aggregate' ? (
            <>
              {aggregateData.materials.length > 0 && (
                <Section title="МАТЕРИАЛЫ" lines={aggregateData.materials} total={aggregateData.materialsTotal} cols={cols} />
              )}
              {aggregateData.works.length > 0 && (
                <Section title="РАБОТЫ" lines={aggregateData.works} total={aggregateData.worksTotal} cols={cols} />
              )}
            </>
          ) : (
            perRoomData.map(({ room, data }) => {
              if (data.total === 0) return null;
              return (
                <View key={room.id} className="mt-4 mx-3">
                  <View className="bg-accent/10 border border-accent/30 rounded-t-2xl px-4 py-2.5 flex-row items-center justify-between">
                    <Text className="text-accent text-sm font-black tracking-wide" numberOfLines={1}>
                      {room.name}
                    </Text>
                    <Text className="text-accent text-sm font-black">{fmt(data.total)} ₽</Text>
                  </View>
                  {withDrawings && room.v.length >= 3 && (
                    <View className="bg-white border-x border-border px-4 py-3 items-center">
                      <RoomDrawing verts={room.v} />
                      <Text className="text-muted text-[10px] mt-1">
                        S = {fmt(room.aO ?? calcPoly(room.v).a)} м² · P = {fmt(room.pO ?? calcPoly(room.v).p)} м.п.
                      </Text>
                    </View>
                  )}
                  {data.materials.length > 0 && (
                    <Section title="МАТЕРИАЛЫ" lines={data.materials} total={data.materialsTotal} cols={cols} embedded />
                  )}
                  {data.works.length > 0 && (
                    <Section title="РАБОТЫ" lines={data.works} total={data.worksTotal} cols={cols} embedded />
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Footer total + export */}
        <View
          className="bg-navy"
          style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, gap: 8 }}
        >
          <View className="flex-row justify-between items-baseline">
            <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>
              ИТОГО
            </Text>
            <Text className="text-white text-2xl font-black">{fmt(grandTotal)} ₽</Text>
          </View>
          <Pressable
            onPress={handleExport}
            className="bg-accent rounded-xl py-3 items-center"
          >
            <Text className="text-white text-sm font-bold">📤  Экспорт сметы</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Column toggle pill ───────────────────────────────────────────────
function ColToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
        backgroundColor: on ? '#4F46E5' : '#f7f7f5',
        borderWidth: 1, borderColor: on ? '#4F46E5' : '#e8e8e4',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '700', color: on ? '#fff' : '#6b6b7a' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Mini room drawing ────────────────────────────────────────────────
function RoomDrawing({ verts, size = 200 }: { verts: Vertex[]; size?: number }) {
  const pad = 10;
  const xs = verts.map(v => v.x);
  const ys = verts.map(v => v.y);
  const mnx = Math.min(...xs), mny = Math.min(...ys);
  const mxx = Math.max(...xs), mxy = Math.max(...ys);
  const rw = Math.max(mxx - mnx, 0.1);
  const rh = Math.max(mxy - mny, 0.1);
  const sc = Math.min((size - 2 * pad) / rw, (size * 0.7 - 2 * pad) / rh);
  const w = rw * sc + 2 * pad;
  const h = rh * sc + 2 * pad;
  const pts = verts.map(v => `${pad + (v.x - mnx) * sc},${pad + (v.y - mny) * sc}`).join(' ');
  return (
    <Svg width={w} height={h} style={{ backgroundColor: '#fafaf8', borderRadius: 6 }}>
      <SvgPolygon points={pts} fill="rgba(79,70,229,0.08)" stroke="#4F46E5" strokeWidth={1.5} />
    </Svg>
  );
}

// ─── Section table ────────────────────────────────────────────────────
const COL_QTY = 80;
const COL_PRICE = 80;
const COL_TOTAL = 90;
const COL_NUM = 24;

function Section({ title, lines, total, cols, embedded }: {
  title: string; lines: EstimateLine[]; total: number; cols: Cols; embedded?: boolean;
}) {
  return (
    <View className={`${embedded ? 'mx-0' : 'mt-4 mx-3'} bg-card border border-border overflow-hidden ${embedded ? '' : 'rounded-2xl'}`}>
      <View className="bg-navy px-3 py-2 flex-row justify-between items-center">
        <Text className="text-white text-[10px] font-black tracking-widest">{title}</Text>
        <Text className="text-accent-mid text-xs font-bold">{fmt(total)} ₽</Text>
      </View>

      {/* Column headers */}
      <View className="flex-row items-center px-3 py-1.5 bg-bg/50 border-b border-border">
        <Text style={{ width: COL_NUM, fontSize: 9, color: '#9ca3af', fontWeight: '700' }}>№</Text>
        <Text style={{ flex: 1, fontSize: 9, color: '#9ca3af', fontWeight: '700' }}>НАИМЕНОВАНИЕ</Text>
        {cols.qty && (
          <Text style={{ width: COL_QTY, fontSize: 9, color: '#9ca3af', fontWeight: '700', textAlign: 'right' }}>
            КОЛ-ВО
          </Text>
        )}
        {cols.price && (
          <Text style={{ width: COL_PRICE, fontSize: 9, color: '#9ca3af', fontWeight: '700', textAlign: 'right' }}>
            ЦЕНА
          </Text>
        )}
        {cols.total && (
          <Text style={{ width: COL_TOTAL, fontSize: 9, color: '#9ca3af', fontWeight: '700', textAlign: 'right' }}>
            ИТОГО
          </Text>
        )}
      </View>

      {/* Rows */}
      {lines.map((l, i) => (
        <View key={`${l.nomId}-${i}`} className="flex-row items-center px-3 py-2 border-b border-border/50">
          <Text style={{ width: COL_NUM, fontSize: 10, color: '#9ca3af', fontWeight: '700' }}>{i + 1}</Text>
          <Text style={{ flex: 1, fontSize: 11, color: '#1e2030', fontWeight: '600', paddingRight: 6 }} numberOfLines={2}>
            {l.name}
          </Text>
          {cols.qty && (
            <Text style={{ width: COL_QTY, fontSize: 11, color: '#1e2030', textAlign: 'right' }}>
              {fmt(l.qty)} {l.unit}
            </Text>
          )}
          {cols.price && (
            <Text style={{ width: COL_PRICE, fontSize: 11, color: '#6b6b7a', textAlign: 'right' }}>
              {fmt(l.price)} ₽
            </Text>
          )}
          {cols.total && (
            <Text style={{ width: COL_TOTAL, fontSize: 11, color: '#1e2030', fontWeight: '700', textAlign: 'right' }}>
              {fmt(l.total)} ₽
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
