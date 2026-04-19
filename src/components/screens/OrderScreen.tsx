import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Linking,
  Platform,
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

// ─── Address card with route button ───────────────────────────────────

function AddressCard({ order }: { order: Order }) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(order.address ?? '');

  const save = () => {
    dispatch({ type: 'UPDATE_ORDER', id: order.id, patch: { address: tmp.trim() || undefined } });
    setEditing(false);
  };

  const openRoute = async () => {
    const addr = order.address?.trim();
    if (!addr) return;
    const enc = encodeURIComponent(addr);
    const ya = `yandexmaps://maps.yandex.ru/?text=${enc}`;
    const dgis = `dgis://2gis.ru/search/${enc}`;
    const apple = `http://maps.apple.com/?q=${enc}`;
    const web = `https://yandex.ru/maps/?text=${enc}`;
    try {
      if (await Linking.canOpenURL(ya)) return Linking.openURL(ya);
      if (await Linking.canOpenURL(dgis)) return Linking.openURL(dgis);
      if (Platform.OS === 'ios' && (await Linking.canOpenURL(apple))) return Linking.openURL(apple);
      Linking.openURL(web);
    } catch {
      Linking.openURL(web);
    }
  };

  return (
    <Card className="p-3">
      <SectionHeader title="Адрес" />
      {editing ? (
        <View>
          <TextInput
            value={tmp}
            onChangeText={setTmp}
            placeholder="Город, улица, дом"
            placeholderTextColor="#b0b0ba"
            autoFocus
            multiline
            className="bg-bg border border-border rounded-xl px-3 py-2 text-navy text-sm mb-2"
          />
          <View className="flex-row gap-2">
            <Button label="Сохранить" onPress={save} size="sm" />
            <Button label="Отмена" onPress={() => { setTmp(order.address ?? ''); setEditing(false); }} variant="ghost" size="sm" />
          </View>
        </View>
      ) : order.address ? (
        <View>
          <Pressable onPress={() => setEditing(true)} className="py-2">
            <Text className="text-navy text-sm">{order.address}</Text>
          </Pressable>
          <Button label="🗺️  Проложить маршрут" onPress={openRoute} size="sm" className="mt-2" />
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} className="py-3">
          <Text className="text-muted text-sm">+ Добавить адрес</Text>
        </Pressable>
      )}
    </Card>
  );
}

// ─── Dates card (measure + install) ───────────────────────────────────

function DatesCard({ order }: { order: Order }) {
  const { dispatch } = useApp();

  const setDate = (key: 'measureDate' | 'installDate', value: string) => {
    dispatch({ type: 'UPDATE_ORDER', id: order.id, patch: { [key]: value.trim() || undefined } });
  };

  return (
    <Card className="p-3">
      <SectionHeader title="Даты" />
      <DateRow label="Замер" value={order.measureDate} onSave={v => setDate('measureDate', v)} />
      <DateRow label="Монтаж" value={order.installDate} onSave={v => setDate('installDate', v)} />
    </Card>
  );
}

function DateRow({ label, value, onSave }: { label: string; value?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(value ?? '');

  const commit = () => { onSave(tmp); setEditing(false); };

  return (
    <View className="flex-row justify-between items-center py-2 border-b border-border">
      <Text className="text-muted text-sm">{label}</Text>
      {editing ? (
        <TextInput
          value={tmp}
          onChangeText={setTmp}
          placeholder="ДД.ММ.ГГГГ"
          placeholderTextColor="#b0b0ba"
          autoFocus
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="numbers-and-punctuation"
          className="bg-bg border border-border rounded-lg px-3 py-1 text-navy text-sm w-32 text-right"
        />
      ) : (
        <Pressable onPress={() => { setTmp(value ?? ''); setEditing(true); }}>
          <Text className={`text-sm font-medium ${value ? 'text-navy' : 'text-accent'}`}>
            {value || '+ Указать'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

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
        titleLabel="ОБЪЕКТ"
        title={order.name}
        subtitle={order.client || undefined}
        onBack={() => router.back()}
        onMenu={() => {/* TODO */}}
      />

      {/* Status bar */}
      <View className="bg-white border-b border-border py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
        >
          {STATUSES.map(s => (
            <Pressable
              key={s.id}
              onPress={() =>
                dispatch({ type: 'SET_ORDER_STATUS', id: order.id, status: s.id })
              }
              style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: order.status === s.id ? '#4F46E5' : '#e8e8e4', backgroundColor: order.status === s.id ? '#4F46E5' : '#fff' }}
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
      </View>

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

            {/* Address card with route button */}
            <AddressCard order={order} />

            {/* Dates card */}
            <DatesCard order={order} />

            {/* Project info */}
            <Card className="p-3">
              <SectionHeader title="Данные проекта" />
              {[
                { label: 'Клиент', value: order.client },
                { label: 'Телефон', value: order.phone, isPhone: true },
                { label: 'Дизайнер', value: order.designer },
                { label: 'Заметки', value: order.notes },
              ]
                .filter(f => f.value)
                .map(f => (
                  <Pressable
                    key={f.label}
                    onPress={f.isPhone ? () => Linking.openURL(`tel:${f.value}`) : undefined}
                    className="flex-row justify-between py-2 border-b border-border"
                  >
                    <Text className="text-muted text-sm">{f.label}</Text>
                    <Text className={`text-sm font-medium ${f.isPhone ? 'text-accent' : 'text-navy'}`}>
                      {f.value}
                    </Text>
                  </Pressable>
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
