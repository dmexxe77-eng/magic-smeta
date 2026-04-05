import { View, Text } from 'react-native';
import { AppHeader } from '../../src/components/ui';

export default function ClientsTab() {
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Клиенты" subtitle="MAGIC" />
      <View className="flex-1 items-center justify-center">
        <Text className="text-5xl mb-4">👤</Text>
        <Text className="text-navy font-bold text-lg mb-2">База клиентов</Text>
        <Text className="text-muted text-sm text-center px-8">
          Здесь будет список всех клиентов с историей проектов
        </Text>
      </View>
    </View>
  );
}
