// Drawing units are logical coordinates, not physical screen centimetres.
export const RULER_UNITS_PER_METRE = 80;
export function rulerCandidate(origin, target, mode = 'grid', options = {}) {
  let dx = target.x - origin.x, dy = target.y - origin.y;
  if (mode !== 'free') { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-6) return null;
  const cm = Math.max(1, Math.round(length / RULER_UNITS_PER_METRE * 100));
  const direction = { x: dx / length, y: dy / length };
  const candidate = candidateAt(origin, direction, cm);
  const anchor = options.anchor, scale = options.screenScale, threshold = options.snapPx ?? 7;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !(scale > 0) || !Number.isFinite(scale) || !(threshold > 0) || !Number.isFinite(threshold)) return candidate;
  // Test the finger position before centimetre rounding: at high zoom that
  // rounding can move the preview farther than the entire magnetic zone.
  const point = { ...candidate.point }, distanceX = Math.abs(origin.x + dx - anchor.x) * scale, distanceY = Math.abs(origin.y + dy - anchor.y) * scale;
  let snappedX = false, snappedY = false;
  if (mode !== 'free') {
    if (direction.x && distanceX <= threshold) { point.x = anchor.x; snappedX = true; }
    if (direction.y && distanceY <= threshold) { point.y = anchor.y; snappedY = true; }
  } else if (Math.hypot(distanceX, distanceY) <= threshold) { point.x = anchor.x; point.y = anchor.y; snappedX = snappedY = true; }
  else if (distanceX <= threshold && (distanceY > threshold || distanceX <= distanceY)) { point.x = anchor.x; snappedX = true; }
  else if (distanceY <= threshold) { point.y = anchor.y; snappedY = true; }
  if (!snappedX && !snappedY) return candidate;
  const snappedLength = Math.hypot(point.x - origin.x, point.y - origin.y);
  if (snappedLength < 1e-6) return candidate;
  return { point, cm: Math.max(1, Math.round(snappedLength / RULER_UNITS_PER_METRE * 100)), direction: { x: (point.x - origin.x) / snappedLength, y: (point.y - origin.y) / snappedLength }, snappedX, snappedY, closes: Math.hypot(point.x - anchor.x, point.y - anchor.y) < 1e-6 };
}
function candidateAt(origin, direction, cm) {
  const length = cm / 100 * RULER_UNITS_PER_METRE;
  return { cm, direction, point: { x: origin.x + direction.x * length, y: origin.y + direction.y * length } };
}
export function adjustRulerCandidate(candidate, origin, delta) {
  if (!candidate || !Number.isFinite(delta)) return candidate;
  return candidateAt(origin, candidate.direction, Math.max(1, Math.min(100000, candidate.cm + Math.round(delta))));
}
