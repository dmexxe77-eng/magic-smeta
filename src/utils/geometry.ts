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
 * Count inner (90°) and outer (270°) angles
 */
export function countAngles(verts: Vertex[]): {
  inner: number;
  outer: number;
  total: number;
} {
  const n = verts.length;
  if (n < 3) return { inner: 0, outer: 0, total: 0 };

  let inner = 0;
  let outer = 0;

  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const curr = verts[i];
    const next = verts[(i + 1) % n];

    const ax = curr.x - prev.x;
    const ay = curr.y - prev.y;
    const bx = next.x - curr.x;
    const by = next.y - curr.y;

    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    const angDeg = Math.round(
      Math.abs((Math.atan2(Math.abs(cross), dot) * 180) / Math.PI)
    );

    if (angDeg === 90) {
      if (cross > 0) outer++;
      else inner++;
    }
  }
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
