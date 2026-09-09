import { createDrawEditor } from '../components/builders/drawEditor/editor.js';
import '../components/builders/drawEditor/editor.css';

/* Токены страницы дизайна (design-src/README.md, раздел 1) */
const DESIGN_VARS = {
  '--ground': '#F3F3FA', '--paper': '#F7F7FC', '--surface': '#FFFFFF', '--surface2': '#F3F3FA',
  '--ink': '#1E2530', '--ink2': '#6F7688', '--ink3': '#A5A9B8', '--line': '#E4E4EE', '--grid': '#ECECF4',
  '--fill': 'rgba(79,70,229,.10)', '--pri': '#4F46E5', '--laser': '#4F46E5', '--laser-soft': '#EEEDFC',
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
  let ed = null;
  const close = () => { if (ed) { ed.destroy(); ed = null; } host.remove(); };
  ed = createDrawEditor(host, {
    roomName: opts.roomName,
    initial: opts.initial || null,
    onBack: () => { close(); if (opts.onBack) opts.onBack(); },
    onFinish: res => { if (opts.onFinish) opts.onFinish(res); },
  });
  return { close };
}
