/* Выгрузка данных основной версии в модель версии /design (её же использует онлайн-версия):
   база номенклатур с учётом пользовательского снимка, все пресеты кнопок и все проекты.
   Результат: design-src/main-data.json.
   Запуск: node scripts/export-main-data.mjs [путь к резервной копии magicapp_backup_*.json]
   Без пути берётся снимок, зашитый в код основной версии (src/data/presets.js). */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const OUT = path.resolve('design-src/main-data.json');
const bundle = path.join(os.tmpdir(), 'magic-main-data-' + process.pid + '.cjs');

await build({ entryPoints: ['scripts/main-data-entry.js'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle, loader: { '.js': 'jsx', '.jsx': 'jsx', '.json': 'json' }, logLevel: 'error' });

/* модули основной версии местами трогают window — в Node хватает заглушек */
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {}, localStorage: storage };
globalThis.localStorage = storage;
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
globalThis.Event = globalThis.CustomEvent;
globalThis.document = { createElement: () => ({}) };

const M = createRequire(import.meta.url)(bundle);
fs.rmSync(bundle, { force: true });

/* ── источник: резервная копия из приложения или снимок из кода ── */
const backupPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const backup = backupPath ? JSON.parse(fs.readFileSync(backupPath, 'utf8')) : null;
if (backup && !(Array.isArray(backup.presets) && Array.isArray(backup.orders))) throw new Error('Резервная копия не похожа на файл ZAMER.PRO: нет presets/orders — ' + backupPath);
const SOURCE = backup
  ? { snapshot: { customNoms: backup.customNoms || [], editedNoms: backup.editedNoms || [], deletedNomIds: backup.deletedNomIds || [], customBrands: backup.customBrands || [] },
      presets: backup.presets, favs: backup.sharedFavs || {}, orders: backup.orders, globalOpts: backup.globalOpts || [], customBlocks: backup.customBlocks || [] }
  : { snapshot: M.INITIAL_NOM_SNAPSHOT, presets: M.USER_PRESETS_OVERRIDE || [], favs: M.USER_FAVS_OVERRIDE || {}, orders: M.INITIAL_ORDERS || [], globalOpts: [], customBlocks: [] };
M.applyNomsSnapshot(SOURCE.snapshot);

const round2 = v => Math.round(v * 100) / 100;
const unitOf = u => { const s = String(u || 'шт').trim().toLowerCase().replace(/\s/g, ''); if (s.includes('м²') || s.includes('м2')) return 'м²'; if (/^(м\.?п\.?|м\/п\.?|п\.?м\.?|пог\.?м\.?)$/.test(s) || s === 'м') return 'м.п.'; if (s.startsWith('компл')) return 'компл'; return 'шт'; };
const SRC = { corn_in: 'inner', corn_out: 'outer', corn_all: 'angles', area: 'area', perim: 'perim', manual: 'manual' };
const legacySrc = id => (id === 'o_inner_angle' ? 'corn_in' : id === 'o_outer_angle' ? 'corn_out' : id === 'o_angle' ? 'corn_all' : 'manual');
const imgExt = key => { const m = /^data:image\/(\w+);/.exec(M.NOM_V2_IMAGES[key] || ''); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : null; };

/* ── база номенклатур: действующие позиции + архивные, которые используются в кнопках и проектах.
   Архивные попадают в отдельную папку «Архив»: кнопки основной версии построены на них, без них
   кнопки пустеют, а суммы проектов расходятся. Если у архивной позиции есть действующий двойник
   (то же название, цена и единица) — берём действующую, дубль не заводим. ── */
const ARCHIVE_BRAND = 'Архив', ARCHIVE_COLOR = '#8E8E93';
const active = M.activeNoms();
const activeById = new Map(active.map(n => [n.id, n]));
const normName = s => String(s || '').toLowerCase().replace(/[\s.]+/g, ' ').trim();
const activeByName = new Map();
active.forEach(n => { const k = normName(n.name); if (k && !activeByName.has(k)) activeByName.set(k, n); });
const missing = [];
const archiveUsed = new Map();
const replacedByName = new Set();
const twinOf = old => { const t = activeByName.get(normName(old.name)); return t && Math.abs((Number(t.price) || 0) - (Number(old.price) || 0)) < 0.005 && unitOf(t.unit) === unitOf(old.unit) ? t : null; };
/* позиция по id без побочных записей: действующая, её двойник или архивная */
const lookup = id => { const a = activeById.get(id); if (a) return a; const old = M.NB(id); return old ? (twinOf(old) || old) : null; };
const nomOut = n => {
  const archived = archiveUsed.has(n.id);
  const o = { id: n.id, n: String(n.name || '').trim(), p: Number(n.price) || 0, u: unitOf(n.unit), m: n.type === 'work' ? 0 : 1, br: archived ? ARCHIVE_BRAND : (n.brandName || 'Другое') };
  if (archived) o.bc = ARCHIVE_COLOR; else if (n.brandColor) o.bc = n.brandColor;
  if (n.type === 'canvas') o.cv = 1;
  if (n.img && imgExt(n.img)) o.img = n.img + '.' + imgExt(n.img);
  if (n.mult > 0) o.mult = n.mult;
  if (n.note) o.note = n.note;
  if (n.cost > 0) o.cost = n.cost;
  if (Array.isArray(n.ws) && n.ws.length) o.ws = n.ws;
  return o;
};
const resolve = (id, where) => {
  const direct = activeById.get(id);
  if (direct) return direct;
  const old = M.NB(id);
  if (!old) { missing.push(where + ' → ' + id); return null; }
  const twin = twinOf(old);
  if (twin) { replacedByName.add(old.id); return twin; }
  archiveUsed.set(old.id, old);
  return old;
};

/* ── пресеты кнопок ── */
const BLOCK_OF = { canvas: 'canvas', main: 'main', extra: 'extra', light: 'light', track: 'track', curtain: 'curtain', other: 'other' };
/* свои блоки редактора кнопок («Разное») в модели /design — один блок other */
SOURCE.customBlocks.forEach(b => { BLOCK_OF[b.id] = 'other'; });
const otherTitle = (SOURCE.customBlocks[0] && String(SOURCE.customBlocks[0].label || '').trim()) || 'Прочее';
const favs = SOURCE.favs;
const BLOCK_UNIT = { canvas: 'м²', main: 'м.п.', extra: 'м.п.', light: 'шт', track: 'м.п.', curtain: 'м.п.', other: 'шт' };
const presetById = new Map();
const presets = { canvas: [], main: [], extra: [], light: [], track: [], curtain: [], other: [] };
SOURCE.presets.forEach(pr => {
  const bid = BLOCK_OF[pr.cat];
  if (!bid) return;
  const where = 'кнопка «' + pr.name + '»';
  const items = [];
  (pr.items || []).forEach(id => {
    const n = resolve(id, where); if (!n) return;
    const it = { n: String(n.name).trim(), p: Number(n.price) || 0, u: unitOf(n.unit), m: n.type === 'work' ? 0 : 1, nid: n.id };
    const k = pr.ko && pr.ko[id]; if (k != null && k !== '' && Number(k) && Number(k) !== 1) it.k = Number(k);
    if (pr.mu && pr.mu[id] && n.mult > 0) it.mult = n.mult;
    items.push(it);
  });
  (pr.options || []).forEach(id => {
    const n = resolve(id, where); if (!n) return;
    const src = SRC[(pr.src && pr.src[id]) || legacySrc(id)] || 'manual';
    items.push({ n: String(n.name).trim(), p: Number(n.price) || 0, u: unitOf(n.unit), m: n.type === 'work' ? 0 : 1, nid: n.id, src });
  });
  const out = { id: pr.id, name: pr.name, items };
  /* параметр кнопки — откуда берётся её количество; пишем только отличия от умолчаний блока */
  const param = pr.param && pr.param.src, defParam = bid === 'canvas' ? 'area' : bid === 'main' ? 'perim' : 'manual';
  if (['area', 'perim', 'manual'].includes(param) && param !== defParam) out.param = param;
  const punit = param === 'manual' && pr.param.unit ? unitOf(pr.param.unit) : null;
  if (punit && punit !== BLOCK_UNIT[bid]) out.punit = punit;
  if (Array.isArray(favs[pr.cat]) && favs[pr.cat].includes(pr.id)) out.fav = 1;
  if (pr.sec) out.sec = pr.sec;
  presets[bid].push(out);
  presetById.set(pr.id, { src: pr, out, bid });
});
Object.values(presets).forEach(list => list.sort((a, b) => (b.fav || 0) - (a.fav || 0)));

/* ── доп. опции расчёта: в основной версии список общий, галочки — в заказе (optsOn); в модели /design это опции помещения ── */
const roomOpts = [];
SOURCE.globalOpts.forEach(go => {
  const n = go.nomId ? resolve(go.nomId, 'опция «' + go.name + '»') : null; if (!n) return;
  roomOpts.push({ id: go.id, title: String(go.name || n.name).trim().replace(/[\s.]+$/, ''), n: String(n.name).trim(), p: Number(n.price) || 0, u: unitOf(n.unit), m: n.type === 'work' ? 0 : 1, src: go.param === 'area' ? 'area' : 'perim', nid: n.id });
});

/* ── проекты ── */
const STATUS = { new: 'order', order: 'order', estimate: 'estimate', discuss: 'review', contract: 'contract', install: 'install', done: 'done', declined: 'declined' };
const PAY_CAT = { prepay: 'Предоплата', final: 'Окончательный расчёт', extra: 'Доплата', other: 'Оплата' };
const ruDate = d => { const s = String(d || ''); const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (iso) return iso[3] + '.' + iso[2] + '.' + iso[1]; return /^\d{2}\.\d{2}\.\d{4}$/.test(s) ? s : ''; };
const shortDate = d => ruDate(d).slice(0, 5);
const polyArea = v => { let a = 0; for (let i = 0; i < v.length; i++) { const j = (i + 1) % v.length; a += v[i][0] * v[j][1] - v[j][0] * v[i][1]; } return Math.abs(a) / 2; };
const polyPerim = v => v.reduce((s, p, i) => { const q = v[(i + 1) % v.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);

function convertInstance(inst, where) {
  const meta = presetById.get(inst.btnId);
  const out = { id: inst.id, pid: meta ? inst.btnId : null, off: {}, iq: {} };
  out.qty = round2(Number(inst.qty) || 0);
  if (inst.subP) out.subP = true;
  if (inst.applyAll) out.applyAll = true;
  if (!meta) { if (inst.btnId) missing.push(where + ' → кнопка ' + inst.btnId); return out; }
  const nameOf = id => { const n = lookup(id); return n ? String(n.name).trim() : null; };
  Object.entries(inst.off || {}).forEach(([id, v]) => { const nm = nameOf(id); if (v === true && nm) out.off[nm] = true; });
  Object.entries(inst.iq || {}).forEach(([id, v]) => { const nm = nameOf(id); if (v != null && nm) out.iq[nm] = Number(v); });
  /* опции: в основной версии количество хранится в oq; авто-источники (углы, S, P) считаются и так — переносим только ручные и отличающиеся */
  (meta.src.options || []).forEach(id => {
    const nm = nameOf(id); if (!nm) return;
    const src = SRC[(meta.src.src && meta.src.src[id]) || legacySrc(id)] || 'manual';
    const q = inst.oq && inst.oq[id];
    if (src === 'manual') { if (q > 0) out.iq[nm] = Number(q); }
    else out._oq = { ...(out._oq || {}), [nm]: { q: Number(q) || 0, src } };
  });
  return out;
}

function convertRoom(r, where, optsOn) {
  const v = (r.v || []).map(p => [round2(p[0]), round2(p[1])]);
  const a = round2(polyArea(v)), p = round2(polyPerim(v));
  const canvas = convertInstance(r.canvas || {}, where), main = convertInstance(r.mainProf || {}, where);
  delete canvas.qty; delete main.qty;
  if (r.aO != null && Math.abs(r.aO - a) > 0.005) canvas.qtyO = round2(r.aO);
  if (r.pO != null && Math.abs(r.pO - p) > 0.005) main.qtyO = round2(r.pO);
  /* перерасход полотна: в основной версии материал считается по площади отреза */
  if (r.canvas && r.canvas.overcut && r.canvas.overcutArea > 0) {
    const meta = presetById.get(r.canvas.btnId);
    (meta ? meta.src.items : []).forEach(id => { const n = lookup(id); if (n && n.type === 'canvas') canvas.iq[String(n.name).trim()] = round2(r.canvas.overcutArea); });
  }
  const room = { id: r.id, name: r.name, v, on: r.on !== false, canvas, main, extra: [], light: [], track: [], curtain: [], other: [], extraItems: [], opts: { ...optsOn }, optQ: {} };
  [['extras', 'extra'], ['lights', 'light'], ['tracks', 'track'], ['curtains', 'curtain']].forEach(([from, to]) => (r[from] || []).forEach(i => room[to].push(convertInstance(i, where))));
  /* ручной периметр: в основной версии вычеты доп. профилей и штор действуют и на него, а в модели /design qtyO — уже итог */
  if (main.qtyO != null) { const sub = [...room.extra, ...room.curtain].filter(i => i.subP).reduce((s, i) => s + (i.qty || 0), 0); if (sub > 0) main.qtyO = Math.max(0, round2(main.qtyO - sub)); }
  Object.values(r.cst || {}).forEach(list => (list || []).forEach(i => room.other.push(convertInstance(i, where))));
  (r.extraItems || []).forEach(x => { const n = resolve(x.nomId, where + ' · доп. позиция'); if (!n || !(x.qty > 0)) return; const it = { id: x.id, n: String(n.name).trim(), p: Number(n.price) || 0, u: unitOf(n.unit), m: n.type === 'work' ? 0 : 1, qty: Number(x.qty), nid: n.id }; if (n.img && imgExt(n.img)) it.img = n.img + '.' + imgExt(n.img); room.extraItems.push(it); });
  /* доп. полотна: отдельного блока в модели нет — переносим строками */
  (r.extraCanvas || []).forEach(ec => { const meta = presetById.get(ec.btnId); if (!meta || !(ec.qty > 0)) return; meta.out.items.forEach(it => { if (it.src) return; room.extraItems.push({ id: ec.id + '_' + room.extraItems.length, n: it.n + ' (доп. полотно)', p: it.p, u: it.u, m: it.m, qty: round2(ec.qty), nid: it.nid }); }); });
  if (r.imgPts) room.imgPts = r.imgPts;
  if (r.draw) room.draw = r.draw;
  return room;
}

const projects = SOURCE.orders.map(o => {
  const where = 'проект «' + o.name + '»';
  const ops = [];
  (o.payments || []).forEach(p => ops.push({ id: p.id, kind: 'in', sum: Number(p.amount) || 0, note: p.note || PAY_CAT[p.cat] || 'Оплата', date: shortDate(p.date), iso: p.date }));
  (o.expenses || []).forEach(x => ops.push({ id: x.id, kind: 'out', sum: Number(x.amount) || 0, note: x.note || 'Расход', date: shortDate(x.date), iso: x.date }));
  ops.sort((a, b) => String(a.iso || '').localeCompare(String(b.iso || '')));
  ops.forEach(x => delete x.iso);
  const optsOn = {};
  roomOpts.forEach(ro => { if (o.optsOn && o.optsOn[ro.id]) optsOn[ro.id] = true; });
  return {
    id: o.id, name: o.name || 'Без названия', client: o.client || '', phone: o.phone || '', address: o.address || '', designer: o.designer || '', notes: o.notes || '',
    status: STATUS[o.status] || 'order', date: ruDate(o.date), paid: ops.filter(x => x.kind === 'in').reduce((s, x) => s + x.sum, 0), ops, events: [], contract: o.contract || null,
    rooms: (o.rooms || []).map(r => convertRoom(r, where, optsOn)), _snap: o.nomSnapshot || null, _src: o,
  };
});

/* ── сверка: сумма проекта в основной версии против суммы в модели /design ── */
const geomOf = v => { const n = v.length; const mm = v.map(q => [q[0] * 1000, q[1] * 1000]); let s = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; s += mm[i][0] * mm[j][1] - mm[j][0] * mm[i][1]; }
  const ccw = s > 0; const an = mm.map((_, i) => { const A = mm[(i - 1 + n) % n], B = mm[i], C = mm[(i + 1) % n]; let ang = Math.atan2(C[1] - B[1], C[0] - B[0]) - Math.atan2(A[1] - B[1], A[0] - B[0]); if (ang < 0) ang += 2 * Math.PI; let d = ang * 180 / Math.PI; if (ccw) d = 360 - d; if (Math.abs(d - 90) < 15) d = 90; if (Math.abs(d - 270) < 15) d = 270; return Math.round(d); });
  return { a: round2(polyArea(v)), p: round2(polyPerim(v)), inn: an.filter(d => d === 90).length, out: an.filter(d => d === 270).length }; };
const srcQty = (it, qty, g) => (it.src === 'inner' ? g.inn : it.src === 'outer' ? g.out : it.src === 'angles' ? g.inn + g.out : it.src === 'area' ? g.a : it.src === 'perim' ? g.p : it.src === 'manual' ? 0 : qty);
function linesOf(bid, inst, qty, g) {
  const pr = (presets[bid] || []).find(x => x.id === inst.pid); if (!pr) return [];
  return pr.items.filter(it => !(inst.off && inst.off[it.n])).map(it => {
    const ov = inst.iq && inst.iq[it.n] != null ? inst.iq[it.n] : null; let q = ov != null ? ov : srcQty(it, qty, g);
    if (ov == null) { const k = it.k || 1; if (k !== 1) { q *= k; if (it.u === 'шт') q = Math.ceil(q - 1e-9); q = Math.round(q * 1000) / 1000; } if (it.mult > 0 && q > 0) q = Math.round(Math.ceil(q / it.mult - 1e-9) * it.mult * 1000) / 1000; }
    return { ...it, q };
  });
}
function designLines(project) {
  const lines = new Map();
  const add = (key, it, q, p) => { if (q <= 0) return; const l = lines.get(key) || { key, nid: it.nid, q: 0, p }; l.q = round2(l.q + q); lines.set(key, l); };
  project.rooms.filter(r => r.on).forEach(r => {
    const g = geomOf(r.v), sub = ['extra', 'curtain'].reduce((s, b) => s + r[b].filter(i => i.subP).reduce((a, i) => a + (i.qty || 0), 0), 0);
    const run = (bid, inst, qty) => linesOf(bid, inst, qty, g).forEach(it => add(it.m && bid === 'canvas' ? it.n + '|' + r.id : it.n, it, it.q, it.p));
    run('canvas', r.canvas, r.canvas.qtyO != null ? r.canvas.qtyO : g.a);
    run('main', r.main, r.main.qtyO != null ? r.main.qtyO : Math.max(0, round2(g.p - sub)));
    ['extra', 'light', 'track', 'curtain', 'other'].forEach(bid => r[bid].forEach(i => run(bid, i, i.qty || 0)));
    r.extraItems.forEach(x => add(x.n, x, x.qty, x.p));
    roomOpts.forEach(ro => { if (r.opts[ro.id]) add(ro.n, ro, ro.src === 'area' ? g.a : g.p, ro.p); });
  });
  return lines;
}

/* авто-опции (углы): если в основной версии количество поправлено руками — переносим как правку количества */
projects.forEach(pr => pr.rooms.forEach(r => {
  const g = geomOf(r.v);
  [r.canvas, r.main, ...r.extra, ...r.light, ...r.track, ...r.curtain, ...r.other].forEach(inst => {
    Object.entries(inst._oq || {}).forEach(([name, { q, src }]) => { const auto = srcQty({ src }, 0, g); if (Math.abs(q - auto) > 0.005) inst.iq[name] = q; });
    delete inst._oq;
  });
}));

const estEd = {};
const report = [];
projects.forEach(pr => {
  const lines = designLines(pr);
  /* цены из снимка проекта: если отличаются от текущих — фиксируем правкой цены строки, как это делает экран сметы */
  const ed = {};
  if (pr._snap) lines.forEach(l => { const sp = pr._snap[l.nid]; if (sp != null && Math.abs(sp - l.p) > 0.004) { ed[l.key] = { p: sp }; l.p = sp; } });
  const gOpts = SOURCE.globalOpts.map(g => ({ ...g, on: !!(pr._src.optsOn && pr._src.optsOn[g.id]) }));
  const e = pr._src.rooms && pr._src.rooms.length ? M.buildEst(pr._src.rooms, SOURCE.presets, gOpts, pr._src.nomSnapshot || null) : { mats: [], works: [] };
  /* опции расчёта основная версия считает от ручных S/P помещения, приложение — от чертежа: разницу фиксируем правкой количества строки */
  roomOpts.forEach(ro => {
    const l = lines.get(ro.n); if (!l) return;
    const mainQ = round2([...e.mats, ...e.works].filter(x => String(x.n).trim() === ro.n).reduce((a, x) => a + x.q, 0));
    if (mainQ > 0 && Math.abs(mainQ - l.q) > 0.005) { ed[l.key] = { ...(ed[l.key] || {}), q: mainQ }; l.q = mainQ; }
  });
  if (Object.keys(ed).length) estEd[pr.id] = ed;
  const designTotal = [...lines.values()].reduce((s, l) => s + l.q * l.p, 0);
  const mainTotal = [...e.mats, ...e.works].reduce((s, l) => s + l.q * l.p, 0);
  report.push({ name: pr.name, rooms: pr.rooms.length, main: Math.round(mainTotal), design: Math.round(designTotal), diff: Math.round(designTotal - mainTotal) });
  if (process.env.DEBUG_DIFF && Math.abs(designTotal - mainTotal) > 0.5) {
    const mainMap = new Map(); [...e.mats, ...e.works].forEach(l => { const k = String(l.n).trim(); const o = mainMap.get(k) || { q: 0, t: 0 }; o.q = round2(o.q + l.q); o.t += l.q * l.p; mainMap.set(k, o); });
    const desMap = new Map(); [...lines.values()].forEach(l => { const k = l.key.includes('|') ? l.key.split('|')[0] + ' (' + (pr.rooms.find(r => r.id === l.key.split('|')[1]) || {}).name + ')' : l.key; const o = desMap.get(k) || { q: 0, t: 0 }; o.q = round2(o.q + l.q); o.t += l.q * l.p; desMap.set(k, o); });
    console.log('\n### ' + pr.name);
    new Set([...mainMap.keys(), ...desMap.keys()]).forEach(k => { const m = mainMap.get(k) || { q: 0, t: 0 }, d = desMap.get(k) || { q: 0, t: 0 }; if (Math.abs(m.t - d.t) > 0.5) console.log('   main q=' + m.q + ' t=' + Math.round(m.t) + ' | design q=' + d.q + ' t=' + Math.round(d.t) + ' | ' + k); });
  }
  delete pr._snap; delete pr._src;
});

/* позиции без nid приложению не нужны */
const strip = it => { const { nid, ...rest } = it; return rest; };
Object.values(presets).forEach(list => list.forEach(pr => { pr.items = pr.items.map(strip); }));
projects.forEach(pr => pr.rooms.forEach(r => { r.extraItems = r.extraItems.map(strip); }));

const nom = [...active, ...archiveUsed.values()].map(nomOut).filter(n => n.n);
const data = { generatedAt: new Date().toISOString(), source: backup ? 'backup ' + (backup._exportedAt || '') : 'code snapshot', nom, presets, projects, estEd, roomOpts: roomOpts.map(strip), otherTitle,
  report: { projects: report, emptyPresets: Object.values(presets).flat().filter(p => !p.items.length).map(p => p.name), archived: [...archiveUsed.values()].map(n => String(n.name).trim()), missing: [...new Set(missing)] } };
fs.writeFileSync(OUT, JSON.stringify(data));

console.log('номенклатур', nom.length, '| с фото', nom.filter(n => n.img).length);
console.log('кнопок', Object.entries(presets).map(([k, v]) => k + ':' + v.length + '/' + v.filter(p => p.fav).length + '★').join(' '), '| пустых', Object.values(presets).flat().filter(p => !p.items.length).map(p => p.name).join(', ') || 'нет');
console.log('источник:', data.source, '| опций расчёта', roomOpts.length, '| блок other —', otherTitle);
console.log('позиции кнопок и проектов: действующий двойник вместо архивной', replacedByName.size, '| архивных в папке «' + ARCHIVE_BRAND + '»', archiveUsed.size, '| не найдено ссылок', new Set(missing).size);
console.log('проекты:'); report.forEach(r => console.log('  ' + String(r.main).padStart(9) + ' → ' + String(r.design).padStart(9) + (r.diff ? '  Δ ' + r.diff : '  ✓') + '  ' + r.rooms + ' пом.  ' + r.name));
console.log('файл', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'КБ');
