/** Shared, side-effect-free quantity rules for the mobile calculator and estimate. */
const SOURCES = new Set(['area', 'perim', 'manual']);
const LENGTH_UNITS = new Set(['м.п.', 'м.п', 'м', 'м.']);
const DEFAULT_DEDUCTIONS = [
  { id: 'extra', source: 'manual', unit: 'м.п.', subP: true },
  { id: 'curtain', source: 'manual', unit: 'м.п.', subP: true },
];
const quantity = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const round = value => Math.round(value * 1000) / 1000;

export function sourceOfBlock(def = {}) {
  if (SOURCES.has(def.source)) return def.source;
  return def.id === 'canvas' ? 'area' : def.id === 'main' ? 'perim' : 'manual';
}

function unitOfBlock(def) {
  return def.unit || (sourceOfBlock(def) === 'area' ? 'м²' : sourceOfBlock(def) === 'perim' ? 'м.п.' : 'шт');
}

function definitionOfInstance(def, instance) {
  const snapshot = instance?.qdef;
  return {
    ...def,
    source: SOURCES.has(snapshot?.source) ? snapshot.source : sourceOfBlock(def),
    unit: snapshot?.unit || unitOfBlock(def),
  };
}

export function getInstances(room, def) {
  const value = room?.[def.id];
  if (def.single) return value && typeof value === 'object' ? [value] : [];
  return Array.isArray(value) ? value.filter(instance => instance && typeof instance === 'object') : [];
}

export function createInstance(def, pid, id) {
  return { id, pid, qdef: { source: sourceOfBlock(def), unit: unitOfBlock(def) } };
}

function rawBlockQuantity(def, instance, g) {
  const effective = definitionOfInstance(def, instance);
  const override = quantity(def.single ? instance?.qtyO : instance?.qty);
  const value = override != null ? override : effective.source === 'area' ? quantity(g?.a) :
    effective.source === 'perim' ? quantity(g?.p) : null;
  return { value, source: effective.source, unit: effective.unit, overridden: override != null };
}

function perimeterDeductions(room, g, defs) {
  return (defs || DEFAULT_DEDUCTIONS).reduce((total, def) => {
    if (!(def.subP || def.id === 'extra' || def.id === 'curtain')) return total;
    return total + getInstances(room, def).reduce((sum, instance) => {
      if (!instance.subP) return sum;
      const q = rawBlockQuantity(def, instance, g);
      return LENGTH_UNITS.has(q.unit) ? sum + (q.value ?? 0) : sum;
    }, 0);
  }, 0);
}

/** qtyO in an existing single block is already its final quantity, after deductions. */
export function blockQuantity(def, instance, room, g, defs) {
  const q = rawBlockQuantity(def, instance, g);
  const deducted = def.id === 'main' && q.source === 'perim' && !q.overridden && q.value != null ?
    round(perimeterDeductions(room, g, defs)) : 0;
  return {
    ...q,
    value: q.value == null ? null : Math.max(0, round(q.value - deducted)),
    shown: q.value,
    missing: q.value == null,
    deducted,
  };
}

function sourceQuantity(source, block, g) {
  switch (source) {
    case 'area': return quantity(g?.a);
    case 'perim': return quantity(g?.p);
    case 'inner': return quantity(g?.inn);
    case 'outer': return quantity(g?.out);
    case 'angles': {
      const inner = quantity(g?.inn), outer = quantity(g?.out);
      return inner == null || outer == null ? null : inner + outer;
    }
    case 'manual': return null;
    default: return quantity(block?.value);
  }
}

/** iq contains the final user-entered quantity, so norms and multiples do not run again. */
export function itemQuantity(item, instance, block, g) {
  const override = instance?.iq?.[item.key || item.n];
  if (override != null) {
    const value = quantity(override);
    return { value, overridden: true, missing: value == null };
  }
  let value = sourceQuantity(item.src, block, g);
  if (value == null) return { value: null, overridden: false, missing: true };
  const norm = Number(item.k);
  if (Number.isFinite(norm) && norm > 0 && norm !== 1) {
    value *= norm;
    if (item.u === 'шт' || item.u === 'шт.') value = Math.ceil(value - 1e-9);
  }
  const multiple = Number(item.mult);
  if (Number.isFinite(multiple) && multiple > 0 && value > 0) {
    value = Math.ceil(value / multiple - 1e-9) * multiple;
  }
  value = quantity(round(value));
  return { value, overridden: false, missing: value == null };
}

export function instanceLines(def, instance, preset, room, g, defs) {
  const block = blockQuantity(def, instance, room, g, defs);
  return (preset?.items || []).map(item => {
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const selected = variants.find(option => option.n === instance?.variants?.[item.n]) || variants[0];
    const effective = selected ? { ...item, n: selected.n, p: selected.p, u: selected.u, m: selected.m, category: selected.category, key: item.n } : item;
    const q = itemQuantity(effective, instance, block, g);
    const on = instance?.off?.[item.n] !== true;
    const price = Number(effective.p);
    return {
      ...effective,
      key: item.n,
      q: q.value,
      t: on && q.value != null && Number.isFinite(price) ? q.value * price : 0,
      on,
      ov: q.overridden,
      manual: item.src === 'manual',
      missing: q.missing,
    };
  });
}
