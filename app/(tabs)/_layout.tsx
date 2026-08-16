import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { ClipboardList, Users, Wallet, Settings as SettingsIcon } from 'lucide-react-native';
import { COLORS } from '../../src/components/ui';

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      width: 38, height: 30, borderRadius: 10,
      backgroundColor: focused ? COLORS.accentSoft : 'transparent',
      borderWidth: focused ? 1 : 0,
      borderColor: focused ? 'rgba(10,132,255,0.30)' : 'transparent',
    }}>
      <Icon size={18} color={focused ? COLORS.accent : COLORS.subtle} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bg2,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.subtle,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Проекты',
          tabBarIcon: ({ focused }) => <TabIcon Icon={ClipboardList} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Клиенты',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Users} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Финансы',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Wallet} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarIcon: ({ focused }) => <TabIcon Icon={SettingsIcon} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
