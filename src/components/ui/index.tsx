import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  StyleSheet,
} from 'react-native';

// ─── AppHeader ────────────────────────────────────────────────────────

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  rightContent?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  onMenu,
  rightContent,
}: AppHeaderProps) {
  return (
    <View className="bg-white border-b border-border px-4 pt-12 pb-3">
      <View className="flex-row items-center gap-3">
        {/* Logo + optional back */}
        <View className="flex-row items-center gap-2 flex-shrink-0">
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center mr-1"
            >
              <Text className="text-navy text-xl font-bold">‹</Text>
            </TouchableOpacity>
          )}
          <View className="w-9 h-9 rounded-[9px] bg-navy items-center justify-center">
            <View className="gap-[3px]">
              <View className="w-[14px] h-[2px] rounded-sm bg-accent" />
              <View className="w-[10px] h-[2px] rounded-sm bg-accent opacity-60" />
              <View className="w-[7px] h-[2px] rounded-sm bg-accent opacity-30" />
            </View>
          </View>
          <View>
            <Text className="text-[14px] font-bold tracking-widest text-navy">
              {title ?? 'MAGIC'}
            </Text>
            <Text className="text-[9px] font-semibold tracking-[3px] text-accent -mt-0.5">
              {subtitle ?? 'STUDIO'}
            </Text>
          </View>
        </View>

        {/* Right content */}
        <View className="flex-1 items-end flex-row justify-end gap-2">
          {rightContent}
          {onMenu && (
            <TouchableOpacity
              onPress={onMenu}
              className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center"
            >
              <View className="gap-[4px] items-center">
                <View className="w-[15px] h-[1.8px] rounded-sm bg-navy" />
                <View className="w-[15px] h-[1.8px] rounded-sm bg-navy" />
                <View className="w-[15px] h-[1.8px] rounded-sm bg-navy" />
              </View>
            </TouchableOpacity>
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
      <TouchableOpacity
        onPress={onPress}
        className={`bg-card rounded-2xl border border-border ${className}`}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
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
  const variants = {
    primary: 'bg-navy',
    secondary: 'bg-accent',
    danger: 'bg-red-500',
    ghost: 'bg-transparent border border-border',
  };
  const textColors = {
    primary: 'text-white',
    secondary: 'text-white',
    danger: 'text-white',
    ghost: 'text-muted',
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
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} rounded-xl items-center justify-center ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text
          className={`${textColors[variant]} ${textSizes[size]} font-bold`}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
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
  const Comp = onPress ? TouchableOpacity : View;
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
  icon: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-navy font-bold text-lg text-center mb-2">
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
