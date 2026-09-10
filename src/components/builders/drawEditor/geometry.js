// Геометрия ручного построения: решатель размеров, модель многоугольника с дугами и скруглениями, операции правки.
// Чистые функции без DOM. Единицы: метры; ввод в интерфейсе — сантиметры.
'use strict';
// ───────── helpers ─────────
export const L = i => String.fromCharCode(65 + i);
export const TAU = Math.PI * 2, DEG = 180 / Math.PI;
export const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const hyp = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const norm = a => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
export const perp = a => ({ x: -a.y, y: a.x });
export const clone = o => JSON.parse(JSON.stringify(o));
export const cm = m => Math.round(m * 100);
export const fmt2 = v => v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function turnAt(P, i) { const n = P.length, a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
  const d1 = sub(b, a), d2 = sub(c, b); return Math.atan2(cross(d1, d2), dot(d1, d2)); }
export function shoelace(P) { let s = 0; for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; s += P[i].x * P[j].y - P[j].x * P[i].y; } return s / 2; }
export const windOf = P => shoelace(P) > 0 ? 1 : -1;
export function interiorDeg(P, i, wind) { let d = 180 - wind * turnAt(P, i) * DEG; d = ((d % 360) + 360) % 360; return d; }
export function outNormal(P, i) { const d = norm(sub(P[(i + 1) % P.length], P[i])); const p = perp(d); return shoelace(P) > 0 ? mul(p, -1) : p; }
export function lineX(p1, d1, p2, d2) { const den = cross(d1, d2); if (Math.abs(den) < 1e-9) return null; const t = cross(sub(p2, p1), d2) / den; return add(p1, mul(d1, t)); }
export function segX(a, b, c, d) { const d1 = sub(b, a), d2 = sub(d, c), den = cross(d1, d2); if (Math.abs(den) < 1e-12) return false;
  const t = cross(sub(c, a), d2) / den, u = cross(sub(c, a), d1) / den; return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6; }
export function inside(P, p) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
  if ((P[i].y > p.y) !== (P[j].y > p.y) && p.x < (P[j].x - P[i].x) * (p.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c; } return c; }
export function isInteriorDiag(P, i, j) { const n = P.length; if (i === j || (i + 1) % n === j || (j + 1) % n === i) return false;
  for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; if (k === i || k === j || k2 === i || k2 === j) continue; if (segX(P[i], P[j], P[k], P[k2])) return false; }
  return inside(P, mul(add(P[i], P[j]), .5)); }

// ───────── constraint solver (Levenberg–Marquardt over vertex coords) ─────────
export const W_ANG = 2.0, W_PRIOR = 0.02, NEED = n => 2 * n - 3;
export const toPts = X => { const P = []; for (let i = 0; i < X.length; i += 2) P.push({ x: X[i], y: X[i + 1] }); return P; };
export const flat = P => { const X = []; P.forEach(p => X.push(p.x, p.y)); return X; };

export function buildCons(m) { const n = m.n, cs = [];
  m.sides.forEach((v, i) => { if (v != null) cs.push({ t: 'len', i, j: (i + 1) % n, v: v / 100, label: L(i) + L((i + 1) % n) }); });
  m.diags.forEach(d => { if (d.cm != null) cs.push({ t: 'len', i: d.i, j: d.j, v: d.cm / 100, label: L(d.i) + '–' + L(d.j), diag: true }); });
  m.vert.forEach((vt, i) => { if (vt.kind !== 'free' && vt.deg != null) cs.push({ t: 'ang', i, v: vt.deg, label: L(i) }); });
  return cs; }
export function conRes(c, P, wind) { if (c.t === 'len') return hyp(P[c.i], P[c.j]) - c.v;
  const tau = wind * (Math.PI - c.v / DEG); return wrap(turnAt(P, c.i) - tau) * W_ANG; }
export function resid(X, cons, prior, wind) { const P = toPts(X); const r = cons.map(c => conRes(c, P, wind));
  if (prior) for (let i = 0; i < prior.length; i++) { r.push((X[2 * i] - prior[i].x) * W_PRIOR, (X[2 * i + 1] - prior[i].y) * W_PRIOR); } return r; }
export function jac(X, f) { const r0 = f(X), m = r0.length, nv = X.length, J = [], eps = 1e-6;
  for (let k = 0; k < m; k++) J.push(new Float64Array(nv));
  for (let v = 0; v < nv; v++) { const x0 = X[v]; X[v] = x0 + eps; const r1 = f(X); X[v] = x0; for (let k = 0; k < m; k++) J[k][v] = (r1[k] - r0[k]) / eps; }
  return { r0, J }; }
export function solveLin(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    const pv = M[c][c]; if (Math.abs(pv) < 1e-14) continue; for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / pv; if (!f) continue; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  return M.map((r, i) => Math.abs(r[i]) < 1e-14 ? 0 : r[n] / r[i]); }
export const sq = r => r.reduce((s, v) => s + v * v, 0);
export function lm(X, f, iters = 60) { X = X.slice(); let lam = 1e-3, { r0, J } = jac(X, f), cost = sq(r0); const nv = X.length;
  for (let it = 0; it < iters; it++) { if (cost < 1e-16) break;
    const A = [], g = new Float64Array(nv);
    for (let a = 0; a < nv; a++) { A.push(new Float64Array(nv)); }
    for (let k = 0; k < J.length; k++) { const row = J[k]; for (let a = 0; a < nv; a++) { const ra = row[a]; if (!ra) continue; g[a] += ra * r0[k]; for (let b = 0; b < nv; b++) A[a][b] += ra * row[b]; } }
    for (let a = 0; a < nv; a++) { A[a][a] = A[a][a] * (1 + lam) + 1e-12; g[a] = -g[a]; }
    const d = solveLin(A.map(r => Array.from(r)), Array.from(g));
    const Xn = X.map((x, i) => x + d[i]), rn = f(Xn), cn = sq(rn);
    if (cn < cost) { X = Xn; cost = cn; lam = Math.max(lam / 3, 1e-9); ({ r0, J } = jac(X, f)); if (Math.max(...d.map(Math.abs)) < 1e-9) break; }
    else { lam *= 4; if (lam > 1e8) break; } }
  return X; }
export function rankOf(rows, tol = 1e-4) { const M = rows.map(r => { const l = Math.hypot(...r) || 1; return Array.from(r, x => x / l); });
  let rank = 0; const nc = M.length ? M[0].length : 0;
  for (let c = 0; c < nc && rank < M.length; c++) { let p = rank; for (let r = rank + 1; r < M.length; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < tol) continue; [M[rank], M[p]] = [M[p], M[rank]];
    for (let r = 0; r < M.length; r++) { if (r === rank) continue; const f = M[r][c] / M[rank][c]; if (!f) continue; for (let k = c; k < nc; k++) M[r][k] -= f * M[rank][k]; }
    rank++; }
  return rank; }
export function rowFor(c, X, wind) { const f = XX => [conRes(c, toPts(XX), wind)]; return jac(X.slice(), f).J[0]; }

export function estScale(m) { const rs = [], n = m.n; let mx = 1;
  m.sides.forEach((v, i) => { const px = hyp(m.prior[i], m.prior[(i + 1) % n]); mx = Math.max(mx, px); if (v != null && px > 1) rs.push(Math.log(v / 100 / px)); });
  m.diags.forEach(d => { if (d.cm != null) { const px = hyp(m.prior[d.i], m.prior[d.j]); if (px > 1) rs.push(Math.log(d.cm / 100 / px)); } });
  if (!rs.length) return 4 / mx; return Math.exp(rs.reduce((a, b) => a + b, 0) / rs.length); }

export function analyze(m, X) { const n = m.n, wind = m.wind, cons = buildCons(m), need = NEED(n), P = toPts(X);
  const { r0, J } = cons.length ? jac(X.slice(), XX => resid(XX, cons, null, wind)) : { r0: [], J: [] };
  const rank = rankOf(J), missing = Math.max(0, need - rank);
  const res = cons.map((c, k) => ({ label: c.label, t: c.t, diag: !!c.diag, v: c.t === 'len' ? r0[k] * 100 : r0[k] / W_ANG * DEG }));
  const worst = res.filter(r => r.t === 'len').sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0] || null;
  const worstAng = res.filter(r => r.t === 'ang').sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0] || null;
  const empty = m.sides.map((v, i) => v == null ? i : -1).filter(i => i >= 0);
  let afterSides = missing;
  if (empty.length && missing > 0) { const rows = J.concat(empty.map(i => rowFor({ t: 'len', i, j: (i + 1) % n, v: 0 }, X, wind))); afterSides = Math.max(0, need - rankOf(rows)); }
  const sug = { diags: [], angs: [] };
  if (afterSides > 0) { const have = new Set(m.diags.map(d => d.i + '-' + d.j)), cands = [];
    const base = J.concat(empty.map(i => rowFor({ t: 'len', i, j: (i + 1) % n, v: 0 }, X, wind))), rank0 = rankOf(base);
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1) && !have.has(i + '-' + j) && isInteriorDiag(P, i, j)) cands.push([i, j, hyp(P[i], P[j])]);
    cands.sort((a, b) => b[2] - a[2]); let rows = base.slice(), rk = rank0;
    for (const [i, j] of cands) { if (rk >= need) break; const row = rowFor({ t: 'len', i, j, v: 0 }, X, wind); const r2 = rankOf(rows.concat([row])); if (r2 > rk) { rows.push(row); rk = r2; sug.diags.push([i, j]); } }
    m.vert.forEach((vt, i) => { if (vt.kind === 'free' && sug.angs.length < 3 && rankOf(base.concat([rowFor({ t: 'ang', i, v: 90 }, X, wind)])) > rank0) sug.angs.push(i); }); }
  return { need, rank, missing, afterSides, res, worst, worstAng, empty, sug }; }

// rotate so the longest wall between right angles lies exactly on an axis
export function alignPts(P, vert) { const n = P.length; let best = -1, bl = -1, bs = -1;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, l = hyp(P[i], P[j]), sc = vert ? (vert[i].kind === 'ortho' ? 1 : 0) + (vert[j].kind === 'ortho' ? 1 : 0) : 0;
    if (sc > bs || (sc === bs && l > bl)) { bs = sc; bl = l; best = i; } }
  if (best < 0) return P; const j = (best + 1) % n, a = Math.atan2(P[j].y - P[best].y, P[j].x - P[best].x), d = Math.round(a / (Math.PI / 2)) * (Math.PI / 2) - a;
  if (Math.abs(d) < 1e-9 || (bs === 0 && Math.abs(d) > 10 / DEG)) return P;
  const c = Math.cos(d), sn = Math.sin(d), cx = P.reduce((q, p) => q + p.x, 0) / n, cy = P.reduce((q, p) => q + p.y, 0) / n;
  return P.map(p => ({ x: cx + (p.x - cx) * c - (p.y - cy) * sn, y: cy + (p.x - cx) * sn + (p.y - cy) * c })); }
export function makeModel(pts) { const n = pts.length, wind = windOf(pts);
  const vert = pts.map((p, i) => { const d = interiorDeg(pts, i, wind); if (Math.abs(d - 90) <= 4) return { kind: 'ortho', deg: 90 }; if (Math.abs(d - 270) <= 4) return { kind: 'ortho', deg: 270 }; return { kind: 'free', deg: null }; });
  return { n, wind, prior: pts.map(p => ({ x: p.x, y: p.y })), vert, sides: Array(n).fill(null), diags: [], sol: null, scale: null, status: null }; }
// Стартовая фигура: идём по контуру с введёнными длинами (недостающие — из наброска в масштабе)
// и поворотами: у прямых углов ровно ±90°, у заданных градусов — по ним, у свободных — как в наброске.
export function turtleGuess(m, scale) { const n = m.n, pr = m.prior, wind = m.wind;
  const turn = i => { const vt = m.vert[i]; if (vt.kind !== 'free' && vt.deg != null) return wind * (Math.PI - vt.deg / DEG); return turnAt(pr, i); };
  const len = i => m.sides[i] != null ? m.sides[i] / 100 : hyp(pr[i], pr[(i + 1) % n]) * scale;
  let h = Math.atan2(pr[1 % n].y - pr[0].y, pr[1 % n].x - pr[0].x);
  if (m.vert[0].kind === 'ortho' || m.vert[1 % n].kind === 'ortho') { const q = Math.round(h / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(wrap(h - q)) < Math.PI / 4) h = q; }
  const P = [{ x: 0, y: 0 }];
  for (let i = 0; i < n - 1; i++) { const L = len(i); P.push({ x: P[i].x + Math.cos(h) * L, y: P[i].y + Math.sin(h) * L }); h += turn(i + 1); }
  return P; }
export function solveModel(m) { const scale = estScale(m), prior = turtleGuess(m, scale);
  let X = flat(prior); // старт от фигуры по длинам и поворотам: по мере ввода она не кривится и не складывается
  const cons = buildCons(m); X = lm(X, XX => resid(XX, cons, prior, m.wind));
  m.sol = alignPts(toPts(X), m.vert); m.scale = scale; m.status = analyze(m, X); return m; }

// ───────── baked polygon: v[i] = {x,y,fillet,arc}; side i goes v[i]→v[i+1], its arc lives on v[i] ─────────
export const ptsOf = poly => poly.v.map(p => ({ x: p.x, y: p.y }));
export function filletInfo(poly, i) { const P = ptsOf(poly), n = P.length, R = poly.v[i].fillet; if (!R) return null;
  const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], u1 = norm(sub(a, b)), u2 = norm(sub(c, b));
  const phi = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2)))); if (phi < 0.02 || phi > Math.PI - 0.02) return null;
  const t = R / Math.tan(phi / 2), bis = norm(add(u1, u2)), C = add(b, mul(bis, R / Math.sin(phi / 2)));
  return { R, t, C, T1: add(b, mul(u1, t)), T2: add(b, mul(u2, t)), phi, lp: hyp(a, b), ln: hyp(b, c) }; }
export function arcInfo(poly, i) { const P = ptsOf(poly), n = P.length, arc = poly.v[i].arc; if (!arc) return null;
  const A = P[i], B = P[(i + 1) % n], c = hyp(A, B), h = arc.h; if (!(h > 0) || c <= 0) return null;
  const R = c * c / (8 * h) + h / 2, M = mul(add(A, B), .5), nO = outNormal(P, i), d = arc.dir === 'out' ? nO : mul(nO, -1);
  const apex = add(M, mul(d, h)), C = sub(M, mul(d, R - h)), alpha = 2 * Math.asin(Math.min(1, c / (2 * R))), ang = h > R ? TAU - alpha : alpha;
  return { R, h, C, apex, ang, len: R * ang, c, dir: arc.dir }; }
export function flatten(poly, stepDeg = 3) { const P = ptsOf(poly), n = P.length, out = [];
  for (let i = 0; i < n; i++) { const fi = filletInfo(poly, i);
    if (fi) { const a1 = Math.atan2(fi.T1.y - fi.C.y, fi.T1.x - fi.C.x), a2 = Math.atan2(fi.T2.y - fi.C.y, fi.T2.x - fi.C.x), sw = wrap(a2 - a1);
      const steps = Math.max(3, Math.ceil(Math.abs(sw) * DEG / stepDeg));
      for (let k = 0; k <= steps; k++) { const a = a1 + sw * k / steps; out.push({ x: fi.C.x + fi.R * Math.cos(a), y: fi.C.y + fi.R * Math.sin(a) }); } }
    else out.push({ x: P[i].x, y: P[i].y });
    const ai = arcInfo(poly, i);
    if (ai) { const A = P[i], a1 = Math.atan2(A.y - ai.C.y, A.x - ai.C.x), at = s => ({ x: ai.C.x + ai.R * Math.cos(a1 + s), y: ai.C.y + ai.R * Math.sin(a1 + s) });
      let sw = ai.ang; if (hyp(at(sw / 2), ai.apex) > hyp(at(-sw / 2), ai.apex)) sw = -sw;
      const steps = Math.max(4, Math.ceil(Math.abs(sw) * DEG / stepDeg)); for (let k = 1; k < steps; k++) out.push(at(sw * k / steps)); } }
  return out; }
export function perimeterOf(P) { let p = 0; for (let i = 0; i < P.length; i++) p += hyp(P[i], P[(i + 1) % P.length]); return p; }
export function polyStats(poly) { const F = flatten(poly), P = ptsOf(poly), wind = windOf(P); let inner = 0, outer = 0;
  P.forEach((p, i) => { if (interiorDeg(P, i, wind) < 180) inner++; else outer++; });
  return { area: Math.abs(shoelace(F)), perim: perimeterOf(F), inner, outer, fillets: poly.v.filter(p => p.fillet).length, arcs: poly.v.filter(p => p.arc).length }; }
export function sideLen(poly, i) { const n = poly.v.length; return hyp(poly.v[i], poly.v[(i + 1) % n]); }
export function bakeModel(m) { return { v: m.sol.map(p => ({ x: p.x, y: p.y, fillet: null, arc: null })) }; }

// drop fillets that no longer fit; returns list of dropped letters
export function checkFillets(q) { const dropped = []; q.v.forEach((p, i) => { if (!p.fillet) return; const fi = filletInfo(q, i);
  if (!fi || fi.t > Math.min(fi.lp, fi.ln) / 2 + 1e-9) { p.fillet = null; dropped.push(L(i)); } }); return dropped; }

// ───────── edit operations: (poly, …) → new poly, or throw Error(text) ─────────
export function opDelete(poly, i) { if (poly.v.length <= 3) throw new Error('Меньше трёх углов оставить нельзя');
  const q = clone(poly), n = q.v.length; q.v[(i - 1 + n) % n].arc = null; q.v.splice(i, 1); return q; }
export function opAddPoint(poly, i, fromEnd, d) { const n = poly.v.length, A = poly.v[i], B = poly.v[(i + 1) % n], len = hyp(A, B);
  if (!(d > 0 && d < len)) throw new Error(`Расстояние должно быть от 1 до ${cm(len) - 1} см`);
  const u = norm(sub(B, A)), P = fromEnd === 'start' ? add(A, mul(u, d)) : sub(B, mul(u, d));
  const q = clone(poly); q.v[i].arc = null; q.v.splice(i + 1, 0, { x: P.x, y: P.y, fillet: null, arc: null }); return q; }
export function opShift(poly, i, off) { const P = ptsOf(poly), n = P.length, A = P[i], B = P[(i + 1) % n], u = norm(sub(B, A)), nO = outNormal(P, i);
  const A2 = add(A, mul(nO, off)), Pp = P[(i - 1 + n) % n], Pn = P[(i + 2) % n];
  const nA = lineX(Pp, sub(A, Pp), A2, u), nB = lineX(Pn, sub(B, Pn), A2, u);
  if (!nA || !nB) throw new Error('Соседняя стена параллельна этой, сдвинуть нельзя');
  if (dot(sub(nA, Pp), sub(A, Pp)) <= 0 || dot(sub(nB, Pn), sub(B, Pn)) <= 0 || dot(sub(nB, nA), u) <= 0) throw new Error('Сдвиг больше соседней стены');
  const q = clone(poly); Object.assign(q.v[i], { x: nA.x, y: nA.y }); Object.assign(q.v[(i + 1) % n], { x: nB.x, y: nB.y }); return q; }
export function opLength(poly, i, end, newLen) { const P = ptsOf(poly), n = P.length, u = norm(sub(P[(i + 1) % n], P[i])), dl = newLen - sideLen(poly, i);
  if (Math.abs(dl) < 1e-6) return clone(poly);
  const k = end === 'end' ? (i + 1) % n : (i - 1 + n) % n, s = dot(end === 'end' ? u : mul(u, -1), outNormal(P, k));
  if (Math.abs(s) < 0.05) throw new Error('Соседняя стена почти на одной линии, длину так не изменить');
  return opShift(poly, k, dl * s); }
export function opFillet(poly, i, R) { const n = poly.v.length; if (poly.v[i].arc || poly.v[(i - 1 + n) % n].arc) throw new Error('Рядом дуга. Сначала уберите её');
  const q = clone(poly); q.v[i].fillet = R || null; if (!R) return q;
  const fi = filletInfo(q, i); if (!fi) throw new Error('Этот угол нельзя скруглить');
  const Rmax = Math.min(fi.lp, fi.ln) / 2 * Math.tan(fi.phi / 2);
  if (fi.t > Math.min(fi.lp, fi.ln) / 2 + 1e-9) throw new Error(`Не помещается. Максимальный радиус ${cm(Rmax)} см`);
  return q; }
export function opArc(poly, i, mode, val, dir) { const n = poly.v.length; if (poly.v[i].fillet || poly.v[(i + 1) % n].fillet) throw new Error('На концах стены скругления. Сначала уберите их');
  const q = clone(poly); if (!val) { q.v[i].arc = null; return q; }
  const c = sideLen(poly, i); let h;
  if (mode === 'h') { h = val; if (h > c) throw new Error(`Стрела больше стороны. Максимум ${cm(c)} см`); }
  else { if (val <= c) throw new Error(`Длина дуги должна быть больше ${cm(c)} см`); const r = c / val; let lo = 1e-6, hi = Math.PI - 1e-6;
    for (let k = 0; k < 80; k++) { const x = (lo + hi) / 2; if (Math.sin(x) / x > r) lo = x; else hi = x; }
    const x = (lo + hi) / 2; if (x > Math.PI / 2 + 1e-6) throw new Error('Больше полукруга. Уменьшите длину дуги'); const R = c / (2 * Math.sin(x)); h = R * (1 - Math.cos(x)); }
  q.v[i].arc = { h, dir }; return q; }
export function opBump(poly, i, fromEnd, off, width, depth, dir) { const P = ptsOf(poly), n = P.length, A = P[i], B = P[(i + 1) % n], len = hyp(A, B);
  if (!(width > 0) || !(depth > 0)) throw new Error('Ширина и глубина должны быть больше нуля');
  if (off < 0 || off + width > len + 1e-9) throw new Error(`Не помещается на стене. Отступ + ширина не больше ${cm(len)} см`);
  const u = norm(sub(B, A)), d = mul(outNormal(P, i), dir === 'niche' ? 1 : -1);
  const p1 = fromEnd === 'start' ? add(A, mul(u, off)) : sub(B, mul(u, off + width)), p4 = add(p1, mul(u, width));
  const seq = [p1, add(p1, mul(d, depth)), add(p4, mul(d, depth)), p4];
  const vA = clone(poly.v[i]), vB = clone(poly.v[(i + 1) % n]); vA.arc = null;
  const mid = seq.map(p => ({ x: p.x, y: p.y, fillet: null, arc: null }));
  if (hyp(mid[0], A) <= 0.004) mid.shift(); if (hyp(mid[mid.length - 1], B) <= 0.004) mid.pop();
  const list = [vA, ...mid, vB];
  const q = clone(poly);
  if (i === n - 1) { q.v.splice(n - 1, 1); q.v.splice(0, 1); q.v.push(...list); } else q.v.splice(i, 2, ...list);
  if (q.v.length > 26) throw new Error('Больше 26 вершин пока нельзя'); return q; }


// ───────── quick shapes ─────────
export function rectPoly(a, b) { return { v: [[0, 0], [a, 0], [a, b], [0, b]].map(([x, y]) => ({ x, y, fillet: null, arc: null })) }; }
export function circumR(a, b, c) { const area = Math.abs(cross(sub(b, a), sub(c, a))) / 2; return area > 1e-12 ? hyp(a, b) * hyp(b, c) * hyp(c, a) / (4 * area) : Infinity; }
// ellipse as N chords with a circular arc through the true ellipse point of each span (exact for a circle)
export function ovalPoly(rx, ry, N) { N = N || (Math.max(rx, ry) / Math.min(rx, ry) > 2 ? 12 : 8); const P = t => ({ x: rx * Math.cos(t), y: ry * Math.sin(t) }), v = [];
  for (let k = 0; k < N; k++) { const t0 = -Math.PI / 2 + k * TAU / N, t1 = t0 + TAU / N, A = P(t0), B = P(t1), M = P((t0 + t1) / 2);
    const R = circumR(A, M, B), c = hyp(A, B), h = R - Math.sqrt(Math.max(0, R * R - c * c / 4)); v.push({ x: A.x, y: A.y, fillet: null, arc: { h, dir: 'out' } }); }
  return { v }; }
