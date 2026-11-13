import { calcPoly } from '../../utils/geometry.js';

/** Rebuild dimensions from the source image, without rounding intermediate coordinates. */
export function measureTracePoints(points, scale) {
  if (!Number.isFinite(scale) || scale <= 0 || points.length < 3
    || !points.every(point => point.length === 2 && point.every(Number.isFinite))) return null;
  const left = Math.min(...points.map(point => point[0]));
  const top = Math.min(...points.map(point => point[1]));
  const verts = points.map(([x, y]) => [(x - left) * scale, (y - top) * scale]);
  const lengths = verts.map((point, i) => {
    const next = verts[(i + 1) % verts.length];
    return Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
  const { a: area, p: perim } = calcPoly(verts);
  return { verts, lengths, area, perim };
}

export function recalibrateTraceRooms(rooms, scale) {
  return rooms.map(room => {
    const measured = measureTracePoints(room.imgPts || [], scale);
    if (!measured) return room;
    const aO = Math.round(measured.area * 100) / 100;
    const pO = Math.round(measured.perim * 100) / 100;
    return { ...room, v: measured.verts, aO, pO,
      ...(room.canvas ? { canvas: { ...room.canvas, qty: aO } } : {}),
      ...(room.mainProf ? { mainProf: { ...room.mainProf, qty: pO } } : {}),
    };
  });
}
