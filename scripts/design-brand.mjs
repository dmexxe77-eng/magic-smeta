/* Бренд ЗАМЕРX на странице /design: знак, название и палитра от логотипа.
   Прототип раскрашен инлайн-стилями с фиксированными цветами, поэтому палитру меняем заменой по шаблону. */

export const BRAND = { name: 'ЗАМЕР', x: 'X', full: 'ЗАМЕРX', title: 'ЗАМЕРX · телефон' };

/* Палитра логотипа: графит знака, синий буквы X. Ключ — цвет прототипа (индиго), значение — новый */
export const PALETTE = {
  '#4F46E5': '#1461EE', '#4f46e5': '#1461ee', 'rgba(79,70,229': 'rgba(20,97,238', 'rgba(99,102,241': 'rgba(42,123,255',
  '#6366F1': '#2A7BFF', '#8B85F4': '#3D8BFF', '#C7C9FF': '#BCD4FF',
  '#EEEDFC': '#E7EFFD', '#C9C6F5': '#B8CFFA', '#DCD9FA': '#CEDFFC', '#EDECFB': '#E7EFFD',
  '#1E2530': '#0F1620', '#1e2530': '#0f1620',
  /* синий информационный статус слишком похож на новый акцент — переводим в бирюзу */
  '#0A84FF': '#0D9488', '#E3F1FD': '#DEF3F0',
};

/* Знак ЗАМЕРX для шаблона прототипа: атрибуты с дефисом там пишутся в style, viewBox — через sc-camel-view-box */
export const markSvg = (size, radius = 14) =>
  `<svg width="${size}" height="${size}" sc-camel-view-box="0 0 64 64" style="display:block;flex:none">` +
  `<rect width="64" height="64" rx="${radius}" fill="#0B1119"></rect>` +
  '<path d="M13 50V16.5a3.5 3.5 0 0 1 3.5-3.5H50" fill="none" style="stroke:#E6EBF4;stroke-width:3.4;stroke-linecap:round"></path>' +
  '<path d="M22 13v5M30 13v6.5M38 13v5M46 13v6.5M13 24h5M13 32h6.5M13 40h5" style="stroke:#E6EBF4;stroke-width:2.6;stroke-linecap:round"></path>' +
  '<path d="M22 23h10.5l21 27H43z" fill="#EEF2F8"></path><path d="M42.5 23H54L31 50H19.5z" fill="#2A7BFF"></path></svg>';

export const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b1119'/%3E%3Cpath d='M13 50V16.5a3.5 3.5 0 0 1 3.5-3.5H50' fill='none' stroke='%23e6ebf4' stroke-width='3.4' stroke-linecap='round'/%3E%3Cpath d='M22 13v5M30 13v6.5M38 13v5M46 13v6.5M13 24h5M13 32h6.5M13 40h5' stroke='%23e6ebf4' stroke-width='2.6' stroke-linecap='round'/%3E%3Cpath d='M22 23h10.5l21 27H43z' fill='%23eef2f8'/%3E%3Cpath d='M42.5 23H54L31 50H19.5z' fill='%232a7bff'/%3E%3C/svg%3E";

/* название одним span — в flex-плашке gap иначе разделит «ЗАМЕР» и «X» */
const wordmark = xColor => `<span style="color:#fff">${BRAND.name}<span style="color:${xColor}">${BRAND.x}</span></span>`;

export function brandTemplate(source) {
  let tpl = source;
  const count = a => tpl.split(a).length - 1;
  const rep = (a, b, label) => { if (count(a) !== 1) throw new Error('brand: «' + label + '» найдено ' + count(a) + ' раз'); tpl = tpl.replace(a, () => b); };

  /* плашка с названием в шапке списка проектов */
  rep('<div style="display:inline-flex;align-items:center;height:38px;padding:0 14px;border-radius:12px;background:#1E2530;font-size:16px;font-weight:800;letter-spacing:.6px;line-height:1"><span style="color:#fff">ZAMER</span><span style="color:#8B85F4">.PRO</span></div>',
    '<div style="display:inline-flex;align-items:center;gap:9px;height:38px;padding:0 12px 0 4px;border-radius:12px;background:#0B1119;font-size:16px;font-weight:800;letter-spacing:.8px;line-height:1">' + markSvg(30, 11) + wordmark('#3D8BFF') + '</div>', 'projects brand');

  /* главная: знак и название вместо старой пиктограммы */
  const start = tpl.indexOf('<svg width="36" height="36" sc-camel-view-box="0 0 120 120" style="display:block;flex:none"><rect width="120" height="120" rx="27" fill="#1E2530"></rect>');
  if (start < 0) throw new Error('brand: пиктограмма на главной не найдена');
  const end = tpl.indexOf('</svg>', start) + '</svg>'.length;
  tpl = tpl.slice(0, start) + markSvg(38, 13) + tpl.slice(end);
  rep('<div style="font-size:15px;font-weight:800;letter-spacing:1.4px;line-height:1">ZAMER<span style="color:#4F46E5">.PRO</span></div>',
    '<div style="font-size:15px;font-weight:800;letter-spacing:1.4px;line-height:1">' + BRAND.name + '<span style="color:#1461EE">' + BRAND.x + '</span></div>', 'home brand');

  /* подпись версии в аккаунте */
  tpl = tpl.replace(/ZAMER\.PRO 2\.4 · [^<]*/, BRAND.full + ' · автосохранение включено');

  /* палитра: длинные ключи раньше коротких, чтобы rgba не задело hex */
  Object.entries(PALETTE).sort((a, b) => b[0].length - a[0].length).forEach(([from, to]) => { tpl = tpl.split(from).join(to); });
  if (/ZAMER/.test(tpl)) throw new Error('brand: осталось старое название: ' + tpl.match(/.{0,40}ZAMER.{0,40}/)[0]);
  return tpl;
}

/* Цвета для бандлов построителя и обводки — те же, что в шаблоне */
export const BRIDGE_COLORS = { ink: '#0F1620', accent: '#1461EE', soft: '#E7EFFD', fill: 'rgba(20,97,238,.10)' };
