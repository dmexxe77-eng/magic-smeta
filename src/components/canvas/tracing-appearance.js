// The tracing canvas uses the same light palette as the mobile drawing editor.
export const TRACE = Object.freeze({
  accent: '#1461EE',
  ink: '#24364B',
  contour: '#356FC0',
  outlineWidth: 1.6,
  soft: '#E7EFFD',
  stroke: 'rgba(20,97,238,0.9)',
  fill: 'rgba(20,97,238,0.04)',
  crosshair: 'rgba(20,97,238,0.7)',
  target: 'rgba(20,97,238,0.85)',
  text: '#0F1620',
  line: '#ECECF4',
});

export const DEFAULT_TRACE_VIEW = Object.freeze({
  rightAngles: true,
  opacity: 0.75,
  dimensions: true,
  roomNames: true,
  completed: true,
});

const ROOM_FILLS = [
  TRACE.fill,
  'rgba(20,97,238,0.065)',
  'rgba(20,97,238,0.09)',
];

/** Keep each room's soft blue shade consistent while drawing and after adding it. */
export function traceRoomFill(index) {
  return ROOM_FILLS[index % ROOM_FILLS.length];
}

/** Screen-space sizing keeps a distant overview free of crowded vertex marks. */
export function traceNodeScale(points = [], closed = true) {
  const edges = [];
  const edgeCount = closed ? points.length : Math.max(0, points.length - 1);
  for (let index = 0; index < edgeCount; index++) {
    const start = points[index], end = points[(index + 1) % points.length];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (Number.isFinite(length) && length > 0) edges.push(length);
  }
  if (!edges.length) return 1;
  edges.sort((a, b) => a - b);
  const middle = Math.floor(edges.length / 2);
  const median = edges.length % 2 ? edges[middle] : (edges[middle - 1] + edges[middle]) / 2;
  return Math.max(0.45, Math.min(1, median / 80));
}
