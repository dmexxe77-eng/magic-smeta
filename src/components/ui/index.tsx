import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { vars } from 'nativewind';
import { ChevronLeft, Menu } from 'lucide-react-native';

// ═══════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Liquid Glass (iOS 26) — dual theme (mutable for swap)
// ═══════════════════════════════════════════════════════════════════════

export type ThemeName = 'light' | 'dark';

export interface Palette {
  bg: string;
  bg2: string;
  card: string;
  surface2: string;
  border: string;
  borderStrong: string;
  glass: string;
  glassHi: string;
  glassEdge: string;
  glassDeep: string;
  ink: string;
  muted: string;
  subtle: string;
  faint: string;
  accent: string;
  accentInk: string;
  accentBright: string;
  accentSoft: string;
  accentGlow: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  // Hero card always stays dark with accent glow regardless of theme
  heroBg: string;
  heroTint: string;
  heroText: string;
  heroTextMuted: string;
  // Status bar
  statusBarStyle: 'light' | 'dark';
}

const DARK_PALETTE: Palette = {
  bg:           '#0A0E1A',
  bg2:          '#0F1424',
  card:         '#15192A',
  surface2:     '#1B2138',
  border:       '#262C44',
  borderStrong: '#3A4264',
  glass:        'rgba(255,255,255,0.06)',
  glassHi:      'rgba(255,255,255,0.10)',
  glassEdge:    'rgba(255,255,255,0.16)',
  glassDeep:    'rgba(10,14,26,0.55)',
  ink:          '#F2F4FA',
  muted:        '#9BA3BD',
  subtle:       '#6B7290',
  faint:        '#4A5170',
  accent:       '#0A84FF',
  accentInk:    '#0066CC',
  accentBright: '#3FA3FF',
  accentSoft:   'rgba(10,132,255,0.16)',
  accentGlow:   'rgba(10,132,255,0.35)',
  success:      '#30D158',
  warning:      '#FF9F0A',
  danger:       '#FF453A',
  info:         '#64D2FF',
  heroBg:       '#15192A',
  heroTint:     'rgba(40,50,90,0.45)',
  heroText:     '#FFFFFF',
  heroTextMuted:'#9BA3BD',
  statusBarStyle: 'light',
};

const LIGHT_PALETTE: Palette = {
  bg:           '#F2F4FA',
  bg2:          '#FFFFFF',
  card:         '#FFFFFF',
  surface2:     '#EBEEF5',
  border:       '#D6DCE8',
  borderStrong: '#B8BFD0',
  glass:        'rgba(10,14,26,0.04)',
  glassHi:      'rgba(10,14,26,0.07)',
  glassEdge:    'rgba(10,14,26,0.12)',
  glassDeep:    'rgba(255,255,255,0.7)',
  ink:          '#0A0E1A',
  muted:        '#5A6280',
  subtle:       '#8B92AC',
  faint:        '#B5BBCC',
  accent:       '#0A84FF',
  accentInk:    '#0066CC',
  accentBright: '#3FA3FF',
  accentSoft:   'rgba(10,132,255,0.10)',
  accentGlow:   'rgba(10,132,255,0.25)',
  success:      '#2E9B47',
  warning:      '#E5811A',
  danger:       '#D93025',
  info:         '#0066CC',
  // Hero stays dark in both themes for visual punctuation
  heroBg:       '#15192A',
  heroTint:     'rgba(40,50,90,0.45)',
  heroText:     '#FFFFFF',
  heroTextMuted:'#9BA3BD',
  statusBarStyle: 'dark',
};

// Mutable export — gets overwritten by applyTheme()
export const COLORS: Palette = { ...DARK_PALETTE };

export function applyTheme(theme: ThemeName) {
  Object.assign(COLORS, theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE);
}

// Build CSS-variable style object for the active theme.
// Apply this to the root <View> so all `className="bg-bg"` etc. resolve correctly.
export function themeVars(theme: ThemeName) {
  const p = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  return vars({
    '--bg':            p.bg,
    '--bg2':           p.bg2,
    '--card':          p.card,
    '--surface2':      p.surface2,
    '--border':        p.border,
    '--border-strong': p.borderStrong,
    '--ink':           p.ink,
    '--muted':         p.muted,
    '--subtle':        p.subtle,
    '--faint':         p.faint,
    '--accent':        p.accent,
    '--accent-ink':    p.accentInk,
    '--accent-bright': p.accentBright,
    '--accent-soft':   p.accentSoft,
    '--success':       p.success,
    '--warning':       p.warning,
    '--danger':        p.danger,
    '--info':          p.info,
  });
}

export const SERIF = 'System';

// ═══════════════════════════════════════════════════════════════════════
// GlassPanel — translucent surface with edge highlight (pure RN)
// ═══════════════════════════════════════════════════════════════════════

export function GlassPanel({
  children, style, radius = 16, intensity = 'soft',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: 'soft' | 'strong';
}) {
  const bg = intensity === 'strong' ? COLORS.glassHi : COLORS.glass;
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      {/* Base translucent fill */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: bg,
        }}
      />
      {/* Top highlight strip */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          backgroundColor: 'rgba(255,255,255,0.22)',
        }}
      />
      {/* Edge stroke */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: COLORS.glassEdge,
        }}
      />
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Touchable — animated press + haptics (spring physics)
// ═══════════════════════════════════════════════════════════════════════

type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'warning' | 'success' | 'none';

const HAPTIC_MAP: Record<Exclude<HapticType, 'none'>, () => Promise<void>> = {
  light:     () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium:    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy:     () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  selection: () => Haptics.selectionAsync(),
  warning:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  success:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  haptic?: HapticType;
  scale?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Touchable({
  children, haptic = 'light', scale = 0.97, onPress, style, className, ...rest
}: TouchableProps) {
  const anim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(anim, { toValue: scale, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  const handlePress = (e: any) => {
    if (haptic !== 'none') HAPTIC_MAP[haptic]().catch(() => {});
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={className}
      style={[style as any, { transform: [{ scale: anim }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Toggle — glass with accent glow
// ═══════════════════════════════════════════════════════════════════════

export function Toggle({ value, onValueChange, color = COLORS.accent }: {
  value: boolean; onValueChange: (v: boolean) => void; color?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onValueChange(!value);
      }}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      style={{
        width: 42, height: 24, borderRadius: 12, padding: 2,
        backgroundColor: value ? color : 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: value ? color : 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        shadowColor: value ? color : 'transparent',
        shadowOpacity: value ? 0.6 : 0,
        shadowRadius: value ? 8 : 0,
      }}
    >
      <View style={{
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: '#FFFFFF',
        marginLeft: value ? 18 : 0,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
      }} />
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Checkbox
// ═══════════════════════════════════════════════════════════════════════

export function Checkbox({ checked, onToggle, label, color = COLORS.accent }: {
  checked: boolean; onToggle: () => void; label?: string; color?: string;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggle(); }}
      hitSlop={6}
      className="flex-row items-center gap-2"
    >
      <View style={{
        width: 20, height: 20, borderRadius: 6,
        borderWidth: 1.5,
        borderColor: checked ? color : 'rgba(255,255,255,0.2)',
        backgroundColor: checked ? color : 'rgba(255,255,255,0.04)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 13 }}>✓</Text>}
      </View>
      {label && (
        <Text style={{ fontSize: 12, fontWeight: '600', color: checked ? COLORS.ink : COLORS.muted }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BrandMark — accent-tinted slab with content lines
// ═══════════════════════════════════════════════════════════════════════

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.3,
      backgroundColor: COLORS.accent,
      overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: COLORS.accent,
      shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    }}>
      <View style={{
        width: size * 0.5, height: size * 0.5,
        justifyContent: 'space-between',
      }}>
        <View style={{ height: 2, backgroundColor: '#FFFFFF', borderRadius: 1 }} />
        <View style={{ height: 2, width: '70%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
        <View style={{ height: 2, width: '40%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
      </View>
      {/* Top glass highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
          backgroundColor: 'rgba(255,255,255,0.22)',
        }}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AppHeader
// ═══════════════════════════════════════════════════════════════════════

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  titleLabel?: string;
  onBack?: () => void;
  onMenu?: () => void;
  rightContent?: React.ReactNode;
}

export function AppHeader({
  title, subtitle, titleLabel, onBack, onMenu, rightContent,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: COLORS.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: COLORS.bg2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack && (
            <Touchable
              haptic="light"
              onPress={onBack}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: COLORS.glass,
                borderWidth: 1, borderColor: COLORS.glassEdge,
                alignItems: 'center', justifyContent: 'center', marginRight: 10,
              }}
            >
              <ChevronLeft size={20} color={COLORS.ink} strokeWidth={2.2} />
            </Touchable>
          )}

          <BrandMark size={36} />

          <View style={{ marginLeft: 12, flexShrink: 1, flex: 1 }}>
            {titleLabel && (
              <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2.2, color: COLORS.subtle, marginBottom: 1 }}>
                {titleLabel.toUpperCase()}
              </Text>
            )}
            <Text
              numberOfLines={1}
              style={{
                fontSize: titleLabel ? 16 : 17,
                fontWeight: '700',
                letterSpacing: -0.3,
                color: COLORS.ink,
                lineHeight: titleLabel ? 19 : 20,
              }}
            >
              {title ?? 'Magic'}
            </Text>
            {subtitle && (
              <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 1.5, color: COLORS.accent, marginTop: 1 }}>
                {subtitle.toUpperCase()}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {rightContent}
            {onMenu && (
              <Touchable
                haptic="light"
                onPress={onMenu}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: COLORS.glass,
                  borderWidth: 1, borderColor: COLORS.glassEdge,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Menu size={18} color={COLORS.ink} strokeWidth={2.2} />
              </Touchable>
            )}
          </View>
        </View>
      </View>
      {/* Thin accent glow line */}
      <View style={{ height: 1, backgroundColor: COLORS.accent, opacity: 0.6 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Card — glass panel
// ═══════════════════════════════════════════════════════════════════════

type CardVariant = 'default' | 'flat' | 'elevated' | 'hero' | 'glass';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: CardVariant;
}

export function Card({ children, className = '', style, onPress, variant = 'default' }: CardProps) {
  const Content = (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: variant === 'flat' ? COLORS.surface2 : COLORS.glass,
          borderRadius: 16,
        }}
      />
      {variant !== 'flat' && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            backgroundColor: 'rgba(255,255,255,0.16)',
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
          }}
        />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: variant === 'flat' ? COLORS.border : COLORS.glassEdge,
        }}
      />
      {children}
    </>
  );

  if (onPress) {
    return (
      <Touchable haptic="light" onPress={onPress} className={className} style={[{ borderRadius: 16, overflow: 'hidden' }, style]}>
        {Content}
      </Touchable>
    );
  }
  return (
    <View className={className} style={[{ borderRadius: 16, overflow: 'hidden' }, style]}>
      {Content}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Button
// ═══════════════════════════════════════════════════════════════════════

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ink';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label, onPress,
  variant = 'primary', size = 'md',
  disabled = false, loading = false,
  icon, className = '', style,
}: ButtonProps) {
  const sizes = {
    sm: { px: 14, py: 8,  fs: 12, radius: 999 },
    md: { px: 20, py: 13, fs: 14, radius: 999 },
    lg: { px: 24, py: 16, fs: 15, radius: 999 },
  };
  const s = sizes[size];

  const variantStyles = {
    primary:   { bg: COLORS.accent, text: '#FFFFFF', border: COLORS.accent, glow: true },
    ink:       { bg: COLORS.glassHi, text: COLORS.ink, border: COLORS.glassEdge, glow: false },
    secondary: { bg: COLORS.glass,   text: COLORS.ink, border: COLORS.glassEdge, glow: false },
    danger:    { bg: 'rgba(255,69,58,0.18)', text: COLORS.danger, border: 'rgba(255,69,58,0.4)', glow: false },
    ghost:     { bg: 'transparent',  text: COLORS.accent, border: 'transparent', glow: false },
  } as const;
  const v = variantStyles[variant];

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === 'danger' ? 'warning' : 'medium'}
      className={className}
      style={[{
        backgroundColor: v.bg,
        paddingHorizontal: s.px,
        paddingVertical: s.py,
        borderRadius: s.radius,
        borderWidth: 1,
        borderColor: v.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.4 : 1,
        overflow: 'hidden',
        shadowColor: v.glow ? COLORS.accent : undefined,
        shadowOpacity: v.glow ? 0.5 : 0,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
      }, style]}
    >
      {/* Top glass highlight for primary */}
      {variant === 'primary' && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            backgroundColor: 'rgba(255,255,255,0.20)',
          }}
        />
      )}
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={{ color: v.text, fontSize: s.fs, fontWeight: '700', letterSpacing: 0.2 }}>
            {label}
          </Text>
        </>
      )}
    </Touchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Badge
// ═══════════════════════════════════════════════════════════════════════

interface BadgeProps {
  label: string;
  color?: 'accent' | 'green' | 'orange' | 'red' | 'gray' | 'ink';
  variant?: 'soft' | 'solid' | 'outline';
  onPress?: () => void;
}

const BADGE_PALETTE: Record<NonNullable<BadgeProps['color']>, { bg: string; tint: string; border: string; text: string }> = {
  accent: { bg: COLORS.accent,  tint: 'rgba(10,132,255,0.15)',  border: 'rgba(10,132,255,0.45)',  text: '#5AB0FF' },
  green:  { bg: COLORS.success, tint: 'rgba(48,209,88,0.15)',   border: 'rgba(48,209,88,0.45)',   text: '#5BE07F' },
  orange: { bg: COLORS.warning, tint: 'rgba(255,159,10,0.15)',  border: 'rgba(255,159,10,0.45)',  text: '#FFB849' },
  red:    { bg: COLORS.danger,  tint: 'rgba(255,69,58,0.15)',   border: 'rgba(255,69,58,0.45)',   text: '#FF7A70' },
  gray:   { bg: COLORS.muted,   tint: 'rgba(155,163,189,0.15)', border: 'rgba(155,163,189,0.35)', text: COLORS.muted },
  ink:    { bg: COLORS.ink,     tint: COLORS.glass,             border: COLORS.glassEdge,         text: COLORS.ink },
};

export function Badge({ label, color = 'accent', variant = 'soft', onPress }: BadgeProps) {
  const p = BADGE_PALETTE[color];
  const styles: ViewStyle = (() => {
    switch (variant) {
      case 'solid':   return { backgroundColor: p.bg, borderWidth: 0 };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.border };
      default:        return { backgroundColor: p.tint, borderWidth: 1, borderColor: p.border };
    }
  })();
  const textColor = variant === 'solid' ? '#FFFFFF' : p.text;

  const Comp = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }, styles]}
    >
      <Text style={{ color: textColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
        {label}
      </Text>
    </Comp>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FormField
// ═══════════════════════════════════════════════════════════════════════

interface FormFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad';
  multiline?: boolean;
  className?: string;
}

export function FormField({
  label, value, onChangeText, placeholder,
  keyboardType = 'default', multiline = false, className = '',
}: FormFieldProps) {
  return (
    <View className={`mb-3 ${className}`}>
      {label && (
        <Text style={{
          fontSize: 10, fontWeight: '700', letterSpacing: 1.6,
          color: COLORS.subtle, marginBottom: 6,
        }}>
          {label.toUpperCase()}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          if ((keyboardType === 'numeric' || keyboardType === 'decimal-pad') && value === '0') {
            onChangeText('');
          }
        }}
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor={COLORS.subtle}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: COLORS.glass,
          borderWidth: 1,
          borderColor: COLORS.glassEdge,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: COLORS.ink,
          fontSize: 14,
          minHeight: multiline ? 84 : undefined,
          textAlignVertical: multiline ? 'top' : 'auto',
        }}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SectionHeader
// ═══════════════════════════════════════════════════════════════════════

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 14, height: 1.5, backgroundColor: COLORS.accent, borderRadius: 1 }} />
        <Text style={{
          fontSize: 10, fontWeight: '700', color: COLORS.muted,
          letterSpacing: 2,
        }}>
          {title.toUpperCase()}
        </Text>
      </View>
      {right}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// EmptyState
// ═══════════════════════════════════════════════════════════════════════

export function EmptyState({
  icon, title, desc, action,
}: {
  icon: string | React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 32, paddingVertical: 64,
    }}>
      {typeof icon === 'string' ? (
        <Text style={{ fontSize: 44, marginBottom: 14 }}>{icon}</Text>
      ) : (
        <View style={{
          marginBottom: 16, width: 64, height: 64, borderRadius: 32,
          backgroundColor: COLORS.glass,
          borderWidth: 1, borderColor: COLORS.glassEdge,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </View>
      )}
      <Text style={{
        fontSize: 19, fontWeight: '700', color: COLORS.ink,
        textAlign: 'center', marginBottom: 6, letterSpacing: -0.3,
      }}>
        {title}
      </Text>
      {desc && (
        <Text style={{
          color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 22,
        }}>
          {desc}
        </Text>
      )}
      {action}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Divider
// ═══════════════════════════════════════════════════════════════════════

export function Divider({ className = '', vertical = false }: { className?: string; vertical?: boolean }) {
  if (vertical) return <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: COLORS.border }} className={className} />;
  return <View style={{ height: 1, backgroundColor: COLORS.border }} className={className} />;
}

// ═══════════════════════════════════════════════════════════════════════
// FAB — accent with glow
// ═══════════════════════════════════════════════════════════════════════

export function FAB({ icon, onPress, label }: {
  icon: React.ReactNode;
  onPress: () => void;
  label?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      position: 'absolute',
      right: 18,
      bottom: insets.bottom + 70,
      shadowColor: COLORS.accent,
      shadowOpacity: 0.55,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    }}>
      <Touchable
        haptic="medium"
        onPress={onPress}
        scale={0.9}
        style={{
          height: 58,
          borderRadius: 29,
          width: label ? undefined : 58,
          paddingHorizontal: label ? 22 : 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: COLORS.accent,
          overflow: 'hidden',
        }}
      >
        {/* Top highlight for glass effect */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            backgroundColor: 'rgba(255,255,255,0.22)',
          }}
        />
        {icon}
        {label && (
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 }}>
            {label}
          </Text>
        )}
      </Touchable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SegmentedControl
// ═══════════════════════════════════════════════════════════════════════

export function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: COLORS.glass,
      borderWidth: 1,
      borderColor: COLORS.glassEdge,
      padding: 4,
      borderRadius: 999,
    }}>
      {options.map(opt => {
        const active = value === opt.id;
        return (
          <Touchable
            key={opt.id}
            haptic="selection"
            scale={0.97}
            onPress={() => onChange(opt.id)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? COLORS.glassHi : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: COLORS.glassEdge,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: active ? '700' : '600',
              color: active ? COLORS.ink : COLORS.muted,
              letterSpacing: 0.2,
            }}>
              {opt.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HeroCard — deep glass slab with accent corner glow
// ═══════════════════════════════════════════════════════════════════════

export function HeroCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ borderRadius: 22, overflow: 'hidden', backgroundColor: COLORS.heroBg }, style]}>
      {/* Slight gradient-like base (lighter top, darker bottom via overlapping layers) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: COLORS.heroTint,
        }}
      />
      {/* Accent corner glow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: -50, right: -50,
          width: 180, height: 180, borderRadius: 90,
          backgroundColor: COLORS.accent,
          opacity: 0.28,
        }}
      />
      {/* Secondary highlight from top */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 50,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />
      {/* Edge stroke */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
        }}
      />
      {/* Top hairline */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          backgroundColor: 'rgba(255,255,255,0.28)',
        }}
      />
      <View style={{ padding: 22 }}>
        {children}
      </View>
    </View>
  );
}

// Compatibility export — some screens may still import GlassSurface
export const GlassSurface = GlassPanel;
