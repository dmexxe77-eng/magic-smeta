const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
export const ESTIMATE_FONTS = Object.freeze([
  { id: 'arial', label: 'Arial', css: 'Arial,sans-serif' },
  { id: 'verdana', label: 'Verdana', css: 'Verdana,sans-serif' },
  { id: 'georgia', label: 'Georgia', css: 'Georgia,serif' },
  { id: 'times', label: 'Times New Roman', css: "'Liberation Serif','Times New Roman',Georgia,serif" },
  { id: 'manrope', label: 'Manrope', css: "'Manrope',Arial,sans-serif" },
]);
const LEGACY_APPEARANCE = Object.freeze({
  background: '#121a2a', accent: '#9586ff', projectBackground: '#f8f8fd',
  tableHeaderBackground: '#202532', sectionColor: '#202532', stripeBackground: '#f5f7fb',
  layout: 'split', font: 'arial', density: 'regular', logoPosition: 'left',
  projectWidth: 60, headerHeight: 156, headerPadding: 16, headerRadius: 14,
  logoSize: 42, fontSize: 12, companyFontSize: 19,
});
const DEFAULT_APPEARANCE = Object.freeze({
  background: '#1A3A5C', accent: '#ffffff', projectBackground: '#ffffff',
  tableHeaderBackground: '#1A3A5C', sectionColor: '#1A3A5C', stripeBackground: '#f1f4f7',
  layout: 'stacked', font: 'times', density: 'compact', logoPosition: 'left',
  projectWidth: 60, headerHeight: 120, headerPadding: 16, headerRadius: 7,
  logoSize: 40, fontSize: 12, companyFontSize: 19,
});
const MODERN_APPEARANCE = Object.freeze({
  ...DEFAULT_APPEARANCE, background: '#EFF5FF', accent: '#16335A', tableHeaderBackground: '#E7EFFD',
  sectionColor: '#1461EE', stripeBackground: '#F4F8FF', font: 'manrope', headerRadius: 0, logoSize: 38,
});
const PREVIOUS_BRAND_APPEARANCE = Object.freeze({ ...DEFAULT_APPEARANCE, logoSize: 42 });
const PREVIOUS_MODERN_APPEARANCE = Object.freeze({
  ...PREVIOUS_BRAND_APPEARANCE, background: '#eaf2ff', accent: '#164b8c', tableHeaderBackground: '#dceaff',
  sectionColor: '#164b8c', stripeBackground: '#f3f7ff', font: 'arial', headerRadius: 10,
});
export const ESTIMATE_PRESETS = Object.freeze([
  Object.freeze({ id: 'brand', label: 'Фирменный', description: 'Синяя шапка и строгий текст', appearance: DEFAULT_APPEARANCE }),
  Object.freeze({ id: 'modern', label: 'Современный', description: 'Голубая шапка и лаконичный текст', appearance: MODERN_APPEARANCE }),
]);
export function normalizeEstimateTemplate(value) {
  const legacyDefault = value?.formatVersion !== 2 && Object.entries(LEGACY_APPEARANCE)
    .every(([key, oldValue]) => value?.[key] === undefined || value[key] === oldValue);
  const matches = previous => value?.formatVersion === 2 && Object.entries(previous).every(([key, oldValue]) => value[key] === oldValue);
  const migrated = matches(PREVIOUS_BRAND_APPEARANCE) ? DEFAULT_APPEARANCE : matches(PREVIOUS_MODERN_APPEARANCE) ? MODERN_APPEARANCE : null;
  const appearance = migrated || (legacyDefault ? DEFAULT_APPEARANCE : { ...DEFAULT_APPEARANCE, ...value });
  return {
    formatVersion: 2,
    background: color(appearance.background, DEFAULT_APPEARANCE.background), accent: color(appearance.accent, DEFAULT_APPEARANCE.accent),
    projectBackground: color(appearance.projectBackground, DEFAULT_APPEARANCE.projectBackground),
    tableHeaderBackground: color(appearance.tableHeaderBackground, DEFAULT_APPEARANCE.tableHeaderBackground),
    sectionColor: color(appearance.sectionColor, DEFAULT_APPEARANCE.sectionColor),
    stripeBackground: color(appearance.stripeBackground, DEFAULT_APPEARANCE.stripeBackground),
    showLogo: value?.showLogo !== false, showDetails: value?.showDetails !== false,
    showItemPhotos: value?.showItemPhotos !== false, stripedRows: value?.stripedRows === true,
    layout: choice(appearance.layout, ['split', 'reverse', 'stacked'], DEFAULT_APPEARANCE.layout),
    font: choice(appearance.font, ESTIMATE_FONTS.map(item => item.id), DEFAULT_APPEARANCE.font),
    density: choice(appearance.density, ['compact', 'regular', 'airy'], DEFAULT_APPEARANCE.density),
    logoPosition: choice(appearance.logoPosition, ['left', 'above', 'right'], DEFAULT_APPEARANCE.logoPosition),
    projectWidth: number(appearance.projectWidth, DEFAULT_APPEARANCE.projectWidth, 35, 70),
    headerHeight: number(appearance.headerHeight, DEFAULT_APPEARANCE.headerHeight, 120, 320),
    headerPadding: number(appearance.headerPadding, DEFAULT_APPEARANCE.headerPadding, 8, 32),
    headerRadius: number(appearance.headerRadius, DEFAULT_APPEARANCE.headerRadius, 0, 24),
    logoSize: number(appearance.logoSize, DEFAULT_APPEARANCE.logoSize, 24, 112),
    fontSize: number(appearance.fontSize, DEFAULT_APPEARANCE.fontSize, 10, 16),
    companyFontSize: number(appearance.companyFontSize, DEFAULT_APPEARANCE.companyFontSize, 16, 30),
  };
}

/** Change the presentation while preserving document visibility preferences. */
export function estimatePresetTemplate(id, current) {
  const preset = ESTIMATE_PRESETS.find(item => item.id === id);
  if (!preset) throw new Error('Неизвестное оформление сметы');
  return normalizeEstimateTemplate({ ...normalizeEstimateTemplate(current), ...preset.appearance });
}

/** Customized values stay untouched and are never silently mapped onto a preset. */
export function estimatePresetId(value) {
  const appearance = normalizeEstimateTemplate(value);
  return ESTIMATE_PRESETS.find(preset => Object.keys(DEFAULT_APPEARANCE)
    .every(key => typeof appearance[key] === 'string' && appearance[key].startsWith('#')
      ? appearance[key].toLowerCase() === preset.appearance[key].toLowerCase()
      : appearance[key] === preset.appearance[key]))?.id || null;
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
  const preset = estimatePresetId(a);
  const font = ESTIMATE_FONTS.find(font => font.id === a.font).css;
  const columns = a.layout === 'stacked' ? 'minmax(0,1fr)' : a.layout === 'reverse'
    ? `minmax(0,${100 - a.projectWidth}fr) minmax(0,${a.projectWidth}fr)`
    : `minmax(0,${a.projectWidth}fr) minmax(0,${100 - a.projectWidth}fr)`;
  const values = {
    'font-family': font, 'font-size': `${a.fontSize}px`, 'company-font-size': `${a.companyFontSize}px`,
    'header-columns': columns, 'header-height': `${a.headerHeight}px`, 'header-padding': `${a.headerPadding}px`,
    'stacked-company-height': a.headerHeight === DEFAULT_APPEARANCE.headerHeight ? '0px' : `${a.headerHeight}px`,
    'header-radius': `${a.headerRadius}px`, 'project-bg': a.projectBackground, 'project-ink': estimateHeaderInk(a.projectBackground),
    'project-order': a.layout === 'split' ? 1 : 2, 'company-order': a.layout === 'split' ? 2 : 1,
    'logo-size': `${a.logoSize}px`, 'brand-direction': a.logoPosition === 'above' ? 'column' : 'row',
    'brand-align': a.logoPosition === 'above' ? 'flex-start' : 'center', 'logo-order': a.logoPosition === 'right' ? 2 : 0,
    'table-bg': a.tableHeaderBackground, 'table-ink': preset === 'modern' ? '#164B9D' : estimateHeaderInk(a.tableHeaderBackground),
    'section-color': a.sectionColor, 'stripe-bg': a.stripedRows ? a.stripeBackground : 'transparent',
    'frame-color': preset === 'modern' ? '#D9E6FB' : a.sectionColor,
    'row-padding': `${{ compact: 5, regular: 8, airy: 12 }[a.density]}px`,
  };
  return Object.entries(values).map(([key, value]) => `--estimate-${key}:${value}`).join(';');
}
