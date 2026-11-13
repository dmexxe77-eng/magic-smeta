import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { fitToStage } from './stage.js';
import { contractTemplateAccess } from './contract-template-store.js';
import { readDocumentImage } from './document-media.js';

export { openEditor as openEstimateEditor } from './estimate-editor.jsx';
export { openSettings as openAccountSettings } from './account-settings.jsx';
export { openMenuDestination } from './menu-destinations.jsx';

const ink = '#1E2530', sub = '#6F7688', accent = '#1461EE';
const button = { font: '700 13px Manrope,system-ui,sans-serif', cursor: 'pointer', border: 0 };
const card = { background: '#fff', borderRadius: 14, border: '1px solid #F1F1F7', padding: 14, marginBottom: 10 };

function EstimateHeader({ company = {}, templateStore, onCompanyChange, onEditCompany, onClose }) {
  const access = contractTemplateAccess(templateStore);
  const [head, setHead] = useState(() => ({ ...access.load().head, ...company }));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const file = useRef(null);
  const alive = useRef(true);
  React.useEffect(() => () => { alive.current = false; }, []);
  const save = patch => {
    const current = access.load();
    access.save({ ...current, head: { ...current.head, ...patch } });
    onCompanyChange?.(patch);
    setHead(value => ({ ...value, ...patch }));
  };
  const pick = async event => {
    const image = event.target.files?.[0], key = event.target.dataset.field;
    event.target.value = '';
    if (!image) return;
    setError(''); setBusy(key);
    try { const value = await readDocumentImage(image); if (alive.current) save({ [key]: value }); }
    catch (reason) { if (alive.current) setError(reason.message || 'Не удалось загрузить изображение'); }
    finally { if (alive.current) setBusy(''); }
  };
  return <section role="dialog" aria-modal="true" aria-label="Шапка сметы" style={{ position: 'absolute', inset: 0, background: '#F3F3FA', color: ink, fontFamily: 'Manrope,system-ui,sans-serif', display: 'flex', flexDirection: 'column' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '8px 16px', borderBottom: '1px solid #ECECF4' }}>
      <button type="button" aria-label="Закрыть шапку сметы" onClick={onClose} style={{ ...button, width: 36, height: 38, borderRadius: 11, background: '#F3F3FA', color: ink, fontSize: 23 }}>‹</button>
      <strong style={{ flex: 1, fontSize: 15 }}>Шапка сметы</strong>
      <button type="button" onClick={onClose} style={{ ...button, color: accent, background: 'transparent', padding: '10px 0' }}>Готово</button>
    </header>
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>
      <div style={card}>
        <strong style={{ fontSize: 17, fontWeight: 700 }}>Логотип и подпись</strong>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: sub, margin: '0 0 8px', lineHeight: 1.5 }}>Подставляются в PDF сметы и договор</p>
        <input ref={file} type="file" accept="image/*" onChange={pick} hidden />
        <div>
          {[['logo', 'Логотип'], ['sign', 'Подпись']].map(([key, title]) => <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, minWidth: 0 }}>
            <div style={{ width: 72, height: 72, border: '1px solid #E4E4EE', borderRadius: 12, background: '#F3F3FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
              {head[key] ? <img src={head[key]} alt={title} style={{ width: 72, height: 72, objectFit: 'contain' }} /> : <span style={{ fontSize: 11, fontWeight: 700, color: '#A5A9B8', padding: '0 4px' }}>{key === 'logo' ? 'Лого' : 'Подпись'}</span>}
            </div>
            <button type="button" aria-label={'Загрузить ' + title.toLowerCase()} disabled={!!busy} onClick={() => { file.current.dataset.field = key; file.current.click(); }} style={{ ...button, flex: 1, minWidth: 0, minHeight: 44, padding: '0 10px', borderRadius: 12, background: accent, color: '#fff', fontSize: 13, fontWeight: 800, opacity: busy ? .7 : 1 }}>
              {busy === key ? 'Загрузка…' : 'Загрузить ' + title.toLowerCase()}
            </button>
          </div>)}
        </div>
        {error && <p role="alert" style={{ fontSize: 12, color: '#FF3B30', marginBottom: 0 }}>{error}</p>}
      </div>
      <button type="button" onClick={onEditCompany} style={{ ...button, ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', color: ink }}>
        <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 14 }}>Реквизиты компании</strong><span style={{ display: 'block', fontSize: 12, color: sub, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>Форма, ИНН, адрес и банк — в настройках аккаунта</span></span><span style={{ color: '#A5A9B8', fontSize: 21 }}>›</span>
      </button>
    </div>
  </section>;
}

export function openEstimateHeader(opts = {}) {
  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  host.style.zIndex = '9000';
  document.body.append(host);
  const detach = fitToStage(host), root = ReactDOM.createRoot(host);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; root.unmount(); detach(); host.remove();
    document.removeEventListener('keydown', onKey);
    previousFocus?.focus?.();
  };
  const requestClose = () => { close(); opts.onClose?.(); };
  const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); requestClose(); } };
  document.addEventListener('keydown', onKey);
  root.render(<EstimateHeader {...opts} onClose={requestClose} onEditCompany={() => { close(); opts.onEditCompany?.(); }} />);
  return { close };
}
