import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, Image, Alert, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { NomItem, NomFolder, NomType } from '../../types';

const TYPES: { id: NomType; label: string }[] = [
  { id: 'canvas', label: 'Полотно' },
  { id: 'profile', label: 'Материал' },
  { id: 'work', label: 'Работа' },
  { id: 'option', label: 'Опция' },
  { id: 'light', label: 'Свет' },
];
const UNITS = ['м²', 'м.п.', 'шт'];

interface Props {
  visible: boolean;
  nom: NomItem;
  folders: NomFolder[];
  isNew: boolean;
  onSave: (nom: NomItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NomItemEditor({ visible, nom, folders, isNew, onSave, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(nom.name);
  const [price, setPrice] = useState(nom.price?.toString() ?? '');
  const [purchasePrice, setPurchasePrice] = useState((nom.purchasePrice ?? '').toString());
  const [installerPrice, setInstallerPrice] = useState(((nom as any).installerPrice ?? '').toString());
  const [type, setType] = useState<NomType>(nom.type);
  const [unit, setUnit] = useState(nom.unit);
  const [image, setImage] = useState(nom.image || '');
  const [brand, setBrand] = useState(nom.brand || '');

  const isWork = type === 'work';

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      await new Promise(r => setTimeout(r, 300));
      const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (!r.canceled && r.assets?.[0]) setImage(r.assets[0].uri);
    } catch {}
  };

  const save = () => {
    if (!name.trim()) { Alert.alert('Ошибка', 'Введите название'); return; }
    onSave({
      ...nom,
      name: name.trim(),
      price: parseFloat(price.replace(',', '.')) || 0,
      purchasePrice: parseFloat(purchasePrice.replace(',', '.')) || undefined,
      installerPrice: parseFloat(installerPrice.replace(',', '.')) || undefined,
      type, unit,
      image: image || undefined,
      brand: brand || undefined,
    } as any);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-2 border-b border-border" style={{ paddingTop: insets.top + 6 }}>
          <Pressable onPress={onClose} className="px-2 py-1">
            <Text className="text-muted text-sm">Отмена</Text>
          </Pressable>
          <Text className="text-navy font-bold text-sm">{isNew ? 'Новая' : 'Редактирование'}</Text>
          <Pressable onPress={save} className="px-2 py-1">
            <Text className="text-accent font-bold text-sm">Сохранить</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-3" keyboardShouldPersistTaps="handled">
          {/* Name + image inline */}
          <View className="flex-row gap-3 mb-3">
            <Pressable
              onPress={pickImage}
              style={{
                width: 64, height: 64, borderRadius: 12,
                backgroundColor: '#f7f7f5',
                borderWidth: 1, borderStyle: image ? 'solid' : 'dashed',
                borderColor: image ? '#4F46E5' : '#e8e8e4',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {image
                ? <Image source={{ uri: image }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                : <Text style={{ fontSize: 18, color: '#9ca3af' }}>📷</Text>}
            </Pressable>
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-muted tracking-wider mb-1">НАЗВАНИЕ</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Название позиции"
                placeholderTextColor="#b0b0ba"
                className="bg-bg border border-border rounded-lg px-3 py-2 text-navy text-sm"
              />
              {image && (
                <Pressable onPress={() => setImage('')} className="mt-1">
                  <Text className="text-red-400 text-[10px]">удалить фото</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Type + Unit row */}
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-muted tracking-wider mb-1">ТИП</Text>
              <View className="flex-row flex-wrap gap-1">
                {TYPES.map(t => (
                  <Pressable
                    key={t.id} onPress={() => setType(t.id)}
                    style={{
                      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                      backgroundColor: type === t.id ? '#1e2030' : '#f7f7f5',
                      borderWidth: 1, borderColor: type === t.id ? '#1e2030' : '#e8e8e4',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: type === t.id ? '#fff' : '#6b6b7a' }}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-muted tracking-wider mb-1">ЕД.</Text>
              <View className="flex-row gap-1">
                {UNITS.map(u => (
                  <Pressable
                    key={u} onPress={() => setUnit(u)}
                    style={{
                      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                      backgroundColor: unit === u ? '#1e2030' : '#f7f7f5',
                      borderWidth: 1, borderColor: unit === u ? '#1e2030' : '#e8e8e4',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: unit === u ? '#fff' : '#6b6b7a' }}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Prices — три колонки */}
          <Text className="text-[10px] font-bold text-muted tracking-wider mb-1">ЦЕНЫ, ₽</Text>
          <View className="flex-row gap-2 mb-3">
            <PriceInput label="Клиент" value={price} onChangeText={setPrice} accent />
            <PriceInput label="Закупка" value={purchasePrice} onChangeText={setPurchasePrice} />
            <PriceInput
              label="Монтажник"
              value={installerPrice}
              onChangeText={setInstallerPrice}
              disabled={!isWork}
              hint={!isWork ? 'только для работ' : undefined}
            />
          </View>

          {/* Folder picker (только при создании) */}
          {isNew && folders.length > 0 && (
            <View className="mb-3">
              <Text className="text-[10px] font-bold text-muted tracking-wider mb-1">ПАПКА</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {folders.map(f => (
                  <Pressable
                    key={f.id} onPress={() => setBrand(f.id)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                      backgroundColor: brand === f.id ? '#4F46E5' : '#f7f7f5',
                      borderWidth: 1, borderColor: brand === f.id ? '#4F46E5' : '#e8e8e4',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: brand === f.id ? '#fff' : '#6b6b7a' }}>
                      {f.icon} {f.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Delete */}
          {!isNew && (
            <Pressable
              onPress={() => Alert.alert('Удалить', `Удалить «${nom.name}»?`, [
                { text: 'Отмена', style: 'cancel' },
                { text: 'Удалить', style: 'destructive', onPress: () => onDelete(nom.id) },
              ])}
              className="mt-4 py-2 items-center"
            >
              <Text className="text-red-400 text-sm font-semibold">Удалить позицию</Text>
            </Pressable>
          )}

          <View className="h-20" />
        </ScrollView>
      </View>
    </Modal>
  );
}

function PriceInput({ label, value, onChangeText, accent, disabled, hint }: {
  label: string; value: string; onChangeText: (v: string) => void;
  accent?: boolean; disabled?: boolean; hint?: string;
}) {
  return (
    <View className="flex-1">
      <Text style={{ fontSize: 9, color: accent ? '#4F46E5' : '#9ca3af', fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        editable={!disabled}
        value={value}
        onChangeText={onChangeText}
        placeholder="—"
        placeholderTextColor="#b0b0ba"
        keyboardType="decimal-pad"
        style={{
          backgroundColor: disabled ? '#f7f7f5' : '#fff',
          borderWidth: 1, borderColor: accent ? '#4F46E5' : '#e8e8e4',
          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
          fontSize: 14, fontWeight: '700',
          color: disabled ? '#b0b0ba' : '#1e2030',
        }}
      />
      {hint && <Text style={{ fontSize: 8, color: '#b0b0ba', marginTop: 1 }}>{hint}</Text>}
    </View>
  );
}
