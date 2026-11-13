const SCOPES = ['mats', 'works', 'equipment'];
export const ESTIMATE_COLUMN_IDS = ['num', 'photo', 'name', 'qty', 'unit', 'price', 'total'];
export const ESTIMATE_COLUMNS_DEFAULTS_VERSION = 1;

/** Old automatic photo exclusions migrate once; later manual choices remain saved. */
export function normalizeEstimateExportOptions(options) {
  const saved = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const current = saved.columnsDefaultsVersion === ESTIMATE_COLUMNS_DEFAULTS_VERSION;
  return {
    ...saved,
    columnsDefaultsVersion: ESTIMATE_COLUMNS_DEFAULTS_VERSION,
    cols: Object.fromEntries(ESTIMATE_COLUMN_IDS.map(id => [id, current ? saved.cols?.[id] !== false : true])),
  };
}

/** Old documents had one flag. Inherit it until a group is configured separately. */
export function estimateAdjustmentVisibility(options) {
  return Object.fromEntries(SCOPES.map(scope => [scope, typeof options?.showAdjustmentByScope?.[scope] === 'boolean'
    ? options.showAdjustmentByScope[scope] : options?.showAdjustment !== false]));
}

export function setEstimateAdjustmentVisibility(options, scope, visible) {
  const flags = estimateAdjustmentVisibility(options);
  for (const key of scope === 'all' ? SCOPES : SCOPES.filter(key => key === scope)) flags[key] = !!visible;
  return { ...options, showAdjustmentByScope: flags };
}
