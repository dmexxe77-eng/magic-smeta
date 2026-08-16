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
import { AppHeader, Badge, Button, Card, SectionHeader, Divider, Touchable, SegmentedControl, HeroCard, COLORS, SERIF } from '../ui';
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
      style={{
        flex: 1,
        backgroundColor: COLORS.surface2,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 10,
        backgroundColor: COLORS.card,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: COLORS.border,
      }}>
        <Icon size={18} color={COLORS.ink} strokeWidth={1.7} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.ink, textAlign: 'center', letterSpacing: 0.2 }} numberOfLines={1}>
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
          placeholderTextColor="#6B7290"
          autoFocus
          multiline={multiline}
          keyboardType={keyboardType}
          onBlur={save}
          onSubmitEditing={!multiline ? save : undefined}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-ink text-sm"
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
        className={`text-sm font-medium flex-1 text-right ml-3 ${value ? (isPhone ? 'text-accent' : 'text-ink') : 'text-accent/70'}`}
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
        <Text className={`text-sm font-medium ${order.calcSnapshot ? 'text-ink' : 'text-muted/50'}`}>
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
          placeholderTextColor="#6B7290"
          autoFocus
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="numbers-and-punctuation"
          className="bg-bg border border-border rounded-lg px-3 py-1 text-ink text-sm w-32 text-right"
        />
      ) : (
        <Pressable onPress={() => { setTmp(value ?? ''); setEditing(true); }}>
          <Text className={`text-sm font-medium ${value ? 'text-ink' : 'text-accent'}`}>
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
      <View style={{ backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
        >
          {STATUSES.map(s => {
            const active = order.status === s.id;
            return (
              <Touchable
                key={s.id}
                haptic="selection"
                scale={0.96}
                onPress={() => dispatch({ type: 'SET_ORDER_STATUS', id: order.id, status: s.id })}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? COLORS.accent : COLORS.border,
                  backgroundColor: active ? COLORS.accent : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: active ? '700' : '600',
                  color: active ? '#FFFFFF' : COLORS.muted,
                  letterSpacing: 0.2,
                }}>
                  {s.label}
                </Text>
              </Touchable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tabs — segmented control */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <SegmentedControl
          value={tab}
          onChange={(t) => setTab(t as 'info' | 'finance' | 'salary')}
          options={[
            { id: 'info', label: 'Инфо' },
            { id: 'finance', label: 'Финансы' },
            { id: 'salary', label: 'Выплаты' },
          ]}
        />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {tab === 'info' && (
          <View style={{ padding: 16, gap: 14 }}>
            {/* Hero — editorial dark slab */}
            <HeroCard>
              <Text style={{ color: COLORS.faint, fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>
                ПРОЕКТ
              </Text>
              <Text style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 4, marginBottom: 18 }} numberOfLines={2}>
                {order.name}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <Text style={{ color: COLORS.faint, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>
                    ПЛОЩАДЬ
                  </Text>
                  <Text style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginTop: 2 }}>
                    {fmt(totalArea)}<Text style={{ fontSize: 16, color: COLORS.faint }}> м²</Text>
                  </Text>
                  <Text style={{ color: COLORS.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                    {order.rooms.length} {order.rooms.length === 1 ? 'помещение' : 'помещений'}
                  </Text>
                </View>
                <View style={{ width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: COLORS.faint, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>
                    ИТОГО
                  </Text>
                  {order.calcSnapshot && order.calcSnapshot.total > 0 ? (
                    <>
                      <Text style={{ fontFamily: SERIF, color: COLORS.accent, fontSize: 30, fontWeight: '700', marginTop: 2 }}>
                        {fmt(order.calcSnapshot.total)}<Text style={{ fontSize: 16, color: COLORS.faint }}> ₽</Text>
                      </Text>
                      <Text style={{ color: COLORS.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                        {order.calcSnapshot.updatedAt}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontFamily: SERIF, color: 'rgba(255,255,255,0.3)', fontSize: 30, fontWeight: '700', marginTop: 2 }}>
                        —
                      </Text>
                      <Text style={{ color: COLORS.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                        нет расчёта
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </HeroCard>

            {/* Primary action: Calculator (large CTA) */}
            <Touchable
              haptic="medium"
              onPress={() => router.push(`/calc/${order.id}` as any)}
              style={{
                backgroundColor: COLORS.accent,
                borderRadius: 14,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                shadowColor: COLORS.accent,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Calculator size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 }}>
                Открыть калькулятор сметы
              </Text>
            </Touchable>

            {/* Secondary actions — 3 tiles */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
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

            {/* Project data */}
            <Card style={{ padding: 16 }}>
              <SectionHeader title="Данные проекта" />
              <ProjectField label="Клиент" value={order.client} order={order} field="client" placeholder="Имя клиента" />
              <ProjectField label="Телефон" value={order.phone} order={order} field="phone" placeholder="+7 (900) 000-00-00" isPhone keyboardType="phone-pad" />
              <ProjectField label="Адрес" value={order.address} order={order} field="address" placeholder="Город, улица, дом" multiline />
              {order.address && (
                <Touchable
                  onPress={() => openRouteForAddress(order.address!)}
                  haptic="light"
                  style={{
                    marginTop: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: COLORS.accentSoft,
                  }}
                >
                  <MapPin size={13} color={COLORS.accent} strokeWidth={2.2} />
                  <Text style={{ color: COLORS.accent, fontSize: 12, fontWeight: '700' }}>Проложить маршрут</Text>
                </Touchable>
              )}
              <View style={{ height: 8 }} />
              <ProjectField label="Дизайнер" value={order.designer} order={order} field="designer" placeholder="Имя дизайнера" />
              <ProjectField label="Заметки" value={order.notes} order={order} field="notes" placeholder="Заметки по проекту" multiline />
            </Card>

            {/* Calendar */}
            <CalendarCard order={order} />
          </View>
        )}

        {tab === 'finance' && (
          <View style={{ padding: 16 }}>
            <HeroCard style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.faint, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 8 }}>
                ОПЛАЧЕНО
              </Text>
              <Text style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: 40, fontWeight: '700' }}>
                {fmt(totalPaid)}<Text style={{ fontSize: 22, color: COLORS.faint }}> ₽</Text>
              </Text>
            </HeroCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 8 }}>
              <Lock size={14} color={COLORS.muted} strokeWidth={2} />
              <Text style={{ color: COLORS.muted, fontSize: 13 }}>Доступно в PRO</Text>
            </View>
          </View>
        )}

        {tab === 'salary' && (
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 }}>
              <Lock size={14} color={COLORS.muted} strokeWidth={2} />
              <Text style={{ color: COLORS.muted, fontSize: 13 }}>Доступно в PRO</Text>
            </View>
          </View>
        )}

        <View className="h-12" />
      </ScrollView>
    </View>
  );
}
