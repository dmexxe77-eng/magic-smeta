/** Catalogue identity stays independent of its user-facing name. */
export const nomKey = item => item?.nid || item?.id || item?.n;

export const nomImage = item => item?.photoRemoved ? null : item?.imageUrl || (item?.img ? '/design/nom/' + item.img : null);

/** Explicit reference IDs stay authoritative; older name references still resolve. */
export function resolveNom(nomenclature, reference) {
  if (reference == null) return undefined;
  const object = typeof reference === 'object' ? reference : null;
  const key = object ? nomKey(object) : reference;
  const exact = nomenclature.find(item => (item.nid || item.id) === key);
  if (exact) return exact;
  if (object?.nid) return undefined;
  const name = object?.n || key;
  return nomenclature.find(item => item.n === name);
}

/** Use the matching ID's photo when different suppliers share a display name. */
export function withEstimateImages(estimate, nomenclature = []) {
  const enrich = line => {
    let item = resolveNom(nomenclature, line);
    if (!item && !line.nid && typeof line.k === 'string' && line.k.includes('|')) {
      const reference = line.k.slice(0, line.k.indexOf('|'));
      const candidate = resolveNom(nomenclature, reference);
      if (candidate && (candidate.id || line.n?.startsWith(candidate.n + ' ('))) item = candidate;
    }
    const raw = line._photoFrozen ? nomImage(line) : item?.photoRemoved ? null : nomImage(item) || line.img;
    const img = typeof raw === 'string' && /^[A-Za-z0-9_.-]+\.(?:png|jpe?g|gif|webp|avif)$/i.test(raw)
      ? '/design/nom/' + raw : raw;
    return img ? { ...line, img } : { ...line, img:undefined };
  };
  return { ...estimate, ...Object.fromEntries(['mats', 'works', 'equipment'].map(key => [key, (estimate[key] || []).map(enrich)])) };
}
