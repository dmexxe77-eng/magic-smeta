const EPSILON = 1e-7;

export function pointInRoom([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function distanceToEdge([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function edgeCrossesBox(a, b, left, top, right, bottom) {
  let first = 0, last = 1;
  for (const [start, delta, min, max] of [[a[0], b[0] - a[0], left, right], [a[1], b[1] - a[1], top, bottom]]) {
    if (Math.abs(delta) < EPSILON) {
      if (start < min || start > max) return false;
      continue;
    }
    const near = (min - start) / delta, far = (max - start) / delta;
    first = Math.max(first, Math.min(near, far));
    last = Math.min(last, Math.max(near, far));
    if (first > last) return false;
  }
  return true;
}

export function labelFitsRoom(points, { x, y, width, height }, margin = 0) {
  const left = x - width / 2 - margin, right = x + width / 2 + margin;
  const top = y - height / 2 - margin, bottom = y + height / 2 + margin;
  if (![[left, top], [right, top], [right, bottom], [left, bottom]].every(p => pointInRoom(p, points))) return false;
  // A concave notch can cross the label even when all four corners are inside.
  return !points.some((p, i) => edgeCrossesBox(p, points[(i + 1) % points.length], left, top, right, bottom));
}

function areaCenter(points) {
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    area += cross; x += (a[0] + b[0]) * cross; y += (a[1] + b[1]) * cross;
  }
  return Math.abs(area) > EPSILON ? [x / (3 * area), y / (3 * area)] : null;
}

function nameVariants(name) {
  const words = name.trim().split(/\s+/);
  const variants = [[words.join(' ')]];
  for (let i = 1; i < words.length; i++) variants.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
  return variants;
}

/** Position a complete, readable caption inside the room, never across a wall. */
export function layoutRoomLabel(points, name, area, measureText) {
  if (points.length < 3 || !points.every(p => p.length === 2 && p.every(Number.isFinite))) return null;
  const center = areaCenter(points);
  if (!center) return null;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const candidates = [];
  const addCandidate = point => {
    if (!pointInRoom(point, points)) return;
    const clearance = Math.min(...points.map((p, i) => distanceToEdge(point, p, points[(i + 1) % points.length])));
    candidates.push({ x: point[0], y: point[1], clearance,
      score: clearance - 0.04 * Math.hypot(point[0] - center[0], point[1] - center[1]) });
  };
  addCandidate(center);
  addCandidate([(left + right) / 2, (top + bottom) / 2]);
  // Keep work bounded at high zoom, while retaining narrow corridors at normal zoom.
  const step = Math.max(6, Math.sqrt((right - left) * (bottom - top) / 1600));
  for (let y = top + step / 2; y < bottom; y += step) {
    for (let x = left + step / 2; x < right; x += step) addCandidate([x, y]);
  }
  // Exact scanline midpoints locate the wide arm of a narrow L-shaped room.
  const levels = [...new Set(ys)].sort((a, b) => a - b);
  for (let level = 0; level < levels.length - 1; level++) {
    const y = (levels[level] + levels[level + 1]) / 2, intersections = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if ((a[1] > y) !== (b[1] > y)) intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    });
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) addCandidate([(intersections[i] + intersections[i + 1]) / 2, y]);
  }
  candidates.sort((a, b) => b.score - a.score);
  const variants = nameVariants(name || 'Помещение');
  for (const fontSize of [11.5, 11, 10.5, 10]) {
    const lineHeight = fontSize + 3, areaSize = fontSize - 1;
    for (const lines of variants) {
      const width = Math.max(...lines.map(line => measureText(line, fontSize, 650)), measureText(area, areaSize, 650));
      const height = lines.length * lineHeight + areaSize + 3;
      const candidate = candidates.find(point => point.clearance >= height / 2 + 9 && labelFitsRoom(points, { ...point, width, height }, 9));
      if (candidate) return { x: candidate.x, y: candidate.y, width, height, lines, fontSize, lineHeight, areaSize };
    }
  }
  // Like very short wall dimensions, captions appear when zoom leaves readable space.
  return null;
}
