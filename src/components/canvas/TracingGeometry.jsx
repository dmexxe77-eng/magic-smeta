import { useEffect, useRef } from 'react';
import { APPEARANCES, drawDimension, drawVertex } from '../../design-bridge/drawEditor/canvas-appearance.js';
import { L, norm, outNormal, sub } from '../../design-bridge/drawEditor/geometry.js';
import { TRACE, traceNodeScale } from './tracing-appearance.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const geometryStyle = {
  ...APPEARANCES.technical.vars,
  '--paper': '#ffffff',
  '--ink': TRACE.ink,
  '--ink2': '#465B72',
  '--ink3': '#5D6F83',
};

function vertexOutward(points, index, center) {
  const fallback = norm(sub(points[index], center));
  return Math.hypot(fallback.x, fallback.y) > 0 ? fallback : { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
}

/** The PDF overlay uses the manual builder's dimension and vertex renderers. */
export default function TracingGeometry({
  points = [], closed = false, lengths = [], selectedSide = null,
  showDimensions = true, completed = false,
}) {
  const groupRef = useRef(null);

  useEffect(() => {
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

    if (closed && showDimensions && count >= 3) {
      vertices.forEach((point, index) => {
        const next = vertices[(index + 1) % count];
        const active = selectedSide === index;
        if (!active && Math.hypot(next.x - point.x, next.y - point.y) < 52) return;
        const length = lengths[index];
        const dimension = appendGroup('trace-dimension', index);
        drawDimension({
          group: dimension, a: point, b: next,
          normal: outNormal(vertices, index),
          label: Number.isFinite(length) && length >= 0 ? String(Math.round(length * 100)) : '?',
          active, look: 'technical', scale: 0.85, bounds,
        });
        dimension.querySelector('.appearance-label')?.setAttribute('font-weight', '650');
      });
    }

    if (!closed) {
      const nodeScale = traceNodeScale(points, false);
      vertices.forEach((point, index) => {
        const vertex = appendGroup('trace-vertex', index);
        const picked = index === 0 && count >= 3;
        drawVertex({
          group: vertex, point,
          outward: vertexOutward(vertices, index, center),
          label: L(index), picked, look: 'technical', scale: nodeScale * 0.85,
        });
        const node = vertex.querySelector('.appearance-node');
        node?.setAttribute('stroke', picked ? TRACE.accent : TRACE.contour);
        node?.setAttribute('r', String((picked ? 4.2 : 3) * nodeScale));
        node?.setAttribute('stroke-width', String(1.1 * Math.max(0.65, nodeScale)));
        if (nodeScale < 0.75 && index !== 0) {
          vertex.querySelector('.appearance-vertex-label')?.setAttribute('display', 'none');
        }
      });
    }

    return () => group.replaceChildren();
  }, [points, closed, lengths, selectedSide, showDimensions, completed]);

  return <g ref={groupRef} className={completed ? 'trace-saved-geometry' : 'trace-current-geometry'} style={geometryStyle} pointerEvents="none" />;
}
