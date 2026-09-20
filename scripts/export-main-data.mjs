/* Выгрузка данных основной версии в модель версии /design (её же использует онлайн-версия):
   база номенклатур с учётом пользовательского снимка, все пресеты кнопок и все проекты.
   Результат: design-src/main-data.json. Запуск: node scripts/export-main-data.mjs */
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
M.applyNomsSnapshot(M.INITIAL_NOM_SNAPSHOT);

const round2 = v => Math.round(v * 100) / 100;
const unitOf = u => { const s = String(u || 'шт').trim().toLowerCase().replace(/\s/g, ''); if (s.includes('м²') || s.includes('м2')) return 'м²'; if (/^(м\.?п\.?|м\/п\.?|п\.?м\.?|пог\.?м\.?)$/.test(s) || s === 'м') return 'м.п.'; if (s.startsWith('компл')) return 'компл'; return 'шт'; };
const SRC = { corn_in: 'inner', corn_out: 'outer', corn_all: 'angles', area: 'area', perim: 'perim', manual: 'manual' };
const legacySrc = id => (id === 'o_inner_angle' ? 'corn_in' : id === 'o_outer_angle' ? 'corn_out' : id === 'o_angle' ? 'corn_all' : 'manual');
const imgExt = key => { const m = /^data:image\/(\w+);/.exec(M.NOM_V2_IMAGES[key] || ''); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : null; };

/* ── база номенклатур: только действующие позиции. Архив старой базы не переносим:
   в кнопках и проектах остаются лишь позиции, которые есть в действующей базе
   (архивная позиция заменяется действующей с тем же названием, иначе пропускается) ── */
const active = M.activeNoms();
const activeById = new Map(active.map(n => [n.id, n]));
const normName = s => String(s || '').toLowerCase().replace(/[\s.]+/g, ' ').trim();
const activeByName = new Map();
active.forEach(n => { const k = normName(n.name); if (k && !activeByName.has(k)) activeByName.set(k, n); });
const missing = [];
const skippedArchived = [];
let replacedByName = 0;
const lookup = id => { const a = activeById.get(id); if (a) return a; const n = M.NB(id); return n ? (activeByName.get(normName(n.name)) || null) : null; };
const nomOut = n => {
  const o = { id: n.id, n: String(n.name || '').trim(), p: Number(n.price) || 0, u: unitOf(n.unit), m: n.type === 'work' ? 0 : 1, br: n.brandName || 'Другое' };
  if (n.brandColor) o.bc = n.brandColor;
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
  const same = activeByName.get(normName(old.name));
  if (same) { replacedByName++; return same; }
  skippedArchived.push(where + ' → ' + old.name);
  return null;
};

/* ── пресеты кнопок ── */
const BLOCK_OF = { canvas: 'canvas', main: 'main', extra: 'extra', light: 'light', track: 'track', curtain: 'curtain', other: 'other' };
const favs = M.USER_FAVS_OVERRIDE || {};
const presetById = new Map();
const presets = { canvas: [], main: [], extra: [], light: [], track: [], curtain: [], other: [] };
(M.USER_PRESETS_OVERRIDE || []).forEach(pr => {
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
  if (Array.isArray(favs[pr.cat]) && favs[pr.cat].includes(pr.id)) out.fav = 1;
  if (pr.sec) out.sec = pr.sec;
  presets[bid].push(out);
  presetById.set(pr.id, { src: pr, out, bid });
});
Object.values(presets).forEach(list => list.sort((a, b) => (b.fav || 0) - (a.fav || 0)));

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
  if (inst.qty != null) out.qty = round2(Number(inst.qty) || 0);
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
    else if (q != null) out._oq = { ...(out._oq || {}), [nm]: { q: Number(q), src } };
  });
  return out;
}

function convertRoom(r, where) {
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
  const room = { id: r.id, name: r.name, v, on: r.on !== false, canvas, main, extra: [], light: [], track: [], curtain: [], other: [], extraItems: [], opts: {}, optQ: {} };
  [['extras', 'extra'], ['lights', 'light'], ['tracks', 'track'], ['curtains', 'curtain']].forEach(([from, to]) => (r[from] || []).forEach(i => room[to].push(convertInstance(i, where))));
  Object.values(r.cst || {}).forEach(list => (list || []).forEach(i => room.other.push(convertInstance(i, where))));
  (r.extraItems || []).forEach(x => { const n = resolve(x.nomId, where + ' · доп. позиция'); if (!n || !(x.qty > 0)) return; const it = { id: x.id, n: String(n.name).trim(), p: Number(n.price) || 0, u: unitOf(n.unit), m: n.type === 'work' ? 0 : 1, qty: Number(x.qty), nid: n.id }; if (n.img && imgExt(n.img)) it.img = n.img + '.' + imgExt(n.img); room.extraItems.push(it); });
  /* доп. полотна: отдельного блока в модели нет — переносим строками */
  (r.extraCanvas || []).forEach(ec => { const meta = presetById.get(ec.btnId); if (!meta || !(ec.qty > 0)) return; meta.out.items.forEach(it => { if (it.src) return; room.extraItems.push({ id: ec.id + '_' + room.extraItems.length, n: it.n + ' (доп. полотно)', p: it.p, u: it.u, m: it.m, qty: round2(ec.qty), nid: it.nid }); }); });
  if (r.imgPts) room.imgPts = r.imgPts;
  if (r.draw) room.draw = r.draw;
  return room;
}

const projects = (M.INITIAL_ORDERS || []).map(o => {
  const where = 'проект «' + o.name + '»';
  const ops = [];
  (o.payments || []).forEach(p => ops.push({ id: p.id, kind: 'in', sum: Number(p.amount) || 0, note: p.note || PAY_CAT[p.cat] || 'Оплата', date: shortDate(p.date), iso: p.date }));
  (o.expenses || []).forEach(x => ops.push({ id: x.id, kind: 'out', sum: Number(x.amount) || 0, note: x.note || 'Расход', date: shortDate(x.date), iso: x.date }));
  ops.sort((a, b) => String(a.iso || '').localeCompare(String(b.iso || '')));
  ops.forEach(x => delete x.iso);
  return {
    id: o.id, name: o.name || 'Без названия', client: o.client || '', phone: o.phone || '', address: o.address || '', designer: o.designer || '', notes: o.notes || '',
    status: STATUS[o.status] || 'order', date: ruDate(o.date), paid: ops.filter(x => x.kind === 'in').reduce((s, x) => s + x.sum, 0), ops, events: [], contract: o.contract || null,
    rooms: (o.rooms || []).map(r => convertRoom(r, where)), _snap: o.nomSnapshot || null, _src: o,
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
  if (Object.keys(ed).length) estEd[pr.id] = ed;
  const designTotal = [...lines.values()].reduce((s, l) => s + l.q * l.p, 0);
  const e = pr._src.rooms && pr._src.rooms.length ? M.buildEst(pr._src.rooms, M.USER_PRESETS_OVERRIDE, [], pr._src.nomSnapshot || null) : { mats: [], works: [] };
  const mainTotal = [...e.mats, ...e.works].reduce((s, l) => s + l.q * l.p, 0);
  report.push({ name: pr.name, rooms: pr.rooms.length, main: Math.round(mainTotal), design: Math.round(designTotal), diff: Math.round(designTotal - mainTotal) });
  delete pr._snap; delete pr._src;
});

/* позиции без nid приложению не нужны */
const strip = it => { const { nid, ...rest } = it; return rest; };
Object.values(presets).forEach(list => list.forEach(pr => { pr.items = pr.items.map(strip); }));
projects.forEach(pr => pr.rooms.forEach(r => { r.extraItems = r.extraItems.map(strip); }));

const nom = active.map(nomOut).filter(n => n.n);
const data = { generatedAt: new Date().toISOString(), nom, presets, projects, estEd, report: { projects: report, emptyPresets: Object.values(presets).flat().filter(p => !p.items.length).map(p => p.name), skippedArchived: [...new Set(skippedArchived)], missing: [...new Set(missing)] } };
fs.writeFileSync(OUT, JSON.stringify(data));

console.log('номенклатур', nom.length, '| с фото', nom.filter(n => n.img).length);
console.log('кнопок', Object.entries(presets).map(([k, v]) => k + ':' + v.length + '/' + v.filter(p => p.fav).length + '★').join(' '), '| пустых', Object.values(presets).flat().filter(p => !p.items.length).map(p => p.name).join(', ') || 'нет');
console.log('позиции кнопок и проектов: заменено на действующие по названию', replacedByName, '| пропущено архивных', skippedArchived.length, '| не найдено', missing.length);
console.log('проекты:'); report.forEach(r => console.log('  ' + String(r.main).padStart(9) + ' → ' + String(r.design).padStart(9) + (r.diff ? '  Δ ' + r.diff : '  ✓') + '  ' + r.rooms + ' пом.  ' + r.name));
console.log('файл', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'КБ');
