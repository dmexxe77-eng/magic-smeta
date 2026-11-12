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

/** Keep the complete caption inside the room, shrinking it for an overview. */
export function layoutRoomLabel(points, name, area, measureText, obstacles = []) {
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
  const measureCaption = (lines, fontSize, scale = 1) => {
    const lineHeight = (fontSize + 3) * scale, areaSize = (fontSize - 1) * scale;
    return {
      lines, fontSize: fontSize * scale, lineHeight, areaSize,
      width: Math.max(...lines.map(line => measureText(line, fontSize * scale, 650)), measureText(area, areaSize, 650)),
      height: lines.length * lineHeight + areaSize + 3 * scale,
      margin: 9 * scale, areaGap: 3 * scale, haloWidth: 3 * scale,
    };
  };
  const findCandidate = (caption, avoidDimensions = false) => candidates.find(point => point.clearance >= caption.height / 2 + caption.margin
    && labelFitsRoom(points, { ...point, ...caption }, caption.margin)
    && (!avoidDimensions || obstacles.every(box => Math.abs(point.x - box.x) >= (caption.width + box.width) / 2 + caption.margin
      || Math.abs(point.y - box.y) >= (caption.height + box.height) / 2 + caption.margin)));
  const place = (point, caption) => ({ x: point.x, y: point.y, ...caption });
  for (const fontSize of [11.5, 11, 10.5, 10]) {
    for (const lines of variants) {
      const caption = measureCaption(lines, fontSize);
      const candidate = findCandidate(caption);
      if (candidate) return place(candidate, caption);
    }
  }
  // Scale the spacing and halo with the text, so small rooms keep their names
  // without the caption crossing a wall or a concave notch.
  const clearance = Math.max(0, ...candidates.map(point => Math.min(point.clearance, ...obstacles.map(box => Math.hypot(
    Math.max(0, Math.abs(point.x - box.x) - box.width / 2),
    Math.max(0, Math.abs(point.y - box.y) - box.height / 2),
  )))));
  // A tiny contour still keeps its caption if dimension boxes cover every
  // sampled interior point; containment takes precedence over the extra gap.
  if (clearance <= EPSILON) return obstacles.length ? layoutRoomLabel(points, name, area, measureText) : null;
  let best = null;
  for (const lines of variants) {
    const base = measureCaption(lines, 10);
    const radius = Math.hypot(base.width / 2 + base.margin, base.height / 2 + base.margin);
    let low = Math.min(1, clearance / radius * 0.98), high = 1;
    let caption = measureCaption(lines, 10, low), candidate = findCandidate(caption, true);
    if (!candidate) continue;
    let layout = place(candidate, caption);
    // Fit as large as possible; the inscribed-circle seed above also supports
    // very small contours without an arbitrary minimum font size.
    for (let i = 0; i < 10; i++) {
      const scale = (low + high) / 2;
      caption = measureCaption(lines, 10, scale);
      candidate = findCandidate(caption, true);
      if (candidate) { low = scale; layout = place(candidate, caption); }
      else high = scale;
    }
    if (!best || layout.fontSize > best.fontSize) best = layout;
  }
  return best;
}
