import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, X as XIcon, FolderOpen } from 'lucide-react-native';
import { useApp } from '../../store/AppContext';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  FormField,
  EmptyState,
  Divider,
  Touchable,
  FAB,
  HeroCard,
  COLORS,
  SERIF,
} from '../ui';
import { AppMenu } from '../ui/AppMenu';
import { fmt } from '../../utils/geometry';
import type { Order, OrderStatus } from '../../types';

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: COLORS.subtle, measuring: COLORS.warning, calc: COLORS.accent,
  approval: COLORS.warning, contract: COLORS.success, done: COLORS.success, cancelled: COLORS.danger,
};

// ─── Status config ────────────────────────────────────────────────────

const STATUSES: Array<{ id: OrderStatus; label: string; color: 'gray' | 'accent' | 'orange' | 'green' | 'red' }> = [
  { id: 'new', label: 'Заявка', color: 'gray' },
  { id: 'measuring', label: 'Замер', color: 'orange' },
  { id: 'calc', label: 'Расчёт готов', color: 'accent' },
  { id: 'approval', label: 'На согласовании', color: 'orange' },
  { id: 'contract', label: 'Договор подписан', color: 'green' },
  { id: 'done', label: 'Выполнен', color: 'green' },
  { id: 'cancelled', label: 'Отменён', color: 'red' },
];

function statusConfig(id: OrderStatus) {
  return STATUSES.find(s => s.id === id) ?? STATUSES[0];
}

// ─── Order Card ───────────────────────────────────────────────────────

function OrderCard({
  order,
  onPress,
  onDelete,
}: {
  order: Order;
  onPress: () => void;
  onDelete: () => void;
}) {
  const st = statusConfig(order.status);
  const totalArea = order.rooms.reduce((s, r) => s + (r.aO ?? 0), 0);
  const totalPaid = (order.payments ?? []).reduce((s, p) => s + p.amount, 0);

  return (
    <Touchable
      haptic="light"
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: COLORS.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
      }}
    >
      {/* Status stripe */}
      <View style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        backgroundColor: STATUS_COLOR[order.status],
      }} />

      <View style={{ paddingLeft: 16, paddingRight: 12, paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 17, fontWeight: '700', color: COLORS.ink, lineHeight: 21 }}>
              {order.name}
            </Text>
            {order.client ? (
              <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{order.client}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Badge label={st.label} color={st.color} variant="soft" />
            <Touchable
              onPress={onDelete}
              haptic="warning"
              style={{
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: COLORS.surface2,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <XIcon size={13} color={COLORS.muted} strokeWidth={2} />
            </Touchable>
          </View>
        </View>

        {(totalArea > 0 || (order.calcSnapshot && order.calcSnapshot.total > 0)) && (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
            {totalArea > 0 && (
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                {fmt(totalArea)} м²  ·  {order.rooms.length} помещ.
              </Text>
            )}
            {order.calcSnapshot && order.calcSnapshot.total > 0 && (
              <>
                <View style={{ flex: 1 }} />
                <Text style={{ fontFamily: SERIF, fontSize: 15, fontWeight: '700', color: COLORS.ink }}>
                  {fmt(order.calcSnapshot.total)}<Text style={{ fontSize: 11, color: COLORS.muted }}> ₽</Text>
                </Text>
              </>
            )}
          </View>
        )}

        {totalPaid > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: COLORS.muted }}>Оплачено:</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.success }}>
              {fmt(totalPaid)} ₽
            </Text>
          </View>
        )}
      </View>
    </Touchable>
  );
}

// ─── New Order Modal ──────────────────────────────────────────────────

function NewOrderModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { createOrder } = useApp();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    const order = createOrder({ name, client, phone, address });
    setName(''); setClient(''); setPhone(''); setAddress('');
    onCreated(order.id);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.ink, letterSpacing: -0.3 }}>Новый проект</Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: COLORS.accent, fontSize: 15, fontWeight: '600' }}>Отмена</Text>
          </Pressable>
        </View>
        <ScrollView className="flex-1 px-4 pt-4">
          <FormField
            label="Название проекта"
            value={name}
            onChangeText={setName}
            placeholder="напр. Квартира Иванова"
          />
          <FormField
            label="Клиент"
            value={client}
            onChangeText={setClient}
            placeholder="Имя клиента"
          />
          <FormField
            label="Телефон"
            value={phone}
            onChangeText={setPhone}
            placeholder="+7 (900) 000-00-00"
            keyboardType="phone-pad"
          />
          <FormField
            label="Адрес"
            value={address}
            onChangeText={setAddress}
            placeholder="Город, улица, дом"
          />
        </ScrollView>
        <View className="px-4 pb-8">
          <Button
            label="Создать проект"
            onPress={handleCreate}
            disabled={!name.trim()}
            size="lg"
            className="w-full"
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────

export default function HomeScreen() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showNew, setShowNew] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.orders.filter(o => {
      const matchSearch =
        !q ||
        o.name.toLowerCase().includes(q) ||
        (o.client ?? '').toLowerCase().includes(q);
      const matchStatus = activeStatus === 'all' || o.status === activeStatus;
      return matchSearch && matchStatus;
    });
  }, [state.orders, search, activeStatus]);

  const handleDelete = useCallback((order: Order) => {
    Alert.alert(
      'Удалить проект',
      `Удалить «${order.name}»? Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => dispatch({ type: 'DELETE_ORDER', id: order.id }),
        },
      ]
    );
  }, [dispatch]);

  const handleOrderPress = useCallback((id: string) => {
    router.push(`/order/${id}` as any);
  }, [router]);

  const renderOrder = useCallback(({ item: order }: { item: Order }) => (
    <OrderCard
      order={order}
      onPress={() => handleOrderPress(order.id)}
      onDelete={() => handleDelete(order)}
    />
  ), [handleOrderPress, handleDelete]);

  const keyExtractor = useCallback((item: Order) => item.id, []);

  // Stats
  const inWork = state.orders.filter(
    o => o.status !== 'done' && o.status !== 'cancelled'
  ).length;

  const doneCount = state.orders.filter(o => o.status === 'done').length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <AppHeader
        onMenu={() => setShowMenu(true)}
        title="Magic"
        subtitle="Studio"
        rightContent={
          state.isPro ? (
            <View style={{ backgroundColor: COLORS.ink, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ color: COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>PRO</Text>
            </View>
          ) : undefined
        }
      />

      <FlatList
        data={filtered}
        renderItem={renderOrder}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListHeaderComponent={
          <>
            {/* Hero stats — editorial dark slab with serif numerals */}
            <HeroCard style={{ marginHorizontal: 16, marginTop: 18, marginBottom: 20 }}>
              <Text style={{ color: COLORS.faint, fontSize: 10, fontWeight: '700', letterSpacing: 2.2, marginBottom: 10 }}>
                АКТИВНЫЕ ОБЪЕКТЫ
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                <Text style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: 56, fontWeight: '700', lineHeight: 58 }}>
                  {state.orders.length}
                </Text>
                <Text style={{ color: COLORS.faint, fontSize: 12, fontStyle: 'italic' }}>проектов</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                <View>
                  <Text style={{ color: COLORS.faint, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 3 }}>
                    В РАБОТЕ
                  </Text>
                  <Text style={{ fontFamily: SERIF, color: COLORS.accent, fontSize: 22, fontWeight: '700' }}>
                    {inWork}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <View>
                  <Text style={{ color: COLORS.faint, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 3 }}>
                    СДАНО
                  </Text>
                  <Text style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>
                    {doneCount}
                  </Text>
                </View>
              </View>
            </HeroCard>

            {/* Search */}
            <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
              <View style={{
                backgroundColor: COLORS.card,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
                <Search size={15} color={COLORS.subtle} strokeWidth={2} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Поиск проектов"
                  placeholderTextColor={COLORS.subtle}
                  style={{ flex: 1, color: COLORS.ink, fontSize: 14 }}
                />
              </View>
            </View>

            {/* Status filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {(['all', ...STATUSES.slice(0, 5).map(s => s.id)] as Array<OrderStatus | 'all'>).map(id => {
                const label = id === 'all' ? 'Все' : STATUSES.find(s => s.id === id)?.label ?? id;
                const active = activeStatus === id;
                return (
                  <Touchable
                    key={id}
                    haptic="selection"
                    scale={0.96}
                    onPress={() => setActiveStatus(id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: active ? COLORS.ink : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? COLORS.ink : COLORS.border,
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: active ? '700' : '600',
                      color: active ? '#FFFFFF' : COLORS.muted,
                      letterSpacing: 0.2,
                    }}>
                      {label}
                    </Text>
                  </Touchable>
                );
              })}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<FolderOpen size={28} strokeWidth={1.5} color={COLORS.muted} />}
            title="Проектов нет"
            desc="Создайте первый проект чтобы начать работу"
            action={<Button label="Новый проект" onPress={() => setShowNew(true)} size="md" />}
          />
        }
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />

      {/* FAB — corner-anchored circle in terracotta */}
      <FAB
        icon={<Plus size={22} color="#FFFFFF" strokeWidth={2.5} />}
        onPress={() => setShowNew(true)}
      />

      <NewOrderModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreated={id => {
          setShowNew(false);
          router.push(`/order/${id}` as any);
        }}
      />

      <AppMenu visible={showMenu} onClose={() => setShowMenu(false)} />
    </View>
  );
}
