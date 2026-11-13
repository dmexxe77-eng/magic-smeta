import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { fitToStage } from './stage.js';
import { readDocumentImage } from './document-media.js';
import { LEGAL_FORMS, accountLegalForm, accountProfile, bankDetailsText, validateProfileField, formatProfilePhone, profileFieldPatch } from './account-profile.js';
import './account-settings.css';

const BANK_FIELDS = [
  ['bankAccount', 'Номер расчётного счёта', '20 цифр', 20],
  ['bankBik', 'БИК банка', '9 цифр', 9],
  ['bankName', 'Наименование банка', 'Название банка'],
  ['bankCorrAccount', 'Корреспондентский счёт', '20 цифр', 20],
];

function Pencil() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" /></svg>;
}

function ValueRow({ label, value, onClick, last, select, expanded, hint }) {
  const text = String(value ?? '').trim();
  return <button type="button" className={'z-as-value-row' + (last ? ' is-last' : '')} aria-label={'Изменить ' + label} aria-description={hint || undefined} aria-expanded={select ? !!expanded : undefined} onClick={onClick}>
    <span className="z-as-field-label">{label}{hint && <small className="z-as-field-warning">{hint}</small>}</span>
    <span className={'z-as-value' + (!text ? ' is-empty' : '')}>{text || '—'}</span>
    <span className="z-as-pencil">{select ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg> : <Pencil />}</span>
  </button>;
}

function LinkRow({ label, sub, onClick, last }) {
  return <button type="button" className={'z-as-link-row' + (last ? ' is-last' : '')} aria-label={label} onClick={onClick}>
    <span className="z-as-link-body"><strong>{label}</strong>{sub && <small>{sub}</small>}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
  </button>;
}

function ToggleRow({ label, sub, value, onChange, disabled, last }) {
  return <div className={'z-as-toggle-row' + (last ? ' is-last' : '')}>
    <span className="z-as-link-body"><strong>{label}</strong>{sub && <small>{sub}</small>}</span>
    <button type="button" role="switch" aria-label={label} aria-checked={!!value} disabled={disabled} className={'z-as-switch' + (value ? ' is-on' : '')} onClick={() => onChange(!value)}><span /></button>
  </div>;
}

function Modal({ title, children, onClose, sheet = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const timer = requestAnimationFrame(() => ref.current?.querySelector('input,button:not(:disabled)')?.focus());
    return () => { cancelAnimationFrame(timer); if (previous?.isConnected) previous.focus?.(); };
  }, [title]);
  return <div className={'z-as-overlay' + (sheet ? ' is-sheet' : '')}>
    <button type="button" className="z-as-backdrop" aria-label="Закрыть окно" tabIndex={-1} onClick={onClose} />
    <section ref={ref} className={'z-as-modal ' + className + (sheet ? ' is-sheet' : '')} role="dialog" aria-modal="true" aria-label={title}>
      {sheet && <button className="z-as-handle-hit" type="button" aria-label="Закрыть выбор формы" onClick={onClose}><span /></button>}
      <h2>{title}</h2>{children}
    </section>
  </div>;
}

function DiscardPrompt({ onDiscard, onContinue }) {
  return <><p className="z-as-discard-message">Введённые данные не сохранятся.</p><div className="z-as-discard-actions"><button type="button" className="z-as-danger" onClick={onDiscard}>Не сохранять</button><button type="button" className="z-as-secondary" onClick={onContinue}>Продолжить</button></div></>;
}

function passwordHints(value) {
  const hints = [];
  if (value.length < 6) hints.push('Минимум 6 символов');
  if (value.length > 32) hints.push('Не более 32 символов');
  if (!/[A-Za-zА-Яа-яЁё]/.test(value)) hints.push('В пароле должна быть минимум 1 буква');
  if (!/\d/.test(value)) hints.push('В пароле должна быть минимум 1 цифра');
  return hints.join('\n');
}

function PasswordInput({ label, value, onChange, placeholder, hint, disabled }) {
  const [secure, setSecure] = useState(true);
  return <label className="z-as-password-field"><span>{label}</span><span className="z-as-password-row"><input type={secure ? 'password' : 'text'} aria-label={label} value={value} placeholder={placeholder} autoComplete="off" disabled={disabled} onChange={event => onChange(event.target.value)} /><button type="button" disabled={disabled} aria-label={(secure ? 'Показать' : 'Скрыть') + ' ' + label.toLowerCase()} onClick={() => setSecure(!secure)}>{secure ? 'Показать' : 'Скрыть'}</button></span>{hint && <small className="z-as-password-hint">{hint}</small>}</label>;
}

function Settings({ opts, onClose, closeRef }) {
  const [profile, setProfile] = useState(() => accountProfile(opts.profile));
  const profileRef = useRef(profile);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState('');
  const [initial, setInitial] = useState('');
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [imageBusy, setImageBusy] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const fileRef = useRef(null);
  const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);

  const persist = async patch => {
    await opts.onChange?.(patch);
    if (!active.current) return;
    const next = { ...profileRef.current, ...patch };
    profileRef.current = next;
    setProfile(next);
  };
  const clearModal = () => { setModal(null); setDraft(''); setInitial(''); setDiscard(false); setError(''); setPasswordHint(''); };
  const dirty = modal?.kind === 'field' ? draft !== initial : ['bank', 'password'].includes(modal?.kind) ? JSON.stringify(draft) !== JSON.stringify(initial) : false;
  const requestClose = () => {
    if (busyRef.current || imageBusy) return;
    if (!modal) { onClose(); return; }
    if (discard) { setDiscard(false); return; }
    if (dirty) { setDiscard(true); return; }
    clearModal();
  };
  closeRef.current = requestClose;

  const openField = (key, title, placeholder = '') => {
    const value = String(profileRef.current[key] ?? '');
    const seeded = ['phone', 'contractPhone'].includes(key) && !value.trim() ? '+7' : value;
    setDraft(seeded); setInitial(seeded); setError(''); setDiscard(false); setModal({ kind: 'field', key, title, placeholder });
  };
  const openBank = () => {
    const values = Object.fromEntries(BANK_FIELDS.map(([key]) => [key, String(profileRef.current[key] || '')]));
    setDraft(values); setInitial(values); setError(''); setDiscard(false); setModal({ kind: 'bank', title: 'Банковские реквизиты' });
  };
  const openPassword = () => {
    const value = { currentPassword: '', newPassword: '', confirmPassword: '' };
    setDraft(value); setInitial(value); setError(''); setDiscard(false); setPasswordHint(''); setModal({ kind: 'password', title: 'Сменить пароль' });
  };
  const withBusy = async action => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (cause) { if (active.current) setError(cause?.message || 'Не удалось сохранить'); }
    finally { busyRef.current = false; if (active.current) setBusy(false); }
  };
  const saveField = () => withBusy(async () => {
    const validation = validateProfileField(modal.key, draft, profileRef.current);
    if (validation) { setError(validation); return; }
    await persist(profileFieldPatch(modal.key, draft, profileRef.current));
    clearModal();
  });
  const saveBank = () => withBusy(async () => {
    const values = Object.fromEntries(BANK_FIELDS.map(([key]) => [key, String(draft[key] || '').trim()]));
    for (const [key] of BANK_FIELDS) {
      const validation = validateProfileField(key, values[key], profileRef.current);
      if (validation) { setError(validation); return; }
    }
    await persist({ ...values, bank: bankDetailsText({ ...values, legalForm: profileRef.current.legalForm }) });
    clearModal();
  });
  const savePassword = () => withBusy(async () => {
    setPasswordHint('');
    if (draft.currentPassword.length < 6) { setError('Укажите текущий пароль'); return; }
    const hints = passwordHints(draft.newPassword);
    if (hints) { setPasswordHint(hints); return; }
    if (draft.newPassword !== draft.confirmPassword) { setError('Пароли не совпадают'); return; }
    if (draft.newPassword === draft.currentPassword) { setError('Новый пароль должен отличаться от текущего'); return; }
    if (!opts.onPasswordChange) { setError('Смена пароля доступна в приложении с аккаунтом'); return; }
    await opts.onPasswordChange({ currentPassword: draft.currentPassword, newPassword: draft.newPassword });
    clearModal();
  });
  const selectForm = id => withBusy(async () => { await persist({ legalForm: id }); clearModal(); });
  const toggle = (key, value) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setPageError('');
    const patch = { [key]: value };
    persist(patch).catch(cause => { if (active.current) setPageError(cause?.message || 'Не удалось сохранить'); }).finally(() => { busyRef.current = false; if (active.current) setBusy(false); });
  };
  const chooseImage = key => { fileRef.current.dataset.field = key; fileRef.current.click(); };
  const upload = async event => {
    const file = event.target.files?.[0], key = event.target.dataset.field;
    event.target.value = '';
    if (!file || busyRef.current || imageBusy) return;
    busyRef.current = true; setImageBusy(key); setError(''); setPageError('');
    try { const value = await readDocumentImage(file); await persist({ [key]: value }); }
    catch (cause) { if (active.current) { const message = cause?.message || 'Не удалось загрузить изображение'; setError(message); setPageError(message); } }
    finally { busyRef.current = false; if (active.current) setImageBusy(''); }
  };
  const legal = accountLegalForm(profile.legalForm);
  const selfEmployed = profile.legalForm === 'self_employed';
  const initials = String(profile.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '—';
  const field = (key, label, placeholder, last = false) => {
    const incompatible = ['inn', 'ogrn'].includes(key) && legal && validateProfileField(key, profile[key], profile);
    return <ValueRow key={key} label={label} value={profile[key]} hint={incompatible ? 'Проверьте ' + label : null} last={last} onClick={() => openField(key, label === 'Юр. адрес' ? 'Юридический адрес' : label, placeholder)} />;
  };

  return <section className="z-account-settings" aria-label="Настройки аккаунта">
    <header className="z-as-header"><button type="button" className="z-as-back" aria-label="Закрыть настройки аккаунта" onClick={requestClose} disabled={busy || !!imageBusy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button><h1>Настройки аккаунта</h1><button type="button" className="z-as-done" onClick={requestClose} disabled={busy || !!imageBusy}>Готово</button></header>
    <div className="z-as-scroll">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
      <div className="z-as-avatar-block"><button type="button" className="z-as-avatar" aria-label="Изменить фото профиля" disabled={busy || !!imageBusy} onClick={() => chooseImage('avatar')}>{profile.avatar ? <img src={profile.avatar} alt="Фото профиля" /> : <span>{initials}</span>}{imageBusy === 'avatar' && <span className="z-as-avatar-busy">…</span>}</button><button type="button" className="z-as-avatar-link" disabled={busy || !!imageBusy} onClick={() => chooseImage('avatar')}>Изменить фото</button></div>
      <h2 className="z-as-section-title">Компания и контакты</h2>
      <div className="z-as-card">{field('name', 'Имя')}{field('company', 'Компания')}{field('phone', 'Телефон')}{field('email', 'E-mail')}{field('city', 'Город')}{field('companyAddress', 'Адрес компании', 'Индекс, город, улица, дом')}<LinkRow label="Логотип компании" sub="Для сметы, договора и акта" last onClick={() => { setError(''); setModal({ kind: 'media', title: 'Логотип компании' }); }} /></div>
      <h2 className="z-as-section-title">Реквизиты для документов</h2><p className="z-as-section-hint">Подставляются в шапку сметы, договор и PDF.</p>
      <div className="z-as-card">
        <ValueRow label="Форма" value={legal?.label || ''} select expanded={modal?.kind === 'form'} onClick={() => { setError(''); setModal({ kind: 'form', title: 'Форма' }); }} />
        {legal && <>{field('legal', legal.nameLabel, legal.namePlaceholder)}{legal.showInn && field('inn', 'ИНН', legal.innLength + ' цифр')}{legal.showKpp && field('kpp', 'КПП', '9 цифр')}{legal.showOgrn && field('ogrn', legal.ogrnLabel, legal.ogrnLength + ' цифр')}{legal.showLegalAddress && field('address', legal.addressLabel, 'Индекс, город, улица, дом')}</>}
        {field('signerName', 'ФИО для подписи', 'Губарь Н.А.')}
        <ValueRow label={selfEmployed ? 'Счёт для оплаты' : 'Банк, р/с'} value={profile.bank} onClick={openBank} />
        {field('contractPhone', 'Телефон в договоре')}{field('site', 'Сайт', '', true)}
      </div>
      <h2 className="z-as-section-title">Безопасность</h2>
      <div className="z-as-card"><LinkRow label="Сменить пароль" onClick={openPassword} /><ToggleRow label="Вход по Face ID / Touch ID" sub="Быстрый вход без пароля" value={profile.bio} disabled={busy || !!imageBusy} onChange={value => toggle('bio', value)} /><ToggleRow label="PIN-код при открытии" sub="Защита цен и клиентов на объекте" value={profile.pin} disabled={busy || !!imageBusy} onChange={value => toggle('pin', value)} last /></div>
      {pageError && <p className="z-as-error" role="alert">{pageError}</p>}
    </div>
    {modal && <Modal title={discard ? 'Не сохранять изменения?' : modal.title} onClose={requestClose} sheet={modal.kind === 'form'} className={modal.kind === 'bank' ? 'z-as-bank-modal' : modal.kind === 'media' ? 'z-as-media-modal' : ''}>
      {discard ? <DiscardPrompt onDiscard={clearModal} onContinue={() => setDiscard(false)} /> : <>
        {modal.kind === 'field' && <form className="z-as-field-form" onSubmit={event => { event.preventDefault(); saveField(); }}><input className={'z-as-input' + (error ? ' is-error' : '')} aria-label={modal.title} value={draft} placeholder={modal.placeholder} disabled={busy} autoComplete="off" inputMode={['phone', 'contractPhone'].includes(modal.key) ? 'tel' : ['inn', 'kpp', 'ogrn'].includes(modal.key) ? 'numeric' : modal.key === 'email' ? 'email' : 'text'} onChange={event => { setDraft(['phone', 'contractPhone'].includes(modal.key) ? formatProfilePhone(event.target.value) : event.target.value); setError(''); }} />{error && <p className="z-as-error" role="alert">{error}</p>}<div className="z-as-actions"><button type="button" className="z-as-secondary" disabled={busy} onClick={requestClose}>Отмена</button><button type="submit" className="z-as-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button></div></form>}
        {modal.kind === 'form' && <div className="z-as-form-options" role="radiogroup" aria-label="Форма">{LEGAL_FORMS.map(form => <button type="button" key={form.id} role="radio" aria-checked={profile.legalForm === form.id} className={profile.legalForm === form.id ? 'is-selected' : ''} disabled={busy} onClick={() => selectForm(form.id)}><span>{form.label}</span>{profile.legalForm === form.id && <span aria-hidden="true">✓</span>}</button>)}{error && <p className="z-as-error" role="alert">{error}</p>}</div>}
        {modal.kind === 'bank' && <form onSubmit={event => { event.preventDefault(); saveBank(); }}><p className="z-as-media-hint">{selfEmployed ? 'Необязательно. Можно указать текущий банковский счёт для получения оплаты.' : 'Необязательно. Заполните реквизиты для оплаты по счёту.'}</p><div className="z-as-bank-scroll">{BANK_FIELDS.map(([key, label, placeholder, limit]) => { const visibleLabel = key === 'bankAccount' && selfEmployed ? 'Номер счёта для оплаты' : label; return <label key={key} className="z-as-bank-field"><span>{visibleLabel}</span><input className="z-as-input" aria-label={visibleLabel} value={draft[key] || ''} placeholder={placeholder} inputMode={limit ? 'numeric' : 'text'} disabled={busy} onChange={event => { const value = limit ? event.target.value.replace(/\D/g, '').slice(0, limit) : event.target.value; setDraft(current => ({ ...current, [key]: value })); setError(''); }} /></label>; })}{error && <p className="z-as-error" role="alert">{error}</p>}</div><div className="z-as-actions z-as-bank-actions"><button type="submit" className="z-as-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button><button type="button" className="z-as-secondary" disabled={busy} onClick={requestClose}>Отмена</button></div></form>}
        {modal.kind === 'media' && <><p className="z-as-media-hint">Для сметы, договора и акта</p><div className="z-as-media-row"><div className="z-as-media-preview">{profile.logo ? <img src={profile.logo} alt="Логотип компании" /> : <span>Лого</span>}</div><button type="button" className="z-as-upload" aria-label="Загрузить логотип" disabled={busy || !!imageBusy} onClick={() => chooseImage('logo')}>{imageBusy === 'logo' ? 'Загрузка…' : 'Загрузить логотип'}</button></div>{error && <p className="z-as-error" role="alert">{error}</p>}{profile.logo && <button type="button" className="z-as-danger z-as-media-close" disabled={busy || !!imageBusy} onClick={() => withBusy(() => persist({ logo: '' }))}>Удалить логотип</button>}<button type="button" className="z-as-secondary z-as-media-close" disabled={busy || !!imageBusy} onClick={requestClose}>Закрыть</button></>}
        {modal.kind === 'password' && <form onSubmit={event => { event.preventDefault(); savePassword(); }}><PasswordInput label="Текущий пароль" value={draft.currentPassword} placeholder="••••••••" disabled={busy} onChange={value => { setDraft(current => ({ ...current, currentPassword: value })); setError(''); }} /><PasswordInput label="Новый пароль" value={draft.newPassword} placeholder="Не менее 6 символов" hint={passwordHint} disabled={busy} onChange={value => { setDraft(current => ({ ...current, newPassword: value })); setError(''); setPasswordHint(''); }} /><PasswordInput label="Подтверждение пароля" value={draft.confirmPassword} placeholder="Повторите новый пароль" disabled={busy} onChange={value => { setDraft(current => ({ ...current, confirmPassword: value })); setError(''); }} />{error && <p className="z-as-error" role="alert">{error}</p>}<div className="z-as-actions z-as-password-actions"><button type="submit" className="z-as-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button><button type="button" className="z-as-secondary" disabled={busy} onClick={requestClose}>Отмена</button></div></form>}
      </>}
    </Modal>}
  </section>;
}

/** Full native account-settings UI, using the prototype's existing local profile. */
export function openSettings(opts = {}) {
  const previous = document.activeElement;
  const host = document.createElement('div');
  host.className = 'z-account-settings-host';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'Настройки аккаунта');
  document.body.append(host);
  const detach = fitToStage(host), root = ReactDOM.createRoot(host), closeRef = { current: null };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; document.removeEventListener('keydown', onKey, true);
    root.unmount(); detach(); host.remove();
    if (previous?.isConnected) previous.focus?.();
  };
  const requestClose = () => { close(); opts.onClose?.(); };
  const onKey = event => {
    if (!host.contains(document.activeElement)) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current?.(); }
    if (event.key === 'Tab') {
      const scope = host.querySelector('.z-as-modal') || host;
      const controls = [...scope.querySelectorAll('button:not(:disabled):not([tabindex="-1"]),input:not(:disabled):not([type="file"])')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  root.render(<Settings opts={opts} onClose={requestClose} closeRef={closeRef} />);
  requestAnimationFrame(() => { if (!closed) host.querySelector('button')?.focus(); });
  return { close };
}
