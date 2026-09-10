// Редактор ручного построения потолка: контур → размеры → правка, быстрые фигуры.
// Перенесён из HTML-прототипа: императивный DOM внутри переданного корневого элемента.
import { L,TAU,wrap,hyp,sub,add,mul,dot,cross,norm,perp,clone,cm,fmt2,turnAt,shoelace,windOf,interiorDeg,outNormal,lineX,segX,inside,isInteriorDiag,W_ANG,toPts,flat,buildCons,conRes,resid,jac,solveLin,sq,lm,rankOf,rowFor,estScale,analyze,alignPts,makeModel,solveModel,ptsOf,filletInfo,arcInfo,flatten,perimeterOf,polyStats,sideLen,bakeModel,checkFillets,opDelete,opAddPoint,opShift,opLength,opFillet,opArc,opBump,rectPoly,circumR,ovalPoly,DEG,W_PRIOR,NEED } from './geometry.js';

const TEMPLATE = `<div class="app" id="app">
  <div class="top">
    <button class="ib" id="bBack" title="Назад">‹</button>
    <h1 id="title">Построение <span class="sub" id="sub"></span></h1>
    <button class="ib" id="bUndo" title="Отменить">↶</button>
    <button class="ib" id="bRedo" title="Повторить">↷</button>
    <button class="ib text" id="bNew">Заново</button>
  </div>
  <div class="cv-wrap" id="cvw">
    <div class="stages" id="stages"></div>
    <svg id="cv" xmlns="http://www.w3.org/2000/svg"></svg>
    <div class="zoom"><button id="zIn" title="Крупнее">+</button><button id="zOut" title="Мельче">−</button><button id="zFit" class="fit" title="Вписать">⤢</button></div>
    <div class="hint" id="hint"></div>
    <div class="toast" id="toast"></div>
  </div>
  <div class="sheet" id="sheet"></div>
</div>`;

/** Монтирует редактор в root. opts: { roomName, onBack, onFinish({name, verts, area, perim, draw}) }. Возвращает { destroy }. */
export function createDrawEditor(root, opts = {}) {
root.innerHTML = TEMPLATE;
const $ = s => root.querySelector(s);
let alive = true;
function finish() { if (!S.poly) return; const st = polyStats(S.poly), F = flatten(S.poly, 12);
  const x0 = Math.min(...F.map(p => p.x)), y0 = Math.min(...F.map(p => p.y)), r2 = v => Math.round(v * 1000) / 1000;
  const draw = clone({ base: S.base, ops: S.ops, origin: S.origin, m: S.m ? { n: S.m.n, wind: S.m.wind, prior: S.m.prior, vert: S.m.vert, sides: S.m.sides, diags: S.m.diags } : null });
  if (opts.onFinish) opts.onFinish({ name: (S.roomName || '').trim() || opts.roomName || 'Помещение', verts: F.map(p => [r2(p.x - x0), r2(p.y - y0)]), area: Math.round(st.area * 100) / 100, perim: Math.round(st.perim * 100) / 100, draw }); }
// ───────── state & canvas ─────────
const FRESH = () => ({ stage: 0, sk: { pts: [], mode: 'grid' }, m: null, base: null, ops: [], redoOps: [], poly: null, sel: null, op: null, pick: null, hist2: [], redo2: [], hot: null, focusReq: null, sess: 0, quick: null, origin: null, roomName: opts.roomName || 'Помещение', tab2: 'walls', dpick: null });
const S = FRESH();
let VT = { s: 1, tx: 0, ty: 0 }, Z = { k: 1, dx: 0, dy: 0 }, lastStage = 0;
const svg = $('#cv'), NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
const toS = p => ({ x: (p.x * VT.s + VT.tx) * Z.k + Z.dx, y: (p.y * VT.s + VT.ty) * Z.k + Z.dy });
const fromS = q => ({ x: ((q.x - Z.dx) / Z.k - VT.tx) / VT.s, y: ((q.y - Z.dy) / Z.k - VT.ty) / VT.s });
const clampK = k => Math.min(64, Math.max(0.5, k));
function zoomAt(f, c) { const k = clampK(Z.k * f), r = k / Z.k; Z = { k, dx: c.x - (c.x - Z.dx) * r, dy: c.y - (c.y - Z.dy) * r }; renderCanvas(); }
function fitView(pts) { const W = svg.clientWidth, H = svg.clientHeight, pad = 62; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  pts.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
  const w = Math.max(x1 - x0, 1e-6), h = Math.max(y1 - y0, 1e-6), s = Math.min((W - 2 * pad) / w, (H - 2 * pad - 36) / h);
  VT = { s, tx: (W - w * s) / 2 - x0 * s, ty: (H - h * s) / 2 - y0 * s + 18 }; }
function dirOut(P, i) { const n = P.length, u1 = norm(sub(P[(i - 1 + n) % n], P[i])), u2 = norm(sub(P[(i + 1) % n], P[i])), b = add(u1, u2);
  if (Math.hypot(b.x, b.y) < 1e-6) return outNormal(P, i); const bis = norm(b); return interiorDeg(P, i, windOf(P)) < 180 ? mul(bis, -1) : bis; }
const TXT = 'paint-order:stroke;stroke:var(--paper);stroke-width:4px;stroke-linejoin:round;';
function text(p, str, o = {}) { return el('text', { x: p.x, y: p.y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'middle', 'font-size': o.size || 12, 'font-weight': o.w || 500,
  style: TXT + 'fill:' + (o.color || 'var(--ink)') + (o.italic ? ';font-style:italic' : '') }, str); }
function pathOf(pts, close) { return pts.map((p, k) => (k ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') + (close ? ' Z' : ''); }
function sidePts(poly, i) { const n = poly.v.length, P = ptsOf(poly), ai = arcInfo(poly, i);
  if (ai) { const A = P[i], a1 = Math.atan2(A.y - ai.C.y, A.x - ai.C.x), at = s => ({ x: ai.C.x + ai.R * Math.cos(a1 + s), y: ai.C.y + ai.R * Math.sin(a1 + s) });
    let sw = ai.ang; if (hyp(at(sw / 2), ai.apex) > hyp(at(-sw / 2), ai.apex)) sw = -sw; const st = Math.max(4, Math.ceil(Math.abs(sw) * DEG / 3)), out = [];
    for (let k = 0; k <= st; k++) out.push(at(sw * k / st)); return out; }
  const f0 = filletInfo(poly, i), f1 = filletInfo(poly, (i + 1) % n); return [f0 ? f0.T2 : P[i], f1 ? f1.T1 : P[(i + 1) % n]]; }

function renderCanvas() { while (svg.firstChild) svg.removeChild(svg.firstChild); const g = el('g', {}); svg.appendChild(g);
  const LS = Z.k >= 20 ? 0.6 : Z.k >= 8 ? 0.7 : Z.k >= 3 ? 0.85 : 1; // при увеличении буквы и подписи мельче, чтобы не закрывать мелкие выступы
  if (S.stage === 1) { const P = S.sk.pts; VT = { s: 1, tx: 0, ty: 0 }; const Q = P.map(toS);
    if (P.length > 1) g.appendChild(el('path', { d: pathOf(Q, false), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    if (P.length > 2) g.appendChild(el('path', { d: pathOf([Q[Q.length - 1], Q[0]], false), fill: 'none', stroke: 'var(--ink3)', 'stroke-width': 1.5, 'stroke-dasharray': '4 5' }));
    Q.forEach((p, i) => { if (i === 0 && P.length > 2) g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 16, style: 'fill:var(--laser-soft)' }));
      g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 6, style: 'fill:var(--paper);stroke:' + (i === 0 && P.length > 2 ? 'var(--laser)' : 'var(--ink)') + ';stroke-width:2' }));
      const o = P.length > 2 ? dirOut(P, i) : { x: 0, y: -1 }; g.appendChild(text(add(p, mul(o, 17 * LS)), L(i), { size: 13 * LS, w: 600 }));
      g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 24, fill: 'transparent', 'data-hit': 'v', 'data-i': i })); });
    return; }
  const poly = S.stage === 3 ? S.poly : S.stage === 2 ? { v: S.m.sol.map(p => ({ x: p.x, y: p.y, fillet: null, arc: null })) } : quickPoly(); if (!poly) return;
  const P = ptsOf(poly), n = P.length, F = flatten(poly); fitView(F);
  g.appendChild(el('path', { d: pathOf(F.map(toS), true), style: 'fill:var(--fill);stroke:var(--ink);stroke-width:2;stroke-linejoin:round' }));
  // мелкий пунктир: исходная сторона у дуги, срезанный угол у скругления, прежнее положение стены после сдвига
  if (S.stage === 3) { const dot = 'fill:none;stroke:var(--ink3);stroke-width:1;stroke-dasharray:1.5 3;stroke-linecap:round';
    if (S.ghost) g.appendChild(el('path', { d: pathOf(flatten(S.ghost).map(toS), true), style: dot }));
    for (let i = 0; i < n; i++) { const ai = arcInfo(poly, i); if (ai) { const a = toS(P[i]), b = toS(P[(i + 1) % n]); g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, style: dot })); }
      const fi = filletInfo(poly, i); if (fi) g.appendChild(el('path', { d: pathOf([fi.T1, P[i], fi.T2].map(toS), false), style: dot })); } }
  const st = S.m && S.m.status;
  // diagonals (stage 2)
  if (S.stage === 2 && st) {
    if (!st.empty.length) st.sug.diags.forEach(([i, j]) => { const a = toS(P[i]), b = toS(P[j]); // пунктир подсказки — только когда все стены введены
      g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, style: 'stroke:var(--laser);stroke-width:1.5;stroke-dasharray:3 5;opacity:.7' }));
      g.appendChild(text(mul(add(a, b), .5), L(i) + L(j) + ' ?', { size: 11, color: 'var(--laser)' }));
      g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'transparent', 'stroke-width': 26, 'data-hit': 'sug', 'data-i': i, 'data-j': j })); });
    S.m.diags.forEach((d, k) => { const a = toS(P[d.i]), b = toS(P[d.j]), on = S.hot && S.hot.t === 'd' && S.hot.k === k;
      g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, style: `stroke:${on ? 'var(--laser)' : 'var(--ink2)'};stroke-width:1.5;stroke-dasharray:6 4` }));
      g.appendChild(text(mul(add(a, b), .5), d.cm != null ? String(d.cm) : '?', { size: 12, color: on ? 'var(--laser)' : 'var(--ink2)' }));
      g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'transparent', 'stroke-width': 26, 'data-hit': 'd', 'data-i': k })); }); }
  // sides
  for (let i = 0; i < n; i++) { const sp = sidePts(poly, i).map(toS), j = (i + 1) % n;
    const on = (S.stage === 2 && S.hot && S.hot.t === 's' && S.hot.i === i) || (S.stage === 3 && S.sel && S.sel.t === 's' && S.sel.i === i);
    if (on) g.appendChild(el('path', { d: pathOf(sp, false), style: 'fill:none;stroke:var(--laser);stroke-width:5;stroke-linecap:round' }));
    const mid = toS(mul(add(P[i], P[j]), .5)), nO = outNormal(P, i), lp = add(mid, mul(nO, 14 * LS)), sl = hyp(sp[0], sp[sp.length - 1]);
    let str, color = 'var(--ink)', italic = false;
    if (S.stage === 2) { const v = S.m.sides[i]; if (v != null) str = String(v); else { str = String(cm(hyp(P[i], P[j]))); color = 'var(--ink3)'; italic = true; } if (on) color = 'var(--laser)'; }
    else { str = String(cm(hyp(P[i], P[j]))); if (on) color = 'var(--laser)'; }
    if (on || sl >= 26) g.appendChild(text(lp, str, { size: 12 * LS, w: 600, color, italic })); // подпись короткой стены появится при увеличении
    const ai = arcInfo(poly, i); if (ai) g.appendChild(text(add(toS(ai.apex), mul(nO, ai.dir === 'out' ? 14 : -14)), '⌒ ' + cm(ai.len), { size: 11 * LS, color: 'var(--ink2)' }));
    g.appendChild(el('path', { d: pathOf(sp, false), fill: 'none', stroke: 'transparent', 'stroke-width': 30, 'data-hit': 's', 'data-i': i })); }
  // vertices
  const wind = windOf(P);
  for (let i = 0; i < n; i++) { const p = toS(P[i]), fi = filletInfo(poly, i), o = dirOut(P, i);
    const on = S.sel && S.sel.t === 'v' && S.sel.i === i, isPick = (S.pick && S.pick.a === i) || (S.dpick && S.dpick.a === i);
    const nb = P.length, slA = hyp(toS(P[(i - 1 + nb) % nb]), p), slB = hyp(toS(P[(i + 1) % nb]), p), roomy = Math.min(slA, slB) >= 30;
    if (S.stage === 2 && S.m.vert[i].kind === 'ortho' && roomy) { const n_ = P.length, u1 = norm(sub(P[(i - 1 + n_) % n_], P[i])), u2 = norm(sub(P[(i + 1) % n_], P[i])), s = 9 * LS;
      const a = add(p, mul(u1, s)), b = add(p, mul(add(u1, u2), s)), c = add(p, mul(u2, s));
      g.appendChild(el('path', { d: pathOf([a, b, c], false), style: 'fill:none;stroke:var(--ink2);stroke-width:1.2' })); }
    if (S.stage === 2 && S.m.vert[i].kind !== 'ortho' && roomy) { const d = interiorDeg(P, i, wind), inn = mul(o, -1);
      g.appendChild(text(add(p, mul(inn, 24 * LS)), Math.round(d) + '°', { size: 10 * LS, color: S.m.vert[i].kind === 'deg' ? 'var(--ink)' : 'var(--ink3)', italic: S.m.vert[i].kind === 'free' })); }
    if (fi) { g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 4, style: 'fill:none;stroke:var(--ink3);stroke-width:1.2;stroke-dasharray:2 2' }));
      g.appendChild(text(add(toS(fi.C), mul(o, -2)), 'R' + cm(fi.R), { size: 10 * LS, color: 'var(--ink2)' })); }
    else g.appendChild(el('circle', { cx: p.x, cy: p.y, r: on || isPick ? 7 : 5, style: `fill:${on || isPick ? 'var(--laser)' : 'var(--paper)'};stroke:${on || isPick ? 'var(--laser)' : 'var(--ink)'};stroke-width:2` }));
    g.appendChild(text(add(p, mul(o, 18 * LS)), L(i), { size: 13 * LS, w: 600, color: on || isPick ? 'var(--laser)' : 'var(--ink)' }));
    g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 24, fill: 'transparent', 'data-hit': 'v', 'data-i': i })); } }

// ───────── pointer ─────────
let ptr = null, pinch = null; const pointers = new Map();
function xy(e) { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
const midOf = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
svg.addEventListener('pointerdown', e => { const p = xy(e); pointers.set(e.pointerId, p); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* синтетические события без активного указателя */ } e.preventDefault();
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d0: Math.max(10, hyp(a, b)), m0: midOf(a, b), Z0: { ...Z } }; ptr = null; return; }
  if (pointers.size > 2 || pinch) return;
  const h = e.target.closest ? e.target.closest('[data-hit]') : null;
  ptr = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false, hit: h ? { t: h.dataset.hit, i: +h.dataset.i, j: +h.dataset.j } : null, pan: !h, Z0: { ...Z } }; });
svg.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return; const p = xy(e); pointers.set(e.pointerId, p);
  if (pinch) { if (pointers.size !== 2) return; const [a, b] = [...pointers.values()], k = clampK(pinch.Z0.k * hyp(a, b) / pinch.d0), m = midOf(a, b);
    const bx = (pinch.m0.x - pinch.Z0.dx) / pinch.Z0.k, by = (pinch.m0.y - pinch.Z0.dy) / pinch.Z0.k; Z = { k, dx: m.x - bx * k, dy: m.y - by * k }; renderCanvas(); return; }
  if (!ptr || e.pointerId !== ptr.id) return; ptr.x = p.x; ptr.y = p.y; if (Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > 6) ptr.moved = true; if (!ptr.moved) return;
  if (ptr.hit && S.stage === 1 && ptr.hit.t === 'v') { S.sk.pts[ptr.hit.i] = fromS(p); renderCanvas(); }
  else if (ptr.pan) { Z = { k: ptr.Z0.k, dx: ptr.Z0.dx + p.x - ptr.x0, dy: ptr.Z0.dy + p.y - ptr.y0 }; renderCanvas(); } });
function pointerEnd(e) { pointers.delete(e.pointerId); if (!pointers.size) pinch = null; if (pinch) return;
  if (ptr && e.pointerId === ptr.id) { const p = ptr; ptr = null; if (!(p.pan && p.moved)) onTap(p); } }
svg.addEventListener('pointerup', pointerEnd); svg.addEventListener('pointercancel', pointerEnd);
$('#zIn').addEventListener('click', () => zoomAt(1.5, { x: svg.clientWidth / 2, y: svg.clientHeight / 2 }));
$('#zOut').addEventListener('click', () => zoomAt(1 / 1.5, { x: svg.clientWidth / 2, y: svg.clientHeight / 2 }));
$('#zFit').addEventListener('click', () => { Z = { k: 1, dx: 0, dy: 0 }; renderCanvas(); });
// Куда ложится новая стена — по тому, как её нарисовали:
//  · явно косая (длиннее ~44 px на экране и дальше 22° от обеих осей) — остаётся как есть, близко к 45° прилипает к 45°;
//  · иначе по сетке: короткая стена всегда перпендикулярна предыдущей (мелкий выступ пальцем точно не нарисовать),
//    длинная — по ближайшей оси, продолжение прямой допускается.
function snapPt(p, prev, others, free, prev2) { const q = { x: p.x, y: p.y };
  others.forEach(o => { if (o === prev) return; if (Math.abs(q.x - o.x) < 10 / Z.k) q.x = o.x; if (Math.abs(q.y - o.y) < 10 / Z.k) q.y = o.y; }); // выравнивание по другим углам
  if (!prev) return q;
  const dx = q.x - prev.x, dy = q.y - prev.y, len = Math.hypot(dx, dy) * Z.k, devH = Math.atan2(Math.abs(dy), Math.abs(dx)) * DEG, devV = 90 - devH;
  if (free || (len >= 44 && devH >= 22 && devV >= 22)) { const ang = Math.atan2(dy, dx) * DEG, n45 = Math.round(ang / 45) * 45;
    if (Math.abs(wrap((ang - n45) / DEG) * DEG) < 5) { const L = Math.hypot(dx, dy); q.x = prev.x + Math.cos(n45 / DEG) * L; q.y = prev.y + Math.sin(n45 / DEG) * L; } return q; }
  const pv = prev2 && Math.abs(prev.x - prev2.x) < 1e-6, ph = prev2 && Math.abs(prev.y - prev2.y) < 1e-6;
  let horiz; if (pv) horiz = len < 44 ? true : devH <= 45; else if (ph) horiz = len < 44 ? false : devH <= 45; else horiz = Math.abs(dx) >= Math.abs(dy);
  if (horiz) q.y = prev.y; else q.x = prev.x; return q; }
function onTap(p) { const P = S.sk.pts; if (S.stage === 0) return;
  if (S.stage === 1) {
    if (p.hit) { const i = p.hit.i; if (p.moved) { const n = P.length; P[i] = snapPt(P[i], P[(i - 1 + n) % n], P.filter((_, k) => k !== i)); commit(); }
      else if (i === 0 && P.length >= 3) closeSketch(); return; }
    if (p.moved) return; if (P.length >= 200) return toast('Слишком много точек', true);
    const q = snapPt(fromS({ x: p.x, y: p.y }), P[P.length - 1], P, S.sk.mode === 'free', P[P.length - 2]); if (P.some(o => hyp(o, q) < 14 / Z.k)) return; P.push(q); commit(); return; }
  if (S.stage === 2) { const h = p.hit;
    if (S.pick) { if (h && h.t === 'v') pickVertex(h.i); return; }
    if (!h) { S.sel = null; blurActive(); render(); return; }
    if (h.t === 'v') { S.sel = { t: 'v', i: h.i }; blurActive(); render(); }
    else if (h.t === 's') { S.sel = null; S.tab2 = 'walls'; S.dpick = null; S.focusReq = `input[data-in="side"][data-i="${h.i}"]`; render(); }
    else if (h.t === 'd') { S.sel = null; S.tab2 = 'diags'; S.dpick = null; S.focusReq = `input[data-in="diag"][data-k="${h.i}"]`; render(); }
    else if (h.t === 'sug') addDiag(h.i, h.j); return; }
  if (S.stage === 3) { const h = p.hit; S.op = null; S.sel = h && (h.t === 'v' || h.t === 's') ? { t: h.t, i: h.i } : null; blurActive(); render(); } }
function closeSketch() { const P = S.sk.pts; if (P.length < 3) return;
  // Замыкание по сетке: у прямоугольного контура стены чередуются (горизонталь/вертикаль), число стен чётное.
  // Последняя стена и стена A→B на разных осях → замыкающая стена перпендикулярна обеим: ставим последнюю точку на ряд/колонку A.
  // На одной оси → нужен ещё один угол, добавляем точку X сами; если точка оказалась лишней (на прямой) — убираем её.
  if (S.sk.mode !== 'free') { const n = P.length, last = P[n - 1], prev = P[n - 2], A = P[0], B = P[1], eq = (a, b) => Math.abs(a - b) < 1e-6;
    const lastV = eq(last.x, prev.x), lastH = eq(last.y, prev.y), abH = eq(B.y, A.y), abV = eq(B.x, A.x);
    if (lastV && abV) last.y = A.y;
    else if (lastH && abH) last.x = A.x;
    else if (lastV && abH) { if (eq(last.x, A.x)) P.pop(); else if (eq(last.y, A.y)) P.shift(); else if (n < 200) P.push({ x: A.x, y: last.y }); }
    else if (lastH && abV) { if (eq(last.y, A.y)) P.pop(); else if (eq(last.x, A.x)) P.shift(); else if (n < 200) P.push({ x: last.x, y: A.y }); } }
  S.m = solveModel(makeModel(P, S.sk.mode)); S.stage = 2; S.sel = null; S.hist2 = []; S.redo2 = []; S.tab2 = 'walls'; S.dpick = null; render();
  if (S.sk.mode === 'free') toast('Углы не заданы: после длин понадобятся диагонали. Прямые можно отметить во вкладке «Углы»'); else if (S.m.vert.every(v => v.kind === 'ortho')) toast('Все углы прямые. Введите длины стен'); else toast('Углы без маркера — свободные. Их можно уточнить'); }
let toastT = null;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', 2600); }

// ───────── sheet: persistent DOM, native number inputs, in-place updates ─────────
const sheet = $('#sheet'); let sheetKey = '', applyT = null;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return (h > 10 && h < 20) ? c : m === 1 ? a : (m > 1 && m < 5) ? b : c; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const numIn = (name, extra, val, hint) => `<input class="in" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" data-in="${name}" ${extra} value="${esc(val ?? '')}" placeholder="${esc(hint ?? '')}">`;
const parseNum = str => { const v = parseFloat(String(str).replace(',', '.')); return isFinite(v) && v > 0 ? v : null; };
function statusInfo() { const st = S.m.status, n = S.m.n;
  if (st.missing === 0) { const w = st.worst, a = w ? Math.abs(w.v) : 0, wa = st.worstAng ? Math.abs(st.worstAng.v) : 0;
    if (a > 3) return { cls: 'bad', h: `Не сходится: ${w.label} на ${a.toFixed(0)} см`, s: 'Проверьте это измерение или соседние с ним' };
    if (a > 1 || wa > 1) return { cls: 'warn', h: 'Фигура определена, размеры подогнаны', s: w ? `${w.label}: расхождение ${a.toFixed(1)} см` : `Угол ${st.worstAng.label}: расхождение ${wa.toFixed(1)}°` };
    return { cls: 'ok', h: 'Фигура определена', s: st.empty.length ? 'Пустые стороны посчитаны автоматически' : 'Все размеры сходятся' }; }
  if (st.empty.length) return { cls: 'info', h: `Введите длины: осталось ${st.empty.length} из ${n}`, s: st.afterSides > 0 ? `Потом понадобится ещё ${st.afterSides}: диагональ или угол` : 'Длин сторон будет достаточно' };
  const sug = st.sug.diags.map(([i, j]) => 'диагональ ' + L(i) + '–' + L(j)); if (st.sug.angs.length) sug.push('угол ' + st.sug.angs.map(L).join(' / '));
  return { cls: 'warn', h: `Нужно ещё ${st.missing} ${plural(st.missing, 'измерение', 'измерения', 'измерений')}`, s: sug.length ? 'Например: ' + sug.join(' или ') : 'Добавьте диагональ или угол' }; }
function sheet1() { const n = S.sk.pts.length;
  return `<div class="status info"><span class="dot"></span><div>${n < 3 ? 'Ставьте точки по углам комнаты по порядку обхода' : 'Замкните фигуру: тап по точке A или кнопка ниже'}<small>${S.sk.mode === 'free' ? 'Углы любые, как нарисуете. Потом длины, диагонали или градусы' : 'Стены ложатся по сетке, косую стену просто рисуйте под углом. Мелкие выступы ставьте при увеличении'}</small></div></div>
  <div class="btns"><button class="btn sm ghost" data-act="home">← Назад</button><button class="btn ghost" data-act="undoPt" ${n ? '' : 'disabled'}>← Точку</button><button class="btn pri" data-act="close" ${n >= 3 ? '' : 'disabled'}>Замкнуть</button></div>`; }
const vertexNote = vt => vt.kind === 'ortho' ? 'Держится ровно 90° или 270°. Снимите, если стена косая.' : vt.kind === 'free' ? 'Угол не задан: его определят длины, диагонали или градусы.' : 'Угол задан вручную, заменяет одну диагональ.';
function sheet2() { const m = S.m, n = m.n, tab = S.tab2 || 'walls';
  let h = `<div class="status" id="st2"><span class="dot"></span><div id="st2t"></div></div>`;
  if (S.sel && S.sel.t === 'v') { const i = S.sel.i, vt = m.vert[i];
    h += `<div class="card"><h3><span class="m">${L(i)}</span> угол <small id="vcur"></small></h3>
    <div class="seg"><button class="${vt.kind === 'ortho' ? 'on' : ''}" data-act="vkind" data-k="ortho">Прямой</button><button class="${vt.kind === 'free' ? 'on' : ''}" data-act="vkind" data-k="free">Свободный</button><button class="${vt.kind === 'deg' ? 'on' : ''}" data-act="vkind" data-k="deg">Градусы</button></div>
    ${vt.kind === 'deg' ? `<div class="fld"><span class="k">Внутренний угол</span>${numIn('ang', `data-i="${i}"`, vt.deg ?? '', '')}<span class="u">°</span></div>` : ''}
    <div class="note">${vertexNote(vt)}</div>
    <div class="btns"><button class="btn ghost" data-act="deselect">Закрыть</button></div></div>`; return h; }
  h += `<div class="seg tabs"><button class="${tab === 'walls' ? 'on' : ''}" data-act="tab2" data-v="walls">Стены</button><button class="${tab === 'diags' ? 'on' : ''}" data-act="tab2" data-v="diags">Диагонали${m.diags.length ? ' · ' + m.diags.length : ''}</button><button class="${tab === 'angles' ? 'on' : ''}" data-act="tab2" data-v="angles">Углы</button></div>`;
  const kbBtns = `<button class="next" data-act="nextField" type="button">Далее ▸</button><button class="done" data-act="blur" type="button" title="Готово">✓</button>`;
  if (tab === 'walls') { h += '<div class="rows">';
    for (let i = 0; i < n; i++) h += `<div class="row"><span class="lbl">${L(i)}${L((i + 1) % n)}</span>${numIn('side', `data-i="${i}"`, m.sides[i] ?? '', '')}${kbBtns}</div>`;
    h += '</div>'; }
  else if (tab === 'diags') { h += `<div class="note" id="dnote"></div>`;
    if (m.diags.length) { h += '<div class="sec">Введённые</div><div class="rows">';
      m.diags.forEach((d, k) => { h += `<div class="row"><span class="lbl">${L(d.i)}–${L(d.j)}</span>${numIn('diag', `data-k="${k}"`, d.cm ?? '', '')}<button class="x" data-act="rmDiag" data-i="${k}">✕</button>${kbBtns}</div>`; }); h += '</div>'; }
    h += `<div class="sec">Подсказка</div><div id="sugList" class="rows one"></div>`;
    h += `<div class="sec">Другая диагональ</div><div class="note">${S.dpick ? 'Первая вершина ' + L(S.dpick.a) + ' — теперь вторая' : 'Нажмите две вершины по буквам'}</div><div class="letters">`;
    for (let i = 0; i < n; i++) h += `<button class="lt ${S.dpick && S.dpick.a === i ? 'on' : ''}" data-act="dpk" data-i="${i}">${L(i)}</button>`;
    h += '</div>'; }
  else { h += '<div class="rows one">';
    for (let i = 0; i < n; i++) { const vt = m.vert[i];
      h += `<div class="row vrow"><span class="lbl">${L(i)}</span><span class="cur" data-cur="${i}"></span><div class="seg mini"><button class="${vt.kind === 'ortho' ? 'on' : ''}" data-act="vk" data-i="${i}" data-k="ortho">прямой</button><button class="${vt.kind === 'free' ? 'on' : ''}" data-act="vk" data-i="${i}" data-k="free">свободный</button><button class="${vt.kind === 'deg' ? 'on' : ''}" data-act="vk" data-i="${i}" data-k="deg">°</button></div>${vt.kind === 'deg' ? numIn('ang', `data-i="${i}"`, vt.deg ?? '', '') + kbBtns : ''}</div>`; }
    h += '</div>'; }
  h += `<div class="btns"><button class="btn sm ghost" data-act="back1">← Контур</button><button class="btn pri" id="doneBtn" data-act="done">${S.ops.length ? 'Перестроить ✓' : 'Построить ✓'}</button></div>`;
  if (S.ops.length) h += `<div class="note">После перестроения заново применятся правки этапа 3: ${S.ops.map(opLabel).join(', ')}</div>`;
  return h; }
function updateSheet2() { const m = S.m, n = m.n, st = m.status, si = statusInfo(), box = $('#st2');
  if (box) { box.className = 'status ' + si.cls; $('#st2t').innerHTML = `${esc(si.h)}<small>${esc(si.s)}</small>`; }
  const vc = $('#vcur'); if (vc && S.sel) vc.textContent = 'сейчас ' + Math.round(interiorDeg(m.sol, S.sel.i, m.wind)) + '°';
  const ac = document.activeElement;
  sheet.querySelectorAll('input[data-in="side"]').forEach(el => { const i = +el.dataset.i, v = m.sides[i], auto = v == null && st.missing === 0; if (ac !== el) el.value = v ?? '';
    el.placeholder = auto ? '≈ ' + cm(hyp(m.sol[i], m.sol[(i + 1) % n])) : '—'; el.classList.toggle('auto', auto); });
  sheet.querySelectorAll('input[data-in="diag"]').forEach(el => { const d = m.diags[+el.dataset.k]; if (!d) return; if (ac !== el) el.value = d.cm ?? '';
    const auto = d.cm == null && st.missing === 0; el.placeholder = auto ? '≈ ' + cm(hyp(m.sol[d.i], m.sol[d.j])) : '—'; el.classList.toggle('auto', auto); });
  sheet.querySelectorAll('[data-cur]').forEach(el => { el.textContent = Math.round(interiorDeg(m.sol, +el.dataset.cur, m.wind)) + '°'; });
  const dn = $('#dnote'); if (dn) dn.textContent = st.afterSides > 0 ? `Не хватает ${st.afterSides} ${plural(st.afterSides, 'измерения', 'измерений', 'измерений')}: диагонали или углы` : st.empty.length ? 'Сначала длины стен, потом станет ясно, нужны ли диагонали' : 'Данных достаточно. Диагонали можно добавить для проверки';
  const sl = $('#sugList'); if (sl) { const have = new Set(m.diags.map(d => d.i + '-' + d.j)), rows = st.sug.diags.filter(([i, j]) => !have.has(i + '-' + j));
    sl.innerHTML = (rows.length ? rows.map(([i, j]) => `<div class="row sug" data-act="addSug" data-i="${i}" data-j="${j}"><span class="lbl">${L(i)}–${L(j)}</span><span class="sughint">измерьте лазером и добавьте</span><span class="plus">+</span></div>`).join('') : '') +
      (st.sug.angs.length ? `<div class="note">или задайте угол ${st.sug.angs.map(L).join(' / ')} во вкладке «Углы»</div>` : '') + (!rows.length && !st.sug.angs.length ? '<div class="note">Подсказок нет</div>' : ''); }
  const db = $('#doneBtn'); if (db) db.disabled = st.missing > 0; }
// stage-2 history: snapshot before each change; keystrokes within one focus session merge into one step
const state2 = () => JSON.stringify({ sides: S.m.sides, diags: S.m.diags, vert: S.m.vert });
function withSnap(fn, sess) { if (!S.m) return fn(); const before = state2(); fn(); if (before === state2()) return;
  const top = S.hist2[S.hist2.length - 1]; if (!(top && sess != null && top.sess === sess)) { S.hist2.push({ s: before, sess }); if (S.hist2.length > 50) S.hist2.shift(); } S.redo2 = []; }
function restore2(json) { Object.assign(S.m, JSON.parse(json)); solveModel(S.m); S.sel = null; S.pick = null; S.hot = null; sheetKey = ''; render(); }
function undo2() { if (!S.hist2.length) return; const cur = state2(); S.redo2.push(cur); restore2(S.hist2.pop().s); }
function redo2() { if (!S.redo2.length) return; S.hist2.push({ s: state2(), sess: -1 }); restore2(S.redo2.pop()); }
// input plumbing
function onInput(el) { const kind = el.dataset.in, v = parseNum(el.value), sess = +el.dataset.sess;
  if (kind === 'op') { if (S.op) { S.op.f[el.dataset.k] = el.value; updateSheet(); } return; }
  if (kind === 'q') { if (S.quick) { S.quick.f[el.dataset.k] = el.value; renderCanvas(); updateSheet(); } return; }
  if (!S.m) return;
  withSnap(() => { if (kind === 'side') S.m.sides[+el.dataset.i] = v; else if (kind === 'diag') { const d = S.m.diags[+el.dataset.k]; if (d) d.cm = v; }
    else if (kind === 'ang') { const vt = S.m.vert[+el.dataset.i]; vt.kind = 'deg'; vt.deg = (v && v > 3 && v < 357 && Math.abs(v - 180) > 1) ? v : null; } }, sess);
  clearTimeout(applyT); applyT = setTimeout(flushApply, 500); }
function flushApply() { if (!applyT) return; clearTimeout(applyT); applyT = null; if (!S.m || S.stage !== 2) return; solveModel(S.m); renderCanvas(); updateSheet(); save(); }
// В режиме клавиатуры видна только активная строка: перед фокусом показываем строку нужного поля, иначе focus() не сработает
function focusIn(el) { if (!el) return; const row = el.closest('.row'); if (row && sheet.classList.contains('kb')) { sheet.querySelectorAll('.row.active').forEach(r => r.classList.remove('active')); row.classList.add('active'); } el.focus(); if (el.select) el.select(); }
function onEnter(el) { flushApply(); if (el.dataset.in === 'q') { const all = [...sheet.querySelectorAll('input[data-in="q"]')], k = all.indexOf(el); if (k < all.length - 1) focusIn(all[k + 1]); else quickBuild(); return; }
  if (el.dataset.in === 'op') { const all = [...sheet.querySelectorAll('input[data-in="op"]')], k = all.indexOf(el); if (k < all.length - 1) focusIn(all[k + 1]); else applyOp(); return; }
  const all = [...sheet.querySelectorAll('input.in')], k = all.indexOf(el); if (k >= 0 && k < all.length - 1) focusIn(all[k + 1]); else el.blur(); }
sheet.addEventListener('input', e => { if (e.target.matches && e.target.matches('input.in')) onInput(e.target); });
sheet.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('input.in')) { e.preventDefault(); onEnter(e.target); } });
// На телефоне при открытой клавиатуре панель схлопывается до одной строки с активной стеной, чертёж занимает остальное
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let kbT = null;
function setKb(on) { sheet.classList.toggle('kb', on); $('#app').classList.toggle('kb', on); requestAnimationFrame(() => renderCanvas()); }
sheet.addEventListener('focusin', e => { const el = e.target; if (!el.matches || !el.matches('input.in')) return; el.dataset.sess = ++S.sess; setTimeout(() => el.select(), 0);
  S.hot = el.dataset.in === 'side' ? { t: 's', i: +el.dataset.i } : el.dataset.in === 'diag' ? { t: 'd', k: +el.dataset.k } : null;
  const row = el.closest('.row'); clearTimeout(kbT); sheet.querySelectorAll('.row.active').forEach(r => r.classList.remove('active'));
  if (row && COARSE) { row.classList.add('active'); setKb(true); } else renderCanvas(); });
sheet.addEventListener('focusout', e => { const el = e.target; if (!el.matches || !el.matches('input.in')) return; flushApply(); S.hot = null;
  clearTimeout(kbT); kbT = setTimeout(() => { const a = document.activeElement; if (a && a.matches && a.matches('input.in') && a.closest('.row')) return; sheet.querySelectorAll('.row.active').forEach(r => r.classList.remove('active')); setKb(false); }, 60); });
// кнопки «Далее» и «✓» не должны забирать фокус у поля, иначе клавиатура на телефоне закроется
// На iOS preventDefault на касании отменяет и click, поэтому действие выполняется прямо на pointerdown
let kbActAt = 0;
const kbBtn = e => e.target.closest && e.target.closest('[data-act="nextField"],[data-act="blur"]');
sheet.addEventListener('pointerdown', e => { const b = kbBtn(e); if (!b) return; e.preventDefault(); kbActAt = Date.now(); act(b.dataset.act, b.dataset); });
sheet.addEventListener('mousedown', e => { if (kbBtn(e)) e.preventDefault(); });
sheet.addEventListener('touchstart', e => { if (kbBtn(e)) e.preventDefault(); }, { passive: false });
const blurActive = () => { const a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); };
function addDiag(i, j) { if (i > j) [i, j] = [j, i]; const n = S.m.n; if (i === j || (i + 1) % n === j || (j + 1) % n === i) return toast('Это соседние вершины, тут сторона', true);
  let k = S.m.diags.findIndex(d => d.i === i && d.j === j); if (k < 0) { withSnap(() => S.m.diags.push({ i, j, cm: null })); k = S.m.diags.length - 1; }
  S.pick = null; S.sel = null; S.tab2 = 'diags'; S.dpick = null; S.focusReq = `input[data-in="diag"][data-k="${k}"]`; render(); }
function pickVertex(i) { const p = S.pick; if (p.mode === 'ang') { S.pick = null; S.sel = { t: 'v', i }; setVKind('deg'); return; }
  if (p.a == null) { p.a = i; render(); return; } if (p.a === i) return toast('Выберите другую вершину', true); const a = p.a; S.pick = null; addDiag(a, i); }
function setVKind(k) { return setVKindAt(S.sel.i, k); }
function setVKindAt(i, k) { const vt = S.m.vert[i];
  withSnap(() => { if (k === 'ortho') { const d = interiorDeg(S.m.sol, i, S.m.wind); vt.kind = 'ortho'; vt.deg = Math.abs(d - 270) < Math.abs(d - 90) ? 270 : 90; }
    else if (k === 'free') { vt.kind = 'free'; vt.deg = null; } else if (vt.kind !== 'deg') { vt.kind = 'deg'; vt.deg = null; } });
  if (k === 'deg') S.focusReq = `input[data-in="ang"][data-i="${i}"]`; solveModel(S.m); render(); }

// ───────── stage 3: operations, journal, persistence ─────────

// ───────── схемы операций: стена по горизонтали, комната под ней (заливка) ─────────
const G_INK = 'fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const G_PRI = 'fill="none" stroke="var(--pri)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const G_OLD = 'fill="none" stroke="var(--ink3)" stroke-width="1.6" stroke-dasharray="3 2.5" stroke-linecap="round"';
const G_ROOM = '<rect x="3" y="14" width="34" height="12" rx="1" fill="var(--fill)"/>';
const gsvg = body => `<svg class="g" viewBox="0 0 40 28" aria-hidden="true">${body}</svg>`;
const GL = {
  len: end => gsvg(G_ROOM + (end === 'start'
    ? `<path d="M12 14 L35 14" ${G_INK}/><path d="M12 14 L5 14" ${G_PRI}/><path d="M9 10 L5 14 L9 18" ${G_PRI}/><circle cx="35" cy="14" r="2.5" fill="var(--ink)"/>`
    : `<path d="M5 14 L28 14" ${G_INK}/><path d="M28 14 L35 14" ${G_PRI}/><path d="M31 10 L35 14 L31 18" ${G_PRI}/><circle cx="5" cy="14" r="2.5" fill="var(--ink)"/>`)),
  add: from => gsvg(G_ROOM + `<path d="M5 14 L35 14" ${G_INK}/><circle cx="5" cy="14" r="2.5" fill="var(--ink)"/><circle cx="35" cy="14" r="2.5" fill="var(--ink)"/><circle cx="${from === 'end' ? 26 : 14}" cy="14" r="3.5" fill="var(--pri)"/>`),
  shift: dir => gsvg(G_ROOM + `<path d="M5 14 L35 14" ${G_OLD}/><path d="M5 ${dir === 'in' ? 22 : 6} L35 ${dir === 'in' ? 22 : 6}" ${G_PRI}/><path d="M20 14 L20 ${dir === 'in' ? 21 : 7}" ${G_PRI}/><path d="${dir === 'in' ? 'M16 18 L20 22 L24 18' : 'M16 10 L20 6 L24 10'}" ${G_PRI}/>`),
  arc: dir => gsvg(G_ROOM + `<path d="M5 14 L35 14" ${G_OLD}/><path d="M5 14 Q20 ${dir === 'in' ? 27 : 1} 35 14" ${G_PRI}/><circle cx="5" cy="14" r="2.5" fill="var(--ink)"/><circle cx="35" cy="14" r="2.5" fill="var(--ink)"/>`),
  bump: dir => gsvg(G_ROOM + `<path d="M14 14 L26 14" ${G_OLD}/><path d="M5 14 L14 14 L14 ${dir === 'niche' ? 6 : 22} L26 ${dir === 'niche' ? 6 : 22} L26 14 L35 14" ${G_PRI}/>`),
  fillet: () => gsvg(`<rect x="8" y="8" width="29" height="18" rx="1" fill="var(--fill)"/><path d="M8 26 L8 8 L36 8" ${G_OLD}/><path d="M8 26 L8 17 Q8 8 17 8 L36 8" ${G_PRI}/>`),
  del: () => gsvg(`<path d="M6 24 L20 8 L34 24" ${G_OLD}/><path d="M6 24 L34 24" ${G_PRI}/><circle cx="6" cy="24" r="2.5" fill="var(--ink)"/><circle cx="34" cy="24" r="2.5" fill="var(--ink)"/><path d="M17 5 L23 11 M23 5 L17 11" fill="none" stroke="var(--bad)" stroke-width="1.8" stroke-linecap="round"/>`),
};
function opPic(o) { const k = o.kind, sg = o.seg;
  return k === 'len' ? GL.len(sg.end) : k === 'add' ? GL.add(sg.from) : k === 'shift' ? GL.shift(sg.dir) : k === 'arc' ? GL.arc(sg.dir) : k === 'bump' ? GL.bump(sg.dir) : k === 'fillet' ? GL.fillet() : ''; }
function makeOp(kind, i) { const n = S.poly.v.length, A = L(i), B = L((i + 1) % n), seg = {}, spec = { fields: [], segs: [] };
  if (kind === 'len') { spec.title = 'Длина стены ' + A + B; spec.segLabel = 'Какой угол сместить'; spec.fields = [['len', 'Новая длина', 'см']]; spec.segs = [['end', [['end', 'Угол ' + B], ['start', 'Угол ' + A]]]]; seg.end = 'end'; }
  if (kind === 'add') { spec.title = 'Точка на стене ' + A + B; spec.fields = [['d', 'Расстояние', 'см']]; spec.segs = [['from', [['start', 'от ' + A], ['end', 'от ' + B]]]]; seg.from = 'start'; }
  if (kind === 'shift') { spec.title = 'Сдвиг стены ' + A + B; spec.fields = [['d', 'На сколько', 'см']]; spec.segs = [['dir', [['out', 'Наружу'], ['in', 'Внутрь']]]]; seg.dir = 'out'; }
  if (kind === 'arc') { spec.title = 'Дуга на стене ' + A + B; spec.segs = [['mode', [['h', 'Стрела'], ['s', 'Длина дуги']]], ['dir', [['out', 'Наружу'], ['in', 'Внутрь']]]]; seg.mode = 'h'; seg.dir = 'out';
    const a = S.poly.v[i].arc; if (a) seg.dir = a.dir; }
  if (kind === 'bump') { spec.title = 'Выступ или ниша на ' + A + B; spec.fields = [['off', 'Отступ от угла', 'см'], ['w', 'Ширина', 'см'], ['dp', 'Глубина', 'см']];
    spec.segs = [['from', [['start', 'от ' + A], ['end', 'от ' + B]]], ['dir', [['in', 'Выступ в комнату'], ['niche', 'Ниша в стену']]]]; seg.from = 'start'; seg.dir = 'in'; }
  if (kind === 'fillet') { spec.title = 'Скруглить угол ' + A; spec.fields = [['r', 'Радиус', 'см']]; }
  const f = {}; if (kind === 'len') f.len = String(cm(sideLen(S.poly, i))); if (kind === 'fillet' && S.poly.v[i].fillet) f.r = String(cm(S.poly.v[i].fillet));
  if (kind === 'arc' && S.poly.v[i].arc) f.h = String(cm(S.poly.v[i].arc.h));
  S.op = { kind, i, spec, seg, f }; opFields(); S.focusReq = `input[data-in="op"][data-k="${S.op.spec.fields[0][0]}"]`; }
function opFields() { const o = S.op; if (o.kind === 'arc') o.spec.fields = o.seg.mode === 'h' ? [['h', 'Стрела (высота дуги)', 'см']] : [['s', 'Длина дуги', 'см']]; }
function opNote() { const o = S.op, num = k => parseNum(o.f[k]) / 100;
  if (o.kind === 'fillet') { const fi = filletInfo({ v: S.poly.v.map((p, k) => ({ ...p, fillet: k === o.i ? 1 : p.fillet })) }, o.i); if (!fi) return '';
    const Rmax = Math.min(fi.lp, fi.ln) / 2 * Math.tan(fi.phi / 2), r = num('r');
    return isFinite(r) && r > 0 ? `Касание на ${cm(r / Math.tan(fi.phi / 2))} см от угла · максимум R ${cm(Rmax)}` : `Угол ${Math.round(fi.phi * DEG)}° · максимум R ${cm(Rmax)} см`; }
  if (o.kind === 'arc') { const c = sideLen(S.poly, o.i); if (o.seg.mode === 'h') { const h = num('h'); return isFinite(h) && h > 0 ? `Хорда ${cm(c)} см · радиус ${cm(c * c / (8 * h) + h / 2)} см` : `Хорда (стена) ${cm(c)} см`; }
    return `Длина дуги должна быть больше ${cm(c)} см`; }
  if (o.kind === 'len') { const n = S.poly.v.length, A = L(o.i), B = L((o.i + 1) % n), C = L((o.i + 2) % n), Z = L((o.i - 1 + n) % n), mv = o.seg.end === 'end';
    return `Сейчас ${cm(sideLen(S.poly, o.i))} см. ${mv ? B : A} уедет вдоль стены, стена ${mv ? B + C : Z + A} сдвинется за ним параллельно. ${mv ? A : B} останется на месте`; }
  if (o.kind === 'add' || o.kind === 'bump') return `Длина стены ${cm(sideLen(S.poly, o.i))} см`;
  if (o.kind === 'shift') return 'Соседние стены удлинятся или укоротятся'; return ''; }
function sheet3() { const poly = S.poly, n = poly.v.length, st = polyStats(poly);
  if (S.op) { const o = S.op; let h = `<div class="card op"><h3><span>${esc(o.spec.title)}</span>${opPic(o)}</h3>`;
    if (o.spec.segLabel) h += `<div class="sec">${esc(o.spec.segLabel)}</div>`;
    o.spec.segs.forEach(([name, opts]) => { h += '<div class="seg">' + opts.map(([v, lbl]) => `<button class="${o.seg[name] === v ? 'on' : ''}" data-act="seg" data-n="${name}" data-v="${v}">${esc(lbl)}</button>`).join('') + '</div>'; });
    h += '<div class="fields">' + o.spec.fields.map(([k, lbl, u]) => `<div class="fld"><span class="k">${esc(lbl)}</span>${numIn('op', `data-k="${k}"`, o.f[k] ?? '', '')}<span class="u">${u}</span></div>`).join('') + '</div>';
    h += `<div class="note" id="opnote"></div><div class="btns"><button class="btn ghost" data-act="cancel">Отмена</button><button class="btn laser" data-act="apply">Применить</button></div></div>`; return h; }
  if (S.sel && S.sel.t === 'v') { const i = S.sel.i, P = ptsOf(poly), d = interiorDeg(P, i, windOf(P)), fl = poly.v[i].fillet;
    return `<div class="card"><h3><span class="m">${L(i)}</span> угол <small>${Math.round(d)}°${fl ? ' · скруглён R ' + cm(fl) : ''}</small></h3>
    <div class="acts"><button class="btn" data-act="op" data-k="fillet">${GL.fillet()}<span>${fl ? 'Изменить радиус' : 'Скруглить'}</span></button>${fl ? '<button class="btn" data-act="unfillet">Убрать скругление</button>' : ''}<button class="btn danger" data-act="del">${GL.del()}<span>Удалить угол</span></button><button class="btn ghost" data-act="deselect">Закрыть</button></div></div>`; }
  if (S.sel && S.sel.t === 's') { const i = S.sel.i, ai = arcInfo(poly, i);
    return `<div class="card"><h3><span class="m">${L(i)}${L((i + 1) % n)}</span> стена <small>${cm(sideLen(poly, i))} см${ai ? ' · дуга ' + cm(ai.len) : ''}</small></h3>
    <div class="acts"><button class="btn" data-act="op" data-k="len">${GL.len('end')}<span>Длина</span></button><button class="btn" data-act="op" data-k="shift">${GL.shift('out')}<span>Сдвинуть</span></button><button class="btn" data-act="op" data-k="add">${GL.add('start')}<span>Точка на стене</span></button><button class="btn" data-act="op" data-k="bump">${GL.bump('in')}<span>Выступ / ниша</span></button><button class="btn" data-act="op" data-k="arc">${GL.arc('out')}<span>${ai ? 'Изменить дугу' : 'Дуга'}</span></button>${ai ? '<button class="btn" data-act="unarc">Убрать дугу</button>' : '<button class="btn ghost" data-act="deselect">Закрыть</button>'}</div></div>`; }
  const oval = S.origin && S.origin.kind === 'oval', back = oval ? '<button class="btn sm ghost" data-act="editQuick">← Радиусы</button>' : '<button class="btn sm ghost" data-act="back2" title="Длины, углы, диагонали">← Размеры</button>';
  const shape = oval ? (S.origin.mode === 'circle' ? `Окружность R <b>${S.origin.f.r}</b> см` : `Эллипс <b>${S.origin.f.rx}</b> × <b>${S.origin.f.ry}</b> см`) : `Углов <b>${n}</b>: внутр. <b>${st.inner}</b>, наруж. <b>${st.outer}</b>${st.fillets ? `, скруглений <b>${st.fillets}</b>` : ''}${st.arcs ? `, дуг <b>${st.arcs}</b>` : ''}`;
  return `<div class="res"><div class="t"><div class="k">Площадь</div><div class="v">${fmt2(st.area)}<small>м²</small></div></div><div class="t"><div class="k">Периметр</div><div class="v">${fmt2(st.perim)}<small>м</small></div></div>${back}</div>
  <div class="meta">${shape}${S.ops.length ? `, правок <b>${S.ops.length}</b>` : ''} · тап по углу или стене — действия</div>
  <div class="btns fin"><input class="inName" id="roomName" value="${esc(S.roomName)}" placeholder="Название помещения" maxlength="40"><button class="btn pri" data-act="finish">Добавить в расчёт</button></div>`; }
function updateSheet3() { const nn = $('#opnote'); if (nn && S.op) nn.textContent = opNote(); }
function updateSheet() { if (S.stage === 0) updateSheet0(); else if (S.stage === 2 && S.m) updateSheet2(); else if (S.stage === 3) updateSheet3(); }
function runOp(poly, op) { let q = null;
  if (op.kind === 'len') q = opLength(poly, op.i, op.end, op.len); else if (op.kind === 'add') q = opAddPoint(poly, op.i, op.from, op.d);
  else if (op.kind === 'shift') q = opShift(poly, op.i, op.off); else if (op.kind === 'arc') q = opArc(poly, op.i, op.mode, op.val, op.dir);
  else if (op.kind === 'bump') q = opBump(poly, op.i, op.from, op.off, op.w, op.dp, op.dir); else if (op.kind === 'fillet') q = opFillet(poly, op.i, op.r);
  else if (op.kind === 'del') q = opDelete(poly, op.i);
  if (!q) throw new Error('Неизвестная правка'); if (Math.abs(shoelace(flatten(q))) < 1e-6) throw new Error('Фигура вырождается');
  return { q, dropped: checkFillets(q) }; }
const OP_NAMES = { len: 'длина', add: 'точка', shift: 'сдвиг', arc: 'дуга', bump: 'выступ', fillet: 'скругление', del: 'удаление' };
const opLabel = op => OP_NAMES[op.kind] + ' ' + L(op.i);
function replay(base, ops) { let poly = clone(base), failedAt = null, err = '';
  for (let k = 0; k < ops.length; k++) { try { poly = runOp(poly, ops[k]).q; } catch (e) { failedAt = k; err = e.message; break; } }
  return { poly, failedAt, err }; }
// после сдвига или изменения длины помним прежний контур, чтобы показать его пунктиром
function updateGhost() { const last = S.ops[S.ops.length - 1]; S.ghost = (last && (last.kind === 'shift' || last.kind === 'len') && S.base) ? replay(S.base, S.ops.slice(0, -1)).poly : null; }
function rebuild() { const r = replay(S.base, S.ops);
  if (r.failedAt != null) { const bad = S.ops[r.failedAt]; S.ops = S.ops.slice(0, r.failedAt); S.redoOps = []; toast(`Правка «${opLabel(bad)}» больше не подходит и снята: ${r.err}`, true); }
  S.poly = r.poly; updateGhost(); }
function commitOp(op) { try { const { q, dropped } = runOp(S.poly, op); S.ops.push(op); S.redoOps = []; S.ghost = (op.kind === 'shift' || op.kind === 'len') ? S.poly : null; S.poly = q; S.op = null; S.sel = null; blurActive(); render();
  if (dropped.length) toast('Скругление снято у ' + dropped.join(', ') + ': не помещается'); } catch (e) { toast(e.message, true); } }
function applyOp() { const o = S.op; if (!o) return; const num = k => { const v = parseNum(o.f[k]); return v == null ? NaN : v / 100; };
  for (const [k, lbl] of o.spec.fields) if (!isFinite(num(k))) return toast('Введите: ' + lbl.toLowerCase(), true);
  const op = { kind: o.kind, i: o.i };
  if (o.kind === 'len') Object.assign(op, { end: o.seg.end, len: num('len') });
  else if (o.kind === 'add') Object.assign(op, { from: o.seg.from, d: num('d') });
  else if (o.kind === 'shift') Object.assign(op, { off: (o.seg.dir === 'out' ? 1 : -1) * num('d') });
  else if (o.kind === 'arc') Object.assign(op, { mode: o.seg.mode, val: o.seg.mode === 'h' ? num('h') : num('s'), dir: o.seg.dir });
  else if (o.kind === 'bump') Object.assign(op, { from: o.seg.from, off: num('off'), w: num('w'), dp: num('dp'), dir: o.seg.dir });
  else if (o.kind === 'fillet') Object.assign(op, { r: num('r') });
  commitOp(op); }
function modelFromPoly(poly) { const P = ptsOf(poly), n = P.length, wind = windOf(P), m = makeModel(P.map(p => ({ x: p.x * 80, y: p.y * 80 })));
  m.vert = P.map((p, i) => { const d = interiorDeg(P, i, wind); if (Math.abs(d - 90) < 0.5) return { kind: 'ortho', deg: 90 }; if (Math.abs(d - 270) < 0.5) return { kind: 'ortho', deg: 270 }; return { kind: 'deg', deg: Math.round(d * 10) / 10 }; });
  m.sides = P.map((p, i) => Math.round(hyp(p, P[(i + 1) % n]) * 1000) / 10); return solveModel(m); }
function act(a, d) {
  if (a === 'nextField') { const el = document.activeElement; if (el && el.matches && el.matches('input.in')) onEnter(el); return; }
  if (a === 'blur') return blurActive();
  if (a === 'finish') return finish();
  if (a === 'q-rect') { S.quick = { kind: 'rect', f: { a: '', b: '' } }; S.focusReq = 'input[data-in="q"]'; return render(); }
  if (a === 'q-oval') { S.quick = { kind: 'oval', mode: 'circle', f: { r: '', rx: '', ry: '' } }; S.focusReq = 'input[data-in="q"]'; return render(); }
  if (a === 'q-poly') { S.stage = 1; S.sk.mode = 'grid'; S.origin = { kind: 'poly' }; return render(); }
  if (a === 'q-polyfree') { S.stage = 1; S.sk.mode = 'free'; S.origin = { kind: 'poly' }; return render(); }
  if (a === 'qmode') { S.quick.mode = d.v; S.focusReq = 'input[data-in="q"]'; return render(); }
  if (a === 'quickCancel') { if (S.quick.edit) { S.quick = null; S.stage = 3; } else S.quick = null; return render(); }
  if (a === 'quickBuild') return quickBuild();
  if (a === 'editQuick') { const o = S.origin; S.quick = { kind: 'oval', mode: o.mode, f: { ...o.f }, edit: true }; S.stage = 0; S.sel = null; S.op = null; S.focusReq = 'input[data-in="q"]'; return render(); }
  if (a === 'home') { const had = S.sk.pts.length; Object.assign(S, FRESH()); render(); if (had) toast('Контур сброшен'); return; }
  if (a === 'freeWall') { S.sk.free = !S.sk.free; return render(); }
  if (a === 'tab2') { S.tab2 = d.v; S.dpick = null; S.sel = null; blurActive(); return render(); }
  if (a === 'dpk') { const i = +d.i; if (!S.dpick) { S.dpick = { a: i }; return render(); } const a0 = S.dpick.a; S.dpick = null; if (a0 === i) return render();
    const lo = Math.min(a0, i), hi = Math.max(a0, i), n = S.m.n; if (!((lo + 1) % n === hi || (hi + 1) % n === lo) && !isInteriorDiag(S.m.sol, lo, hi)) { render(); return toast('Эта линия выходит за стены комнаты', true); } return addDiag(a0, i); }
  if (a === 'addSug') return addDiag(+d.i, +d.j);
  if (a === 'vk') return setVKindAt(+d.i, d.k);
  if (a === 'undoPt') { S.sk.pts.pop(); return render(); }
  if (a === 'close') return closeSketch();
  if (a === 'rmDiag') { withSnap(() => S.m.diags.splice(+d.i, 1)); solveModel(S.m); return render(); }
  if (a === 'pickDiag') { S.sel = null; S.pick = { mode: 'diag', a: null }; blurActive(); return render(); }
  if (a === 'pickAng') { S.sel = null; S.pick = { mode: 'ang' }; blurActive(); return render(); }
  if (a === 'pickCancel') { S.pick = null; return render(); }
  if (a === 'vkind') return setVKind(d.k);
  if (a === 'deselect') { S.sel = null; S.op = null; return render(); }
  if (a === 'back1') { const had = S.ops.length; Object.assign(S, { stage: 1, m: null, base: null, ops: [], redoOps: [], poly: null, sel: null, pick: null, hist2: [], redo2: [] }); render(); if (had) toast('Правки этапа 3 сброшены вместе с размерами'); return; }
  if (a === 'back2') { if (!S.m) S.m = modelFromPoly(S.base); S.stage = 2; S.sel = null; S.op = null; S.pick = null; return render(); }
  if (a === 'done') { if (S.m.status.missing) return; S.base = bakeModel(S.m); S.stage = 3; S.sel = null; blurActive(); rebuild(); return render(); }
  if (a === 'op') { makeOp(d.k, S.sel.i); return render(); }
  if (a === 'seg') { S.op.seg[d.n] = d.v; opFields(); return render(); }
  if (a === 'apply') return applyOp();
  if (a === 'cancel') { S.op = null; return render(); }
  if (a === 'del') return commitOp({ kind: 'del', i: S.sel.i });
  if (a === 'unfillet') return commitOp({ kind: 'fillet', i: S.sel.i, r: null });
  if (a === 'unarc') return commitOp({ kind: 'arc', i: S.sel.i, mode: 'h', val: 0, dir: 'out' }); }
sheet.addEventListener('input', e => { if (e.target && e.target.id === 'roomName') S.roomName = e.target.value; });
sheet.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || !sheet.contains(b)) return; if ((b.dataset.act === 'nextField' || b.dataset.act === 'blur') && Date.now() - kbActAt < 600) return; act(b.dataset.act, b.dataset); });
$('#bBack').addEventListener('click', () => { if (opts.onBack) opts.onBack(); });
$('#bUndo').addEventListener('click', () => { if (S.stage === 1) { S.sk.pts.pop(); render(); } else if (S.stage === 2) undo2(); else if (S.stage === 3 && S.ops.length) { S.redoOps.push(S.ops.pop()); rebuild(); S.sel = null; S.op = null; render(); } });
$('#bRedo').addEventListener('click', () => { if (S.stage === 2) redo2(); else if (S.stage === 3 && S.redoOps.length) { S.ops.push(S.redoOps.pop()); rebuild(); S.sel = null; S.op = null; render(); } });
let newArm = null;
function disarmNew() { clearTimeout(newArm); newArm = null; const b = $('#bNew'); b.textContent = 'Новый'; b.style.color = ''; }
$('#bNew').addEventListener('click', () => { if (S.stage === 0) { S.quick = null; return render(); } if (S.stage === 1 && !S.sk.pts.length) return;
  if (!newArm) { const b = $('#bNew'); b.textContent = 'Стереть?'; b.style.color = 'var(--laser)'; newArm = setTimeout(disarmNew, 3000); toast('Ещё раз, чтобы начать новый чертёж'); return; }
  disarmNew(); Object.assign(S, FRESH()); render(); });
function viewKey() { const m = S.m; return [S.stage, S.quick ? S.quick.kind + S.quick.mode + (S.quick.edit ? 'e' : '') : '', S.origin ? S.origin.kind : '', S.sel ? S.sel.t + S.sel.i : '', S.pick ? S.pick.mode + (S.pick.a ?? '') : '', S.op ? S.op.kind + S.op.i + JSON.stringify(S.op.seg) : '',
  m ? m.n + ':' + m.diags.length + ':' + m.vert.map(v => v.kind[0]).join('') + ':' + (S.sel && S.sel.t === 'v' ? m.vert[S.sel.i].kind : '') : '', S.tab2, S.dpick ? S.dpick.a : '', S.ops.length, S.poly ? S.poly.v.length : 0, S.sk.pts.length, S.sk.free ? 'f' : ''].join('|'); }
function renderSheet() { const key = viewKey(); if (key === sheetKey) { updateSheet(); return; }
  const top = sheet.scrollTop; sheetKey = key; sheet.innerHTML = S.stage === 0 ? sheet0() : S.stage === 1 ? sheet1() : S.stage === 2 ? sheet2() : sheet3(); updateSheet(); sheet.scrollTop = top; }
// ───────── stage 0: quick commands (rectangle, circle/ellipse, polygon) ─────────
function quickPoly() { const q = S.quick; if (!q) return null; const n = k => parseNum(q.f[k]);
  if (q.kind === 'rect') { const a = n('a'), b = n('b'); return a && b ? rectPoly(a / 100, b / 100) : null; }
  if (q.mode === 'circle') { const r = n('r'); return r ? ovalPoly(r / 100, r / 100) : null; }
  const rx = n('rx'), ry = n('ry'); return rx && ry ? ovalPoly(rx / 100, ry / 100) : null; }
function quickSpec() { const q = S.quick; if (q.kind === 'rect') return { title: 'Прямоугольник', fields: [['a', 'Сторона AB (ширина)', 'см'], ['b', 'Сторона BC (глубина)', 'см']] };
  return q.mode === 'circle' ? { title: 'Окружность', fields: [['r', 'Радиус', 'см']] } : { title: 'Эллипс', fields: [['rx', 'Радиус по ширине', 'см'], ['ry', 'Радиус по высоте', 'см']] }; }
const glyph = k => k === 'rect' ? '<svg viewBox="0 0 36 36"><rect x="4" y="8" width="28" height="20" rx="1.5" fill="var(--fill)" stroke="var(--ink)" stroke-width="2"/></svg>'
  : k === 'oval' ? '<svg viewBox="0 0 36 36"><ellipse cx="18" cy="18" rx="14" ry="10" fill="var(--fill)" stroke="var(--ink)" stroke-width="2"/></svg>'
  : k === 'free' ? '<svg viewBox="0 0 36 36"><path d="M5 30L9 6H27L32 20L26 30Z" fill="var(--fill)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/><path d="M9 6L26 30" stroke="var(--ink3)" stroke-width="1.5" stroke-dasharray="3 2"/></svg>'
  : '<svg viewBox="0 0 36 36"><path d="M4 6H22V16H32V30H4Z" fill="var(--fill)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/></svg>';
function sheet0() { const q = S.quick;
  if (!q) return `<div class="sec">Как строить</div><div class="opts">
    <button class="opt" data-act="q-rect">${glyph('rect')}<div><b>Прямоугольник</b><span>Две стороны, готовый чертёж сразу</span></div></button>
    <button class="opt" data-act="q-poly">${glyph('poly')}<div><b>Многоугольник · автоматически</b><span>Все углы прямые, одна-две косые стены распознаются сами</span></div></button>
    <button class="opt" data-act="q-polyfree">${glyph('free')}<div><b>Сложный многоугольник</b><span>Углы неизвестны: длины, диагонали или градусы</span></div></button>
    <button class="opt" data-act="q-oval">${glyph('oval')}<div><b>Окружность / эллипс</b><span>Радиус или два радиуса</span></div></button></div>`;
  const sp = quickSpec(); let h = `<div class="card op"><h3>${esc(sp.title)}${q.edit ? ' · изменить' : ''}</h3>`;
  if (q.kind === 'oval') h += `<div class="seg"><button class="${q.mode === 'circle' ? 'on' : ''}" data-act="qmode" data-v="circle">Окружность</button><button class="${q.mode === 'ellipse' ? 'on' : ''}" data-act="qmode" data-v="ellipse">Эллипс</button></div>`;
  h += '<div class="fields">' + sp.fields.map(([k, lbl, u]) => `<div class="fld"><span class="k">${esc(lbl)}</span>${numIn('q', `data-k="${k}"`, q.f[k] ?? '', '')}<span class="u">${u}</span></div>`).join('') + '</div>';
  h += `<div class="note" id="qnote"></div><div class="btns"><button class="btn ghost" data-act="quickCancel">${q.edit ? 'Отмена' : '← Назад'}</button><button class="btn pri" id="qbuild" data-act="quickBuild">${q.edit ? 'Перестроить ✓' : 'Построить ✓'}</button></div></div>`;
  return h; }
function updateSheet0() { const nn = $('#qnote'); if (!nn) return; const poly = quickPoly(), b = $('#qbuild'); if (b) b.disabled = !poly;
  if (!poly) { nn.textContent = 'Введите размеры, чертёж появится сверху'; return; } const st = polyStats(poly); nn.textContent = `Площадь ${fmt2(st.area)} м² · периметр ${fmt2(st.perim)} м`; }
function quickBuild() { const poly = quickPoly(); if (!poly) return toast('Введите размеры', true); const q = S.quick;
  S.origin = q.kind === 'rect' ? { kind: 'rect' } : { kind: 'oval', mode: q.mode, f: { ...q.f } };
  S.base = poly; if (!q.edit) { S.ops = []; S.redoOps = []; S.m = null; S.hist2 = []; S.redo2 = []; } S.quick = null; S.stage = 3; S.sel = null; S.op = null; blurActive(); rebuild(); render(); }
function renderChrome() { const names = ['Контур', 'Размеры', 'Правка'], quickShape = S.origin && S.origin.kind !== 'poly';
  $('#stages').innerHTML = S.stage === 0 ? '' : S.stage === 3 && quickShape ? '<span class="pill on"><b>✓</b>Правка</span>' : names.map((nm, k) => `<span class="pill ${k + 1 === S.stage ? 'on' : k + 1 < S.stage ? 'done' : ''}"><b>${k + 1}</b>${nm}</span>`).join('');
  $('#hint').textContent = S.stage === 0 ? (S.quick ? 'Чертёж появится по мере ввода размеров' : 'Выберите способ построения') : S.stage === 1 ? (S.sk.pts.length ? 'Следующий угол по порядку обхода, стены по сетке. Замкнуть — тап по A' : 'Тап по экрану ставит первый угол A') : S.stage === 2 ? 'Тап по стене — ввести длину. Тап по углу — прямой, свободный или градусы' : 'Тап по углу или стене — редактировать';
  $('#hint').style.display = S.stage === 1 && S.sk.pts.length > 5 ? 'none' : '';
  $('#sub').textContent = S.stage === 0 || S.stage === 1 ? '' : `${S.stage === 2 ? S.m.n : S.poly.v.length} углов`;
  $('#bUndo').disabled = S.stage === 0 ? true : S.stage === 1 ? !S.sk.pts.length : S.stage === 2 ? !S.hist2.length : !S.ops.length; $('#bRedo').disabled = S.stage === 2 ? !S.redo2.length : !(S.stage === 3 && S.redoOps.length);
  $('#bNew').style.visibility = S.stage === 0 && !S.quick ? 'hidden' : ''; $('.zoom').style.display = S.stage === 0 ? 'none' : ''; }
function save() { }
function render() { if (S.stage !== lastStage) { Z = { k: 1, dx: 0, dy: 0 }; lastStage = S.stage; sheetKey = ''; } renderChrome(); renderCanvas(); renderSheet(); save();
  if (S.focusReq) { const el = sheet.querySelector(S.focusReq); S.focusReq = null; if (el) { focusIn(el); el.scrollIntoView({ block: 'nearest' });
    S.hot = el.dataset.in === 'side' ? { t: 's', i: +el.dataset.i } : el.dataset.in === 'diag' ? { t: 'd', k: +el.dataset.k } : null; renderCanvas(); } } }
function commit() { render(); }
const onResize = () => renderCanvas(); window.addEventListener('resize', onResize);
let vvFit = null;
if (window.visualViewport) { const vv = window.visualViewport, app = $('#app'); vvFit = () => { if (window.innerWidth < 640) { app.style.height = vv.height + 'px'; app.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ''; } else { app.style.height = ''; app.style.transform = ''; } renderCanvas(); }; vv.addEventListener('resize', vvFit); vv.addEventListener('scroll', vvFit); }
document.fonts && document.fonts.ready.then(() => { if (alive) renderCanvas(); });
// правка готового контура: сразу этап «Правка» с переданными вершинами (метры)
if (opts.initial && Array.isArray(opts.initial.verts) && opts.initial.verts.length >= 3) { S.base = { v: opts.initial.verts.map(([x, y]) => ({ x, y, fillet: null, arc: null })) }; S.origin = { kind: 'poly' }; S.stage = 3; S.ops = []; rebuild(); }
render();
return { destroy() { alive = false; window.removeEventListener('resize', onResize); if (vvFit && window.visualViewport) { window.visualViewport.removeEventListener('resize', vvFit); window.visualViewport.removeEventListener('scroll', vvFit); } clearTimeout(applyT); root.innerHTML = ''; } };
}
