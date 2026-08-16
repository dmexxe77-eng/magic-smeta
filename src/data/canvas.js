/* ═══ Полотно: ширина ролика и расчёт расхода ═══
   У каждого полотна есть ширина ролика (поле w, метры) — она разобрана из названия.
   Расход зависит от габарита помещения и выбранной ширины: полотно кроится
   полосой во всю ширину ролика, поэтому лишнее по краю оплачивается.

   Галочка «Перерасход материала» в блоке решает, считать так или по чистой площади:
   у поставщиков практика разная. */

/* Серия = название без указания ширины. По ней собираем «соседей» — те же полотна в других ширинах. */
export function seriesKey(name) {
  return String(name || "")
    .replace(/\(?\s*\d{2,3}\s*см\s*\)?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* Доступные ширины ролика полотна: список ws (метры) на позиции.
   Совместимость: у неархивных старых позиций может остаться одиночная w. */
export function widthList(nom, pool) {
  if (!nom) return null;
  if (Array.isArray(nom.ws) && nom.ws.length) return [...nom.ws].sort((a, b) => a - b);
  if (nom.w) {
    /* архивная позиция конкретной ширины (старые кнопки) — ищем серию с ws */
    const key = seriesKey(nom.name);
    const surv = (pool || []).find(n => n.type === "canvas" && Array.isArray(n.ws) && n.ws.length && seriesKey(n.name) === key);
    if (surv) return [...surv.ws].sort((a, b) => a - b);
    return [nom.w];
  }
  return null;
}

/* Габарит помещения по чертежу: {a — длинная сторона, b — короткая} */
export function roomBox(verts, z = 0) {
  if (!verts || verts.length < 3) return null;
  const xs = verts.map(p => p[0]), ys = verts.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs) + 2 * z;
  const h = Math.max(...ys) - Math.min(...ys) + 2 * z;
  /* ax — вдоль какой оси чертежа лежит длинная сторона a (для отрисовки) */
  return { a: Math.max(w, h), b: Math.min(w, h), ax: w >= h ? "x" : "y" };
}

/* Расход полотна шириной W на габарит a×b.
   Полоса кроится во всю ширину ролика, длина — по второй стороне.
   Ориентацию выбираем ту, что дешевле: ролик может «лечь» и вдоль длинной стороны. */
export function canvasUsage(box, W, shrink = 0, dir = null) {
  if (!box || !W) return null;
  /* Усадка: полотно заказывают меньше габарита и растягивают, поэтому ролик W
     перекрывает сторону до W/(1−s). На выбор ширины влияет, на расход — нет:
     площадь считаем по полному габариту. */
  const k = 1 - (Number(shrink) || 0) / 100;
  const { a, b } = box;
  const variants = [];
  /* полосы вдоль стороны side, ширина ролика перекрывает cross (с учётом усадки) */
  const along = (side, cross, name) => {
    const strips = Math.max(1, Math.ceil((cross * k) / W - 1e-9));
    variants.push({ area: strips * W * side, strips, along: side, dir: name });
  };
  if (dir === "a" || dir === "b") {
    /* направление раскроя задано вручную */
    dir === "a" ? along(a, b, "a") : along(b, a, "b");
  } else {
    if (W >= b * k - 1e-9) along(a, b, "a");
    if (W >= a * k - 1e-9) along(b, a, "b");
    if (!variants.length) { along(a, b, "a"); along(b, a, "b"); }
  }
  /* Приоритет — цельное полотно: сначала меньше полос, потом меньше расход. */
  const best = variants.sort((x, y) => x.strips - y.strips || x.area - y.area)[0];
  return { ...best, area: Math.round(best.area * 100) / 100, width: W };
}

/* ── Раскрой: настройки живут на кнопке ──
   ПВХ: усадка N% (полотно заказывают меньше и тянут — влияет на подбор ширины).
   Ткань: усадки нет, но припуск N см с каждой стороны (входит в габарит). */
export const isFabricName = name => /ткань|clipso|descor|cerutti|черутти/i.test(String(name || ""));
export const defaultCut = nom => isFabricName(nom?.name) ? { mode: "fabric", margin: 15 } : { mode: "pvc", shrink: 8 };
export function cutParams(preset, inst) {
  const cut = preset?.cut;
  if (cut) return cut.mode === "fabric"
    ? { mode: "fabric", shrink: 0, marginM: (cut.margin ?? 15) / 100, label: "припуск " + (cut.margin ?? 15) + " см/сторона" }
    : { mode: "pvc", shrink: cut.shrink ?? 8, marginM: 0, label: "усадка " + (cut.shrink ?? 8) + "%" };
  /* кнопка без настроек раскроя — прежнее поведение (усадка из комнаты, по умолчанию 8%) */
  const shrink = inst?.shrink == null ? 8 : inst.shrink;
  return { mode: null, shrink, marginM: inst?.margin || 0, label: "усадка " + shrink + "%" };
}

/* Подобрать ширину из списка: без шва → меньше расход → уже ролик */
export function bestWidth(box, ws, shrink = 0, dir = null) {
  const opts = (ws || []).map(w => ({ w, use: canvasUsage(box, w, shrink, dir) })).filter(x => x.use);
  if (!opts.length) return null;
  return opts.sort((x, y) => x.use.strips - y.use.strips || x.use.area - y.use.area || x.w - y.w)[0];
}
