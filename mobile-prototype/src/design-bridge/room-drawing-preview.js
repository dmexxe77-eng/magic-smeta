import {
  clone, hyp, windOf, interiorDeg, shoelace, ptsOf, flatten, flattenHoles, holesOf,
  arcInfo, filletInfo, sideLen, opHole, opHoleDelete, withHole, checkFillets, checkHoles,
  opLength, opAddPoint, opShift, opArc, opBump, opFillet, opDelete,
} from './drawEditor/geometry.js';

const INNER = '#16A34A', OUTER = '#FF3B30';
const finite = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const round = value => Math.round(value * 100) / 100;
function validRing(ring) {
  if (!Array.isArray(ring)) return [];
  const points = ring.map(point => Array.isArray(point) ? { x: point[0], y: point[1] } : point);
  if (points.length < 3 || !points.every(finite)) return [];
  return points.filter((point, index) => hyp(point, points[(index + 1) % points.length]) > 1e-8);
}
function replayOperation(poly, operation) {
  if (operation.kind === 'hole') return opHole(poly, operation);
  if (operation.kind === 'holeDel') return opHoleDelete(poly, operation.h);
  if (operation.h != null) return withHole(poly, operation.h, hole => {
    const updated = replayOperation(hole, { ...operation, h: undefined });
    checkHoles(updated); checkFillets(updated);
    return updated;
  });
  switch (operation.kind) {
    case 'len': return opLength(poly, operation.i, operation.end, operation.len);
    case 'add': return opAddPoint(poly, operation.i, operation.from, operation.d);
    case 'shift': return opShift(poly, operation.i, operation.off);
    case 'arc': return opArc(poly, operation.i, operation.mode, operation.val, operation.dir);
    case 'bump': return opBump(poly, operation.i, operation.from, operation.off, operation.w, operation.dp, operation.dir, operation.topologyVersion ?? 1);
    case 'fillet': return opFillet(poly, operation.i, operation.r);
    case 'del': return opDelete(poly, operation.i);
    default: throw new Error('Unknown drawing operation');
  }
}
function roomPolygon(room) {
  const drawing = room?.draw;
  if (drawing?.base && validRing(drawing.base.v).length >= 3 && Array.isArray(drawing.ops)) {
    try {
      let poly = clone(drawing.base);
      for (const operation of drawing.ops) {
        poly = replayOperation(poly, operation);
        checkHoles(poly); checkFillets(poly);
      }
      const rings = [poly, ...holesOf(poly)];
      if (rings.every(ring => ring.v.length >= 3 && ring.v.every(finite) && flatten(ring).every(finite))) return { poly, exact: true };
    } catch { /* Older or unsupported metadata falls back to the saved, visible room contour. */ }
  }
  const points = validRing(room?.v);
  const holes = (Array.isArray(room?.holes) ? room.holes : []).map(validRing).filter(ring => ring.length >= 3);
  return { poly: { v: points, holes: holes.map(v => ({ v })) }, exact: false };
}
function readDimension(poly, index) {
  const points = ptsOf(poly), next = (index + 1) % points.length, arc = arcInfo(poly, index);
  if (arc) {
    const a = points[index], b = points[next], middle = arc.apex;
    return { a, b, middle, length: arc.len, curved: true };
  }
  const start = filletInfo(poly, index)?.T2 || points[index];
  const end = filletInfo(poly, next)?.T1 || points[next];
  return { a: start, b: end, middle: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, length: sideLen(poly, index), curved: false };
}
function sideTangent(poly, index, atEnd) {
  const points = ptsOf(poly), a = points[index], b = points[(index + 1) % points.length], arc = arcInfo(poly, index);
  if (!arc) { const length = hyp(a, b) || 1; return { x: (b.x - a.x) / length, y: (b.y - a.y) / length }; }
  const start = Math.atan2(a.y - arc.C.y, a.x - arc.C.x), middle = direction => ({ x: arc.C.x + arc.R * Math.cos(start + direction * arc.ang / 2), y: arc.C.y + arc.R * Math.sin(start + direction * arc.ang / 2) });
  const direction = hyp(middle(1), arc.apex) <= hyp(middle(-1), arc.apex) ? 1 : -1;
  const point = atEnd ? b : a, radius = { x: point.x - arc.C.x, y: point.y - arc.C.y }, length = Math.hypot(radius.x, radius.y) || 1;
  return { x: -radius.y / length * direction, y: radius.x / length * direction };
}
function cornerDegrees(poly, index, winding) {
  const incoming = sideTangent(poly, (index - 1 + poly.v.length) % poly.v.length, true), outgoing = sideTangent(poly, index, false);
  const turn = Math.atan2(incoming.x * outgoing.y - incoming.y * outgoing.x, incoming.x * outgoing.x + incoming.y * outgoing.y);
  return ((180 - winding * turn * 180 / Math.PI) % 360 + 360) % 360;
}
/** Pure SVG data for the calculator. Coordinates stay numeric; no room text enters markup. */
export function roomDrawingPreview(room, options = {}) {
  const size = (value, fallback) => Number.isFinite(value) && value >= 40 && value <= 2000 ? value : fallback;
  const width = size(options.width, 160), height = size(options.height, 132);
  const padding = Number.isFinite(options.padding) ? Math.max(8, Math.min(options.padding, Math.min(width, height) / 3)) : 20;
  const result = { path: '', dots: [], dimensions: [], grid: '', width, height, counts: { inner: 0, outer: 0 } };
  for (let x = 0; x <= width; x += 20) result.grid += `M${x} 0V${height}`;
  for (let y = 0; y <= height; y += 20) result.grid += `M0 ${y}H${width}`;
  const { poly, exact } = roomPolygon(room), outer = poly.v;
  if (outer.length < 3) return result;
  const outline = flatten(poly), rings = [outline, ...flattenHoles(poly)];
  const area = shoelace(outline);
  if (!rings.every(ring => ring.length >= 3 && ring.every(finite)) || !Number.isFinite(area) || Math.abs(area) < 1e-8) return result;
  const all = rings.flat(), minX = Math.min(...all.map(point => point.x)), maxX = Math.max(...all.map(point => point.x));
  const minY = Math.min(...all.map(point => point.y)), maxY = Math.max(...all.map(point => point.y));
  if (![maxX - minX, maxY - minY].every(Number.isFinite)) return result;
  const scale = Math.min((width - 2 * padding) / Math.max(maxX - minX, .001), (height - 2 * padding) / Math.max(maxY - minY, .001));
  const to = point => ({ x: (width - (maxX - minX) * scale) / 2 + (point.x - minX) * scale, y: (height - (maxY - minY) * scale) / 2 + (point.y - minY) * scale });
  result.path = rings.map(ring => ring.map((point, index) => { const p = to(point); return (index ? 'L' : 'M') + round(p.x) + ' ' + round(p.y); }).join('') + 'Z').join(' ');
  const labels = [];
  [poly, ...holesOf(poly)].forEach((ring, holeIndex) => {
    const points = ptsOf(ring), winding = windOf(points);
    for (let index = 0; index < points.length; index++) {
      const degrees = exact ? cornerDegrees(ring, index, winding) : interiorDeg(points, index, winding), turning = Math.abs(180 - degrees);
      // A legacy flattened curve contains many small bends, not separate ceiling corners.
      const curvedJoin = ring.v[index].arc && ring.v[(index - 1 + points.length) % points.length].arc;
      const corner = turning > (curvedJoin || (!exact && points.length > 16) ? 15 : .5) && !ring.v[index].fillet;
      if (corner) {
        const materialDegrees = holeIndex ? 360 - degrees : degrees, kind = materialDegrees < 180 ? 'inner' : 'outer', point = to(points[index]);
        result.dots.push({ cx: round(point.x), cy: round(point.y), fill: kind === 'inner' ? INNER : OUTER, kind, degrees: round(materialDegrees) });
        result.counts[kind]++;
      }
      const dimension = readDimension(ring, index), a = to(dimension.a), b = to(dimension.b), middle = to(dimension.middle);
      const visibleLength = hyp(a, b), centimetres = Math.round(dimension.length * 100);
      if (!Number.isFinite(centimetres) || centimetres <= 0 || visibleLength < 27 || (!exact && points.length > 16 && !corner)) continue;
      let rotation = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      if (rotation >= 90) rotation -= 180;
      if (rotation < -90) rotation += 180;
      labels.push({ x: round(middle.x), y: round(middle.y), rotation: round(rotation), label: (dimension.curved ? '⌒ ' : '') + centimetres, priority: visibleLength });
    }
  });
  // Prefer the most legible walls; labels keep their own wall position and orientation.
  const boxes = [];
  for (const label of labels.sort((a, b) => b.priority - a.priority)) {
    if (result.dimensions.length >= 12) break;
    const radians = label.rotation * Math.PI / 180, labelWidth = label.label.length * 5.3 + 6;
    const box = { x: label.x, y: label.y, w: Math.abs(Math.cos(radians)) * labelWidth + Math.abs(Math.sin(radians)) * 11, h: Math.abs(Math.sin(radians)) * labelWidth + Math.abs(Math.cos(radians)) * 11 };
    if (boxes.some(other => Math.abs(other.x - box.x) < (other.w + box.w) / 2 + 2 && Math.abs(other.y - box.y) < (other.h + box.h) / 2 + 2)) continue;
    boxes.push(box); const { priority, ...visible } = label;
    result.dimensions.push({ ...visible, boxX: round(label.x - labelWidth / 2), boxY: round(label.y - 6), boxWidth: round(labelWidth) });
  }
  return result;
}
