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

export default function RegisterScreen() {
  const { signInWithRegister } = useAuth();
  const { showAlert } = useAppAlert();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (name.trim().length < 2) {
      showAlert("Проверьте данные", "Укажите имя пользователя");
      return;
    }
    if (!email.trim().includes("@")) {
      showAlert("Проверьте данные", "Укажите корректный email");
      return;
    }
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
      await signInWithRegister({
        name: name.trim(),
        email: email.trim(),
        phone: e164,
        password,
      });
      safeReplace("/" as Href);
    } catch (error) {
      showAlert(
        "Ошибка регистрации",
        formatAuthError(error, "Не удалось создать аккаунт"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardFormScroll
        style={styles.flex}
        contentContainerStyle={styles.scroll}
      >
          <Text style={styles.title}>Регистрация</Text>
          <Text style={styles.subtitle}>
            Создайте аккаунт с 14-дневным пробным периодом PRO-версии
          </Text>

          <View style={styles.form}>
            <AuthField
              label="Имя пользователя"
              icon="person-outline"
              placeholder="Укажите логин или название компании"
              value={name}
              onChangeText={setName}
            />
            <AuthField
              label="Email"
              icon="mail-outline"
              placeholder="Укажите email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
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
              placeholder="Придумайте пароль"
              value={password}
              onChangeText={setPassword}
              password
            />

            <AuthButton
              title={submitting ? "Создание…" : "Создать аккаунт"}
              onPress={onSubmit}
              disabled={submitting}
              style={styles.submit}
            />
          </View>

          <AuthButton
            variant="link"
            title="Уже есть аккаунт"
            onPress={() => safeNavigate("/login" as Href)}
            style={styles.footerLink}
          />
      </KeyboardFormScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f7f7f7",
    paddingBottom: 10,
    paddingTop: 20,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2C2C2C",
  },
  subtitle: {
    fontSize: 14,
    color: "#6F7688",
    marginTop: -10,
  },
  form: {
    gap: 16,
  },
  submit: {
    marginTop: 8,
  },
  footerLink: {
    marginTop: 8,
  },
});
