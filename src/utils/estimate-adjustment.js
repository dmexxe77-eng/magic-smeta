const SCOPES = new Set(['all', 'works', 'mats']);

export function normalizeEstimateAdjustment(value) {
  return {
    percent: typeof value?.percent === 'number' && Number.isFinite(value.percent)
      ? Math.min(1000, Math.max(-100, value.percent))
      : 0,
    scope: SCOPES.has(value?.scope) ? value.scope : 'all',
  };
}

const roundMoney = value => {
  if (!Number.isFinite(value)) return 0;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.round((value + Math.sign(value) * tolerance) * 100) / 100;
};

export function calculateEstimateTotals(materials, works, adjustment) {
  const { percent, scope } = normalizeEstimateAdjustment(adjustment);
  const materialsTotal = roundMoney(materials);
  const worksTotal = roundMoney(works);
  const baseTotal = roundMoney(materialsTotal + worksTotal);
  const adjustmentBase = scope === 'mats' ? materialsTotal : scope === 'works' ? worksTotal : baseTotal;
  const adjustmentAmount = roundMoney(adjustmentBase * percent / 100);
  return {
    materialsTotal, worksTotal, baseTotal, adjustmentAmount,
    adjustedTotal: roundMoney(baseTotal + adjustmentAmount), percent, scope,
  };
}

export function adjustmentLabel(adjustment) {
  const { percent, scope } = normalizeEstimateAdjustment(adjustment);
  if (!percent) return 'Без корректировки';
  const subject = { all: 'всю смету', works: 'работы', mats: 'материалы' }[scope];
  const amount = Math.abs(percent).toLocaleString('ru-RU', { maximumFractionDigits: 10 });
  return `${percent > 0 ? 'Наценка' : 'Скидка'} на ${subject} ${percent > 0 ? '+' : '−'}${amount}%`;
}
