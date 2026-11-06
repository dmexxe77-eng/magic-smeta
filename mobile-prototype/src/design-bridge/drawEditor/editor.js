// Редактор ручного построения потолка: контур → размеры → правка, быстрые фигуры.
// Копия построителя для страниц дизайна и онлайн-версии: развивается отдельно от основной версии (внутренние вырезы и т. п.).
// Перенесён из HTML-прототипа: императивный DOM внутри переданного корневого элемента.
import { L,TAU,wrap,hyp,sub,add,mul,dot,cross,norm,perp,clone,cm,fmt2,turnAt,shoelace,windOf,interiorDeg,outNormal,lineX,segX,inside,isInteriorDiag,W_ANG,toPts,flat,buildCons,conRes,resid,jac,solveLin,sq,lm,rankOf,rowFor,estScale,analyze,alignPts,makeModel,solveModel,ptsOf,filletInfo,arcInfo,flatten,perimeterOf,polyStats,sideLen,holesOf,flattenHoles,opHole,opHoleDelete,withHole,checkHoles,bboxOf,bakeModel,checkFillets,opDelete,opAddPoint,opShift,opLength,opFillet,opArc,opBump,rectPoly,circumR,ovalPoly,DEG,W_PRIOR,NEED } from './geometry.js';
import { APPEARANCES, drawDimension, drawVertex } from './canvas-appearance.js';
import { filletLimit } from './geometry.js';
import { operationGuide, operationFieldHelp, operationDescription } from '../../components/builders/operation-guide.js';
import { measurementToolbar } from '../../components/builders/measurement-tools.js';
import { rulerCandidate, adjustRulerCandidate, RULER_UNITS_PER_METRE } from './sketch-ruler.js';
import { rulerEdgeVelocity, clipRulerPointer } from './ruler-edge-pan.js';
import { rulerWorkView, fitRulerView } from './ruler-work-view.js';

const icon = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${({ back: '<path d="m14 6-6 6 6 6"/>', undo: '<path d="M3 10a9 9 0 1 1 2.4 8.1M3 4v6h6"/>', redo: '<path d="M21 10a9 9 0 1 0-2.4 8.1M21 4v6h-6"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', rotate: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>', align: '<path d="M4 19h16M7 15l5-10 5 10"/>' })[name] || ''}</svg>`;
const TEMPLATE = `<div class="app" id="app">
  <div class="top">
    <button class="ib" id="bBack" title="Назад" aria-label="Назад к помещению">${icon('back')}</button>
    <div class="top-title"><h1 id="title">Чертёж</h1><span class="sub" id="sub"></span></div>
    <button class="ib" id="bUndo" title="Отменить" aria-label="Отменить последнее действие">${icon('undo')}</button>
    <button class="ib" id="bRedo" title="Повторить" aria-label="Повторить действие">${icon('redo')}</button>
    <button class="ib text" id="bNew">Заново</button>
  </div>
  <nav class="stages" id="stages" aria-label="Этапы построения"></nav>
  <div class="cv-wrap" id="cvw">
    <svg id="cv" xmlns="http://www.w3.org/2000/svg" aria-label="Холст чертежа помещения"></svg>
    <div class="canvas-looks" id="canvasLooks" role="group" aria-label="Оформление чертежа"></div>
    <div class="canvas-meta" id="canvasMeta"></div>
    <div class="measure-tools" id="measureTools" hidden></div>
    <div class="zoom"><button id="zIn" title="Крупнее" aria-label="Увеличить чертёж">${icon('plus')}</button><button id="zOut" title="Мельче" aria-label="Уменьшить чертёж">${icon('minus')}</button><button id="zFit" class="fit" title="Вписать" aria-label="Показать весь чертёж">${icon('fit')}</button></div>
    <button class="view-toggle" id="viewToggle" type="button" aria-expanded="false" hidden>${icon('fit')}<span>Вид</span></button>
    <div class="view-panel" id="viewPanel" hidden></div>
    <div class="start" id="start" hidden></div>
    <div class="hint" id="hint"></div>
    <div class="toast" id="toast"></div>
  </div>
  <div class="sheet" id="sheet"></div>
  <div class="input-accessory" id="inputAccessory" hidden></div>
</div>`;

/** Mount into root. embedded keeps desktop controls in a side inspector; hideAppearance removes comparison controls. Returns { destroy, resize }. */
export function createDrawEditor(root, opts = {}) {
root.innerHTML = TEMPLATE;
const $ = s => root.querySelector(s);
const MOBILE = !!opts.mobileWorkflow && !opts.embedded;
$('#app').classList.toggle('mobile-workflow', MOBILE);
let alive = true;
function finish() { if (!S.poly || (MOBILE && S.toolPick)) return; const st = polyStats(S.poly), F = flatten(S.poly, 12);
  const x0 = Math.min(...F.map(p => p.x)), y0 = Math.min(...F.map(p => p.y)), r2 = v => Math.round(v * 1000) / 1000;
  const draw = clone({ base: S.base, ops: S.ops, origin: S.origin, m: S.m ? { n: S.m.n, wind: S.m.wind, prior: S.m.prior, vert: S.m.vert, sides: S.m.sides, diags: S.m.diags } : null });
  const holes = flattenHoles(S.poly, 12).map(H => H.map(p => [r2(p.x - x0), r2(p.y - y0)]));
  if (opts.onFinish) opts.onFinish({ name: (S.roomName || '').trim() || opts.roomName || 'Помещение', verts: F.map(p => [r2(p.x - x0), r2(p.y - y0)]), holes, area: Math.round(st.area * 100) / 100, perim: Math.round(st.perim * 100) / 100, draw }); }
// ───────── state & canvas ─────────
const FRESH = () => ({ stage: 0, sk: { pts: [], mode: 'grid', saved: null, entryMode: 'rough', measuredSides: [], candidate: null }, m: null, base: null, ops: [], redoOps: [], poly: null, sel: null, op: null, pick: null, toolPick: null, hist2: [], redo2: [], hot: null, focusReq: null, sess: 0, quick: null, origin: null, roomName: opts.roomName || 'Помещение', tab2: 'walls', tab3: 'walls', dpick: null, fields: { side: 0, diag: 0, ang: 0 }, toolsOpen: false, viewOpen: false });
const S = FRESH();
let canvasLook = opts.canvasLook === 'classic' || Object.hasOwn(APPEARANCES, opts.canvasLook) ? opts.canvasLook : 'technical';
const canvasVars = new Set(Object.values(APPEARANCES).flatMap(look => Object.keys(look.vars)));
function applyCanvasLook() {
  const canvas = $('#cvw'), appearance = APPEARANCES[canvasLook];
  canvas.dataset.look = canvasLook;
  for (const key of canvasVars) canvas.style.removeProperty(key);
  if (appearance && !(MOBILE && S.stage === 0 && !S.quick)) for (const [key, value] of Object.entries(appearance.vars)) canvas.style.setProperty(key, value);
}
$('#canvasLooks').addEventListener('click', event => {
  const button = event.target.closest('[data-look]');
  if (!button || (button.dataset.look !== 'classic' && !Object.hasOwn(APPEARANCES, button.dataset.look))) return;
  canvasLook = button.dataset.look;
  applyCanvasLook();
  renderChrome();
  renderCanvas();
});
let VT = { s: 1, tx: 0, ty: 0 }, Z = { k: 1, dx: 0, dy: 0 }, lastStage = 0, lastQuick = '';
let rulerCameraPending = null;
const svg = $('#cv'), NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
let viewAngle = 0, focusPan = null, panPending = false, alignmentKey = null, alignmentTurns = 0;
const rotate = (p, angle) => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) });
const cameraAngle = () => MOBILE && S.stage >= 2 ? viewAngle : 0;
const toScreenVector = p => rotate(p, cameraAngle());
const toS = p => { const q = rotate(p, cameraAngle()); return { x: (q.x * VT.s + VT.tx) * Z.k + Z.dx, y: (q.y * VT.s + VT.ty) * Z.k + Z.dy }; };
const fromS = q => rotate({ x: ((q.x - Z.dx) / Z.k - VT.tx) / VT.s, y: ((q.y - Z.dy) / Z.k - VT.ty) / VT.s }, -cameraAngle());
const clampK = k => Math.min(64, Math.max(MOBILE && S.stage === 1 ? Math.min(.001, Z.k) : .5, k));
function zoomAt(f, c) { focusPan = null; panPending = false; const k = clampK(Z.k * f), r = k / Z.k; Z = { k, dx: c.x - (c.x - Z.dx) * r, dy: c.y - (c.y - Z.dy) * r }; renderCanvas(); }
function fitView(pts) { const W = Math.max(1, svg.clientWidth), fullH = Math.max(1, svg.clientHeight), H = Math.max(1, fullH - (!MOBILE && S.stage === 2 ? Math.min(96, fullH * .3) : 0)), pad = Math.min(62, W * .16, H * .18), caption = Math.min(36, H * .12); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  pts.map(p => rotate(p, cameraAngle())).forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
  const w = Math.max(x1 - x0, 1e-6), h = Math.max(y1 - y0, 1e-6), s = Math.min(Math.max(1, W - 2 * pad) / w, Math.max(1, H - 2 * pad - caption) / h);
  VT = { s, tx: (W - w * s) / 2 - x0 * s, ty: (H - h * s) / 2 - y0 * s + caption / 2 }; }
const holeBase = (poly, h) => { if (!poly) return 0; let b = poly.v.length; const hs = holesOf(poly); for (let k = 0; k < h && k < hs.length; k++) b += hs[k].v.length; return b; };
const HL = (h, i) => L(holeBase(S.poly, h) + i);
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

function dimension(group, a, b, normal, label, active, automatic, i, { holeIndex, points } = {}) {
  let anchor;
  if (canvasLook === 'technical' && points && points.length > 2) {
    const middle = (points.length - 1) / 2, before = Math.floor(middle), after = Math.ceil(middle);
    anchor = { center: mul(add(points[before], points[after]), .5),
      tangent: sub(points[Math.min(points.length - 1, after + 1)], points[Math.max(0, before - 1)]) };
  } else if (canvasLook === 'technical' && points && points.length === 2) { [a, b] = points; }
  const box = drawDimension({ group, a, b, normal, label, active, automatic, anchor, look: canvasLook, scale: 1, inside: holeIndex != null,
    bounds: { width: svg.clientWidth, height: svg.clientHeight, top: MOBILE ? 12 : 54, bottom: MOBILE ? 12 : 32 } });
  const hit = { x: box.center.x - box.width / 2 - 3, y: box.center.y - box.height / 2 - 4, width: box.width + 6, height: box.height + 8, fill: 'transparent', 'data-hit': 's', 'data-i': i };
  if (holeIndex != null) hit['data-h'] = holeIndex;
  group.appendChild(el('rect', hit));
}
function closureGapInfo() {
  const m = S.m, tag = S.origin?.closure;
  if (!MOBILE || tag?.kind !== 'skew' || !m || tag.n !== m.n || !m.sol || m.sol.length !== m.n) return null;
  const first = m.sol[0], last = m.sol[m.n - 1], dx = Math.abs(last.x - first.x), dy = Math.abs(last.y - first.y);
  const gap = Math.min(dx, dy) * 100;
  if (!Number.isFinite(gap) || gap < .05) return null;
  const number = value => String(Math.round(value * 10) / 10).replace('.', ',');
  return { gap, gapText: number(gap), angleText: number(Math.atan2(Math.min(dx, dy), Math.max(dx, dy)) * DEG), edge: L(m.n - 1) + L(0) };
}
function updateCanvasMeta() {
  const meta = $('#canvasMeta');
  const measured = S.stage === 2 && S.m?.status.missing === 0 ? { v: S.m.sol } : null;
  const preview = S.stage === 3 ? S.poly : measured || (S.quick ? quickPoly() : null);
  const showStats = MOBILE && !!preview;
  meta.hidden = MOBILE && !showStats;
  meta.classList.toggle('with-stats', showStats);
  if (showStats) { const stats = polyStats(preview), closure = S.stage === 3 ? closureGapInfo() : null;
    meta.innerHTML = `<span>Площадь <b>${fmt2(stats.area)}</b> м²</span><span>Периметр <b>${fmt2(stats.perim)}</b> м</span>${closure ? `<span class="closure-warning" title="Исходный контур: отклонение замыкающей стороны ${closure.angleText}°">Погрешность замыкания: ${closure.gapText} см</span>` : ''}`; }
  else meta.textContent = S.stage === 2 ? `${S.m.n} ${plural(S.m.n, 'угол', 'угла', 'углов')}` : S.stage === 3 ? `${S.poly.v.length} ${plural(S.poly.v.length, 'угол', 'угла', 'углов')}` : '';
}
function renderCanvas() { updateCanvasMeta(); while (svg.firstChild) svg.removeChild(svg.firstChild); const g = el('g', {}); svg.appendChild(g);
  const appearance = APPEARANCES[canvasLook], strokeWidth = appearance ? appearance.strokeWidth : 2;
  const LS = Z.k >= 20 ? 0.6 : Z.k >= 8 ? 0.7 : Z.k >= 3 ? 0.85 : 1; // при увеличении буквы и подписи мельче, чтобы не закрывать мелкие выступы
  if (S.stage === 1) { const P = S.sk.pts; VT = { s: 1, tx: 0, ty: 0 }; const Q = P.map(toS);
    if (P.length > 1) g.appendChild(el('path', { d: pathOf(Q, false), fill: 'none', stroke: 'var(--ink)', 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' }));
    if (P.length > 2) g.appendChild(el('path', { d: pathOf([Q[Q.length - 1], Q[0]], false), fill: 'none', stroke: 'var(--ink3)', 'stroke-width': 1.5, 'stroke-dasharray': '4 5' }));
    Q.forEach((p, i) => { if (i === 0 && P.length > 2) g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 16, style: 'fill:var(--laser-soft)' }));
      const o = P.length > 2 ? dirOut(P, i) : { x: 0, y: -1 };
      if (appearance) drawVertex({ group: g, point: p, outward: o, label: L(i), picked: i === 0 && P.length > 2, look: canvasLook });
      else { g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 4, style: 'fill:var(--paper);stroke:' + (i === 0 && P.length > 2 ? 'var(--laser)' : 'var(--ink)') + ';stroke-width:1.5' }));
        g.appendChild(text(add(p, mul(o, 17 * LS)), L(i), { size: 13 * LS, w: 600 })); }
      g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 24, fill: 'transparent', 'data-hit': 'v', 'data-i': i })); });
    if (MOBILE && S.sk.entryMode === 'ruler' && P.length) {
      for (let i = 0; i < P.length - 1; i++) if (S.sk.measuredSides[i] != null) { const a = toS(P[i]), b = toS(P[i + 1]); g.appendChild(text(add(mul(add(a, b), .5), { x: 0, y: -13 }), S.sk.measuredSides[i] + ' см', { size: 12, color: 'var(--pri)' })); }
      const candidate = S.sk.candidate, last = toS(P[P.length - 1]);
      if (candidate) { const point = toS(candidate.point);
        if (candidate.snappedX || candidate.snappedY) { const anchor = toS(P[0]); g.appendChild(el('path', { d: pathOf([anchor, point], false), fill: 'none', stroke: 'var(--pri)', 'stroke-width': 1, 'stroke-dasharray': '3 5', opacity: .65 }));
          if (candidate.closes) g.appendChild(el('circle', { cx: anchor.x, cy: anchor.y, r: 10, fill: 'none', stroke: 'var(--pri)', 'stroke-width': 1.5 })); }
        g.appendChild(el('path', { d: pathOf([last, point], false), fill: 'none', stroke: 'var(--pri)', 'stroke-width': 3, 'stroke-dasharray': '5 3' })); g.appendChild(el('circle', { cx: point.x, cy: point.y, r: 5, fill: 'var(--pri)' })); g.appendChild(text(add(mul(add(last, point), .5), { x: 0, y: -17 }), candidate.cm + ' см', { size: 14, color: 'var(--pri)' })); }
      g.appendChild(el('circle', { cx: last.x, cy: last.y, r: 13, fill: 'var(--laser-soft)', stroke: 'var(--pri)', 'stroke-width': 2, 'aria-hidden': 'true' }));
      g.appendChild(text(last, '+', { size: 17, color: 'var(--pri)' }));
      g.appendChild(el('circle', { cx: last.x, cy: last.y, r: 24, fill: 'transparent', 'data-hit': 'extend', 'data-i': P.length - 1, 'aria-label': 'Потяните, чтобы задать следующую сторону' }));
    }
    return; }
  const poly = S.stage === 3 ? S.poly : S.stage === 2 ? { v: S.m.sol.map(p => ({ x: p.x, y: p.y, fillet: null, arc: null })) } : quickPoly(); if (!poly) return;
  const P = ptsOf(poly), n = P.length, F = flatten(poly); fitView(F);
  if (MOBILE && panPending && focusPan && document.activeElement?.matches?.('input.in')) {
    panPending = false; const p = rotate(focusPan, cameraAngle()), bounds = F.map(point => { const q = rotate(point, cameraAngle()); return { x: (q.x * VT.s + VT.tx) * Z.k, y: (q.y * VT.s + VT.ty) * Z.k }; });
    const fitTranslation = (desired, values, size) => { const low = Math.min(...values), high = Math.max(...values), margin = Math.min(28, size * .1); return high - low <= size - 2 * margin ? Math.max(margin - low, Math.min(size - margin - high, desired)) : desired; };
    Z.dx = fitTranslation((svg.clientWidth / 2 - (p.x * VT.s + VT.tx) * Z.k) * .35, bounds.map(point => point.x), svg.clientWidth);
    Z.dy = fitTranslation((svg.clientHeight / 2 - (p.y * VT.s + VT.ty) * Z.k) * .35, bounds.map(point => point.y), svg.clientHeight);
  }
  const HF = flattenHoles(poly);
  g.appendChild(el('path', { class: 'drawing-outline', d: [F, ...HF].map(pts => pathOf(pts.map(toS), true)).join(' '), 'fill-rule': 'evenodd', style: `fill:var(--fill);stroke:var(--ink);stroke-width:${strokeWidth};stroke-linejoin:round` }));
  HF.forEach(H => g.appendChild(el('path', { d: pathOf(H.map(toS), true), style: `fill:var(--paper);stroke:var(--ink);stroke-width:${strokeWidth};stroke-linejoin:round` })));
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
      const midpoint = mul(add(a, b), .5), label = d.cm != null ? String(d.cm) : '?';
      g.appendChild(text(midpoint, label, { size: 12, color: on ? 'var(--laser)' : 'var(--ink2)' }));
      g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'transparent', 'stroke-width': 26, 'data-hit': 'd', 'data-i': k }));
      const width = Math.max(38, label.length * 8 + 12);
      g.appendChild(el('rect', { x: midpoint.x - width / 2, y: midpoint.y - 15, width, height: 30, fill: 'transparent', 'data-hit': 'd', 'data-i': k, 'aria-label': `Изменить диагональ ${L(d.i)}${L(d.j)}, сантиметров` })); }); }
  // sides
  for (let i = 0; i < n; i++) { const sp = sidePts(poly, i).map(toS), j = (i + 1) % n;
    const on = (S.stage === 2 && S.hot && S.hot.t === 's' && S.hot.i === i) || (S.stage === 3 && S.sel && S.sel.t === 's' && S.sel.h == null && S.sel.i === i);
    if (on) g.appendChild(el('path', { d: pathOf(sp, false), style: 'fill:none;stroke:var(--laser);stroke-width:5;stroke-linecap:round' }));
    const mid = toS(mul(add(P[i], P[j]), .5)), nO = toScreenVector(outNormal(P, i)), lp = add(mid, mul(nO, 14 * LS)), sl = hyp(sp[0], sp[sp.length - 1]);
    const ai = arcInfo(poly, i);
    let str, color = 'var(--ink)', italic = false;
    if (S.stage === 2) { const v = S.m.sides[i];
      if (v != null) str = String(v);
      else {
        const calculated = !MOBILE || S.m.status.missing === 0;
        str = calculated ? (MOBILE ? '≈' : '') + cm(hyp(P[i], P[j])) : '?';
        color = 'var(--ink3)'; italic = calculated;
      }
      if (on) color = 'var(--laser)'; }
    else { str = String(cm(hyp(P[i], P[j]))); if (on) color = 'var(--laser)'; }
    if (ai && canvasLook === 'technical') str = '⌒ ' + cm(ai.len);
    if (on || sl >= (appearance ? 52 : 26)) {
      if (appearance) dimension(g, toS(P[i]), toS(P[j]), nO, str, on, italic, i, { points: sp });
      else g.appendChild(text(lp, str, { size: 12 * LS, w: 600, color, italic }));
    } // подпись короткой стены появится при увеличении
    if (ai && canvasLook !== 'technical') g.appendChild(text(add(toS(ai.apex), mul(nO, ai.dir === 'out' ? 14 : -14)), '⌒ ' + cm(ai.len), { size: 11 * LS, color: 'var(--ink2)' }));
    g.appendChild(el('path', { d: pathOf(sp, false), fill: 'none', stroke: 'transparent', 'stroke-width': 30, 'data-hit': 's', 'data-i': i })); }
  // vertices
  const wind = windOf(P);
  for (let i = 0; i < n; i++) { const p = toS(P[i]), fi = filletInfo(poly, i), o = toScreenVector(dirOut(P, i));
    const on = S.sel && S.sel.t === 'v' && S.sel.h == null && S.sel.i === i, isPick = (S.pick && S.pick.a === i) || (S.dpick && S.dpick.a === i);
    const nb = P.length, slA = hyp(toS(P[(i - 1 + nb) % nb]), p), slB = hyp(toS(P[(i + 1) % nb]), p), roomy = Math.min(slA, slB) >= 30;
    // значок прямого угла ставим, только если угол и правда вышел прямым: иначе честно пишем градусы
    const vkd = S.stage === 2 ? interiorDeg(P, i, wind) : 0, orthoOk = S.stage === 2 && S.m.vert[i].kind === 'ortho' && Math.min(Math.abs(vkd - 90), Math.abs(vkd - 270)) < 1;
    if (orthoOk && roomy) { const n_ = P.length, u1 = toScreenVector(norm(sub(P[(i - 1 + n_) % n_], P[i]))), u2 = toScreenVector(norm(sub(P[(i + 1) % n_], P[i]))), s = 9 * LS;
      const a = add(p, mul(u1, s)), b = add(p, mul(add(u1, u2), s)), c = add(p, mul(u2, s));
      g.appendChild(el('path', { d: pathOf([a, b, c], false), style: 'fill:none;stroke:var(--ink2);stroke-width:1.2' })); }
    if (appearance) drawVertex({ group: g, point: p, outward: o, label: L(i), active: on, picked: isPick, look: canvasLook, fillet: !!fi });
    else { if (fi) g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 3, style: 'fill:none;stroke:var(--ink3);stroke-width:1.2;stroke-dasharray:2 2' }));
      else g.appendChild(el('circle', { cx: p.x, cy: p.y, r: on || isPick ? 6 : 3.5 * LS, style: `fill:${on || isPick ? 'var(--laser)' : 'var(--paper)'};stroke:${on || isPick ? 'var(--laser)' : 'var(--ink)'};stroke-width:1.5` }));
      g.appendChild(text(add(p, mul(o, 18 * LS)), L(i), { size: 13 * LS, w: 600, color: on || isPick ? 'var(--laser)' : 'var(--ink)' })); }
    if (fi) g.appendChild(text(add(toS(fi.C), mul(o, -2)), 'R' + cm(fi.R), { size: 10 * LS, color: 'var(--ink2)' }));
    g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 24, fill: 'transparent', 'data-hit': 'v', 'data-i': i }));
    if (S.stage === 2 && roomy) { const vt = S.m.vert[i], assigned = vt.kind !== 'free' && vt.deg != null, position = add(p, mul(o, -30 * LS));
      const closingAngle = (i === 0 || i === n - 1) && !!closureGapInfo();
      const degrees = closingAngle ? String(Math.round(vkd * 10) / 10).replace('.', ',') : Math.round(vkd);
      const label = assigned ? String(vt.deg).replace('.', ',') + '°' : S.m.status.missing === 0 ? '≈' + degrees + '°' : '?°';
      const active = S.sel?.t === 'v' && S.sel.i === i;
      g.appendChild(text(position, label, { size: 11 * LS, color: active ? 'var(--laser)' : assigned ? 'var(--ink)' : 'var(--ink2)', italic: !assigned }));
      const width = Math.max(38, label.length * 7 + 10);
      g.appendChild(el('rect', { x: position.x - width / 2, y: position.y - 15, width, height: 30, fill: 'transparent', 'data-hit': 'ang', 'data-i': i, 'aria-label': `Изменить угол ${L(i)}, градусов` }));
    } }
  // вырезы (только на этапе правки): стены и углы выбираются так же, как у помещения
  if (S.stage === 3) holesOf(poly).forEach((hole, h) => { const HP = ptsOf(hole), hn = HP.length;
    for (let i = 0; i < hn; i++) { const sp = sidePts(hole, i).map(toS), j = (i + 1) % hn, on = S.sel && S.sel.t === 's' && S.sel.h === h && S.sel.i === i;
      if (on) g.appendChild(el('path', { d: pathOf(sp, false), style: 'fill:none;stroke:var(--laser);stroke-width:5;stroke-linecap:round' }));
      const mid = toS(mul(add(HP[i], HP[j]), .5)), nO = toScreenVector(outNormal(HP, i)), sl = hyp(sp[0], sp[sp.length - 1]);
      const ai = arcInfo(hole, i);
      if (on || sl >= (appearance ? 52 : 26)) {
        const label = ai && canvasLook === 'technical' ? '⌒ ' + cm(ai.len) : String(cm(hyp(HP[i], HP[j])));
        if (appearance) dimension(g, toS(HP[i]), toS(HP[j]), nO, label, on, false, i, { holeIndex: h, points: sp });
        else g.appendChild(text(add(mid, mul(nO, 12 * LS)), label, { size: 11 * LS, w: 600, color: on ? 'var(--laser)' : 'var(--ink2)' }));
      }
      if (ai && canvasLook !== 'technical') g.appendChild(text(add(toS(ai.apex), mul(nO, ai.dir === 'out' ? 12 : -12)), '⌒ ' + cm(ai.len), { size: 10 * LS, color: 'var(--ink2)' }));
      g.appendChild(el('path', { d: pathOf(sp, false), fill: 'none', stroke: 'transparent', 'stroke-width': 26, 'data-hit': 's', 'data-i': i, 'data-h': h })); }
    for (let i = 0; i < hn; i++) { const p = toS(HP[i]), fi = filletInfo(hole, i), o = toScreenVector(dirOut(HP, i)), on = S.sel && S.sel.t === 'v' && S.sel.h === h && S.sel.i === i;
      if (appearance) drawVertex({ group: g, point: p, outward: o, label: HL(h, i), active: on, look: canvasLook, fillet: !!fi });
      else { if (fi) g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 3, style: 'fill:none;stroke:var(--ink3);stroke-width:1.2;stroke-dasharray:2 2' }));
        else g.appendChild(el('circle', { cx: p.x, cy: p.y, r: on ? 6 : 3 * LS, style: `fill:${on ? 'var(--laser)' : 'var(--paper)'};stroke:${on ? 'var(--laser)' : 'var(--ink)'};stroke-width:1.5` }));
        g.appendChild(text(add(p, mul(o, 15 * LS)), HL(h, i), { size: 12 * LS, w: 600, color: on ? 'var(--laser)' : 'var(--ink2)' })); }
      if (fi) g.appendChild(text(add(toS(fi.C), mul(o, -2)), 'R' + cm(fi.R), { size: 10 * LS, color: 'var(--ink2)' }));
      g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 20, fill: 'transparent', 'data-hit': 'v', 'data-i': i, 'data-h': h })); } }); }

// ───────── pointer ─────────
let ptr = null, pinch = null; const pointers = new Map();
let rulerEdgeFrame = null, rulerEdgeTime = null;
const rulerBounds = () => ({ width: svg.clientWidth, height: svg.clientHeight });
const rulerSketch = () => MOBILE && S.stage === 1 && S.sk.entryMode === 'ruler';
function queueRulerCamera(precision = false) {
  if (rulerSketch() && S.sk.pts.length) rulerCameraPending = precision || rulerCameraPending === 'work' ? 'work' : 'visible';
}
function applyRulerCamera() {
  if (!rulerCameraPending) return;
  if (!rulerSketch() || !S.sk.pts.length) { rulerCameraPending = null; return; }
  if (pointers.size || pinch || S.sk.candidate || !(svg.clientWidth > 0) || !(svg.clientHeight > 0)) return;
  const precision = rulerCameraPending === 'work'; rulerCameraPending = null;
  Z = rulerWorkView(Z, S.sk.pts[S.sk.pts.length - 1], rulerBounds(), { precision });
}
function fitSketchOverview() {
  rulerCameraPending = null;
  const view = MOBILE && S.stage === 1 ? fitRulerView(S.sk.pts, rulerBounds()) : null;
  Z = view || { k: 1, dx: 0, dy: 0 };
}
const rulerTarget = point => clipRulerPointer(point, rulerBounds());
const sketchRulerCandidate = (origin, target) => {
  const anchor = S.sk.pts[0], scale = Z.k * VT.s;
  if (S.sk.pts.length >= 3 && hyp(target, anchor) * scale <= 7 && hyp(origin, anchor) > 1e-6) {
    const length = hyp(origin, anchor);
    return { point: { ...anchor }, cm: Math.max(1, Math.round(length / RULER_UNITS_PER_METRE * 100)), direction: { x: (anchor.x - origin.x) / length, y: (anchor.y - origin.y) / length }, snappedX: true, snappedY: true, closes: true };
  }
  return rulerCandidate(origin, target, S.sk.mode, { anchor: S.sk.pts.length >= 2 ? anchor : null, screenScale: scale, snapPx: 7 });
};
const rulerDragActive = () => alive && MOBILE && S.stage === 1 && S.sk.entryMode === 'ruler' && S.sk.pts.length > 0 && !!S.sk.candidate && ptr?.ruler && ptr.moved && pointers.size === 1 && !pinch;
function stopRulerEdgePan() { if (rulerEdgeFrame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rulerEdgeFrame); rulerEdgeFrame = null; rulerEdgeTime = null; }
function renderRulerDrag() {
  if (S.sk.candidate && $('#rulerPreview')) { const value = $('#rulerLength'); if (value) value.textContent = S.sk.candidate.cm; sheetKey = viewKey(); renderCanvas(); }
  else render();
}
function rulerEdgeTick(time) {
  rulerEdgeFrame = null;
  if (!Number.isFinite(time) || !rulerDragActive()) { rulerEdgeTime = null; return; }
  const velocity = rulerEdgeVelocity({ x: ptr.x, y: ptr.y }, rulerBounds(), S.sk.candidate?.direction, S.sk.mode);
  if (!velocity.x && !velocity.y) { rulerEdgeTime = null; return; }
  const elapsed = rulerEdgeTime == null ? 0 : Math.max(0, Math.min(32, time - rulerEdgeTime)); rulerEdgeTime = time;
  if (elapsed) { const speed = Math.min(2.5, Math.max(1, Z.k)); Z.dx += velocity.x * speed * elapsed / 1000; Z.dy += velocity.y * speed * elapsed / 1000;
    S.sk.candidate = sketchRulerCandidate(S.sk.pts[S.sk.pts.length - 1], fromS(rulerTarget({ x: ptr.x, y: ptr.y }))); renderRulerDrag(); }
  rulerEdgeFrame = requestAnimationFrame(rulerEdgeTick);
}
function startRulerEdgePan() {
  if (!rulerDragActive() || rulerEdgeFrame != null) return;
  const velocity = rulerEdgeVelocity({ x: ptr.x, y: ptr.y }, rulerBounds(), S.sk.candidate?.direction, S.sk.mode);
  if (velocity.x || velocity.y) rulerEdgeFrame = requestAnimationFrame(rulerEdgeTick);
}
function xy(e) { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
const midOf = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const gestureOff = () => S.stage === 0 && !S.quick; // экран выбора способа: холст пуст, жесты ни к чему
svg.addEventListener('pointerdown', e => { if (gestureOff()) return; focusPan = null; panPending = false; const p = xy(e); pointers.set(e.pointerId, p); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* синтетические события без активного указателя */ } e.preventDefault();
  if (pointers.size === 2) { stopRulerEdgePan(); if (MOBILE && S.stage === 1) { S.sk.candidate = null; sheetKey = ''; renderSheet(); renderCanvas(); } const [a, b] = [...pointers.values()]; pinch = { d0: Math.max(10, hyp(a, b)), m0: midOf(a, b), Z0: { ...Z } }; ptr = null; return; }
  if (pointers.size > 2 || pinch) return;
  const h = e.target.closest ? e.target.closest('[data-hit]') : null;
  ptr = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false, hit: h ? { t: h.dataset.hit, i: +h.dataset.i, j: +h.dataset.j, h: h.dataset.h != null ? +h.dataset.h : undefined } : null, pan: !h, ruler: MOBILE && S.stage === 1 && S.sk.entryMode === 'ruler' && S.sk.pts.length > 0 && (!h || h.dataset.hit === 'extend'), Z0: { ...Z } }; });
svg.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return; const p = xy(e); pointers.set(e.pointerId, p);
  if (pinch) { if (pointers.size !== 2) return; const [a, b] = [...pointers.values()], k = clampK(pinch.Z0.k * hyp(a, b) / pinch.d0), m = midOf(a, b);
    const bx = (pinch.m0.x - pinch.Z0.dx) / pinch.Z0.k, by = (pinch.m0.y - pinch.Z0.dy) / pinch.Z0.k; Z = { k, dx: m.x - bx * k, dy: m.y - by * k }; renderCanvas(); return; }
  if (!ptr || e.pointerId !== ptr.id) return; ptr.x = p.x; ptr.y = p.y; if (Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > 6) ptr.moved = true; if (!ptr.moved) return;
  if (ptr.ruler) { S.sk.candidate = sketchRulerCandidate(S.sk.pts[S.sk.pts.length - 1], fromS(rulerTarget(p))); renderRulerDrag(); startRulerEdgePan(); }
  else if (ptr.hit && S.stage === 1 && ptr.hit.t === 'v') { if (MOBILE && S.sk.entryMode === 'ruler') { if (!ptr.warned) { ptr.warned = true; toast('Чтобы изменить отмеренную сторону, отмените последний угол или введите длину на следующем шаге.'); } return; }
    if (MOBILE) { S.sk.measuredSides[ptr.hit.i] = null; S.sk.measuredSides[(ptr.hit.i - 1 + S.sk.pts.length) % S.sk.pts.length] = null; }
    S.sk.pts[ptr.hit.i] = fromS(p); renderCanvas(); }
  else if (ptr.pan) { Z = { k: ptr.Z0.k, dx: ptr.Z0.dx + p.x - ptr.x0, dy: ptr.Z0.dy + p.y - ptr.y0 }; renderCanvas(); } });
function pointerEnd(e) { stopRulerEdgePan(); pointers.delete(e.pointerId); if (!pointers.size) pinch = null; if (pinch) return;
  if (ptr && e.pointerId === ptr.id) { const p = ptr; ptr = null; if (p.ruler && p.moved) { S.sk.candidate = sketchRulerCandidate(S.sk.pts[S.sk.pts.length - 1], fromS(rulerTarget(xy(e)))); return confirmRulerPoint(); } if (!(p.pan && p.moved)) onTap(p); }
  if (rulerCameraPending) { applyRulerCamera(); renderCanvas(); } }
function pointerCancel(e) { stopRulerEdgePan(); pointers.delete(e.pointerId); if (ptr?.id === e.pointerId) ptr = null; pinch = null; if (MOBILE && S.stage === 1) { S.sk.candidate = null; render(); } }
svg.addEventListener('pointerup', pointerEnd); svg.addEventListener('pointercancel', pointerCancel);
$('#zIn').addEventListener('click', () => zoomAt(1.5, { x: svg.clientWidth / 2, y: svg.clientHeight / 2 }));
$('#zOut').addEventListener('click', () => zoomAt(1 / 1.5, { x: svg.clientWidth / 2, y: svg.clientHeight / 2 }));
$('#zFit').addEventListener('click', () => { fitSketchOverview(); renderCanvas(); });
$('#stages').addEventListener('click', e => { const b = e.target.closest('[data-stage]'); if (!b) return; const t = +b.dataset.stage; if (t === S.stage) return;
  flushApply();
  if (t === 1) return act('back1', {}); if (t === 2 && S.stage === 3) return act('back2', {});
  if (t === 2 && S.stage === 1) return closeSketch();
  if (t === 3 && S.stage === 1 && S.poly && sketchUnchanged()) { if (S.m.status.missing) return toast('Сначала введите размеры: ' + statusInfo().h, true); return act('done', {}); }
  if (t === 3 && S.stage === 2) { if (S.m.status.missing) return toast('Сначала введите размеры: ' + statusInfo().h, true); return act('done', {}); } });
$('#measureTools').addEventListener('click', e => { const button = e.target.closest('[data-act]'); if (button && $('#measureTools').contains(button)) act(button.dataset.act, button.dataset); });
// Куда ложится новая стена — по тому, как её нарисовали:
//  · явно косая (длиннее ~44 px на экране и дальше 22° от обеих осей) — остаётся как есть, близко к 45° прилипает к 45°;
//  · иначе по сетке: короткая стена всегда перпендикулярна предыдущей (мелкий выступ пальцем точно не нарисовать),
//    длинная — по ближайшей оси, продолжение прямой допускается.
function snapPt(p, prev, others, free, prev2) { const q = { x: p.x, y: p.y };
  others.forEach(o => { if (o === prev) return; if (Math.abs(q.x - o.x) < 10 / Z.k) q.x = o.x; if (Math.abs(q.y - o.y) < 10 / Z.k) q.y = o.y; }); // выравнивание по другим углам
  if (!prev) return q;
  const dx = q.x - prev.x, dy = q.y - prev.y, len = Math.hypot(dx, dy) * Z.k, devH = Math.atan2(Math.abs(dy), Math.abs(dx)) * DEG, devV = 90 - devH;
  if (free || (!MOBILE && len >= 44 && devH >= 22 && devV >= 22)) { const ang = Math.atan2(dy, dx) * DEG, n45 = Math.round(ang / 45) * 45;
    if (Math.abs(wrap((ang - n45) / DEG) * DEG) < 5) { const L = Math.hypot(dx, dy); q.x = prev.x + Math.cos(n45 / DEG) * L; q.y = prev.y + Math.sin(n45 / DEG) * L; } return q; }
  const pv = prev2 && Math.abs(prev.x - prev2.x) < 1e-6, ph = prev2 && Math.abs(prev.y - prev2.y) < 1e-6;
  let horiz; if (pv) horiz = len < 44 ? true : devH <= 45; else if (ph) horiz = len < 44 ? false : devH <= 45; else horiz = Math.abs(dx) >= Math.abs(dy);
  if (horiz) q.y = prev.y; else q.x = prev.x; return q; }
function onTap(p) { const P = S.sk.pts; if (S.stage === 0) return;
  if (S.stage === 1) {
    if (MOBILE && S.sk.entryMode === 'ruler') {
      if (p.hit?.t === 'extend') return;
      if (p.hit?.t === 'v') { if (!p.moved && p.hit.i === 0 && P.length >= 3) closeSketch(); return; }
      if (p.moved) return;
      if (!P.length) { P.push(fromS({ x: p.x, y: p.y })); queueRulerCamera(); return render(); }
      S.sk.candidate = sketchRulerCandidate(P[P.length - 1], fromS(rulerTarget({ x: p.x, y: p.y }))); return confirmRulerPoint();
    }
    if (p.hit) { const i = p.hit.i; if (p.moved) { const n = P.length; P[i] = snapPt(P[i], P[(i - 1 + n) % n], P.filter((_, k) => k !== i), S.sk.mode === 'free'); commit(); }
      else if (i === 0 && P.length >= 3) closeSketch(); return; }
    if (p.moved) return; if (P.length >= 200) return toast('Слишком много точек', true);
    const q = snapPt(fromS({ x: p.x, y: p.y }), P[P.length - 1], P, S.sk.mode === 'free', P[P.length - 2]); if (P.some(o => hyp(o, q) < 14 / Z.k)) return; if (MOBILE && P.length) S.sk.measuredSides[P.length - 1] = null; P.push(q); commit(); return; }
  if (S.stage === 2) { const h = p.hit;
    if (S.pick) { if (h && (h.t === 'v' || h.t === 'ang')) pickVertex(h.i); return; }
    if (!h) { S.sel = null; blurActive(); render(); return; }
    if (h.t === 'v') { if (MOBILE) return selectMobileField('ang', h.i, false); S.sel = { t: 'v', i: h.i }; blurActive(); render(); }
    else if (h.t === 'ang') { S.sel = { t: 'v', i: h.i }; setVKind('deg'); }
    else if (h.t === 's') { S.sel = null; S.tab2 = 'walls'; if (MOBILE) S.fields.side = h.i; S.dpick = null; S.focusReq = `input[data-in="side"][data-i="${h.i}"]`; render(); }
    else if (h.t === 'd') { S.sel = null; S.tab2 = 'diags'; if (MOBILE) S.fields.diag = h.i; S.dpick = null; S.focusReq = `input[data-in="diag"][data-k="${h.i}"]`; render(); }
    else if (h.t === 'sug') addDiag(h.i, h.j); return; }
  if (S.stage === 3) selectEditTarget(p.hit); }
const sketchSignature = () => JSON.stringify([S.sk.mode, S.sk.pts, MOBILE ? S.sk.measuredSides : null]);
const sketchUnchanged = () => S.sk.saved != null && S.sk.saved === sketchSignature();
const skewClosingEdge = points => Math.abs(points[0].x - points[points.length - 1].x) > 1e-6 && Math.abs(points[0].y - points[points.length - 1].y) > 1e-6;
function closedSketchError(points) {
  if (points.length < 3 || !points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return 'Отметьте не менее трёх разных углов.';
  const onSegment = (point, a, b) => Math.abs(cross(sub(b, a), sub(point, a))) <= 1e-7 * Math.max(1, hyp(a, b)) && dot(sub(point, a), sub(point, b)) <= 1e-7;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (hyp(a, b) < 1e-6) return 'Сторона не может иметь нулевую длину.';
    const incoming = sub(a, points[(i - 1 + points.length) % points.length]), outgoing = sub(b, a);
    if (Math.abs(cross(incoming, outgoing)) <= 1e-7 * Math.max(1, Math.hypot(incoming.x, incoming.y) * Math.hypot(outgoing.x, outgoing.y)) && dot(incoming, outgoing) < 0) return 'Стороны накладываются друг на друга. Поправьте контур.';
    for (let j = i + 1; j < points.length; j++) {
      if (hyp(a, points[j]) < 1e-6) return 'Два угла совпадают. Поправьте контур.';
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      if (segX(a, b, c, d) || onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b)) return 'Замыкающая сторона пересекает контур. Поправьте углы.';
    }
  }
  return Math.abs(shoelace(points)) < 1e-6 ? 'Контур должен иметь площадь. Добавьте угол в другом направлении.' : '';
}
function gridSketchError(points, skew) {
  const winding = windOf(points);
  for (let index = 0; index < points.length; index++) {
    if (skew && (index === 0 || index === points.length - 1)) continue;
    const degrees = interiorDeg(points, index, winding);
    if (Math.min(Math.abs(degrees - 90), Math.abs(degrees - 270)) >= 1) return 'Внутри контура есть непрямой угол. Поправьте его или выберите диагонали и градусы.';
  }
  return '';
}
function closeSketch(closingCm = null) { const P = S.sk.pts; if (P.length < 3) return; if (MOBILE && S.sk.candidate) return toast('Сначала добавьте отмеренный угол или отмените текущую сторону.', true); const original = MOBILE ? clone(P) : null;
  if (S.m && sketchUnchanged()) { S.stage = 2; S.sel = null; S.op = null; return render(); }
  // Замыкание по сетке: у прямоугольного контура стены чередуются (горизонталь/вертикаль), число стен чётное.
  // Последняя стена и стена A→B на разных осях → замыкающая стена перпендикулярна обеим: ставим последнюю точку на ряд/колонку A.
  // На одной оси → нужен ещё один угол, добавляем точку X сами; если точка оказалась лишней (на прямой) — убираем её.
  const measuredDraft = MOBILE && S.sk.measuredSides.some(value => value != null);
  if (S.sk.mode !== 'free' && !(MOBILE && (S.sk.entryMode === 'ruler' || measuredDraft))) { const n = P.length, last = P[n - 1], prev = P[n - 2], A = P[0], B = P[1], eq = (a, b) => Math.abs(a - b) < 1e-6;
    const lastV = eq(last.x, prev.x), lastH = eq(last.y, prev.y), abH = eq(B.y, A.y), abV = eq(B.x, A.x);
    if (lastV && abV) last.y = A.y;
    else if (lastH && abH) last.x = A.x;
    else if (lastV && abH) { if (eq(last.x, A.x)) P.pop(); else if (eq(last.y, A.y)) P.shift(); else if (n < 200) P.push({ x: A.x, y: last.y }); }
    else if (lastH && abV) { if (eq(last.y, A.y)) P.pop(); else if (eq(last.x, A.x)) P.shift(); else if (n < 200) P.push({ x: last.x, y: A.y }); } }
  const skew = MOBILE && S.sk.mode !== 'free' && skewClosingEdge(P);
  if (MOBILE) { const error = closedSketchError(P) || (S.sk.mode !== 'free' ? gridSketchError(P, skew) : '');
    if (error) { P.splice(0, P.length, ...original); render(); return toast(error, true); } }
  S.m = makeModel(P, S.sk.mode);
  if (MOBILE) {
    if (skew) { S.m.vert[0] = { kind: 'free', deg: null }; S.m.vert[P.length - 1] = { kind: 'free', deg: null }; S.sk.measuredSides[P.length - 1] = Number.isFinite(closingCm) && closingCm > 0 ? closingCm : null; }
    S.m.sides = S.m.sides.map((_, i) => S.sk.measuredSides[i] ?? null);
    S.origin = { ...(S.origin || { kind: 'poly' }) }; if (skew) S.origin.closure = { kind: 'skew', n: S.m.n }; else delete S.origin.closure;
  }
  solveModel(S.m); S.sk.saved = sketchSignature(); S.base = null; S.poly = null; S.ops = []; S.redoOps = []; S.ghost = null; S.stage = 2; S.sel = null; S.hist2 = []; S.redo2 = []; S.tab2 = 'walls'; S.dpick = null; render();
  if (MOBILE && S.m.status.missing === 0) toast('Размеры определены. Проверьте их и переходите к готовому чертежу.');
  else if (MOBILE && S.m.status.empty.length === 0) toast('Длины сторон сохранены. Уточните форму диагональю или углом.');
  else if (S.sk.mode === 'free') toast('Углы не заданы: после длин понадобятся диагонали. Прямые можно отметить во вкладке «Углы»'); else if (S.m.vert.every(v => v.kind === 'ortho')) toast('Все углы прямые. Введите длины стен'); else toast('Углы без маркера — свободные. Их можно уточнить'); }
let toastT = null;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', 2600); }

// ───────── sheet: persistent DOM, native number inputs, in-place updates ─────────
const sheet = $('#sheet'); let sheetKey = '', applyT = null;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return (h > 10 && h < 20) ? c : m === 1 ? a : (m > 1 && m < 5) ? b : c; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const numIn = (name, extra, val, hint, label) => `<input class="in" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" aria-label="${esc(label || 'Размер в сантиметрах')}" data-in="${name}" ${extra} value="${esc(val ?? '')}" placeholder="${esc(hint ?? '')}">`;
const parseNum = (str, allowZero = false) => { const v = parseFloat(String(str).replace(',', '.')); return isFinite(v) && (v > 0 || (allowZero && v === 0)) ? v : null; };
function statusInfo() { const st = S.m.status, n = S.m.n;
  if (st.missing === 0) { const w = st.worst, a = w ? Math.abs(w.v) : 0, wn = st.worstAng, wa = wn ? Math.abs(wn.v) : 0;
    if (a > 3) return { cls: 'bad', h: `Не сходится: ${w.label} на ${a.toFixed(0)} см`, s: 'Проверьте это измерение или соседние с ним' };
    // длины держим точно, поэтому противоречие уходит в угол — говорим об этом прямо
    if (wa > 2 && wn) return { cls: wa > 6 ? 'bad' : 'warn', h: `Угол ${wn.label} вышел ${Math.round(wn.act)}° вместо ${Math.round(wn.deg)}°`,
      s: wn.auto ? 'Длины сохранены. Если угол точно прямой — проверьте соседние стены' : 'Длины сохранены. Проверьте этот угол или соседние измерения' };
    if (a > 1 || wa > 1) return { cls: 'warn', h: 'Фигура определена, размеры подогнаны', s: w ? `${w.label}: расхождение ${a.toFixed(1)} см` : `Угол ${wn.label}: расхождение ${wa.toFixed(1)}°` };
    const closure = closureGapInfo();
    if (closure) return { cls: 'warn', h: `Погрешность замыкания: ${closure.gapText} см`, s: `Сторона ${closure.edge} наклонена. Введённые длины сохранены.` };
    return { cls: 'ok', h: 'Фигура определена', s: st.empty.length ? 'Пустые стороны посчитаны автоматически' : 'Все размеры сходятся' }; }
  if (st.empty.length) return { cls: 'info', h: `Введите длины: осталось ${st.empty.length} из ${n}`, s: st.afterSides > 0 ? `Потом понадобится ещё ${st.afterSides}: диагональ или угол` : 'Длин сторон будет достаточно' };
  const sug = st.sug.diags.map(([i, j]) => 'диагональ ' + L(i) + '–' + L(j)); if (st.sug.angs.length) sug.push('угол ' + st.sug.angs.map(L).join(' / '));
  return { cls: 'warn', h: `Нужно ещё ${st.missing} ${plural(st.missing, 'измерение', 'измерения', 'измерений')}`, s: sug.length ? 'Например: ' + sug.join(' или ') : 'Добавьте диагональ или угол' }; }
function rulerEdgeError(originIndex, point, replaceLast = false, closing = false) {
  const points = S.sk.pts, existing = replaceLast ? points.slice(0, -1) : points;
  if (existing.some((vertex, index) => !(closing && index === 0) && hyp(vertex, point) < 1e-6)) return 'Этот угол уже есть. Для замыкания нажмите «Замкнуть контур».';
  if (originIndex > 0) {
    const incoming = sub(points[originIndex], points[originIndex - 1]), next = sub(point, points[originIndex]);
    const tolerance = 1e-7 * Math.max(1, Math.hypot(incoming.x, incoming.y) * Math.hypot(next.x, next.y));
    if (Math.abs(cross(incoming, next)) <= tolerance && dot(incoming, next) < 0) return 'Сторона накладывается на предыдущую. Выберите другое направление.';
  }
  const onSegment = (p, a, b) => Math.abs(cross(sub(b, a), sub(p, a))) < 1e-7 * Math.max(1, hyp(a, b)) && dot(sub(p, a), sub(p, b)) <= 1e-7;
  for (let index = closing ? 1 : 0; index < originIndex - 1; index++) { const a = points[originIndex], b = point, c = points[index], d = points[index + 1];
    if (segX(a, b, c, d) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d)) return 'Сторона пересекает контур. Выберите другое направление.'; }
  return '';
}
function confirmRulerPoint() {
  const candidate = S.sk.candidate, points = S.sk.pts;
  if (!candidate || !points.length) { render(); return; }
  if (candidate.closes && points.length >= 3) {
    const skew = S.sk.mode !== 'free' && skewClosingEdge(points);
    const error = rulerEdgeError(points.length - 1, candidate.point, false, true) || closedSketchError(points) || (S.sk.mode !== 'free' ? gridSketchError(points, skew) : '');
    S.sk.candidate = null;
    if (error) { render(); return toast(error, true); }
    const unchanged = !!S.m && sketchUnchanged();
    S.sk.measuredSides[points.length - 1] = candidate.cm;
    if (unchanged) {
      withSnap(() => { S.m.sides[points.length - 1] = candidate.cm; });
      solveModel(S.m); S.sk.saved = sketchSignature(); S.stage = 2; S.sel = null; S.op = null; S.pick = null; S.dpick = null; blurActive();
      return render();
    }
    return closeSketch(skew ? candidate.cm : null);
  }
  const error = points.length >= 200 ? 'Слишком много точек' : rulerEdgeError(points.length - 1, candidate.point);
  S.sk.candidate = null;
  if (error) { render(); return toast(error, true); }
  S.sk.measuredSides[points.length - 1] = candidate.cm;
  points.push({ ...candidate.point }); queueRulerCamera(true); render();
}
function adjustLastRulerSide(delta) {
  const points = S.sk.pts, index = points.length - 2, centimetres = S.sk.measuredSides[index];
  if (S.sk.candidate || index < 0 || !Number.isFinite(centimetres) || !Number.isFinite(delta)) return;
  const origin = points[index], endpoint = points[index + 1], length = hyp(origin, endpoint);
  if (length < 1e-6) return;
  const candidate = adjustRulerCandidate({ cm: centimetres, direction: { x: (endpoint.x - origin.x) / length, y: (endpoint.y - origin.y) / length } }, origin, delta);
  const error = rulerEdgeError(index, candidate.point, true);
  if (error) return toast(error, true);
  points[index + 1] = candidate.point; S.sk.measuredSides[index] = candidate.cm; queueRulerCamera(); render();
}
function mobileSketchSheet() {
  const n = S.sk.pts.length, ruler = S.sk.entryMode === 'ruler', candidate = S.sk.candidate;
  let h = `<div class="seg sketch-entry" aria-label="Ввод контура"><button class="${ruler ? '' : 'on'}" data-act="rulerMode" data-v="rough" aria-pressed="${!ruler}">Эскиз</button><button class="${ruler ? 'on' : ''}" data-act="rulerMode" data-v="ruler" aria-pressed="${ruler}">По размерам</button></div>`;
  h += `<div class="sketch-head"><div class="sketch-copy"><h3>${n ? ruler ? 'Потяните следующую сторону' : 'Отмечайте углы по порядку' : 'Отметьте первый угол'}</h3><p>${ruler ? n ? 'Потяните за плюс или по свободному холсту. Два пальца — масштаб и перемещение.' : 'Коснитесь холста. Затем тяните сторону до нужной длины.' : n >= 3 ? 'Нажмите A или замкните контур кнопкой.' : 'Примерная форма сейчас, точные размеры — следующим шагом.'}</p></div><span class="point-count">${n} ${plural(n, 'точка', 'точки', 'точек')}</span></div>`;
  const lastLength = S.sk.measuredSides[n - 2];
  if (ruler && n >= 1) {
    const measured = n >= 2 && Number.isFinite(lastLength), side = candidate || !measured ? L(n - 1) + L(n) : L(n - 2) + L(n - 1);
    h += `<div class="ruler-readout" ${candidate ? 'id="rulerPreview"' : ''} role="status"><span>Сторона ${side}</span><b><span id="rulerLength">${candidate ? candidate.cm : measured ? lastLength : '—'}</span> <small>см</small></b><div class="ruler-fine"><button class="btn ghost" data-act="rulerAdjust" data-delta="-1" aria-label="Уменьшить сторону на 1 сантиметр" ${candidate || !measured ? 'disabled' : ''}>${icon('minus')}1 см</button><button class="btn ghost" data-act="rulerAdjust" data-delta="1" aria-label="Увеличить сторону на 1 сантиметр" ${candidate || !measured ? 'disabled' : ''}>${icon('plus')}1 см</button></div></div>`;
  }
  h += `<div class="btns sketch-actions"><button class="btn ghost sketch-mode" data-act="sketchMode">${S.sk.mode === 'free' ? 'Диагонали / градусы' : 'Прямые углы'}</button><button class="btn pri" data-act="close" ${n >= 3 && !candidate ? '' : 'disabled'}>Замкнуть контур${icon('arrow')}</button></div>`;
  return h;
}

function sheet1() { const n = S.sk.pts.length;
  if (MOBILE) return mobileSketchSheet();
  return `<div class="sketch-head"><div class="sketch-copy"><h3>${n ? 'Обойдите комнату по углам' : 'Поставьте первый угол'}</h3><p>${n >= 3 ? 'Нажмите на A или замкните контур кнопкой.' : opts.embedded ? 'Нажимайте на холст в местах углов. Размеры введём после.' : 'Касайтесь холста в местах углов. Размеры введём после.'}</p></div><span class="point-count">${n} ${plural(n, 'точка', 'точки', 'точек')}</span></div>
  <div class="btns sketch-actions"><button class="btn ghost" data-act="home">Способ</button><button class="btn pri" data-act="close" ${n >= 3 ? '' : 'disabled'}>Замкнуть контур${icon('arrow')}</button></div>`; }
const vertexNote = vt => vt.kind === 'ortho' ? 'Держится ровно 90° или 270°. Снимите, если стена косая.' : vt.kind === 'free' ? 'Угол не задан: его определят длины, диагонали или градусы.' : 'Угол задан вручную, заменяет одну диагональ.';
function sheet2() { if (MOBILE) return mobileSheet2(); const m = S.m, n = m.n, tab = S.tab2 || 'walls';
  let h = `<div class="measure-progress"><div><b>Размеры комнаты</b><span id="measureProgress"></span></div><div class="measure-track"><span id="measureBar"></span></div></div><div class="status" id="st2"><span class="dot"></span><div id="st2t"></div></div>`;
  if (S.sel && S.sel.t === 'v') { const i = S.sel.i, vt = m.vert[i];
    h += `<div class="card"><h3><span class="m">${L(i)}</span> угол <small id="vcur"></small></h3>
    <div class="seg"><button class="${vt.kind === 'ortho' ? 'on' : ''}" data-act="vkind" data-k="ortho">Прямой</button><button class="${vt.kind === 'free' ? 'on' : ''}" data-act="vkind" data-k="free">Свободный</button><button class="${vt.kind === 'deg' ? 'on' : ''}" data-act="vkind" data-k="deg">Градусы</button></div>
    ${vt.kind === 'deg' ? `<div class="fld"><span class="k">Внутренний угол</span>${numIn('ang', `data-i="${i}"`, vt.deg ?? '', '', `Внутренний угол ${L(i)}, градусов`)}<span class="u">°</span></div>` : ''}
    <div class="note">${vertexNote(vt)}</div>
    <div class="btns"><button class="btn ghost" data-act="deselect">Закрыть</button></div></div>`; return h; }
  h += `<div class="seg tabs"><button class="${tab === 'walls' ? 'on' : ''}" data-act="tab2" data-v="walls">Стены</button><button class="${tab === 'diags' ? 'on' : ''}" data-act="tab2" data-v="diags">Диагонали${m.diags.length ? ' · ' + m.diags.length : ''}</button><button class="${tab === 'angles' ? 'on' : ''}" data-act="tab2" data-v="angles">Углы</button></div>`;
  const kbBtns = `<button class="next" data-act="nextField" type="button" aria-label="Следующий размер">Далее</button><button class="done" data-act="blur" type="button" title="Готово" aria-label="Завершить ввод размера">✓</button>`;
  if (tab === 'walls') { h += '<div class="rows">';
    for (let i = 0; i < n; i++) h += `<div class="row"><span class="lbl">${L(i)}${L((i + 1) % n)}</span>${numIn('side', `data-i="${i}"`, m.sides[i] ?? '', '', `Длина стены ${L(i)}${L((i + 1) % n)}, сантиметров`)}<span class="row-unit">см</span>${kbBtns}</div>`;
    h += '</div>'; }
  else if (tab === 'diags') { h += `<div class="note" id="dnote"></div>`;
    if (m.diags.length) { h += '<div class="sec">Введённые</div><div class="rows">';
      m.diags.forEach((d, k) => { h += `<div class="row"><span class="lbl">${L(d.i)}–${L(d.j)}</span>${numIn('diag', `data-k="${k}"`, d.cm ?? '', '', `Длина диагонали ${L(d.i)}${L(d.j)}, сантиметров`)}<span class="row-unit">см</span><button class="x" data-act="rmDiag" data-i="${k}" aria-label="Удалить диагональ ${L(d.i)}${L(d.j)}">✕</button>${kbBtns}</div>`; }); h += '</div>'; }
    h += `<div class="sec">Подсказка</div><div id="sugList" class="rows one"></div>`;
    h += `<div class="sec">Другая диагональ</div><div class="note">${S.dpick ? 'Первая вершина ' + L(S.dpick.a) + ' — теперь вторая' : 'Нажмите две вершины по буквам'}</div><div class="letters">`;
    for (let i = 0; i < n; i++) h += `<button class="lt ${S.dpick && S.dpick.a === i ? 'on' : ''}" data-act="dpk" data-i="${i}">${L(i)}</button>`;
    h += '</div>'; }
  else { h += '<div class="rows one">';
    for (let i = 0; i < n; i++) { const vt = m.vert[i];
      h += `<div class="row vrow"><span class="lbl">${L(i)}</span><span class="cur" data-cur="${i}"></span><div class="seg mini"><button class="${vt.kind === 'ortho' ? 'on' : ''}" data-act="vk" data-i="${i}" data-k="ortho" aria-label="Сделать угол ${L(i)} прямым">прямой</button><button class="${vt.kind === 'free' ? 'on' : ''}" data-act="vk" data-i="${i}" data-k="free" aria-label="Сделать угол ${L(i)} свободным">свободный</button><button class="${vt.kind === 'deg' ? 'on' : ''}" data-act="vk" data-i="${i}" data-k="deg" aria-label="Задать угол ${L(i)} в градусах">°</button></div>${vt.kind === 'deg' ? numIn('ang', `data-i="${i}"`, vt.deg ?? '', '', `Внутренний угол ${L(i)}, градусов`) + kbBtns : ''}</div>`; }
    h += '</div>'; }
  h += `<div class="btns"><button class="btn pri" id="doneBtn" data-act="done">К деталям ${icon('arrow')}</button></div>`;
  if (S.ops.length) h += `<div class="note">После перестроения заново применятся правки этапа 3: ${S.ops.map(opLabel).join(', ')}</div>`;
  return h; }
function mobileSheet2() {
  const m = S.m, tab = S.tab2 || 'walls', kind = tab === 'walls' ? 'side' : tab === 'diags' ? 'diag' : 'ang';
  const count = kind === 'diag' ? m.diags.length : m.n;
  S.fields[kind] = Math.max(0, Math.min(S.fields[kind] || 0, Math.max(0, count - 1)));
  const current = S.fields[kind], allOrtho = m.vert.every(v => v.kind === 'ortho');
  let h = '<div class="measurement-head"><b>Размеры потолка</b></div>';
  h += `<div class="seg measurement-tabs tabs"><button class="${tab === 'walls' ? 'on' : ''}" data-act="tab2" data-v="walls">Стороны</button><button class="${tab === 'diags' ? 'on' : ''}" data-act="tab2" data-v="diags">Диагонали${m.diags.length ? ' · ' + m.diags.length : ''}</button><button class="${tab === 'angles' ? 'on' : ''}" data-act="tab2" data-v="angles">Углы</button></div>`;
  h += '<div class="measurement-chips" aria-label="Выбор измерения">';
  for (let i = 0; i < count; i++) {
    const label = kind === 'side' ? L(i) + L((i + 1) % m.n) : kind === 'diag' ? L(m.diags[i].i) + '–' + L(m.diags[i].j) : L(i);
    h += `<button class="measurement-chip ${i === current ? 'on' : ''}" data-act="mobileField" data-kind="${kind}" data-i="${i}" aria-pressed="${i === current}">${label}</button>`;
  }
  if (kind === 'diag') h += `<button class="measurement-chip add-measurement" data-act="pickDiag">${icon('plus')}Добавить</button>`;
  h += '</div><div class="mobile-measurements rows one">';
  for (let i = 0; i < count; i++) {
    const active = i === current ? ' mobile-current' : '';
    if (kind === 'side') h += `<div class="row${active}"><span class="lbl">Сторона ${L(i)}${L((i + 1) % m.n)}</span>${numIn('side', `data-i="${i}"`, m.sides[i] ?? '', '', `Длина стены ${L(i)}${L((i + 1) % m.n)}, сантиметров`)}<span class="row-unit">см</span></div>`;
    if (kind === 'diag') { const d = m.diags[i]; h += `<div class="row${active}"><span class="lbl">Диагональ ${L(d.i)}–${L(d.j)}</span>${numIn('diag', `data-k="${i}"`, d.cm ?? '', '', `Длина диагонали ${L(d.i)}${L(d.j)}, сантиметров`)}<span class="row-unit">см</span><button class="x" data-act="rmDiag" data-i="${i}" aria-label="Удалить диагональ ${L(d.i)}${L(d.j)}">${icon('minus')}</button></div>`; }
    if (kind === 'ang') { const vt = m.vert[i]; h += `<div class="row vrow${active}"><span class="lbl">Угол ${L(i)}</span>${numIn('ang', `data-i="${i}"`, vt.deg ?? '', '', `Внутренний угол ${L(i)}, градусов`)}<span class="row-unit">°</span><button class="angle-ortho" data-act="vk" data-i="${i}" data-k="ortho">Прямой</button><button class="angle-free" data-act="vk" data-i="${i}" data-k="free" aria-label="Сделать угол ${L(i)} свободным">Сбросить</button></div>`; }
  }
  h += '</div>';
  if (!count) h += '<div class="measurement-empty">Нажмите «Добавить», затем две вершины на чертеже.</div>';
  if (kind === 'ang') h += `<div class="measurement-help">Внутренний угол: 90° — прямой, 270° — выступ. Можно нажать угол на чертеже.</div><button class="angle-mode-action" data-act="${allOrtho ? 'freeAngles' : 'allOrtho'}" aria-label="${allOrtho ? 'Перейти к диагоналям и градусам' : 'Сделать все углы прямыми'}">${allOrtho ? 'Сделать все углы свободными' : 'Сделать все углы прямыми'}</button>`;
  if (count) h += `<div class="mobile-input-nav"><button class="btn ghost" data-act="prevField" aria-label="Предыдущий размер">${icon('back')}Назад</button><span>${current + 1} из ${count}</span><button class="btn ghost" data-act="nextField" aria-label="Следующий размер">Далее${icon('arrow')}</button></div>`;
  h += '<div class="status measurement-status" id="st2" role="status"><span class="dot"></span><div id="st2t"></div></div><div class="mobile-done-row"><button class="btn pri" id="doneBtn" data-act="done">Готовый чертёж ' + icon('arrow') + '</button></div>';
  return h;
}
function measurementInputs(input) {
  const all = [...sheet.querySelectorAll('input.in')];
  return S.stage === 2 ? all.filter(el => el.dataset.in === input.dataset.in) : all;
}
function focusPoint(input) {
  if (!MOBILE) return null;
  const kind = input.dataset.in, i = +(input.dataset.i ?? input.dataset.k ?? 0);
  if (S.stage === 2 && S.m) {
    if (kind === 'side') return mul(add(S.m.sol[i], S.m.sol[(i + 1) % S.m.n]), .5);
    if (kind === 'diag') { const d = S.m.diags[i]; return d ? mul(add(S.m.sol[d.i], S.m.sol[d.j]), .5) : null; }
    if (kind === 'ang') return S.m.sol[i];
  }
  return null;
}
function currentMobileInput() { return sheet.querySelector('.mobile-current input.in') || sheet.querySelector('input.in'); }
function markMobileInput(input) {
  if (!MOBILE || !input) return;
  const kind = input.dataset.in, index = +(input.dataset.i ?? input.dataset.k ?? 0);
  focusPan = focusPoint(input); panPending = !!focusPan;
  if (S.stage === 2 && ['side', 'diag', 'ang'].includes(kind)) S.fields[kind] = index;
  sheet.querySelectorAll('.mobile-current').forEach(el => el.classList.remove('mobile-current'));
  const row = input.closest('.row') || input.closest('.fld');
  if (row) row.classList.add('mobile-current');
  sheet.querySelectorAll('.measurement-chip[data-kind]').forEach(el => { const on = el.dataset.kind === kind && +el.dataset.i === index; el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on)); });
}
function renderAccessory(input) {
  if (!MOBILE) return;
  const accessory = $('#inputAccessory'), list = measurementInputs(input), index = list.indexOf(input);
  const last = index >= list.length - 1, form = input.dataset.in === 'op' || input.dataset.in === 'q';
  if (form && last) { accessory.hidden = true; accessory.innerHTML = ''; return; }
  const nextLabel = last ? 'Готово' : 'Далее';
  const closeLabel = input.dataset.in === 'op' ? 'Схема' : 'Скрыть';
  accessory.hidden = false;
  accessory.innerHTML = `<button class="accessory-prev" data-act="prevField" aria-label="Предыдущий размер" ${index <= 0 ? 'disabled' : ''}>${icon('back')}</button><span class="accessory-progress">${index + 1} из ${list.length}</span><button class="accessory-next" data-act="nextField" aria-label="${last ? 'Завершить ввод размера' : 'Следующий размер'}">${nextLabel}${icon('arrow')}</button>${last ? '' : `<button class="accessory-done" data-act="blur" aria-label="${input.dataset.in === 'op' ? 'Закрыть клавиатуру и показать схему' : 'Скрыть клавиатуру'}">${closeLabel}</button>`}`;
}
function moveInput(input, delta) {
  flushApply();
  const list = measurementInputs(input), index = list.indexOf(input), next = list[index + delta];
  if (next) { focusIn(next); if (MOBILE) renderAccessory(next); }
  else if (delta > 0) { input.blur(); if (MOBILE) { setKb(false); $('#inputAccessory').hidden = true; } }
}
function selectMobileField(kind, index, focus) {
  if (!MOBILE || S.stage !== 2 || !S.m || !['side', 'diag', 'ang'].includes(kind)) return;
  const count = kind === 'diag' ? S.m.diags.length : S.m.n;
  if (!Number.isInteger(index) || index < 0 || index >= count) return;
  flushApply(); S.fields[kind] = index; S.tab2 = kind === 'side' ? 'walls' : kind === 'diag' ? 'diags' : 'angles'; S.sel = null; S.pick = null;
  const selector = `input[data-in="${kind}"][data-${kind === 'diag' ? 'k' : 'i'}="${index}"]`;
  if (focus) S.focusReq = selector; else blurActive();
  render();
}
function setAllAngles(ortho) {
  if (S.stage !== 2 || !S.m) return;
  flushApply(); const m = S.m;
  const degrees = m.sol.map((_, i) => interiorDeg(m.sol, i, m.wind) > 180 ? 270 : 90);
  if (ortho && (m.n % 2 || Math.abs(degrees.reduce((sum, d) => sum + d, 0) - 180 * (m.n - 2)) > 1)) return toast('Этот контур нельзя построить только с прямыми углами. Проверьте число и положение углов.', true);
  withSnap(() => { m.vert.forEach((vt, i) => { vt.kind = ortho ? 'ortho' : 'free'; vt.deg = ortho ? degrees[i] : null; vt.user = ortho; }); });
  solveModel(m); S.sel = null; S.pick = null; S.dpick = null; blurActive(); render();
  toast(ortho ? 'Все углы прямые. Размеры и диагонали сохранены.' : 'Углы свободные. Добавьте диагонали или градусы.');
}
function renderViewPanel() {
  const button = $('#viewToggle'), panel = $('#viewPanel'); button.hidden = S.stage === 0 && !S.quick;
  button.setAttribute('aria-expanded', String(S.viewOpen)); panel.hidden = !S.viewOpen;
  if (!S.viewOpen) return;
  const canRotate = S.stage >= 2;
  panel.innerHTML = `<div class="view-heading"><b>Вид чертежа</b><button data-act="viewToggle" aria-label="Закрыть настройки вида">${icon('minus')}</button></div>
    <div class="view-actions"><button data-act="viewFit">${icon('fit')}Вписать в экран</button><button data-act="viewAlign" title="Выровнять выбранную стену. Повторное нажатие поворачивает на 90°" ${canRotate ? '' : 'disabled'}>${icon('align')}Выровнять по сетке</button><small class="alignment-hint">Повторное нажатие — поворот на 90°</small></div>
    <div class="view-rotation"><div class="rotation-heading"><b>Поворот</b><output id="rotationValue" for="viewRotation">${rotationDegrees()}°</output></div>
      <div class="rotation-buttons"><button data-act="viewRotateLeft" aria-label="Повернуть влево на 5°" ${canRotate ? '' : 'disabled'}>${icon('rotate')}−5°</button><button data-act="viewRotateRight" aria-label="Повернуть вправо на 5°" ${canRotate ? '' : 'disabled'}>${icon('rotate')}+5°</button></div>
      <input id="viewRotation" type="range" min="-180" max="180" step="1" value="${rotationDegrees()}" aria-label="Поворот чертежа, градусов" ${canRotate ? '' : 'disabled'}><small>Ползунок — шаг 1°</small></div>
    <div class="view-zoom"><button data-act="viewZoomOut" aria-label="Уменьшить чертёж">${icon('minus')}</button><span>Масштаб</span><button data-act="viewZoomIn" aria-label="Увеличить чертёж">${icon('plus')}</button></div><p>Меняется только вид. Размеры сохраняются.</p>`;
}
function rotationDegrees() {
  const degrees = Math.round(viewAngle * DEG), normalized = ((degrees + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 && degrees > 0 ? 180 : normalized;
}
function updateRotationControls() {
  const range = $('#viewRotation'), value = $('#rotationValue');
  if (range) range.value = String(rotationDegrees());
  if (value) value.textContent = rotationDegrees() + '°';
}
function changeView(action, data = {}) {
  if (!MOBILE) return;
  focusPan = null; panPending = false;
  if (action === 'viewToggle') { S.viewOpen = !S.viewOpen; renderChrome(); return; }
  if (action === 'viewZoomIn' || action === 'viewZoomOut') return zoomAt(action === 'viewZoomIn' ? 1.3 : 1 / 1.3, { x: svg.clientWidth / 2, y: svg.clientHeight / 2 });
  if (action === 'viewFit') fitSketchOverview();
  else if (S.stage >= 2) {
    if (['viewRotateLeft', 'viewRotateRight', 'viewRotation'].includes(action)) alignmentKey = null;
    if (action === 'viewRotateLeft') viewAngle -= 5 / DEG;
    if (action === 'viewRotateRight') viewAngle += 5 / DEG;
    if (action === 'viewRotation') {
      const degrees = Number(data.degrees);
      if (!Number.isFinite(degrees) || degrees < -180 || degrees > 180) return;
      viewAngle = Math.round(degrees) / DEG;
    }
    if (action === 'viewAlign') {
      const poly = S.stage === 3 ? S.poly : { v: S.m.sol }, target = S.sel?.h != null ? holesOf(poly)[S.sel.h] : poly;
      const points = ptsOf(target), i = S.sel?.t === 's' ? S.sel.i : 0, a = points[i], b = points[(i + 1) % points.length];
      const key = JSON.stringify([S.stage, S.sel?.h ?? null, i, a.x, a.y, b.x, b.y]);
      alignmentTurns = alignmentKey === key ? (alignmentTurns + 1) % 4 : 0;
      alignmentKey = key;
      viewAngle = -Math.atan2(b.y - a.y, b.x - a.x) + alignmentTurns * Math.PI / 2;
    }
    Z = { k: Z.k, dx: 0, dy: 0 };
  }
  updateRotationControls();
  renderCanvas();
}

function updateSheet2() { const m = S.m, n = m.n, st = m.status, si = statusInfo(), box = $('#st2');
  const progress = $('#measureProgress'), bar = $('#measureBar'), count = m.sides.filter(v => v != null).length;
  if (progress) progress.textContent = `${count} из ${n} стен`; if (bar) bar.style.width = `${count / n * 100}%`;
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
    else if (kind === 'ang') { const vt = S.m.vert[+el.dataset.i]; vt.kind = 'deg'; vt.user = true; vt.deg = (v && v > 3 && v < 357 && Math.abs(v - 180) > 1) ? v : null; } }, sess);
  clearTimeout(applyT); applyT = setTimeout(flushApply, 500); }
function flushApply() { if (!applyT) return; clearTimeout(applyT); applyT = null; if (!S.m || S.stage !== 2) return; solveModel(S.m); renderCanvas(); updateSheet(); save(); }
// В режиме клавиатуры видна только активная строка: перед фокусом показываем строку нужного поля, иначе focus() не сработает
function focusIn(el) { if (!el) return; if (MOBILE) markMobileInput(el); const row = el.closest('.row'); if (row && sheet.classList.contains('kb')) { sheet.querySelectorAll('.row.active').forEach(r => r.classList.remove('active')); row.classList.add('active'); } el.focus(); if (el.select) el.select(); }
function onEnter(el) { if (MOBILE) return moveInput(el, 1); flushApply(); if (el.dataset.in === 'q') { const all = [...sheet.querySelectorAll('input[data-in="q"]')], k = all.indexOf(el); if (k < all.length - 1) focusIn(all[k + 1]); else quickBuild(); return; }
  if (el.dataset.in === 'op') { const all = [...sheet.querySelectorAll('input[data-in="op"]')], k = all.indexOf(el); if (k < all.length - 1) focusIn(all[k + 1]); else applyOp(); return; }
  const all = [...sheet.querySelectorAll('input.in')], k = all.indexOf(el); if (k >= 0 && k < all.length - 1) focusIn(all[k + 1]); else el.blur(); }
sheet.addEventListener('input', e => { if (e.target.matches && e.target.matches('input.in')) onInput(e.target); });
sheet.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('input.in')) { e.preventDefault(); onEnter(e.target); } });
// Последовательный ввод стен остаётся компактным; параметры операций вводятся в самой форме.
const COARSE = !opts.embedded && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let kbT = null;
function revealMobileFormInput() {
  if (!alive || !MOBILE) return;
  const input = document.activeElement;
  if (!input?.matches?.('input.in') || !['op', 'q'].includes(input.dataset.in) || ![...sheet.querySelectorAll('input.in')].includes(input)) return;
  (input.closest('.fld') || input).scrollIntoView?.({ block: 'nearest' });
}
function setKb(on) {
  const compact = on && (!MOBILE || S.stage === 2);
  sheet.classList.toggle('kb', compact); $('#app').classList.toggle('kb', compact);
  requestAnimationFrame(() => { if (!alive) return; renderCanvas(); revealMobileFormInput(); });
}
sheet.addEventListener('toggle', e => {
  if (MOBILE && S.op && e.target === $('#operationHelp')) {
    const opening = e.target.open && !S.op.helpOpen;
    S.op.helpOpen = !!e.target.open;
    if (opening) e.target.scrollIntoView?.({ block: 'nearest' });
  }
}, true);
sheet.addEventListener('focusin', e => { const el = e.target; if (!el.matches || !el.matches('input.in')) return; el.dataset.sess = ++S.sess; setTimeout(() => el.select(), 0);
  S.hot = el.dataset.in === 'side' ? { t: 's', i: +el.dataset.i } : el.dataset.in === 'diag' ? { t: 'd', k: +el.dataset.k } : null;
  const row = el.closest('.row'); clearTimeout(kbT); sheet.querySelectorAll('.row.active').forEach(r => r.classList.remove('active'));
  if (MOBILE) { markMobileInput(el); setKb(true); renderAccessory(el); } else if (row && COARSE) { row.classList.add('active'); setKb(true); } else renderCanvas(); });
sheet.addEventListener('focusout', e => { const el = e.target; if (!el.matches || !el.matches('input.in')) return; flushApply(); S.hot = null;
  clearTimeout(kbT); kbT = setTimeout(() => { const a = document.activeElement; if (a && a.matches && a.matches('input.in') && (MOBILE || a.closest('.row'))) return; sheet.querySelectorAll('.row.active').forEach(r => r.classList.remove('active')); setKb(false); if (MOBILE) $('#inputAccessory').hidden = true; }, 60); });
// кнопки «Далее» и «✓» не должны забирать фокус у поля, иначе клавиатура на телефоне закроется
// На iOS preventDefault на касании отменяет и click, поэтому действие выполняется прямо на pointerdown
let kbActAt = 0;
const kbBtn = e => e.target.closest && e.target.closest('[data-act="nextField"],[data-act="prevField"],[data-act="blur"]');
let formSubmitPending = false;
// Handle a focused phone form before keyboard dismissal can move its buttons.
sheet.addEventListener('pointerdown', e => {
  if (!alive || e.isPrimary === false) return;
  formSubmitPending = false;
  if (!MOBILE || (e.button != null && e.button !== 0)) return;
  const button = e.target.closest?.('[data-act="apply"],[data-act="quickBuild"],[data-act="cancel"],[data-act="quickCancel"]');
  const input = document.activeElement;
  if (!button || button.disabled || !input?.matches?.('input.in') || ![...sheet.querySelectorAll('input.in')].includes(input)) return;
  const action = button.dataset.act;
  if (!(input.dataset.in === 'op' && ['apply', 'cancel'].includes(action)) && !(input.dataset.in === 'q' && ['quickBuild', 'quickCancel'].includes(action))) return;
  e.preventDefault(); e.stopImmediatePropagation();
  formSubmitPending = true;
  act(action, button.dataset);
}, true);
sheet.addEventListener('click', e => {
  if (!formSubmitPending) return;
  formSubmitPending = false;
  if (e.detail === 0 && !e.pointerType) return;
  // A compatibility click can land on a different action after the form closes.
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
sheet.addEventListener('pointerdown', e => { const b = kbBtn(e); if (!b) return; e.preventDefault(); kbActAt = Date.now(); act(b.dataset.act, b.dataset); });
sheet.addEventListener('mousedown', e => { if (kbBtn(e)) e.preventDefault(); });
sheet.addEventListener('touchstart', e => { if (kbBtn(e)) e.preventDefault(); }, { passive: false });
const blurActive = () => { const a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); };
function addDiag(i, j) { if (i > j) [i, j] = [j, i]; const n = S.m.n; if (i === j || (i + 1) % n === j || (j + 1) % n === i) { render(); return toast('Это соседние вершины, тут сторона', true); }
  let k = S.m.diags.findIndex(d => d.i === i && d.j === j); if (k < 0) {
    if (!isInteriorDiag(S.m.sol, i, j)) { render(); return toast('Эта линия выходит за стены комнаты', true); }
    withSnap(() => S.m.diags.push({ i, j, cm: null })); k = S.m.diags.length - 1; }
  S.pick = null; S.sel = null; if (MOBILE) S.fields.diag = k; S.tab2 = 'diags'; S.dpick = null; S.focusReq = `input[data-in="diag"][data-k="${k}"]`; render(); }
function pickVertex(i) { const p = S.pick; if (p.mode === 'ang') { S.pick = null; S.sel = { t: 'v', i }; setVKind('deg'); return; }
  if (p.a == null) { p.a = i; render(); return; } if (p.a === i) return toast('Выберите другую вершину', true); addDiag(p.a, i); }
function setVKind(k) { return setVKindAt(S.sel.i, k); }
function setVKindAt(i, k) { const vt = S.m.vert[i];
  withSnap(() => { if (k === 'ortho') { const d = interiorDeg(S.m.sol, i, S.m.wind); vt.kind = 'ortho'; vt.deg = Math.abs(d - 270) < Math.abs(d - 90) ? 270 : 90; vt.user = true; }
    else if (k === 'free') { vt.kind = 'free'; vt.deg = null; vt.user = false; } else if (vt.kind !== 'deg') { vt.kind = 'deg'; vt.deg = null; vt.user = true; } });
  if (MOBILE) { S.fields.ang = i; S.tab2 = 'angles'; S.sel = null; } if (k === 'deg') S.focusReq = `input[data-in="ang"][data-i="${i}"]`; solveModel(S.m); render(); }

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
  hole: () => gsvg(`<rect x="3" y="4" width="34" height="20" rx="1" fill="var(--fill)" stroke="var(--ink)" stroke-width="1.6"/><rect x="14" y="10" width="12" height="8" rx="1" fill="var(--paper)" ${G_PRI}/><path d="M3 14 L14 14" ${G_OLD}/><path d="M20 4 L20 10" ${G_OLD}/>`),
  del: () => gsvg(`<path d="M6 24 L20 8 L34 24" ${G_OLD}/><path d="M6 24 L34 24" ${G_PRI}/><circle cx="6" cy="24" r="2.5" fill="var(--ink)"/><circle cx="34" cy="24" r="2.5" fill="var(--ink)"/><path d="M17 5 L23 11 M23 5 L17 11" fill="none" stroke="var(--bad)" stroke-width="1.8" stroke-linecap="round"/>`),
};
const MOBILE_TOOLS = {
  len: { label: 'Длина стены', target: 's', picture: () => GL.len('end') },
  shift: { label: 'Сдвиг стены', target: 's', picture: () => GL.shift('out') },
  bump: { label: 'Ниша / выступ', target: 's', picture: () => GL.bump('in') },
  arc: { label: 'Дуга', target: 's', picture: () => GL.arc('out') },
  add: { label: 'Точка на стене', target: 's', picture: () => GL.add('start') },
  fillet: { label: 'Скругление', target: 'v', picture: () => GL.fillet() },
};
function selectEditTarget(hit) {
  if (MOBILE && S.toolPick) {
    const tool = MOBILE_TOOLS[S.toolPick], target = hit && opTarget(hit.h);
    if (!hit || hit.t !== tool.target || !Number.isInteger(hit.i) || !target?.v[hit.i]) {
      toast(tool.target === 's' ? 'Выберите стену на чертеже или в списке' : 'Выберите угол на чертеже или в списке');
      return;
    }
    const kind = S.toolPick;
    S.sel = { t: hit.t, i: hit.i, h: hit.h };
    makeOp(kind, hit.i, hit.h);
    return render();
  }
  S.op = null;
  if (MOBILE && hit) S.toolsOpen = true;
  S.sel = hit && (hit.t === 'v' || hit.t === 's') ? { t: hit.t, i: hit.i, h: hit.h } : null;
  blurActive(); render();
}
function opPic(o) { const k = o.kind, sg = o.seg;
  return k === 'len' ? GL.len(sg.end) : k === 'add' ? GL.add(sg.from) : k === 'shift' ? GL.shift(sg.dir) : k === 'arc' ? GL.arc(sg.dir) : k === 'bump' ? GL.bump(sg.dir) : k === 'fillet' ? GL.fillet() : k === 'hole' ? GL.hole() : ''; }
function opTarget(h) { return h != null ? holesOf(S.poly)[h] : S.poly; }
function presentNumericForm(selector) {
  S.focusReq = MOBILE ? null : selector;
  if (MOBILE) { blurActive(); setKb(false); $('#inputAccessory').hidden = true; focusPan = null; panPending = false; }
}
function opGuideContext(o) { const T = opTarget(o.h), n = T.v.length, label = i => o.h != null ? HL(o.h, i) : L(i);
  return { a: label(o.i), b: label((o.i + 1) % n), inHole: o.h != null, lengthCm: sideLen(T, o.i) * 100 }; }
function makeOp(kind, i, h) { S.toolPick = null; const T = opTarget(h), inHole = h != null, n = T.v.length, A = inHole ? HL(h, i) : L(i), B = inHole ? HL(h, (i + 1) % n) : L((i + 1) % n), seg = {}, spec = { fields: [], segs: [] };
  if (kind === 'hole') { spec.title = 'Внутренний вырез'; const P = ptsOf(S.poly), wind = windOf(P);
    /* опорный угол — любой внутренний угол помещения; от наружного (270°) отступы ушли бы за стены */
    const corners = P.map((_, k) => k).filter(k => interiorDeg(P, k, wind) < 180).map(k => ['c' + k, L(k)]);
    spec.segs = [['c', corners, 'От какого угла отступать']]; seg.c = corners[0][0];
    S.op = { kind, i: 0, spec, seg, f: {} }; opFields(); presentNumericForm('input[data-in="op"][data-k="d1"]'); return; }
  if (kind === 'len') { spec.title = 'Длина стены ' + A + B; spec.segLabel = MOBILE ? '' : 'Какой угол сместить'; spec.fields = [['len', 'Новая длина', 'см']]; spec.segs = MOBILE ? [] : [['end', [['end', 'Угол ' + B], ['start', 'Угол ' + A]]]]; seg.end = 'end'; }
  if (kind === 'add') { spec.title = 'Точка на стене ' + A + B; spec.fields = [['d', 'Отступ от угла', 'см']]; spec.segs = [['from', [['start', 'от ' + A], ['end', 'от ' + B]]]]; seg.from = 'start'; }
  if (kind === 'shift') { spec.title = 'Сдвиг стены ' + A + B; spec.fields = [['d', 'Расстояние сдвига', 'см']]; spec.segs = [['dir', inHole ? [['out', 'Расширить вырез'], ['in', 'Сузить вырез']] : [['out', 'Наружу'], ['in', 'Внутрь']]]]; seg.dir = 'out'; }
  if (kind === 'arc') { spec.title = 'Дуга на стене ' + A + B; spec.segs = [['mode', [['h', 'Стрела'], ['s', 'Длина дуги']]], ['dir', [['out', 'Наружу'], ['in', 'Внутрь']]]]; seg.mode = 'h'; seg.dir = 'out';
    const a = T.v[i].arc; if (a) seg.dir = a.dir; }
  if (kind === 'bump') { spec.title = 'Выступ или ниша на ' + A + B; spec.fields = [['off', 'Отступ от угла', 'см'], ['w', 'Ширина', 'см'], ['dp', 'Глубина', 'см']];
    spec.segs = [['from', [['start', 'от ' + A], ['end', 'от ' + B]]], ['dir', inHole ? [['in', 'Внутрь выреза'], ['niche', 'В потолок']] : [['in', 'Выступ в комнату'], ['niche', 'Ниша в стену']]]]; seg.from = 'start'; seg.dir = 'in'; }
  if (kind === 'fillet') { spec.title = 'Скруглить угол ' + A; spec.fields = [['r', 'Радиус', 'см']]; }
  const f = {}; if (kind === 'len') f.len = String(cm(sideLen(T, i))); if (kind === 'fillet' && T.v[i].fillet) f.r = String(cm(T.v[i].fillet));
  if (kind === 'arc' && T.v[i].arc) f.h = String(cm(T.v[i].arc.h));
  S.op = { kind, i, h, spec, seg, f }; opFields(); presentNumericForm(`input[data-in="op"][data-k="${S.op.spec.fields[0][0]}"]`); }
/* стены, примыкающие к опорному углу выреза: следующая (A→B) и предыдущая (D→A), в буквах помещения */
function holeCorner(o) { const n = S.poly.v.length, i = +String(o.seg.c || 'c0').slice(1); return { i, next: L(i) + L((i + 1) % n), prev: L((i - 1 + n) % n) + L(i) }; }
function opFields() { const o = S.op; if (o.kind === 'arc') o.spec.fields = o.seg.mode === 'h' ? [['h', 'Стрела (высота дуги)', 'см']] : [['s', 'Длина дуги', 'см']];
  if (o.kind === 'hole') { const c = holeCorner(o); o.spec.fields = [['d1', 'От ' + L(c.i) + ' вдоль ' + c.next, 'см'], ['d2', 'От ' + L(c.i) + ' вдоль ' + c.prev, 'см'], ['w', 'Ширина (вдоль ' + c.next + ')', 'см'], ['hh', 'Высота (вдоль ' + c.prev + ')', 'см']]; } }
/* Схема выреза: помещение, опорный угол, две стрелки от него вдоль стен до первого угла выреза, сам вырез.
   Угол рисуем в той четверти, где он стоит в помещении, стрелки — по направлению его стен */
function holeScheme(o) { const c = holeCorner(o), P = ptsOf(S.poly), n = P.length, A = P[c.i], num = k => parseNum(o.f[k]), txt = k => (isFinite(num(k)) && num(k) > 0 ? cm(num(k) / 100) : '?');
  const u1 = norm(sub(P[(c.i + 1) % n], A)), u2 = norm(sub(P[(c.i - 1 + n) % n], A));
  const b = bboxOf(P), left = A.x - b.x0 <= b.x1 - A.x, top = A.y - b.y0 <= b.y1 - A.y;
  /* какая из двух стен угла идёт по горизонтали схемы */
  const nextHoriz = Math.abs(u1.x) >= Math.abs(u1.y);
  const R = { x: 24, y: 18, w: 172, h: 94 }, dh = 50, dv = 40, W = 54, Hh = 30;
  const cx0 = left ? R.x : R.x + R.w, cy0 = top ? R.y : R.y + R.h, sx = left ? 1 : -1, sy = top ? 1 : -1;
  const qx = cx0 + sx * dh, qy = cy0 + sy * dv, hx = left ? qx : qx - W, hy = top ? qy : qy - Hh;
  const hLabel = (nextHoriz ? c.next : c.prev) + ' ' + txt(nextHoriz ? 'd1' : 'd2'), vLabel = (nextHoriz ? c.prev : c.next) + ' ' + txt(nextHoriz ? 'd2' : 'd1');
  const T = (x, y, str, o2 = {}) => `<text x="${x}" y="${y}"${o2.rot ? ` transform="rotate(-90 ${x} ${y})"` : ''} text-anchor="${o2.a || 'middle'}" font-size="${o2.s || 10}" font-weight="${o2.w || 600}" fill="${o2.c || 'var(--pri)'}" font-family="var(--sans)">${esc(str)}</text>`;
  /* буквы углов: выбранный — ярко, его соседи по стенам — у концов этих стен, для четырёхугольника ещё и противоположный; серым */
  const cornerAt = (l, t) => ({ x: l ? R.x : R.x + R.w, y: t ? R.y : R.y + R.h, l, t });
  const label = (pt, str, hot) => T(pt.x + (pt.l ? -9 : 9), pt.y + (pt.t ? -6 : 13), str, { c: hot ? 'var(--laser)' : 'var(--ink3)', s: hot ? 11 : 10, w: hot ? 700 : 600 });
  const nextPt = nextHoriz ? cornerAt(!left, top) : cornerAt(left, !top), prevPt = nextHoriz ? cornerAt(left, !top) : cornerAt(!left, top);
  let cornerLabels = label(cornerAt(left, top), L(c.i), true) + label(nextPt, L((c.i + 1) % n)) + label(prevPt, L((c.i - 1 + n) % n));
  if (n === 4) cornerLabels += label(cornerAt(!left, !top), L((c.i + 2) % n));
  const tick = (x, y, vert) => (vert ? `<path d="M${x - 4} ${y} L${x + 4} ${y}" ${G_PRI}/>` : `<path d="M${x} ${y - 4} L${x} ${y + 4}" ${G_PRI}/>`);
  return `<svg class="scheme" viewBox="0 0 220 130" aria-hidden="true">
    <rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" rx="2" fill="var(--fill)" stroke="var(--ink)" stroke-width="2"/>
    <rect x="${hx}" y="${hy}" width="${W}" height="${Hh}" rx="1.5" fill="var(--paper)" stroke="var(--pri)" stroke-width="2"/>
    <path d="M${cx0} ${qy} L${qx} ${qy}" ${G_PRI}/>${tick(cx0, qy, false)}${tick(qx, qy, false)}${T((cx0 + qx) / 2, top ? qy - 5 : qy + 12, hLabel, { s: 9.5 })}
    <path d="M${qx} ${cy0} L${qx} ${qy}" ${G_PRI}/>${tick(qx, cy0, true)}${tick(qx, qy, true)}${T(qx + sx * 6, (cy0 + qy) / 2 + 3, vLabel, { s: 9.5, a: left ? 'start' : 'end' })}
    ${cornerLabels}
    <circle cx="${cx0}" cy="${cy0}" r="4" fill="var(--laser)"/>
    <circle cx="${qx}" cy="${qy}" r="3" fill="var(--pri)"/>
    ${T(hx + W / 2, hy + Hh / 2 + 3, txt('w') + ' × ' + txt('hh'), { c: 'var(--ink)', s: 9.5 })}
  </svg>`; }
function opNote() { const o = S.op, num = k => parseNum(o.f[k]) / 100, T = opTarget(o.h), inHole = o.h != null, NL = i => (inHole ? HL(o.h, i) : L(i));
  if (o.kind === 'hole') { const c = holeCorner(o); return `Первый угол выреза — на отступах от угла ${L(c.i)} вдоль стен ${c.next} и ${c.prev}. Стороны выреза параллельны этим стенам`; }
  if (o.kind === 'fillet') { const limit = filletLimit(T, o.i); if (!limit) return '';
    const maximum = String(limit.maxRadiusCm).replace('.', ','), r = num('r');
    return isFinite(r) && r > 0 ? `Касание на ${cm(r / Math.tan(limit.phi / 2))} см от угла · максимум R ${maximum} см` : `Угол ${Math.round(limit.phi * DEG)}° · максимум R ${maximum} см`; }
  if (o.kind === 'arc') { const c = sideLen(T, o.i); if (o.seg.mode === 'h') { const h = num('h'); return isFinite(h) && h > 0 ? `Хорда ${cm(c)} см · радиус ${cm(c * c / (8 * h) + h / 2)} см` : `Хорда (стена) ${cm(c)} см`; }
    return `Длина дуги должна быть больше ${cm(c)} см`; }
  if (o.kind === 'len') { const n = T.v.length, A = NL(o.i), B = NL((o.i + 1) % n), C = NL((o.i + 2) % n), Z = NL((o.i - 1 + n) % n), mv = o.seg.end === 'end';
    return `Сейчас ${cm(sideLen(T, o.i))} см. ${mv ? B : A} уедет вдоль стены, стена ${mv ? B + C : Z + A} сдвинется за ним параллельно. ${mv ? A : B} останется на месте`; }
  if (o.kind === 'add' || o.kind === 'bump') return `Длина стены ${cm(sideLen(T, o.i))} см`;
  if (o.kind === 'shift') return 'Соседние стены удлинятся или укоротятся'; return ''; }
function drawingFinish() {
  const opened = S.toolsOpen || !!S.sel || !!S.toolPick;
  const name = `<input class="inName" id="roomName" aria-label="Название помещения" value="${esc(S.roomName)}" placeholder="Например, кухня" maxlength="40">`;
  const save = `<button class="btn pri" data-act="finish" ${S.op ? 'disabled title="Сначала примените правку или вернитесь назад"' : ''}>${opts.initial ? 'Сохранить' : 'В расчёт'}${icon('arrow')}</button>`;
  if (MOBILE) {
    const edit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>`;
    return `<div class="drawing-finish mobile-drawing-finish">${name}<div class="finish-actions"><button class="btn mobile-tools-toggle" data-act="toggleTools" aria-expanded="${opened}">${opened ? icon('minus') : edit}${opened ? 'Свернуть' : 'Править'}</button>${save}</div></div>`;
  }
  return `<div class="drawing-finish"><label for="roomName">Название помещения</label><div class="finish-row">${name}${save}</div></div>`;
}
function sheet3() { if (MOBILE) {
  if (S.op || S.toolPick) return sheet3Content();
  const opened = S.toolsOpen || !!S.sel || !!S.toolPick;
  return `<div class="sheet-content mobile-tools-content" ${opened ? '' : 'hidden'}>${opened ? sheet3Content() : ''}</div>${drawingFinish()}`;
} return `<div class="sheet-content">${sheet3Content()}</div>${drawingFinish()}`; }
function mobileOperationMenu() {
  const oval = S.origin?.kind === 'oval';
  return `<div class="mobile-operation-menu"><div class="operation-menu-heading"><h3 class="operation-title">Что изменить?</h3>${oval ? '<button class="btn sm ghost" data-act="editQuick">Диаметры</button>' : ''}</div><div class="operation-menu-grid">${Object.entries(MOBILE_TOOLS).map(([kind, tool]) => `<button class="operation-menu-item" data-act="chooseTool" data-k="${kind}" aria-label="${tool.label}">${tool.picture()}<span>${tool.label}</span></button>`).join('')}<button class="operation-menu-item" data-act="hole">${GL.hole()}<span>Внутренний вырез</span></button></div></div>`;
}
function editTargetList(tab) {
  const poly = S.poly, n = poly.v.length, P = ptsOf(poly), wind = windOf(P);
  let h = `<div class="element-list" aria-label="${tab === 'walls' ? 'Выбор стены' : 'Выбор угла'}">`;
  for (let i = 0; i < n; i++) h += tab === 'walls'
    ? `<button class="element-chip" data-act="selectSide" data-i="${i}" aria-label="Изменить стену ${L(i)}${L((i + 1) % n)}, ${cm(sideLen(poly, i))} сантиметров"><b>${L(i)}${L((i + 1) % n)}</b><span>${cm(sideLen(poly, i))}<small>см</small></span></button>`
    : `<button class="element-chip" data-act="selectVertex" data-i="${i}" aria-label="Изменить угол ${L(i)}, ${Math.round(interiorDeg(P, i, wind))} градусов"><b>${L(i)}</b><span>${Math.round(interiorDeg(P, i, wind))}°</span></button>`;
  holesOf(poly).forEach((hole, holeIndex) => { const HP = ptsOf(hole), holeWind = windOf(HP);
    for (let i = 0; i < HP.length; i++) { const A = HL(holeIndex, i), B = HL(holeIndex, (i + 1) % HP.length);
      h += tab === 'walls'
        ? `<button class="element-chip" data-act="selectSide" data-i="${i}" data-h="${holeIndex}" aria-label="Изменить стену выреза ${A}${B}, ${cm(sideLen(hole, i))} сантиметров"><b>${A}${B}</b><span>${cm(sideLen(hole, i))}<small>см · вырез</small></span></button>`
        : `<button class="element-chip" data-act="selectVertex" data-i="${i}" data-h="${holeIndex}" aria-label="Изменить угол выреза ${A}, ${Math.round(interiorDeg(HP, i, holeWind))} градусов"><b>${A}</b><span>${Math.round(interiorDeg(HP, i, holeWind))}°<small>вырез</small></span></button>`;
    } });
  return h + '</div>';
}
function mobileToolPicker() {
  const tool = MOBILE_TOOLS[S.toolPick], walls = tool.target === 's';
  return `<div class="mobile-tool-pick"><div class="tool-pick-heading"><h3 class="operation-title">${esc(tool.label)}</h3><button class="context-back" data-act="cancelTool">${icon('back')}<span>Все действия</span></button></div><p class="tool-pick-help">${walls ? 'Выберите стену' : 'Выберите угол'} на чертеже или в списке</p>${editTargetList(walls ? 'walls' : 'angles')}</div>`;
}
function mobileOperationSheet() {
  const o = S.op, context = opGuideContext(o);
  const purpose = {
    hole: 'Выберите опорный угол, задайте отступы и размер выреза внутри потолка.',
    len: 'Задайте новую длину стены и выберите угол, который нужно переместить.',
    add: 'Добавьте точку на стене на заданном расстоянии от выбранного угла.',
    shift: 'Сдвиньте стену параллельно внутрь или наружу. Соседние стены подстроятся.',
    bump: 'Задайте отступ, ширину и глубину. Нулевой отступ начнёт выступ или нишу от угла.',
    arc: 'Выберите направление дуги и задайте её высоту или длину.',
    fillet: 'Задайте радиус скругления выбранного угла.',
  };
  const corner = o.kind === 'hole' ? holeCorner(o) : null;
  const labels = {
    bump: { off: 'Отступ', w: 'Ширина', dp: 'Глубина' },
    shift: { d: 'Сдвиг' }, add: { d: 'Отступ' },
    arc: { h: 'Высота дуги', s: 'Длина дуги' },
    hole: corner ? { d1: 'Отступ по ' + corner.next, d2: 'Отступ по ' + corner.prev, w: 'Ширина по ' + corner.next, hh: 'Высота по ' + corner.prev } : {},
  }[o.kind] || {};
  const holeHelp = corner ? {
    d1: `От угла ${L(corner.i)} вдоль стены ${corner.next} до ближайшего угла выреза.`,
    d2: `От угла ${L(corner.i)} вдоль стены ${corner.prev} до ближайшего угла выреза.`,
    w: `Размер выреза вдоль стены ${corner.next}.`, hh: `Размер выреза вдоль стены ${corner.prev}.`,
  } : {};
  const fields = o.spec.fields.map(([key, label, unit]) => ({ key, label, unit, help: operationFieldHelp(o, key, context) || holeHelp[key] || '' }));
  const titleNote = ['add', 'bump'].includes(o.kind), inlineNote = ['arc', 'fillet'].includes(o.kind);
  let h = `<div class="mobile-operation"><div class="operation-scroll"><div class="operation-heading"><h3 class="operation-title">${esc(o.spec.title)}</h3>${titleNote ? '<div class="note operation-note" id="opnote"></div>' : ''}</div><div class="operation-diagram">${o.kind === 'hole' ? holeScheme(o) : ''}<div id="opguide">${operationGuide(o, context)}</div></div><div class="operation-controls${o.spec.segs.length === 2 ? ' paired' : ''}">`;
  o.spec.segs.forEach(([name, options, label], index) => {
    const heading = label || (index === 0 ? o.spec.segLabel : '');
    h += `<div class="operation-setting">${heading ? `<div class="sec">${esc(heading)}</div>` : ''}<div class="seg${options.length > 4 ? ' wrap' : ''}">`;
    h += options.map(([value, text]) => {
      const compact = o.kind === 'bump' && name === 'dir' ? (o.h != null ? value === 'in' ? 'В вырез' : 'В потолок' : value === 'in' ? 'Выступ' : 'Ниша')
        : o.kind === 'arc' && name === 'mode' ? value === 'h' ? 'Высота' : 'Длина' : text;
      return `<button class="${o.seg[name] === value ? 'on' : ''}" data-act="seg" data-n="${name}" data-v="${value}" aria-label="${esc(compact === text ? text : compact + ': ' + text)}" aria-pressed="${o.seg[name] === value}">${esc(compact)}</button>`;
    }).join('');
    h += '</div></div>';
  });
  h += '</div><div class="fields operation-fields">';
  h += fields.map(({ key, label, unit, help }) => {
    const id = `op-field-${key}`;
    const visibleLabel = labels[key] || label, accessibleLabel = visibleLabel === label ? label : `${visibleLabel} (${label})`;
    return `<div class="fld"><label class="k" for="${id}">${esc(visibleLabel)}</label>${numIn('op', `id="${id}" data-k="${key}"${help ? ` aria-describedby="op-help-${key}"` : ''}`, o.f[key] ?? '', '', `${o.spec.title}: ${accessibleLabel}, ${unit === 'см' ? 'сантиметров' : unit}`)}<span class="u">${unit}</span></div>`;
  }).join('');
  h += `</div>${inlineNote ? '<div class="note operation-note" id="opnote"></div>' : ''}<details class="operation-help" id="operationHelp"${o.helpOpen ? ' open' : ''}><summary>Как измерить</summary><div class="operation-help-content"><p>${esc(operationDescription(o, context) || purpose[o.kind] || '')}</p>`;
  const helps = fields.filter(field => field.help);
  if (helps.length) h += '<dl>' + helps.map(({ key, label, help }) => `<div><dt>${esc(labels[key] || label)}</dt><dd class="operation-field-help" id="op-help-${key}">${esc(help)}</dd></div>`).join('') + '</dl>';
  h += `${inlineNote || titleNote ? '' : '<div class="note" id="opnote"></div>'}</div></details></div><div class="btns op-actions"><button class="btn ghost" data-act="cancel">Отмена</button><button class="btn laser" data-act="apply">Применить</button></div></div>`;
  return h;
}
function sheet3Content() { const poly = S.poly, n = poly.v.length, st = polyStats(poly);
  if (MOBILE && S.op) return mobileOperationSheet();
  if (MOBILE && S.toolPick) return mobileToolPicker();
  if (S.op) { const o = S.op; let h = `<div class="card op"><button class="context-back" data-act="cancel">${icon('back')}<span>${S.sel ? 'К инструментам' : 'К деталям'}</span></button><h3><span>${esc(o.spec.title)}</span>${opPic(o)}</h3>`;
    if (o.kind === 'hole') h += holeScheme(o);
    if (o.spec.segLabel) h += `<div class="sec">${esc(o.spec.segLabel)}</div>`;
    o.spec.segs.forEach(([name, options, label]) => { if (label) h += `<div class="sec">${esc(label)}</div>`; h += '<div class="seg' + (options.length > 4 ? ' wrap' : '') + '">' + options.map(([v, lbl]) => `<button class="${o.seg[name] === v ? 'on' : ''}" data-act="seg" data-n="${name}" data-v="${v}" aria-pressed="${o.seg[name] === v}">${esc(lbl)}</button>`).join('') + '</div>'; });
    const guideContext = opGuideContext(o);
    h += `<div id="opguide">${operationGuide(o, guideContext)}</div>`;
    h += '<div class="fields">' + o.spec.fields.map(([k, lbl, u]) => { const help = operationFieldHelp(o, k, guideContext);
      return `<div class="fld"><span class="k">${esc(lbl)}</span>${numIn('op', `data-k="${k}"${help ? ` aria-describedby="op-help-${k}"` : ''}`, o.f[k] ?? '', '', `${o.spec.title}: ${lbl}, ${u === 'см' ? 'сантиметров' : u}`)}<span class="u">${u}</span>${help ? `<small class="operation-field-help" id="op-help-${k}">${esc(help)}</small>` : ''}</div>`;
    }).join('') + '</div>';
    h += `<div class="note" id="opnote"></div><div class="btns op-actions"><button class="btn ghost" data-act="cancel">Отмена</button><button class="btn laser" data-act="apply">Применить</button></div></div>`; return h; }
  const inHole = S.sel && S.sel.h != null, T = inHole ? holesOf(poly)[S.sel.h] : poly, tn = T ? T.v.length : 0, NL = i => (inHole ? HL(S.sel.h, i) : L(i));
  const holeBtn = inHole ? '<button class="btn danger" data-act="holeDel">Удалить вырез</button>' : '';
  const back = `<button class="context-back" data-act="deselect">${icon('back')}<span>${MOBILE ? 'Все действия' : 'Все стены и углы'}</span></button>`;
  if (S.sel && S.sel.t === 'v' && T) { const i = S.sel.i, P = ptsOf(T), d = interiorDeg(P, i, windOf(P)), fl = T.v[i].fillet;
    return `<div class="card selection-card">${back}<div class="context-heading"><h3>Угол <span class="m">${NL(i)}</span>${inHole ? ' выреза' : ''}</h3><span>${Math.round(d)}°${fl ? ' · R ' + cm(fl) + ' см' : ''}</span></div>
    <div class="acts"><button class="btn" data-act="op" data-k="fillet">${GL.fillet()}<span>${fl ? 'Изменить радиус' : 'Скруглить'}</span></button>${fl ? '<button class="btn" data-act="unfillet">Убрать скругление</button>' : ''}<button class="btn danger" data-act="del">${GL.del()}<span>Удалить угол</span></button>${holeBtn}</div></div>`; }
  if (S.sel && S.sel.t === 's' && T) { const i = S.sel.i, ai = arcInfo(T, i);
    return `<div class="card selection-card">${back}<div class="context-heading"><h3>Стена <span class="m">${NL(i)}${NL((i + 1) % tn)}</span>${inHole ? ' выреза' : ''}</h3><span>${cm(sideLen(T, i))} см${ai ? ' · дуга ' + cm(ai.len) + ' см' : ''}</span></div>
    <div class="acts"><button class="btn" data-act="op" data-k="len">${GL.len('end')}<span>Длина</span></button><button class="btn" data-act="op" data-k="shift">${GL.shift('out')}<span>Сдвинуть</span></button><button class="btn" data-act="op" data-k="add">${GL.add('start')}<span>Добавить точку</span></button><button class="btn" data-act="op" data-k="bump">${GL.bump('in')}<span>Ниша / выступ</span></button><button class="btn" data-act="op" data-k="arc">${GL.arc('out')}<span>${ai ? 'Изменить дугу' : 'Дуга'}</span></button>${ai ? '<button class="btn" data-act="unarc">Убрать дугу</button>' : ''}${holeBtn}</div></div>`; }
  if (MOBILE) return mobileOperationMenu();
  const oval = S.origin && S.origin.kind === 'oval', tab = S.tab3 || 'walls', total = n + holesOf(poly).reduce((count, hole) => count + hole.v.length, 0);
  let h = `<div class="drawing-summary">${MOBILE ? '' : `<span>S <b>${fmt2(st.area)}</b> м²</span><span>P <b>${fmt2(st.perim)}</b> м</span>`}${st.holes ? `<span>${st.holes} ${plural(st.holes, 'вырез', 'выреза', 'вырезов')}</span>` : ''}${oval ? '<button data-act="editQuick">Диаметры</button>' : ''}</div>`;
  h += `<div class="seg detail-tabs"><button class="${tab === 'walls' ? 'on' : ''}" data-act="tab3" data-v="walls">Стены <span>${total}</span></button><button class="${tab === 'angles' ? 'on' : ''}" data-act="tab3" data-v="angles">Углы <span>${total}</span></button></div>${editTargetList(tab)}`;
  h += `<div class="drawing-tools"><span class="detail-help">${tab === 'walls' ? 'Выберите стену для изменения' : 'Выберите угол для изменения'}</span><button class="btn sm ghost" data-act="hole">${icon('plus')}Вырез</button></div>`;
  return h; }
function updateSheet3() { const nn = $('#opnote'); if (nn && S.op) nn.textContent = opNote(); const guide = $('#opguide'); if (guide && S.op) guide.innerHTML = operationGuide(S.op, opGuideContext(S.op)); const sc = sheet.querySelector('svg.scheme'); if (sc && S.op && S.op.kind === 'hole') sc.outerHTML = holeScheme(S.op); }
function updateSheet() { if (S.stage === 0) updateSheet0(); else if (S.stage === 2 && S.m) updateSheet2(); else if (S.stage === 3) updateSheet3(); }
function runOp(poly, op) { let q = null;
  if (op.kind === 'hole') return { q: opHole(poly, op), dropped: [] };
  if (op.kind === 'holeDel') return { q: opHoleDelete(poly, op.h), dropped: [] };
  if (op.h != null) { let dropped = []; q = withHole(poly, op.h, hole => { const r = runOp(hole, { ...op, h: undefined }); dropped = r.dropped.map(l => HL(op.h, l.charCodeAt(0) - 65)); return r.q; }); return { q, dropped }; }
  if (op.kind === 'len') q = opLength(poly, op.i, op.end, op.len); else if (op.kind === 'add') q = opAddPoint(poly, op.i, op.from, op.d);
  else if (op.kind === 'shift') q = opShift(poly, op.i, op.off); else if (op.kind === 'arc') q = opArc(poly, op.i, op.mode, op.val, op.dir);
  else if (op.kind === 'bump') q = opBump(poly, op.i, op.from, op.off, op.w, op.dp, op.dir, op.topologyVersion ?? 1); else if (op.kind === 'fillet') q = opFillet(poly, op.i, op.r);
  else if (op.kind === 'del') q = opDelete(poly, op.i);
  if (!q) throw new Error('Неизвестная правка'); if (Math.abs(shoelace(flatten(q))) < 1e-6) throw new Error('Фигура вырождается');
  checkHoles(q); return { q, dropped: checkFillets(q) }; }
const OP_NAMES = { len: 'длина', add: 'точка', shift: 'сдвиг', arc: 'дуга', bump: 'выступ', fillet: 'скругление', del: 'удаление', hole: 'вырез', holeDel: 'удаление выреза' };
const opLabel = op => OP_NAMES[op.kind] + (op.kind === 'hole' || op.kind === 'holeDel' ? '' : ' ' + (op.h != null ? HL(op.h, op.i) : L(op.i)));
function replay(base, ops) { let poly = clone(base), failedAt = null, err = '';
  for (let k = 0; k < ops.length; k++) { try { poly = runOp(poly, ops[k]).q; } catch (e) { failedAt = k; err = e.message; break; } }
  return { poly, failedAt, err }; }
// после сдвига или изменения длины помним прежний контур, чтобы показать его пунктиром
function updateGhost() { const last = S.ops[S.ops.length - 1]; S.ghost = (last && (last.kind === 'shift' || last.kind === 'len') && last.h == null && S.base) ? replay(S.base, S.ops.slice(0, -1)).poly : null; }
function rebuild() { const r = replay(S.base, S.ops);
  if (r.failedAt != null) { const bad = S.ops[r.failedAt]; S.ops = S.ops.slice(0, r.failedAt); S.redoOps = []; toast(`Правка «${opLabel(bad)}» больше не подходит и снята: ${r.err}`, true); }
  S.poly = r.poly; updateGhost(); }
function commitOp(op) { try { const { q, dropped } = runOp(S.poly, op); S.ops.push(op); S.redoOps = []; S.ghost = (op.kind === 'shift' || op.kind === 'len') && op.h == null ? S.poly : null; S.poly = q; S.op = null; S.sel = null; S.toolPick = null; if (MOBILE) presentNumericForm(null); else blurActive(); render();
  if (dropped.length) toast('Скругление снято у ' + dropped.join(', ') + ': не помещается'); } catch (e) { toast(e.message, true); } }
function applyOp() { const o = S.op; if (!o) return; const num = k => { const v = parseNum(o.f[k], o.kind === 'bump' && k === 'off'); return v == null ? NaN : v / 100; };
  for (const [k, lbl] of o.spec.fields) if (!isFinite(num(k))) return toast('Введите: ' + lbl.toLowerCase(), true);
  const op = { kind: o.kind, i: o.i }; if (o.h != null) op.h = o.h;
  if (o.kind === 'hole') Object.assign(op, { c: holeCorner(o).i, d1: num('d1'), d2: num('d2'), w: num('w'), hh: num('hh') });
  else if (o.kind === 'len') Object.assign(op, { end: o.seg.end, len: num('len') });
  else if (o.kind === 'add') Object.assign(op, { from: o.seg.from, d: num('d') });
  else if (o.kind === 'shift') Object.assign(op, { off: (o.seg.dir === 'out' ? 1 : -1) * num('d') });
  else if (o.kind === 'arc') Object.assign(op, { mode: o.seg.mode, val: o.seg.mode === 'h' ? num('h') : num('s'), dir: o.seg.dir });
  else if (o.kind === 'bump') Object.assign(op, { from: o.seg.from, off: num('off'), w: num('w'), dp: num('dp'), dir: o.seg.dir, topologyVersion: 2 });
  else if (o.kind === 'fillet') Object.assign(op, { r: num('r') });
  commitOp(op); }
function modelFromPoly(poly) { const P = ptsOf(poly), n = P.length, wind = windOf(P), m = makeModel(P.map(p => ({ x: p.x * 80, y: p.y * 80 })));
  m.vert = P.map((p, i) => { const d = interiorDeg(P, i, wind); if (Math.abs(d - 90) < 0.5) return { kind: 'ortho', deg: 90 }; if (Math.abs(d - 270) < 0.5) return { kind: 'ortho', deg: 270 }; return { kind: 'deg', deg: Math.round(d * 10) / 10 }; });
  m.sides = P.map((p, i) => Math.round(hyp(p, P[(i + 1) % n]) * 1000) / 10); return solveModel(m); }
function act(a, d = {}) {
  if (MOBILE && a === 'rulerMode' && S.stage === 1) { stopRulerEdgePan(); ptr = null; S.sk.entryMode = d.v === 'rough' || d.v === 'ruler' ? d.v : S.sk.entryMode === 'ruler' ? 'rough' : 'ruler'; S.sk.candidate = null; blurActive(); return render(); }
  if (MOBILE && a === 'rulerAdjust' && S.stage === 1) return adjustLastRulerSide(+d.delta);
  if (MOBILE && a === 'rulerCancel' && S.stage === 1) { S.sk.candidate = null; return render(); }
  if (MOBILE && a === 'sketchMode') { stopRulerEdgePan(); ptr = null; S.sk.mode = S.sk.mode === 'free' ? 'grid' : 'free'; S.sk.candidate = null; return render(); }
  if (MOBILE && a.startsWith('view')) return changeView(a, d);
  if (MOBILE && a === 'toggleTools') { flushApply(); S.toolsOpen = !(S.toolsOpen || S.sel || S.op || S.toolPick); S.sel = null; S.op = null; S.toolPick = null; presentNumericForm(null); return render(); }
  if (MOBILE && a === 'chooseTool') { if (S.stage !== 3 || !Object.hasOwn(MOBILE_TOOLS, d.k)) return; S.toolsOpen = true; S.sel = null; S.op = null; S.toolPick = d.k; presentNumericForm(null); return render(); }
  if (MOBILE && a === 'cancelTool') { S.toolPick = null; S.sel = null; S.op = null; S.toolsOpen = true; presentNumericForm(null); return render(); }
  if (MOBILE && a === 'mobileField') return selectMobileField(d.kind, +d.i, true);
  if (MOBILE && (a === 'allOrtho' || a === 'freeAngles')) return setAllAngles(a === 'allOrtho');
  if (a === 'prevField') { const input = document.activeElement?.matches?.('input.in') ? document.activeElement : MOBILE ? currentMobileInput() : null; if (input) moveInput(input, -1); return; }
  if (a === 'nextField') { const el = document.activeElement?.matches?.('input.in') ? document.activeElement : MOBILE ? currentMobileInput() : null; if (el && el.matches && el.matches('input.in')) onEnter(el); return; }
  if (a === 'blur') return blurActive();
  if (a === 'finish') return finish();
  if (a === 'q-rect') { S.quick = { kind: 'rect', f: { a: '', b: '' } }; presentNumericForm('input[data-in="q"]'); return render(); }
  if (a === 'q-oval') { S.quick = { kind: 'oval', mode: 'circle', f: { r: '', rx: '', ry: '' } }; presentNumericForm('input[data-in="q"]'); return render(); }
  if (a === 'q-resume') { S.stage = 1; S.quick = null; return render(); }
  if (a === 'q-poly') { viewAngle = 0; S.stage = 1; S.sk.mode = 'grid'; S.origin = { kind: 'poly' }; return render(); }
  if (a === 'q-polyfree') { viewAngle = 0; S.stage = 1; S.sk.mode = 'free'; S.origin = { kind: 'poly' }; return render(); }
  if (a === 'qmode') { S.quick.mode = d.v; presentNumericForm('input[data-in="q"]'); return render(); }
  if (a === 'quickCancel') { S.toolPick = null; if (MOBILE) presentNumericForm(null); if (S.quick.edit) { S.quick = null; S.stage = 3; } else S.quick = null; return render(); }
  if (a === 'quickBuild') return quickBuild();
  if (a === 'editQuick') { const o = S.origin; S.quick = { kind: 'oval', mode: o.mode, f: scaleOvalFields(o.f, 2), edit: true }; S.stage = 0; S.sel = null; S.op = null; S.toolPick = null; presentNumericForm('input[data-in="q"]'); return render(); }
  if (a === 'home') { S.stage = 0; S.quick = null; S.sel = null; S.op = null; S.toolPick = null; blurActive(); return render(); }
  if (a === 'tab2') { flushApply(); S.tab2 = d.v; S.dpick = null; S.sel = null; blurActive(); return render(); }
  if (a === 'tab3') { S.tab3 = d.v; S.sel = null; S.op = null; S.toolPick = null; blurActive(); return render(); }
  if (a === 'selectSide' || a === 'selectVertex') return selectEditTarget({ t: a === 'selectSide' ? 's' : 'v', i: +d.i, h: d.h != null ? +d.h : undefined });
  if (a === 'dpk') { const i = +d.i; if (!S.dpick) { S.dpick = { a: i }; return render(); } const a0 = S.dpick.a; S.dpick = null; if (a0 === i) return render();
    const lo = Math.min(a0, i), hi = Math.max(a0, i), n = S.m.n; if (!((lo + 1) % n === hi || (hi + 1) % n === lo) && !isInteriorDiag(S.m.sol, lo, hi)) { render(); return toast('Эта линия выходит за стены комнаты', true); } return addDiag(a0, i); }
  if (a === 'addSug') return addDiag(+d.i, +d.j);
  if (a === 'vk') return setVKindAt(+d.i, d.k);
  if (a === 'close') return closeSketch();
  if (a === 'rmDiag') { withSnap(() => S.m.diags.splice(+d.i, 1)); solveModel(S.m); return render(); }
  if (a === 'pickDiag') { if (S.stage !== 2 || !S.m) return; flushApply(); S.sel = null; S.pick = { mode: 'diag', a: null }; blurActive(); return render(); }
  if (a === 'pickAng') { if (S.stage !== 2 || !S.m) return; flushApply(); S.sel = null; S.pick = { mode: 'ang' }; blurActive(); return render(); }
  if (a === 'pickCancel') { S.pick = null; return render(); }
  if (a === 'vkind') return setVKind(d.k);
  if (a === 'deselect') { S.sel = null; S.op = null; S.toolPick = null; return render(); }
  if (a === 'back1') { flushApply(); if (!S.sk.pts.length) return; S.stage = 1; S.sel = null; S.op = null; S.pick = null; S.toolPick = null; blurActive(); return render(); }
  if (a === 'back2') { flushApply(); if (!S.m && holesOf(S.base).length) return toast('Контур содержит вырезы. Изменяйте стены через «Править», чтобы сохранить вырезы.', true); if (!S.m) S.m = modelFromPoly(S.base); else if (!S.m.sol || !S.m.status) solveModel(S.m); S.stage = 2; S.sel = null; S.op = null; S.pick = null; S.toolPick = null; return render(); }
  if (a === 'done') { flushApply(); if (MOBILE) S.toolsOpen = false; if (S.m.status.missing) return; S.base = bakeModel(S.m); S.stage = 3; S.sel = null; S.pick = null; S.dpick = null; S.toolPick = null; blurActive(); rebuild(); return render(); }
  if (a === 'op') { makeOp(d.k, S.sel.i, S.sel.h); return render(); }
  if (a === 'hole') { if (MOBILE) S.toolsOpen = true; S.sel = null; makeOp('hole'); return render(); }
  if (a === 'holeDel') return commitOp({ kind: 'holeDel', h: S.sel.h });
  if (a === 'seg') { S.op.seg[d.n] = d.v; opFields(); if (MOBILE) presentNumericForm(null); return render(); }
  if (a === 'apply') return applyOp();
  if (a === 'cancel') { if (MOBILE) presentNumericForm(null); S.op = null; S.toolPick = null; return render(); }
  if (a === 'del') return commitOp({ kind: 'del', i: S.sel.i, h: S.sel.h });
  if (a === 'unfillet') return commitOp({ kind: 'fillet', i: S.sel.i, h: S.sel.h, r: null });
  if (a === 'unarc') return commitOp({ kind: 'arc', i: S.sel.i, h: S.sel.h, mode: 'h', val: 0, dir: 'out' }); }
sheet.addEventListener('input', e => { if (e.target && e.target.id === 'roomName') { S.roomName = e.target.value; $('#sub').textContent = S.roomName || 'Помещение'; } });
sheet.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || !sheet.contains(b)) return; if ((b.dataset.act === 'nextField' || b.dataset.act === 'prevField' || b.dataset.act === 'blur') && Date.now() - kbActAt < 600) return; act(b.dataset.act, b.dataset); });
$('#start').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.dataset); });
$('#viewToggle').addEventListener('click', () => changeView('viewToggle'));
$('#viewPanel').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.dataset); });
$('#viewPanel').addEventListener('input', e => { if (e.target.id === 'viewRotation') changeView('viewRotation', { degrees: e.target.value }); });
$('#inputAccessory').addEventListener('pointerdown', e => { const b = kbBtn(e); if (!b) return; e.preventDefault(); kbActAt = Date.now(); act(b.dataset.act, b.dataset); });
$('#inputAccessory').addEventListener('click', e => { const b = kbBtn(e); if (b && Date.now() - kbActAt >= 600) act(b.dataset.act, b.dataset); });
$('#bBack').addEventListener('click', () => { stopRulerEdgePan(); ptr = null; if (opts.onBack) opts.onBack(); });
$('#bUndo').addEventListener('click', () => { if (S.stage === 1) { stopRulerEdgePan(); ptr = null; if (MOBILE && S.sk.candidate) S.sk.candidate = null; else { S.sk.pts.pop(); if (MOBILE) S.sk.measuredSides.length = Math.max(0, S.sk.pts.length - 1); queueRulerCamera(); } render(); } else if (S.stage === 2) undo2(); else if (S.stage === 3 && S.ops.length) { S.redoOps.push(S.ops.pop()); rebuild(); S.sel = null; S.op = null; S.toolPick = null; render(); } });
$('#bRedo').addEventListener('click', () => { if (S.stage === 2) redo2(); else if (S.stage === 3 && S.redoOps.length) { S.ops.push(S.redoOps.pop()); rebuild(); S.sel = null; S.op = null; S.toolPick = null; render(); } });
let newArm = null;
function disarmNew() { clearTimeout(newArm); newArm = null; const b = $('#bNew'); b.textContent = 'Заново'; b.style.color = ''; }
$('#bNew').addEventListener('click', () => { stopRulerEdgePan(); ptr = null; if (S.stage === 0) { S.quick = null; return render(); } if (S.stage === 1 && !S.sk.pts.length) return;
  if (!newArm) { const b = $('#bNew'); b.textContent = 'Сбросить?'; b.style.color = 'var(--laser)'; newArm = setTimeout(disarmNew, 3000); toast('Ещё раз, чтобы начать новый чертёж'); return; }
  disarmNew(); viewAngle = 0; focusPan = null; Object.assign(S, FRESH()); render(); });
function viewKey() { const m = S.m; return [S.stage, S.quick ? S.quick.kind + S.quick.mode + (S.quick.edit ? 'e' : '') : '', S.origin ? S.origin.kind : '', S.sel ? S.sel.t + S.sel.i + (S.sel.h != null ? 'h' + S.sel.h : '') : '', S.pick ? S.pick.mode + (S.pick.a ?? '') : '', S.op ? S.op.kind + S.op.i + JSON.stringify(S.op.seg) : '', S.toolPick || '',
  m ? m.n + ':' + m.diags.length + ':' + m.vert.map(v => v.kind[0]).join('') + ':' + (S.stage === 2 && S.sel && S.sel.t === 'v' ? m.vert[S.sel.i].kind : '') : '', S.tab2, S.tab3, S.sk.mode, MOBILE ? S.sk.entryMode + ':' + JSON.stringify(S.sk.candidate) + ':' + JSON.stringify(S.sk.measuredSides) : '', MOBILE ? JSON.stringify(S.fields) + S.toolsOpen : '', S.dpick ? S.dpick.a : '', S.ops.length, S.poly ? S.poly.v.length : 0, S.sk.pts.length].join('|'); }
function renderSheet() { const key = viewKey(); if (key === sheetKey) { updateSheet(); return; }
  const startOnly = S.stage === 0 && !S.quick; const start = $('#start'); // выбор способа — вверху холста, чтобы не тянуться вниз
  start.hidden = !startOnly || !!opts.embedded; sheet.hidden = startOnly && !opts.embedded;
  if (startOnly) { sheetKey = key; start.innerHTML = opts.embedded ? '' : sheet0(); sheet.innerHTML = opts.embedded ? sheet0() : ''; return; }
  const top = sheet.scrollTop; sheetKey = key; sheet.innerHTML = S.stage === 0 ? sheet0() : S.stage === 1 ? sheet1() : S.stage === 2 ? sheet2() : sheet3(); updateSheet(); sheet.scrollTop = top; }
// ───────── stage 0: quick commands (rectangle, circle/ellipse, polygon) ─────────
// Saved origin fields remain radii in centimetres; the form uses full diameters.
function scaleOvalFields(fields, factor) { return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
  const n = parseNum(value); return [key, n == null ? '' : String(n * factor)];
})); }
function quickPoly() { const q = S.quick; if (!q) return null; const n = k => parseNum(q.f[k]);
  if (q.kind === 'rect') { const a = n('a'), b = n('b'); return a && b ? rectPoly(a / 100, b / 100) : null; }
  if (q.mode === 'circle') { const d = n('r'); return d ? ovalPoly(d / 200, d / 200) : null; }
  const dx = n('rx'), dy = n('ry'); return dx && dy ? ovalPoly(dx / 200, dy / 200) : null; }
function quickSpec() { const q = S.quick; if (q.kind === 'rect') return { title: 'Прямоугольник', fields: [['a', 'Сторона AB (ширина)', 'см'], ['b', 'Сторона BC (глубина)', 'см']] };
  return q.mode === 'circle' ? { title: 'Окружность', fields: [['r', 'Диаметр', 'см']] } : { title: 'Эллипс', fields: [['rx', 'Диаметр по ширине', 'см'], ['ry', 'Диаметр по высоте', 'см']] }; }
const glyph = k => k === 'rect' ? '<svg class="shape-preview" viewBox="0 0 36 36" aria-hidden="true"><rect x="4" y="8" width="28" height="20" rx="1.5" fill="var(--fill)" stroke="var(--ink)" stroke-width="2"/></svg>'
  : k === 'oval' ? '<svg class="shape-preview" viewBox="0 0 36 36" aria-hidden="true"><ellipse cx="18" cy="18" rx="14" ry="10" fill="var(--fill)" stroke="var(--ink)" stroke-width="2"/></svg>'
  : k === 'free' ? '<svg class="shape-preview" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 30L9 6H27L32 20L26 30Z" fill="var(--fill)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/><path d="M9 6L26 30" stroke="var(--ink3)" stroke-width="1.5" stroke-dasharray="3 2"/></svg>'
  : '<svg class="shape-preview" viewBox="0 0 88 72" aria-hidden="true"><path d="M15 12H51V31H73V59H15Z" fill="var(--fill)" stroke="var(--pri)" stroke-width="2" stroke-linejoin="round"/><path d="M15 5H51M8 12V59" stroke="var(--ink3)" stroke-width="1" stroke-dasharray="2 3"/><g fill="var(--surface)" stroke="var(--pri)" stroke-width="1.5"><circle cx="15" cy="12" r="3"/><circle cx="51" cy="12" r="3"/><circle cx="51" cy="31" r="3"/><circle cx="73" cy="31" r="3"/><circle cx="73" cy="59" r="3"/><circle cx="15" cy="59" r="3"/></g></svg>';
function sheet0() { const q = S.quick;
  if (MOBILE && !q) return `<div class="start-intro"><h2>Как построим потолок?</h2><p>Выберите способ, затем отметьте углы на чертеже.</p></div><div class="opts mobile-methods"><button class="opt opt-primary" data-act="${S.sk.pts.length && S.sk.mode === 'grid' ? 'q-resume' : 'q-poly'}">${glyph('poly')}<div class="opt-copy"><b>Прямые углы</b><span>Нарисуйте контур и введите стороны. Углы — 90° или 270°.</span></div><span class="opt-arrow">${icon('arrow')}</span></button><button class="opt opt-free" data-act="${S.sk.pts.length && S.sk.mode === 'free' ? 'q-resume' : 'q-polyfree'}">${glyph('free')}<div class="opt-copy"><b>Диагонали и градусы</b><span>Для косых стен: стороны, диагонали или углы в градусах.</span></div><span class="opt-arrow">${icon('arrow')}</span></button><div class="sec">Готовая форма</div><div class="quick-shapes"><button class="opt opt-compact" data-act="q-rect">${glyph('rect')}<div class="opt-copy"><b>Прямоугольник</b><span>Две стороны</span></div></button><button class="opt opt-compact" data-act="q-oval">${glyph('oval')}<div class="opt-copy"><b>Круг / овал</b><span>Один или два диаметра</span></div></button></div></div>`;
  if (!q) return `<div class="start-intro"><h2>С чего начнём?</h2><p>Выберите форму комнаты или нарисуйте её по углам.</p></div><div class="opts">
    <button class="opt opt-primary" data-act="${S.sk.pts.length ? 'q-resume' : 'q-poly'}">${glyph(S.sk.pts.length && S.sk.mode === 'free' ? 'free' : 'poly')}<div class="opt-copy"><b>${S.sk.pts.length ? 'Продолжить контур' : 'Автоматическое построение'}</b><span>${S.sk.pts.length ? 'Продолжите контур, затем введите размеры.' : 'Для помещений, где все углы прямые. Отметьте контур и введите длины стен.'}</span></div><span class="opt-arrow">${icon('arrow')}</span></button>
    <div class="quick-shapes"><button class="opt opt-compact" data-act="q-rect">${glyph('rect')}<div class="opt-copy"><b>Прямоугольник</b><span>Ширина и длина</span></div></button>
    <button class="opt opt-compact" data-act="q-oval">${glyph('oval')}<div class="opt-copy"><b>Круг / овал</b><span>Один или два диаметра</span></div></button></div>
    <button class="opt opt-free" data-act="q-polyfree">${glyph('free')}<div class="opt-copy"><b>Ручное построение</b><span>Введите длины стен, диагонали или углы в градусах.</span></div><span class="opt-arrow">${icon('arrow')}</span></button></div>`;
  const sp = quickSpec(); let h = `<div class="card op"><h3>${esc(sp.title)}${q.edit ? ' · изменить' : ''}</h3>`;
  if (q.kind === 'oval') h += `<div class="seg"><button class="${q.mode === 'circle' ? 'on' : ''}" data-act="qmode" data-v="circle">Окружность</button><button class="${q.mode === 'ellipse' ? 'on' : ''}" data-act="qmode" data-v="ellipse">Эллипс</button></div>`;
  h += '<div class="fields">' + sp.fields.map(([k, lbl, u]) => `<div class="fld"><span class="k">${esc(lbl)}</span>${numIn('q', `data-k="${k}"`, q.f[k] ?? '', '', `${sp.title}: ${lbl}, сантиметров`)}<span class="u">${u}</span></div>`).join('') + '</div>';
  h += `<div class="note" id="qnote"></div><div class="btns"><button class="btn ghost" data-act="quickCancel">${q.edit ? 'Отмена' : 'Назад'}</button><button class="btn pri" id="qbuild" data-act="quickBuild">${q.edit ? 'Перестроить' : 'Построить'}${icon('arrow')}</button></div></div>`;
  return h; }
function updateSheet0() { const nn = $('#qnote'); if (!nn) return; const poly = quickPoly(), b = $('#qbuild'); if (b) b.disabled = !poly;
  nn.hidden = MOBILE && !!poly;
  if (!poly) { nn.textContent = 'Введите размеры, чертёж появится сверху'; return; } const st = polyStats(poly); nn.textContent = `Площадь ${fmt2(st.area)} м² · периметр ${fmt2(st.perim)} м`; }
function quickBuild() { const poly = quickPoly(); if (!poly) return toast('Введите размеры', true); const q = S.quick;
  S.origin = q.kind === 'rect' ? { kind: 'rect' } : { kind: 'oval', mode: q.mode, f: scaleOvalFields(q.f, .5) };
  S.base = poly; if (!q.edit) { S.ops = []; S.redoOps = []; S.m = null; S.hist2 = []; S.redo2 = []; } S.quick = null; S.stage = 3; S.sel = null; S.op = null; S.toolPick = null; rebuild(); if (MOBILE) presentNumericForm(null); else blurActive(); render(); }
function renderChrome() { const names = ['Контур', 'Размеры', 'Детали'], isRect = S.origin && S.origin.kind === 'rect', isOval = S.origin && S.origin.kind === 'oval', app = $('#app');
  applyCanvasLook();
  const measures = $('#measureTools'); measures.hidden = S.stage !== 2 || (MOBILE && !S.pick); if (S.stage === 2) measures.innerHTML = measurementToolbar(S.pick, L);
  const looks = $('#canvasLooks'); looks.hidden = !!opts.hideAppearance || (S.stage === 0 && !S.quick);
  if (!opts.hideAppearance && !looks.children.length) looks.innerHTML = [['classic', 'Было'], ...Object.entries(APPEARANCES).map(([key, value]) => [key, value.label])].map(([key, label]) => `<button type="button" data-look="${key}" aria-pressed="false" aria-label="Оформление: ${label}">${label}</button>`).join('');
  for (const button of looks.querySelectorAll('[data-look]')) button.setAttribute('aria-pressed', String(button.dataset.look === canvasLook));
  app.dataset.stage = S.stage; app.classList.toggle('has-pick', !!S.pick); app.classList.toggle('tools-open', S.toolsOpen || !!S.op || !!S.sel || !!S.toolPick); if (MOBILE) renderViewPanel(); app.classList.toggle('choosing', S.stage === 0 && !S.quick); app.classList.toggle('quick', !!S.quick); app.classList.toggle('has-selection', !!S.sel); app.classList.toggle('has-operation', !!S.op);
  // Клик по пройденному этапу сохраняет размеры и правки. Новый контур применяется только после замыкания.
  $('#stages').innerHTML = isOval && S.stage > 0 ? '<span class="pill on"><b>3</b>Детали</span>' : names.map((nm, k) => ((isRect || (S.stage > 1 && !S.sk.pts.length)) && k === 0) ? '' : `<button class="pill ${k + 1 === (S.stage || 1) ? 'on' : k + 1 < S.stage ? 'done' : ''}" data-stage="${k + 1}" ${S.stage === 0 || (S.stage === 1 && ((k === 1 && S.sk.pts.length < 3) || (k === 2 && (!S.poly || !sketchUnchanged())))) ? 'disabled' : ''} ${k + 1 === (S.stage || 1) ? 'aria-current="step"' : ''}><b>${k + 1}</b>${nm}</button>`).join('');
  $('#hint').textContent = S.stage === 0 ? (S.quick ? 'Чертёж появится по мере ввода размеров' : '') : S.stage === 1 ? (S.sk.pts.length ? opts.embedded ? 'Точки можно перетаскивать · масштаб справа вверху' : 'Точки можно перетаскивать · сведите пальцы для масштаба' : opts.embedded ? 'Нажмите на холст, чтобы поставить угол A' : 'Коснитесь холста, чтобы поставить угол A') : S.stage === 2 ? 'Размеры в сантиметрах · стена подсвечивается при вводе' : S.op ? 'Проверьте параметры и примените правку' : S.sel ? 'Выбранный элемент подсвечен синим' : MOBILE ? '' : 'Выберите элемент на чертеже или в списке';
  $('#hint').style.display = S.stage === 1 && (S.sk.pts.length > 5 || (MOBILE && S.sk.entryMode === 'ruler')) ? 'none' : '';
  $('#sub').textContent = S.roomName || 'Помещение';
  $('#bUndo').disabled = S.stage === 0 ? true : S.stage === 1 ? !S.sk.pts.length : S.stage === 2 ? !S.hist2.length : !S.ops.length; $('#bRedo').disabled = S.stage === 2 ? !S.redo2.length : !(S.stage === 3 && S.redoOps.length);
  $('#bNew').style.visibility = S.stage === 0 && !S.quick ? 'hidden' : ''; $('.zoom').style.display = S.stage === 0 && !S.quick ? 'none' : ''; }
function save() { }
function render() { if (!rulerDragActive()) stopRulerEdgePan(); const qk = S.quick ? S.quick.kind + (S.quick.mode || '') : '';
  if (S.stage !== lastStage || qk !== lastQuick) { Z = { k: 1, dx: 0, dy: 0 }; rulerCameraPending = null; queueRulerCamera(); alignmentKey = null; lastStage = S.stage; lastQuick = qk; sheetKey = ''; } renderChrome(); renderSheet(); applyRulerCamera(); renderCanvas(); save();
  if (S.focusReq) { const el = sheet.querySelector(S.focusReq); S.focusReq = null; if (el) { focusIn(el); if (!MOBILE) el.scrollIntoView({ block: 'nearest' });
    S.hot = el.dataset.in === 'side' ? { t: 's', i: +el.dataset.i } : el.dataset.in === 'diag' ? { t: 'd', k: +el.dataset.k } : null; renderCanvas(); } } }
function commit() { render(); }
function prepareFocusPan() { const input = document.activeElement; if (MOBILE && input?.matches?.('input.in')) { focusPan = focusPoint(input); panPending = !!focusPan; } }
let vvFit = null;
const onResize = () => { if (!alive) return; if (vvFit) return vvFit(); prepareFocusPan(); queueRulerCamera(); applyRulerCamera(); renderCanvas(); }; window.addEventListener('resize', onResize);
if (window.visualViewport && !opts.embedded) {
  const vv = window.visualViewport, app = $('#app');
  vvFit = () => {
    if (!alive) return;
    if (MOBILE || window.innerWidth < 640) {
      const frame = root.getBoundingClientRect(), top = frame.top || 0, viewportTop = vv.offsetTop || 0;
      const bottom = Number.isFinite(frame.bottom) ? frame.bottom : top + (root.clientHeight || vv.height);
      const visibleTop = Math.max(top, viewportTop), visibleBottom = Math.min(bottom, viewportTop + vv.height);
      app.style.height = Math.max(1, visibleBottom - visibleTop) + 'px';
      app.style.transform = visibleTop > top ? `translateY(${visibleTop - top}px)` : '';
    } else { app.style.height = ''; app.style.transform = ''; }
    prepareFocusPan(); queueRulerCamera(); applyRulerCamera(); renderCanvas(); revealMobileFormInput();
  };
  vv.addEventListener('resize', vvFit); vv.addEventListener('scroll', vvFit);
}
const workspaceObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
workspaceObserver?.observe(root);
document.fonts && document.fonts.ready.then(() => { if (alive) renderCanvas(); });
// правка готового контура: сразу этап «Правка» с переданными вершинами (метры)
function validSavedModel(m, n) { const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y), size = v => v == null || (Number.isFinite(v) && v > 0);
  return m && m.n === n && (m.wind === 1 || m.wind === -1) && Array.isArray(m.prior) && m.prior.length === n && m.prior.every(point)
    && Array.isArray(m.vert) && m.vert.length === n && m.vert.every(v => v && ['ortho', 'free', 'deg'].includes(v.kind) && (v.deg == null || Number.isFinite(v.deg)))
    && Array.isArray(m.sides) && m.sides.length === n && m.sides.every(size) && Array.isArray(m.diags)
    && m.diags.every(d => d && Number.isInteger(d.i) && Number.isInteger(d.j) && d.i >= 0 && d.j >= 0 && d.i < n && d.j < n && d.i !== d.j && size(d.cm)); }
if (opts.initial && Array.isArray(opts.initial.verts) && opts.initial.verts.length >= 3) {
  // если помещение построено этим же редактором, восстанавливаем базовую фигуру, правки и размеры — их можно продолжить
  const d = opts.initial.draw, okDraw = d && d.base && Array.isArray(d.base.v) && d.base.v.length >= 3 && d.base.v.every(q => q && isFinite(q.x) && isFinite(q.y));
  if (okDraw) { S.base = clone(d.base); S.ops = Array.isArray(d.ops) ? clone(d.ops) : []; S.origin = d.origin || { kind: 'poly' }; S.m = validSavedModel(d.m, d.base.v.length) ? solveModel(clone(d.m)) : null; }
  else { S.base = { v: opts.initial.verts.map(([x, y]) => ({ x, y, fillet: null, arc: null })) }; if (Array.isArray(opts.initial.holes)) { const holes = opts.initial.holes.filter(ring => Array.isArray(ring) && ring.length >= 3 && ring.every(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))); if (holes.length) S.base.holes = holes.map(ring => ({ v:ring.map(([x,y]) => ({x,y,fillet:null,arc:null})) })); } S.origin = { kind: 'poly' }; S.ops = []; }
  S.stage = 3; if (MOBILE) S.toolsOpen = false; const rr = replay(S.base, S.ops); if (rr.failedAt != null) { S.ops = []; } rebuild(); }
render();
return { resize:onResize, destroy() { alive = false; stopRulerEdgePan(); workspaceObserver?.disconnect(); window.removeEventListener('resize', onResize); if (vvFit && window.visualViewport) { window.visualViewport.removeEventListener('resize', vvFit); window.visualViewport.removeEventListener('scroll', vvFit); } clearTimeout(applyT); clearTimeout(toastT); clearTimeout(kbT); clearTimeout(newArm); root.innerHTML = ''; } };
}
