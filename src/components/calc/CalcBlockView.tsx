import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { CalcBlock, Preset, NomRef } from '../../data/calcBlocks';
import { getNom, getNomPrice, calcPresetTotal, getDefaultMainQty, getAllNoms } from '../../data/calcBlocks';
import type { NomItem } from '../../data/nomenclature';
import { fmt } from '../../utils/geometry';
import { useApp } from '../../store/AppContext';

// ─── Checkbox row (label + box) ─────────────────────────────────────
function CheckboxRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-center gap-1.5 ml-2" hitSlop={6}>
      <Text style={{
        fontSize: 10, fontWeight: '600',
        color: checked ? '#4F46E5' : '#6b6b7a',
      }}>
        {label}
      </Text>
      <View style={{
        width: 16, height: 16, borderRadius: 4,
        borderWidth: 1.5,
        borderColor: checked ? '#4F46E5' : '#b0b0ba',
        backgroundColor: checked ? '#4F46E5' : 'transparent',
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
const PencilIcon = ({ size = 18, color = '#4F46E5' }: { size?: number; color?: string }) => (
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
        style={{ width: small ? 40 : 50, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: '#4F46E5', borderRadius: 6, backgroundColor: '#f7f7f5', fontSize: 11, textAlign: 'center', color: '#1e2030' }}
      />
    );
  }
  return (
    <Pressable
      onPress={() => { setTmp(value === 0 ? '' : String(value)); setEditing(true); }}
      style={{ width: small ? 40 : 50, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: '#e8e8e4', borderRadius: 6, backgroundColor: '#f7f7f5', alignItems: 'center' }}
    >
      <Text style={{ fontSize: 11, color: '#1e2030', fontWeight: '600' }}>{value > 0 ? fmt(value) : '—'}</Text>
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
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-border">
            <Text className="text-lg font-bold text-navy flex-1">Пресеты блока</Text>
            <Pressable onPress={() => { onSave(presets); onClose(); }} className="px-3 py-2">
              <Text className="text-accent text-base font-semibold">Готово</Text>
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
                      <Text className="text-navy font-bold text-sm">{preset.name}</Text>
                      <Text className="text-muted text-[10px] mt-0.5" numberOfLines={1}>{itemNames}</Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <Pressable onPress={() => setEditingPreset({ ...preset })} className="px-2 py-1">
                        <Text className="text-accent text-xs font-semibold">Ред.</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => Alert.alert('Убрать из проекта?', 'Пресет останется в библиотеке.', [
                          { text: 'Отмена', style: 'cancel' },
                          { text: 'Убрать', style: 'destructive', onPress: () => setPresets(p => p.filter(x => x.id !== preset.id)) },
                        ])}
                        className="w-9 h-9 rounded-full bg-red-50 items-center justify-center"
                      >
                        <Text className="text-red-400 text-base">−</Text>
                      </Pressable>
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
                        <Text className="text-navy font-semibold text-sm">{t.name}</Text>
                        {itemNames ? (
                          <Text className="text-muted text-[10px] mt-0.5" numberOfLines={1}>{itemNames}</Text>
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
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-border">
          <Text className="text-base font-bold text-navy">Редактирование кнопки</Text>
          <Pressable onPress={onCancel} className="w-10 h-10 items-center justify-center">
            <Text className="text-red-400 text-xl">✕</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Название кнопки"
            placeholderTextColor="#b0b0ba"
            className="bg-bg border border-border rounded-xl px-3 py-2.5 text-navy text-sm mb-3"
          />

          {/* ITEMS */}
          <Text className="text-xs font-bold text-accent tracking-widest mb-1">НОМЕНКЛАТУРЫ</Text>
          <TextInput
            value={searchItems}
            onChangeText={setSearchItems}
            placeholder="🔍 Поиск..."
            placeholderTextColor="#b0b0ba"
            className="bg-bg border border-border rounded-lg px-2 py-1.5 text-navy text-[11px] mb-1"
          />
          {filteredNoms.slice(0, 15).map(nom => (
            <Pressable
              key={nom.id}
              onPress={() => toggleItem(nom.id)}
              className="flex-row items-center justify-between py-1.5 border-b border-border"
            >
              <View className="flex-row items-center gap-1.5 flex-1 mr-1">
                <Switch
                  value={itemIds.has(nom.id)}
                  onValueChange={() => toggleItem(nom.id)}
                  trackColor={{ false: '#e8e8e4', true: '#4F46E5' }}
                  style={{ transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] }}
                />
                <Text className="text-navy text-[11px] flex-1" numberOfLines={1}>{nom.name}</Text>
              </View>
              <Text className="text-orange-500 text-[11px] font-bold">{fmt(nom.price)}</Text>
            </Pressable>
          ))}

          <View className="h-3" />

          {/* OPTIONS */}
          <Text className="text-xs font-bold text-green-600 tracking-widest mb-1">ОПЦИИ</Text>
          <TextInput
            value={searchOpts}
            onChangeText={setSearchOpts}
            placeholder="🔍 Поиск..."
            placeholderTextColor="#b0b0ba"
            className="bg-bg border border-border rounded-lg px-2 py-1.5 text-navy text-[11px] mb-1"
          />
          {filteredOpts.slice(0, 15).map(nom => (
            <Pressable
              key={`o-${nom.id}`}
              onPress={() => toggleOpt(nom.id)}
              className="flex-row items-center justify-between py-1.5 border-b border-border"
            >
              <View className="flex-row items-center gap-1.5 flex-1 mr-1">
                <Switch
                  value={optIds.has(nom.id)}
                  onValueChange={() => toggleOpt(nom.id)}
                  trackColor={{ false: '#e8e8e4', true: '#22c55e' }}
                  style={{ transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] }}
                />
                <Text className="text-navy text-[11px] flex-1" numberOfLines={1}>{nom.name}</Text>
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
    <View className="bg-card rounded-2xl border border-border overflow-hidden mb-3">
      {/* Header */}
      <Pressable onPress={onToggleExpanded} className="flex-row items-center justify-between px-3 py-2.5">
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <Text className="text-sm">{block.icon}</Text>
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-navy tracking-wider" numberOfLines={1}>
              {block.title}
            </Text>
            {activePreset && blockTotal > 0 && (
              <Text className="text-xs font-semibold text-accent" numberOfLines={1}>
                ({activePreset.name})
              </Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-bold text-accent">{fmt(blockTotal)} ₽</Text>
          {onDuplicate && (
            <Pressable
              onPress={onDuplicate}
              style={{
                width: 26, height: 26, borderRadius: 6,
                backgroundColor: '#eeeeff',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#4F46E5', fontSize: 16, fontWeight: '800', lineHeight: 18 }}>+</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              onLongPress={onDelete}
              style={{
                width: 26, height: 26, borderRadius: 6,
                backgroundColor: '#fee2e2',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '800', lineHeight: 14 }}>×</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowEditor(true)}
            style={{
              width: 26, height: 26, borderRadius: 6,
              backgroundColor: '#eeeeff',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <PencilIcon size={14} />
          </Pressable>
          <Text className="text-muted" style={{ fontSize: 8, opacity: 0.5 }}>{block.expanded ? '▲' : '▼'}</Text>
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
                      <Text style={{ color: i === 0 ? '#b0b0ba' : '#4F46E5', fontSize: 12, fontWeight: '900' }}>‹</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => isReorder ? setReorderId(null) : onSelectPreset(p.id)}
                    onLongPress={() => setReorderId(isReorder ? null : p.id)}
                    delayLongPress={350}
                    className={`px-3 py-1 rounded-lg border ${
                      isReorder ? 'bg-amber-100 border-amber-400'
                        : isActive ? 'bg-navy border-navy' : 'bg-white border-border'
                    }`}
                  >
                    <Text className={`text-[10px] font-semibold ${
                      isReorder ? 'text-amber-700'
                        : isActive ? 'text-white' : 'text-muted'
                    }`}>{p.name}</Text>
                  </Pressable>
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
                        color: i === block.presets.length - 1 ? '#b0b0ba' : '#4F46E5',
                        fontSize: 12, fontWeight: '900',
                      }}>›</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Main qty + (опционально) чекбокс «Применять ко всем» справа */}
          <View className="flex-row items-center px-3 py-1 bg-bg/50 gap-1">
            <Text className="text-muted text-[10px]">{bindLabel}</Text>
            <QtyCell value={effectiveMainQty} onChange={onChangeMainQty} />
            <Text className="text-muted text-xs">{bindUnit}</Text>

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
          <View className="flex-row px-3 pb-2 pt-1">
            {/* LEFT — Items */}
            <View className="flex-1 pr-1">
              <Text className="text-[11px] font-bold text-accent tracking-widest mb-0.5">ПОЗИЦИИ</Text>
              {activePreset.items.map(ref => {
                const nom = getNom(ref.nomId);
                if (!nom) return null;
                const price = getNomPrice(ref);
                const total = ref.enabled ? effectiveMainQty * price : 0;
                return (
                  <View key={ref.nomId} className={`flex-row items-center py-1 border-b border-border ${!ref.enabled ? 'opacity-30' : ''}`}>
                    <Switch
                      value={ref.enabled}
                      onValueChange={() => onToggleNom('items', ref.nomId)}
                      trackColor={{ false: '#e8e8e4', true: '#4F46E5' }}
                      style={{ transform: [{ scaleX: 0.5 }, { scaleY: 0.5 }], marginRight: -4 }}
                    />
                    <View className="flex-1 mr-1">
                      <Text className="text-navy text-xs" numberOfLines={1}>{nom.name}</Text>
                      <Text className="text-muted text-[11px]">{fmt(price)}×{fmt(effectiveMainQty)}</Text>
                    </View>
                    <Text className="text-accent text-xs font-bold">{fmt(total)}</Text>
                  </View>
                );
              })}
            </View>

            {/* RIGHT — Options */}
            {activePreset.options.length > 0 && (
              <View className="flex-1 pl-1 border-l border-border">
                <Text className="text-[11px] font-bold text-green-600 tracking-widest mb-0.5">ОПЦИИ</Text>
                {activePreset.options.map(ref => {
                  const nom = getNom(ref.nomId);
                  if (!nom) return null;
                  const price = getNomPrice(ref);
                  const qty = optQtys[ref.nomId] ?? 0;
                  const total = ref.enabled ? qty * price : 0;
                  return (
                    <View key={ref.nomId} className={`flex-row items-center py-1 border-b border-border ${!ref.enabled ? 'opacity-30' : ''}`}>
                      <Switch
                        value={ref.enabled}
                        onValueChange={() => onToggleNom('options', ref.nomId)}
                        trackColor={{ false: '#e8e8e4', true: '#22c55e' }}
                        style={{ transform: [{ scaleX: 0.5 }, { scaleY: 0.5 }], marginRight: -4 }}
                      />
                      <Text className="text-navy text-xs flex-1" numberOfLines={1}>{nom.name}</Text>
                      <QtyCell value={qty} onChange={v => onChangeOptQty(ref.nomId, v)} small />
                      <Text className="text-green-600 text-xs font-bold ml-1 w-12 text-right">{fmt(total)}</Text>
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
