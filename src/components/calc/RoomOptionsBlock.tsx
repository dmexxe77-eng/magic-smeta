import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllNoms, getNom } from '../../data/calcBlocks';
import { fmt } from '../../utils/geometry';
import { COLORS } from '../ui';

// Gear icon
const GearIcon = ({ size = 14, color = COLORS.subtle }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 0 1 8.4 12 3.6 3.6 0 0 1 12 8.4a3.6 3.6 0 0 1 3.6 3.6 3.6 3.6 0 0 1-3.6 3.6z"
      fill={color}
    />
  </Svg>
);

// Filled checkmark circle — accent fill / glass empty (theme-aware)
const CheckCircle = ({ checked, size = 22 }: { checked: boolean; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="11" fill={checked ? '#0A84FF' : COLORS.glassHi} stroke={checked ? '#0A84FF' : COLORS.borderStrong} strokeWidth="1.5" />
    {checked && (
      <Path d="M7 12.5l3.5 3.5L17 9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    )}
  </Svg>
);

type Binding = 'area' | 'perimeter';

interface RoomOptionsBlockProps {
  area: number;
  perimeter: number;
  optionIds: string[];
  enabled: Record<string, boolean>;
  bindings: Record<string, Binding>; // override per-nom binding
  onToggle: (nomId: string) => void;
  onUpdateOptions: (ids: string[], bindings: Record<string, Binding>) => void;
  title?: string;
}

function qtyForBinding(binding: Binding, area: number, perimeter: number): number {
  return binding === 'area' ? area : perimeter;
}

function unitLabel(binding: Binding): string {
  return binding === 'area' ? 'м²' : 'м.п.';
}

// Default binding for a nom: uses its own bindTo or falls back to perimeter
function defaultBinding(nomBindTo: string | undefined): Binding {
  return nomBindTo === 'area' ? 'area' : 'perimeter';
}

export default function RoomOptionsBlock({
  area, perimeter, optionIds, enabled, bindings,
  onToggle, onUpdateOptions,
  title = 'ДОП. ОПЦИИ ПОМЕЩЕНИЯ',
}: RoomOptionsBlockProps) {
  const [showEditor, setShowEditor] = useState(false);

  const getBinding = (nomId: string): Binding => {
    if (bindings[nomId]) return bindings[nomId];
    const nom = getNom(nomId);
    return defaultBinding(nom?.bindTo);
  };

  return (
    <View style={{
      backgroundColor: COLORS.glass,
      borderRadius: 14, borderWidth: 1, borderColor: COLORS.glassEdge,
      marginBottom: 10,
      paddingHorizontal: 14, paddingVertical: 12,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: optionIds.length > 0 ? 8 : 0 }}>
        <Text style={{
          flex: 1,
          fontSize: 10, fontWeight: '700',
          color: COLORS.muted,
          letterSpacing: 1.6,
        }}>
          {title}
        </Text>
        <Pressable
          onPress={() => setShowEditor(true)}
          style={{
            width: 26, height: 26, borderRadius: 8,
            backgroundColor: COLORS.glassHi,
            borderWidth: 1, borderColor: COLORS.glassEdge,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <GearIcon size={13} color={COLORS.muted} />
        </Pressable>
      </View>

      {/* Items */}
      {optionIds.map(id => {
        const nom = getNom(id);
        if (!nom) return null;
        const isOn = !!enabled[id];
        const binding = getBinding(id);
        const qty = qtyForBinding(binding, area, perimeter);
        const itemTotal = isOn ? qty * nom.price : 0;
        return (
          <Pressable
            key={id}
            onPress={() => onToggle(id)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 3, gap: 8,
            }}
          >
            <CheckCircle checked={isOn} size={16} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.ink, fontSize: 11, fontWeight: '500' }} numberOfLines={1}>
                {nom.name}
              </Text>
              <Text style={{ color: COLORS.subtle, fontSize: 9 }}>
                {fmt(qty)} {unitLabel(binding)} × {fmt(nom.price)}
              </Text>
            </View>
            <Text style={{
              color: isOn ? '#0A84FF' : COLORS.faint,
              fontSize: 11, fontWeight: '700',
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
        currentBindings={bindings}
        onSave={(ids, bnds) => { onUpdateOptions(ids, bnds); setShowEditor(false); }}
      />
    </View>
  );
}

// ─── Editor Modal ──────────────────────────────────────────────────

function EditOptionsModal({
  visible, onClose, currentIds, currentBindings, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  currentIds: string[];
  currentBindings: Record<string, Binding>;
  onSave: (ids: string[], bindings: Record<string, Binding>) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(new Set(currentIds));
  const [bindings, setBindings] = useState<Record<string, Binding>>(currentBindings);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setSelected(new Set(currentIds));
      setBindings(currentBindings);
    }
  }, [visible, currentIds, currentBindings]);

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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Auto-set binding from nom.bindTo if not already set
        if (!bindings[id]) {
          const nom = getNom(id);
          setBindings(b => ({ ...b, [id]: defaultBinding(nom?.bindTo) }));
        }
      }
      return next;
    });
  };

  const setBinding = (id: string, b: Binding) => {
    setBindings(prev => ({ ...prev, [id]: b }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: COLORS.border,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.ink, flex: 1, letterSpacing: -0.3 }}>Опции помещения</Text>
          <Pressable onPress={() => onSave(Array.from(selected), bindings)} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: '#0A84FF', fontSize: 15, fontWeight: '700' }}>Готово</Text>
          </Pressable>
        </View>

        <View style={{ padding: 12 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск позиций..."
            placeholderTextColor={COLORS.subtle}
            style={{
              backgroundColor: COLORS.glassHi,
              borderWidth: 1, borderColor: COLORS.glassEdge,
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
              color: COLORS.ink, fontSize: 14,
            }}
          />
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 12 }}>
          {filtered.map(nom => {
            const isSel = selected.has(nom.id);
            const binding = bindings[nom.id] || defaultBinding(nom.bindTo);
            return (
              <View
                key={nom.id}
                style={{
                  paddingVertical: 10, paddingHorizontal: 12,
                  borderBottomWidth: 1, borderBottomColor: COLORS.border,
                }}
              >
                <Pressable
                  onPress={() => toggle(nom.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <CheckCircle checked={isSel} size={22} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: '500' }}>{nom.name}</Text>
                    <Text style={{ color: COLORS.muted, fontSize: 11 }}>{fmt(nom.price)} ₽/{nom.unit}</Text>
                  </View>
                </Pressable>

                {/* Area/Perimeter toggle for selected items */}
                {isSel && (
                  <View style={{ flexDirection: 'row', marginTop: 8, marginLeft: 32, gap: 6 }}>
                    <Text style={{ color: COLORS.muted, fontSize: 11, alignSelf: 'center', marginRight: 4 }}>
                      Считать от:
                    </Text>
                    <Pressable
                      onPress={() => setBinding(nom.id, 'area')}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                        backgroundColor: binding === 'area' ? '#0A84FF' : COLORS.glassHi,
                        borderWidth: 1, borderColor: binding === 'area' ? '#0A84FF' : COLORS.glassEdge,
                      }}
                    >
                      <Text style={{ color: binding === 'area' ? '#FFFFFF' : COLORS.ink, fontSize: 11, fontWeight: '600' }}>
                        Площадь (м²)
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setBinding(nom.id, 'perimeter')}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                        backgroundColor: binding === 'perimeter' ? '#0A84FF' : COLORS.glassHi,
                        borderWidth: 1, borderColor: binding === 'perimeter' ? '#0A84FF' : COLORS.glassEdge,
                      }}
                    >
                      <Text style={{ color: binding === 'perimeter' ? '#FFFFFF' : COLORS.ink, fontSize: 11, fontWeight: '600' }}>
                        Периметр (м.п.)
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
