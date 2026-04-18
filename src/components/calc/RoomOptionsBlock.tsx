import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllNoms, getNom } from '../../data/calcBlocks';
import { fmt } from '../../utils/geometry';

// Gear icon
const GearIcon = ({ size = 14, color = '#9ca3af' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 0 1 8.4 12 3.6 3.6 0 0 1 12 8.4a3.6 3.6 0 0 1 3.6 3.6 3.6 3.6 0 0 1-3.6 3.6z"
      fill={color}
    />
  </Svg>
);

// Green filled checkmark circle
const CheckCircle = ({ checked, size = 22 }: { checked: boolean; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="11" fill={checked ? '#16a34a' : '#ffffff'} stroke={checked ? '#16a34a' : '#d1d5db'} strokeWidth="1.5" />
    {checked && (
      <Path d="M7 12.5l3.5 3.5L17 9" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    )}
  </Svg>
);

interface RoomOptionsBlockProps {
  area: number;
  perimeter: number;
  optionIds: string[];
  enabled: Record<string, boolean>;
  onToggle: (nomId: string) => void;
  onUpdateOptions: (ids: string[]) => void;
}

function qtyForNom(nomBindTo: string | undefined, area: number, perimeter: number): number {
  switch (nomBindTo) {
    case 'area': return area;
    case 'perimeter': return perimeter;
    default: return 1;
  }
}

function unitLabel(bindTo: string | undefined): string {
  switch (bindTo) {
    case 'area': return 'м²';
    case 'perimeter': return 'м.п.';
    default: return 'шт';
  }
}

export default function RoomOptionsBlock({
  area, perimeter, optionIds, enabled,
  onToggle, onUpdateOptions,
}: RoomOptionsBlockProps) {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <View style={{
      backgroundColor: '#ffffff',
      borderRadius: 14, borderWidth: 1, borderColor: '#e8e8e4',
      marginBottom: 8,
      paddingHorizontal: 14, paddingVertical: 12,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: optionIds.length > 0 ? 8 : 0 }}>
        <Text style={{
          flex: 1,
          fontSize: 11, fontWeight: '700',
          color: '#9ca3af',
          letterSpacing: 1.5,
        }}>
          ДОП. ОПЦИИ ПОМЕЩЕНИЯ
        </Text>
        <Pressable
          onPress={() => setShowEditor(true)}
          style={{
            width: 26, height: 26, borderRadius: 6,
            backgroundColor: '#f3f4f6',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <GearIcon size={14} />
        </Pressable>
      </View>

      {/* Items */}
      {optionIds.map(id => {
        const nom = getNom(id);
        if (!nom) return null;
        const isOn = !!enabled[id];
        const qty = qtyForNom(nom.bindTo, area, perimeter);
        const itemTotal = isOn ? qty * nom.price : 0;
        return (
          <Pressable
            key={id}
            onPress={() => onToggle(id)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 6, gap: 10,
            }}
          >
            <CheckCircle checked={isOn} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e2030', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                {nom.name}
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 1 }}>
                {fmt(qty)} {unitLabel(nom.bindTo)} × {fmt(nom.price)}
              </Text>
            </View>
            <Text style={{
              color: isOn ? '#4F46E5' : '#d1d5db',
              fontSize: 14, fontWeight: '700',
            }}>
              {fmt(itemTotal)}
            </Text>
          </Pressable>
        );
      })}

      <EditOptionsModal
        visible={showEditor}
        onClose={() => setShowEditor(false)}
        currentIds={optionIds}
        onSave={(ids) => { onUpdateOptions(ids); setShowEditor(false); }}
      />
    </View>
  );
}

// ─── Editor Modal ──────────────────────────────────────────────────

function EditOptionsModal({
  visible, onClose, currentIds, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  currentIds: string[];
  onSave: (ids: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(new Set(currentIds));
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) setSelected(new Set(currentIds));
  }, [visible, currentIds]);

  const allNoms = getAllNoms();
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sel = allNoms.filter(n => selected.has(n.id));
    const rest = q
      ? allNoms.filter(n => !selected.has(n.id) && n.name.toLowerCase().includes(q))
      : allNoms.filter(n => !selected.has(n.id) && (n.type === 'work' || n.type === 'option')).slice(0, 30);
    return [...sel, ...rest];
  }, [search, selected, allNoms]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: '#e8e8e4',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e2030', flex: 1 }}>Опции помещения</Text>
          <Pressable onPress={() => onSave(Array.from(selected))} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: '#4F46E5', fontSize: 16, fontWeight: '600' }}>Готово</Text>
          </Pressable>
        </View>

        <View style={{ padding: 12 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="🔍  Поиск позиций..."
            placeholderTextColor="#b0b0ba"
            style={{
              backgroundColor: '#f7f7f5', borderWidth: 1, borderColor: '#e8e8e4',
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
              color: '#1e2030', fontSize: 14,
            }}
          />
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 12 }}>
          {filtered.map(nom => {
            const isSel = selected.has(nom.id);
            return (
              <Pressable
                key={nom.id}
                onPress={() => toggle(nom.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 10, paddingHorizontal: 12,
                  borderBottomWidth: 1, borderBottomColor: '#e8e8e4', gap: 10,
                }}
              >
                <CheckCircle checked={isSel} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1e2030', fontSize: 13, fontWeight: '500' }}>{nom.name}</Text>
                  <Text style={{ color: '#6b6b7a', fontSize: 11 }}>{fmt(nom.price)} ₽/{nom.unit}</Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
