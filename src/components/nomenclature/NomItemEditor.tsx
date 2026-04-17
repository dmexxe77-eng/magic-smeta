import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { FormField, Button } from '../ui';
import type { NomItem, NomFolder, NomType } from '../../types';

const TYPES: { id: NomType; label: string }[] = [
  { id: 'canvas', label: 'Полотно' },
  { id: 'profile', label: 'Материал' },
  { id: 'work', label: 'Монтаж' },
  { id: 'option', label: 'Опция' },
  { id: 'light', label: 'Свет' },
];

const UNITS = ['м²', 'м.п.', 'шт'];

interface NomItemEditorProps {
  visible: boolean;
  nom: NomItem;
  folders: NomFolder[];
  isNew: boolean;
  onSave: (nom: NomItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NomItemEditor({
  visible,
  nom,
  folders,
  isNew,
  onSave,
  onDelete,
  onClose,
}: NomItemEditorProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(nom.name);
  const [price, setPrice] = useState(nom.price.toString());
  const [purchasePrice, setPurchasePrice] = useState((nom.purchasePrice || 0).toString());
  const [type, setType] = useState<NomType>(nom.type);
  const [unit, setUnit] = useState(nom.unit);
  const [image, setImage] = useState(nom.image || '');
  const [brand, setBrand] = useState(nom.brand || '');

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к фотобиблиотеке в настройках');
        return;
      }
      // Small delay to avoid modal-on-modal crash on iOS
      await new Promise(r => setTimeout(r, 300));
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        setImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('ImagePicker error:', e);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Ошибка', 'Введите название позиции');
      return;
    }
    onSave({
      ...nom,
      name: name.trim(),
      price: parseFloat(price) || 0,
      purchasePrice: parseFloat(purchasePrice) || 0,
      type,
      unit,
      image: image || undefined,
      brand: brand || undefined,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Удалить позицию',
      `Удалить «${nom.name}»?`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => onDelete(nom.id) },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-4 pb-3 border-b border-border"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable onPress={onClose}>
            <Text className="text-muted text-base">Отмена</Text>
          </Pressable>
          <Text className="text-navy font-bold text-base">
            {isNew ? 'Новая позиция' : 'Редактирование'}
          </Text>
          <Pressable onPress={handleSave}>
            <Text className="text-accent font-bold text-base">Сохранить</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Image */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Pressable
              onPress={handlePickImage}
              style={{
                width: 100, height: 100, borderRadius: 16,
                backgroundColor: '#f7f7f5', borderWidth: 2,
                borderStyle: image ? 'solid' : 'dashed',
                borderColor: image ? '#4F46E5' : '#e8e8e4',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {image ? (
                <Image source={{ uri: image }} style={{ width: 100, height: 100 }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>📷</Text>
                  <Text style={{ color: '#6b6b7a', fontSize: 10 }}>Добавить фото</Text>
                </View>
              )}
            </Pressable>
            {image ? (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Pressable onPress={handlePickImage}>
                  <Text style={{ color: '#4F46E5', fontSize: 12, fontWeight: '600' }}>Изменить</Text>
                </Pressable>
                <Pressable onPress={() => setImage('')}>
                  <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>Удалить</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Name */}
          <FormField
            label="Название"
            value={name}
            onChangeText={setName}
            placeholder="Название позиции"
          />

          {/* Type */}
          <View className="mb-3">
            <Text className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Тип
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TYPES.map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setType(t.id)}
                  className={`px-3 py-2 rounded-xl border ${
                    type === t.id ? 'bg-navy border-navy' : 'bg-bg border-border'
                  }`}
                >
                  <Text className={`text-xs font-bold ${
                    type === t.id ? 'text-white' : 'text-navy'
                  }`}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Price */}
          <FormField
            label="Цена"
            value={price}
            onChangeText={setPrice}
            placeholder="0"
            keyboardType="numeric"
          />

          {/* Purchase price */}
          <FormField
            label="Цена закупа"
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            placeholder="0"
            keyboardType="numeric"
          />

          {/* Unit */}
          <View className="mb-3">
            <Text className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Единица измерения
            </Text>
            <View className="flex-row gap-2">
              {UNITS.map(u => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  className={`px-4 py-2 rounded-xl border ${
                    unit === u ? 'bg-navy border-navy' : 'bg-bg border-border'
                  }`}
                >
                  <Text className={`text-sm font-bold ${
                    unit === u ? 'text-white' : 'text-navy'
                  }`}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Folder */}
          {isNew && (
            <View className="mb-3">
              <Text className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
                Папка
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {folders.filter(f => !f.isDefault).map(f => (
                    <Pressable
                      key={f.id}
                      onPress={() => setBrand(f.id)}
                      className={`px-3 py-2 rounded-xl border ${
                        brand === f.id ? 'bg-accent border-accent' : 'bg-bg border-border'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${
                        brand === f.id ? 'text-white' : 'text-navy'
                      }`}>
                        {f.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Delete */}
          {!isNew && (
            <View className="mt-4 mb-8">
              <Button
                label="Удалить позицию"
                variant="danger"
                onPress={handleDelete}
                size="md"
              />
            </View>
          )}

          <View className="h-20" />
        </ScrollView>
      </View>
    </Modal>
  );
}
