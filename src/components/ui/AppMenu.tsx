import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AppMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function AppMenu({ visible, onClose }: AppMenuProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as any), 100);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 10 }}>
        {/* Handle bar */}
        <View className="items-center mb-4">
          <View className="w-10 h-1 rounded-full bg-border" />
        </View>

        {/* Header */}
        <View className="flex-row items-center justify-between px-5 mb-6">
          <Text className="text-xl font-black text-navy">Меню</Text>
          <Pressable onPress={onClose} className="w-9 h-9 rounded-full bg-bg items-center justify-center">
            <Text className="text-muted text-lg">✕</Text>
          </Pressable>
        </View>

        {/* Menu items */}
        <View className="px-4 gap-2">
          <Pressable
            onPress={() => go('/nomenclature')}
            className="flex-row items-center bg-bg border border-border rounded-2xl px-4 py-4"
          >
            <View className="w-10 h-10 rounded-xl bg-accent-light items-center justify-center mr-3">
              <Text className="text-lg">📦</Text>
            </View>
            <View className="flex-1">
              <Text className="text-navy font-bold text-base">Номенклатуры</Text>
              <Text className="text-muted text-xs mt-0.5">Редактор каталога товаров и услуг</Text>
            </View>
            <Text className="text-muted text-lg">›</Text>
          </Pressable>

          <Pressable
            onPress={() => { onClose(); router.push('/(tabs)/settings' as any); }}
            className="flex-row items-center bg-bg border border-border rounded-2xl px-4 py-4"
          >
            <View className="w-10 h-10 rounded-xl bg-accent-light items-center justify-center mr-3">
              <Text className="text-lg">⚙️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-navy font-bold text-base">Настройки</Text>
              <Text className="text-muted text-xs mt-0.5">Тема, данные, экспорт</Text>
            </View>
            <Text className="text-muted text-lg">›</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
