const GROUPS = ['mats', 'works', 'equipment'];
const SCOPES = new Set(['all', ...GROUPS]);
const percentValue = value => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(1000, Math.max(-100, value)) : 0;

export function normalizeEstimateAdjustment(value) {
  const scope = SCOPES.has(value?.scope) ? value.scope : 'all';
  if (value?.rates && typeof value.rates === 'object' && !Array.isArray(value.rates)) {
    const rates = Object.fromEntries(GROUPS.map(group => [group, percentValue(value.rates[group])]));
    const uniform = GROUPS.every(group => rates[group] === rates.mats);
    return { scope, percent: scope === 'all' ? (uniform ? rates.mats : 0) : rates[scope], rates };
  }
  // Older projects keep their original single-scope arithmetic until edited.
  return { percent: percentValue(value?.percent), scope };
}

export function estimateAdjustmentRates(value) {
  const adjustment = normalizeEstimateAdjustment(value);
  return adjustment.rates || Object.fromEntries(GROUPS.map(group => [group,
    adjustment.scope === 'all' || adjustment.scope === group ? adjustment.percent : 0]));
}

/** Selecting a group never changes its rate. Editing "all" sets every group once. */
export function updateEstimateAdjustment(value, patch = {}) {
  const current = normalizeEstimateAdjustment(value);
  const scope = SCOPES.has(patch.scope) ? patch.scope : current.scope;
  const rates = { ...estimateAdjustmentRates(current) };
  if (Object.hasOwn(patch, 'percent')) {
    for (const group of scope === 'all' ? GROUPS : [scope]) rates[group] = percentValue(patch.percent);
  }
  return normalizeEstimateAdjustment({ scope, rates });
}

function adjustmentEntries(value) {
  const adjustment = normalizeEstimateAdjustment(value);
  if (!adjustment.rates) return adjustment.percent ? [adjustment] : [];
  const rates = adjustment.rates;
  // Equal rates retain whole-estimate rounding, including migrated old projects.
  if (GROUPS.every(group => rates[group] === rates.mats)) {
    return rates.mats ? [{ scope: 'all', percent: rates.mats }] : [];
  }
  return GROUPS.filter(scope => rates[scope] !== 0).map(scope => ({ scope, percent: rates[scope] }));
}

const roundMoney = value => {
  if (!Number.isFinite(value)) return 0;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.round((value + Math.sign(value) * tolerance) * 100) / 100;
};

export function calculateEstimateTotals(materials, works, adjustment, equipment = 0) {
  const normalized = normalizeEstimateAdjustment(adjustment);
  const materialsTotal = roundMoney(materials);
  const worksTotal = roundMoney(works);
  const equipmentTotal = roundMoney(equipment);
  const baseTotal = roundMoney(materialsTotal + worksTotal + equipmentTotal);
  const bases = { mats: materialsTotal, works: worksTotal, equipment: equipmentTotal, all: baseTotal };
  const adjustments = adjustmentEntries(normalized).map(entry => ({ ...entry,
    base: bases[entry.scope], amount: roundMoney(bases[entry.scope] * entry.percent / 100),
  }));
  const adjustmentAmount = roundMoney(adjustments.reduce((total, entry) => total + entry.amount, 0));
  return {
    ...normalized, materialsTotal, worksTotal, equipmentTotal, baseTotal, adjustmentAmount,
    adjustedTotal: roundMoney(baseTotal + adjustmentAmount), adjustments, hasAdjustment: adjustments.length > 0,
  };
}

export function adjustmentLabel(adjustment) {
  const entries = adjustmentEntries(adjustment);
  if (!entries.length) return 'Без корректировки';
  return entries.map(({ percent, scope }) => {
    const subject = { all: 'всю смету', works: 'работы', mats: 'материалы', equipment: 'оборудование' }[scope];
    const amount = Math.abs(percent).toLocaleString('ru-RU', { maximumFractionDigits: 10 });
    return `${percent > 0 ? 'Наценка' : 'Скидка'} на ${subject} ${percent > 0 ? '+' : '−'}${amount}%`;
  }).join(' · ');
}
