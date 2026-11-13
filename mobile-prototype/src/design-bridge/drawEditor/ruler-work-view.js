// Two CSS pixels per centimetre at the ruler's 80 logical units per metre.
export const RULER_WORK_SCALE = 2.5;

const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const validBounds = bounds => bounds && Number.isFinite(bounds.width) && Number.isFinite(bounds.height) && bounds.width > 0 && bounds.height > 0;

/** Restore useful detail around the next corner without changing its world position. */
export function rulerWorkView(view, point, bounds, { precision = true } = {}) {
  if (!view || !(view.k > 0) || !Number.isFinite(view.k) || !Number.isFinite(view.dx) || !Number.isFinite(view.dy) || !validPoint(point) || !validBounds(bounds)) return view;
  const { width, height } = bounds;
  const k = precision ? Math.min(64, Math.max(RULER_WORK_SCALE, view.k)) : view.k;
  const screenX = point.x * view.k + view.dx, screenY = point.y * view.k + view.dy;
  const left = precision ? width * .25 : Math.min(36, width * .15), right = precision ? width * .75 : width - left;
  const top = precision ? height * .25 : Math.min(36, height * .15), bottom = precision ? height * .7 : height - top;
  const x = screenX < left || screenX > right ? width * .5 : screenX;
  const y = screenY < top || screenY > bottom ? height * .45 : screenY;
  const result = { k, dx: x - point.x * k, dy: y - point.y * k };
  return Object.values(result).every(Number.isFinite) ? result : view;
}

/** A temporary overview of every sketch vertex, including outlines larger than the screen. */
export function fitRulerView(points, bounds) {
  if (!Array.isArray(points) || !points.length || !points.every(validPoint) || !validBounds(bounds)) return null;
  const { width, height } = bounds, pad = Math.min(40, width * .15, height * .15);
  const x0 = Math.min(...points.map(point => point.x)), x1 = Math.max(...points.map(point => point.x));
  const y0 = Math.min(...points.map(point => point.y)), y1 = Math.max(...points.map(point => point.y));
  const w = x1 - x0, h = y1 - y0;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  const k = w || h ? Math.min(64, (width - 2 * pad) / Math.max(w, 1), (height - 2 * pad) / Math.max(h, 1)) : 1;
  const result = { k, dx: (width - w * k) / 2 - x0 * k, dy: (height - h * k) / 2 - y0 * k };
  return k > 0 && Object.values(result).every(Number.isFinite) ? result : null;
}
