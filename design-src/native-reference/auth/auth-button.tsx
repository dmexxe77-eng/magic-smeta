import { Text } from "@/components/Text";
import { CALC_UI } from "@/constants/calc-ui";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = PressableProps & {
  title: string;
  variant?: "primary" | "link";
};

type StyleArg = StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);

function resolveStyle(
  style: StyleArg | undefined,
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> {
  return typeof style === "function" ? style(state) : style;
}

export function AuthButton({
  title,
  variant = "primary",
  style,
  disabled,
  ...props
}: Props) {
  if (variant === "link") {
    return (
      <Pressable
        accessibilityRole="button"
        style={(state) => [
          styles.linkBtn,
          state.pressed && styles.linkPressed,
          resolveStyle(style, state),
        ]}
        {...props}
      >
        <Text style={styles.linkText}>{title}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.primaryBtn,
        state.pressed && !disabled && styles.primaryPressed,
        disabled && styles.disabled,
        resolveStyle(style, state),
      ]}
      {...props}
    >
      <Text style={styles.primaryText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: CALC_UI.accent,
    borderRadius: 28,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryPressed: {
    backgroundColor: CALC_UI.accentPressed,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  linkPressed: {
    backgroundColor: CALC_UI.accentSoft,
  },
  linkText: {
    color: CALC_UI.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});
