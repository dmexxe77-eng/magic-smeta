import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { DEFAULT_CONTRACT_TPL, CONTRACT_ESTIMATE_TYPES, CONTRACT_ESTIMATE_COLUMNS, DEFAULT_CONTRACT_ESTIMATE_OPTIONS, normalizeContractTemplate, contractHtml, acceptanceHtml, signatureNameFromClient } from '../data/contract.js';
import { createContractDraft, validateContractDraft, contractDraftFields, createContractSnapshot, createActSnapshot, validateActDraft, parseContractMoney, formatDocumentDate } from '../data/contract-documents.js';
import { htmlToPdf } from '../utils/pdf.js';
import { collectPdfAvoidRanges, pdfContentEnd, paginatePdf } from '../utils/pdf-pagination.js';
import { fitToStage } from './stage.js';
import { contractTemplateAccess } from './contract-template-store.js';
import './contract-editor.css';

const money = value => (Number(value) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const clone = value => JSON.parse(JSON.stringify(value));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const toInputDate = value => /^\d{2}\.\d{2}\.\d{4}$/.test(value || '') ? value.split('.').reverse().join('-') : value || '';
const hasErrors = errors => Object.keys(errors).length > 0;
const newId = prefix => prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

function Icon({ name = 'file', size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'back' ? <path d="m14 6-6 6 6 6" /> : name === 'down' ? <path d="m6 9 6 6 6-6" /> : name === 'eye' ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : name === 'check' ? <path d="m5 12 4 4L19 6" /> : <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></>}
  </svg>;
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button type="button" className={'cd-button cd-button-' + variant + ' ' + className} {...props}>{children}</button>;
}
function Field({ label, error, value, onChange, textarea = false, className = '', ...props }) {
  const Control = textarea ? 'textarea' : 'input';
  return <label className={'cd-field ' + className}><span>{label}</span><Control aria-label={label} aria-invalid={!!error} value={value ?? ''} onChange={event => onChange(event.target.value)} {...props} />{error && <small className="cd-field-error">{error}</small>}</label>;
}
function Tabs({ value, onChange }) {
  return <div className="cd-tabs" role="tablist" aria-label="Вид документа">{[['contract', 'Договор'], ['act', 'Акт выполненных работ']].map(([id, label]) => <button type="button" role="tab" aria-selected={value === id} key={id} onClick={() => onChange(id)}>{label}</button>)}</div>;
}
function Card({ title, action, children, className = '' }) {
  return <section className={'cd-card ' + className}>{(title || action) && <div className="cd-card-heading"><h2>{title}</h2>{action}</div>}{children}</section>;
}
function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current?.querySelector('button,input,textarea')?.focus(); return () => { if (previous?.isConnected) previous.focus?.(); }; }, []);
  const keyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not([disabled]),input,textarea,select')], first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="cd-sheet-backdrop" onKeyDown={keyDown}><button className="cd-sheet-dismiss" aria-label="Закрыть окно" onClick={onClose} /><section className="cd-sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}><div className="cd-sheet-handle" /><div className="cd-sheet-heading"><h2>{title}</h2><button className="cd-icon-button" onClick={onClose} aria-label="Закрыть">×</button></div><div className="cd-sheet-content">{children}</div></section></div>;
}
function Shell({ title, sub, onClose, action, children, footer, overlay }) {
  return <div className="z-contract-shell cd-shell"><header className="z-contract-header cd-header"><button className="cd-back" onClick={onClose} aria-label="Закрыть договор"><Icon name="back" /></button><div className="cd-header-title"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{action}</header><div className="z-contract-content cd-content">{children}</div>{footer && <footer className="cd-footer">{footer}</footer>}{overlay}</div>;
}
function Paper({ html }) {
  const [layout, setLayout] = useState({ width: 0, slices: [] });
  const wrap = useRef(null);
  useLayoutEffect(() => {
    const source = document.createElement('div');
    source.setAttribute('aria-hidden', 'true');
    source.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;width:800px;background:#fff;z-index:-1;';
    source.innerHTML = html;
    document.body.appendChild(source);
    const article = source.firstElementChild || source;
    let frame = 0, active = true;
    const measure = () => {
      if (!active || !wrap.current) return;
      const rect = article.getBoundingClientRect();
      // html2canvas rounds the measured bounds up before rendering at scale 2.
      const canvasWidth = Math.max(1, Math.ceil(rect.width) * 2), canvasHeight = Math.max(1, Math.ceil(rect.height) * 2);
      const scaleY = canvasHeight / Math.max(1, article.scrollHeight);
      const toRange = element => { const bounds = element.getBoundingClientRect(); return { top: Math.max(0, Math.floor((bounds.top - rect.top) * scaleY)), bottom: Math.min(canvasHeight, Math.ceil((bounds.bottom - rect.top) * scaleY)) }; };
      const avoidRanges = collectPdfAvoidRanges(article, toRange);
      const slices = paginatePdf({ height: canvasHeight, pageHeight: Math.max(1, Math.floor(277 * canvasWidth / 190)), edgeTolerance: 1, avoidRanges, breakBefore: [...article.querySelectorAll('[data-pdf-break-before]')].map(element => toRange(element).top), contentEnd: pdfContentEnd(article, toRange) });
      const next = { width: wrap.current.clientWidth, contentWidth: canvasWidth / 2, slices };
      setLayout(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const schedule = () => { if (!active) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(article); if (wrap.current) observer.observe(wrap.current);
    document.fonts?.ready.then(schedule);
    source.addEventListener('load', schedule, true);
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); source.removeEventListener('load', schedule, true); source.remove(); };
  }, [html]);
  const contentWidth = layout.contentWidth || 720, mm = contentWidth / 190, pageWidth = 210 * mm, pageHeight = 297 * mm, margin = 10 * mm;
  const scale = layout.width ? Math.min(1, layout.width / pageWidth) : 1;
  return <div className="cd-preview cd-pdf-preview" ref={wrap} aria-label="Предпросмотр PDF">{!layout.slices.length && <p className="cd-note" role="status">Готовлю предпросмотр…</p>}{layout.slices.map((slice, index) => <figure className="cd-pdf-page" key={index} data-pdf-page={index + 1}><figcaption>{index + 1} / {layout.slices.length}</figcaption><div className="cd-pdf-page-frame" style={{ width: pageWidth * scale, height: pageHeight * scale }} role="img" aria-label={'Страница ' + (index + 1) + ' из ' + layout.slices.length}><div className="cd-pdf-sheet" style={{ width: pageWidth, height: pageHeight, transform: 'scale(' + scale + ')' }} aria-hidden="true"><div className="cd-pdf-clip" style={{ left: margin, top: margin, width: contentWidth, height: (slice.bottom - slice.top) / 2 }}><div className="cd-pdf-document" style={{ width: contentWidth, transform: 'translateY(-' + slice.top / 2 + 'px)' }} dangerouslySetInnerHTML={{ __html: html }} /></div></div></div></figure>)}</div>;
}
function PreviewScreen({ title, html, example, onClose }) {
  return <Shell title={title} sub={example ? 'Пример на условных данных' : null} onClose={onClose}><Paper html={html} /></Shell>;
}

const PLACEHOLDERS = [['исполнитель', 'Исполнитель'], ['клиент', 'Заказчик'], ['телефон', 'Телефон заказчика'], ['адрес', 'Адрес объекта'], ['номер', 'Номер договора'], ['дата', 'Дата договора'], ['дата_начала', 'Начало работ'], ['срок_монтажа', 'Окончание работ'], ['сумма', 'Стоимость'], ['сумма_прописью', 'Стоимость прописью'], ['предоплата', 'Предоплата'], ['остаток', 'Остаток оплаты'], ['площадь', 'Площадь'], ['компания', 'Компания'], ['юр_лицо', 'Исполнитель'], ['инн', 'ИНН исполнителя'], ['адрес_компании', 'Адрес компании'], ['юр_адрес', 'Юридический адрес исполнителя'], ['банк', 'Банковские реквизиты']];
const ACT_PLACEHOLDERS = [['номер_договора', 'Номер связанного договора'], ['дата_договора', 'Дата связанного договора'], ['дата_завершения', 'Дата завершения работ'], ['работы_акта', 'Выполненные работы'], ['результат_приёмки', 'Результат приёмки'], ['замечания_акта', 'Замечания'], ['срок_устранения', 'Срок устранения замечаний'], ['сумма_акта', 'Стоимость по акту'], ['оплата_акта', 'Полученная оплата'], ['остаток_акта', 'Остаток по акту']];

function TemplateEditor({ onClose, templateStore, company }) {
  const access = contractTemplateAccess(templateStore);
  const [tpl, setTpl] = useState(() => { const source = access.load(); return normalizeContractTemplate({ ...source, style: 'magic', head: { ...source.head, ...company } }); });
  const original = useRef(JSON.stringify(tpl)), focusArea = useRef(null), createdAppendix = useRef(null);
  const [tab, setTab] = useState('contract'), [sheet, setSheet] = useState(null), [preview, setPreview] = useState(false), [expanded, setExpanded] = useState(null), [error, setError] = useState(''), [removed, setRemoved] = useState(null), [estimateDraft, setEstimateDraft] = useState(null);
  const dirty = JSON.stringify(tpl) !== original.current;
  const patch = values => setTpl(current => ({ ...current, ...values }));
  const patchRow = (list, id, values) => setTpl(current => list === 'preamble' ? { ...current, preamble: values.text ?? current.preamble } : { ...current, [list]: current[list].map(row => row.id === id ? { ...row, ...values } : row) });
  const save = close => {
    setError('');
    try { access.save(tpl); original.current = JSON.stringify(tpl); if (close) onClose(); return true; }
    catch (cause) { setError(cause?.message || 'Не удалось сохранить настройки. Попробуйте ещё раз.'); return false; }
  };
  const leave = () => dirty ? setSheet('leave') : onClose();
  const move = (list, index, direction) => setTpl(current => {
    const rows = [...current[list]];
    const movable = rows.flatMap((row, position) => list !== 'appendices' || row.kind === 'text' ? [position] : []);
    const next = movable[movable.indexOf(index) + direction];
    if (next === undefined) return current;
    [rows[index], rows[next]] = [rows[next], rows[index]];
    return { ...current, [list]: rows };
  });
  const remove = (list, index) => { setRemoved({ list, index, row: tpl[list][index] }); patch({ [list]: tpl[list].filter((_, i) => i !== index) }); setExpanded(null); };
  const undoRemove = () => { if (!removed) return; setTpl(current => { const rows = [...current[removed.list]]; rows.splice(removed.index, 0, removed.row); return { ...current, [removed.list]: rows }; }); setRemoved(null); };
  const addAppendix = (kind = 'text') => {
    const row = kind === 'estimate' ? { id: newId('ap'), kind, exportOptions: clone(DEFAULT_CONTRACT_ESTIMATE_OPTIONS) } : { id: newId('ap'), kind, title: 'Новое приложение', text: '' };
    createdAppendix.current = row.id;
    setTpl(current => ({ ...current, appendices: [...current.appendices, row] }));
    setExpanded('appendices:' + row.id);
  };
  const fieldProps = (list, row, field) => {
    const capture = element => { focusArea.current = { list, id: row.id, field, element, start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 }; };
    return { value: row[field] || '', onChange: event => { patchRow(list, row.id, { [field]: event.target.value }); capture(event.target); }, onFocus: event => capture(event.target), onSelect: event => capture(event.target), onKeyUp: event => capture(event.target) };
  };
  const openFields = (list, row, button) => {
    const element = button.closest('.cd-section-body')?.querySelector('textarea');
    if (!element) return;
    focusArea.current = { list, id: row.id, field: 'text', element, start: element.selectionStart ?? element.value.length, end: element.selectionEnd ?? element.value.length };
    setSheet('placeholders');
  };
  const insert = key => {
    const target = focusArea.current; if (!target) return;
    const row = target.list === 'preamble' ? { text: tpl.preamble } : tpl[target.list].find(value => value.id === target.id); if (!row) return;
    const value = row[target.field] || '', token = '{' + key + '}', start = Math.min(target.start, value.length), end = Math.max(start, Math.min(target.end, value.length));
    patchRow(target.list, target.id, { [target.field]: value.slice(0, start) + token + value.slice(end) }); setSheet(null);
    setTimeout(() => { if (target.element?.isConnected) { target.element.focus(); target.element.setSelectionRange(start + token.length, start + token.length); } }, 0);
  };
  const list = tab === 'act' ? 'actSections' : 'sections', sections = tpl[list] || [];
  const placeholders = tab === 'act' ? [...PLACEHOLDERS.map(([key, label]) => [key, key === 'номер' ? 'Номер акта' : key === 'дата' ? 'Дата акта' : label]), ...ACT_PLACEHOLDERS] : PLACEHOLDERS;
  const sampleProject = { name: 'Квартира · пример', client: 'Иванов Алексей Сергеевич', phone: '+7 (999) 123-45-67', address: 'г. Хабаровск, ул. Примерная, д. 12, кв. 8' };
  const sampleDraft = { ...createContractDraft({ project: sampleProject, total: 85000, area: 42.6, template: tpl, today: today() }), number: 'ПРИМЕР-01', startDate: '2026-11-20', endDate: '2026-11-21' };
  const sampleFields = contractDraftFields(sampleDraft), sampleEst = { mats: [{ n: 'Полотно и профиль', q: 42.6, u: 'м²', p: 1500 }], works: [{ n: 'Монтаж натяжного потолка', q: 1, u: 'компл.', p: 21100 }] };
  const sample = tab === 'act' ? acceptanceHtml(tpl, sampleFields, { number: 'А-01', date: '2026-11-21', completionDate: '2026-11-21', acceptance: 'none', scope: 'Монтаж натяжных потолков в трёх помещениях, 42,6 м².', total: 85000, paid: 42500 }, sampleEst) : contractHtml(tpl, sampleFields, sampleEst);
  if (preview) return <PreviewScreen title={tab === 'act' ? 'Пример акта' : 'Пример договора'} html={sample} example onClose={() => setPreview(false)} />;
  const renderRows = (key, rows, label) => rows.map((row, index) => {
    const open = expanded === key + ':' + row.id;
    const actualIndex = key === 'appendices' ? tpl.appendices.findIndex(value => value.id === row.id) : index;
    const displayNumber = key === 'appendices' ? row.kind === 'estimate' ? 1 : index + 3 : index + 1;
    return <div className="cd-section-item" key={row.id}><button className="cd-section-toggle" type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : key + ':' + row.id)}><span className="cd-section-index">{displayNumber}</span><span><strong>{row.kind === 'estimate' ? 'Приложение №1 — Смета' : row.title || 'Новый раздел'}</strong><small>{row.kind === 'estimate' ? 'Подставляются из проекта' : (row.text || 'Добавьте текст').replace(/\{[^}]+\}/g, '…')}</small></span><Icon name="down" size={15} /></button>{open && <div className="cd-section-body">{row.kind === 'estimate' ? <><p className="cd-note">{CONTRACT_ESTIMATE_TYPES.find(type => type.id === row.exportOptions?.type)?.label || 'Общая смета'}</p><Button variant="secondary" onClick={() => { setEstimateDraft({ id: row.id, type: row.exportOptions.type, cols: { ...row.exportOptions.cols } }); setSheet('estimate'); }}>Параметры сметы</Button></> : <><label className="cd-field"><span>Название</span><input {...fieldProps(key, row, 'title')} autoFocus={key === 'appendices' && createdAppendix.current === row.id} aria-label={label + ' ' + displayNumber} /></label><label className="cd-field"><span>Текст</span><textarea {...fieldProps(key, row, 'text')} aria-label={'Текст ' + (key === 'appendices' ? 'приложения' : 'раздела') + ' ' + displayNumber} rows={8} /></label><button className="cd-text-button" type="button" onMouseDown={event => event.preventDefault()} onClick={event => openFields(key, row, event.currentTarget)}>Вставить поле</button></>}<div className="cd-section-actions"><button type="button" disabled={row.kind === 'estimate' || !index} onClick={() => move(key, actualIndex, -1)} aria-label={'Переместить выше ' + label.toLowerCase() + ' ' + displayNumber}>Выше</button><button type="button" disabled={row.kind === 'estimate' || index === rows.length - 1} onClick={() => move(key, actualIndex, 1)}>Ниже</button><button className="cd-danger-text" type="button" onClick={() => remove(key, actualIndex)} aria-label={'Удалить ' + label.toLowerCase() + ' ' + displayNumber}>Удалить</button></div></div>}</div>;
  });
  let overlay = null;
  if (sheet) overlay = <Sheet title={sheet === 'leave' ? 'Сохранить изменения?' : sheet === 'placeholders' ? 'Вставить поле' : sheet === 'estimate' ? 'Параметры сметы' : sheet === 'reset' ? 'Вернуть стандартный текст?' : 'Добавить приложение'} onClose={() => setSheet(null)}>
    {sheet === 'leave' && <><p className="cd-note">В настройках есть несохранённые изменения.</p><Button className="cd-full" onClick={() => save(true)}>Сохранить</Button><Button variant="secondary" className="cd-full" onClick={onClose}>Не сохранять</Button></>}
    {sheet === 'reset' && <><p className="cd-note">Заменится только текст текущего документа. Реквизиты и настройки сохранятся.</p><Button className="cd-full" onClick={() => { patch({ [list]: clone(DEFAULT_CONTRACT_TPL[list] || []), ...(tab === 'contract' ? { preamble: DEFAULT_CONTRACT_TPL.preamble } : {}) }); setExpanded(null); setSheet(null); }}>Вернуть стандартный текст</Button></>}
    {sheet === 'placeholders' && <><p className="cd-note">{focusArea.current ? 'Выберите данные для вставки в позицию курсора.' : 'Сначала поставьте курсор в текст раздела.'}</p><div className="cd-placeholder-list">{placeholders.map(([key, label]) => <button type="button" key={key} disabled={!focusArea.current} aria-label={'Вставить {' + key + '}'} onClick={() => insert(key)}><span><strong>{label}</strong><small>Подставится в документ</small></span><span className="cd-token">{'{' + key + '}'}</span></button>)}</div></>}
    {sheet === 'estimate' && estimateDraft && <><div className="cd-form-stack">{CONTRACT_ESTIMATE_TYPES.map(type => <button type="button" className={'cd-option ' + (estimateDraft.type === type.id ? 'is-active' : '')} role="radio" aria-checked={estimateDraft.type === type.id} key={type.id} onClick={() => setEstimateDraft({ ...estimateDraft, type: type.id })}><strong>{type.label}</strong><small>{type.sub}</small></button>)}</div><p className="cd-label">Столбцы</p><div className="cd-chips">{CONTRACT_ESTIMATE_COLUMNS.map(([key, label]) => <button type="button" aria-pressed={estimateDraft.cols[key] !== false} key={key} onClick={() => setEstimateDraft({ ...estimateDraft, cols: { ...estimateDraft.cols, [key]: estimateDraft.cols[key] === false } })}>{label}</button>)}</div><Button className="cd-full" onClick={() => { patchRow('appendices', estimateDraft.id, { exportOptions: { ...DEFAULT_CONTRACT_ESTIMATE_OPTIONS, type: estimateDraft.type, cols: estimateDraft.cols } }); setSheet(null); }}>Сохранить параметры</Button></>}
    {error && <p className="cd-error" role="alert">{error}</p>}
  </Sheet>;
  return <Shell title="Шаблон документов" onClose={leave} footer={<div className="cd-template-footer"><span className="cd-save-state">{dirty ? 'Есть изменения' : 'Изменения сохранены'}</span><div className="cd-bottom-actions"><Button variant="secondary" onClick={() => setPreview(true)} aria-label="Предпросмотр документа">Предпросмотр</Button><Button onClick={() => save(true)}>Сохранить</Button></div></div>} overlay={overlay}>
    <Tabs value={tab} onChange={value => { setTab(value); setExpanded(null); }} />
    <p className="cd-template-intro">{tab === 'act' ? 'Текст для актов выполненных работ. Даты, объём и результат приёмки заполняются в проекте.' : 'Текст для новых договоров. Клиент, адрес и стоимость подставляются из проекта.'}</p>
    <Card title={tab === 'act' ? 'Содержание акта' : 'Содержание договора'} action={<span className="cd-count">{sections.length} разделов</span>}><p className="cd-note cd-note-top">{tab === 'act' ? 'Все основные формулировки акта редактируются здесь. Поля в скобках заполнятся данными проекта и приёмки.' : 'Типовой текст уже подготовлен. Откройте раздел, если нужно изменить его под свою работу.'}</p><div className="cd-section-list">{tab === 'contract' && <div className="cd-section-item"><button type="button" className="cd-section-toggle" aria-expanded={expanded === 'preamble'} onClick={() => setExpanded(expanded === 'preamble' ? null : 'preamble')}><span className="cd-section-index"><Icon size={14} /></span><span><strong>Вступление</strong><small>{(tpl.preamble || 'Исполнитель и заказчик заключают договор').replace(/\{[^}]+\}/g, '…')}</small></span><Icon name="down" size={15} /></button>{expanded === 'preamble' && <div className="cd-section-body"><label className="cd-field"><span>Текст вступления</span><textarea {...fieldProps('preamble', { id: 'preamble', text: tpl.preamble }, 'text')} aria-label="Текст вступления" rows={6} /></label><button type="button" className="cd-text-button" onMouseDown={event => event.preventDefault()} onClick={event => openFields('preamble', { id: 'preamble' }, event.currentTarget)}>Вставить поле</button></div>}</div>}{renderRows(list, sections, 'Раздел')}</div><button type="button" className="cd-add" onClick={() => { const row = { id: newId('s'), title: 'Новый раздел', text: '' }; patch({ [list]: [...sections, row] }); setExpanded(list + ':' + row.id); }}>+ Добавить раздел</button>{removed && <div className="cd-undo"><span>Раздел удалён</span><button type="button" onClick={undoRemove}>Отменить</button></div>}<button type="button" className="cd-text-button cd-reset" onClick={() => setSheet('reset')}>Вернуть стандартный текст</button></Card>
    {tab === 'contract' && <Card title="Приложения"><p className="cd-note cd-note-top">Каждое приложение начинается с нового листа.</p><div className="cd-section-list">{renderRows('appendices', tpl.appendices.filter(row => row.kind === 'estimate'), 'Приложение')}{renderRows('appendices', tpl.appendices.filter(row => row.kind === 'text'), 'Приложение')}</div>{!tpl.appendices.some(row => row.kind === 'estimate') && <button type="button" className="cd-add" onClick={() => addAppendix('estimate')}>+ Добавить смету из проекта</button>}<button type="button" className="cd-add" onClick={() => addAppendix()}>+ Добавить приложение</button></Card>}
    {error && <p className="cd-error" role="alert">{error}</p>}
  </Shell>;
}

function ProjectContract({ project, total, area, est, estimateAdjustment, estimateExportOptions, contract, installDate, onSaveContract, onProjectPatch, onClose, templateStore, company, rooms, documentContext }) {
  const access = contractTemplateAccess(templateStore);
  const actValues = value => Object.fromEntries(['number', 'date', 'completionDate', 'acceptance', 'remarks', 'remedyDate', 'scope', 'total', 'paid'].filter(key => Object.prototype.hasOwnProperty.call(value || {}, key)).map(key => [key, value[key]]));
  const [tpl] = useState(() => { const source = access.load(); return normalizeContractTemplate({ ...source, style: 'magic', head: { ...source.head, ...company } }); });
  const [saved, setSaved] = useState(contract || null);
  const [draft, setDraft] = useState(() => createContractDraft({ saved: contract, project, total, area, installDate, template: tpl, refreshFromProject: true }));
  const [tab, setTab] = useState('contract'), [preview, setPreview] = useState(false), [errors, setErrors] = useState({}), [error, setError] = useState(''), [busy, setBusy] = useState(''), [leaveOpen, setLeaveOpen] = useState(false);
  const [actDraft, setActDraft] = useState(() => { const previous = contract?.actDraft || contract?.act || {}; return { number: previous.number ?? 'А-' + draft.number, date: previous.date ?? today(), completionDate: previous.completionDate ?? '', acceptance: previous.acceptance ?? '', remarks: previous.remarks ?? '', remedyDate: previous.remedyDate ?? '', scope: previous.scope ?? 'Работы по изготовлению и монтажу натяжных потолков согласно договору и смете.', total: previous.total ?? total, paid: project.paid ?? previous.paid ?? '' }; });
  const originalDraft = useRef(JSON.stringify(draft)), originalAct = useRef(JSON.stringify(actDraft)), numberTaken = useRef(!!contract?.html || contract?.numberAllocated === true);
  const context = documentContext || { project, rooms };
  const dirty = JSON.stringify(draft) !== originalDraft.current || JSON.stringify(actDraft) !== originalAct.current;
  const patch = values => setDraft(current => ({ ...current, ...values }));
  const patchParty = values => setDraft(current => ({ ...current, party: { ...current.party, ...values } }));
  const patchAct = values => setActDraft(current => ({ ...current, ...values }));
  const close = () => busy ? null : dirty ? setLeaveOpen(true) : onClose();
  const focusInvalid = () => requestAnimationFrame(() => { const field = window.document.querySelector('.cd-shell [aria-invalid="true"]'); field?.scrollIntoView({ block: 'center' }); field?.focus({ preventScroll: true }); });
  const currentActValid = !hasErrors(validateActDraft(actDraft));
  const lastAct = saved?.act || saved?.actDraft;
  const actForContract = currentActValid ? actDraft : lastAct && !hasErrors(validateActDraft(lastAct)) ? lastAct : null;
  const persist = (next, savedActDraft = false) => {
    if (!onSaveContract) throw new Error('Сохранение документа недоступно');
    onSaveContract(next); setSaved(next);
    originalDraft.current = JSON.stringify(draft);
    if (savedActDraft) originalAct.current = JSON.stringify(actDraft);
  };
  const saveAndExit = () => {
    setError('');
    try {
      const next = { ...draft, client: draft.party.client, phone: draft.party.phone, address: draft.party.address, schemaVersion: 2, status: 'draft', frozen: false, numberAllocated: numberTaken.current, actDraft: actValues(actDraft), act: actForContract ? actValues(actForContract) : null };
      onProjectPatch?.({ client: draft.party.client, phone: draft.party.phone, address: draft.party.address });
      persist(next, true); onClose();
    } catch (cause) { setError(cause?.message || 'Не удалось сохранить черновик. Попробуйте ещё раз.'); }
  };
  const exportDocument = async () => {
    if (busy) return;
    const contractErrors = validateContractDraft(draft), actErrors = tab === 'act' ? validateActDraft(actDraft) : {};
    setErrors(tab === 'act' ? actErrors : contractErrors); setError('');
    if (hasErrors(contractErrors)) { setTab('contract'); setErrors(contractErrors); setError('Проверьте выделенные поля договора.'); focusInvalid(); return; }
    if (hasErrors(actErrors)) { setError('Проверьте выделенные поля акта.'); focusInvalid(); return; }
    setBusy('pdf');
    try {
      const snapshot = createContractSnapshot({ draft, template: tpl, est, estimateAdjustment, estimateExportOptions, documentContext: context, actDraft: actForContract });
      if (!numberTaken.current) { const current = access.load(); access.save({ ...current, numSeq: (current.numSeq || 1) + 1 }); numberTaken.current = true; }
      const act = actForContract ? createActSnapshot({ contract: snapshot, act: actForContract, template: tpl, est, estimateAdjustment, estimateExportOptions, documentContext: context }) : null;
      persist({ ...snapshot, act, numberAllocated: numberTaken.current }, currentActValid);
      onProjectPatch?.({ client: draft.party.client, phone: draft.party.phone, address: draft.party.address });
      const selected = tab === 'act' ? act : snapshot;
      const filename = (tab === 'act' ? 'Акт_' : 'Договор_') + selected.number + '_' + (project.name || '');
      await htmlToPdf(selected.html, filename);
    } catch (cause) { if (cause?.fields) setErrors(cause.fields); if (cause?.name !== 'AbortError') setError(cause?.message || 'Не удалось подготовить PDF'); }
    finally { setBusy(''); }
  };
  const draftFields = contractDraftFields(draft);
  const draftPreview = tab === 'act' ? acceptanceHtml(tpl, draftFields, actDraft, est, estimateAdjustment, estimateExportOptions, context) : contractHtml(tpl, draftFields, est, estimateAdjustment, estimateExportOptions, context, actForContract);
  if (preview) return <PreviewScreen title={tab === 'act' ? 'Предпросмотр акта' : 'Предпросмотр договора'} html={draftPreview} onClose={() => setPreview(false)} />;
  const overlay = leaveOpen && <Sheet title="Сохранить изменения?" onClose={() => setLeaveOpen(false)}><p className="cd-note">Можно сохранить заполненные поля и продолжить позже.</p><Button className="cd-full" onClick={saveAndExit}>Сохранить и выйти</Button><Button variant="secondary" className="cd-full" onClick={() => setLeaveOpen(false)}>Продолжить редактирование</Button><Button variant="secondary" className="cd-full cd-danger-text" onClick={onClose}>Закрыть без сохранения</Button>{error && <p className="cd-error" role="alert">{error}</p>}</Sheet>;
  return <Shell title="Документы" sub={project.name} onClose={close} footer={<div className="cd-actions cd-export-actions"><Button variant="secondary" disabled={!!busy} aria-label="Предпросмотр документа" onClick={() => setPreview(true)}>Предпросмотр</Button><Button disabled={!!busy} onClick={exportDocument}>{busy === 'pdf' ? 'Готовлю PDF…' : 'Скачать PDF'}</Button></div>} overlay={overlay}>
    <Tabs value={tab} onChange={value => { setTab(value); setErrors({}); setError(''); }} />
    {tab === 'contract' ? <>
      <Card title="Заказчик"><Field label="Заказчик" placeholder="ФИО или название организации" value={draft.party.client} onChange={value => patchParty({ client: value })} error={errors.client} /><Field label="ФИО заказчика для подписи" placeholder="Иванов И.И." value={draft.party.signerName ?? signatureNameFromClient(draft.party.client, draft.party)} onChange={value => patchParty({ signerName: value })} /><Field label="Телефон заказчика" type="tel" placeholder="+7 …" value={draft.party.phone} onChange={value => patchParty({ phone: value })} error={errors.phone} /><Field label="Адрес объекта" value={draft.party.address} onChange={value => patchParty({ address: value })} error={errors.address} /><details className="cd-details" open={errors.inn || errors.kpp ? true : undefined}><summary>Реквизиты заказчика <Icon name="down" size={14} /></summary><div className="cd-form-stack"><div className="cd-grid"><Field label="ИНН заказчика" inputMode="numeric" value={draft.party.inn} onChange={value => patchParty({ inn: value })} error={errors.inn} /><Field label="КПП заказчика" inputMode="numeric" value={draft.party.kpp} onChange={value => patchParty({ kpp: value })} error={errors.kpp} /></div><Field label="Юридический адрес заказчика" value={draft.party.legalAddress} onChange={value => patchParty({ legalAddress: value })} /><Field label="Представитель заказчика" value={draft.party.representative} onChange={value => patchParty({ representative: value })} /><Field label="Основание полномочий" placeholder="Устав или доверенность" value={draft.party.authority} onChange={value => patchParty({ authority: value })} /></div></details></Card>
      <Card title="Условия договора"><div className="cd-grid"><Field label="Номер договора" value={draft.number} onChange={value => { patch({ number: value, numberAuto: false }); if (actDraft.number === 'А-' + draft.number) patchAct({ number: 'А-' + value }); }} error={errors.number} /><Field label="Дата договора" type="date" value={toInputDate(draft.date)} onChange={value => patch({ date: value })} error={errors.date} /><Field label="Начало работ" type="date" value={toInputDate(draft.startDate)} onChange={value => patch({ startDate: value })} error={errors.startDate} /><Field label="Окончание работ" type="date" value={toInputDate(draft.endDate)} onChange={value => patch({ endDate: value })} error={errors.endDate} /></div><div className="cd-total-line"><span>Стоимость по смете</span><strong>{money(draft.total)} ₽</strong></div>{errors.total && <p className="cd-field-error">{errors.total}</p>}<Field label="Предоплата, ₽" value={draft.prepay} inputMode="decimal" onChange={value => patch({ prepay: value })} error={errors.prepay} /><div className="cd-chips cd-prepay-chips">{[30, 50, 70, 100].map(percent => <button type="button" key={percent} onClick={() => patch({ prepay: Math.round(draft.total * percent) / 100 })}>{percent}%</button>)}</div><p className="cd-note">Остаток по условиям договора: {Number.isFinite(parseContractMoney(draft.prepay)) ? money(draft.total - parseContractMoney(draft.prepay)) + ' ₽' : '—'}</p></Card><p className="cd-note cd-screen-note">Суммы и смета — из текущего расчёта. Текст и оформление — из настроек документов.</p>
    </> : <><Card title="Акт выполненных работ"><p className="cd-note cd-note-top">Приложение №2 к договору № {draft.number} от {formatDocumentDate(draft.date)}. Акт сохраняется отдельным документом.</p><div className="cd-grid"><Field label="Номер акта" value={actDraft.number} onChange={value => patchAct({ number: value })} error={errors.number} /><Field label="Дата акта" type="date" value={toInputDate(actDraft.date)} onChange={value => patchAct({ date: value })} error={errors.date} /></div><Field label="Работы завершены" type="date" value={toInputDate(actDraft.completionDate)} onChange={value => patchAct({ completionDate: value })} error={errors.completionDate} /><Field label="Выполненные работы" textarea rows={3} value={actDraft.scope} onChange={value => patchAct({ scope: value })} error={errors.scope} /></Card><Card title="Подпись заказчика"><Field label="ФИО заказчика для подписи" placeholder="Иванов И.И." value={draft.party.signerName ?? signatureNameFromClient(draft.party.client, draft.party)} onChange={value => patchParty({ signerName: value })} /></Card><Card title="Приёмка работ"><div className="cd-acceptance">{[['none', 'Без замечаний'], ['remarks', 'Есть замечания']].map(([value, label]) => <button type="button" aria-pressed={actDraft.acceptance === value} className={actDraft.acceptance === value ? 'is-active' : ''} key={value} onClick={() => patchAct({ acceptance: value })}>{label}</button>)}</div>{errors.acceptance && <p className="cd-field-error">{errors.acceptance}</p>}{actDraft.acceptance === 'remarks' && <><Field label="Замечания и недостатки" textarea rows={3} value={actDraft.remarks} onChange={value => patchAct({ remarks: value })} error={errors.remarks} /><Field label="Устранить до" type="date" value={toInputDate(actDraft.remedyDate)} onChange={value => patchAct({ remedyDate: value })} error={errors.remedyDate} /></>}</Card><Card title="Стоимость выполненных работ"><Field label="Стоимость по акту, ₽" inputMode="decimal" value={actDraft.total} onChange={value => patchAct({ total: value })} error={errors.total} /></Card></>}
    {error && <p className="cd-error" role="alert">{error}</p>}
  </Shell>;
}

function mount(node, onClose) {
  const host = document.createElement('div'); host.style.zIndex = '9000'; document.body.appendChild(host);
  const unfit = fitToStage(host), root = ReactDOM.createRoot(host);
  const close = () => { root.unmount(); unfit(); host.remove(); };
  root.render(React.cloneElement(node, { onClose: () => { if (onClose) onClose(); else close(); } }));
  return { close };
}
export function open(opts) { return mount(<ProjectContract {...opts} />, opts.onClose); }
export function openTemplate(opts = {}) { return mount(<TemplateEditor {...opts} />, opts.onClose); }
