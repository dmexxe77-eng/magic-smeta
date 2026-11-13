const groupKeys = ['materials', 'works', 'equipment'];

const roundMoney = (value) => {
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.round((value + Math.sign(value) * tolerance) * 100) / 100;
};

export function normalizePercent(raw, previous = 0) {
  const parsed = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.min(1000, Math.max(-100, parsed)) : previous;
}

// Mirrors src/utils/estimate-adjustment.js, including whole-estimate rounding
// when every group has the same rate. The demo also displays reconciled groups.
export function applyGroupAdjustments(bases, rates) {
  const amounts = Object.fromEntries(groupKeys.map((group) => [group,
    roundMoney(bases[group] * rates[group] / 100),
  ]));
  const baseTotal = roundMoney(groupKeys.reduce((sum, group) => sum + bases[group], 0));
  const uniform = groupKeys.every((group) => rates[group] === rates.materials);
  if (uniform) {
    const totalAdjustment = roundMoney(baseTotal * rates.materials / 100);
    const groupAdjustment = roundMoney(groupKeys.reduce((sum, group) => sum + amounts[group], 0));
    const lastGroup = [...groupKeys].reverse().find((group) => bases[group] > 0);
    if (lastGroup) amounts[lastGroup] = roundMoney(amounts[lastGroup] + totalAdjustment - groupAdjustment);
  }
  const groups = Object.fromEntries(groupKeys.map((group) => [group, roundMoney(bases[group] + amounts[group])]));
  return { groups, adjustments: amounts, total: roundMoney(groupKeys.reduce((sum, group) => sum + groups[group], 0)) };
}
