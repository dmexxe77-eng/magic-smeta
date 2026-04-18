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
import type { CalcBlock, Preset, NomRef } from '../../data/calcBlocks';
import { getNom, getNomPrice, calcPresetTotal, getDefaultMainQty, getAllNoms } from '../../data/calcBlocks';
import type { NomItem } from '../../data/nomenclature';
import { fmt } from '../../utils/geometry';

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
      onPress={() => { setTmp(String(value)); setEditing(true); }}
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
  const [presets, setPresets] = useState<Preset[]>(block.presets);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  if (!editingPreset) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-border">
            <Text className="text-lg font-bold text-navy flex-1">Избранные кнопки</Text>
            <Pressable onPress={() => { onSave(presets); onClose(); }} className="px-3 py-2">
              <Text className="text-accent text-base font-semibold">Готово</Text>
            </Pressable>
          </View>
          <ScrollView className="flex-1 p-4">
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
                        onPress={() => Alert.alert('Удалить?', '', [
                          { text: 'Отмена', style: 'cancel' },
                          { text: 'Удалить', style: 'destructive', onPress: () => setPresets(p => p.filter(x => x.id !== preset.id)) },
                        ])}
                        className="w-9 h-9 rounded-full bg-red-50 items-center justify-center"
                      >
                        <Text className="text-red-400 text-base">🗑</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            <Pressable
              onPress={() => setEditingPreset({ id: `pr_new_${Date.now()}`, name: '', items: [], options: [] })}
              className="border-2 border-dashed border-border rounded-xl py-4 items-center"
            >
              <Text className="text-muted font-semibold">+ Создать новую кнопку</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <PresetEditView
      preset={editingPreset}
      onSave={(updated) => {
        setPresets(prev => {
          const exists = prev.find(p => p.id === updated.id);
          return exists ? prev.map(p => p.id === updated.id ? updated : p) : [...prev, updated];
        });
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
          <Text className="text-[9px] font-bold text-accent tracking-widest mb-1">НОМЕНКЛАТУРЫ</Text>
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
          <Text className="text-[9px] font-bold text-green-600 tracking-widest mb-1">ОПЦИИ</Text>
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
}

export default function CalcBlockView({
  block, area, perimeter, mainQty, optQtys,
  onToggleExpanded, onSelectPreset, onUpdatePresets,
  onToggleNom, onChangeMainQty, onChangeOptQty,
}: CalcBlockViewProps) {
  const [showEditor, setShowEditor] = useState(false);
  const activePreset = block.presets.find(p => p.id === block.activePresetId);

  const effectiveMainQty = mainQty ?? getDefaultMainQty(block, area, perimeter);
  const blockTotal = activePreset ? calcPresetTotal(activePreset, effectiveMainQty, optQtys) : 0;

  const bindLabel = block.bindTo === 'area' ? 'S:' : block.bindTo === 'perimeter' ? 'P:' : 'Кол:';
  const bindUnit = block.bindTo === 'area' ? 'м²' : block.bindTo === 'perimeter' ? 'м.п.' : 'шт';

  return (
    <View className="bg-card rounded-2xl border border-border overflow-hidden mb-3">
      {/* Header */}
      <Pressable onPress={onToggleExpanded} className="flex-row items-center justify-between px-3 py-2.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm">{block.icon}</Text>
          <Text className="text-[10px] font-bold text-navy tracking-wider">{block.title}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-bold text-accent">{fmt(blockTotal)} ₽</Text>
          <Pressable onPress={() => setShowEditor(true)} className="px-1.5">
            <Text style={{ color: '#f59e0b', fontSize: 20 }}>★</Text>
          </Pressable>
          <Text className="text-muted" style={{ fontSize: 8, opacity: 0.5 }}>{block.expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {block.expanded && activePreset && (
        <View className="border-t border-border">
          {/* Preset buttons */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1.5" contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
            {block.presets.map(p => (
              <Pressable key={p.id} onPress={() => onSelectPreset(p.id)}
                className={`px-3 py-1 rounded-lg border ${p.id === block.activePresetId ? 'bg-navy border-navy' : 'bg-white border-border'}`}>
                <Text className={`text-[10px] font-semibold ${p.id === block.activePresetId ? 'text-white' : 'text-muted'}`}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Main qty */}
          <View className="flex-row items-center px-3 py-1 bg-bg/50 gap-1">
            <Text className="text-muted text-[10px]">{bindLabel}</Text>
            <QtyCell value={effectiveMainQty} onChange={onChangeMainQty} />
            <Text className="text-muted text-[9px]">{bindUnit}</Text>
          </View>

          {/* Two columns */}
          <View className="flex-row px-3 pb-2 pt-1">
            {/* LEFT — Items */}
            <View className="flex-1 pr-1">
              <Text className="text-[7px] font-bold text-accent tracking-widest mb-0.5">ПОЗИЦИИ</Text>
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
                      <Text className="text-navy text-[9px]" numberOfLines={1}>{nom.name}</Text>
                      <Text className="text-muted text-[8px]">{fmt(price)}×{fmt(effectiveMainQty)}</Text>
                    </View>
                    <Text className="text-accent text-[9px] font-bold">{fmt(total)}</Text>
                  </View>
                );
              })}
            </View>

            {/* RIGHT — Options */}
            {activePreset.options.length > 0 && (
              <View className="flex-1 pl-1 border-l border-border">
                <Text className="text-[7px] font-bold text-green-600 tracking-widest mb-0.5">ОПЦИИ</Text>
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
                      <Text className="text-navy text-[9px] flex-1" numberOfLines={1}>{nom.name}</Text>
                      <QtyCell value={qty} onChange={v => onChangeOptQty(ref.nomId, v)} small />
                      <Text className="text-green-600 text-[9px] font-bold ml-1 w-12 text-right">{fmt(total)}</Text>
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
