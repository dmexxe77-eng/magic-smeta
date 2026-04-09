import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp, useOrder } from '../../store/AppContext';
import { AppHeader, Badge, Button, Card, SectionHeader, Divider } from '../ui';
import { fmt } from '../../utils/geometry';
import type { Order, OrderStatus } from '../../types';

const STATUSES: Array<{
  id: OrderStatus;
  label: string;
  color: 'gray' | 'accent' | 'orange' | 'green' | 'red';
}> = [
  { id: 'new', label: 'Заявка', color: 'gray' },
  { id: 'measuring', label: 'Замер', color: 'orange' },
  { id: 'calc', label: 'Расчёт готов', color: 'accent' },
  { id: 'approval', label: 'На согласовании', color: 'orange' },
  { id: 'contract', label: 'Договор подписан', color: 'green' },
  { id: 'done', label: 'Выполнен', color: 'green' },
  { id: 'cancelled', label: 'Отменён', color: 'red' },
];

interface OrderScreenProps {
  orderId: string;
}

export default function OrderScreen({ orderId }: OrderScreenProps) {
  const { dispatch } = useApp();
  const order = useOrder(orderId);
  const router = useRouter();
  const [tab, setTab] = useState<'info' | 'finance' | 'salary'>('info');

  if (!order) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Text className="text-muted">Проект не найден</Text>
      </View>
    );
  }

  const totalArea = order.rooms.reduce((s, r) => s + (r.aO ?? 0), 0);
  const totalPaid = (order.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const st = STATUSES.find(s => s.id === order.status) ?? STATUSES[0];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title={order.name}
        subtitle={order.client || undefined}
        onBack={() => router.back()}
        onMenu={() => {/* TODO */}}
      />

      {/* Status bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white border-b border-border py-2"
        contentContainerClassName="px-4 gap-2"
      >
        {STATUSES.map(s => (
          <Pressable
            key={s.id}
            onPress={() =>
              dispatch({ type: 'SET_ORDER_STATUS', id: order.id, status: s.id })
            }
            className={`px-4 py-1.5 rounded-full border ${
              order.status === s.id
                ? 'bg-accent border-accent'
                : 'bg-white border-border'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                order.status === s.id ? 'text-white' : 'text-muted'
              }`}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View className="bg-white flex-row border-b border-border">
        {(['info', 'finance', 'salary'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-3 border-b-2 ${
              tab === t ? 'border-accent' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-center text-sm font-semibold ${
                tab === t ? 'text-accent' : 'text-muted'
              }`}
            >
              {t === 'info' ? 'Инфо' : t === 'finance' ? 'Финансы' : 'Выплаты'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {tab === 'info' && (
          <View className="p-4 gap-4">
            {/* Sum card */}
            {totalArea > 0 && (
              <View className="bg-navy rounded-2xl p-4">
                <Text className="text-white/50 text-[10px] font-bold tracking-widest mb-1">
                  ПЛОЩАДЬ
                </Text>
                <Text className="text-white text-3xl font-black">
                  {fmt(totalArea)} м²
                </Text>
                <Text className="text-white/40 text-xs mt-1">
                  {order.rooms.length} помещений
                </Text>
              </View>
            )}

            {/* Actions */}
            <Card className="p-3">
              <SectionHeader title="Действия" />
              <Button
                label="📐  Калькулятор смет"
                onPress={() => router.push(`/calc/${order.id}` as any)}
                size="md"
                className="w-full"
              />
            </Card>

            {/* Rooms list */}
            {order.rooms.length > 0 && (
              <Card className="p-3">
                <SectionHeader title="Помещения" />
                {order.rooms.map((room, idx) => (
                  <View key={room.id}>
                    <View className="flex-row justify-between py-2">
                      <Text className="text-navy text-sm font-medium">
                        {room.name}
                      </Text>
                      <Text className="text-muted text-sm">
                        {fmt(room.aO ?? 0)} м²
                      </Text>
                    </View>
                    {idx < order.rooms.length - 1 && <Divider />}
                  </View>
                ))}
              </Card>
            )}

            {/* Project info */}
            <Card className="p-3">
              <SectionHeader title="Данные проекта" />
              {[
                { label: 'Клиент', value: order.client },
                { label: 'Телефон', value: order.phone },
                { label: 'Адрес', value: order.address },
                { label: 'Дизайнер', value: order.designer },
                { label: 'Заметки', value: order.notes },
              ]
                .filter(f => f.value)
                .map(f => (
                  <View
                    key={f.label}
                    className="flex-row justify-between py-2 border-b border-border"
                  >
                    <Text className="text-muted text-sm">{f.label}</Text>
                    <Text className="text-navy text-sm font-medium">
                      {f.value}
                    </Text>
                  </View>
                ))}
            </Card>
          </View>
        )}

        {tab === 'finance' && (
          <View className="p-4">
            <View className="bg-navy rounded-2xl p-4 mb-4">
              <Text className="text-white/50 text-[10px] font-bold tracking-widest mb-1">
                ОПЛАЧЕНО
              </Text>
              <Text className="text-white text-3xl font-black">
                {fmt(totalPaid)} ₽
              </Text>
            </View>
            <Text className="text-muted text-sm text-center py-8">
              🔒 Доступно в PRO
            </Text>
          </View>
        )}

        {tab === 'salary' && (
          <View className="p-4">
            <Text className="text-muted text-sm text-center py-8">
              🔒 Доступно в PRO
            </Text>
          </View>
        )}

        <View className="h-12" />
      </ScrollView>
    </View>
  );
}
