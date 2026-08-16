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
  return { a: Math.max(w, h), b: Math.min(w, h) };
}

/* Расход полотна шириной W на габарит a×b.
   Полоса кроится во всю ширину ролика, длина — по второй стороне.
   Ориентацию выбираем ту, что дешевле: ролик может «лечь» и вдоль длинной стороны. */
export function canvasUsage(box, W) {
  if (!box || !W) return null;
  const { a, b } = box;
  const variants = [];
  /* одной полосой: ширина ролика перекрывает одну из сторон */
  if (W >= b) variants.push({ area: W * a, strips: 1, along: a });
  if (W >= a) variants.push({ area: W * b, strips: 1, along: b });
  /* не перекрывает — несколько полос со спайкой */
  if (!variants.length) {
    variants.push({ area: Math.ceil(b / W) * W * a, strips: Math.ceil(b / W), along: a });
    variants.push({ area: Math.ceil(a / W) * W * b, strips: Math.ceil(a / W), along: b });
  }
  /* при равном расходе — вариант с меньшим числом полос (меньше спаек) */
  const best = variants.sort((x, y) => x.area - y.area || x.strips - y.strips)[0];
  return { ...best, area: Math.round(best.area * 100) / 100, width: W };
}

/* Подобрать оптимальную ширину: минимальный расход, при равенстве — меньший ролик */
export function bestCanvasWidth(box, noms) {
  const opts = (noms || []).filter(n => n.w).map(n => ({ nom: n, use: canvasUsage(box, n.w) })).filter(x => x.use);
  if (!opts.length) return null;
  /* Приоритет: меньший расход → меньше полос → уже ролик.
     Иначе при равной площади выбирался узкий ролик с лишними спайками. */
  return opts.sort((x, y) =>
    x.use.area - y.use.area ||
    x.use.strips - y.use.strips ||
    x.nom.w - y.nom.w)[0];
}
