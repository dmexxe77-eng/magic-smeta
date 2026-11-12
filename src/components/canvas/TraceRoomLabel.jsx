import { useEffect, useMemo, useState } from 'react';
import { layoutRoomLabel } from './trace-room-label.js';
import { TRACE } from './tracing-appearance.js';

let textContext;
function measureText(text, size, weight) {
  textContext ||= document.createElement('canvas').getContext('2d');
  if (!textContext) return text.length * size * 0.65;
  textContext.font = `${weight} ${size}px Manrope, system-ui, sans-serif`;
  return textContext.measureText(text).width;
}

export default function TraceRoomLabel({ points, zoom, pan, name, area }) {
  const [fontVersion, setFontVersion] = useState(0);
  useEffect(() => {
    let active = true;
    document.fonts?.ready.then(() => { if (active) setFontVersion(1); });
    return () => { active = false; };
  }, []);
  const scaledPoints = useMemo(() => points.map(([x, y]) => [x * zoom, y * zoom]), [points, zoom]);
  const layout = useMemo(() => layoutRoomLabel(scaledPoints, name, area, measureText), [scaledPoints, name, area, fontVersion]);
  if (!layout) return null;
  const { x, y, height, lines, fontSize, lineHeight, areaSize } = layout;
  const top = y - height / 2;
  const textStyle = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' };
  return <g className="trace-room-label" transform={`translate(${pan.x} ${pan.y})`} aria-label={`${name}, ${area}`} pointerEvents="none">
    <title>{name + ' · ' + area}</title>
    {lines.map((line, index) => <text key={index} className="trace-room-name" x={x} y={top + fontSize + index * lineHeight}
      textAnchor="middle" fill={TRACE.ink} fontSize={fontSize} fontWeight="650" fontFamily="Manrope, system-ui, sans-serif" style={textStyle}>{line}</text>)}
    <text className="trace-room-area" x={x} y={top + lines.length * lineHeight + areaSize + 3}
      textAnchor="middle" fill={TRACE.ink} fontSize={areaSize} fontWeight="650" fontFamily="Manrope, system-ui, sans-serif" style={textStyle}>{area}</text>
  </g>;
}
