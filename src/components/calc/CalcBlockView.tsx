import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import type { CalcBlock, Preset, NomLine } from '../../data/calcBlocks';
import { getDefaultQty } from '../../data/calcBlocks';
import { fmt } from '../../utils/geometry';

// ─── Nom Line Row ───────────────────────────────────────────────────

function NomRow({
  nom,
  qty,
  onToggle,
  onChangeQty,
  onChangePrice,
}: {
  nom: NomLine;
  qty: number;
  onToggle: () => void;
  onChangeQty: (v: number) => void;
  onChangePrice: (v: number) => void;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [tmpVal, setTmpVal] = useState('');
  const total = nom.enabled ? qty * nom.price : 0;

  return (
    <View className={`flex-row items-center py-2 border-b border-border ${!nom.enabled ? 'opacity-40' : ''}`}>
      {/* Toggle */}
      <Pressable onPress={onToggle} className="mr-2">
        <View className={`w-5 h-5 rounded border ${nom.enabled ? 'bg-accent border-accent' : 'bg-white border-border'} items-center justify-center`}>
          {nom.enabled && <Text className="text-white text-[10px] font-bold">✓</Text>}
        </View>
      </Pressable>

      {/* Name */}
      <Text className="text-navy text-xs flex-1 mr-2" numberOfLines={1}>{nom.name}</Text>

      {/* Qty */}
      {editingQty ? (
        <TextInput
          value={tmpVal}
          onChangeText={setTmpVal}
          keyboardType="decimal-pad"
          autoFocus
          onBlur={() => { onChangeQty(parseFloat(tmpVal.replace(',', '.')) || 0); setEditingQty(false); }}
          onSubmitEditing={() => { onChangeQty(parseFloat(tmpVal.replace(',', '.')) || 0); setEditingQty(false); }}
          className="bg-bg border border-accent rounded px-1 py-0.5 text-navy text-[10px] text-center w-14"
        />
      ) : (
        <Pressable onPress={() => { setTmpVal(String(qty)); setEditingQty(true); }} className="bg-bg border border-border rounded px-1 py-0.5 w-14 items-center">
          <Text className="text-navy text-[10px]">{fmt(qty)}</Text>
        </Pressable>
      )}

      <Text className="text-muted text-[9px] mx-1">{nom.unit}</Text>
      <Text className="text-muted text-[9px]">×</Text>

      {/* Price */}
      {editingPrice ? (
        <TextInput
          value={tmpVal}
          onChangeText={setTmpVal}
          keyboardType="decimal-pad"
          autoFocus
          onBlur={() => { onChangePrice(parseFloat(tmpVal.replace(',', '.')) || 0); setEditingPrice(false); }}
          onSubmitEditing={() => { onChangePrice(parseFloat(tmpVal.replace(',', '.')) || 0); setEditingPrice(false); }}
          className="bg-bg border border-accent rounded px-1 py-0.5 text-navy text-[10px] text-center w-14 ml-1"
        />
      ) : (
        <Pressable onPress={() => { setTmpVal(String(nom.price)); setEditingPrice(true); }} className="bg-bg border border-border rounded px-1 py-0.5 w-14 items-center ml-1">
          <Text className="text-navy text-[10px]">{fmt(nom.price)}₽</Text>
        </Pressable>
      )}

      {/* Total */}
      <Text className="text-accent text-[10px] font-bold ml-2 w-16 text-right">
        {nom.enabled ? `${fmt(total)}₽` : '—'}
      </Text>
    </View>
  );
}

// ─── Preset Editor Modal ────────────────────────────────────────────

function PresetEditorModal({
  visible,
  block,
  onClose,
  onUpdate,
}: {
  visible: boolean;
  block: CalcBlock;
  onClose: () => void;
  onUpdate: (presets: Preset[]) => void;
}) {
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newNomName, setNewNomName] = useState('');
  const [newNomPrice, setNewNomPrice] = useState('');

  const handleDeletePreset = (presetId: string) => {
    Alert.alert('Удалить пресет?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => onUpdate(block.presets.filter(p => p.id !== presetId)),
      },
    ]);
  };

  const handleAddPreset = () => {
    if (!newPresetName.trim()) return;
    const id = `custom_${Date.now()}`;
    onUpdate([...block.presets, { id, name: newPresetName.trim(), noms: [] }]);
    setNewPresetName('');
  };

  const handleDeleteNom = (presetId: string, nomId: string) => {
    onUpdate(block.presets.map(p =>
      p.id === presetId ? { ...p, noms: p.noms.filter(n => n.id !== nomId) } : p
    ));
  };

  const handleAddNom = (presetId: string) => {
    if (!newNomName.trim()) return;
    const nom: NomLine = {
      id: `nom_${Date.now()}`,
      name: newNomName.trim(),
      price: parseFloat(newNomPrice.replace(',', '.')) || 0,
      unit: 'шт',
      bindTo: 'qty',
      enabled: true,
    };
    onUpdate(block.presets.map(p =>
      p.id === presetId ? { ...p, noms: [...p.noms, nom] } : p
    ));
    setNewNomName('');
    setNewNomPrice('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-border">
          <Text className="text-lg font-bold text-navy">{block.icon} {block.title}</Text>
          <Pressable onPress={onClose}>
            <Text className="text-accent text-base font-semibold">Готово</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {block.presets.map(preset => (
            <View key={preset.id} className="mb-4 bg-bg rounded-xl border border-border overflow-hidden">
              {/* Preset header */}
              <Pressable
                onPress={() => setExpandedPreset(expandedPreset === preset.id ? null : preset.id)}
                className="flex-row items-center justify-between p-3"
              >
                <View className="flex-row items-center gap-2 flex-1">
                  <Text className="text-navy text-sm font-bold">{preset.name}</Text>
                  <Text className="text-muted text-xs">{preset.noms.length} поз.</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={() => handleDeletePreset(preset.id)} className="w-7 h-7 rounded-full bg-red-50 items-center justify-center">
                    <Text className="text-red-400 text-xs">✕</Text>
                  </Pressable>
                  <Text className="text-muted text-xs">{expandedPreset === preset.id ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {/* Expanded noms */}
              {expandedPreset === preset.id && (
                <View className="px-3 pb-3 border-t border-border">
                  {preset.noms.map(nom => (
                    <View key={nom.id} className="flex-row items-center justify-between py-2 border-b border-border">
                      <View className="flex-1 mr-2">
                        <Text className="text-navy text-xs">{nom.name}</Text>
                        <Text className="text-muted text-[10px]">{fmt(nom.price)} ₽/{nom.unit}</Text>
                      </View>
                      <Pressable onPress={() => handleDeleteNom(preset.id, nom.id)} className="px-2 py-1">
                        <Text className="text-red-400 text-xs">✕</Text>
                      </Pressable>
                    </View>
                  ))}

                  {/* Add nom */}
                  <View className="flex-row gap-2 mt-2">
                    <TextInput
                      value={newNomName}
                      onChangeText={setNewNomName}
                      placeholder="Название"
                      placeholderTextColor="#b0b0ba"
                      className="flex-1 bg-white border border-border rounded-lg px-2 py-1.5 text-navy text-xs"
                    />
                    <TextInput
                      value={newNomPrice}
                      onChangeText={setNewNomPrice}
                      placeholder="Цена"
                      placeholderTextColor="#b0b0ba"
                      keyboardType="decimal-pad"
                      className="w-16 bg-white border border-border rounded-lg px-2 py-1.5 text-navy text-xs"
                    />
                    <Pressable onPress={() => handleAddNom(preset.id)} className="bg-accent px-3 py-1.5 rounded-lg">
                      <Text className="text-white text-xs font-bold">+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Add preset */}
          <View className="flex-row gap-2">
            <TextInput
              value={newPresetName}
              onChangeText={setNewPresetName}
              placeholder="Новый пресет..."
              placeholderTextColor="#b0b0ba"
              className="flex-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-navy text-sm"
            />
            <Pressable onPress={handleAddPreset} className="bg-navy px-4 py-2.5 rounded-xl">
              <Text className="text-white text-sm font-bold">+</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main CalcBlockView ─────────────────────────────────────────────

interface CalcBlockViewProps {
  block: CalcBlock;
  area: number;
  perimeter: number;
  qtyOverrides: Record<string, number>;
  onToggleExpanded: () => void;
  onSelectPreset: (presetId: string) => void;
  onUpdatePresets: (presets: Preset[]) => void;
  onToggleNom: (presetId: string, nomId: string) => void;
  onChangeQty: (nomId: string, qty: number) => void;
  onChangePrice: (presetId: string, nomId: string, price: number) => void;
}

export default function CalcBlockView({
  block,
  area,
  perimeter,
  qtyOverrides,
  onToggleExpanded,
  onSelectPreset,
  onUpdatePresets,
  onToggleNom,
  onChangeQty,
  onChangePrice,
}: CalcBlockViewProps) {
  const [showEditor, setShowEditor] = useState(false);
  const activePreset = block.presets.find(p => p.id === block.activePresetId);

  // Calculate block total
  const blockTotal = activePreset
    ? activePreset.noms.reduce((sum, nom) => {
        if (!nom.enabled) return sum;
        const qty = qtyOverrides[nom.id] ?? getDefaultQty(nom, area, perimeter);
        return sum + qty * nom.price;
      }, 0)
    : 0;

  return (
    <View className="bg-card rounded-2xl border border-border overflow-hidden mb-3">
      {/* Block header */}
      <Pressable
        onPress={onToggleExpanded}
        className="flex-row items-center justify-between px-3 py-2.5"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-sm">{block.icon}</Text>
          <Text className="text-[10px] font-bold text-navy tracking-wider">{block.title}</Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-bold text-accent">{fmt(blockTotal)} ₽</Text>
          {/* Settings icon */}
          <Pressable onPress={() => setShowEditor(true)} className="px-1.5">
            <Text className="text-muted text-sm">≡</Text>
          </Pressable>
          <Text className="text-muted text-xs">{block.expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {block.expanded && (
        <View className="border-t border-border">
          {/* Preset buttons */}
          {block.presets.length > 0 && (
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
                    preset.id === block.activePresetId
                      ? 'bg-navy border-navy'
                      : 'bg-white border-border'
                  }`}
                >
                  <Text className={`text-[10px] font-semibold ${
                    preset.id === block.activePresetId ? 'text-white' : 'text-muted'
                  }`}>
                    {preset.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Active preset nomenclatures */}
          {activePreset && activePreset.noms.length > 0 && (
            <View className="px-3 pb-3">
              {activePreset.noms.map(nom => {
                const qty = qtyOverrides[nom.id] ?? getDefaultQty(nom, area, perimeter);
                return (
                  <NomRow
                    key={nom.id}
                    nom={nom}
                    qty={qty}
                    onToggle={() => onToggleNom(activePreset.id, nom.id)}
                    onChangeQty={v => onChangeQty(nom.id, v)}
                    onChangePrice={v => onChangePrice(activePreset.id, nom.id, v)}
                  />
                );
              })}
            </View>
          )}

          {/* Empty state for custom block */}
          {block.presets.length === 0 && (
            <View className="px-3 py-6 items-center">
              <Text className="text-muted text-xs mb-2">Пресетов нет</Text>
              <Pressable onPress={() => setShowEditor(true)} className="bg-navy px-4 py-2 rounded-lg">
                <Text className="text-white text-xs font-semibold">+ Добавить пресет</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Editor modal */}
      <PresetEditorModal
        visible={showEditor}
        block={block}
        onClose={() => setShowEditor(false)}
        onUpdate={presets => { onUpdatePresets(presets); }}
      />
    </View>
  );
}
