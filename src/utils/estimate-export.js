import { calculateEstimateTotals } from './estimate-adjustment.js';

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const cents = value => {
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.round((value + Math.sign(value) * tolerance) * 100) || 0;
};
const amount = line => finite(finite(line.q) * finite(line.p));

function displayQuantity(value) {
  const quantity = finite(value);
  const formatted = quantity.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const rounded = Number(formatted.replace(/\s/g, '').replace(',', '.'));
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(quantity)) * 8;
  return {
    exportQuantity: quantity !== 0 && rounded === 0
      ? (quantity > 0 ? '< 0,01' : '> −0,01')
      : formatted,
    exportQuantityRounded: Math.abs(quantity - rounded) > tolerance,
  };
}

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
    ...displayQuantity(line.q),
    exportPrice: displayPrice(finite(line.q), prices[index], allocated[index]),
  }));
}

export function prepareEstimateExport(est, adjustment, showAdjustment = true) {
  const mats = Array.isArray(est?.mats) ? est.mats : [];
  const works = Array.isArray(est?.works) ? est.works : [];
  const equipment = Array.isArray(est?.equipment) ? est.equipment : [];
  const totals = calculateEstimateTotals(
    mats.reduce((sum, line) => sum + amount(line), 0),
    works.reduce((sum, line) => sum + amount(line), 0),
    adjustment,
    equipment.reduce((sum, line) => sum + amount(line), 0),
  );
  let targets = [cents(totals.materialsTotal), cents(totals.worksTotal), cents(totals.equipmentTotal)];
  const fold = !showAdjustment && totals.percent !== 0;
  if (fold) {
    if (totals.scope === 'all') {
      const factor = 1 + totals.percent / 100;
      targets = allocateCents([totals.materialsTotal * factor, totals.worksTotal * factor, totals.equipmentTotal * factor], cents(totals.adjustedTotal));
    } else {
      targets[{ mats: 0, works: 1, equipment: 2 }[totals.scope]] += cents(totals.adjustmentAmount);
    }
  }
  const foldedPercent = scope => fold && (totals.scope === 'all' || totals.scope === scope) ? totals.percent : 0;
  return {
    mats: prepareRows(mats, targets[0], foldedPercent('mats')),
    works: prepareRows(works, targets[1], foldedPercent('works')),
    equipment: prepareRows(equipment, targets[2], foldedPercent('equipment')),
    materialsTotal: targets[0] / 100,
    worksTotal: targets[1] / 100,
    equipmentTotal: targets[2] / 100,
    totals,
  };
}

// Partition already-priced project rows, so room subtotals keep the project's
// quantity overrides and kopecks instead of applying an adjustment per room.
export function partitionEstimateExport(prepared, rooms = []) {
  const sections = ['mats', 'works', 'equipment'];
  const groups = rooms.map((room, index) => ({
    id: room.id ?? String(index), name: room.name || 'Помещение', room,
    mats: [], works: [], equipment: [],
  }));
  const unassigned = { id: 'unassigned', name: 'Общие позиции', mats: [], works: [], equipment: [] };
  const key = line => String(line.k ?? line._k ?? line.nomId ?? `${line.n || ''}|${line.u || ''}`);
  sections.forEach(section => {
    (prepared[section] || []).forEach(line => {
      const matches = groups.map(group => ({
        group,
        weight: (group.room.est?.[section] || [])
          .filter(source => key(source) === key(line))
          .reduce((sum, source) => sum + Math.max(0, finite(source.q)), 0),
      })).filter(match => match.weight > 0);
      if (!matches.length) { unassigned[section].push({ ...line }); return; }
      const weightTotal = matches.reduce((sum, match) => sum + match.weight, 0);
      const allocated = allocateCents(matches.map(match => match.weight), cents(line.exportTotal));
      let remainingQuantity = finite(line.q);
      matches.forEach(({ group, weight }, index) => {
        const quantity = index === matches.length - 1 ? remainingQuantity : finite(line.q) * weight / weightTotal;
        remainingQuantity -= quantity;
        group[section].push({
          ...line, q: quantity, exportTotal: allocated[index] / 100,
          ...displayQuantity(quantity),
          exportPrice: displayPrice(quantity, finite(line.p), allocated[index]),
        });
      });
    });
  });
  if (sections.some(section => unassigned[section].length)) groups.push(unassigned);
  return groups.map(group => ({
    ...group,
    materialsTotal: (group.mats || []).reduce((sum, line) => sum + cents(line.exportTotal), 0) / 100,
    worksTotal: (group.works || []).reduce((sum, line) => sum + cents(line.exportTotal), 0) / 100,
    equipmentTotal: (group.equipment || []).reduce((sum, line) => sum + cents(line.exportTotal), 0) / 100,
  }));
}
