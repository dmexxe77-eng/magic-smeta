import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { DEFAULT_CONTRACT_TPL, CONTRACT_STYLES, contractFields, contractHtml, nextContractNumber } from '../data/contract.js';
import { htmlToPdf } from '../utils/pdf.js';
import { compressImg } from '../utils/imageUtils.js';
import { fitToStage } from './stage.js';

/* Договор для страницы дизайна.
   В проекте: условия (номер, дата монтажа, предоплата), заказчик, PDF / поделиться, предпросмотр — всё сохраняется само.
   В главном меню: шаблон договора (шапка исполнителя, оформление, разделы, подстановки), один на студию, localStorage.
   Токены — design-src/README.md, раздел 1. */
const D = { ink: '#1E2530', sub: '#6F7688', dim: '#A5A9B8', accent: '#4F46E5', soft: '#EEEDFC', bg: '#F3F3FA', card: '#fff', field: '#F7F7FC', line: '#ECECF4', border: '#E4E4EE', danger: '#FF3B30', dangerSoft: '#FFECEA' };
const TPL_KEY = 'zamer.contractTpl';
const loadTpl = () => { try { const t = JSON.parse(localStorage.getItem(TPL_KEY) || 'null'); return t ? { ...DEFAULT_CONTRACT_TPL, ...t, head: { ...DEFAULT_CONTRACT_TPL.head, ...(t.head || {}) } } : DEFAULT_CONTRACT_TPL; } catch { return DEFAULT_CONTRACT_TPL; } };
const saveTpl = t => { try { localStorage.setItem(TPL_KEY, JSON.stringify(t)); } catch { /* приватный режим */ } };
const fmt = n => (Number(n) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const PLACEHOLDERS = ['клиент', 'телефон', 'адрес', 'дата', 'номер', 'сумма', 'сумма_прописью', 'предоплата', 'остаток', 'площадь', 'срок_монтажа'];

const S = {
  card: { background: D.card, borderRadius: 18, padding: 14, marginBottom: 10 },
  sec: { fontSize: 11, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase', color: D.sub, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: 700, color: D.sub, margin: '10px 2px 6px' },
  input: { width: '100%', height: 44, background: D.field, border: '1.5px solid ' + D.border, borderRadius: 12, padding: '0 12px', color: D.ink, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  area: { width: '100%', background: D.field, border: '1.5px solid ' + D.border, borderRadius: 12, padding: '10px 12px', color: D.ink, fontSize: 14, fontWeight: 500, lineHeight: 1.45, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', resize: 'vertical' },
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
    <div ref={wrapRef} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', height: dims.h ? Math.ceil(dims.h * s) : 'auto', boxShadow: '0 1px 2px rgba(30,37,48,.06)' }}>
      <div ref={ref} style={{ width: PW, padding: 24, boxSizing: 'border-box', transform: `scale(${s})`, transformOrigin: 'top left' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Shell({ title, sub, onClose, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9000, background: D.bg, overflowY: 'auto', fontFamily: "'Manrope','Inter',system-ui,sans-serif", color: D.ink, WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: D.card, borderBottom: '1px solid ' + D.line, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: D.bg, border: 'none', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" stroke={D.ink} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: D.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 12px calc(40px + env(safe-area-inset-bottom))' }}>{children}</div>
    </div>
  );
}

/* ── Договор проекта ── */
function ProjectContract({ project, total, area, est, contract, installDate: ins0, onSaveContract, onProjectPatch, onClose }) {
  const tpl = loadTpl();
  const saved = contract || null;
  const [num, setNum] = useState(saved?.number || nextContractNumber(tpl));
  const [prepay, setPrepay] = useState(saved?.prepay ?? Math.round(total / 2));
  const [installDate, setInstallDate] = useState(saved?.installDate || ins0 || '');
  const [party, setParty] = useState({ client: project.client || '', phone: project.phone || '', address: project.address || '' });
  const [busy, setBusy] = useState('');
  const numTaken = useRef(!!saved);

  const fields = contractFields(party, total, { number: num, prepay, area: Math.round(area * 100) / 100, installDate });
  const html = contractHtml(tpl, fields, est);
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
    saveRef.current = setTimeout(() => { onSaveContract(snapshot()); if (!numTaken.current) { numTaken.current = true; saveTpl({ ...tpl, numSeq: (tpl.numSeq || 1) + 1 }); } }, 400);
    return () => clearTimeout(saveRef.current);
  }, [num, prepay, installDate, party.client, party.phone, party.address]);
  const closeAll = () => { clearTimeout(saveRef.current); pushParty(); onSaveContract(snapshot()); onClose(); };
  const pct = [['30 %', .3], ['50 %', .5], ['70 %', .7], ['100 %', 1]];

  return (
    <Shell title="Договор" sub={project.name} onClose={closeAll}>
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
      <div style={{ ...S.sec, margin: '4px 4px 8px' }}>Предпросмотр</div>
      <Paper html={html} />
    </Shell>
  );
}

/* ── Шаблон договора (главное меню) ── */
function TemplateEditor({ onClose }) {
  const [tpl, setTplState] = useState(loadTpl);
  const [resetArm, setResetArm] = useState(false);
  const focusArea = useRef(null);
  const logoRef = useRef(null), signRef = useRef(null);
  const setTpl = t => { setTplState(t); saveTpl(t); };
  const patch = p => setTpl({ ...tpl, ...p });
  const patchHead = p => patch({ head: { ...tpl.head, ...p } });
  const patchSec = (id, p) => patch({ sections: tpl.sections.map(s => s.id === id ? { ...s, ...p } : s) });
  const pickImg = (ref, key) => {
    const f = ref.current?.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async ev => { try { patchHead({ [key]: await compressImg(ev.target.result, 480, 0.85) }); } catch { patchHead({ [key]: ev.target.result }); } };
    r.readAsDataURL(f);
  };
  const insertPh = ph => {
    const fa = focusArea.current; if (!fa) return;
    const sec = tpl.sections.find(s => s.id === fa.id); if (!sec) return;
    const el = fa.el, a = el.selectionStart ?? sec.text.length, b = el.selectionEnd ?? a;
    patchSec(sec.id, { text: sec.text.slice(0, a) + '{' + ph + '}' + sec.text.slice(b) });
    setTimeout(() => { try { el.focus(); el.setSelectionRange(a + ph.length + 2, a + ph.length + 2); } catch { /* поле перерисовано */ } }, 0);
  };
  /* Пример с условными данными, чтобы видеть, как выглядит шаблон */
  const sample = contractHtml(tpl, contractFields({ client: 'Иванов Иван Иванович', phone: '+7 900 000-00-00', address: 'г. Хабаровск, ул. Примерная, 1, кв. 10' }, 100000, { number: nextContractNumber(tpl), prepay: 50000, area: 25.5, installDate: 'по согласованию' }), { mats: [], works: [] });

  return (
    <Shell title="Шаблон договора" sub="Один на студию · подставляется в каждый проект" onClose={onClose}>
      <div style={S.card}>
        <div style={S.sec}>Исполнитель</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => pickImg(logoRef, 'logo')} />
          <div onClick={() => logoRef.current?.click()} style={S.pick}>{tpl.head.logo ? <img src={tpl.head.logo} style={{ maxWidth: '100%', maxHeight: '100%' }} /> : 'логотип'}</div>
          <div style={{ fontSize: 12, color: D.sub, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>Логотип печатается в шапке договора. {tpl.head.logo && <span onClick={() => patchHead({ logo: null })} style={{ color: D.danger, cursor: 'pointer', fontWeight: 700 }}>Убрать</span>}</div>
        </div>
        {[['company', 'Название студии', 'Студия натяжных потолков «…»'], ['legal', 'Юр. лицо / ИП', 'ИП Иванов Иван Иванович'], ['inn', 'ИНН', ''], ['ogrn', 'ОГРНИП', ''], ['address', 'Адрес', 'г. Хабаровск, …'], ['phone', 'Телефон', '+7 …'], ['signerName', 'ФИО для подписи', 'Иванов И.И.']].map(([k, l, ph]) => (
          <div key={k}><div style={S.label}>{l}</div><input value={tpl.head[k] || ''} placeholder={ph} onChange={e => patchHead({ [k]: e.target.value })} style={S.input} /></div>))}
        <div style={S.label}>Банковские реквизиты</div>
        <textarea value={tpl.head.bank || ''} rows={3} placeholder={'Р/с … в банке …\nБИК …, к/с …'} onChange={e => patchHead({ bank: e.target.value })} style={S.area} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <input ref={signRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => pickImg(signRef, 'sign')} />
          <div onClick={() => signRef.current?.click()} style={S.pick}>{tpl.head.sign ? <img src={tpl.head.sign} style={{ maxWidth: '100%', maxHeight: '100%' }} /> : 'подпись / печать'}</div>
          <div style={{ fontSize: 12, color: D.sub, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>Ставится на строку подписи исполнителя. {tpl.head.sign && <span onClick={() => patchHead({ sign: null })} style={{ color: D.danger, cursor: 'pointer', fontWeight: 700 }}>Убрать</span>}</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sec}>Оформление</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CONTRACT_STYLES.map(st => <button key={st.id} onClick={() => patch({ style: st.id })} style={{ ...S.chip(tpl.style === st.id), flex: 1, padding: 0 }}>{st.label}</button>)}
        </div>
      </div>

      <div style={{ ...S.sec, margin: '4px 4px 8px' }}>Разделы договора</div>
      {(tpl.sections || []).map((sec, i) => (
        <div key={sec.id} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: D.accent, width: 18, flexShrink: 0 }}>{i + 1}.</span>
            <input value={sec.title} onChange={e => patchSec(sec.id, { title: e.target.value })} style={{ ...S.input, height: 38, fontWeight: 700, minWidth: 0 }} />
            <button onClick={() => { if (i > 0) { const ss = [...tpl.sections]; [ss[i - 1], ss[i]] = [ss[i], ss[i - 1]]; patch({ sections: ss }); } }} style={S.icon} title="Выше">↑</button>
            <button onClick={() => patch({ sections: tpl.sections.filter(s => s.id !== sec.id) })} style={{ ...S.icon, background: D.dangerSoft, color: D.danger }} title="Удалить">✕</button>
          </div>
          <textarea value={sec.text} rows={4} onFocus={e => { focusArea.current = { id: sec.id, el: e.target }; }} onChange={e => patchSec(sec.id, { text: e.target.value })} style={S.area} />
        </div>))}
      <button onClick={() => patch({ sections: [...tpl.sections, { id: 's' + Date.now(), title: 'Новый раздел', text: '' }] })} style={{ width: '100%', height: 42, background: 'transparent', border: '1.5px dashed #C9C6F5', borderRadius: 12, color: D.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>+ Добавить раздел</button>

      <div style={S.card}>
        <div style={S.sec}>Подстановки</div>
        <div style={{ fontSize: 12, color: D.sub, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>Поставьте курсор в текст раздела и нажмите нужную подстановку. В договоре она заменится данными проекта.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{PLACEHOLDERS.map(ph => <button key={ph} onMouseDown={e => e.preventDefault()} onClick={() => insertPh(ph)} style={S.mini(false)}>{'{' + ph + '}'}</button>)}</div>
      </div>

      <div style={{ ...S.sec, margin: '4px 4px 8px' }}>Пример с условными данными</div>
      <Paper html={sample} />
      <button onClick={() => { if (!resetArm) { setResetArm(true); setTimeout(() => setResetArm(false), 3000); return; } setResetArm(false); setTpl({ ...DEFAULT_CONTRACT_TPL, numSeq: tpl.numSeq }); }} style={{ width: '100%', height: 42, marginTop: 10, background: 'transparent', border: 'none', color: resetArm ? D.danger : D.sub, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{resetArm ? 'Точно сбросить шаблон? Нажмите ещё раз' : 'Сбросить шаблон к типовому'}</button>
    </Shell>
  );
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
export function openTemplate(opts = {}) { return mount(<TemplateEditor />, opts.onClose); }
