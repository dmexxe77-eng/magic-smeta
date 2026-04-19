import { useState, useCallback } from 'react';
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
import { useApp } from '../../store/AppContext';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  FormField,
  EmptyState,
  Divider,
} from '../ui';
import { AppMenu } from '../ui/AppMenu';
import { fmt } from '../../utils/geometry';
import type { Order, OrderStatus } from '../../types';

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
    <Card
      onPress={onPress}
      className="mx-4 mb-3 overflow-hidden"
    >
      {/* Left accent bar */}
      <View className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-2xl" />

      <View className="pl-4 pr-3 py-3">
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-1 mr-2">
            <Text className="text-base font-bold text-navy">{order.name}</Text>
            {order.client ? (
              <Text className="text-xs text-muted mt-0.5">{order.client}</Text>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2">
            <Badge label={st.label} color={st.color} />
            <Pressable
              onPress={onDelete}
              className="w-7 h-7 rounded-full bg-red-50 items-center justify-center"
            >
              <Text className="text-red-400 text-xs">✕</Text>
            </Pressable>
          </View>
        </View>

        {totalArea > 0 && (
          <View className="flex-row items-center mb-1">
            <Text className="text-xs text-muted">
              {fmt(totalArea)} м²  ·  {order.rooms.length} помещ.
            </Text>
            {order.calcSnapshot && order.calcSnapshot.total > 0 && (
              <>
                <Text className="text-xs text-muted">  ·  </Text>
                <Text className="text-xs font-bold text-accent">{fmt(order.calcSnapshot.total)} ₽</Text>
              </>
            )}
          </View>
        )}

        {totalPaid > 0 && (
          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-xs text-muted">Оплачено:</Text>
            <Text className="text-xs font-semibold text-success">
              {fmt(totalPaid)} ₽
            </Text>
          </View>
        )}
      </View>
    </Card>
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
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-14 pb-4 border-b border-border">
          <Text className="text-lg font-bold text-navy">Новый проект</Text>
          <Pressable onPress={onClose}>
            <Text className="text-muted text-base">Отмена</Text>
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
  const [showNew, setShowNew] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'all'>('all');

  const filtered = state.orders.filter(o => {
    const matchSearch =
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.client ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = activeStatus === 'all' || o.status === activeStatus;
    return matchSearch && matchStatus;
  });

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

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        onMenu={() => setShowMenu(true)}
        rightContent={
          state.isPro ? (
            <View className="bg-navy px-3 py-1 rounded-full">
              <Text className="text-accent-mid text-xs font-bold tracking-wider">PRO</Text>
            </View>
          ) : undefined
        }
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Stats card */}
        <View className="bg-navy mx-4 mt-4 rounded-2xl p-4 mb-4">
          <Text className="text-white/50 text-[10px] font-bold tracking-widest mb-2">
            АКТИВНЫЕ ОБЪЕКТЫ
          </Text>
          <Text className="text-white text-4xl font-black mb-3">
            {state.orders.length}
          </Text>
          <View className="flex-row gap-5">
            <View>
              <Text className="text-white/40 text-[10px] mb-1">В работе</Text>
              <Text className="text-accent-mid text-xl font-black">{inWork}</Text>
            </View>
            <View>
              <Text className="text-white/40 text-[10px] mb-1">Сдано</Text>
              <Text className="text-green-400 text-xl font-black">
                {state.orders.filter(o => o.status === 'done').length}
              </Text>
            </View>
          </View>
        </View>

        {/* Search */}
        <View className="mx-4 mb-3">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="🔍  Поиск проектов..."
            placeholderTextColor="#b0b0ba"
            className="bg-card border border-border rounded-xl px-4 py-3 text-navy text-sm"
          />
        </View>

        {/* Status filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerClassName="px-4 gap-2"
        >
          <Pressable
            onPress={() => setActiveStatus('all')}
            className={`px-3 py-1.5 rounded-full border ${
              activeStatus === 'all'
                ? 'bg-navy border-navy'
                : 'bg-card border-border'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                activeStatus === 'all' ? 'text-white' : 'text-muted'
              }`}
            >
              Все
            </Text>
          </Pressable>
          {STATUSES.slice(0, 5).map(s => (
            <Pressable
              key={s.id}
              onPress={() => setActiveStatus(s.id)}
              className={`px-3 py-1.5 rounded-full border ${
                activeStatus === s.id
                  ? 'bg-accent border-accent'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeStatus === s.id ? 'text-white' : 'text-muted'
                }`}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Проектов нет"
            desc="Создайте первый проект чтобы начать работу"
            action={
              <Button
                label="+ Новый проект"
                onPress={() => setShowNew(true)}
                size="md"
              />
            }
          />
        ) : (
          <FlatList
            data={filtered}
            renderItem={renderOrder}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            ListFooterComponent={<View className="h-32" />}
          />
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => setShowNew(true)}
        className="absolute bottom-8 self-center bg-accent px-8 py-4 rounded-full shadow-lg"
        style={{ elevation: 6 }}
      >
        <Text className="text-white font-bold text-base">+ Новый проект</Text>
      </Pressable>

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
