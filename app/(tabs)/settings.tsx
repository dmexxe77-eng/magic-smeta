import { View, Text, Pressable, Switch, Alert } from 'react-native';
import { ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader, Card, SectionHeader, Divider } from '../../src/components/ui';
import { useApp } from '../../src/store/AppContext';

export default function SettingsTab() {
  const { state, dispatch } = useApp();

  const handleReset = () => {
    Alert.alert(
      'Сбросить данные',
      'Удалить все проекты и настройки? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сбросить',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            dispatch({ type: 'RESET' });
          },
        },
      ]
    );
  };

  const rows = [
    {
      icon: '🎨',
      title: 'Тема',
      right: (
        <Switch
          value={state.theme === 'dark'}
          onValueChange={v => dispatch({ type: 'SET_THEME', theme: v ? 'dark' : 'light' })}
          trackColor={{ false: '#e8e8e4', true: '#4F46E5' }}
        />
      ),
    },
    {
      icon: '⭐',
      title: 'PRO версия',
      right: (
        <Switch
          value={state.isPro}
          onValueChange={v => dispatch({ type: 'SET_PRO', isPro: v })}
          trackColor={{ false: '#e8e8e4', true: '#4F46E5' }}
        />
      ),
    },
  ];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Настройки" subtitle="MAGIC" />
      <ScrollView className="flex-1 p-4">

        <Card className="p-3 mb-4">
          <SectionHeader title="Приложение" />
          {rows.map((row, i) => (
            <View key={row.title}>
              <View className="flex-row items-center justify-between py-3">
                <View className="flex-row items-center gap-3">
                  <Text className="text-xl">{row.icon}</Text>
                  <Text className="text-navy text-sm font-medium">{row.title}</Text>
                </View>
                {row.right}
              </View>
              {i < rows.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        <Card className="p-3 mb-4">
          <SectionHeader title="Данные" />
          <Pressable
            onPress={handleReset}
            className="flex-row items-center gap-3 py-3"
          >
            <Text className="text-xl">🗑️</Text>
            <Text className="text-danger text-sm font-medium">Сбросить все данные</Text>
          </Pressable>
        </Card>

        <Card className="p-3 mb-4">
          <SectionHeader title="О приложении" />
          <View className="py-2 gap-2">
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">Версия</Text>
              <Text className="text-navy text-sm font-medium">1.0.0</Text>
            </View>
            <Divider />
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">Платформа</Text>
              <Text className="text-navy text-sm font-medium">React Native + Expo</Text>
            </View>
            <Divider />
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">Стек</Text>
              <Text className="text-navy text-sm font-medium">TypeScript + NativeWind</Text>
            </View>
          </View>
        </Card>

      </ScrollView>
    </View>
  );
}
