import React, { useEffect, useRef, useState } from 'react';
import { AuthField, AuthNotice, AuthShell, AuthSubmit } from './login-screen.jsx';

/** Native registration form adapted for the local, database-free design journey. */
export function RegisterScreen({ onRegistered, onBack } = {}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);

  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    const missing = [
      [name, 'Укажите имя пользователя'],
      [email, 'Укажите email'],
      [phone, 'Укажите номер телефона'],
      [password, 'Придумайте пароль'],
    ].find(([value]) => !value.trim());
    if (missing) {
      setNotice({ title: 'Проверьте данные', message: missing[1] });
      return;
    }
    if (typeof onRegistered !== 'function') return;
    submitting.current = true;
    setBusy(true);
    try {
      await onRegistered({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
    } catch (error) {
      if (active.current) setNotice({ title: 'Регистрация', message: error?.message || 'Не удалось продолжить. Попробуйте ещё раз.' });
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  };

  return <>
    <AuthShell registration onBack={onBack}>
      <div className="z-auth-heading"><h1>Регистрация</h1><p className="z-login-subtitle">Начните с первого проекта.<br />Всё для работы уже под рукой.</p></div>
      <div className="z-auth-trial"><span className="z-auth-pro">PRO</span><span><strong>14 дней бесплатно</strong><span>Попробуйте все возможности</span></span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" /></svg></div>
      <form className="z-login-form" onSubmit={submit} noValidate autoComplete="off">
        <AuthField label="Имя пользователя" icon="person" name="registration-name" placeholder="Ваше имя или название компании" value={name} onChange={setName} autoComplete="off" disabled={busy} />
        <AuthField label="Email" icon="mail" name="registration-email" placeholder="Укажите email" inputMode="email" value={email} onChange={setEmail} autoComplete="off" disabled={busy} />
        <AuthField label="Номер телефона" icon="phone" name="registration-phone" placeholder="+7 (999) 999-99-99" value={phone} onChange={setPhone} autoComplete="off" disabled={busy} />
        <AuthField label="Пароль" icon="key" name="registration-password" placeholder="Придумайте пароль" value={password} onChange={setPassword} password autoComplete="off" disabled={busy} />
        <AuthSubmit busy={busy}>{busy ? 'Создание…' : 'Создать аккаунт'}</AuthSubmit>
      </form>
      <div className="z-auth-switch">
      <button className="z-login-register" type="button" disabled={busy} onClick={() => onBack?.()}>Уже есть аккаунт</button>
      <span className="z-auth-switch-arrow" aria-hidden="true">↗</span>
      </div>
    </AuthShell>
    {notice && <AuthNotice {...notice} onClose={() => setNotice(null)} />}
  </>;
}

export default RegisterScreen;
