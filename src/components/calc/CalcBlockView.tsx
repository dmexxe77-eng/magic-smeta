import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Search, Plus,
  Layers, Frame, Triangle, Lightbulb, Sparkles, Blinds, Wrench,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { CalcBlock, Preset, NomRef } from '../../data/calcBlocks';
import { getNom, getNomPrice, calcPresetTotal, getDefaultMainQty, getAllNoms } from '../../data/calcBlocks';
import type { NomItem } from '../../data/nomenclature';
import { fmt } from '../../utils/geometry';
import { useApp } from '../../store/AppContext';
import { Toggle, Touchable, COLORS } from '../ui';

// ─── Block icon registry ─────────────────────────────────────────────
// Supports new lucide-name keys AND legacy emoji keys (for existing data)
const BLOCK_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  'canvas':         Layers,
  'profile-main':   Frame,
  'profile-extra':  Triangle,
  'lights':         Lightbulb,
  'linear-light':   Sparkles,
  'curtains':       Blinds,
  'custom':         Wrench,
  // Legacy emoji fallback
  '🎨': Layers,
  '📏': Frame,
  '📐': Triangle,
  '💡': Lightbulb,
  '💫': Sparkles,
  '🪟': Blinds,
  '🔧': Wrench,
};

function BlockIcon({ name, size = 16, color = COLORS.ink }: { name: string; size?: number; color?: string }) {
  const Icon = BLOCK_ICONS[name] ?? Layers;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}

// ─── Checkbox row (label + box) ─────────────────────────────────────
function CheckboxRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-center gap-1.5 ml-2" hitSlop={6}>
      <Text style={{
        fontSize: 10, fontWeight: '600',
        color: checked ? '#0A84FF' : '#9BA3BD',
      }}>
        {label}
      </Text>
      <View style={{
        width: 16, height: 16, borderRadius: 4,
        borderWidth: 1.5,
        borderColor: checked ? '#0A84FF' : '#6B7290',
        backgroundColor: checked ? '#0A84FF' : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', lineHeight: 12 }}>✓</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Pencil Icon (edit) ─────────────────────────────────────────────
const PencilIcon = ({ size = 18, color = COLORS.accent }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      fill={color}
    />
  </Svg>
);

// ─── Inline Qty Editor ──────────────────────────────────────────────

function QtyCell({ value, onChange, small }: { value: number; onChange: (v: number) => void; small?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState('');

  if (editing) {
    return (
      <TextInput
        value={tmp}
        onChangeText={setTmp}
        keyboardType="decimal-pad"
        autoFocus
        onBlur={() => { onChange(parseFloat(tmp.replace(',', '.')) || 0); setEditing(false); }}
        onSubmitEditing={() => { onChange(parseFloat(tmp.replace(',', '.')) || 0); setEditing(false); }}
        style={{ width: small ? 40 : 50, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: '#0A84FF', borderRadius: 6, backgroundColor: '#1B2138', fontSize: 11, textAlign: 'center', color: '#F2F4FA' }}
      />
    );
  }
  return (
    <Pressable
      onPress={() => { setTmp(value === 0 ? '' : String(value)); setEditing(true); }}
      style={{ width: small ? 40 : 50, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: '#262C44', borderRadius: 6, backgroundColor: '#1B2138', alignItems: 'center' }}
    >
      <Text style={{ fontSize: 11, color: '#F2F4FA', fontWeight: '600' }}>{value > 0 ? fmt(value) : '—'}</Text>
    </Pressable>
  );
}

// ─── Preset Editor Modal ────────────────────────────────────────────

function PresetEditorModal({
  visible,
  block,
  onClose,
  onSave,
}: {
  visible: boolean;
  block: CalcBlock;
  onClose: () => void;
  onSave: (presets: Preset[]) => void;
}) {
  const { state, dispatch } = useApp();
  const [presets, setPresets] = useState<Preset[]>(block.presets);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  // Из глобальной библиотеки — пресеты для этого типа блока
  const baseBlockId = block.id.replace(/_copy\d+$/, '');
  const libraryForBlock = (state.presetTemplates ?? []).filter(t => t.blockId === baseBlockId);
  // Какие из них ещё не добавлены в этот проект
  const projectPresetIds = new Set(presets.map(p => p.id));
  const availableFromLibrary = libraryForBlock.filter(t => !projectPresetIds.has(t.id));

  const addFromLibrary = (template: typeof libraryForBlock[0]) => {
    setPresets(prev => [...prev, {
      id: template.id,
      name: template.name,
      items: template.items.map(r => ({ ...r })),
      options: template.options.map(r => ({ ...r })),
    }]);
  };

  if (!editingPreset) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.ink, flex: 1, letterSpacing: -0.3 }}>Пресеты блока</Text>
            <Pressable onPress={() => { onSave(presets); onClose(); }} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: COLORS.accent, fontSize: 15, fontWeight: '700' }}>Готово</Text>
            </Pressable>
          </View>
          <ScrollView className="flex-1 p-4">
            <Text className="text-[10px] font-bold text-muted tracking-widest mb-2">АКТИВНЫЕ В ПРОЕКТЕ</Text>
            {presets.map((preset) => {
              const itemNames = preset.items.map(r => getNom(r.nomId)?.name ?? '').filter(Boolean).join(' + ');
              return (
                <View key={preset.id} className="bg-bg rounded-xl border border-border p-3 mb-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-ink font-bold text-sm">{preset.name}</Text>
                      <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{itemNames}</Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <Pressable onPress={() => setEditingPreset({ ...preset })} className="px-2 py-1">
                        <Text className="text-accent text-xs font-semibold">Ред.</Text>
                      </Pressable>
                      <Touchable
                        haptic="warning"
                        onPress={() => Alert.alert('Убрать из проекта?', 'Пресет останется в библиотеке.', [
                          { text: 'Отмена', style: 'cancel' },
                          { text: 'Убрать', style: 'destructive', onPress: () => setPresets(p => p.filter(x => x.id !== preset.id)) },
                        ])}
                        className="w-9 h-9 rounded-full bg-danger/10 items-center justify-center"
                      >
                        <Text className="text-danger text-base font-semibold">−</Text>
                      </Touchable>
                    </View>
                  </View>
                </View>
              );
            })}

            {availableFromLibrary.length > 0 && (
              <>
                <Text className="text-[10px] font-bold text-muted tracking-widest mb-2 mt-4">
                  ДОСТУПНО ИЗ БИБЛИОТЕКИ
                </Text>
                {availableFromLibrary.map(t => {
                  const itemNames = t.items.map(r => getNom(r.nomId)?.name ?? '').filter(Boolean).join(' + ');
                  return (
                    <View key={t.id} className="bg-bg/50 rounded-xl border border-dashed border-border p-3 mb-3 flex-row items-center justify-between">
                      <View className="flex-1 mr-2">
                        <Text className="text-ink font-semibold text-sm">{t.name}</Text>
                        {itemNames ? (
                          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{itemNames}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => addFromLibrary(t)}
                        className="bg-accent px-3 py-1.5 rounded-lg"
                      >
                        <Text className="text-white text-xs font-bold">+ Добавить</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </>
            )}

            <Pressable
              onPress={() => setEditingPreset({ id: `pr_new_${Date.now()}`, name: '', items: [], options: [] })}
              className="border-2 border-dashed border-border rounded-xl py-4 items-center mt-2"
            >
              <Text className="text-muted font-semibold">+ Создать новый пресет</Text>
            </Pressable>
            <Text className="text-muted text-[10px] text-center mt-1.5 mb-4">
              Новый пресет добавится и в глобальную библиотеку — будет доступен в других проектах.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <PresetEditView
      preset={editingPreset}
      onSave={(updated) => {
        const isNew = !presets.some(p => p.id === updated.id);
        setPresets(prev => {
          const exists = prev.find(p => p.id === updated.id);
          return exists ? prev.map(p => p.id === updated.id ? updated : p) : [...prev, updated];
        });
        // Sync to global library
        if (isNew) {
          dispatch({
            type: 'ADD_PRESET_TEMPLATE',
            template: {
              id: updated.id,
              blockId: baseBlockId,
              name: updated.name,
              items: updated.items.map(r => ({ nomId: r.nomId, enabled: r.enabled })),
              options: updated.options.map(r => ({ nomId: r.nomId, enabled: r.enabled })),
              isDefault: false,
              createdAt: new Date().toISOString(),
            },
          });
        } else {
          dispatch({
            type: 'UPDATE_PRESET_TEMPLATE',
            id: updated.id,
            patch: {
              name: updated.name,
              items: updated.items.map(r => ({ nomId: r.nomId, enabled: r.enabled })),
              options: updated.options.map(r => ({ nomId: r.nomId, enabled: r.enabled })),
            },
          });
        }
        setEditingPreset(null);
      }}
      onCancel={() => setEditingPreset(null)}
    />
  );
}

// ─── Preset Edit View ───────────────────────────────────────────────

function PresetEditView({ preset, onSave, onCancel }: { preset: Preset; onSave: (p: Preset) => void; onCancel: () => void }) {
  const [name, setName] = useState(preset.name);
  const [items, setItems] = useState<NomRef[]>(preset.items);
  const [options, setOptions] = useState<NomRef[]>(preset.options);
  const [searchItems, setSearchItems] = useState('');
  const [searchOpts, setSearchOpts] = useState('');

  const itemIds = new Set(items.map(r => r.nomId));
  const optIds = new Set(options.map(r => r.nomId));

  // Selected items first, then search results
  const filteredNoms = useMemo(() => {
    const selected = getAllNoms().filter(n => itemIds.has(n.id));
    const q = searchItems.toLowerCase().trim();
    const rest = q
      ? getAllNoms().filter(n => !itemIds.has(n.id) && n.name.toLowerCase().includes(q))
      : getAllNoms().filter(n => !itemIds.has(n.id)).slice(0, 10);
    return [...selected, ...rest];
  }, [searchItems, itemIds]);

  const filteredOpts = useMemo(() => {
    const selected = getAllNoms().filter(n => optIds.has(n.id));
    const q = searchOpts.toLowerCase().trim();
    const rest = q
      ? getAllNoms().filter(n => !optIds.has(n.id) && n.name.toLowerCase().includes(q))
      : getAllNoms().filter(n => !optIds.has(n.id)).slice(0, 10);
    return [...selected, ...rest];
  }, [searchOpts, optIds]);

  const toggleItem = (nomId: string) => {
    if (itemIds.has(nomId)) setItems(prev => prev.filter(r => r.nomId !== nomId));
    else setItems(prev => [...prev, { nomId, enabled: true }]);
  };

  const toggleOpt = (nomId: string) => {
    if (optIds.has(nomId)) setOptions(prev => prev.filter(r => r.nomId !== nomId));
    else setOptions(prev => [...prev, { nomId, enabled: true }]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.ink, letterSpacing: -0.3 }}>Редактирование кнопки</Text>
          <Pressable onPress={onCancel} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: COLORS.danger, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Название кнопки"
            placeholderTextColor="#6B7290"
            className="bg-bg border border-border rounded-xl px-3 py-2.5 text-ink text-sm mb-3"
          />

          {/* ITEMS */}
          <Text className="text-xs font-bold text-accent tracking-widest mb-1">НОМЕНКЛАТУРЫ</Text>
          <TextInput
            value={searchItems}
            onChangeText={setSearchItems}
            placeholder="Поиск..."
            placeholderTextColor="#6B7290"
            className="bg-bg border border-border rounded-lg px-2 py-1.5 text-ink text-[11px] mb-1"
          />
          {filteredNoms.slice(0, 15).map(nom => (
            <Pressable
              key={nom.id}
              onPress={() => toggleItem(nom.id)}
              className="flex-row items-center justify-between py-1.5 border-b border-border"
            >
              <View className="flex-row items-center gap-2 flex-1 mr-1">
                <Toggle
                  value={itemIds.has(nom.id)}
                  onValueChange={() => toggleItem(nom.id)}
                />
                <Text className="text-ink text-xs flex-1" numberOfLines={1}>{nom.name}</Text>
              </View>
              <Text className="text-orange-500 text-[11px] font-bold">{fmt(nom.price)}</Text>
            </Pressable>
          ))}

          <View className="h-3" />

          {/* OPTIONS */}
          <Text className="text-xs font-bold text-muted tracking-widest mb-1">ОПЦИИ</Text>
          <TextInput
            value={searchOpts}
            onChangeText={setSearchOpts}
            placeholder="Поиск..."
            placeholderTextColor="#6B7290"
            className="bg-bg border border-border rounded-lg px-2 py-1.5 text-ink text-[11px] mb-1"
          />
          {filteredOpts.slice(0, 15).map(nom => (
            <Pressable
              key={`o-${nom.id}`}
              onPress={() => toggleOpt(nom.id)}
              className="flex-row items-center justify-between py-1.5 border-b border-border"
            >
              <View className="flex-row items-center gap-2 flex-1 mr-1">
                <Toggle
                  value={optIds.has(nom.id)}
                  onValueChange={() => toggleOpt(nom.id)}
                />
                <Text className="text-ink text-xs flex-1" numberOfLines={1}>{nom.name}</Text>
              </View>
              <Text className="text-orange-500 text-[11px] font-bold">{fmt(nom.price)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="px-4 pb-8 pt-2 border-t border-border">
          <Pressable
            onPress={() => onSave({ ...preset, name: name.trim() || 'Кнопка', items, options })}
            className="bg-navy rounded-xl py-3 items-center"
          >
            <Text className="text-white font-bold">Сохранить</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main CalcBlockView ─────────────────────────────────────────────

interface CalcBlockViewProps {
  block: CalcBlock;
  area: number;
  perimeter: number;
  mainQty: number | undefined;
  optQtys: Record<string, number>;
  onToggleExpanded: () => void;
  onSelectPreset: (presetId: string) => void;
  onUpdatePresets: (presets: Preset[]) => void;
  onToggleNom: (side: 'items' | 'options', nomId: string) => void;
  onChangeMainQty: (qty: number) => void;
  onChangeOptQty: (nomId: string, qty: number) => void;
  onDuplicate?: () => void;  // clone this block (e.g. for multiple different additional profiles)
  onDelete?: () => void;     // delete this block (only for cloned blocks)
  isSyncedToProject?: boolean;             // perRoomPreset: галочка ВКЛ — пресет синхронизирован с global
  onToggleSyncToProject?: (next: boolean) => void;
  isSubtractFromMain?: boolean;            // canSubtractFromMain: галочка «Вычесть от основного профиля»
  onToggleSubtractFromMain?: (next: boolean) => void;
}

export default function CalcBlockView({
  block, area, perimeter, mainQty, optQtys,
  onToggleExpanded, onSelectPreset, onUpdatePresets,
  onToggleNom, onChangeMainQty, onChangeOptQty,
  onDuplicate, onDelete,
  isSyncedToProject, onToggleSyncToProject,
  isSubtractFromMain, onToggleSubtractFromMain,
}: CalcBlockViewProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [reorderId, setReorderId] = useState<string | null>(null);
  const activePreset = block.presets.find(p => p.id === block.activePresetId);

  const movePreset = (presetId: string, dir: -1 | 1) => {
    const idx = block.presets.findIndex(p => p.id === presetId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= block.presets.length) return;
    const next = [...block.presets];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onUpdatePresets(next);
    // Тот, кто оказался на первом месте — автоматически становится выбранным
    if (next[0].id !== block.activePresetId) {
      onSelectPreset(next[0].id);
    }
  };

  const effectiveMainQty = mainQty ?? getDefaultMainQty(block, area, perimeter);
  const blockTotal = activePreset ? calcPresetTotal(activePreset, effectiveMainQty, optQtys) : 0;

  const bindLabel = block.bindTo === 'area' ? 'S:' : block.bindTo === 'perimeter' ? 'P:' : 'Кол:';
  const bindUnit = block.bindTo === 'area' ? 'м²' : block.bindTo === 'perimeter' ? 'м.п.' : 'шт';

  return (
    <View style={{
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      {/* Header */}
      <Pressable onPress={onToggleExpanded} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, gap: 10 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: 'rgba(10,132,255,0.14)',
            borderWidth: 1, borderColor: 'rgba(10,132,255,0.30)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <BlockIcon name={block.icon} size={16} color={COLORS.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.ink, letterSpacing: 1.2 }} numberOfLines={1}>
              {block.title}
            </Text>
            {activePreset && blockTotal > 0 && (
              <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.accent, marginTop: 1 }} numberOfLines={1}>
                {activePreset.name}
              </Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {blockTotal > 0 && (
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.ink }}>{fmt(blockTotal)} ₽</Text>
          )}
          {onDuplicate && (
            <Pressable
              onPress={onDuplicate}
              style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: COLORS.accentSoft,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={14} color={COLORS.accent} strokeWidth={2.5} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              onLongPress={onDelete}
              style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: '#F1D7D3',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: COLORS.danger, fontSize: 14, fontWeight: '800', lineHeight: 15 }}>×</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowEditor(true)}
            style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: COLORS.surface2,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <PencilIcon size={14} color={COLORS.ink} />
          </Pressable>
          <Text style={{ color: COLORS.subtle, fontSize: 9 }}>{block.expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {block.expanded && activePreset && (
        <View className="border-t border-border">
          {/* Preset buttons (long-press → reorder mode) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1.5" contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
            {block.presets.map((p, i) => {
              const isActive = p.id === block.activePresetId;
              const isReorder = reorderId === p.id;
              return (
                <View key={p.id} className="flex-row items-center">
                  {isReorder && (
                    <Pressable
                      onPress={() => movePreset(p.id, -1)}
                      disabled={i === 0}
                      style={{
                        paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6,
                        backgroundColor: i === 0 ? '#f0f0ee' : '#eeeeff',
                        marginRight: 4,
                      }}
                    >
                      <Text style={{ color: i === 0 ? '#6B7290' : '#0A84FF', fontSize: 12, fontWeight: '900' }}>‹</Text>
                    </Pressable>
                  )}
                  <Touchable
                    haptic={isReorder ? 'medium' : 'selection'}
                    scale={0.96}
                    onPress={() => isReorder ? setReorderId(null) : onSelectPreset(p.id)}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setReorderId(isReorder ? null : p.id);
                    }}
                    delayLongPress={350}
                    className={`px-3.5 py-1.5 rounded-lg border ${
                      isReorder ? 'bg-amber-100 border-amber-400'
                        : isActive ? 'bg-navy border-navy' : 'bg-white border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${
                      isReorder ? 'text-amber-700'
                        : isActive ? 'text-white' : 'text-muted'
                    }`}>{p.name}</Text>
                  </Touchable>
                  {isReorder && (
                    <Pressable
                      onPress={() => movePreset(p.id, 1)}
                      disabled={i === block.presets.length - 1}
                      style={{
                        paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6,
                        backgroundColor: i === block.presets.length - 1 ? '#f0f0ee' : '#eeeeff',
                        marginLeft: 4,
                      }}
                    >
                      <Text style={{
                        color: i === block.presets.length - 1 ? '#6B7290' : '#0A84FF',
                        fontSize: 12, fontWeight: '900',
                      }}>›</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Main qty + (опционально) чекбокс «Применять ко всем» справа */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 12, paddingVertical: 8, gap: 6,
            backgroundColor: COLORS.glass,
            borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border,
          }}>
            <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: '700' }}>{bindLabel}</Text>
            <QtyCell value={effectiveMainQty} onChange={onChangeMainQty} />
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>{bindUnit}</Text>

            {(onToggleSyncToProject || onToggleSubtractFromMain) && (
              <>
                <View style={{ flex: 1 }} />
                {onToggleSyncToProject && (
                  <CheckboxRow
                    label="Применять ко всем"
                    checked={!!isSyncedToProject}
                    onToggle={() => onToggleSyncToProject(!isSyncedToProject)}
                  />
                )}
                {onToggleSubtractFromMain && (
                  <CheckboxRow
                    label="Вычесть от осн. профиля"
                    checked={!!isSubtractFromMain}
                    onToggle={() => onToggleSubtractFromMain(!isSubtractFromMain)}
                  />
                )}
              </>
            )}
          </View>

          {/* Two columns */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4 }}>
            {/* LEFT — Items */}
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.6, marginBottom: 6 }}>ПОЗИЦИИ</Text>
              {activePreset.items.map(ref => {
                const nom = getNom(ref.nomId);
                if (!nom) return null;
                const price = getNomPrice(ref);
                const total = ref.enabled ? effectiveMainQty * price : 0;
                return (
                  <View key={ref.nomId} style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 8,
                    borderBottomWidth: 1, borderBottomColor: COLORS.border,
                    opacity: ref.enabled ? 1 : 0.4,
                  }}>
                    <Toggle
                      value={ref.enabled}
                      onValueChange={() => onToggleNom('items', ref.nomId)}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{nom.name}</Text>
                      <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 1 }}>{fmt(price)}×{fmt(effectiveMainQty)}</Text>
                    </View>
                    <Text style={{ color: COLORS.accent, fontSize: 12, fontWeight: '700' }}>{fmt(total)}</Text>
                  </View>
                );
              })}
            </View>

            {/* RIGHT — Options */}
            {activePreset.options.length > 0 && (
              <View style={{ flex: 1, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: COLORS.border }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.6, marginBottom: 6 }}>ОПЦИИ</Text>
                {activePreset.options.map(ref => {
                  const nom = getNom(ref.nomId);
                  if (!nom) return null;
                  const price = getNomPrice(ref);
                  const qty = optQtys[ref.nomId] ?? 0;
                  const total = ref.enabled ? qty * price : 0;
                  return (
                    <View key={ref.nomId} style={{
                      flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 6,
                      borderBottomWidth: 1, borderBottomColor: COLORS.border,
                      opacity: ref.enabled ? 1 : 0.4,
                    }}>
                      <Toggle
                        value={ref.enabled}
                        onValueChange={() => onToggleNom('options', ref.nomId)}
                      />
                      <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{nom.name}</Text>
                      <QtyCell value={qty} onChange={v => onChangeOptQty(ref.nomId, v)} small />
                      <Text style={{ color: COLORS.accent, fontSize: 12, fontWeight: '700', marginLeft: 4, width: 48, textAlign: 'right' }}>{fmt(total)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {block.expanded && block.presets.length === 0 && (
        <View className="px-3 py-4 items-center border-t border-border">
          <Pressable onPress={() => setShowEditor(true)} className="bg-navy px-4 py-2 rounded-lg">
            <Text className="text-white text-xs font-semibold">+ Добавить пресет</Text>
          </Pressable>
        </View>
      )}

      <PresetEditorModal visible={showEditor} block={block} onClose={() => setShowEditor(false)} onSave={onUpdatePresets} />
    </View>
  );
}
