import { Text } from "@/components/Text";
import { TextInput } from "@/components/TextInput";
import { INPUT } from "@/constants/form";
import { formatRuPhoneMask, ruPhoneMaskSeed } from "@/utils/phone";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputProps,
} from "react-native";

type Props = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  password?: boolean;
  phoneMask?: boolean;
} & TextInputProps;

export function AuthField({
  label,
  icon,
  password,
  phoneMask,
  style,
  value,
  onChangeText,
  autoCapitalize = "none",
  autoCorrect = false,
  onFocus,
  ...props
}: Props) {
  const [secure, setSecure] = useState(!!password);

  const handleChange = (text: string) => {
    if (!onChangeText) return;
    onChangeText(phoneMask ? formatRuPhoneMask(text) : text);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <Ionicons
          name={icon}
          size={20}
          color={INPUT.placeholder}
          style={styles.leftIcon}
        />
        <TextInput
          {...props}
          value={value}
          onChangeText={handleChange}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          secureTextEntry={password ? secure : false}
          placeholderTextColor={INPUT.placeholder}
          /* number-pad: phone-pad на Android/Expo тормозит при маске */
          keyboardType={phoneMask ? "number-pad" : props.keyboardType}
          textContentType={phoneMask ? "telephoneNumber" : props.textContentType}
          autoComplete={phoneMask ? "tel" : props.autoComplete}
          onFocus={(e) => {
            if (
              phoneMask &&
              onChangeText &&
              phoneDigitsEmpty(value)
            ) {
              onChangeText(ruPhoneMaskSeed());
            }
            onFocus?.(e);
          }}
          style={[styles.input, style]}
        />
        {password ? (
          <Pressable
            onPress={() => setSecure((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={secure ? "Показать пароль" : "Скрыть пароль"}
          >
            <Ionicons
              name={secure ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={INPUT.placeholder}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function phoneDigitsEmpty(value: unknown): boolean {
  if (typeof value !== "string") return true;
  return value.replace(/\D/g, "").length === 0;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6F7688",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: INPUT.background,
    borderWidth: 1,
    borderColor: INPUT.border,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "500",
    color: "#000000",
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 12,
    color: INPUT.text,
    fontWeight: "400",
  },
});
