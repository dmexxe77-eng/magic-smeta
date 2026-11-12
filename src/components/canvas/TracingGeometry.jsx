import { useLayoutEffect, useRef, useState } from 'react';
import { APPEARANCES, drawDimension, drawVertex } from '../../design-bridge/drawEditor/canvas-appearance.js';
import { L, add, norm, outNormal, sub } from '../../design-bridge/drawEditor/geometry.js';
import { TRACE, traceNodeScale } from './tracing-appearance.js';
import TraceRoomLabel from './TraceRoomLabel.jsx';
import { fmtCentimetres } from '../../utils/measurement-format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const geometryStyle = {
  ...APPEARANCES.technical.vars,
  '--paper': '#ffffff',
  '--ink': TRACE.ink,
  '--ink2': '#465B72',
  '--ink3': '#5D6F83',
};

function vertexOutward(points, index, closed, center) {
  const fallback = norm(sub(points[index], center));
  if (!closed || points.length < 3) {
    return Math.hypot(fallback.x, fallback.y) > 0 ? fallback : { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
  }
  const before = outNormal(points, (index - 1 + points.length) % points.length);
  const after = outNormal(points, index);
  const outward = add(before, after);
  return Math.hypot(outward.x, outward.y) > 1e-6 ? norm(outward) : after;
}

/** The PDF overlay uses the manual builder's dimension and vertex renderers. */
export default function TracingGeometry({
  points = [], closed = false, lengths = [], selectedSide = null,
  showDimensions = true, completed = false, roomLabel = null,
}) {
  const groupRef = useRef(null);
  const [dimensionBoxes, setDimensionBoxes] = useState([]);
  const labelPanX = roomLabel?.pan.x ?? 0, labelPanY = roomLabel?.pan.y ?? 0;
  const hasRoomLabel = !!roomLabel;

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.replaceChildren();
    if (!points.length) return;

    const vertices = points.map(([x, y]) => ({ x, y }));
    const count = vertices.length;
    const center = vertices.reduce((sum, point) => ({ x: sum.x + point.x / count, y: sum.y + point.y / count }), { x: 0, y: 0 });
    const svg = group.ownerSVGElement;
    const bounds = svg?.clientWidth > 0 && svg?.clientHeight > 0
      ? { width: svg.clientWidth, height: svg.clientHeight }
      : undefined;
    const appendGroup = (className, index) => {
      const wrapper = document.createElementNS(SVG_NS, 'g');
      wrapper.setAttribute('class', className);
      wrapper.setAttribute('data-index', String(index));
      group.appendChild(wrapper);
      return wrapper;
    };

    if (closed && Number.isInteger(selectedSide) && selectedSide >= 0 && selectedSide < count) {
      const start = vertices[selectedSide], end = vertices[(selectedSide + 1) % count];
      const line = document.createElementNS(SVG_NS, 'line');
      for (const [key, value] of Object.entries({
        x1: start.x, y1: start.y, x2: end.x, y2: end.y,
        class: 'trace-selected-side', stroke: 'var(--laser)', 'stroke-width': 2.2,
        'stroke-linecap': 'round', 'pointer-events': 'none',
      })) line.setAttribute(key, String(value));
      group.appendChild(line);
    }

    const boxes = [];
    if (closed && showDimensions && count >= 3) {
      vertices.forEach((point, index) => {
        const next = vertices[(index + 1) % count];
        const active = selectedSide === index;
        if (!active && Math.hypot(next.x - point.x, next.y - point.y) < 52) return;
        const length = lengths[index];
        const dimension = appendGroup('trace-dimension', index);
        const layout = drawDimension({
          group: dimension, a: point, b: next,
          normal: outNormal(vertices, index),
          label: Number.isFinite(length) && length >= 0 ? fmtCentimetres(length * 100) : '?',
          active, look: 'technical', scale: 0.8, bounds,
        });
        boxes.push({ x: layout.center.x - labelPanX, y: layout.center.y - labelPanY, width: layout.width, height: layout.height });
        dimension.querySelector('.appearance-label')?.setAttribute('font-weight', '650');
      });
    }
    if (hasRoomLabel) setDimensionBoxes(previous => previous.length === boxes.length && previous.every((box, i) =>
      Math.abs(box.x - boxes[i].x) < 1e-6 && Math.abs(box.y - boxes[i].y) < 1e-6
      && box.width === boxes[i].width && box.height === boxes[i].height) ? previous : boxes);

    if (!completed) {
      const nodeScale = traceNodeScale(points, closed);
      vertices.forEach((point, index) => {
        const vertex = appendGroup('trace-vertex', index);
        const picked = !closed && index === 0 && count >= 3;
        drawVertex({
          group: vertex, point,
          outward: vertexOutward(vertices, index, closed, center),
          label: L(index), picked, look: 'technical', scale: (closed ? 1 : nodeScale) * 0.85,
        });
        const node = vertex.querySelector('.appearance-node');
        node?.setAttribute('stroke', picked ? TRACE.accent : TRACE.contour);
        node?.setAttribute('r', String((picked ? 4.2 : 3) * nodeScale));
        node?.setAttribute('stroke-width', String(1.1 * Math.max(0.65, nodeScale)));
        if (!closed && nodeScale < 0.75 && index !== 0) {
          vertex.querySelector('.appearance-vertex-label')?.setAttribute('display', 'none');
        }
      });
    }

    return () => group.replaceChildren();
  }, [points, closed, lengths, selectedSide, showDimensions, completed, hasRoomLabel, labelPanX, labelPanY]);

  return <>
    <g ref={groupRef} className={completed ? 'trace-saved-geometry' : 'trace-current-geometry'} style={geometryStyle} pointerEvents="none" />
    {roomLabel && <TraceRoomLabel {...roomLabel} obstacles={dimensionBoxes} />}
  </>;
}
