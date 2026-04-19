import { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt } from '../../utils/geometry';
import { buildEstimate, MODE_LABELS, type EstimateMode, type EstimateLine } from '../../utils/estimate';
import type { CalcBlock } from '../../data/calcBlocks';
import type { Room, NomItem } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  orderName: string;
  rooms: Room[];
  scope?: string | null;  // room name when previewing a single room, null = full project
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

interface Cols {
  qty: boolean;
  price: boolean;
  total: boolean;
}

export default function EstimatePreview({
  visible, onClose, orderName, rooms, scope, blocks,
  mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms,
  perRoomPresets, subtractFromMain,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<EstimateMode>('client');
  const [cols, setCols] = useState<Cols>({ qty: true, price: true, total: true });

  const data = useMemo(
    () => buildEstimate(rooms, blocks, mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets, subtractFromMain),
    [rooms, blocks, mainQtysAll, optQtysAll, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets, subtractFromMain]
  );

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

          {/* Column toggles */}
          <View className="flex-row items-center mt-2 gap-2">
            <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>Колонки:</Text>
            <ColToggle label="Кол-во" on={cols.qty} onPress={() => setCols(c => ({ ...c, qty: !c.qty }))} />
            <ColToggle label="Цена" on={cols.price} onPress={() => setCols(c => ({ ...c, price: !c.price }))} />
            <ColToggle label="Итого" on={cols.total} onPress={() => setCols(c => ({ ...c, total: !c.total }))} />
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
          {data.materials.length === 0 && data.works.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16 gap-3">
              <Text className="text-4xl">📭</Text>
              <Text className="text-muted text-center text-sm">
                В этом разделе нет позиций.{'\n'}Выберите пресеты в калькуляторе.
              </Text>
            </View>
          ) : (
            <>
              {data.materials.length > 0 && (
                <Section title="МАТЕРИАЛЫ" lines={data.materials} total={data.materialsTotal} cols={cols} />
              )}
              {data.works.length > 0 && (
                <Section title="РАБОТЫ" lines={data.works} total={data.worksTotal} cols={cols} />
              )}
            </>
          )}
        </ScrollView>

        {/* Footer total */}
        {data.total > 0 && (
          <View
            className="bg-navy"
            style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 14 }}
          >
            <View className="flex-row justify-between items-baseline">
              <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>
                ИТОГО
              </Text>
              <Text className="text-white text-2xl font-black">{fmt(data.total)} ₽</Text>
            </View>
          </View>
        )}
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

// ─── Section table ────────────────────────────────────────────────────
const COL_QTY = 80;
const COL_PRICE = 80;
const COL_TOTAL = 90;
const COL_NUM = 24;

function Section({ title, lines, total, cols }: {
  title: string; lines: EstimateLine[]; total: number; cols: Cols;
}) {
  return (
    <View className="mt-4 mx-3 bg-card rounded-2xl border border-border overflow-hidden">
      <View className="bg-navy px-3 py-2.5 flex-row justify-between items-center">
        <Text className="text-white text-xs font-black tracking-widest">{title}</Text>
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
