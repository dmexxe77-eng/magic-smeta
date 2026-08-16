import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boxes, Settings, X as XIcon, ChevronRight } from 'lucide-react-native';
import { COLORS, Touchable } from './index';

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

  const items: Array<{ Icon: typeof Boxes; title: string; desc: string; onPress: () => void }> = [
    { Icon: Boxes,    title: 'Номенклатуры', desc: 'Редактор каталога товаров и услуг', onPress: () => go('/nomenclature') },
    { Icon: Settings, title: 'Настройки',    desc: 'Тема, данные, экспорт',              onPress: () => { onClose(); router.push('/(tabs)/settings' as any); } },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top + 10 }}>
        {/* Handle bar */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 22 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.ink, letterSpacing: -0.3 }}>Меню</Text>
          <Touchable
            haptic="light"
            onPress={onClose}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: COLORS.glass,
              borderWidth: 1, borderColor: COLORS.glassEdge,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <XIcon size={16} color={COLORS.muted} strokeWidth={2.2} />
          </Touchable>
        </View>

        {/* Menu items */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {items.map(item => (
            <Touchable
              key={item.title}
              haptic="light"
              onPress={item.onPress}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: COLORS.glass,
                borderWidth: 1, borderColor: COLORS.glassEdge,
                borderRadius: 16,
                paddingHorizontal: 14, paddingVertical: 14,
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 11,
                backgroundColor: COLORS.accentSoft,
                borderWidth: 1, borderColor: 'rgba(10,132,255,0.30)',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 12,
              }}>
                <item.Icon size={20} color={COLORS.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}>
                  {item.title}
                </Text>
                <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                  {item.desc}
                </Text>
              </View>
              <ChevronRight size={18} color={COLORS.subtle} strokeWidth={2} />
            </Touchable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
