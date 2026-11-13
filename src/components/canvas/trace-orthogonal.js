const EPSILON = 1e-7;
const SNAP_DISTANCE = 10;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

function projection(origin, direction, point) {
  const along = (point[0] - origin[0]) * direction[0] + (point[1] - origin[1]) * direction[1];
  return [origin[0] + direction[0] * along, origin[1] + direction[1] * along];
}

function onSegment(a, b, p) {
  return Math.abs(cross([b[0] - a[0], b[1] - a[1]], [p[0] - a[0], p[1] - a[1]])) <= EPSILON &&
    p[0] >= Math.min(a[0], b[0]) - EPSILON && p[0] <= Math.max(a[0], b[0]) + EPSILON &&
    p[1] >= Math.min(a[1], b[1]) - EPSILON && p[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function segmentConflict(a, b, c, d, shared = null) {
  const orient = (p, q, r) => cross([q[0] - p[0], q[1] - p[1]], [r[0] - p[0], r[1] - p[1]]);
  const abC = orient(a, b, c), abD = orient(a, b, d), cdA = orient(c, d, a), cdB = orient(c, d, b);
  const opposite = (x, y) => (x > EPSILON && y < -EPSILON) || (x < -EPSILON && y > EPSILON);
  const intersects = (opposite(abC, abD) && opposite(cdA, cdB)) ||
    onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
  if (!intersects) return false;
  if (!shared) return true;
  // Only the incident endpoint is allowed; retracing an existing edge is not.
  if (Math.abs(abC) > EPSILON || Math.abs(abD) > EPSILON) return false;
  const axis = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1;
  const overlap = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) -
    Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
  return overlap > EPSILON;
}

function safeStartGuide(points, candidate) {
  const first = points[0], last = points[points.length - 1];
  const reachesFirst = distance(candidate, first) <= EPSILON;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index], b = points[index + 1];
    const shared = index === points.length - 2 ? last : index === 0 && reachesFirst ? first : null;
    if (segmentConflict(last, candidate, a, b, shared)) return false;
    if (!reachesFirst && segmentConflict(candidate, first, a, b, index === 0 ? first : null)) return false;
  }
  return reachesFirst || !segmentConflict(last, candidate, candidate, first, candidate);
}

/** Soft alignment uses screen distance, so short and long sides feel alike. */
export function projectOrthogonalPoint(points, point, screenScale = 1) {
  if (!points.length || !Number.isFinite(screenScale) || screenScale <= 0) return [...point];
  const tolerance = SNAP_DISTANCE / screenScale;
  const last = points[points.length - 1];
  const distinct = candidate => distance(last, candidate) > EPSILON;
  const nearby = candidate => distance(point, candidate) <= tolerance + EPSILON;
  let direction;
  if (points.length === 1) {
    direction = Math.abs(point[0] - last[0]) >= Math.abs(point[1] - last[1]) ? [1, 0] : [0, 1];
  } else {
    const previous = points[points.length - 2];
    const length = distance(previous, last);
    if (length > EPSILON) direction = [-(last[1] - previous[1]) / length, (last[0] - previous[0]) / length];
  }
  const perpendicular = direction && projection(last, direction, point);
  const primary = perpendicular && distinct(perpendicular) && nearby(perpendicular) ? perpendicular : null;

  // From the fourth corner onward, align with either guide through A.
  const first = points[0], firstLength = points.length >= 3 ? distance(first, points[1]) : 0;
  if (firstLength <= EPSILON) return primary || [...point];
  const u = [(points[1][0] - first[0]) / firstLength, (points[1][1] - first[1]) / firstLength];
  const guides = [u, [-u[1], u[0]]];
  const candidates = [];
  for (const guide of guides) {
    const aligned = projection(first, guide, point);
    if (!nearby(aligned)) continue;
    if (!primary) {
      if (distinct(aligned) && safeStartGuide(points, aligned)) candidates.push(aligned);
      continue;
    }
    const denominator = cross(direction, guide);
    if (Math.abs(denominator) <= 1e-6) continue;
    const offset = cross([first[0] - last[0], first[1] - last[1]], guide) / denominator;
    const joint = [last[0] + direction[0] * offset, last[1] + direction[1] * offset];
    if (distinct(joint) && nearby(joint) && safeStartGuide(points, joint)) candidates.push(joint);
  }
  candidates.sort((a, b) => distance(point, a) - distance(point, b));
  return candidates[0] || primary || [...point];
}
