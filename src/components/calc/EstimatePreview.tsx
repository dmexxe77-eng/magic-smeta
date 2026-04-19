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
  mainQtys: Record<string, number>;
  optQtys: Record<string, number>;
  roomOptIds: string[];
  roomOptEnabled: Record<string, boolean>;
  roomOptBindings: Record<string, 'area' | 'perimeter'>;
  mergedNoms: NomItem[];
  perRoomPresets?: Record<string, Record<string, string>>;
}

const MODES: EstimateMode[] = ['client', 'cost', 'installer', 'purchase'];

export default function EstimatePreview({
  visible, onClose, orderName, rooms, scope, blocks,
  mainQtys, optQtys, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms,
  perRoomPresets,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<EstimateMode>('client');

  const data = useMemo(
    () => buildEstimate(rooms, blocks, mainQtys, optQtys, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets),
    [rooms, blocks, mainQtys, optQtys, roomOptIds, roomOptEnabled, roomOptBindings, mergedNoms, mode, perRoomPresets]
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
                <Section title="МАТЕРИАЛЫ" lines={data.materials} total={data.materialsTotal} />
              )}
              {data.works.length > 0 && (
                <Section title="РАБОТЫ" lines={data.works} total={data.worksTotal} />
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

function Section({ title, lines, total }: { title: string; lines: EstimateLine[]; total: number }) {
  return (
    <View className="mt-4 mx-3 bg-card rounded-2xl border border-border overflow-hidden">
      <View className="bg-navy px-4 py-2.5 flex-row justify-between items-center">
        <Text className="text-white text-xs font-black tracking-widest">{title}</Text>
        <Text className="text-accent-mid text-xs font-bold">{fmt(total)} ₽</Text>
      </View>
      {lines.map((l, i) => (
        <View key={`${l.nomId}-${i}`} className="px-4 py-2.5 flex-row items-start border-b border-border/50">
          <Text className="text-muted text-[10px] font-bold w-6">{i + 1}</Text>
          <View className="flex-1 mr-2">
            <Text className="text-navy text-xs font-semibold" numberOfLines={2}>{l.name}</Text>
            <Text className="text-muted text-[10px] mt-0.5">
              {fmt(l.qty)} {l.unit}  ×  {fmt(l.price)} ₽
            </Text>
          </View>
          <Text className="text-navy text-xs font-bold">{fmt(l.total)} ₽</Text>
        </View>
      ))}
    </View>
  );
}
