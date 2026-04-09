import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Polygon } from 'react-native-svg';
import { useCompass } from '../../hooks/useCompass';
import { AppHeader, Button } from '../ui';
import { buildVerticesFromSides, calcPoly, snapAngle, fmt } from '../../utils/geometry';
import type { Room } from '../../types';
import { generateId } from '../../utils/storage';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface Side {
  angle: number;
  cm: number;
}

interface CompassBuilderProps {
  existingCount: number;
  onFinish: (room: Room) => void;
  onBack: () => void;
}

// ─── Compass Dial SVG ─────────────────────────────────────────────────

function CompassDial({ heading, size = 140 }: { heading: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  const needleRad = ((heading - 90) * Math.PI) / 180;
  const nx = cx + Math.cos(needleRad) * (r - 18);
  const ny = cy + Math.sin(needleRad) * (r - 18);
  const sx = cx - Math.cos(needleRad) * (r - 30);
  const sy = cy - Math.sin(needleRad) * (r - 30);

  const dirs = [
    { label: 'С', deg: 0, color: '#dc2626' },
    { label: 'В', deg: 90, color: '#4F46E5' },
    { label: 'Ю', deg: 180, color: '#b0b0ba' },
    { label: 'З', deg: 270, color: '#b0b0ba' },
  ];

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="#f7f7f5" stroke="#e8e8e4" strokeWidth={1.5} />
      <Circle cx={cx} cy={cy} r={r - 22} fill="white" stroke="#e8e8e4" strokeWidth={0.8} />

      {/* Tick marks */}
      {Array.from({ length: 36 }).map((_, i) => {
        const rd = ((i * 10 - 90) * Math.PI) / 180;
        const isBig = i % 9 === 0;
        return (
          <Line
            key={i}
            x1={cx + Math.cos(rd) * (r - 20)}
            y1={cy + Math.sin(rd) * (r - 20)}
            x2={cx + Math.cos(rd) * (r - (isBig ? 28 : 24))}
            y2={cy + Math.sin(rd) * (r - (isBig ? 28 : 24))}
            stroke={isBig ? '#555' : '#ccc'}
            strokeWidth={isBig ? 1.5 : 0.8}
          />
        );
      })}

      {/* Cardinal labels */}
      {dirs.map(({ label, deg, color }) => {
        const rd = ((deg - 90) * Math.PI) / 180;
        return (
          <SvgText
            key={label}
            x={cx + Math.cos(rd) * (r - 9)}
            y={cy + Math.sin(rd) * (r - 9) + 4}
            textAnchor="middle"
            fill={color}
            fontSize={11}
            fontWeight="700"
          >
            {label}
          </SvgText>
        );
      })}

      {/* Needle */}
      <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#dc2626" strokeWidth={3} strokeLinecap="round" />
      <Line x1={cx} y1={cy} x2={sx} y2={sy} stroke="#999" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={5} fill="#4F46E5" />

      {/* Heading text */}
      <SvgText x={cx} y={cy + 34} textAnchor="middle" fill="#4F46E5" fontSize={14} fontWeight="900">
        {heading}°
      </SvgText>
    </Svg>
  );
}

// ─── Floor Plan Preview ───────────────────────────────────────────────

function FloorPlanPreview({ sides }: { sides: Side[] }) {
  const W = 300;
  const H = 140;
  const pad = 20;

  const pts = buildVerticesFromSides(sides);
  if (pts.length < 2) {
    return (
      <View
        className="bg-bg border border-border rounded-xl h-32 items-center justify-center"
        style={{ width: W }}
      >
        <Text className="text-muted text-xs">Добавьте первую сторону</Text>
      </View>
    );
  }

  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const mnx = Math.min(...xs) - 0.3;
  const mny = Math.min(...ys) - 0.3;
  const mxx = Math.max(...xs) + 0.3;
  const mxy = Math.max(...ys) + 0.3;
  const rw = Math.max(mxx - mnx, 0.5);
  const rh = Math.max(mxy - mny, 0.5);
  const sc = Math.min((W - 2 * pad) / rw, (H - 2 * pad) / rh);
  const ox = pad + (W - 2 * pad - rw * sc) / 2;
  const oy = pad + (H - 2 * pad - rh * sc) / 2;
  const toS = (x: number, y: number) => ({
    sx: ox + (x - mnx) * sc,
    sy: oy + (y - mny) * sc,
  });

  const polyPoints = pts
    .map(p => {
      const { sx, sy } = toS(p.x, p.y);
      return `${sx},${sy}`;
    })
    .join(' ');

  return (
    <Svg width={W} height={H} style={{ borderRadius: 12, backgroundColor: '#fff' }}>
      {pts.length >= 3 && (
        <Polygon points={polyPoints} fill="rgba(79,70,229,0.07)" />
      )}
      {sides.map((s, i) => {
        const { sx: x1, sy: y1 } = toS(pts[i].x, pts[i].y);
        const { sx: x2, sy: y2 } = toS(pts[i + 1].x, pts[i + 1].y);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <React.Fragment key={i}>
            <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4F46E5" strokeWidth={2} />
            <SvgText x={mx} y={my - 4} textAnchor="middle" fill="#4F46E5" fontSize={8} fontWeight="600">
              {s.cm} см
            </SvgText>
          </React.Fragment>
        );
      })}
      {pts.map((p, i) => {
        const { sx, sy } = toS(p.x, p.y);
        return (
          <Circle
            key={i}
            cx={sx}
            cy={sy}
            r={3.5}
            fill={i === 0 ? '#16a34a' : i === pts.length - 1 ? '#f59e0b' : '#4F46E5'}
          />
        );
      })}
    </Svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export default function CompassBuilder({
  existingCount,
  onFinish,
  onBack,
}: CompassBuilderProps) {
  const { heading, snappedHeading, permState, requestPermission } = useCompass();
  const [sides, setSides] = useState<Side[]>([]);
  const [inputCm, setInputCm] = useState('');
  const [roomName, setRoomName] = useState(`Помещение ${existingCount + 1}`);
  const [closed, setClosed] = useState(false);
  const [manualAngle, setManualAngle] = useState(0);
  const [useManual, setUseManual] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const activeAngle = useManual || permState !== 'granted'
    ? manualAngle
    : snappedHeading;

  const addSide = () => {
    const cm = parseFloat(inputCm.replace(',', '.'));
    if (!cm || cm <= 0) return;
    setSides(p => [...p, { angle: activeAngle, cm }]);
    setInputCm('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const undo = () => {
    setSides(p => p.slice(0, -1));
    setClosed(false);
  };

  const finish = () => {
    const pts = buildVerticesFromSides(sides);
    if (pts.length < 3) return;
    const poly = calcPoly(pts);
    const room: Room = {
      id: generateId(),
      name: roomName.trim() || `Помещение ${existingCount + 1}`,
      v: pts,
      aO: Math.round(poly.a * 100) / 100,
      pO: Math.round(poly.p * 100) / 100,
      canvas: { qty: Math.round(poly.a * 100) / 100 },
      mainProf: { qty: Math.round(poly.p * 100) / 100 },
      options: [],
    };
    onFinish(room);
  };

  // Permission screen
  if (permState === 'idle') {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Замер" subtitle="КОМПАС" onBack={onBack} />
        <View className="flex-1 items-center justify-center px-8 gap-5">
          <Text className="text-6xl">🧭</Text>
          <Text className="text-xl font-black text-navy text-center">
            Замер по компасу
          </Text>
          <Text className="text-muted text-sm text-center leading-6">
            Направьте телефон вдоль стены — компас автоматически определит угол.
            Введите длину и обойдите все стены.
          </Text>
          <Button
            label="📍 Разрешить доступ к компасу"
            onPress={requestPermission}
            size="lg"
            className="w-full"
          />
          <Button
            label="Ввести углы вручную"
            onPress={() => {
              setUseManual(true);
              // Treat as granted but manual
            }}
            variant="ghost"
            size="md"
            className="w-full"
          />
        </View>
      </View>
    );
  }

  if (permState === 'denied') {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Компас" onBack={onBack} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-4xl">⚠️</Text>
          <Text className="text-base font-bold text-navy text-center">
            Доступ к компасу запрещён
          </Text>
          <Text className="text-muted text-sm text-center leading-6">
            Разрешите доступ:{'\n'}
            Настройки → Конфиденциальность → Датчики движения
          </Text>
          <Button
            label="Продолжить вручную"
            onPress={() => setUseManual(true)}
            size="md"
          />
        </View>
      </View>
    );
  }

  // Main builder screen
  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title={`Замер · Ст. ${ALPHA[sides.length] ?? '?'}`}
        subtitle={useManual ? 'РУЧНОЙ РЕЖИМ' : 'КОМПАС'}
        onBack={onBack}
        rightContent={
          sides.length > 0 ? (
            <Pressable
              onPress={undo}
              className="bg-red-50 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-danger text-xs font-semibold">↩ Отмена</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Floor plan preview */}
        <View className="items-center mt-3 mb-3">
          <FloorPlanPreview sides={sides} />
        </View>

        {!closed && (
          <View className="px-4">
            {/* Compass + controls */}
            <View className="flex-row gap-4 mb-4">
              {/* Compass dial */}
              <View className="items-center">
                {permState === 'granted' && heading !== null && !useManual ? (
                  <CompassDial heading={heading} size={130} />
                ) : (
                  <View className="w-32 h-32 rounded-full bg-card border border-border items-center justify-center">
                    <Text className="text-xs text-muted text-center px-3">
                      нет{'\n'}сигнала
                    </Text>
                  </View>
                )}
              </View>

              {/* Controls */}
              <View className="flex-1">
                <Text className="text-sm font-bold text-navy mb-2">
                  Сторона {ALPHA[sides.length]}
                </Text>

                {/* Angle display or manual buttons */}
                <View className="mb-3">
                  <Text className="text-xs text-muted mb-1.5">Направление</Text>
                  {useManual || permState !== 'granted' ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
                        <Pressable
                          key={a}
                          onPress={() => setManualAngle(a)}
                          className={`px-2 py-1 rounded-lg border ${
                            manualAngle === a
                              ? 'bg-accent border-accent'
                              : 'bg-card border-border'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              manualAngle === a ? 'text-white' : 'text-muted'
                            }`}
                          >
                            {a}°
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-2xl font-black text-accent">
                      {snappedHeading}°
                    </Text>
                  )}
                </View>

                {/* Length input */}
                <Text className="text-xs text-muted mb-1.5">Длина (см)</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    ref={inputRef}
                    value={inputCm}
                    onChangeText={setInputCm}
                    onSubmitEditing={addSide}
                    placeholder="385"
                    placeholderTextColor="#b0b0ba"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    className="flex-1 bg-card border border-border rounded-xl px-3 py-2.5 text-navy text-base"
                  />
                  <Pressable
                    onPress={addSide}
                    className="bg-accent px-4 py-2.5 rounded-xl items-center justify-center"
                  >
                    <Text className="text-white font-bold text-sm">+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Sides list */}
            {sides.length > 0 && (
              <View className="bg-card border border-border rounded-xl p-3 mb-3">
                <Text className="text-[10px] font-bold text-muted tracking-widest mb-2">
                  ДОБАВЛЕННЫЕ СТОРОНЫ
                </Text>
                {sides.map((s, i) => (
                  <View
                    key={i}
                    className="flex-row justify-between py-2 border-b border-border"
                  >
                    <Text className="text-muted text-xs">
                      {ALPHA[i]} → {ALPHA[i + 1]}
                    </Text>
                    <Text className="text-navy text-xs font-medium">{s.cm} см</Text>
                    <Text className="text-accent text-xs">{s.angle}°</Text>
                  </View>
                ))}
              </View>
            )}

            {sides.length >= 3 && (
              <Button
                label="✓ Замкнуть контур"
                onPress={() => setClosed(true)}
                variant="secondary"
                className="bg-success mb-3"
              />
            )}
          </View>
        )}

        {closed && (
          <View className="px-4">
            <View className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
              <Text className="text-success font-bold text-sm mb-1">
                ✓ Контур замкнут · {sides.length} сторон
              </Text>
              <Text className="text-muted text-xs">
                {(() => {
                  const pts = buildVerticesFromSides(sides);
                  const poly = calcPoly(pts);
                  return `${fmt(poly.a)} м²  ·  ${fmt(poly.p)} м.п.`;
                })()}
              </Text>
            </View>

            <TextInput
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Название помещения"
              placeholderTextColor="#b0b0ba"
              className="bg-card border border-border rounded-xl px-4 py-3 text-navy text-sm mb-4"
            />

            <View className="flex-row gap-3">
              <Button
                label="↩ Изменить"
                onPress={() => {
                  setSides(p => p.slice(0, -1));
                  setClosed(false);
                }}
                variant="ghost"
                className="flex-1"
              />
              <Button
                label="Добавить помещение →"
                onPress={finish}
                className="flex-[2]"
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
