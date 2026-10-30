import { calculateEstimateTotals } from './estimate-adjustment.js';

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const cents = value => {
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.round((value + Math.sign(value) * tolerance) * 100) || 0;
};
const amount = line => finite(finite(line.q) * finite(line.p));

// Distribute fractional kopecks instead of adding a separate rounding charge.
function allocateCents(amounts, target) {
  if (!amounts.length) return [];
  const sum = amounts.reduce((total, value) => total + value, 0);
  const entries = amounts.map((value, index) => {
    const exact = sum ? value / sum * target : value * 100;
    const floor = Math.floor(exact);
    return { index, floor, remainder: exact - floor };
  });
  const residual = target - entries.reduce((total, entry) => total + entry.floor, 0);
  const direction = Math.sign(residual);
  const ordered = [...entries].sort((a, b) => direction >= 0
    ? b.remainder - a.remainder || a.index - b.index
    : a.remainder - b.remainder || a.index - b.index);
  const rounds = Math.floor(Math.abs(residual) / entries.length);
  const remainder = Math.abs(residual) % entries.length;
  ordered.forEach((entry, index) => { entry.floor += direction * (rounds + (index < remainder ? 1 : 0)); });
  return entries.map(entry => entry.floor);
}

function displayPrice(quantity, intendedPrice, target) {
  if (!quantity) return intendedPrice.toLocaleString('ru-RU', { maximumFractionDigits: 20 });
  // Usually two decimals are enough. A fractional quantity may require more
  // digits so the printed price reproduces the allocated line sum exactly.
  for (const value of [intendedPrice, target / 100 / quantity]) {
    for (let precision = 2; precision <= 20; precision++) {
      const rounded = Number(value.toFixed(precision));
      if (cents(rounded * quantity) === target) {
        return rounded.toLocaleString('ru-RU', { maximumFractionDigits: precision });
      }
    }
  }
  return (target / 100 / quantity).toLocaleString('ru-RU', { maximumFractionDigits: 20 });
}

function prepareRows(lines, target, foldedPercent) {
  const prices = lines.map(line => finite(line.p) + finite(line.p) * foldedPercent / 100);
  const allocated = allocateCents(lines.map((line, index) => finite(finite(line.q) * prices[index])), target);
  return lines.map((line, index) => ({
    ...line,
    p: foldedPercent ? prices[index] : line.p,
    exportTotal: allocated[index] / 100,
    exportQuantity: finite(line.q).toLocaleString('ru-RU', { maximumSignificantDigits: 21 }),
    exportPrice: displayPrice(finite(line.q), prices[index], allocated[index]),
  }));
}

export function prepareEstimateExport(est, adjustment, showAdjustment = true) {
  const mats = Array.isArray(est?.mats) ? est.mats : [];
  const works = Array.isArray(est?.works) ? est.works : [];
  const totals = calculateEstimateTotals(
    mats.reduce((sum, line) => sum + amount(line), 0),
    works.reduce((sum, line) => sum + amount(line), 0),
    adjustment,
  );
  let targets = [cents(totals.materialsTotal), cents(totals.worksTotal)];
  const fold = !showAdjustment && totals.percent !== 0;
  if (fold) {
    if (totals.scope === 'all') {
      const factor = 1 + totals.percent / 100;
      targets = allocateCents([totals.materialsTotal * factor, totals.worksTotal * factor], cents(totals.adjustedTotal));
    } else {
      targets[totals.scope === 'mats' ? 0 : 1] += cents(totals.adjustmentAmount);
    }
  }
  return {
    mats: prepareRows(mats, targets[0], fold && totals.scope !== 'works' ? totals.percent : 0),
    works: prepareRows(works, targets[1], fold && totals.scope !== 'mats' ? totals.percent : 0),
    materialsTotal: targets[0] / 100,
    worksTotal: targets[1] / 100,
    totals,
  };
}
