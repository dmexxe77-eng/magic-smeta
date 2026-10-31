import { createDrawEditor } from './drawEditor/editor.js';
import { fitToStage } from './stage.js';
import './drawEditor/editor.css';

/* Токены страницы дизайна (design-src/README.md, раздел 1) */
const DESIGN_VARS = {
  '--ground': '#F3F3FA', '--paper': '#F8FAFD', '--surface': '#FFFFFF', '--surface2': '#F2F5FA',
  '--ink': '#0F1620', '--ink2': '#626D7E', '--ink3': '#737D8D', '--line': '#E3E8F0', '--grid': '#E5EBF3',
  '--fill': 'rgba(20,97,238,.06)', '--pri': '#1461EE', '--laser': '#1461EE', '--laser-soft': '#E7EFFD',
  '--sans': "'Manrope','Inter',system-ui,sans-serif", '--mono': "'Manrope','Inter',system-ui,sans-serif",
};

/* Оверлей построителя для страницы дизайна.
   MagicDraw.open({ roomName, initial:{verts}, onFinish(res), onBack }) → { close } */
export function open(opts = {}) {
  const host = document.createElement('div');
  host.className = 'zd';
  host.style.zIndex = '9000';
  Object.entries(DESIGN_VARS).forEach(([k, v]) => host.style.setProperty(k, v));
  document.body.appendChild(host);
  const unfit = fitToStage(host);
  let ed = null;
  const close = () => { if (ed) { ed.destroy(); ed = null; } unfit(); host.remove(); };
  ed = createDrawEditor(host, {
    roomName: opts.roomName,
    canvasLook: opts.canvasLook,
    initial: opts.initial || null,
    onBack: () => { close(); if (opts.onBack) opts.onBack(); },
    onFinish: res => { if (opts.onFinish) opts.onFinish(res); },
  });
  return { close };
}
