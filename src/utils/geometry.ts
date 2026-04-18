import type { Vertex } from '../types';

export interface PolyResult {
  a: number;   // area м²
  p: number;   // perimeter м.п.
}

/**
 * Calculate polygon area (Shoelace formula) and perimeter.
 * Vertices are in meters (float).
 */
export function calcPoly(verts: Vertex[]): PolyResult {
  const n = verts.length;
  if (n < 3) return { a: 0, p: 0 };

  let area = 0;
  let perim = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += verts[i].x * verts[j].y;
    area -= verts[j].x * verts[i].y;
    perim += Math.hypot(verts[j].x - verts[i].x, verts[j].y - verts[i].y);
  }
  return {
    a: Math.abs(area) / 2,
    p: perim,
  };
}

/**
 * Snap angle to nearest cardinal/intercardinal (0,45,90,...315°)
 */
export function snapAngle(deg: number, threshold = 6): number {
  const snaps = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  for (const s of snaps) {
    if (Math.abs(deg - s) < threshold) return s % 360;
  }
  return Math.round(deg);
}

/**
 * Build vertex list from compass sides
 */
export function buildVerticesFromSides(
  sides: Array<{ angle: number; cm: number }>
): Vertex[] {
  const pts: Vertex[] = [{ x: 0, y: 0 }];
  for (const s of sides) {
    const last = pts[pts.length - 1];
    const rad = (s.angle * Math.PI) / 180;
    pts.push({
      x: last.x + Math.sin(rad) * (s.cm / 100),
      y: last.y - Math.cos(rad) * (s.cm / 100),
    });
  }
  return pts;
}

/**
 * Get angles at each vertex (in degrees), matching web version algorithm.
 * Uses atan2-based signed angle and snaps to 90°/270° within ±15° tolerance.
 */
export function getAngles(verts: Vertex[]): number[] {
  const n = verts.length;
  if (n < 3) return [];
  // Convert to mm for better numerical precision (web version does same)
  const pts = verts.map(v => [v.x * 1000, v.y * 1000]);
  return pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const ba = [a[0] - b[0], a[1] - b[1]];
    const bc = [c[0] - b[0], c[1] - b[1]];
    let ang = Math.atan2(bc[1], bc[0]) - Math.atan2(ba[1], ba[0]);
    if (ang < 0) ang += 2 * Math.PI;
    let deg = 360 - (ang * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (Math.abs(deg - 90) < 15) deg = 90;   // snap to 90° within ±15°
    if (Math.abs(deg - 270) < 15) deg = 270; // snap to 270° within ±15°
    return Math.round(deg);
  });
}

/**
 * Count inner (90°) and outer (270°) angles — web version algorithm with tolerance.
 */
export function countAngles(verts: Vertex[]): {
  inner: number;
  outer: number;
  total: number;
} {
  if (!verts || verts.length < 3) return { inner: 0, outer: 0, total: 0 };
  const angs = getAngles(verts);
  const inner = angs.filter(d => d === 90).length;
  const outer = angs.filter(d => d === 270).length;
  return { inner, outer, total: inner + outer };
}

/**
 * Format number with spaces as thousands separator
 */
export function fmt(n: number): string {
  if (isNaN(n) || !isFinite(n)) return '0';
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
