import { blockQuantity, itemQuantity } from '../design-bridge/quantity-model.js';
import { nomKey } from './nomenclature-identity.js';

/** Shared arithmetic, with stable row and alternative identities for desktop data. */
export function instanceLines(def, instance, preset, room, geometry, definitions) {
  const block = blockQuantity(def, instance, room, geometry, definitions);
  return (preset?.items || []).filter(item => !item._unresolved).map(item => {
    const key = item.nid || item.key || item.n;
    const variants = Array.isArray(item.variants) ? item.variants.filter(option => !option._unresolved) : [];
    const selected = variants.find(option => nomKey(option) === instance?.variants?.[key]) || variants[0];
    const effective = selected ? {
      ...item, n: selected.n, p: selected.p, u: selected.u, m: selected.m,
      category: selected.category, cv: selected.cv, nid: selected.nid || selected.id, key,
      ...(selected._photoFrozen ? {imageUrl:selected.imageUrl, img:selected.img, photoRemoved:selected.photoRemoved, _photoFrozen:true} : {}),
    } : { ...item, key };
    const result = itemQuantity(effective, instance, block, geometry);
    const on = instance?.off?.[key] !== true;
    const price = Number(effective.p);
    return {
      ...effective, variants: item.variants, key, q: result.value,
      t: on && result.value != null && Number.isFinite(price) ? result.value * price : 0,
      on, ov: result.overridden, manual: item.src === 'manual', missing: result.missing,
    };
  });
}
