import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Alert, ScrollView, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sun, Moon, Sparkles, Trash2 } from 'lucide-react-native';
import { AppHeader, Card, SectionHeader, Divider, Touchable, COLORS } from '../../src/components/ui';
import { useApp } from '../../src/store/AppContext';

// ─── Theme switcher — segmented Sun/Moon ────────────────────────────
function ThemeSwitcher({ value, onChange }: { value: 'light' | 'dark'; onChange: (t: 'light' | 'dark') => void }) {
  const options: Array<{ id: 'light' | 'dark'; Icon: typeof Sun; label: string }> = [
    { id: 'light', Icon: Sun,  label: 'Светлая' },
    { id: 'dark',  Icon: Moon, label: 'Тёмная'  },
  ];
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: COLORS.glass,
      borderWidth: 1, borderColor: COLORS.glassEdge,
      padding: 4,
      borderRadius: 999,
      gap: 4,
    }}>
      {options.map(opt => {
        const active = value === opt.id;
        return (
          <Touchable
            key={opt.id}
            haptic="selection"
            scale={0.96}
            onPress={() => onChange(opt.id)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: active ? COLORS.accent : 'transparent',
              shadowColor: active ? COLORS.accent : undefined,
              shadowOpacity: active ? 0.35 : 0,
              shadowRadius: 8,
            }}
          >
            <opt.Icon size={13} color={active ? '#FFFFFF' : COLORS.muted} strokeWidth={2.2} />
            <Text style={{
              fontSize: 12,
              fontWeight: '700',
              color: active ? '#FFFFFF' : COLORS.muted,
              letterSpacing: 0.2,
            }}>{opt.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

// ─── Pro toggle pill ──────────────────────────────────────────────────
function ProToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 30, bounciness: 6 }).start();
  }, [value]);
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(!value); }}
      hitSlop={6}
      style={{
        width: 50, height: 28, borderRadius: 14, padding: 3,
        backgroundColor: value ? COLORS.accent : COLORS.glass,
        borderWidth: 1,
        borderColor: value ? COLORS.accent : COLORS.glassEdge,
        justifyContent: 'center',
        shadowColor: value ? COLORS.accent : undefined,
        shadowOpacity: value ? 0.5 : 0,
        shadowRadius: 8,
      }}
    >
      <Animated.View style={{
        width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF',
        transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
      }} />
    </Pressable>
  );
}

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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <AppHeader title="Настройки" subtitle="MAGIC" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Appearance */}
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <SectionHeader title="Внешний вид" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: COLORS.accentSoft,
                borderWidth: 1, borderColor: 'rgba(10,132,255,0.30)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {state.theme === 'dark'
                  ? <Moon size={17} color={COLORS.accent} strokeWidth={2} />
                  : <Sun size={17} color={COLORS.accent} strokeWidth={2} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: '600' }}>Тема оформления</Text>
                <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
                  {state.theme === 'dark' ? 'Тёмная — Liquid Glass' : 'Светлая'}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <ThemeSwitcher
              value={state.theme}
              onChange={t => dispatch({ type: 'SET_THEME', theme: t })}
            />
          </View>
        </Card>

        {/* Features */}
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <SectionHeader title="Возможности" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: COLORS.accentSoft,
                borderWidth: 1, borderColor: 'rgba(10,132,255,0.30)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={17} color={COLORS.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: '600' }}>PRO версия</Text>
                <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
                  Расширенные финансы и выплаты
                </Text>
              </View>
            </View>
            <ProToggle value={state.isPro} onChange={v => dispatch({ type: 'SET_PRO', isPro: v })} />
          </View>
        </Card>

        {/* Data */}
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <SectionHeader title="Данные" />
          <Touchable haptic="warning" onPress={handleReset} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: 'rgba(255,69,58,0.12)',
              borderWidth: 1, borderColor: 'rgba(255,69,58,0.30)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={17} color={COLORS.danger} strokeWidth={2} />
            </View>
            <Text style={{ color: COLORS.danger, fontSize: 14, fontWeight: '600' }}>Сбросить все данные</Text>
          </Touchable>
        </Card>

        {/* About */}
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <SectionHeader title="О приложении" />
          <View style={{ paddingVertical: 4, gap: 10 }}>
            <Row label="Версия" value="1.0.0" />
            <Divider />
            <Row label="Платформа" value="React Native + Expo" />
            <Divider />
            <Row label="Стек" value="TypeScript + NativeWind" />
          </View>
        </Card>

      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: COLORS.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
