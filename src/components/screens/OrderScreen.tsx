import React, { useState } from 'react';
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
import {
  Calculator, ShoppingCart, Wrench, FileText, MapPin, Phone, Lock,
} from 'lucide-react-native';
import { useApp, useOrder } from '../../store/AppContext';
import { AppHeader, Badge, Button, Card, SectionHeader, Divider, Touchable } from '../ui';
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

// ─── Compact action tile ─────────────────────────────────────────────

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function ActionTile({ Icon, label, onPress }: { Icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Touchable
      onPress={onPress}
      haptic="light"
      className="flex-1 bg-bg border border-border rounded-xl py-3 px-2 items-center gap-1.5"
    >
      <Icon size={20} color="#5C5C6B" strokeWidth={1.8} />
      <Text className="text-xs font-semibold text-ink text-center" numberOfLines={1}>
        {label}
      </Text>
    </Touchable>
  );
}

// ─── Open route in Yandex/2GIS/Apple/Web ─────────────────────────────

async function openRouteForAddress(address: string) {
  const enc = encodeURIComponent(address.trim());
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
}

// ─── Inline-editable project field ────────────────────────────────────

function ProjectField({
  label, value, order, field, placeholder, isPhone, multiline, keyboardType,
}: {
  label: string; value?: string; order: Order; field: keyof Order;
  placeholder?: string; isPhone?: boolean; multiline?: boolean; keyboardType?: any;
}) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(value ?? '');

  const save = () => {
    dispatch({ type: 'UPDATE_ORDER', id: order.id, patch: { [field]: tmp.trim() || undefined } as any });
    setEditing(false);
  };

  if (editing) {
    return (
      <View className="py-2 border-b border-border gap-2">
        <Text className="text-muted text-xs">{label}</Text>
        <TextInput
          value={tmp}
          onChangeText={setTmp}
          placeholder={placeholder}
          placeholderTextColor="#b0b0ba"
          autoFocus
          multiline={multiline}
          keyboardType={keyboardType}
          onBlur={save}
          onSubmitEditing={!multiline ? save : undefined}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-navy text-sm"
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => { setTmp(value ?? ''); setEditing(true); }}
      onLongPress={isPhone && value ? () => Linking.openURL(`tel:${value}`) : undefined}
      className="flex-row justify-between items-center py-2 border-b border-border"
    >
      <Text className="text-muted text-sm">{label}</Text>
      <Text
        className={`text-sm font-medium flex-1 text-right ml-3 ${value ? (isPhone ? 'text-accent' : 'text-navy') : 'text-accent/70'}`}
        numberOfLines={multiline ? 2 : 1}
      >
        {value || `+ ${placeholder ?? 'Указать'}`}
      </Text>
    </Pressable>
  );
}

// ─── Calendar (расчёт / замер / монтаж) ──────────────────────────────

function CalendarCard({ order }: { order: Order }) {
  const { dispatch } = useApp();
  const setDate = (key: 'measureDate' | 'installDate', value: string) => {
    dispatch({ type: 'UPDATE_ORDER', id: order.id, patch: { [key]: value.trim() || undefined } });
  };
  return (
    <Card className="p-3">
      <SectionHeader title="Календарь" />
      <View className="flex-row justify-between items-center py-2 border-b border-border">
        <View>
          <Text className="text-muted text-sm">Расчёт</Text>
          <Text className="text-[10px] text-muted/60">обновляется автоматически</Text>
        </View>
        <Text className={`text-sm font-medium ${order.calcSnapshot ? 'text-navy' : 'text-muted/50'}`}>
          {order.calcSnapshot?.updatedAt ?? '—'}
        </Text>
      </View>
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
            {/* Hero — название проекта, площадь / итого, кол-во помещений */}
            <View className="bg-navy rounded-2xl p-4">
              <Text style={{ color: '#a5b4fc', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>
                ПРОЕКТ
              </Text>
              <Text className="text-white text-lg font-bold mb-3" numberOfLines={2}>
                {order.name}
              </Text>
              <View className="flex-row justify-between items-end">
                <View>
                  <Text style={{ color: '#a5b4fc', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>
                    ПЛОЩАДЬ
                  </Text>
                  <Text className="text-white text-2xl font-black">{fmt(totalArea)} м²</Text>
                </View>
                <View className="items-end">
                  <Text style={{ color: '#a5b4fc', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>
                    ИТОГО
                  </Text>
                  <Text className="text-white text-2xl font-black">
                    {order.calcSnapshot ? `${fmt(order.calcSnapshot.total)} ₽` : '—'}
                  </Text>
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6 }}>
                {order.rooms.length} помещений
                {order.calcSnapshot && `  ·  расчёт ${order.calcSnapshot.updatedAt}`}
              </Text>
            </View>

            {/* Actions */}
            <Card className="p-3">
              <SectionHeader title="Действия" />
              <Touchable
                onPress={() => router.push(`/calc/${order.id}` as any)}
                haptic="medium"
                className="bg-accent rounded-xl py-3 px-4 flex-row items-center justify-center gap-2 mb-2"
              >
                <Calculator size={18} color="#fff" strokeWidth={2.2} />
                <Text className="text-white text-sm font-bold">Калькулятор сметы</Text>
              </Touchable>
              <View className="flex-row gap-2">
                <ActionTile
                  Icon={ShoppingCart}
                  label="КП товаров"
                  onPress={() => Alert.alert('Скоро', 'Коммерческое предложение')}
                />
                <ActionTile
                  Icon={Wrench}
                  label="ТЗ монтажа"
                  onPress={() => Alert.alert('Скоро', 'Техзадание на монтаж')}
                />
                <ActionTile
                  Icon={FileText}
                  label="Договор"
                  onPress={() => Alert.alert('Скоро', 'Договор по шаблону')}
                />
              </View>
            </Card>

            {/* Project data — клиент, телефон, адрес */}
            <Card className="p-3">
              <SectionHeader title="Данные проекта" />
              <ProjectField label="Клиент" value={order.client} order={order} field="client" placeholder="Имя клиента" />
              <ProjectField label="Телефон" value={order.phone} order={order} field="phone" placeholder="+7 (900) 000-00-00" isPhone keyboardType="phone-pad" />
              <ProjectField label="Адрес" value={order.address} order={order} field="address" placeholder="Город, улица, дом" multiline />
              {order.address && (
                <Touchable
                  onPress={() => openRouteForAddress(order.address!)}
                  haptic="light"
                  className="mt-2 flex-row items-center justify-center gap-2 py-2 rounded-lg bg-accent-soft"
                >
                  <MapPin size={14} color="#5E5CE6" strokeWidth={2.2} />
                  <Text className="text-accent text-xs font-semibold">Проложить маршрут</Text>
                </Touchable>
              )}
              <ProjectField label="Дизайнер" value={order.designer} order={order} field="designer" placeholder="Имя дизайнера" />
              <ProjectField label="Заметки" value={order.notes} order={order} field="notes" placeholder="Заметки по проекту" multiline />
            </Card>

            {/* Calendar — даты расчёта / замера / монтажа */}
            <CalendarCard order={order} />
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
            <View className="flex-row items-center justify-center py-8 gap-2">
              <Lock size={14} color="#5C5C6B" strokeWidth={2} />
              <Text className="text-muted text-sm">Доступно в PRO</Text>
            </View>
          </View>
        )}

        {tab === 'salary' && (
          <View className="p-4">
            <View className="flex-row items-center justify-center py-8 gap-2">
              <Lock size={14} color="#5C5C6B" strokeWidth={2} />
              <Text className="text-muted text-sm">Доступно в PRO</Text>
            </View>
          </View>
        )}

        <View className="h-12" />
      </ScrollView>
    </View>
  );
}
