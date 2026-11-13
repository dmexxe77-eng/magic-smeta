import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { fitToStage } from './stage.js';
import { calculateEstimateTotals, estimateAdjustmentRates, normalizeEstimateAdjustment, updateEstimateAdjustment } from '../utils/estimate-adjustment.js';
import { estimateAdjustmentVisibility, setEstimateAdjustmentVisibility, normalizeEstimateExportOptions } from '../utils/estimate-export-options.js';
import './estimate-editor.css';

const TYPES = [
  ['total', 'Общая смета', 'Материалы, работы и оборудование'],
  ['draw', 'Общая + чертежи', 'Все планы на отдельных листах'],
  ['rooms', 'По помещениям', 'Чертёж и расчёт каждого помещения'],
];
const COLUMNS = [['num', '#'], ['photo', 'Фото'], ['name', 'Название'], ['qty', 'Кол-во'], ['unit', 'Ед.'], ['price', 'Цена'], ['total', 'Итого']];
const SCOPES = [['all', 'Вся смета'], ['mats', 'Материалы'], ['works', 'Работы'], ['equipment', 'Оборудование']];
const PERCENTS = [-15, -10, -5, 0, 5, 10, 15];
const money = number => `${Number(number || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const pct = number => `${number > 0 ? '+' : number < 0 ? '−' : ''}${Math.abs(number).toLocaleString('ru-RU', { maximumFractionDigits: 10 })}%`;
const delta = number => `${number > 0 ? '+' : number < 0 ? '−' : ''}${money(Math.abs(number))}`;
const sum = rows => (rows || []).reduce((total, row) => total + (Number(row.q) || 0) * (Number(row.p) || 0), 0);

function initialState(opts) {
  const options = normalizeEstimateExportOptions(opts.exportOptions);
  return {
    adjustment: normalizeEstimateAdjustment(opts.adjustment),
    exportOptions: {
      ...options,
      type: TYPES.some(([id]) => id === options.type) ? options.type : 'total',
      cols: options.cols,
    },
  };
}

function EstimateEditor({ opts, onClose }) {
  const [value, setValue] = useState(() => initialState(opts));
  const valueRef = useRef(value);
  const [buffer, setBuffer] = useState(null);
  const bufferRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const { adjustment, exportOptions } = value;
  const rates = estimateAdjustmentRates(adjustment);
  const uniform = rates.mats === rates.works && rates.works === rates.equipment;
  const mixed = adjustment.scope === 'all' && !uniform;
  const activePct = adjustment.scope === 'all' ? (uniform ? rates.mats : 0) : rates[adjustment.scope];
  const custom = !mixed && !PERCENTS.includes(activePct);
  const visibility = estimateAdjustmentVisibility(exportOptions);
  const activeGroups = adjustment.scope === 'all' ? ['mats', 'works', 'equipment'] : [adjustment.scope];
  const showEnabled = activeGroups.some(scope => rates[scope] !== 0);
  const showChecked = activeGroups.every(scope => visibility[scope]);
  const est = opts.est || {};
  const totals = calculateEstimateTotals(sum(est.mats), sum(est.works), adjustment, sum(est.equipment));
  const clearBuffer = () => { bufferRef.current = null; setBuffer(null); };

  const update = patch => {
    const next = { ...valueRef.current, ...patch };
    valueRef.current = next;
    setValue(next);
    setError('');
    try {
      const result = opts.onChange?.(next);
      if (result?.catch) result.catch(cause => setError(cause?.message || 'Не удалось сохранить параметры сметы'));
    } catch (cause) {
      setError(cause?.message || 'Не удалось сохранить параметры сметы');
    }
    return next;
  };

  const commitPercent = () => {
    if (bufferRef.current == null) return valueRef.current;
    const text = bufferRef.current.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const number = text === '' ? 0 : Number(text);
    if (!Number.isFinite(number) || number < -100 || number > 1000) {
      setError('Введите процент от −100 до 1000');
      return null;
    }
    clearBuffer();
    return update({ adjustment: updateEstimateAdjustment(valueRef.current.adjustment, { percent: number }) });
  };

  const selectScope = scope => {
    if (!commitPercent()) return;
    clearBuffer();
    update({ adjustment: updateEstimateAdjustment(valueRef.current.adjustment, { scope }) });
  };
  const selectPercent = percent => {
    clearBuffer();
    update({ adjustment: updateEstimateAdjustment(valueRef.current.adjustment, { percent }) });
  };
  const updateOptions = patch => update({ exportOptions: { ...valueRef.current.exportOptions, ...patch } });
  const currentDocument = next => ({
    project: opts.project, company: opts.company, est: opts.est, rooms: opts.rooms,
    adjustment: next.adjustment, type: next.exportOptions.type, cols: next.exportOptions.cols,
    showAdjustment: estimateAdjustmentVisibility(next.exportOptions),
  });
  const run = async (kind, callback) => {
    if (busy || !callback) return;
    const next = commitPercent();
    if (!next) return;
    setBusy(kind); setError('');
    try { await callback(currentDocument(next)); }
    catch (cause) { setError(cause?.message || 'Не удалось подготовить смету. Попробуйте ещё раз.'); }
    finally { setBusy(''); }
  };
  const requestClose = () => { if (commitPercent()) onClose(); };
  const showTitle = {
    all: 'Показывать наценку или скидку', mats: 'Показывать корректировку материалов',
    works: 'Показывать корректировку работ', equipment: 'Показывать корректировку оборудования',
  }[adjustment.scope];

  return <div className="z-mobile-estimate">
    <header className="z-me-header">
      <button className="z-me-back" type="button" aria-label="Закрыть редактор сметы" onClick={requestClose} disabled={!!busy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
      </button>
      <div className="z-me-heading"><h1>Смета</h1><p>{opts.project?.name || 'Проект'}</p></div>
    </header>
    <div className="z-me-scroll">
      <fieldset className="z-me-form" disabled={!!busy}>
        <section className="z-me-card">
          <h2>Тип сметы</h2>
          <div className="z-me-types" role="radiogroup" aria-label="Тип сметы">
            {TYPES.map(([id, label, sub]) => <button type="button" role="radio" aria-checked={exportOptions.type === id} className={'z-me-type' + (exportOptions.type === id ? ' is-active' : '')} key={id} onClick={() => updateOptions({ type: id })}>
              <span className="z-me-radio" aria-hidden="true" /><span><strong>{label}</strong><small>{sub}</small></span>
            </button>)}
          </div>

          <h2 className="z-me-spaced">Столбцы</h2>
          <div className="z-me-columns" role="group" aria-label="Столбцы сметы">
            {COLUMNS.map(([id, label]) => <button type="button" key={id} aria-pressed={exportOptions.cols[id]} className={'z-me-chip' + (exportOptions.cols[id] ? ' is-active' : '')} onClick={() => updateOptions({ cols: { ...valueRef.current.exportOptions.cols, [id]: !valueRef.current.exportOptions.cols[id] } })}>{label}</button>)}
          </div>

          <h2 className="z-me-spaced">Наценка или скидка</h2>
          <div className="z-me-scopes" role="group" aria-label="К чему применить процент">
            {SCOPES.map(([id, label]) => <button type="button" key={id} aria-pressed={adjustment.scope === id} aria-label={`${label} ${id === 'all' ? (uniform ? pct(rates.mats) : 'Разные') : pct(rates[id])}`} className={'z-me-scope' + (adjustment.scope === id ? ' is-active' : '')} onClick={() => selectScope(id)}><span>{label}</span><strong>{id === 'all' ? (uniform ? pct(rates.mats) : 'Разные') : pct(rates[id])}</strong></button>)}
          </div>
          <p className="z-me-hint">{adjustment.scope === 'all' ? (mixed ? 'Одинаковый % на все группы · или выберите группу' : 'Один процент на всю смету · сохраняется автоматически') : 'Свой процент для каждой группы · сохраняется автоматически'}</p>
          <div className="z-me-percents" role="group" aria-label="Готовые проценты">
            {PERCENTS.map(number => <button type="button" key={number} aria-pressed={!mixed && activePct === number && buffer == null} className={'z-me-pct' + (!mixed && activePct === number && buffer == null ? ' is-active' : '')} onClick={() => selectPercent(number)}>{pct(number)}</button>)}
          </div>
          <label className={'z-me-custom' + (custom ? ' is-custom' : '')}>
            <input aria-label="Процент наценки или скидки" inputMode="decimal" value={buffer ?? (custom ? String(activePct).replace('.', ',') : '')} placeholder="свой %" onChange={event => { bufferRef.current = event.target.value; setBuffer(event.target.value); setError(''); }} onBlur={commitPercent} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
            <span aria-hidden="true">%</span>
          </label>
          <button type="button" role="checkbox" aria-checked={showEnabled && showChecked} disabled={!showEnabled} className="z-me-show" onClick={() => update({ exportOptions: setEstimateAdjustmentVisibility(valueRef.current.exportOptions, adjustment.scope, !showChecked) })}>
            <span className={'z-me-check' + (showEnabled && showChecked ? ' is-checked' : '')} aria-hidden="true">{showEnabled && showChecked ? '✓' : ''}</span>
            <span><strong>{showTitle}</strong><small>{showChecked ? (adjustment.scope === 'all' ? 'Отдельные строки с процентами и суммами' : 'Отдельная строка с процентом и суммой') : 'Процент включён в цены позиций'}</small></span>
          </button>
          <section className="z-me-total" aria-label="Итог сметы" aria-live="polite">
            <h2>{totals.hasAdjustment ? 'С учётом корректировок' : 'Без корректировки'}</h2>
            {totals.adjustments.map(entry => <div className="z-me-delta" key={entry.scope}><span>{entry.scope === 'all' ? 'Вся смета' : SCOPES.find(([id]) => id === entry.scope)?.[1]} {pct(entry.percent)}</span><strong className={entry.amount < 0 ? 'is-negative' : 'is-positive'}>{delta(entry.amount)}</strong></div>)}
            {totals.hasAdjustment && <p>Без корректировки {money(totals.baseTotal)}</p>}
            <output>{money(totals.adjustedTotal)}</output>
          </section>
        </section>
        {error && <p className="z-me-error" role="alert">{error}</p>}
        <div className="z-me-actions">
          <button type="button" className="z-me-secondary" onClick={() => run('preview', opts.onPreview)} disabled={!opts.onPreview}>{busy === 'preview' ? 'Подготовка…' : 'Предпросмотр'}</button>
          <button type="button" className="z-me-primary" onClick={() => run('download', opts.onDownload)} disabled={!opts.onDownload}>{busy === 'download' ? 'Подготовка…' : 'Скачать PDF'}</button>
        </div>
      </fieldset>
    </div>
  </div>;
}

/** Native mobile export form adapted to the local phone prototype. */
export function openEditor(opts = {}) {
  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  host.className = 'z-mobile-estimate-host';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'Редактор сметы');
  document.body.appendChild(host);
  const unfit = fitToStage(host);
  const root = ReactDOM.createRoot(host);
  let active = true;
  const close = () => {
    if (!active) return;
    active = false;
    document.removeEventListener('keydown', onKey, true);
    root.unmount(); unfit(); host.remove();
    if (previousFocus?.isConnected) previousFocus.focus?.();
  };
  const requestClose = () => { close(); opts.onClose?.(); };
  const onKey = event => {
    if (!host.contains(document.activeElement)) return;
    if (event.key === 'Escape') {
      if (host.querySelector('fieldset:disabled')) return;
      event.preventDefault(); event.stopPropagation(); host.querySelector('.z-me-back')?.click();
    }
    if (event.key === 'Tab') {
      const controls = [...host.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  root.render(<EstimateEditor opts={opts} onClose={requestClose} />);
  requestAnimationFrame(() => { if (active) host.querySelector('button')?.focus(); });
  return { close };
}
