const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const coordinate = value => Number(value.toFixed(2));
const EPSILON = 1e-9;

function signedArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function contour(value) {
  if (!Array.isArray(value) || value.length < 3 || value.some(point => !Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) return [];
  const points = value.filter((point, index) => !index || point[0] !== value[index - 1][0] || point[1] !== value[index - 1][1]);
  if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
  const area = signedArea(points);
  return points.length >= 3 && Number.isFinite(area) && Math.abs(area) > EPSILON ? points : [];
}

function perimeter(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
  }, 0);
}

function turnAt(points, index) {
  const previous = points[(index + points.length - 1) % points.length], point = points[index], next = points[(index + 1) % points.length];
  const incoming = Math.atan2(point[1] - previous[1], point[0] - previous[0]);
  const outgoing = Math.atan2(next[1] - point[1], next[0] - point[0]);
  const difference = Math.abs(outgoing - incoming) * 180 / Math.PI;
  return Math.min(difference, 360 - difference);
}

function grid(width, height) {
  // Direct paths keep separate drawings independent without duplicate SVG ids.
  let minor = '', major = '';
  for (let x = 0; x <= width; x += 5) {
    const line = `M${x} 0V${height}`;
    if (x % 25) minor += line; else major += line;
  }
  for (let y = 0; y <= height; y += 5) {
    const line = `M0 ${y}H${width}`;
    if (y % 25) minor += line; else major += line;
  }
  return `<path d="${minor}" fill="none" stroke="#edf2f6" stroke-width="0.4"/><path d="${major}" fill="none" stroke="#e0e9f1" stroke-width="0.5"/>`;
}

function overlaps(a, b) {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 2;
}

function segmentTouchesBox(a, b, box) {
  const left = box.x - box.width / 2 - 2, right = box.x + box.width / 2 + 2;
  const top = box.y - box.height / 2 - 2, bottom = box.y + box.height / 2 + 2;
  let start = 0, end = 1;
  for (const [origin, delta, low, high] of [[a[0], b[0] - a[0], left, right], [a[1], b[1] - a[1], top, bottom]]) {
    if (Math.abs(delta) < EPSILON) {
      if (origin < low || origin > high) return false;
    } else {
      const first = (low - origin) / delta, last = (high - origin) / delta;
      start = Math.max(start, Math.min(first, last));
      end = Math.min(end, Math.max(first, last));
      if (start > end) return false;
    }
  }
  return true;
}

function dimensionCandidates(label, rings, width, height, fontSize) {
  const candidates = [];
  const baseOffset = fontSize / 2 + 4;
  const maxShift = Math.min(12, Math.max(10, label.drawnLength / 3));
  const shifts = [0, -4, 4, -8, 8, -12, 12].filter(shift => Math.abs(shift) <= maxShift);
  for (const side of [1, -1]) {
    for (let offset = baseOffset; offset <= baseOffset + 12; offset += 4) {
      for (const shift of shifts) {
        const candidate = {
          x: label.midpoint[0] + label.normal[0] * offset * side + label.tangent[0] * shift,
          y: label.midpoint[1] + label.normal[1] * offset * side + label.tangent[1] * shift,
          width: label.boxWidth, height: label.boxHeight,
          offset: offset * side, shift,
          score: (offset - baseOffset) * 0.8 + Math.abs(shift) + (side < 0 ? 4 : 0),
        };
        const withinCanvas = candidate.x - candidate.width / 2 >= 3 && candidate.y - candidate.height / 2 >= 3
          && candidate.x + candidate.width / 2 <= width - 3 && candidate.y + candidate.height / 2 <= height - 3;
        if (!withinCanvas) continue;
        const crossesContour = rings.some(points => points.some((a, index) => segmentTouchesBox(a, points[(index + 1) % points.length], candidate)));
        candidates.push({ ...candidate, score: candidate.score + (crossesContour ? 1000 : 0) });
      }
    }
  }
  return candidates.sort((a, b) => a.score - b.score);
}

/** Pure geometry and label positions shared by HTML/PDF and native SVG adapters. */
export function roomDrawingLayout(room = {}, { compact = false } = {}) {
  const width = compact ? 340 : 688, height = compact ? 160 : 280;
  const fontSize = compact ? 9 : 12;
  const points = contour(room?.v);
  const holes = (Array.isArray(room?.holes) ? room.holes : []).map(contour).filter(points => points.length);
  const rings = points.length ? [points, ...holes] : [];
  const area = rings.length ? Math.max(0, Math.abs(signedArea(points)) - holes.reduce((sum, hole) => sum + Math.abs(signedArea(hole)), 0)) : 0;
  const boundary = rings.reduce((sum, points) => sum + perimeter(points), 0);
  const model = { width, height, compact, fontSize, name: String(room?.name || 'Помещение'), area, perimeter: boundary, rings: [], path: '', vertices: [], labels: [] };
  if (!rings.length) return model;
  const allPoints = rings.flat();
  const xs = allPoints.map(point => point[0]), ys = allPoints.map(point => point[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), spanX = Math.max(...xs) - minX, spanY = Math.max(...ys) - minY;
  const largestLabel = Math.max(...rings.flatMap(points => points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return String(Math.round(Math.hypot(next[0] - point[0], next[1] - point[1]) * 100)).length;
  })));
  const margin = Math.max(compact ? 22 : 40, largestLabel * fontSize * 0.32 + (compact ? 10 : 18));
  const scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY);
  const ox = (width - spanX * scale) / 2, oy = (height - spanY * scale) / 2;
  const transform = point => [ox + (point[0] - minX) * scale, oy + (point[1] - minY) * scale];
  const path = rings.map(points => `M${points.map(point => transform(point).map(coordinate).join(' ')).join('L')}Z`).join(' ');
  const transformedRings = rings.map(points => points.map(transform));
  const dimensions = [];
  const vertices = [];
  rings.forEach((points, ringIndex) => {
    const orientation = Math.sign(signedArea(points)) * (ringIndex ? -1 : 1);
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length], a = transform(point), b = transform(next);
      const dx = b[0] - a[0], dy = b[1] - a[1], drawnLength = Math.hypot(dx, dy);
      const turn = turnAt(points, index), nextTurn = turnAt(points, (index + 1) % points.length);
      // Curved edges are stored as short straight samples; retain their contour,
      // but label actual corners and longer edges instead of every curve sample.
      if (turn >= 25) vertices.push({ x: a[0], y: a[1], radius: compact ? 1.8 : 2.3 });
      if (drawnLength < EPSILON || (drawnLength < 30 && turn < 25 && nextTurn < 25)) return;
      const length = Math.round(Math.hypot(next[0] - point[0], next[1] - point[1]) * 100);
      const text = String(length), radians = Math.atan2(dy, dx);
      let degrees = radians * 180 / Math.PI;
      if (degrees > 90) degrees -= 180;
      if (degrees < -90) degrees += 180;
      const normal = [dy / drawnLength * orientation, -dx / drawnLength * orientation].map(value => value || 0);
      const textWidth = text.length * fontSize * 0.57 + 2, textHeight = fontSize + 2;
      const boxWidth = Math.abs(Math.cos(radians)) * textWidth + Math.abs(Math.sin(radians)) * textHeight;
      const boxHeight = Math.abs(Math.sin(radians)) * textWidth + Math.abs(Math.cos(radians)) * textHeight;
      dimensions.push({ text, lengthCm: length, ringIndex, edgeIndex: index, degrees: degrees || 0, normal, tangent: [dx / drawnLength, dy / drawnLength].map(value => value || 0), midpoint: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], textWidth, textHeight, boxWidth, boxHeight, drawnLength });
    });
  });
  const labels = [];
  dimensions.sort((a, b) => a.drawnLength - b.drawnLength).forEach(label => {
    const candidates = dimensionCandidates(label, transformedRings, width, height, fontSize);
    const box = candidates.find(candidate => !labels.some(other => overlaps(candidate, other.box)))
      || candidates.reduce((best, candidate) => {
        const collisions = labels.filter(other => overlaps(candidate, other.box)).length;
        const score = collisions * 10000 + candidate.score;
        return !best || score < best.score ? { ...candidate, score } : best;
      }, null)
      || { x: label.midpoint[0], y: label.midpoint[1], width: label.boxWidth, height: label.boxHeight, offset: 0, shift: 0 };
    labels.push({ ...label, x: box.x, y: box.y, box, fontSize });
  });
  return { ...model, rings: transformedRings, path, vertices, labels };
}

function svgFromLayout(model) {
  if (!model.path) return '';
  const { width, height, compact } = model;
  const vertices = model.vertices.map(vertex => `<circle cx="${coordinate(vertex.x)}" cy="${coordinate(vertex.y)}" r="${vertex.radius}" fill="#1d3e60"/>`).join('');
  const labels = model.labels.map(label => `<g transform="translate(${coordinate(label.x)} ${coordinate(label.y)}) rotate(${coordinate(label.degrees)})"><rect x="${coordinate(-label.textWidth / 2)}" y="${coordinate(-label.textHeight / 2)}" width="${coordinate(label.textWidth)}" height="${coordinate(label.textHeight)}" rx="1" fill="#fff"/><text x="0" y="0" dy="${coordinate(label.fontSize * 0.35)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${label.fontSize}" fill="#303942">${label.text}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(`Чертёж: ${model.name}`)}"><desc>Размеры в сантиметрах</desc><rect width="${width}" height="${height}" fill="#fff"/>${grid(width, height)}<path d="${model.path}" fill="#dee8f1" fill-rule="evenodd" stroke="#1d3e60" stroke-width="${compact ? 1.6 : 2}" stroke-linejoin="round"/>${vertices}${labels}</svg>`;
}

/** Standalone SVG; needs no browser, DOM, stylesheet or canvas measurements. */
export function roomDrawingSvg(room = {}, options = {}) {
  return svgFromLayout(roomDrawingLayout(room, options));
}

export const ESTIMATE_DRAWING_CSS = `
.estimate-document .estimate-drawing{border:1px solid #adc0cf;background:#fff;min-width:0;overflow:hidden}
.estimate-document .estimate-drawing-header{display:flex;align-items:baseline;justify-content:space-between;gap:8px 14px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid #1d3e60;color:#1d3e60}
.estimate-document .estimate-drawing-name{font-size:16px;line-height:1.25;font-weight:700;min-width:0;overflow-wrap:anywhere}
.estimate-document .estimate-drawing-metrics{font-size:12px;line-height:1.3;color:#647184;white-space:nowrap;flex-shrink:0}
.estimate-document .estimate-drawing svg{display:block;width:100%;height:auto}
.estimate-document .estimate-drawing-empty{display:flex;align-items:center;justify-content:center;min-height:280px;font-size:12px;color:#647184;padding:20px;text-align:center}
.estimate-document .estimate-drawing-compact .estimate-drawing-header{gap:3px 8px;padding:7px 9px;min-height:31px}
.estimate-document .estimate-drawing-compact .estimate-drawing-name{font-size:12px}
.estimate-document .estimate-drawing-compact .estimate-drawing-metrics{font-size:10px}
.estimate-document .estimate-drawing-compact .estimate-drawing-empty{min-height:160px;font-size:11px}
`;

export function roomDrawingHtml(room = {}, { compact = false } = {}) {
  const model = roomDrawingLayout(room, { compact });
  const metrics = model.path ? `<span class="estimate-drawing-metrics">S = ${number(model.area)} м² · P = ${number(Math.round(model.perimeter * 100))} см</span>` : '';
  return `<div class="estimate-drawing${compact ? ' estimate-drawing-compact' : ''} no-split"><div class="estimate-drawing-header"><strong class="estimate-drawing-name">${escape(model.name)}</strong>${metrics}</div>${model.path ? svgFromLayout(model) : '<div class="estimate-drawing-empty">Чертёж не добавлен</div>'}</div>`;
}
