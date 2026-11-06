const SVG_NS = 'http://www.w3.org/2000/svg';
const FONT = 'Manrope, system-ui, sans-serif';

/** Appearance variables belong to the drawing surface, not to the editor chrome. */
export const APPEARANCES = {
  clean: {
    label: 'Чистый',
    vars: {
      '--paper': '#ffffff',
      '--ink': '#29384b',
      '--ink2': '#62748a',
      '--ink3': '#62748a',
      '--grid': '#e3e9f1',
      '--fill': '#f6f8fc',
      '--laser': '#1461ee',
      '--laser-soft': 'rgba(24, 121, 237, .12)',
    },
    strokeWidth: 2.2,
    nodeRadius: 3.5,
    nodeStrokeWidth: 1.5,
    fill: 'var(--fill)',
  },
  technical: {
    label: 'Размерный',
    vars: {
      '--paper': '#f6f8fb',
      '--ink': '#36475d',
      '--ink2': '#566b82',
      '--ink3': '#62748a',
      '--grid': '#dce4ee',
      '--fill': '#ffffff',
      '--laser': '#1461ee',
      '--laser-soft': 'rgba(24, 121, 237, .10)',
    },
    strokeWidth: 1.6,
    nodeRadius: 3.5,
    nodeStrokeWidth: 1.3,
    fill: 'var(--fill)',
  },
  contrast: {
    label: 'Контраст',
    vars: {
      '--paper': '#142132',
      '--ink': '#e5edf8',
      '--ink2': '#afc0d6',
      '--ink3': '#8da2bc',
      '--grid': '#27394e',
      '--fill': '#1b2d43',
      '--laser': '#83d3ff',
      '--laser-soft': 'rgba(131, 211, 255, .16)',
    },
    strokeWidth: 2.3,
    nodeRadius: 3.5,
    nodeStrokeWidth: 1.5,
    fill: 'var(--fill)',
  },
};

function svgElement(tag, attrs, value) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, attr] of Object.entries(attrs)) element.setAttribute(key, attr);
  if (value != null) element.textContent = value;
  return element;
}

function shifted(point, direction, distance) {
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance };
}

function appearanceGroup(parent, className, look) {
  const group = svgElement('g', {
    class: className,
    'data-look': look,
    'pointer-events': 'none',
    'aria-hidden': 'true',
  });
  parent.appendChild(group);
  return group;
}

function addLabel(group, center, label, { size, color, weight = 600, automatic = false }) {
  group.appendChild(svgElement('text', {
    x: center.x,
    y: center.y,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-family': FONT,
    'font-size': size,
    'font-weight': weight,
    'font-style': automatic ? 'italic' : 'normal',
    fill: color,
    class: 'appearance-label',
  }, label));
}

function drawTechnicalDimension({ dimension, a, b, label, active, automatic, scale, bounds, anchor }) {
  const size = 12 * scale;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const direction = anchor?.tangent || { x: b.x - a.x, y: b.y - a.y };
  const directionLength = Math.hypot(direction.x, direction.y);
  const tangent = directionLength > 1e-8 ? {
    x: direction.x / directionLength, y: direction.y / directionLength,
  } : { x: 1, y: 0 };
  let angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
  if (angle >= 90) angle -= 180;
  if (angle < -90) angle += 180;
  // Vertical numbers read from bottom to top, regardless of polygon winding.
  if (Math.abs(Math.abs(angle) - 90) < 1e-8) angle = -90;
  const padding = (length < 35 ? 2 : 5) * scale;
  const labelWidth = String(label).length * size * .61 + 2 * padding;
  const labelHeight = 16 * scale;
  const radians = angle * Math.PI / 180;
  const width = Math.abs(Math.cos(radians)) * labelWidth + Math.abs(Math.sin(radians)) * labelHeight;
  const height = Math.abs(Math.sin(radians)) * labelWidth + Math.abs(Math.cos(radians)) * labelHeight;
  const origin = anchor?.center || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let center = { ...origin };

  // Only a straight side can slide its label: an arc's supplied anchor is exact.
  if (!anchor && bounds && length > 1e-8) {
    const along = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const travel = Math.max(0, (length - labelWidth) / 2);
    function fittingShift(left, right, top, bottom) {
      let lower = -travel, upper = travel;
      for (const [coordinate, component, min, max] of [[origin.x, along.x, left, right], [origin.y, along.y, top, bottom]]) {
        if (min > max) return null;
        if (Math.abs(component) < 1e-8) {
          if (coordinate < min || coordinate > max) return null;
          continue;
        }
        const first = (min - coordinate) / component, second = (max - coordinate) / component;
        lower = Math.max(lower, Math.min(first, second));
        upper = Math.min(upper, Math.max(first, second));
      }
      return lower <= upper ? Math.max(lower, Math.min(upper, 0)) : null;
    }
    const preferred = fittingShift(
      width / 2 + 8, bounds.width - width / 2 - 8,
      height / 2 + Math.min(bounds.top ?? 8, bounds.height * .2),
      bounds.height - height / 2 - Math.min(bounds.bottom ?? 8, bounds.height * .15),
    );
    const shift = preferred ?? fittingShift(width / 2, bounds.width - width / 2, height / 2, bounds.height - height / 2);
    if (shift != null) center = shifted(origin, along, shift);
  }

  dimension.setAttribute('transform', `rotate(${angle} ${center.x} ${center.y})`);
  dimension.appendChild(svgElement('rect', {
    x: center.x - labelWidth / 2, y: center.y - labelHeight / 2,
    width: labelWidth, height: labelHeight, rx: 1.5 * scale,
    fill: 'var(--paper)', class: 'appearance-dimension-background',
  }));
  addLabel(dimension, center, label, {
    size, color: active ? 'var(--laser)' : automatic ? 'var(--ink3)' : 'var(--ink)', automatic,
  });
  return { center, width, height };
}

/** Technical labels follow the wall; the other appearances use horizontal pills. */
export function drawDimension({
  group, a, b, normal, label, active = false, automatic = false,
  look, scale = 1, inside = false, bounds, anchor,
}) {
  const dimension = appearanceGroup(group, 'appearance-dimension', look);
  if (look === 'technical') return drawTechnicalDimension({ dimension, a, b, label, active, automatic, scale, bounds, anchor });
  const size = 12.5 * scale;
  const width = Math.max(27 * scale, String(label).length * size * .61 + 16 * scale);
  const height = 23 * scale;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const short = length < 35;
  const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const color = active ? 'var(--laser)' : automatic ? 'var(--ink3)' : 'var(--ink)';
  // A horizontal pill needs more clearance on a vertical wall than on a horizontal one.
  const labelClearance = Math.abs(normal.x) * width / 2 + Math.abs(normal.y) * height / 2;
  const baseOffset = inside ? 16 : 19;
  let offset = Math.max(baseOffset * scale, labelClearance + 7 * scale)
    + (short ? 8 * scale : 0);
  let detached = false;
  let limits = null;
  // Keep a visible wall's label inside a short viewport, including when a keyboard
  // reduces the canvas height. Negative clearance places it inside the contour.
  if (bounds && midpoint.x >= 0 && midpoint.x <= bounds.width && midpoint.y >= 0 && midpoint.y <= bounds.height) {
    const left = width / 2 + 8, right = bounds.width - width / 2 - 8;
    const top = height / 2 + Math.min(bounds.top ?? 8, bounds.height * .2);
    const bottom = bounds.height - height / 2 - Math.min(bounds.bottom ?? 8, bounds.height * .15);
    limits = { left, right, top, bottom };
    let lower = -Infinity, upper = Infinity;
    for (const [coordinate, component, min, max] of [[midpoint.x, normal.x, left, right], [midpoint.y, normal.y, top, bottom]]) {
      if (Math.abs(component) < 1e-8) { if (coordinate < min || coordinate > max) detached = true; continue; }
      const first = (min - coordinate) / component, second = (max - coordinate) / component;
      lower = Math.max(lower, Math.min(first, second)); upper = Math.min(upper, Math.max(first, second));
    }
    if (lower <= upper && !detached) offset = Math.max(lower, Math.min(upper, offset));
    else detached = true;
  }
  let center = shifted(midpoint, normal, offset);
  if (detached) center = { x: Math.max(limits.left, Math.min(limits.right, center.x)), y: Math.max(limits.top, Math.min(limits.bottom, center.y)) };

  const contrast = look === 'contrast';
  dimension.appendChild(svgElement('rect', {
    x: center.x - width / 2, y: center.y - height / 2,
    width, height, rx: (contrast ? 6 : 7) * scale,
    fill: active ? 'var(--laser)' : 'var(--paper)',
    stroke: active ? 'var(--laser)' : contrast ? 'none' : 'var(--grid)',
    'stroke-width': 1,
    class: 'appearance-dimension-background',
  }));
  addLabel(dimension, center, label, {
    size, color: active ? (contrast ? 'var(--paper)' : '#ffffff') : color,
    automatic,
  });
  return { center, width, height };
}

export function drawVertex({
  group, point, outward, label, active = false, picked = false,
  look, scale = 1, fillet = false,
}) {
  const vertex = appearanceGroup(group, 'appearance-vertex', look);
  const appearance = APPEARANCES[look] || APPEARANCES.clean;
  const selected = active || picked;
  const color = selected ? 'var(--laser)' : 'var(--ink)';
  vertex.appendChild(svgElement('circle', {
    cx: point.x,
    cy: point.y,
    r: fillet ? 3 * scale : selected ? 5.5 : appearance.nodeRadius * scale,
    fill: fillet ? 'none' : selected ? 'var(--laser)' : 'var(--paper)',
    stroke: fillet ? (selected ? 'var(--laser)' : 'var(--ink3)') : color,
    'stroke-width': appearance.nodeStrokeWidth,
    ...(fillet ? { 'stroke-dasharray': '2 2' } : {}),
    class: fillet ? 'appearance-node appearance-node-ghost' : 'appearance-node',
  }));
  const center = shifted(point, outward, (look === 'technical' ? 23 : 20) * scale);
  const text = svgElement('text', {
    x: center.x,
    y: center.y,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-family': FONT,
    'font-size': 12 * scale,
    'font-weight': 650,
    fill: color,
    stroke: 'var(--paper)',
    'stroke-width': 4 * scale,
    'stroke-linejoin': 'round',
    'paint-order': 'stroke',
    class: 'appearance-vertex-label',
  }, label);
  vertex.appendChild(text);
}
