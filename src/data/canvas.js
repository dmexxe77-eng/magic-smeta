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

/* Все ширины одной серии, по возрастанию */
export function canvasSiblings(nom, list) {
  if (!nom) return [];
  const key = seriesKey(nom.name);
  return (list || [])
    .filter(n => n.type === "canvas" && n.w && seriesKey(n.name) === key)
    .sort((a, b) => a.w - b.w);
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

/* Подобрать ширину: приоритет — без шва, среди равных по числу полос — экономнее */
export function bestCanvasWidth(box, noms, shrink = 0, dir = null) {
  const opts = (noms || []).filter(n => n.w).map(n => ({ nom: n, use: canvasUsage(box, n.w, shrink, dir) })).filter(x => x.use);
  if (!opts.length) return null;
  /* Шов дороже лишних метров: сначала цельное полотно (меньше полос),
     затем меньший расход, затем более узкий ролик. */
  return opts.sort((x, y) =>
    x.use.strips - y.use.strips ||
    x.use.area - y.use.area ||
    x.nom.w - y.nom.w)[0];
}
