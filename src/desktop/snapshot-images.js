const POOL_KEY = '_frozenImages';
const REFERENCE_PREFIX = 'zamer-image-ref:';
const imageField = key => key === 'img' || key === 'imageUrl';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => !['__proto__','constructor','prototype'].includes(key);
const imageId = value => /^image\d+$/.test(value);
const rasterData = value => typeof value === 'string'
  && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  && (value.length - value.indexOf(',') - 1) % 4 === 0;
const reference = value => typeof value === 'string' && value.startsWith(REFERENCE_PREFIX);
const invalidImages = () => new Error('Invalid frozen snapshot image references');

/** Check the wire format without expanding a photograph for every room. */
export function validateSnapshotImages(snapshot) {
  try {
    if (!record(snapshot)) return false;
    const pool = Object.hasOwn(snapshot,POOL_KEY) ? snapshot[POOL_KEY] : null;
    if (pool !== null && (!record(pool) || pool.version !== 1 || !record(pool.values)
      || Object.keys(pool).some(key => !['version','values'].includes(key))
      || Object.entries(pool.values).some(([id,value]) => !imageId(id) || !safeKey(id) || !rasterData(value)))) return false;
    if (Object.hasOwn(snapshot,POOL_KEY) && pool === null) return false;
    const ancestors = new WeakSet();
    const visit = (value, root = false) => {
      if (value === null || typeof value !== 'object') return true;
      if (ancestors.has(value)) return false;
      ancestors.add(value);
      for (const [key,item] of Object.entries(value)) {
        if (!safeKey(key)) return false;
        if (root && key === POOL_KEY) continue;
        if (imageField(key) && reference(item)) {
          const id = item.slice(REFERENCE_PREFIX.length);
          if (value._photoFrozen !== true || !pool || !imageId(id) || !Object.hasOwn(pool.values,id)) return false;
        }
        if (!visit(item)) return false;
      }
      ancestors.delete(value);
      return true;
    };
    return visit(snapshot,true);
  } catch {return false;}
}

function copyImages(snapshot, transform) {
  const copy = (value, root = false) => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => copy(item));
    const result = {};
    for (const [key,item] of Object.entries(value)) {
      if (root && key === POOL_KEY) continue;
      const next = copy(item);
      result[key] = value._photoFrozen === true && imageField(key) ? transform(next) : next;
    }
    return result;
  };
  return copy(snapshot,true);
}

/** Only ready photographs captured in calculations are pooled; catalogue editing sources stay intact. */
export function packSnapshotImages(snapshot) {
  if (!validateSnapshotImages(snapshot)) throw invalidImages();
  const previous = snapshot[POOL_KEY]?.values;
  const ids = new Map(), values = {};
  const packed = copyImages(snapshot,value => {
    const image = reference(value) ? previous[value.slice(REFERENCE_PREFIX.length)] : value;
    if (typeof image !== 'string' || !image.startsWith('data:image/')) return image;
    let id = ids.get(image);
    if (id === undefined) {
      if (!rasterData(image)) return image;
      id = `image${ids.size}`;
      ids.set(image,id);
      values[id] = image;
    }
    return REFERENCE_PREFIX + id;
  });
  if (ids.size) packed[POOL_KEY] = {version:1,values};
  return packed;
}

/** Calculators and estimate renderers receive their original image fields, never wire references. */
export function unpackSnapshotImages(snapshot) {
  if (!validateSnapshotImages(snapshot)) throw invalidImages();
  const values = snapshot[POOL_KEY]?.values;
  return copyImages(snapshot,value => reference(value) ? values[value.slice(REFERENCE_PREFIX.length)] : value);
}
