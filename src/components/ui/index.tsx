import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// ─── Touchable (animated press + haptics) ────────────────────────────

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
  scale?: number;          // default 0.97
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function Touchable({
  children,
  haptic = 'light',
  scale = 0.97,
  onPress,
  style,
  className,
  ...rest
}: TouchableProps) {
  const anim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(anim, { toValue: scale, duration: 80, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };
  const handlePress = (e: any) => {
    if (haptic !== 'none') {
      HAPTIC_MAP[haptic]().catch(() => {});
    }
    onPress?.(e);
  };

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, style as any]}
      className={className}
    >
      <Animated.View style={{ transform: [{ scale: anim }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Toggle (replacement for native Switch — bigger, accessible) ─────

export function Toggle({ value, onValueChange, color = '#5E5CE6' }: {
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
        width: 36, height: 20, borderRadius: 10, padding: 2,
        backgroundColor: value ? color : '#D4D4CF',
        justifyContent: 'center',
      }}
    >
      <View style={{
        width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
        marginLeft: value ? 16 : 0,
      }} />
    </Pressable>
  );
}

// ─── Checkbox ────────────────────────────────────────────────────────

export function Checkbox({ checked, onToggle, label, color = '#5E5CE6' }: {
  checked: boolean; onToggle: () => void; label?: string; color?: string;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggle(); }}
      hitSlop={6}
      className="flex-row items-center gap-2"
    >
      <View style={{
        width: 18, height: 18, borderRadius: 4,
        borderWidth: 1.5,
        borderColor: checked ? color : '#9999A3',
        backgroundColor: checked ? color : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 13 }}>✓</Text>}
      </View>
      {label && (
        <Text style={{ fontSize: 12, fontWeight: '600', color: checked ? color : '#5C5C6B' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ─── AppHeader ────────────────────────────────────────────────────────

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  titleLabel?: string;
  onBack?: () => void;
  onMenu?: () => void;
  rightContent?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  titleLabel,
  onBack,
  onMenu,
  rightContent,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Logo + optional back */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
          {onBack && (
            <Pressable
              onPress={onBack}
              style={{
                width: 36, height: 36, borderRadius: 9,
                backgroundColor: '#f7f7f5',
                alignItems: 'center', justifyContent: 'center', marginRight: 8,
              }}
            >
              <Text style={{ color: '#1e2030', fontSize: 20, fontWeight: '700' }}>‹</Text>
            </Pressable>
          )}
          <View style={{
            width: 36, height: 36, borderRadius: 9,
            backgroundColor: '#1e2030',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <View style={{ gap: 3 }}>
              <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: '#4F46E5' }} />
              <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: '#4F46E5', opacity: 0.6 }} />
              <View style={{ width: 7, height: 2, borderRadius: 1, backgroundColor: '#4F46E5', opacity: 0.3 }} />
            </View>
          </View>
          <View style={{ marginLeft: 10, flexShrink: 1 }}>
            {titleLabel && (
              <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 2, color: '#9ca3af', marginBottom: 1 }}>
                {titleLabel}
              </Text>
            )}
            <Text
              numberOfLines={1}
              style={{ fontSize: 14, fontWeight: '700', letterSpacing: titleLabel ? 0.3 : 2, color: '#1e2030' }}
            >
              {title ?? 'MAGIC'}
            </Text>
            <Text style={{ fontSize: 9, fontWeight: '600', letterSpacing: titleLabel ? 0.5 : 3, color: '#4F46E5', marginTop: -2 }}>
              {subtitle ?? 'STUDIO'}
            </Text>
          </View>
        </View>

        {/* Right content */}
        <View className="flex-1 items-end flex-row justify-end gap-2">
          {rightContent}
          {onMenu && (
            <Pressable
              onPress={onMenu}
              className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center"
            >
              <View className="gap-[4px] items-center">
                <View className="w-[15px] h-[1.8px] rounded-sm bg-navy" />
                <View className="w-[15px] h-[1.8px] rounded-sm bg-navy" />
                <View className="w-[15px] h-[1.8px] rounded-sm bg-navy" />
              </View>
            </Pressable>
          )}
        </View>
      </View>
      {/* Blue accent line */}
      <View className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-accent" />
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
}

export function Card({ children, className = '', onPress }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`bg-card rounded-2xl border border-border ${className}`}
  
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={`bg-card rounded-2xl border border-border ${className}`}>
      {children}
    </View>
  );
}

// ─── Button ───────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
}: ButtonProps) {
  // Иерархия (Linear-style): accent = primary CTA, navy = surfaces only inline
  const variants = {
    primary:   'bg-accent',
    secondary: 'bg-white border border-border',
    danger:    'bg-danger',
    ghost:     'bg-transparent',
  };
  const textColors = {
    primary:   'text-white',
    secondary: 'text-ink',
    danger:    'text-white',
    ghost:     'text-accent',
  };
  const sizes = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === 'danger' ? 'warning' : 'medium'}
      className={`${variants[variant]} ${sizes[size]} rounded-xl items-center justify-center ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? '#5E5CE6' : 'white'} size="small" />
      ) : (
        <Text className={`${textColors[variant]} ${textSizes[size]} font-bold`}>
          {label}
        </Text>
      )}
    </Touchable>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  color?: 'accent' | 'green' | 'orange' | 'red' | 'gray';
  onPress?: () => void;
}

export function Badge({ label, color = 'accent', onPress }: BadgeProps) {
  const bgColors = {
    accent: 'bg-accent-light',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    red: 'bg-red-100',
    gray: 'bg-gray-100',
  };
  const textColors = {
    accent: 'text-accent',
    green: 'text-success',
    orange: 'text-warning',
    red: 'text-danger',
    gray: 'text-gray-600',
  };
  const Comp = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      className={`${bgColors[color]} px-3 py-1 rounded-full`}
    >
      <Text className={`${textColors[color]} text-xs font-bold`}>{label}</Text>
    </Comp>
  );
}

// ─── FormField ────────────────────────────────────────────────────────

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
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  className = '',
}: FormFieldProps) {
  return (
    <View className={`mb-3 ${className}`}>
      {label && (
        <Text className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
          {label}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          // Clear "0" on focus for numeric inputs to avoid having to manually delete it
          if ((keyboardType === 'numeric' || keyboardType === 'decimal-pad') && value === '0') {
            onChangeText('');
          }
        }}
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor="#b0b0ba"
        keyboardType={keyboardType}
        multiline={multiline}
        className={`bg-bg border border-border rounded-xl px-3 py-2.5 text-navy text-sm ${
          multiline ? 'min-h-[80px]' : ''
        }`}
      />
    </View>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────

export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-[10px] font-bold text-accent tracking-widest uppercase">
        {title}
      </Text>
      {right}
    </View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: string | React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      {typeof icon === 'string' ? (
        <Text className="text-5xl mb-4">{icon}</Text>
      ) : (
        <View className="mb-4 w-16 h-16 rounded-2xl bg-surface2 items-center justify-center">
          {icon}
        </View>
      )}
      <Text className="text-ink font-bold text-lg text-center mb-2">
        {title}
      </Text>
      {desc && (
        <Text className="text-muted text-sm text-center leading-6 mb-6">
          {desc}
        </Text>
      )}
      {action}
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-border ${className}`} />;
}
