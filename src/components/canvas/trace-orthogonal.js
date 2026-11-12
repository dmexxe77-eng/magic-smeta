const EPSILON = 1e-7;
const MAX_DEVIATION = Math.tan(10 * Math.PI / 180);

/** Snap a new endpoint only within 10°; intentional slanted sides stay free. */
export function projectOrthogonalPoint(points, point) {
  if (!points.length) return [...point];
  const last = points[points.length - 1];
  const dx = point[0] - last[0], dy = point[1] - last[1];
  let nx, ny;
  if (points.length === 1) {
    [nx, ny] = Math.abs(dx) >= Math.abs(dy) ? [1, 0] : [0, 1];
  } else {
    const previous = points[points.length - 2];
    const length = Math.hypot(last[0] - previous[0], last[1] - previous[1]);
    if (length <= EPSILON) return [...point];
    nx = -(last[1] - previous[1]) / length;
    ny = (last[0] - previous[0]) / length;
  }
  const along = dx * nx + dy * ny;
  const across = dx * ny - dy * nx;
  if (Math.abs(across) > Math.abs(along) * MAX_DEVIATION + EPSILON) return [...point];
  return [last[0] + nx * along, last[1] + ny * along];
}
