const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
export const ESTIMATE_FONTS = Object.freeze([
  { id: 'arial', label: 'Arial', css: 'Arial,sans-serif' },
  { id: 'verdana', label: 'Verdana', css: 'Verdana,sans-serif' },
  { id: 'georgia', label: 'Georgia', css: 'Georgia,serif' },
  { id: 'times', label: 'Times New Roman', css: '"Times New Roman",serif' },
]);
export function normalizeEstimateTemplate(value) {
  return {
    background: color(value?.background, '#121a2a'), accent: color(value?.accent, '#9586ff'),
    projectBackground: color(value?.projectBackground, '#f8f8fd'),
    tableHeaderBackground: color(value?.tableHeaderBackground, '#202532'),
    sectionColor: color(value?.sectionColor, '#202532'),
    stripeBackground: color(value?.stripeBackground, '#f5f7fb'),
    showLogo: value?.showLogo !== false, showDetails: value?.showDetails !== false,
    showItemPhotos: value?.showItemPhotos !== false, stripedRows: value?.stripedRows === true,
    layout: choice(value?.layout, ['split', 'reverse', 'stacked'], 'split'),
    font: choice(value?.font, ESTIMATE_FONTS.map(item => item.id), 'arial'),
    density: choice(value?.density, ['compact', 'regular', 'airy'], 'regular'),
    logoPosition: choice(value?.logoPosition, ['left', 'above', 'right'], 'left'),
    projectWidth: number(value?.projectWidth, 60, 35, 70),
    headerHeight: number(value?.headerHeight, 156, 120, 320),
    headerPadding: number(value?.headerPadding, 16, 8, 32),
    headerRadius: number(value?.headerRadius, 14, 0, 24),
    logoSize: number(value?.logoSize, 42, 24, 112),
    fontSize: number(value?.fontSize, 12, 10, 16),
    companyFontSize: number(value?.companyFontSize, 19, 16, 30),
  };
}
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
export function estimateHeaderInk(background) {
  const level = luminance(color(background, '#121a2a'));
  const contrast = ink => (Math.max(level, luminance(ink)) + .05) / (Math.min(level, luminance(ink)) + .05);
  const dark = '#202532', white = '#ffffff';
  const best = contrast(dark) >= contrast(white) ? dark : white;
  return contrast(best) >= 4.5 ? best : '#000000';
}

/** Only normalized numbers, colors and whitelisted font families enter document CSS. */
export function estimateTemplateVariables(template) {
  const a = normalizeEstimateTemplate(template);
  const font = ESTIMATE_FONTS.find(font => font.id === a.font).css;
  const columns = a.layout === 'stacked' ? 'minmax(0,1fr)' : a.layout === 'reverse'
    ? `minmax(0,${100 - a.projectWidth}fr) minmax(0,${a.projectWidth}fr)`
    : `minmax(0,${a.projectWidth}fr) minmax(0,${100 - a.projectWidth}fr)`;
  const values = {
    'font-family': font, 'font-size': `${a.fontSize}px`, 'company-font-size': `${a.companyFontSize}px`,
    'header-columns': columns, 'header-height': `${a.headerHeight}px`, 'header-padding': `${a.headerPadding}px`,
    'header-radius': `${a.headerRadius}px`, 'project-bg': a.projectBackground, 'project-ink': estimateHeaderInk(a.projectBackground),
    'project-order': a.layout === 'reverse' ? 2 : 1, 'company-order': a.layout === 'reverse' ? 1 : 2,
    'logo-size': `${a.logoSize}px`, 'brand-direction': a.logoPosition === 'above' ? 'column' : 'row',
    'brand-align': a.logoPosition === 'above' ? 'flex-start' : 'center', 'logo-order': a.logoPosition === 'right' ? 2 : 0,
    'table-bg': a.tableHeaderBackground, 'table-ink': estimateHeaderInk(a.tableHeaderBackground),
    'section-color': a.sectionColor, 'stripe-bg': a.stripedRows ? a.stripeBackground : 'transparent',
    'row-padding': `${{ compact: 5, regular: 8, airy: 12 }[a.density]}px`,
  };
  return Object.entries(values).map(([key, value]) => `--estimate-${key}:${value}`).join(';');
}
