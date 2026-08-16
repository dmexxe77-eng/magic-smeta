import { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Alert } from 'react-native';
import Svg, { Polygon as SvgPolygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share2 } from 'lucide-react-native';
import { fmt, calcPoly } from '../../utils/geometry';
import { buildEstimate, MODE_LABELS, type EstimateMode, type EstimateLine, type EstimateData } from '../../utils/estimate';
import type { CalcBlock } from '../../data/calcBlocks';
import type { Room, NomItem, Vertex } from '../../types';
import { Touchable, HeroCard, COLORS, SERIF } from '../ui';

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
  roomOptEnabled: Record<string, Record<string, boolean>> | Record<string, boolean>;
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
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        {/* Header */}
        <View style={{ backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 18, paddingBottom: 14, paddingTop: insets.top + 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.subtle, letterSpacing: 2 }}>
                {scope ? 'СМЕТА ПОМЕЩЕНИЯ' : 'СМЕТА ПРОЕКТА'}
              </Text>
              <Text style={{ fontFamily: SERIF, fontSize: 22, fontWeight: '700', color: COLORS.ink, marginTop: 2, lineHeight: 26 }} numberOfLines={1}>
                {scope ? scope : orderName}
              </Text>
              {scope && <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>{orderName}</Text>}
            </View>
            <Touchable haptic="light" onPress={onClose} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <Text style={{ color: COLORS.accent, fontSize: 14, fontWeight: '700' }}>Закрыть</Text>
            </Touchable>
          </View>

          {/* Mode pills — glass, accent active */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {MODES.map(m => {
              const isActive = mode === m;
              return (
                <Touchable
                  key={m}
                  haptic="selection"
                  scale={0.96}
                  onPress={() => setMode(m)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: isActive ? COLORS.accent : COLORS.glass,
                    borderWidth: 1,
                    borderColor: isActive ? COLORS.accent : COLORS.glassEdge,
                    shadowColor: isActive ? COLORS.accent : undefined,
                    shadowOpacity: isActive ? 0.4 : 0,
                    shadowRadius: 10,
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isActive ? '#FFFFFF' : COLORS.muted,
                    letterSpacing: 0.2,
                  }}>{MODE_LABELS[m]}</Text>
                </Touchable>
              );
            })}
          </ScrollView>

          {/* Row 1 — grouping + drawing */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            {!scope && rooms.length > 1 && (
              <>
                <ColToggle label="Общая" on={grouping === 'aggregate'} onPress={() => setGrouping('aggregate')} />
                <ColToggle label="По помещениям" on={grouping === 'per-room'} onPress={() => setGrouping('per-room')} />
                <View style={{ width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 4 }} />
              </>
            )}
            <ColToggle label="Чертёж" on={withDrawings} onPress={() => setWithDrawings(v => !v)} />
          </View>

          {/* Row 2 — column filters */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <ColToggle label="Кол-во" on={cols.qty} onPress={() => setCols(c => ({ ...c, qty: !c.qty }))} />
            <ColToggle label="Цена" on={cols.price} onPress={() => setCols(c => ({ ...c, price: !c.price }))} />
            <ColToggle label="Итого" on={cols.total} onPress={() => setCols(c => ({ ...c, total: !c.total }))} />
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}>
          {grandTotal === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16 gap-3">
              <Text className="text-4xl">—</Text>
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
              {/* Чертежи всех помещений после общей сметы */}
              {withDrawings && rooms.some(r => r.v.length >= 3) && (
                <View style={{ marginTop: 14, marginHorizontal: 14, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: COLORS.ink, paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>ЧЕРТЕЖИ ПОМЕЩЕНИЙ</Text>
                  </View>
                  <View className="p-3 gap-3">
                    {rooms.map(room => room.v.length >= 3 && (
                      <View key={room.id} className="items-center pb-2 border-b border-border/50">
                        <Text className="text-ink text-xs font-bold mb-2">{room.name}</Text>
                        <RoomDrawing verts={room.v} />
                        <Text className="text-muted text-[10px] mt-1">
                          S = {fmt(room.aO ?? calcPoly(room.v).a)} м² · P = {fmt(room.pO ?? calcPoly(room.v).p)} м.п.
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            perRoomData.map(({ room, data }) => {
              if (data.total === 0) return null;
              return (
                <View key={room.id} style={{ marginTop: 14, marginHorizontal: 14 }}>
                  <View style={{
                    backgroundColor: COLORS.accentSoft,
                    borderWidth: 1, borderColor: COLORS.accent,
                    borderTopLeftRadius: 14, borderTopRightRadius: 14,
                    paddingHorizontal: 14, paddingVertical: 10,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <Text style={{ fontFamily: SERIF, color: COLORS.accentInk, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                      {room.name}
                    </Text>
                    <Text style={{ fontFamily: SERIF, color: COLORS.accentInk, fontSize: 15, fontWeight: '700' }}>{fmt(data.total)} ₽</Text>
                  </View>
                  {data.materials.length > 0 && (
                    <Section title="МАТЕРИАЛЫ" lines={data.materials} total={data.materialsTotal} cols={cols} embedded />
                  )}
                  {data.works.length > 0 && (
                    <Section title="РАБОТЫ" lines={data.works} total={data.worksTotal} cols={cols} embedded />
                  )}
                  {/* Чертёж после сметы помещения */}
                  {withDrawings && room.v.length >= 3 && (
                    <View style={{
                      backgroundColor: COLORS.card,
                      borderWidth: 1, borderTopWidth: 0,
                      borderColor: COLORS.border,
                      borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
                      paddingHorizontal: 14, paddingVertical: 14,
                      alignItems: 'center',
                    }}>
                      <RoomDrawing verts={room.v} />
                      <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                        S = {fmt(room.aO ?? calcPoly(room.v).a)} м² · P = {fmt(room.pO ?? calcPoly(room.v).p)} м.п.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Footer total + export — glass slab */}
        <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: COLORS.bg2 }}>
          <HeroCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2.2 }}>
                ИТОГО
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 }}>
                {fmt(grandTotal)}<Text style={{ fontSize: 18, color: COLORS.muted, fontWeight: '600' }}> ₽</Text>
              </Text>
            </View>
            <Touchable
              haptic="medium"
              onPress={handleExport}
              style={{
                borderRadius: 999,
                paddingVertical: 13,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: COLORS.accent,
                shadowColor: COLORS.accent,
                shadowOpacity: 0.4,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Share2 size={15} color="#FFFFFF" strokeWidth={2.3} />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 }}>Экспорт сметы</Text>
            </Touchable>
          </HeroCard>
        </View>
      </View>
    </Modal>
  );
}

// ─── Column toggle pill ───────────────────────────────────────────────
function ColToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Touchable
      haptic="selection"
      scale={0.94}
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        backgroundColor: on ? COLORS.accent : 'transparent',
        borderWidth: 1, borderColor: on ? COLORS.accent : COLORS.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#FFFFFF' : COLORS.muted, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Touchable>
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
    <Svg width={w} height={h} style={{ backgroundColor: COLORS.surface2, borderRadius: 6 }}>
      <SvgPolygon points={pts} fill="rgba(184,85,63,0.08)" stroke={COLORS.accent} strokeWidth={1.5} />
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
    <View style={{
      marginHorizontal: embedded ? 0 : 14,
      marginTop: embedded ? 0 : 14,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.glassEdge,
      borderRadius: embedded ? 0 : 14,
      overflow: 'hidden',
    }}>
      <View style={{ backgroundColor: COLORS.surface2, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <Text style={{ color: COLORS.ink, fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>{title}</Text>
        <Text style={{ color: COLORS.accent, fontSize: 13, fontWeight: '700' }}>{fmt(total)} ₽</Text>
      </View>

      {/* Column headers */}
      <View className="flex-row items-center px-3 py-1.5 bg-bg/50 border-b border-border">
        <Text style={{ width: COL_NUM, fontSize: 9, color: '#6B7290', fontWeight: '700' }}>№</Text>
        <Text style={{ flex: 1, fontSize: 9, color: '#6B7290', fontWeight: '700' }}>НАИМЕНОВАНИЕ</Text>
        {cols.qty && (
          <Text style={{ width: COL_QTY, fontSize: 9, color: '#6B7290', fontWeight: '700', textAlign: 'right' }}>
            КОЛ-ВО
          </Text>
        )}
        {cols.price && (
          <Text style={{ width: COL_PRICE, fontSize: 9, color: '#6B7290', fontWeight: '700', textAlign: 'right' }}>
            ЦЕНА
          </Text>
        )}
        {cols.total && (
          <Text style={{ width: COL_TOTAL, fontSize: 9, color: '#6B7290', fontWeight: '700', textAlign: 'right' }}>
            ИТОГО
          </Text>
        )}
      </View>

      {/* Rows */}
      {lines.map((l, i) => (
        <View key={`${l.nomId}-${i}`} className="flex-row items-center px-3 py-2 border-b border-border/50">
          <Text style={{ width: COL_NUM, fontSize: 10, color: '#6B7290', fontWeight: '700' }}>{i + 1}</Text>
          <Text style={{ flex: 1, fontSize: 11, color: '#F2F4FA', fontWeight: '600', paddingRight: 6 }} numberOfLines={2}>
            {l.name}
          </Text>
          {cols.qty && (
            <Text style={{ width: COL_QTY, fontSize: 11, color: '#F2F4FA', textAlign: 'right' }}>
              {fmt(l.qty)} {l.unit}
            </Text>
          )}
          {cols.price && (
            <Text style={{ width: COL_PRICE, fontSize: 11, color: '#9BA3BD', textAlign: 'right' }}>
              {fmt(l.price)} ₽
            </Text>
          )}
          {cols.total && (
            <Text style={{ width: COL_TOTAL, fontSize: 11, color: '#F2F4FA', fontWeight: '700', textAlign: 'right' }}>
              {fmt(l.total)} ₽
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
