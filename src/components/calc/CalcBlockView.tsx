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
import type { CalcBlock, Preset, NomRef } from '../../data/calcBlocks';
import { getNom, getNomPrice, calcPresetTotal, getDefaultMainQty } from '../../data/calcBlocks';
import { ALL_NOMS, type NomItem } from '../../data/nomenclature';
import { fmt } from '../../utils/geometry';

// ─── Inline Qty Editor ──────────────────────────────────────────────

function QtyCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
        className="bg-bg border border-accent rounded px-1 py-0.5 text-navy text-[10px] text-center w-12"
      />
    );
  }
  return (
    <Pressable onPress={() => { setTmp(String(value)); setEditing(true); }} className="bg-bg border border-border rounded px-1 py-0.5 w-12 items-center">
      <Text className="text-navy text-[10px] font-semibold">{value > 0 ? fmt(value) : '—'}</Text>
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
  const [presets, setPresets] = useState<Preset[]>(block.presets);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  // ─── Preset list view ──────────────────────────────────────────

  if (!editingPreset) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-border">
            <Text className="text-lg font-bold text-navy">Избранные кнопки</Text>
            <Pressable onPress={() => { onSave(presets); onClose(); }}>
              <Text className="text-accent text-base font-semibold">Готово</Text>
            </Pressable>
          </View>
          <ScrollView className="flex-1 p-4">
            {presets.map((preset, idx) => {
              const itemNames = preset.items.map(r => getNom(r.nomId)?.name ?? r.nomId).join(' + ');
              return (
                <View key={preset.id} className="bg-bg rounded-xl border border-border p-3 mb-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-navy font-bold text-sm">{preset.name}</Text>
                      <Text className="text-muted text-[10px] mt-0.5" numberOfLines={1}>{itemNames}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Pressable onPress={() => setEditingPreset({ ...preset })}>
                        <Text className="text-accent text-xs font-semibold">Ред.</Text>
                      </Pressable>
                      <Pressable onPress={() => {
                        Alert.alert('Удалить?', '', [
                          { text: 'Отмена', style: 'cancel' },
                          { text: 'Удалить', style: 'destructive', onPress: () => setPresets(p => p.filter(x => x.id !== preset.id)) },
                        ]);
                      }}>
                        <Text className="text-red-400 text-lg">🗑</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            {/* Add new preset */}
            <Pressable
              onPress={() => {
                const newPreset: Preset = { id: `pr_new_${Date.now()}`, name: 'Новая кнопка', items: [], options: [] };
                setEditingPreset(newPreset);
              }}
              className="border-2 border-dashed border-border rounded-xl py-4 items-center"
            >
              <Text className="text-muted font-semibold">+ Создать новую кнопку</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ─── Preset edit view (search + select noms) ───────────────────

  return (
    <PresetEditView
      preset={editingPreset}
      onSave={(updated) => {
        setPresets(prev => {
          const exists = prev.find(p => p.id === updated.id);
          if (exists) return prev.map(p => p.id === updated.id ? updated : p);
          return [...prev, updated];
        });
        setEditingPreset(null);
      }}
      onCancel={() => setEditingPreset(null)}
    />
  );
}

// ─── Preset Edit View ───────────────────────────────────────────────

function PresetEditView({
  preset,
  onSave,
  onCancel,
}: {
  preset: Preset;
  onSave: (p: Preset) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(preset.name);
  const [items, setItems] = useState<NomRef[]>(preset.items);
  const [options, setOptions] = useState<NomRef[]>(preset.options);
  const [searchItems, setSearchItems] = useState('');
  const [searchOpts, setSearchOpts] = useState('');

  const itemIds = new Set(items.map(r => r.nomId));
  const optIds = new Set(options.map(r => r.nomId));

  const filteredNoms = useMemo(() => {
    if (!searchItems.trim()) return ALL_NOMS.slice(0, 20);
    const q = searchItems.toLowerCase();
    return ALL_NOMS.filter(n => n.name.toLowerCase().includes(q)).slice(0, 30);
  }, [searchItems]);

  const filteredOpts = useMemo(() => {
    if (!searchOpts.trim()) return ALL_NOMS.slice(0, 20);
    const q = searchOpts.toLowerCase();
    return ALL_NOMS.filter(n => n.name.toLowerCase().includes(q)).slice(0, 30);
  }, [searchOpts]);

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
          <Text className="text-lg font-bold text-navy">Редактирование кнопки</Text>
          <Pressable onPress={onCancel}>
            <Text className="text-red-400 text-base">✕</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-3">
          {/* Name */}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Название кнопки"
            placeholderTextColor="#b0b0ba"
            className="bg-bg border border-border rounded-xl px-3 py-2.5 text-navy text-sm mb-4"
          />

          {/* ITEMS (left side — номенклатуры) */}
          <Text className="text-[10px] font-bold text-accent tracking-widest mb-2">
            НОМЕНКЛАТУРЫ ({ALL_NOMS.length})
          </Text>
          <TextInput
            value={searchItems}
            onChangeText={setSearchItems}
            placeholder="Поиск..."
            placeholderTextColor="#b0b0ba"
            className="bg-bg border border-border rounded-lg px-3 py-2 text-navy text-xs mb-2"
          />
          <View className="mb-4">
            {filteredNoms.map(nom => (
              <Pressable
                key={nom.id}
                onPress={() => toggleItem(nom.id)}
                className="flex-row items-center justify-between py-2 border-b border-border"
              >
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <View className={`w-4 h-4 rounded border ${itemIds.has(nom.id) ? 'bg-accent border-accent' : 'border-border'} items-center justify-center`}>
                    {itemIds.has(nom.id) && <Text className="text-white text-[8px]">✓</Text>}
                  </View>
                  <View className="flex-1">
                    <Text className="text-navy text-xs" numberOfLines={1}>{nom.name}</Text>
                    <Text className="text-muted text-[9px]">{nom.unit} · {nom.category}</Text>
                  </View>
                </View>
                <Text className="text-orange-500 text-xs font-bold">{fmt(nom.price)}</Text>
              </Pressable>
            ))}
          </View>

          {/* OPTIONS (right side — опции) */}
          <Text className="text-[10px] font-bold text-green-600 tracking-widest mb-2">
            ОПЦИИ/ПОЗИЦИИ ({ALL_NOMS.length})
          </Text>
          <TextInput
            value={searchOpts}
            onChangeText={setSearchOpts}
            placeholder="Поиск опций..."
            placeholderTextColor="#b0b0ba"
            className="bg-bg border border-border rounded-lg px-3 py-2 text-navy text-xs mb-2"
          />
          <View className="mb-4">
            {filteredOpts.map(nom => (
              <Pressable
                key={`opt-${nom.id}`}
                onPress={() => toggleOpt(nom.id)}
                className="flex-row items-center justify-between py-2 border-b border-border"
              >
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <View className={`w-4 h-4 rounded border ${optIds.has(nom.id) ? 'bg-green-500 border-green-500' : 'border-border'} items-center justify-center`}>
                    {optIds.has(nom.id) && <Text className="text-white text-[8px]">✓</Text>}
                  </View>
                  <Text className="text-navy text-xs flex-1" numberOfLines={1}>{nom.name}</Text>
                </View>
                <Text className="text-orange-500 text-xs font-bold">{fmt(nom.price)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Save */}
        <View className="px-4 pb-8 pt-2 border-t border-border">
          <Pressable
            onPress={() => onSave({ ...preset, id: preset.id, name: name.trim() || 'Кнопка', items, options })}
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
  mainQty: number | undefined;        // override for main qty
  optQtys: Record<string, number>;     // option quantities
  onToggleExpanded: () => void;
  onSelectPreset: (presetId: string) => void;
  onUpdatePresets: (presets: Preset[]) => void;
  onToggleNom: (side: 'items' | 'options', nomId: string) => void;
  onChangeMainQty: (qty: number) => void;
  onChangeOptQty: (nomId: string, qty: number) => void;
}

export default function CalcBlockView({
  block,
  area,
  perimeter,
  mainQty,
  optQtys,
  onToggleExpanded,
  onSelectPreset,
  onUpdatePresets,
  onToggleNom,
  onChangeMainQty,
  onChangeOptQty,
}: CalcBlockViewProps) {
  const [showEditor, setShowEditor] = useState(false);
  const activePreset = block.presets.find(p => p.id === block.activePresetId);

  const effectiveMainQty = mainQty ?? getDefaultMainQty(block, area, perimeter);
  const blockTotal = activePreset ? calcPresetTotal(activePreset, effectiveMainQty, optQtys) : 0;

  const bindLabel = block.bindTo === 'area' ? 'S' : block.bindTo === 'perimeter' ? 'P' : 'Кол';
  const bindUnit = block.bindTo === 'area' ? 'м²' : block.bindTo === 'perimeter' ? 'м.п.' : 'шт';

  return (
    <View className="bg-card rounded-2xl border border-border overflow-hidden mb-3">
      {/* Block header */}
      <Pressable onPress={onToggleExpanded} className="flex-row items-center justify-between px-3 py-2.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm">{block.icon}</Text>
          <Text className="text-[10px] font-bold text-navy tracking-wider">{block.title}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-bold text-accent">{fmt(blockTotal)} ₽</Text>
          <Pressable onPress={() => setShowEditor(true)} className="px-1.5">
            <Text className="text-muted text-sm">≡</Text>
          </Pressable>
          <Text className="text-muted text-xs">{block.expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {block.expanded && activePreset && (
        <View className="border-t border-border">
          {/* Preset buttons */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="py-2"
            contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
          >
            {block.presets.map(preset => (
              <Pressable
                key={preset.id}
                onPress={() => onSelectPreset(preset.id)}
                className={`px-3 py-1.5 rounded-lg border ${
                  preset.id === block.activePresetId ? 'bg-navy border-navy' : 'bg-white border-border'
                }`}
              >
                <Text className={`text-[10px] font-semibold ${
                  preset.id === block.activePresetId ? 'text-white' : 'text-muted'
                }`}>{preset.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Main qty input */}
          <View className="flex-row items-center justify-between px-3 py-1.5 bg-bg/50">
            <Text className="text-muted text-[10px]">{bindLabel}:</Text>
            <View className="flex-row items-center gap-1">
              <QtyCell value={effectiveMainQty} onChange={onChangeMainQty} />
              <Text className="text-muted text-[9px]">{bindUnit}</Text>
            </View>
          </View>

          {/* Two columns: Items (left) | Options (right) */}
          <View className="flex-row px-3 pb-3 pt-1">
            {/* LEFT — Items (auto qty) */}
            <View className="flex-1 pr-2">
              <Text className="text-[8px] font-bold text-accent tracking-widest mb-1">ПОЗИЦИИ</Text>
              {activePreset.items.map(ref => {
                const nom = getNom(ref.nomId);
                if (!nom) return null;
                const price = getNomPrice(ref);
                const total = ref.enabled ? effectiveMainQty * price : 0;
                return (
                  <View key={ref.nomId} className={`flex-row items-center justify-between py-1.5 border-b border-border ${!ref.enabled ? 'opacity-30' : ''}`}>
                    <Pressable onPress={() => onToggleNom('items', ref.nomId)} className="mr-1">
                      <View className={`w-4 h-4 rounded border ${ref.enabled ? 'bg-accent border-accent' : 'border-border'} items-center justify-center`}>
                        {ref.enabled && <Text className="text-white text-[7px]">✓</Text>}
                      </View>
                    </Pressable>
                    <View className="flex-1 mr-1">
                      <Text className="text-navy text-[10px]" numberOfLines={1}>{nom.name}</Text>
                      <Text className="text-muted text-[8px]">{fmt(price)}×{fmt(effectiveMainQty)}</Text>
                    </View>
                    <Text className="text-accent text-[10px] font-bold">{fmt(total)}</Text>
                  </View>
                );
              })}
            </View>

            {/* RIGHT — Options (manual qty) */}
            {activePreset.options.length > 0 && (
              <View className="flex-1 pl-2 border-l border-border">
                <Text className="text-[8px] font-bold text-green-600 tracking-widest mb-1">ОПЦИИ</Text>
                {activePreset.options.map(ref => {
                  const nom = getNom(ref.nomId);
                  if (!nom) return null;
                  const price = getNomPrice(ref);
                  const qty = optQtys[ref.nomId] ?? 0;
                  const total = ref.enabled ? qty * price : 0;
                  return (
                    <View key={ref.nomId} className={`flex-row items-center justify-between py-1.5 border-b border-border ${!ref.enabled ? 'opacity-30' : ''}`}>
                      <Pressable onPress={() => onToggleNom('options', ref.nomId)} className="mr-1">
                        <View className={`w-4 h-4 rounded border ${ref.enabled ? 'bg-green-500 border-green-500' : 'border-border'} items-center justify-center`}>
                          {ref.enabled && <Text className="text-white text-[7px]">✓</Text>}
                        </View>
                      </Pressable>
                      <Text className="text-navy text-[10px] flex-1 mr-1" numberOfLines={1}>{nom.name}</Text>
                      <QtyCell value={qty} onChange={v => onChangeOptQty(ref.nomId, v)} />
                      <Text className="text-green-600 text-[10px] font-bold ml-1 w-14 text-right">{fmt(total)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Empty state */}
      {block.expanded && block.presets.length === 0 && (
        <View className="px-3 py-6 items-center border-t border-border">
          <Pressable onPress={() => setShowEditor(true)} className="bg-navy px-4 py-2 rounded-lg">
            <Text className="text-white text-xs font-semibold">+ Добавить пресет</Text>
          </Pressable>
        </View>
      )}

      {/* Editor modal */}
      <PresetEditorModal
        visible={showEditor}
        block={{ ...block, presets: block.presets }}
        onClose={() => setShowEditor(false)}
        onSave={presets => onUpdatePresets(presets)}
      />
    </View>
  );
}
