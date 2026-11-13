const SCOPES = ['mats', 'works', 'equipment'];

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
