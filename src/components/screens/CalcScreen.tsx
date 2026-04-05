import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Polygon as SvgPolygon, Line, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';
import { useApp, useOrder } from '../../store/AppContext';
import { AppHeader, Button, Card, SectionHeader, Divider, EmptyState } from '../ui';
import { calcPoly, fmt } from '../../utils/geometry';
import { generateId } from '../../utils/storage';
import type { Room, EstimateLine, Vertex } from '../../types';
import CompassBuilder from '../builders/CompassBuilder';

// ─── Constants ────────────────────────────────────────────────────────

const ACC = '#4F46E5';
const DARK = '#1e2030';

// ─── Room Mini Preview ────────────────────────────────────────────────

function RoomMini({ verts, size = 80 }: { verts: Vertex[]; size?: number }) {
  if (!verts || verts.length < 2) {
    return (
      <View
        style={{ width: size, height: size }}
        className="bg-bg rounded-xl items-center justify-center border border-border"
      >
        <Text className="text-muted text-xs">—</Text>
      </View>
    );
  }

  const pad = 8;
  const xs = verts.map(v => v.x);
  const ys = verts.map(v => v.y);
  const mnx = Math.min(...xs), mny = Math.min(...ys);
  const mxx = Math.max(...xs), mxy = Math.max(...ys);
  const rw = Math.max(mxx - mnx, 0.1);
  const rh = Math.max(mxy - mny, 0.1);
  const sc = Math.min((size - 2 * pad) / rw, (size - 2 * pad) / rh);
  const ox = pad + (size - 2 * pad - rw * sc) / 2;
  const oy = pad + (size - 2 * pad - rh * sc) / 2;
  const pts = verts
    .map(v => `${ox + (v.x - mnx) * sc},${oy + (v.y - mny) * sc}`)
    .join(' ');

  return (
    <Svg width={size} height={size} style={{ borderRadius: 10, backgroundColor: '#fff' }}>
      <SvgPolygon points={pts} fill="rgba(79,70,229,0.08)" stroke={ACC} strokeWidth={1.5} />
    </Svg>
  );
}

// ─── Estimate Line Row ────────────────────────────────────────────────

function EstRow({
  line,
  edits,
  onChangeQty,
  onChangePrice,
}: {
  line: EstimateLine;
  edits: { q?: number; p?: number };
  onChangeQty: (v: number) => void;
  onChangePrice: (v: number) => void;
}) {
  const q = edits.q ?? line.q;
  const p = edits.p ?? line.p;
  const total = q * p;

  return (
    <View className="py-2.5 border-b border-border">
      <Text className="text-navy text-xs font-medium mb-1.5" numberOfLines={1}>
        {line.n}
      </Text>
      <View className="flex-row items-center gap-2">
        {/* Qty */}
        <NumInput
          value={q}
          unit={line.u}
          onChange={onChangeQty}
          width={64}
        />
        <Text className="text-muted text-xs">×</Text>
        {/* Price */}
        <NumInput
          value={p}
          unit="₽"
          onChange={onChangePrice}
          width={64}
        />
        <Text className="text-muted text-xs">=</Text>
        <Text className="text-accent text-xs font-bold ml-auto">
          {fmt(total)} ₽
        </Text>
      </View>
    </View>
  );
}

// ─── Numeric Input ────────────────────────────────────────────────────

function NumInput({
  value,
  unit,
  onChange,
  width = 60,
}: {
  value: number;
  unit: string;
  onChange: (v: number) => void;
  width?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState('');

  if (editing) {
    return (
      <TextInput
        value={tmp}
        onChangeText={setTmp}
        keyboardType="decimal-pad"
        returnKeyType="done"
        autoFocus
        onBlur={() => {
          onChange(parseFloat(tmp.replace(',', '.')) || 0);
          setEditing(false);
        }}
        onSubmitEditing={() => {
          onChange(parseFloat(tmp.replace(',', '.')) || 0);
          setEditing(false);
        }}
        style={{ width }}
        className="bg-bg border border-accent rounded-lg px-2 py-1 text-navy text-xs text-center"
      />
    );
  }

  return (
    <TouchableOpacity
      onPress={() => { setTmp(String(value)); setEditing(true); }}
      style={{ width }}
      className="bg-bg border border-border rounded-lg px-2 py-1 items-center"
    >
      <Text className="text-navy text-xs font-medium">
        {fmt(value)} <Text className="text-muted">{unit}</Text>
      </Text>
    </TouchableOpacity>
  );
}

// ─── Build simple estimate from rooms ────────────────────────────────
// (Simplified version — real app would use full buildEst from presets)

function buildSimpleEst(
  rooms: Room[],
  snap?: Record<string, number>
): { mats: EstimateLine[]; works: EstimateLine[] } {
  const mm: Record<string, { n: string; q: number; u: string; p: number }> = {};
  const ww: Record<string, { n: string; q: number; u: string; p: number }> = {};

  for (const r of rooms) {
    if (r.on === false) continue;
    const area = r.aO ?? calcPoly(r.v).a;
    const perim = r.pO ?? calcPoly(r.v).p;

    // Canvas (полотно)
    if (r.canvas.nomId) {
      const key = r.canvas.nomId + '_' + r.id;
      const price = snap?.[r.canvas.nomId] ?? 1000;
      const name = `ПВХ Полотно (${r.name})`;
      if (!mm[key]) mm[key] = { n: name, q: 0, u: 'м²', p: price };
      mm[key].q = Math.round((mm[key].q + area) * 100) / 100;
    } else {
      // default canvas line
      const key = `canvas_${r.id}`;
      const price = snap?.['canvas_default'] ?? 1000;
      mm[key] = { n: `Полотно (${r.name})`, q: Math.round(area * 100) / 100, u: 'м²', p: price };
    }

    // Main profile
    if (perim > 0) {
      const key = r.mainProf.nomId ?? 'profile_default';
      const price = snap?.[key] ?? 360;
      const name = 'Профиль';
      if (!mm[key]) mm[key] = { n: name, q: 0, u: 'м', p: price };
      mm[key].q = Math.round((mm[key].q + perim) * 100) / 100;
    }

    // Work (монтаж)
    const workKey = 'work_mount';
    const workPrice = snap?.[workKey] ?? 500;
    if (!ww[workKey]) ww[workKey] = { n: 'Монтаж натяжного потолка', q: 0, u: 'м²', p: workPrice };
    ww[workKey].q = Math.round((ww[workKey].q + area) * 100) / 100;

    // Options
    for (const opt of r.options ?? []) {
      const price = snap?.[opt.nomId] ?? 0;
      const key = opt.nomId;
      if (!ww[key]) ww[key] = { n: key, q: 0, u: 'шт', p: price };
      ww[key].q = Math.round((ww[key].q + opt.qty) * 100) / 100;
    }
  }

  const mats = Object.entries(mm).map(([k, v], i) => ({
    k: `m${i}`, _k: k, ...v,
  }));
  const works = Object.entries(ww).map(([k, v], i) => ({
    k: `w${i}`, _k: k, ...v,
  }));

  return { mats, works };
}

// ─── Calc Screen ──────────────────────────────────────────────────────

interface CalcScreenProps {
  orderId: string;
}

export default function CalcScreen({ orderId }: CalcScreenProps) {
  const { state, dispatch, updateOrderRooms, updateSnapshot } = useApp();
  const order = useOrder(orderId);
  const router = useRouter();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    order?.rooms?.[0]?.id ?? null
  );
  const [estTab, setEstTab] = useState<'room' | 'all'>('room');
  const [showEst, setShowEst] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderMode, setBuilderMode] = useState<'compass' | 'manual'>('compass');
  const [estEdits, setEstEdits] = useState<Record<string, { q?: number; p?: number }>>({});

  // Local snapshot state (triggers re-render on price edit)
  const [nomSnap, setNomSnap] = useState<Record<string, number>>(
    order?.nomSnapshot ?? {}
  );
  const snapRef = useRef(nomSnap);
  snapRef.current = nomSnap;

  if (!order) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Text className="text-muted">Проект не найден</Text>
      </View>
    );
  }

  const rooms = order.rooms;
  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? rooms[0];

  // Build estimates
  const estAll = buildSimpleEst(rooms, nomSnap);
  const estRoom = activeRoom ? buildSimpleEst([activeRoom], nomSnap) : { mats: [], works: [] };

  const activeMats = estTab === 'room' ? estRoom.mats : estAll.mats;
  const activeWorks = estTab === 'room' ? estRoom.works : estAll.works;

  // Totals with edits applied
  const matTot = activeMats.reduce(
    (s, l) => s + (estEdits[l.k]?.q ?? l.q) * (estEdits[l.k]?.p ?? l.p),
    0
  );
  const workTot = activeWorks.reduce(
    (s, l) => s + (estEdits[l.k]?.q ?? l.q) * (estEdits[l.k]?.p ?? l.p),
    0
  );
  const grand = matTot + workTot;

  const handlePriceEdit = (lineKey: string, nomId: string, field: 'q' | 'p', val: number) => {
    setEstEdits(prev => ({ ...prev, [lineKey]: { ...prev[lineKey], [field]: val } }));
    if (field === 'p') {
      const newSnap = { ...snapRef.current, [nomId]: val };
      snapRef.current = newSnap;
      setNomSnap(newSnap);
      updateSnapshot(order.id, newSnap);
    }
  };

  const handleAddRoom = (room: Room) => {
    const updated = [...rooms, room];
    updateOrderRooms(order.id, updated);
    setActiveRoomId(room.id);
    setShowBuilder(false);
  };

  const handleDeleteRoom = (roomId: string) => {
    Alert.alert('Удалить помещение?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          const updated = rooms.filter(r => r.id !== roomId);
          updateOrderRooms(order.id, updated);
          if (activeRoomId === roomId) {
            setActiveRoomId(updated[0]?.id ?? null);
          }
        },
      },
    ]);
  };

  const handleRefreshPrices = () => {
    // Reset edits and snapshot to recalculate
    setEstEdits({});
    const fresh: Record<string, number> = {};
    setNomSnap(fresh);
    updateSnapshot(order.id, fresh);
  };

  // Builder modal
  if (showBuilder) {
    return (
      <CompassBuilder
        existingCount={rooms.length}
        onFinish={handleAddRoom}
        onBack={() => setShowBuilder(false)}
      />
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="bg-white border-b border-border">
        <View className="flex-row items-center px-4 pt-12 pb-2 gap-3">
          {/* Back + logo */}
          <View className="flex-row items-center gap-2 flex-shrink-0">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center"
            >
              <Text className="text-navy text-xl font-bold">‹</Text>
            </TouchableOpacity>
            <View className="w-9 h-9 rounded-[9px] bg-navy items-center justify-center">
              <View className="gap-[3px]">
                <View className="w-[14px] h-[2px] rounded-sm bg-accent" />
                <View className="w-[10px] h-[2px] rounded-sm bg-accent opacity-60" />
                <View className="w-[7px] h-[2px] rounded-sm bg-accent opacity-30" />
              </View>
            </View>
            <View>
              <Text className="text-[13px] font-bold tracking-widest text-navy">MAGIC</Text>
              <Text className="text-[9px] font-semibold tracking-[3px] text-accent -mt-0.5">КАЛЬКУЛЯТОР</Text>
            </View>
          </View>

          {/* Total + refresh */}
          <View className="flex-1 items-end">
            <Text className="text-base font-black text-navy">{fmt(grand)} ₽</Text>
            <TouchableOpacity onPress={handleRefreshPrices}>
              <Text className="text-[10px] text-accent">🔄 обновить цены</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Order name + builder buttons */}
        <View className="flex-row items-center px-4 pb-2.5 gap-2">
          <Text className="text-xs text-muted flex-1" numberOfLines={1}>
            {order.name}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-shrink-0">
            <View className="flex-row gap-1.5">
              {[
                { label: 'Обводка', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.2)' },
                { label: 'AI', color: '#7c5cbf', bg: 'rgba(124,92,191,0.08)', border: 'rgba(124,92,191,0.2)' },
                { label: 'Замер 🧭', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
                { label: 'Ручн.', color: '#888', bg: '#f2f3fa', border: '#eeeef8' },
              ].map(b => (
                <TouchableOpacity
                  key={b.label}
                  onPress={() => {
                    if (b.label.includes('Замер')) setShowBuilder(true);
                    else Alert.alert('Скоро', `${b.label} — в разработке`);
                  }}
                  style={{ backgroundColor: b.bg, borderColor: b.border, borderWidth: 0.5 }}
                  className="px-2.5 py-1.5 rounded-lg"
                >
                  <Text style={{ color: b.color }} className="text-[10px] font-semibold">
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-accent" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Room tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="py-2 bg-white border-b border-border"
          contentContainerClassName="px-3 gap-2"
        >
          {rooms.map(rm => (
            <TouchableOpacity
              key={rm.id}
              onPress={() => setActiveRoomId(rm.id)}
              onLongPress={() => handleDeleteRoom(rm.id)}
              className={`px-3 py-2 rounded-xl border ${
                rm.id === activeRoomId
                  ? 'bg-navy border-navy'
                  : 'bg-white border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  rm.id === activeRoomId ? 'text-white' : 'text-muted'
                }`}
              >
                {rm.name}
              </Text>
              {rm.aO != null && (
                <Text
                  className={`text-[10px] mt-0.5 ${
                    rm.id === activeRoomId ? 'text-white/60' : 'text-muted'
                  }`}
                >
                  {fmt(rm.aO)} м²
                </Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowBuilder(true)}
            className="px-3 py-2 rounded-xl border border-dashed border-border items-center justify-center"
          >
            <Text className="text-muted text-xs">+ Помещение</Text>
          </TouchableOpacity>
        </ScrollView>

        <View className="p-3 gap-3">
          {/* Room mini plan */}
          {activeRoom ? (
            <Card className="p-3">
              <View className="flex-row gap-3 items-start">
                <RoomMini verts={activeRoom.v} size={90} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-navy mb-1">
                    {activeRoom.name}
                  </Text>
                  <View className="gap-1">
                    <View className="flex-row gap-2">
                      <Text className="text-muted text-xs">Площадь:</Text>
                      <Text className="text-accent text-xs font-bold">
                        {fmt(activeRoom.aO ?? calcPoly(activeRoom.v).a)} м²
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Text className="text-muted text-xs">Периметр:</Text>
                      <Text className="text-navy text-xs font-semibold">
                        {fmt(activeRoom.pO ?? calcPoly(activeRoom.v).p)} м.п.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Card>
          ) : (
            <EmptyState
              icon="📐"
              title="Нет помещений"
              desc="Добавьте помещение с помощью компаса, обводки или вручную"
              action={
                <Button
                  label="🧭 Добавить по компасу"
                  onPress={() => setShowBuilder(true)}
                />
              }
            />
          )}

          {/* Estimate block */}
          {rooms.length > 0 && (
            <Card className="overflow-hidden">
              {/* Estimate header */}
              <TouchableOpacity
                onPress={() => setShowEst(v => !v)}
                className="flex-row items-center justify-between px-3 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <View className="w-7 h-7 rounded-lg bg-accent-light items-center justify-center">
                    <Text className="text-xs">📋</Text>
                  </View>
                  <Text className="text-sm font-bold text-navy">Смета</Text>
                  <Text className="text-muted text-xs">{showEst ? '▲' : '▼'}</Text>
                </View>

                {/* Tab switcher */}
                <View className="flex-row gap-1">
                  <TouchableOpacity
                    onPress={e => { e.stopPropagation?.(); setEstTab('room'); }}
                    className={`px-2.5 py-1 rounded-lg ${estTab === 'room' ? 'bg-navy' : 'bg-bg'}`}
                  >
                    <Text className={`text-[10px] font-semibold ${estTab === 'room' ? 'text-white' : 'text-muted'}`}>
                      {activeRoom?.name?.slice(0, 10) ?? 'Комната'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={e => { e.stopPropagation?.(); setEstTab('all'); }}
                    className={`px-2.5 py-1 rounded-lg ${estTab === 'all' ? 'bg-navy' : 'bg-bg'}`}
                  >
                    <Text className={`text-[10px] font-semibold ${estTab === 'all' ? 'text-white' : 'text-muted'}`}>
                      Все
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Total */}
                <TouchableOpacity onPress={() => setShowEst(v => !v)}>
                  <Text className="text-base font-black text-navy">{fmt(grand)} ₽</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {showEst && (
                <View className="px-3 pb-3 border-t border-border">
                  {/* Mats */}
                  {activeMats.length > 0 && (
                    <>
                      <Text className="text-[9px] font-bold text-accent tracking-widest mt-3 mb-1">
                        МАТЕРИАЛЫ
                      </Text>
                      {activeMats.map(l => (
                        <EstRow
                          key={l.k}
                          line={l}
                          edits={estEdits[l.k] ?? {}}
                          onChangeQty={v => handlePriceEdit(l.k, l._k, 'q', v)}
                          onChangePrice={v => handlePriceEdit(l.k, l._k, 'p', v)}
                        />
                      ))}
                      <View className="flex-row justify-between py-2 border-b border-border">
                        <Text className="text-xs font-bold text-navy">Материалы:</Text>
                        <Text className="text-xs font-bold text-accent">{fmt(matTot)} ₽</Text>
                      </View>
                    </>
                  )}

                  {/* Works */}
                  {activeWorks.length > 0 && (
                    <>
                      <Text className="text-[9px] font-bold text-success tracking-widest mt-3 mb-1">
                        РАБОТЫ
                      </Text>
                      {activeWorks.map(l => (
                        <EstRow
                          key={l.k}
                          line={l}
                          edits={estEdits[l.k] ?? {}}
                          onChangeQty={v => handlePriceEdit(l.k, l._k, 'q', v)}
                          onChangePrice={v => handlePriceEdit(l.k, l._k, 'p', v)}
                        />
                      ))}
                      <View className="flex-row justify-between py-2 border-b border-border">
                        <Text className="text-xs font-bold text-navy">Работы:</Text>
                        <Text className="text-xs font-bold text-success">{fmt(workTot)} ₽</Text>
                      </View>
                    </>
                  )}

                  {/* Grand total */}
                  <View className="bg-navy rounded-xl p-3 mt-3">
                    <View className="flex-row justify-between">
                      <Text className="text-white/50 text-xs font-bold tracking-wider">ИТОГО</Text>
                      <Text className="text-white text-lg font-black">{fmt(grand)} ₽</Text>
                    </View>
                    <Text className="text-white/30 text-[10px] mt-0.5">
                      {fmt(matTot)} мат · {fmt(workTot)} раб
                    </Text>
                  </View>

                  {Object.keys(estEdits).length > 0 && (
                    <TouchableOpacity
                      onPress={() => setEstEdits({})}
                      className="mt-2 py-2 items-center border border-border rounded-xl"
                    >
                      <Text className="text-muted text-xs">Сбросить правки</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Card>
          )}
        </View>

        <View className="h-16" />
      </ScrollView>
    </View>
  );
}
