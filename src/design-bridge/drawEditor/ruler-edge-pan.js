const EDGE_ZONE = 36, MAX_SPEED = 120;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
/** Camera velocity in screen pixels per second, opposite to the held screen edge. */
export function rulerEdgeVelocity(point, bounds, direction, mode = 'grid') {
  const axis = (coordinate, size) => {
    if (!Number.isFinite(coordinate) || !Number.isFinite(size) || size <= 0) return 0;
    const zone = Math.min(EDGE_ZONE, size / 3), before = clamp((zone - coordinate) / zone, 0, 1), after = clamp((coordinate - (size - zone)) / zone, 0, 1);
    return MAX_SPEED * (before * before - after * after);
  };
  let x = axis(point.x, bounds.width), y = axis(point.y, bounds.height);
  if (mode !== 'free') { if (!direction) return { x: 0, y: 0 }; if (Math.abs(direction.x) >= Math.abs(direction.y)) y = 0; else x = 0; }
  return { x, y };
}
export function clipRulerPointer(point, bounds, inset = 12) {
  const coordinate = (value, size) => { const edge = Math.min(inset, Math.max(0, size / 2)); return clamp(value, edge, Math.max(edge, size - edge)); };
  return { x: coordinate(point.x, bounds.width), y: coordinate(point.y, bounds.height) };
}
