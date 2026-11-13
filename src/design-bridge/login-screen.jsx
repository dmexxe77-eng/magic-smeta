import React, { useEffect, useRef, useState } from 'react';
import { formatProfilePhone } from './account-profile.js';
import './login-screen.css';

function Icon({ kind }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'person' ? <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></> : kind === 'mail' ? <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 7 9-7" /></> : kind === 'phone' ? <path d="M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 2a15 15 0 0 1-6-6l2-2-2-5Z" /> : kind === 'key' ? <><circle cx="8" cy="8" r="5" /><path d="m11.5 11.5 9 9M17 17l2-2M19 19l2-2" /></> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{kind === 'hidden' && <path d="m3 3 18 18" />}</>}
  </svg>;
}

function Brand() {
  return <div className="z-auth-brand" aria-label="ЗАМЕРX — от замера до договора">
    <svg className="z-auth-brand-mark" width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0B1119" />
      <path d="M13 50V16.5a3.5 3.5 0 0 1 3.5-3.5H50" stroke="#E6EBF4" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M22 13v5M30 13v6.5M38 13v5M46 13v6.5M13 24h5M13 32h6.5M13 40h5" stroke="#E6EBF4" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 23h10.5l21 27H43z" fill="#EEF2F8" /><path d="M42.5 23H54L31 50H19.5z" fill="#2A7BFF" />
    </svg>
    <span className="z-auth-brand-copy"><strong>ЗАМЕР<span>X</span></strong><span>От замера до договора</span></span>
  </div>;
}

function BlueprintIllustration() {
  return <div className="z-auth-illustration" aria-hidden="true">
    <svg viewBox="0 0 360 174" fill="none">
      <path className="z-auth-grid" d="M24 28h312M24 60h312M24 92h312M24 124h312M24 156h312M52 12v152M84 12v152M116 12v152M148 12v152M180 12v152M212 12v152M244 12v152M276 12v152M308 12v152" />
      <path d="M76 48h146v43h47v55H76Z" fill="#E7EFFD" fillOpacity=".9" />
      <path d="M76 146V48h146v43h47v55H193M148 146H76" stroke="#1461EE" strokeWidth="2" strokeLinejoin="round" />
      <path d="M148 146v-44a44 44 0 0 1 44 44" stroke="#83A8E8" strokeWidth="1.2" />
      <path d="M76 26h146M76 21v10M222 21v10M51 48v98M46 48h10M46 146h10" stroke="#92ACD5" strokeWidth="1.2" />
      <path d="M76 38V19M222 38V19M66 48H43M66 146H43" stroke="#C3D2E9" />
      <rect x="128" y="17" width="42" height="18" rx="6" fill="#F3F6FC" /><text x="149" y="30" textAnchor="middle" fill="#6480AC" fontSize="11" fontWeight="600">4,20 м</text>
      <rect x="28" y="88" width="45" height="18" rx="6" fill="#F3F6FC" /><text x="50" y="101" textAnchor="middle" fill="#6480AC" fontSize="11" fontWeight="600">3,60 м</text>
      <text x="146" y="85" textAnchor="middle" fill="#1461EE" fontSize="18" fontWeight="700">15,1 м²</text>
      {[[76,48],[222,48],[222,91],[269,91],[269,146],[76,146]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="white" stroke="#1461EE" strokeWidth="1.5" />)}
      <g transform="translate(239 25) rotate(8 34 29)"><rect x="0.5" y="0.5" width="68" height="58" rx="11" fill="white" stroke="#DEE7F6" /><rect x="12" y="13" width="20" height="4" rx="2" fill="#1461EE" /><path d="M12 27h44M12 35h30M12 43h19" stroke="#C2D1E7" strokeWidth="3" strokeLinecap="round" /><circle cx="53" cy="43" r="9" fill="#E7EFFD" /><path d="m49 43 3 3 5-6" stroke="#1461EE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></g>
    </svg>
    <span>Точный замер. Понятная смета.</span>
  </div>;
}

export function AuthShell({ registration = false, onBack, children }) {
  return <main className={`z-login-screen${registration ? ' z-auth-register' : ''}`} data-zamer-app-stage={registration ? 'register' : 'login'}>
    <div className="z-login-scroll"><div className="z-login-content">
      <header className="z-auth-header"><Brand />{registration && <button className="z-auth-back" type="button" onClick={onBack} aria-label="Вернуться ко входу"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>}</header>
      {!registration && <BlueprintIllustration />}
      <section className="z-auth-panel">{children}</section>
      <p className="z-auth-footer">Ваши замеры, сметы и документы — в одном месте</p>
    </div></div>
  </main>;
}

export function AuthSubmit({ busy, children }) {
  return <button className="z-login-submit" type="submit" disabled={busy}><span>{children}</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></button>;
}

export function AuthNotice({ title, message, onClose }) {
  const button = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    button.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="z-login-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="z-login-notice" role="alertdialog" aria-modal="true" aria-label={title} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') { event.preventDefault(); button.current?.focus(); }
    }}><h2>{title}</h2><p>{message}</p><button type="button" ref={button} onClick={onClose}>Понятно</button></section>
  </div>;
}

export function AuthField({ label, icon, placeholder, value, onChange, password = false, phoneMask = false, name, inputMode, autoComplete = 'off', disabled = false }) {
  const [secure, setSecure] = useState(password);
  return <label className="z-login-field"><span>{label}</span><span className="z-login-input-wrap">
    <span className="z-login-left-icon"><Icon kind={icon} /></span>
    <input name={name} type={password && secure ? 'password' : icon === 'phone' ? 'tel' : 'text'} inputMode={inputMode || (icon === 'phone' ? 'tel' : undefined)} autoComplete={autoComplete} aria-label={label} placeholder={placeholder} value={value} onFocus={() => { if (phoneMask && !value.replace(/\D/g, '')) onChange('+7'); }} onChange={event => onChange(phoneMask ? formatProfilePhone(event.target.value) : event.target.value)} disabled={disabled} spellCheck={false} autoCapitalize="none" />
    {password && <button className="z-login-eye" type="button" aria-label={secure ? 'Показать пароль' : 'Скрыть пароль'} aria-pressed={!secure} onClick={() => setSecure(!secure)} disabled={disabled}><Icon kind={secure ? 'eye' : 'hidden'} /></button>}
  </span></label>;
}

/** Local prototype sign-in; credentials stay in this component's memory. */
export function LoginScreen({ onSignIn, onCreateAccount, initialPhone = '' } = {}) {
  const [phone, setPhone] = useState(initialPhone), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(null);
  const submitting = useRef(false), active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    if (!phone.trim()) { setNotice({ title: 'Проверьте данные', message: 'Введите номер телефона' }); return; }
    if (!password.trim()) { setNotice({ title: 'Проверьте данные', message: 'Введите пароль' }); return; }
    if (!onSignIn) { setNotice({ title: 'Вход', message: 'Вход в аккаунт подключим позже. Сейчас доступен предпросмотр страницы.' }); return; }
    submitting.current = true; setBusy(true);
    try { await onSignIn({ phone: phone.trim(), password }); }
    catch (error) { if (active.current) setNotice({ title: 'Ошибка входа', message: error?.message || 'Не удалось войти' }); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  };
  return <>
    <AuthShell>
      <div className="z-auth-heading"><h1>Вход</h1><p className="z-login-subtitle">Рады видеть вас снова.<br />Войдите, чтобы продолжить работу.</p></div>
      <form className="z-login-form" onSubmit={submit} autoComplete="off" noValidate>
        <AuthField label="Номер телефона" icon="phone" name="login-phone" placeholder="+7 (999) 999-99-99" value={phone} onChange={setPhone} disabled={busy} />
        <AuthField label="Пароль" icon="key" name="login-password" placeholder="Введите пароль" value={password} onChange={setPassword} password disabled={busy} />
        <AuthSubmit busy={busy}>{busy ? 'Вход…' : 'Войти'}</AuthSubmit>
      </form>
      <div className="z-auth-switch"><span>Ещё нет аккаунта?</span>
      <button className="z-login-register" type="button" disabled={busy} onClick={() => {
        if (onCreateAccount) onCreateAccount();
        else setNotice({ title: 'Создать аккаунт', message: 'Страницу регистрации добавим позже.' });
      }}>Создать аккаунт</button>
      </div>
    </AuthShell>
    {notice && <AuthNotice {...notice} onClose={() => setNotice(null)} />}
  </>;
}
