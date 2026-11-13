import { ApiError } from "@/api/client";
import { AuthButton, AuthField } from "@/components/auth";
import KeyboardFormScroll from "@/components/KeyboardFormScroll";
import Screen from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAppAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { isCompleteRuPhone, toRuPhoneE164 } from "@/utils/phone";
import { safeNavigate, safeReplace } from "@/navigation/safe-nav";
import { type Href } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

function formatAuthError(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.fields) {
    return Object.values(error.fields).join("\n");
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function LoginScreen() {
  const { signInWithLogin } = useAuth();
  const { showAlert } = useAppAlert();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!isCompleteRuPhone(phone)) {
      showAlert("Проверьте данные", "Укажите полный номер телефона");
      return;
    }
    if (password.length < 6) {
      showAlert("Проверьте данные", "Пароль должен быть не менее 6 символов");
      return;
    }

    const e164 = toRuPhoneE164(phone);
    if (!e164) {
      showAlert("Проверьте данные", "Укажите полный номер телефона");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithLogin({
        phone: e164,
        password,
      });
      safeReplace("/" as Href);
    } catch (error) {
      showAlert("Ошибка входа", formatAuthError(error, "Не удалось войти"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardFormScroll style={styles.flex} contentContainerStyle={styles.centerBoxWrap}>

          <Text style={styles.title}>Вход</Text>
          <Text style={styles.subtitle}>Войдите по номеру телефона и паролю</Text>

          <View style={styles.form}>
            <AuthField
              label="Номер телефона"
              icon="call-outline"
              placeholder="+7 (999) 999-99-99"
              value={phone}
              onChangeText={setPhone}
              phoneMask
            />
            <AuthField
              label="Пароль"
              icon="key-outline"
              placeholder="Введите пароль"
              value={password}
              onChangeText={setPassword}
              password
            />

            <AuthButton
              title={submitting ? "Вход…" : "Войти"}
              onPress={onSubmit}
              disabled={submitting}
              style={styles.submit}
            />
          </View>

          <AuthButton
            variant="link"
            title="Создать аккаунт"
            onPress={() => safeNavigate("/register" as Href)}
          />
      </KeyboardFormScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
  },
  flex: {
    flex: 1,
  },
  centerBoxWrap: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
    // flexGrow (не flex): короткая форма по центру, но скролл под клавиатурой остаётся
    flexGrow: 1,
    justifyContent: "center",
  },
  hero: {
    width: "100%",
    height: 160,
    borderRadius: 24,
    backgroundColor: "#E4E4EF",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E2530",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#A5A9B8",
    marginTop: -8,
  },
  form: {
    gap: 16,
    marginTop: 8,
  },
  submit: {
    marginTop: 8,
  },
});
