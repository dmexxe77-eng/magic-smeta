import { View, Text } from 'react-native';
import { AppHeader } from '../../src/components/ui';

export default function FinanceTab() {
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Финансы" subtitle="PRO" />
      <View className="flex-1 items-center justify-center">
        <Text className="text-5xl mb-4">💰</Text>
        <Text className="text-navy font-bold text-lg mb-2">Финансы студии</Text>
        <Text className="text-muted text-sm text-center px-8">
          Аналитика, долги, выплаты дизайнерам. Доступно в PRO.
        </Text>
        <View className="mt-6 bg-accent-light px-6 py-3 rounded-full">
          <Text className="text-accent font-bold text-sm">🔒 Активировать PRO</Text>
        </View>
      </View>
    </View>
  );
}
