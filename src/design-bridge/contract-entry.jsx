import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { DEFAULT_CONTRACT_TPL, CONTRACT_STYLES, CONTRACT_ESTIMATE_TYPES, CONTRACT_ESTIMATE_COLUMNS, DEFAULT_CONTRACT_ESTIMATE_OPTIONS, normalizeContractTemplate, normalizeContractLegalForm, companyContractFields, contractFields, contractHtml, nextContractNumber } from '../data/contract.js';
import { htmlToPdf } from '../utils/pdf.js';
import { readDocumentImage } from './document-media.js';
import { fitToStage } from './stage.js';
import { contractTemplateAccess } from './contract-template-store.js';

/* Договор для страницы дизайна.
   В проекте: условия (номер, дата монтажа, предоплата), заказчик, PDF / поделиться, предпросмотр — всё сохраняется само.
   В главном меню: шаблон договора (шапка исполнителя, оформление, разделы, подстановки), один на студию, localStorage.
   Токены — design-src/README.md, раздел 1. */
const D = { ink: '#0F1620', sub: '#6F7688', dim: '#A5A9B8', accent: '#1461EE', soft: '#E7EFFD', bg: '#F3F3FA', card: '#fff', field: '#F7F7FC', line: '#ECECF4', border: '#E4E4EE', danger: '#FF3B30', dangerSoft: '#FFECEA' };
const fmt = n => (Number(n) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const S = {
  card: { background: D.card, borderRadius: 18, padding: 14, marginBottom: 10 },
  sec: { fontSize: 11, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase', color: D.sub, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: 700, color: D.sub, margin: '10px 2px 6px' },
  input: { width: '100%', height: 44, background: D.field, border: '1.5px solid ' + D.border, borderRadius: 12, padding: '0 12px', color: D.ink, fontSize: 16, fontWeight: 600, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  area: { width: '100%', background: D.field, border: '1.5px solid ' + D.border, borderRadius: 12, padding: '10px 12px', color: D.ink, fontSize: 16, fontWeight: 500, lineHeight: 1.45, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', resize: 'vertical' },
  chip: on => ({ height: 34, padding: '0 12px', borderRadius: 10, border: '1.5px solid ' + (on ? D.accent : D.border), background: on ? D.soft : D.card, color: on ? D.accent : D.ink, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }),
  mini: on => ({ height: 28, padding: '0 10px', borderRadius: 8, border: '1.5px solid ' + (on ? D.accent : D.border), background: on ? D.soft : D.card, color: on ? D.accent : D.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }),
  primary: { height: 50, borderRadius: 16, border: 'none', background: D.accent, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flex: 1, minWidth: 0 },
  outline: { height: 50, borderRadius: 16, border: '1.5px solid ' + D.border, background: D.card, color: D.ink, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flex: 1, minWidth: 0 },
  icon: { width: 32, height: 32, borderRadius: 9, border: 'none', background: D.field, color: D.sub, cursor: 'pointer', fontSize: 15, flexShrink: 0, fontFamily: 'inherit' },
  pick: { width: 84, height: 60, borderRadius: 12, background: D.field, border: '1.5px dashed #C9C6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, color: D.accent, fontSize: 11, fontWeight: 700, textAlign: 'center' },
};

/* Лист договора: на телефоне масштабируется по ширине, а не сжимает текст */
function Paper({ html }) {
  const ref = useRef(null), wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current, wrap = wrapRef.current; if (!el || !wrap) return;
    const measure = () => setDims({ w: wrap.clientWidth, h: el.scrollHeight });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(wrap); ro.observe(el);
    return () => ro.disconnect();
  }, [html]);
  const PW = 768, s = dims.w ? Math.min(1, dims.w / PW) : 1;
  return (
    <div className="z-contract-paper" ref={wrapRef} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', height: dims.h ? Math.ceil(dims.h * s) : 'auto', boxShadow: '0 1px 2px rgba(30,37,48,.06)' }}>
      <div ref={ref} style={{ width: PW, padding: 24, boxSizing: 'border-box', transform: `scale(${s})`, transformOrigin: 'top left' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Shell({ title, sub, onClose, children, wide = false, action, overlay, sourceTemplate = false }) {
  return (
    <div className={'z-contract-shell' + (sourceTemplate ? ' z-contract-native-template' : '')} style={{ position: 'absolute', inset: 0, zIndex: 9000, background: D.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'Manrope','Inter',system-ui,sans-serif", color: sourceTemplate ? '#1E2530' : D.ink, WebkitFontSmoothing: 'antialiased' }}>
      {sourceTemplate && <style>{'.z-contract-native-template .contract-template-title{font-size:14px!important}.z-contract-native-template .contract-template-text{font-size:12px!important}.z-contract-native-template .contract-template-company-input{font-size:15px!important}'}</style>}
      <div className="z-contract-header" style={{ flexShrink: 0, position: 'sticky', top: 0, zIndex: 5, background: D.card, borderBottom: '0.5px solid ' + D.line, padding: sourceTemplate ? '8px 12px 12px' : '8px 16px', display: 'flex', alignItems: 'center', gap: sourceTemplate ? 8 : 12 }}>
        <button onClick={onClose} aria-label="Закрыть договор" style={{ background: D.bg, border: 'none', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" stroke={D.ink} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, padding: sourceTemplate ? '0 4px' : 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, fontWeight: 600, color: D.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
        {action}
      </div>
      <div className={'z-contract-content' + (wide ? ' z-contract-wide' : '')} style={{ flex: 1, minHeight: 0, overflowY: 'auto', ...(sourceTemplate ? { padding: '12px 16px 40px' } : {}) }}>{children}</div>
      {overlay}
    </div>
  );
}

/* ── Договор проекта ── */
function ProjectContract({ project, total, area, est, estimateAdjustment, estimateExportOptions, contract, installDate: ins0, onSaveContract, onProjectPatch, onClose, templateStore, company, rooms, documentContext }) {
  const templateAccess = contractTemplateAccess(templateStore);
  const storedTpl = templateAccess.load();
  const tpl = { ...storedTpl, head: { ...storedTpl.head, ...company } };
  const saved = contract || null;
  const [num, setNum] = useState(saved?.number || nextContractNumber(tpl));
  const [prepay, setPrepay] = useState(saved?.prepay ?? Math.round(total / 2));
  const [installDate, setInstallDate] = useState(saved?.installDate || ins0 || '');
  const [party, setParty] = useState({ client: project.client || '', phone: project.phone || '', address: project.address || '' });
  const [busy, setBusy] = useState('');
  const numTaken = useRef(!!saved);

  const fields = contractFields(party, total, { number: num, prepay, area: Math.round(area * 100) / 100, installDate });
  const html = contractHtml(tpl, fields, est, estimateAdjustment, estimateExportOptions, documentContext || { project, rooms });
  const fileName = 'Договор_' + num + '_' + (project.name || '');
  const rest = Math.round((total - prepay) * 100) / 100;

  const pushParty = () => { if (onProjectPatch) onProjectPatch({ client: party.client, phone: party.phone, address: party.address }); };
  const doPdf = async () => { if (busy) return; setBusy('pdf'); try { await htmlToPdf(html, fileName); } finally { setBusy(''); } };
  const doShare = async () => {
    if (busy) return; setBusy('share');
    try {
      const blob = await htmlToPdf(html, fileName, { blob: true });
      if (!blob) return;
      const file = new File([blob], fileName.replace(/[\\/:*?"<>|]+/g, '_') + '.pdf', { type: 'application/pdf' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ files: [file], title: 'Договор № ' + num });
      else await htmlToPdf(html, fileName);
    } catch (e) { if (e && e.name !== 'AbortError') alert('Не удалось поделиться: ' + (e.message || e)); }
    finally { setBusy(''); }
  };
  /* Автосохранение: договор в проекте всегда соответствует тому, что на экране; номер занимается при первом сохранении */
  const snapshot = () => ({ number: num, prepay, installDate, date: saved?.date || fields['дата'], total, html, client: party.client, address: party.address, phone: party.phone });
  const saveRef = useRef(null);
  useEffect(() => {
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => { onSaveContract(snapshot()); if (!numTaken.current) { numTaken.current = true; templateAccess.save({ ...tpl, numSeq: (tpl.numSeq || 1) + 1 }); } }, 400);
    return () => clearTimeout(saveRef.current);
  }, [num, prepay, installDate, party.client, party.phone, party.address]);
  const closeAll = () => { clearTimeout(saveRef.current); pushParty(); onSaveContract(snapshot()); onClose(); };
  const pct = [['30 %', .3], ['50 %', .5], ['70 %', .7], ['100 %', 1]];

  return (
    <Shell title="Договор" sub={project.name} onClose={closeAll} wide>
      <div className="z-contract-project"><div className="z-contract-form">
      <div style={S.card}>
        <div style={S.sec}>Условия</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div style={{ ...S.label, marginTop: 0 }}>Номер договора</div><input value={num} onChange={e => setNum(e.target.value)} style={S.input} /></div>
          <div><div style={{ ...S.label, marginTop: 0 }}>Дата монтажа</div><input value={installDate} placeholder="по согласованию" onChange={e => setInstallDate(e.target.value)} style={S.input} /></div>
        </div>
        <div style={S.label}>Предоплата, ₽</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={prepay} inputMode="numeric" onChange={e => setPrepay(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)} style={{ ...S.input, flex: 1, minWidth: 0 }} />
          {pct.map(([l, k]) => { const v = Math.round(total * k); return <button key={l} onClick={() => setPrepay(v)} style={S.mini(prepay === v)}>{l}</button>; })}
        </div>
        <div style={{ fontSize: 12, color: D.sub, fontWeight: 600, marginTop: 8, lineHeight: 1.4 }}>
          Сумма по смете <b style={{ color: D.ink }}>{fmt(total)} ₽</b> · остаток после предоплаты <b style={{ color: D.ink }}>{fmt(rest)} ₽</b>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sec}>Заказчик</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div style={{ ...S.label, marginTop: 0 }}>ФИО</div><input value={party.client} placeholder="Иванов Иван Иванович" onChange={e => setParty({ ...party, client: e.target.value })} onBlur={pushParty} style={S.input} /></div>
          <div><div style={{ ...S.label, marginTop: 0 }}>Телефон</div><input value={party.phone} placeholder="+7 …" inputMode="tel" onChange={e => setParty({ ...party, phone: e.target.value })} onBlur={pushParty} style={S.input} /></div>
        </div>
        <div style={S.label}>Адрес объекта</div>
        <input value={party.address} placeholder="г. Хабаровск, …" onChange={e => setParty({ ...party, address: e.target.value })} onBlur={pushParty} style={S.input} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={doPdf} disabled={!!busy} style={{ ...S.primary, opacity: busy ? .6 : 1 }}>{busy === 'pdf' ? 'Готовлю PDF…' : 'Скачать PDF'}</button>
        <button onClick={doShare} disabled={!!busy} style={{ ...S.outline, opacity: busy ? .6 : 1 }}>{busy === 'share' ? 'Готовлю…' : 'Поделиться'}</button>
      </div>
      <div style={{ fontSize: 12, color: D.sub, fontWeight: 600, margin: '0 4px 10px', lineHeight: 1.4 }}>Текст, реквизиты и оформление настраиваются в главном меню, раздел «Шаблон договора». Здесь всё сохраняется в проект автоматически.</div>
      </div><section className="z-contract-preview" aria-label="Предпросмотр договора">
      <div style={{ ...S.sec, margin: '4px 4px 8px' }}>Предпросмотр</div>
      <Paper html={html} />
      </section></div>
    </Shell>
  );
}

/* ── Шаблон договора (главное меню) ── */
const COMPANY_PLACEHOLDERS = [['компания', 'Название студии'], ['юр_лицо', 'Юр. лицо / ФИО'], ['форма', 'Форма (ИП, ООО…)'], ['инн', 'ИНН'], ['кпп', 'КПП'], ['огрн', 'ОГРН / ОГРНИП'], ['юр_адрес', 'Юридический адрес'], ['телефон_договора', 'Телефон в договоре'], ['банк', 'Банк, р/с'], ['подпись_фио', 'ФИО для подписи']];
const PROJECT_PLACEHOLDERS = [['клиент', 'Клиент'], ['телефон', 'Телефон клиента'], ['адрес', 'Адрес объекта'], ['дата', 'Дата договора'], ['номер', 'Номер договора'], ['сумма', 'Сумма'], ['сумма_прописью', 'Сумма прописью'], ['предоплата', 'Предоплата'], ['остаток', 'Остаток'], ['площадь', 'Площадь, м²'], ['срок_монтажа', 'Срок монтажа']];
const COMPANY_ROWS = [['company', 'Компания'], ['legal', 'Юр. лицо'], ['inn', 'ИНН'], ['ogrn', 'ОГРН / ОГРНИП'], ['address', 'Юр. адрес'], ['phone', 'Телефон в договоре'], ['bank', 'Банк, р/с'], ['signerName', 'ФИО для подписи']];
const sourceCard = { background: '#FFFFFF', borderRadius: 14, padding: 13, marginBottom: 10, border: '0.5px solid #F1F1F7' };
const sourceCardTitle = { fontSize: 14, fontWeight: 800, color: '#0f1620', textTransform: 'uppercase', letterSpacing: .6 };
const sourceGroupTitle = { fontSize: 10, fontWeight: 800, color: '#A5A9B8', textTransform: 'uppercase', letterSpacing: .6, margin: '2px 4px 6px' };
const sourceInput = { width: '100%', background: '#F7F7FC', border: '1px solid #F1F1F7', borderRadius: 12, padding: '11px 14px', color: '#1E2530', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' };
const sectionTitleInput = { ...sourceInput, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, padding: '7px 10px' };
const sectionTextInput = { ...sourceInput, display: 'block', minHeight: 88, fontSize: 12, lineHeight: '18px', fontWeight: 500, resize: 'none' };
const sectionIcon = { width: 28, height: 28, borderRadius: 8, background: '#F7F7FC', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, flexShrink: 0, color: '#6F7688', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const linkButton = { border: 0, background: 'transparent', color: D.accent, font: '700 12px Manrope,system-ui,sans-serif', cursor: 'pointer', padding: '6px 0' };

function companyDisplayRows(head) {
  const configurations = {
    ip: { label: 'ИП', name: 'ФИО', ogrn: 'ОГРНИП' },
    ooo: { label: 'ООО', name: 'Наименование', ogrn: 'ОГРН', kpp: true },
    ao: { label: 'АО', name: 'Наименование', ogrn: 'ОГРН', kpp: true },
    self_employed: { label: 'Самозанятый', name: 'ФИО' },
  };
  const config = configurations[normalizeContractLegalForm(head.legalForm)];
  const rows = [['company', 'Компания', head.company], ['legalForm', 'Форма', config?.label || '']];
  if (config) {
    rows.push(['legal', config.name, head.legal], ['inn', 'ИНН', head.inn]);
    if (config.kpp) rows.push(['kpp', 'КПП', head.kpp]);
    if (config.ogrn) rows.push(['ogrn', config.ogrn, head.ogrn]);
    rows.push(['address', 'Юр. адрес', head.address]);
  } else if (head.legal || head.inn || head.address) rows.push(['legal', 'Юр. лицо', head.legal], ['inn', 'ИНН', head.inn], ['address', 'Юр. адрес', head.address]);
  rows.push(['phone', 'Телефон в договоре', head.phone], ['bank', 'Банк, р/с', head.bank], ['signerName', 'ФИО для подписи', head.signerName]);
  return rows;
}

function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button,input,textarea')?.focus();
    return () => { if (previous?.isConnected) previous.focus?.(); };
  }, []);
  const keyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusable = [...ref.current.querySelectorAll('button:not([disabled]),input,textarea')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div onKeyDown={keyDown} style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'flex-end', background: 'rgba(15,22,32,.36)' }}>
    <button aria-label="Закрыть окно" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 0, background: 'transparent' }} />
    <section ref={ref} role="dialog" aria-modal="true" aria-label={title} style={{ position: 'relative', background: D.card, width: '100%', maxHeight: '88%', display: 'flex', flexDirection: 'column', borderRadius: '22px 22px 0 0', padding: '10px 16px max(16px,env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
      <div style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, background: D.border, marginBottom: 10 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><strong style={{ fontSize: 16 }}>{title}</strong><button onClick={onClose} aria-label="Закрыть" style={S.icon}>×</button></div>
      <div style={{ overflowY: 'auto', minHeight: 0 }}>{children}</div>
    </section>
  </div>;
}

function TemplateEditor({ onClose, templateStore, company, onEditCompany, onCompanyChange }) {
  const templateAccess = contractTemplateAccess(templateStore);
  const [tpl, setTpl] = useState(() => {
    const value = templateAccess.load();
    return normalizeContractTemplate({ ...value, head: { ...value.head, ...company } });
  });
  const original = useRef(JSON.stringify(tpl));
  const [sheet, setSheet] = useState(null), [preview, setPreview] = useState(false);
  const [estimateDraft, setEstimateDraft] = useState(null), [imageError, setImageError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [fieldActive, setFieldActive] = useState(false);
  const focusArea = useRef(null), mediaPatch = useRef({});
  const logoRef = useRef(null), signRef = useRef(null);
  const patch = values => setTpl(current => ({ ...current, ...values }));
  const patchHead = values => setTpl(current => ({ ...current, head: { ...current.head, ...values } }));
  const patchRow = (list, id, values) => setTpl(current => ({ ...current, [list]: current[list].map(row => row.id === id ? { ...row, ...values } : row) }));
  const moveUp = (list, index) => setTpl(current => {
    const rows = [...current[list]];
    if (index > 0) [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
    return { ...current, [list]: rows };
  });
  const remove = (list, id) => {
    if (focusArea.current?.list === list && focusArea.current.id === id) { focusArea.current = null; setFieldActive(false); }
    setTpl(current => ({ ...current, [list]: current[list].filter(row => row.id !== id) }));
  };
  const save = () => { templateAccess.save(tpl); onCompanyChange?.(mediaPatch.current); original.current = JSON.stringify(tpl); };
  const done = () => { save(); onClose(); };
  const leave = () => JSON.stringify(tpl) !== original.current ? setSheet('leave') : onClose();
  const updateImage = (key, value) => { mediaPatch.current[key] = value; patchHead({ [key]: value }); };
  const pickImg = async (ref, key) => {
    const file = ref.current?.files?.[0]; if (!file) return;
    setImageBusy(true); setImageError('');
    try { updateImage(key, await readDocumentImage(file)); }
    catch (error) { setImageError(error.message || 'Не удалось открыть изображение'); }
    finally { setImageBusy(false); if (ref.current) ref.current.value = ''; }
  };
  const capture = (list, row, field, element) => {
    focusArea.current = { list, id: row.id, field, element, start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 };
  };
  const fieldProps = (list, row, field) => ({
    value: row[field] || '',
    onChange: event => { patchRow(list, row.id, { [field]: event.target.value }); capture(list, row, field, event.target); },
    onFocus: event => { capture(list, row, field, event.target); setFieldActive(true); },
    onBlur: () => setFieldActive(false),
    onSelect: event => capture(list, row, field, event.target),
    onKeyUp: event => capture(list, row, field, event.target),
  });
  const openPlaceholders = () => {
    const target = focusArea.current;
    if (target?.element?.isConnected) { target.start = target.element.selectionStart; target.end = target.element.selectionEnd; }
    setSheet('placeholders');
  };
  const insertPlaceholder = key => {
    const target = focusArea.current;
    if (!target) return;
    const row = tpl[target.list].find(item => item.id === target.id);
    if (!row) return;
    const value = row[target.field] || '', start = Math.min(target.start ?? value.length, value.length), end = Math.max(start, Math.min(target.end ?? start, value.length));
    const token = '{' + key + '}';
    patchRow(target.list, target.id, { [target.field]: value.slice(0, start) + token + value.slice(end) });
    target.start = target.end = start + token.length;
    setSheet(null);
    setTimeout(() => { if (target.element?.isConnected) { target.element.focus(); target.element.setSelectionRange(target.start, target.end); } }, 0);
  };
  const addAppendix = kind => {
    if (kind === 'estimate' && tpl.appendices.some(row => row.kind === 'estimate')) return;
    const id = 'ap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    patch({ appendices: [...tpl.appendices, kind === 'text' ? { id, kind, title: 'Новое приложение', text: '' } : { id, kind, exportOptions: { ...DEFAULT_CONTRACT_ESTIMATE_OPTIONS, cols: { ...DEFAULT_CONTRACT_ESTIMATE_OPTIONS.cols } } }] });
    setSheet(null);
  };
  const editCompany = () => { if (onEditCompany) { save(); onEditCompany(); } else setSheet('company'); };
  const fields = { ...companyContractFields(tpl.head), номер: nextContractNumber(tpl), дата: new Date().toLocaleDateString('ru-RU') };
  const sample = contractHtml(tpl, fields, { mats: [], works: [] });
  const rowHead = (list, row, index, label) => <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
    <span style={{ color: D.accent, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{list === 'sections' ? index + 1 + '.' : 'П' + (index + 1) + '.'}</span>
    {row.kind === 'estimate' ? <strong style={{ flex: 1, fontSize: 15, fontWeight: 700, padding: '7px 10px' }}>Смета</strong> : <input {...fieldProps(list, row, 'title')} aria-label={label + ' ' + (index + 1)} placeholder={list === 'sections' ? 'Название раздела' : 'Заголовок приложения'} className="contract-template-title" style={sectionTitleInput} />}
    <button onClick={() => moveUp(list, index)} disabled={index === 0} aria-label={'Переместить выше ' + label.toLowerCase() + ' ' + (index + 1)} style={{ ...sectionIcon, opacity: index === 0 ? .4 : 1 }}>↑</button>
    <button onClick={() => remove(list, row.id)} aria-label={'Удалить ' + label.toLowerCase() + ' ' + (index + 1)} style={{ ...sectionIcon, background: D.dangerSoft, color: D.danger, fontSize: 12 }}>×</button>
  </div>;
  const addButton = { width: '100%', border: '1.5px dashed rgba(20,97,238,0.4)', borderRadius: 10, padding: '10px 0', background: 'transparent', color: D.accent, font: '700 11.5px Manrope,system-ui,sans-serif', cursor: 'pointer' };
  const headRows = companyDisplayRows(tpl.head);
  const companyValues = companyContractFields(tpl.head);
  const overlay = sheet && <Sheet title={sheet === 'placeholders' ? 'Подстановки' : sheet === 'appendix' ? 'Добавить приложение' : sheet === 'estimate' ? 'Параметры сметы' : sheet === 'leave' ? 'Сохранить изменения?' : sheet === 'reset' ? 'Сбросить шаблон?' : 'Информация о компании'} onClose={() => setSheet(null)}>
    {sheet === 'placeholders' && <>
      <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.5, color: D.sub }}>В текст вставится {'{ключ}'}, в договоре подставится значение.</p>
      {!focusArea.current && <p style={{ fontSize: 12, color: D.sub }}>Сначала поставьте курсор в заголовок или текст раздела.</p>}
      {[[COMPANY_PLACEHOLDERS, 'Компания'], [PROJECT_PLACEHOLDERS, 'Проект']].map(([rows, title]) => <div key={title}><div style={{ ...S.sec, marginTop: 12 }}>{title}</div>{rows.map(([key, label]) => <button key={key} disabled={!focusArea.current} onClick={() => insertPlaceholder(key)} aria-label={'Вставить {' + key + '}'} style={{ display: 'flex', alignItems: 'center', textAlign: 'left', gap: 12, width: '100%', padding: '10px 0', border: 0, borderBottom: '1px solid ' + D.line, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', opacity: focusArea.current ? 1 : .5 }}><span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', color: D.accent, fontSize: 13 }}>{'{' + key + '}'}</strong><span style={{ display: 'block', color: D.ink, fontSize: 12, marginTop: 2 }}>{label}</span><span style={{ display: 'block', color: D.dim, fontSize: 11, marginTop: 2, overflowWrap: 'anywhere' }}>{companyValues[key] || 'нет данных'}</span></span><strong style={{ color: D.accent, fontSize: 12 }}>Вставить</strong></button>)}</div>)}
    </>}
    {sheet === 'appendix' && <>
      <button onClick={() => addAppendix('text')} style={{ ...S.outline, width: '100%', marginBottom: 8 }}>Текст</button>
      <button disabled={tpl.appendices.some(row => row.kind === 'estimate')} onClick={() => addAppendix('estimate')} style={{ ...S.outline, width: '100%', opacity: tpl.appendices.some(row => row.kind === 'estimate') ? .4 : 1 }}>Смета{tpl.appendices.some(row => row.kind === 'estimate') ? ' · уже добавлена' : ''}</button>
    </>}
    {sheet === 'estimate' && estimateDraft && <>
      <div style={S.sec}>Тип сметы</div>
      {CONTRACT_ESTIMATE_TYPES.map(type => <button key={type.id} role="radio" aria-checked={estimateDraft.type === type.id} onClick={() => setEstimateDraft({ ...estimateDraft, type: type.id })} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', textAlign: 'left', gap: 12, border: '1.5px solid ' + (estimateDraft.type === type.id ? D.accent : D.border), borderRadius: 14, padding: 12, background: estimateDraft.type === type.id ? D.soft : D.card, marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit' }}><span style={{ width: 17, height: 17, flexShrink: 0, border: '2px solid ' + (estimateDraft.type === type.id ? D.accent : D.dim), borderRadius: '50%', display: 'grid', placeItems: 'center' }}>{estimateDraft.type === type.id && <span style={{ width: 9, height: 9, borderRadius: '50%', background: D.accent }} />}</span><span><strong style={{ color: D.ink, fontSize: 14, display: 'block' }}>{type.label}</strong><span style={{ color: D.sub, fontSize: 12 }}>{type.sub}</span></span></button>)}
      <div style={{ ...S.sec, marginTop: 16 }}>Столбцы</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>{CONTRACT_ESTIMATE_COLUMNS.map(([key, label]) => <button key={key} aria-pressed={estimateDraft.cols[key] !== false} onClick={() => setEstimateDraft({ ...estimateDraft, cols: { ...estimateDraft.cols, [key]: estimateDraft.cols[key] === false } })} style={S.chip(estimateDraft.cols[key] !== false)}>{label}</button>)}</div>
      <button onClick={() => { patchRow('appendices', estimateDraft.id, { exportOptions: { type: estimateDraft.type, cols: estimateDraft.cols } }); setSheet(null); }} style={{ ...S.primary, width: '100%' }}>Сохранить</button>
    </>}
    {sheet === 'company' && <>{COMPANY_ROWS.map(([key, label]) => <label key={key} style={{ display: 'block' }}><div style={S.label}>{label}</div><input value={tpl.head[key] || ''} onChange={event => patchHead({ [key]: event.target.value })} className="contract-template-company-input" style={sourceInput} /></label>)}<button onClick={() => setSheet(null)} style={{ ...S.primary, width: '100%', marginTop: 14 }}>Готово</button></>}
    {sheet === 'leave' && <><p style={{ color: D.sub, fontSize: 13 }}>Изменения шаблона ещё не сохранены.</p><button onClick={done} style={{ ...S.primary, width: '100%', marginBottom: 8 }}>Сохранить</button><button onClick={onClose} style={{ ...S.outline, width: '100%', color: D.danger }}>Не сохранять</button></>}
    {sheet === 'reset' && <><p style={{ color: D.sub, fontSize: 13 }}>Разделы и приложения будут заменены типовым шаблоном. Реквизиты компании сохранятся.</p><button onClick={() => { setTpl(normalizeContractTemplate({ ...DEFAULT_CONTRACT_TPL, head: tpl.head, numSeq: tpl.numSeq })); setSheet(null); }} style={{ ...S.primary, background: D.danger, width: '100%' }}>Сбросить шаблон</button></>}
  </Sheet>;
  if (preview) return <Shell title="Предпросмотр договора" sub="Данные проекта подставятся при создании договора" onClose={() => setPreview(false)}><Paper html={sample} /></Shell>;
  return <Shell sourceTemplate title="Шаблон договора" sub={null} onClose={leave} action={<button disabled={imageBusy} onClick={done} style={{ ...linkButton, fontSize: 15, fontWeight: 700, minHeight: 40, padding: '0 4px' }}>Готово</button>} overlay={<>{fieldActive && !sheet && <div style={{ position: 'absolute', left: 16, right: 16, bottom: 8, zIndex: 10, pointerEvents: 'none', display: 'flex', justifyContent: 'flex-end' }}><button onMouseDown={event => event.preventDefault()} onClick={openPlaceholders} style={{ minHeight: 48, padding: '0 16px', borderRadius: 12, border: 0, background: D.accent, color: '#FFFFFF', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', pointerEvents: 'auto', boxShadow: '0 4px 10px rgba(30,37,48,.18)' }}>Подстановки</button></div>}{overlay}</>}>
    <div className="z-contract-mobile-editor">
      <div style={sourceCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <strong style={sourceCardTitle}>Информация о компании</strong>
          <button onClick={editCompany} style={{ ...linkButton, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            Изменить <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4.5 2 4 4-4 4" /></svg>
          </button>
        </div>
        <div>
          {[
            ['logo', 'Лого', 'Загрузить логотип', logoRef],
            ['sign', 'Подпись', 'Загрузить подпись', signRef],
          ].map(([key, placeholder, buttonLabel, ref]) => <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <input ref={ref} type="file" accept="image/*" aria-label={buttonLabel} style={{ display: 'none' }} onChange={() => pickImg(ref, key)} />
            <div style={{ width: 72, height: 72, borderRadius: 12, background: '#F3F3FA', border: '1px solid #E4E4EE', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxSizing: 'border-box' }}>
              {tpl.head[key] ? <img src={tpl.head[key]} alt={placeholder} style={{ width: 72, height: 72, objectFit: 'contain' }} /> : <span style={{ fontSize: 11, fontWeight: 700, color: '#A5A9B8', textAlign: 'center', padding: '0 4px' }}>{placeholder}</span>}
            </div>
            <button disabled={imageBusy} onClick={() => ref.current?.click()} aria-label={buttonLabel} style={{ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, background: '#1461EE', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', color: '#FFFFFF', textAlign: 'center', cursor: 'pointer', opacity: imageBusy ? .7 : 1 }}>{buttonLabel}</button>
          </div>)}
        </div>
        {imageError && <p role="alert" style={{ color: D.danger, fontSize: 12 }}>{imageError}</p>}
        <div style={{ marginTop: 10 }}>
          {headRows.map(([key, label, value], index) => <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: index === headRows.length - 1 ? 0 : '0.5px solid #F1F1F7', padding: '8px 0' }}>
            <span style={{ width: 108, fontSize: 12, fontWeight: 600, color: '#6F7688', paddingTop: 1, flexShrink: 0 }}>{label}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, textAlign: 'left', fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-line', color: value ? '#1E2530' : '#A5A9B8' }}>{value || '—'}</span>
          </div>)}
        </div>
      </div>
      <div style={sourceGroupTitle}>Разделы договора</div>
      {tpl.sections.map((row, index) => <div key={row.id} style={sourceCard}>
        {rowHead('sections', row, index, 'Раздел')}
        <textarea {...fieldProps('sections', row, 'text')} className="contract-template-text" aria-label={'Текст раздела ' + (index + 1)} placeholder="Текст раздела" rows={3} style={sectionTextInput} />
      </div>)}
      <button onClick={() => patch({ sections: [...tpl.sections, { id: 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), title: 'Новый раздел', text: '' }] })} style={addButton}>+ Добавить раздел</button>
      <div style={{ height: .5, background: '#E4E4EE', margin: '8px 4px' }} />
      <div style={sourceGroupTitle}>Приложения к договору</div>
      {tpl.appendices.map((row, index) => <div key={row.id} style={sourceCard}>
        {rowHead('appendices', row, index, 'Приложение')}
        {row.kind === 'text' ? <textarea {...fieldProps('appendices', row, 'text')} className="contract-template-text" aria-label={'Текст приложения ' + (index + 1)} placeholder="Текст приложения" rows={3} style={sectionTextInput} /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, color: '#6F7688', fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>{CONTRACT_ESTIMATE_TYPES.find(type => type.id === row.exportOptions.type)?.label} · из проекта при генерации договора</p>
          <button onClick={() => { setEstimateDraft({ id: row.id, type: row.exportOptions.type, cols: { ...row.exportOptions.cols } }); setSheet('estimate'); }} style={{ padding: '12px 0', alignSelf: 'center', border: 0, background: 'transparent', color: '#1461EE', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>Параметры сметы</button>
        </div>}
      </div>)}
      <button onClick={() => setSheet('appendix')} style={addButton}>+ Добавить приложение</button>
      <p style={{ color: '#6f7688', fontSize: 11, lineHeight: '16px', padding: '0 4px', margin: '0 0 7px' }}>Подстановки: кнопка «Подстановки» над клавиатурой — {'{компания} {юр_лицо} {инн}'}… и данные проекта {'{клиент} {сумма}'}…</p>
      <div style={sourceCard}>
        <strong style={sourceCardTitle}>Оформление</strong>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>{CONTRACT_STYLES.map(style => <button key={style.id} aria-pressed={tpl.style === style.id} onClick={() => patch({ style: style.id })} style={{ flex: 1, border: '1px solid ' + (tpl.style === style.id ? '#1461EE' : '#E8E8F2'), borderRadius: 9, padding: '8px 4px', background: tpl.style === style.id ? '#1461EE' : '#FFFFFF', color: tpl.style === style.id ? '#FFFFFF' : '#5A6070', fontSize: 11, fontWeight: tpl.style === style.id ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>{style.id === 'accent' ? 'ZAMER' : style.label}</button>)}</div>
      </div>
      <button onClick={() => setPreview(true)} style={{ width: '100%', marginTop: 16, marginBottom: 8, background: '#1461EE', borderRadius: 12, padding: '14px 0', border: 0, color: '#FFFFFF', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>Предпросмотр договора</button>
    </div>
  </Shell>;
}

function mount(node, onClose) {
  const host = document.createElement('div');
  host.style.zIndex = '9000';
  document.body.appendChild(host);
  const unfit = fitToStage(host);
  const root = ReactDOM.createRoot(host);
  const close = () => { root.unmount(); unfit(); host.remove(); };
  root.render(React.cloneElement(node, { onClose: () => { if (onClose) onClose(); else close(); } }));
  return { close };
}
/* MagicContract.open({ project, total, area, est, contract, installDate, onSaveContract, onProjectPatch, onClose }) → { close }; договор сохраняется в проект автоматически */
export function open(opts) { return mount(<ProjectContract {...opts} />, opts.onClose); }
/* MagicContract.openTemplate({ onClose }) → { close } — редактор шаблона из главного меню */
export function openTemplate(opts = {}) { return mount(<TemplateEditor {...opts} />, opts.onClose); }
