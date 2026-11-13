// Conceptual measurement guides shared by the mobile and desktop drawing editors.
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const point = (x, y, label, { fixed = false } = {}) => `<circle cx="${x}" cy="${y}" r="3.5" class="guide-point${fixed ? ' guide-point-fixed' : ''}"/>${text(x, y + 19, label, 'guide-corner')}`;
const text = (x, y, label, className = 'guide-label', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${className}">${escape(label)}</text>`;
const path = (d, className = 'guide-result') => `<path d="${d}" class="${className}"/>`;
const room = (y = 92) => `<path d="M30 ${y}H290V154H30Z" class="guide-room"/>`;

function measurement(x1, y1, x2, y2, label, { x, y, anchor = 'middle' } = {}) {
  const length = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / length, uy = (y2 - y1) / length;
  const tick = (px, py) => `M${px - uy * 4} ${py + ux * 4}L${px + uy * 4} ${py - ux * 4}`;
  const arrow = (px, py, direction) => `M${px + direction * ux * 5 - uy * 2.5} ${py + direction * uy * 5 + ux * 2.5}L${px} ${py}L${px + direction * ux * 5 + uy * 2.5} ${py + direction * uy * 5 - ux * 2.5}`;
  return path(`M${x1} ${y1}L${x2} ${y2}${tick(x1, y1)}${tick(x2, y2)}${arrow(x1, y1, 1)}${arrow(x2, y2, -1)}`, 'guide-measure')
    + text(x ?? (x1 + x2) / 2, y ?? (y1 + y2) / 2 - 9, label, 'guide-label', anchor);
}

function size(op, key, label) {
  const value = parseFloat(String(op.f?.[key] ?? '').replace(',', '.'));
  const allowZero = op.kind === 'bump' && key === 'off';
  if (!Number.isFinite(value) || value < 0 || (value === 0 && !allowZero)) return label;
  let formatted = String(Number(value.toPrecision(7))).replace('.', ',');
  if (formatted.length > 11) formatted = value.toExponential(2).replace('.', ',');
  return `${label} · ${formatted} см`;
}

export function operationDescription(op, { a = 'A', b = 'B', inHole = false } = {}) {
  const from = op.seg?.from === 'end' ? b : a;
  if (op.kind === 'len') {
    const fixed = op.seg?.end === 'start' ? b : a, moved = op.seg?.end === 'start' ? a : b;
    return `Угол ${fixed} остаётся на месте. Угол ${moved} смещается до новой длины стены.`;
  }
  if (op.kind === 'add') return `Новая точка делит стену. Отсчёт — от угла ${from} вдоль стены.`;
  if (op.kind === 'shift') return inHole
    ? `Стена выреза сдвигается параллельно. ${op.seg?.dir === 'in' ? 'Вырез сужается.' : 'Вырез расширяется, площадь потолка уменьшается.'}`
    : `Стена сдвигается параллельно. ${op.seg?.dir === 'in' ? 'Комната уменьшается.' : 'Комната расширяется.'}`;
  if (op.kind === 'arc') return op.seg?.mode === 's'
    ? `Длина измеряется по кривой от ${a} до ${b}, а не по прямой между углами.`
    : 'Стрела — расстояние от середины прямой стены до вершины дуги.';
  if (op.kind === 'bump') return `Отступ — от ${from} до ближнего края. Ширина — вдоль стены, глубина — поперёк.`;
  if (op.kind === 'fillet') return 'Радиус задаёт размер скругления: от центра окружности до закруглённого края.';
  return '';
}

/** Plain text is escaped by the host editor when it is placed beside a field. */
export function operationFieldHelp(op, key, { a = 'A', b = 'B' } = {}) {
  const from = op.seg?.from === 'end' ? b : a;
  if (op.kind === 'len' && key === 'len') return `Полная новая длина по прямой между ${a} и ${b}, не прибавка к текущей.`;
  if (op.kind === 'add' && key === 'd') return `От угла ${from} до новой точки вдоль стены.`;
  if (op.kind === 'shift' && key === 'd') return 'Расстояние между старой и новой стеной по перпендикуляру.';
  if (op.kind === 'arc' && key === 'h') return 'От середины прямой между углами до вершины дуги. Это не радиус.';
  if (op.kind === 'arc' && key === 's') return `По самой дуге от ${a} до ${b}; больше прямого расстояния между ними.`;
  if (op.kind === 'bump' && key === 'off') return `От угла ${from} до ближайшего края вдоль стены. 0 — начать от угла.`;
  if (op.kind === 'bump' && key === 'w') return 'Расстояние между краями ниши или выступа вдоль стены.';
  if (op.kind === 'bump' && key === 'dp') return 'От исходной стены до новой грани по перпендикуляру.';
  if (op.kind === 'fillet' && key === 'r') return 'Радиус окружности скругления, не диаметр и не отступ от угла.';
  return '';
}

/** The drawn proportions explain each measurement; they are not a scale preview. */
export function operationGuide(op, { a = 'A', b = 'B', inHole = false, lengthCm } = {}) {
  if (!op || !['len', 'add', 'shift', 'arc', 'bump', 'fillet'].includes(op.kind)) return '';
  const seg = op.seg || {}, context = { a, b, inHole };
  let drawing = '', alt = '', showLegend = true;

  if (op.kind === 'len') {
    const moveStart = seg.end === 'start', left = moveStart ? 40 : 60, right = moveStart ? 260 : 280;
    const oldLeft = moveStart ? 80 : left, oldRight = moveStart ? right : 240;
    drawing = room(91) + path(`M${oldLeft} 91H${oldRight}`, 'guide-before')
      + path(`M${left} 86H${right}`) + measurement(left, 48, right, 48, size(op, 'len', 'Новая длина'))
      + path(`M${left} 58V78M${right} 58V78`, 'guide-extension')
      + point(left, 86, a, { fixed: !moveStart }) + point(right, 86, b, { fixed: moveStart })
      + text(moveStart ? right : left, 137, 'закреплён', 'guide-muted');
    alt = `Новая длина стены ${a}${b}; закреплён угол ${moveStart ? b : a}.`;
  }

  if (op.kind === 'add') {
    const fromEnd = seg.from === 'end', x = fromEnd ? 202 : 118, start = fromEnd ? 280 : 40;
    drawing = room(92) + path('M40 92H280', 'guide-wall')
      + measurement(Math.min(start, x), 49, Math.max(start, x), 49, size(op, 'd', 'Расстояние'))
      + path(`M${x} 57V83`, 'guide-extension') + point(40, 92, a, { fixed: true }) + point(280, 92, b, { fixed: true })
      + point(x, 92, 'точка') + text(x, 138, 'новая', 'guide-muted');
    alt = `Расстояние от угла ${fromEnd ? b : a} вдоль стены до новой точки.`;
    showLegend = false;
  }

  if (op.kind === 'shift') {
    const inward = seg.dir === 'in', oldY = inward ? 62 : 111, newY = inward ? 111 : 62;
    drawing = room(oldY) + path(`M40 ${oldY}H233`, 'guide-before')
      + path(`M40 ${newY}H233`) + path(`M40 ${Math.min(oldY, newY)}V151M233 ${Math.min(oldY, newY)}V151`, 'guide-extension')
      + measurement(157, oldY, 157, newY, size(op, 'd', 'Сдвиг'), { x: 171, y: 91, anchor: 'start' })
      + point(40, newY, a) + point(233, newY, b);
    alt = 'Сдвиг стены: размер измеряется перпендикулярно между старым и новым положениями.';
  }

  if (op.kind === 'arc') {
    const inward = seg.dir === 'in', baseY = inward ? 65 : 115, apexY = inward ? 121 : 59, controlY = 2 * apexY - baseY;
    drawing = room(baseY) + path(`M40 ${baseY}H280`, 'guide-before')
      + path(`M40 ${baseY}Q160 ${controlY} 280 ${baseY}`)
      + point(40, baseY, a) + point(280, baseY, b);
    if (seg.mode === 's') {
      drawing += text(160, inward ? 153 : 31, size(op, 's', 'Длина по дуге'));
    } else {
      drawing += measurement(160, baseY, 160, apexY, size(op, 'h', 'Стрела'), { x: 171, y: 91, anchor: 'start' })
        + path(`M150 ${baseY}V${baseY + (inward ? 10 : -10)}H160`, 'guide-extension');
    }
    alt = seg.mode === 's' ? `Длина по изогнутой линии от ${a} до ${b}.` : 'Стрела дуги: перпендикуляр от середины хорды до вершины дуги.';
  }

  if (op.kind === 'bump') {
    const fromEnd = seg.from === 'end', outward = seg.dir === 'niche';
    const offset = parseFloat(String(op.f?.off ?? '').replace(',', '.')), width = parseFloat(String(op.f?.w ?? '').replace(',', '.'));
    const nearAtCorner = offset === 0;
    const farAtCorner = Number.isFinite(lengthCm) && lengthCm > 0 && offset >= 0 && width > 0
      && Math.abs(offset + width - lengthCm) <= Math.max(1e-6, lengthCm * 1e-9);
    const x1 = fromEnd ? (farAtCorner ? 40 : 100) : (nearAtCorner ? 40 : 115);
    const x2 = fromEnd ? (nearAtCorner ? 280 : 205) : (farAtCorner ? 280 : 220);
    const wallY = outward ? 103 : 73, stepY = outward ? 57 : 119, from = fromEnd ? 280 : 40, near = fromEnd ? x2 : x1;
    const resultPath = (x1 === 40 ? `M40 ${stepY}` : `M40 ${wallY}H${x1}V${stepY}`)
      + `H${x2}` + (x2 === 280 ? '' : `V${wallY}H280`);
    const offsetLabel = nearAtCorner
      ? text(from, outward ? 134 : 22, size(op, 'off', 'Отступ'), 'guide-label', fromEnd ? 'end' : 'start')
      : measurement(Math.min(from, near), outward ? 143 : 31, Math.max(from, near), outward ? 143 : 31, size(op, 'off', 'Отступ'));
    drawing = room(wallY) + path(`M${x1} ${wallY}H${x2}`, 'guide-before')
      + path(resultPath) + offsetLabel
      + measurement(x1, outward ? 30 : 152, x2, outward ? 30 : 152, size(op, 'w', 'Ширина'))
      + measurement(247, wallY, 247, stepY, 'Глубина', { x: 254, y: (wallY + stepY) / 2 + 4, anchor: 'start' })
      + point(40, x1 === 40 ? stepY : wallY, a) + point(280, x2 === 280 ? stepY : wallY, b);
    alt = `Ниша или выступ: отступ от ${fromEnd ? b : a} до ближнего края, ширина вдоль стены, глубина перпендикулярно стене.`;
  }

  if (op.kind === 'fillet') {
    const centerX = 137, centerY = 103, radius = 55;
    drawing = `<path d="M82 158V48H280V158Z" class="guide-room"/>`
      + path('M82 158V48H280', 'guide-before') + path('M82 158V103A55 55 0 0 1 137 48H280')
      + path('M130 103H144M137 96V110', 'guide-center')
      + measurement(centerX, centerY, centerX - radius / Math.SQRT2, centerY - radius / Math.SQRT2, '', { x: centerX, y: centerY })
      + text(172, 88, size(op, 'r', 'Радиус'), 'guide-label', 'start') + text(151, 122, 'центр', 'guide-muted', 'start')
      + text(70, 37, a, 'guide-corner');
    alt = 'Радиус скругления — линия от центра окружности до закруглённого края.';
  }

  const legend = showLegend ? '<div class="operation-guide-legend" aria-hidden="true"><span class="guide-legend-before">До</span><span class="guide-legend-after">После</span><span class="guide-not-scale">Схема</span></div>' : '';
  return `<figure class="operation-guide" data-operation="${escape(op.kind)}"><svg class="operation-diagram" viewBox="0 0 320 175" role="img" aria-label="${escape(alt)}">${drawing}</svg>${legend}<figcaption>${escape(operationDescription(op, context))}</figcaption></figure>`;
}
