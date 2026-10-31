/** Attach matching catalogue photos without changing quantities, prices or selected alternatives. */
export function withEstimateImages(estimate, nomenclature = []) {
  const byName = new Map(nomenclature.map(item => [item.n, item]));
  const enrich = line => {
    let item = byName.get(line.n);
    if (!item && typeof line.k === 'string' && line.k.includes('|')) {
      const candidate = byName.get(line.k.slice(0, line.k.indexOf('|')));
      if (candidate && typeof line.n === 'string' && line.n.startsWith(candidate.n + ' (')) item = candidate;
    }
    const raw = line.img || item?.img;
    const img = typeof raw === 'string' && /^[A-Za-z0-9_.-]+\.(?:png|jpe?g|gif|webp|avif)$/i.test(raw) ? '/design/nom/' + raw : raw;
    return img ? { ...line, img } : { ...line };
  };
  return { ...estimate, ...Object.fromEntries(['mats', 'works', 'equipment'].map(key => [key, (estimate[key] || []).map(enrich)])) };
}
