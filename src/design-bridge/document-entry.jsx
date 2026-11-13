import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { fitToStage } from './stage.js';
import { contractTemplateAccess } from './contract-template-store.js';
import { readDocumentImage } from './document-media.js';
import { ESTIMATE_PRESETS, estimatePresetId, estimatePresetTemplate } from '../utils/estimate-template.js';
import { estimateHeaderCompany, estimateHeaderPreview, persistEstimateHeaderPatch } from './estimate-header-model.js';
import './estimate-header.css';

export { openEditor as openEstimateEditor } from './estimate-editor.jsx';
export { openSettings as openAccountSettings } from './account-settings.jsx';
export { openMenuDestination } from './menu-destinations.jsx';

function Chevron({ back = false }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d={back ? 'm12 5-5 5 5 5' : 'm8 5 5 5-5 5'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PresetThumbnail({ preset }) {
  const { appearance } = preset;
  return <span className="z-eh-thumbnail" data-estimate-thumbnail={preset.id} aria-hidden="true" style={{ '--eh-paper-brand': appearance.background, '--eh-paper-ink': appearance.accent, '--eh-paper-table': appearance.tableHeaderBackground, '--eh-paper-frame': preset.id === 'modern' ? '#D9E6FB' : appearance.sectionColor }}>
    <span className="z-eh-paper-company"><i /><i /></span>
    <span className="z-eh-paper-title" /><span className="z-eh-paper-copy" />
    <span className="z-eh-paper-table"><i /><i /><i /><i /></span>
    <span className="z-eh-paper-total" />
  </span>;
}

function EstimateHeader({ company = {}, templateStore, onCompanyChange, onEditCompany, onClose, busyRef }) {
  const access = contractTemplateAccess(templateStore);
  const [head, setHead] = useState(() => estimateHeaderCompany(company, access));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const file = useRef(null), alive = useRef(true);
  React.useEffect(() => () => { alive.current = false; }, []);
  const begin = key => { if (busyRef.current) return false; busyRef.current = true; setError(''); setBusy(key); return true; };
  const finish = () => { busyRef.current = false; if (alive.current) setBusy(''); };
  const commit = async patch => {
    await persistEstimateHeaderPatch({ access, onCompanyChange }, patch);
    if (alive.current) setHead(value => ({ ...value, ...patch }));
  };
  const save = async (patch, key) => {
    if (!begin(key)) return;
    try { await commit(patch); }
    catch (reason) { if (alive.current) setError(reason?.message || 'Не удалось сохранить настройки сметы. Попробуйте ещё раз.'); }
    finally { finish(); }
  };
  const pick = async event => {
    const image = event.target.files?.[0];
    event.target.value = '';
    if (!image || !begin('logo')) return;
    try { const logo = await readDocumentImage(image); if (alive.current) await commit({ logo }); }
    catch (reason) { if (alive.current) setError(reason?.message || 'Не удалось загрузить логотип. Попробуйте ещё раз.'); }
    finally { finish(); }
  };
  const preview = async () => {
    if (!begin('preview')) return;
    try {
      if (typeof window.MagicEstimate?.previewEstimate !== 'function') throw new Error('Предпросмотр пока недоступен. Откройте смету из проекта.');
      await window.MagicEstimate.previewEstimate(estimateHeaderPreview(head));
    } catch (reason) { if (alive.current) setError(reason?.message || 'Не удалось открыть предпросмотр. Попробуйте ещё раз.'); }
    finally { finish(); }
  };
  const selected = estimatePresetId(head.estimateTemplate);
  return <section className="z-estimate-header-editor" role="dialog" aria-modal="true" aria-label="Шапка сметы" aria-busy={!!busy}>
    <header className="z-eh-nav">
      <button type="button" className="z-eh-back" aria-label="Закрыть шапку сметы" disabled={!!busy} onClick={onClose}><Chevron back /></button>
      <strong>Шаблон сметы</strong>
      <button type="button" className="z-eh-link" disabled={!!busy} onClick={onClose}>Готово</button>
    </header>
    <div className="z-eh-body">
      <section className="z-eh-card">
        <div className="z-eh-card-heading"><h2>Оформление</h2><button type="button" className="z-eh-link" disabled={!!busy} onClick={preview}>{busy === 'preview' ? 'Открываем…' : 'Вид'}</button></div>
        <p>Один стиль для всех смет компании.</p>
        <div className="z-eh-presets" role="group" aria-label="Оформление сметы">
          {ESTIMATE_PRESETS.map(preset => <button key={preset.id} type="button" className="z-eh-preset" aria-label={preset.label} aria-pressed={selected === preset.id} data-estimate-preset={preset.id} disabled={!!busy} onClick={() => save({ estimateTemplate: estimatePresetTemplate(preset.id, head.estimateTemplate) }, preset.id)}>
            <PresetThumbnail preset={preset} /><span>{preset.label}</span>
            {selected === preset.id && <svg className="z-eh-preset-check" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" /><path d="m4.5 8 2.2 2.2 4.8-4.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>)}
        </div>
        <p className="z-eh-style-caption" aria-live="polite">{selected ? ESTIMATE_PRESETS.find(preset => preset.id === selected).description : 'Сохранено ваше оформление. Выберите стиль, чтобы заменить его.'}</p>
      </section>
      <section className="z-eh-card">
        <h2>Логотип компании</h2>
        <p>Используется в шапке сметы и договора.</p>
        <input ref={file} type="file" aria-label="Файл логотипа" accept="image/*" onChange={pick} hidden />
        <div className="z-eh-logo-row">
          <div className="z-eh-logo">{head.logo ? <img src={head.logo} alt="Логотип компании" /> : <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="4" y="4" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.6"/><circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.6"/><path d="m5 21 6-6 4 4 4-5 4 5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>}</div>
          <div className="z-eh-logo-actions"><button type="button" className="z-eh-upload" disabled={!!busy} onClick={() => file.current?.click()}>{busy === 'logo' ? 'Загрузка…' : head.logo ? 'Заменить логотип' : 'Загрузить логотип'}</button>{head.logo && <button type="button" className="z-eh-link z-eh-remove" disabled={!!busy} onClick={() => save({ logo: '' }, 'remove')}>{busy === 'remove' ? 'Удаляем…' : 'Удалить'}</button>}</div>
        </div>
      </section>
      <button type="button" className="z-eh-card z-eh-company" disabled={!!busy || !onEditCompany} onClick={onEditCompany}>
        <span><strong>Данные компании</strong><span>Название, контакты, адрес и реквизиты</span></span><Chevron />
      </button>
      {error && <p role="alert" className="z-eh-error">{error}</p>}
      <p className="z-eh-autosave" role="status">{busy && busy !== 'preview' ? 'Сохраняем изменения…' : 'Изменения сохраняются автоматически'}</p>
    </div>
  </section>;
}

export function openEstimateHeader(opts = {}) {
  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  host.style.zIndex = '9000';
  document.body.append(host);
  const detach = fitToStage(host), root = ReactDOM.createRoot(host), busyRef = { current: false };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; root.unmount(); detach(); host.remove();
    document.removeEventListener('keydown', onKey);
    previousFocus?.focus?.();
  };
  const requestClose = () => { if (!busyRef.current) { close(); opts.onClose?.(); } };
  const onKey = event => {
    if (event.defaultPrevented || !host.contains(document.activeElement)) return;
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); }
  };
  document.addEventListener('keydown', onKey);
  root.render(<EstimateHeader {...opts} busyRef={busyRef} onClose={requestClose} onEditCompany={opts.onEditCompany ? () => { if (!busyRef.current) { close(); opts.onEditCompany(); } } : undefined} />);
  requestAnimationFrame(() => { if (!closed) host.querySelector('button')?.focus(); });
  return { close };
}
