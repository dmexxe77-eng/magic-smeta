import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../store/AppContext';
import { useNomenclature, getFolderId } from '../../hooks/useNomenclature';
import { generateId } from '../../utils/storage';
import { AppHeader, Badge, Button, EmptyState } from '../ui';
import { NomItemEditor } from '../nomenclature/NomItemEditor';
import { useResponsive } from '../../hooks/useResponsive';
import type { NomItem, NomFolder } from '../../types';

// ─── Type labels ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: 'accent' | 'green' | 'orange' | 'gray' }> = {
  canvas: { label: 'Полотно', color: 'accent' },
  profile: { label: 'Материал', color: 'orange' },
  work: { label: 'Монтаж', color: 'green' },
  option: { label: 'Опция', color: 'gray' },
  light: { label: 'Свет', color: 'orange' },
};

// ─── Nom Row ──────────────────────────────────────────────────────────

function NomRow({ item, onPress }: { item: NomItem; onPress: () => void }) {
  const tl = TYPE_LABELS[item.type] || TYPE_LABELS.option;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-card border border-border rounded-2xl mx-4 mb-2 px-3 py-3"
    >
      {/* Image */}
      <View style={{
        width: 50, height: 50, borderRadius: 12,
        backgroundColor: '#f7f7f5', borderWidth: 1, borderColor: '#e8e8e4',
        alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden',
      }}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={{ width: 50, height: 50 }} resizeMode="cover" />
        ) : (
          <Text style={{ color: '#6b6b7a', fontSize: 18 }}>📦</Text>
        )}
      </View>

      {/* Name + type */}
      <View className="flex-1 mr-2">
        <Text className="text-navy font-semibold text-sm" numberOfLines={1}>{item.name}</Text>
        <View className="flex-row items-center gap-2 mt-1">
          <Badge label={tl.label} color={tl.color} />
          <Text className="text-muted text-xs">{item.unit}</Text>
        </View>
      </View>

      {/* Prices */}
      <View className="items-end">
        <Text className="text-navy font-bold text-sm">{item.price} ₽</Text>
        {item.purchasePrice != null && item.purchasePrice > 0 && (
          <Text className="text-muted text-xs mt-0.5">закуп {item.purchasePrice} ₽</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function NomenclatureScreen() {
  const router = useRouter();
  const { dispatch } = useApp();
  const { allFolders, getItemsForFolder, searchNoms } = useNomenclature();
  const { containerStyle } = useResponsive();

  const [activeFolder, setActiveFolder] = useState(allFolders[0]?.id || '_polotna');
  const [search, setSearch] = useState('');
  const [editingNom, setEditingNom] = useState<NomItem | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Items for current view
  const items = search.trim()
    ? searchNoms(search)
    : getItemsForFolder(activeFolder);

  // Create new folder
  const handleNewFolder = () => {
    Alert.prompt(
      'Новая папка',
      'Введите название папки',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Создать',
          onPress: (name?: string) => {
            if (name?.trim()) {
              dispatch({
                type: 'ADD_NOM_FOLDER',
                folder: { id: generateId(), name: name.trim() },
              });
            }
          },
        },
      ],
      'plain-text',
    );
  };

  // Delete custom folder
  const handleDeleteFolder = (folder: NomFolder) => {
    if (folder.isDefault) return;
    Alert.alert(
      'Удалить папку',
      `Удалить «${folder.name}»? Позиции внутри не удалятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'DELETE_NOM_FOLDER', folderId: folder.id });
            if (activeFolder === folder.id) setActiveFolder(allFolders[0]?.id || '_polotna');
          },
        },
      ]
    );
  };

  // Open editor for new item
  const handleNewItem = () => {
    setEditingNom({
      id: generateId(),
      name: '',
      price: 0,
      purchasePrice: 0,
      unit: 'шт',
      type: 'profile',
      brand: activeFolder.startsWith('_') ? undefined : activeFolder,
    });
    setIsNew(true);
    setShowEditor(true);
  };

  // Open editor for existing item
  const handleEditItem = (nom: NomItem) => {
    setEditingNom({ ...nom });
    setIsNew(false);
    setShowEditor(true);
  };

  // Save item from editor
  const handleSaveItem = (nom: NomItem) => {
    if (isNew) {
      dispatch({ type: 'ADD_CUSTOM_NOM', nom });
    } else {
      dispatch({ type: 'UPDATE_NOM', id: nom.id, patch: nom });
    }
    setShowEditor(false);
    setEditingNom(null);
  };

  // Delete item from editor
  const handleDeleteItem = (id: string) => {
    dispatch({ type: 'DELETE_NOM', id });
    setShowEditor(false);
    setEditingNom(null);
  };

  const renderItem = useCallback(({ item }: { item: NomItem }) => (
    <NomRow item={item} onPress={() => handleEditItem(item)} />
  ), []);

  const keyExtractor = useCallback((item: NomItem) => item.id, []);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="НОМЕНКЛАТУРЫ"
        subtitle="РЕДАКТОР"
        onBack={() => router.back()}
      />

     <View style={[{ flex: 1 }, containerStyle]}>
      {/* Search */}
      <View className="mx-4 mt-3 mb-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="🔍  Поиск позиций..."
          placeholderTextColor="#b0b0ba"
          className="bg-card border border-border rounded-xl px-4 py-3 text-navy text-sm"
        />
      </View>

      {/* Folder strip */}
      {!search.trim() && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, marginBottom: 8 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
        >
          {allFolders.map(f => {
            const active = activeFolder === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setActiveFolder(f.id)}
                onLongPress={() => handleDeleteFolder(f)}
                style={{
                  paddingHorizontal: 14,
                  height: 34,
                  borderRadius: 17,
                  borderWidth: 1,
                  borderColor: active ? '#1e2030' : '#e8e8e4',
                  backgroundColor: active ? '#1e2030' : '#ffffff',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? '#ffffff' : '#1e2030',
                  }}
                  numberOfLines={1}
                >
                  {f.name}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={handleNewFolder}
            style={{
              paddingHorizontal: 14,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: '#4F46E5',
              backgroundColor: '#eeeeff',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#4F46E5' }}>+ Папка</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Пусто"
          desc={search ? 'Ничего не найдено' : 'В этой папке нет позиций'}
          action={
            !search ? (
              <Button label="+ Добавить позицию" onPress={handleNewItem} size="md" />
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View className="h-24" />}
        />
      )}

     </View>

      {/* FAB */}
      <Pressable
        onPress={handleNewItem}
        className="absolute bottom-8 self-center bg-accent px-8 py-4 rounded-full shadow-lg"
        style={{ elevation: 6 }}
      >
        <Text className="text-white font-bold text-base">+ Добавить</Text>
      </Pressable>

      {/* Item editor modal */}
      {showEditor && editingNom && (
        <NomItemEditor
          visible={showEditor}
          nom={editingNom}
          folders={allFolders}
          isNew={isNew}
          onSave={handleSaveItem}
          onDelete={handleDeleteItem}
          onClose={() => { setShowEditor(false); setEditingNom(null); }}
        />
      )}
    </View>
  );
}
