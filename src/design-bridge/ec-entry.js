/* Выгрузка для Easy Ceiling (формат, который экспортирует SmartDraw: заголовок «SmartDraw»,
   дальше base64 обычного текста с ключами через табуляцию). Передаём только чертежи потолков:
   углы, стороны, диагонали и параметры полотна. Комплектацию (раздел ЗАКАЗ и второй файл .json)
   не отдаём. Единицы: сантиметры для точек, сторон и диагоналей; S в м², P в м. */
const L = i => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '');
const r1 = v => Math.round(v * 10) / 10;
const fmt = v => String(r1(v));
const hyp = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/* Точки в см с началом в левом верхнем углу, ось Y вниз как в Easy Ceiling */
function cmPoints(verts) {
  const xs = verts.map(p => p[0]), ys = verts.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return verts.map(([x, y]) => [Math.round((x - x0) * 100), Math.round((y - y0) * 100)]);
}
function sidesOf(P) { return P.map((p, i) => { const j = (i + 1) % P.length; return { a: i, b: j, len: hyp(p, P[j]) }; }); }
/* Диагонали через одну вершину, как в SmartDraw: A–C, B–D, … ; для четырёхугольника только A–C */
function diagsOf(P) { const n = P.length, out = [];
  if (n === 4) return [{ a: 0, b: 2, len: hyp(P[0], P[2]) }];
  for (let i = 0; i < n; i++) { const j = (i + 2) % n; if (n > 4 || i < j) out.push({ a: i, b: j, len: hyp(P[i], P[j]) }); }
  return out; }
const pair = (a, b) => (a < b ? L(a) + L(b) : L(b) + L(a));

export function build({ company = '', companyPhone = '', date, address = '', phone = '', client = '', rooms = [] }) {
  const d = date || new Date();
  const dateTxt = typeof d === 'string' ? d : String(d.getDate()).padStart(2, '0') + ' ' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + d.getFullYear();
  const lines = ['Versiy 29.9', 'КОМПАНИЯ\t' + company + '\t' + companyPhone, 'ДАТА\t' + dateTxt, 'АДРЕС\t' + address, 'ТЕЛЕФОН\t' + phone, 'ИМЯ\t' + client, 'ПОТОЛКИ\t' + rooms.length, '', ''];
  rooms.forEach((rm, k) => {
    const P = cmPoints(rm.verts);
    lines.push('ПОТОЛОК\t' + (k + 1), 'ПОМЕЩЕНИЕ\t' + (rm.name || 'Потолок ' + (k + 1)).toUpperCase(), 'S=\t' + (Math.round(rm.area * 100) / 100), 'P=\t' + (Math.round(rm.perim * 100) / 100),
      'ЦВЕТ\t' + (rm.material || ''), 'МАТЕРИАЛ\t' + (rm.texture || 'Матовая') + '\t(' + (rm.width || 320) + ')', 'ШИРИНА\t' + (rm.width || 320), 'ШОВ\t' + (rm.seam || 'AB'),
      'УГОЛ\t[' + P.map((p, i) => L(i) + '(' + p[0] + ';' + p[1] + ')').join(',') + ']',
      'СТОРОНА\t[ ' + sidesOf(P).map(s => pair(s.a, s.b) + '-' + fmt(s.len)).join(',  ') + ']',
      'ДИАГОНАЛИ\t[ ' + diagsOf(P).map(s => pair(s.a, s.b) + '-' + fmt(s.len)).join(',  ') + ']', '');
  });
  lines.push('ЗАКАЗ', ''); // раздел оставляем пустым: комплектацию в Easy Ceiling не передаём
  const text = lines.join('\n') + '\n';
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  return { ec: 'SmartDraw\n' + b64, text };
}

const safe = s => String(s || 'Потолок').replace(/[\\/:*?"<>|]+/g, '_').trim();
async function deliver(file, title) {
  const files = [file];
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) { try { await navigator.share({ files, title }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
/* MagicEC.exportFiles(data) → 'shared' | 'downloaded' | 'cancelled'. Один файл .ec с чертежами */
export async function exportFiles(data) {
  const { ec } = build(data);
  const base = safe(data.address || data.name);
  return deliver(new File([ec], base + '.ec', { type: 'text/plain' }), 'Easy Ceiling: ' + base);
}
