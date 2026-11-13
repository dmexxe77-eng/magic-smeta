export const ORIGINAL_ORIGIN = 'http://127.0.0.1:5173';
export const CANDIDATE_ORIGIN = 'http://127.0.0.1:5174';
export const SEED_KEYS = ['zamer.design.v1', 'zamer.contractTpl'];

const record = value => value && typeof value === 'object' && !Array.isArray(value);

/** Read only the mobile project snapshot and document settings. */
export function readComparisonSeed(storage) {
  const seed = {};
  for (const key of SEED_KEYS) {
    const raw = storage.getItem(key);
    if (raw !== null) seed[key] = raw;
  }
  if (!Object.hasOwn(seed, 'zamer.contractTpl')) {
    const legacy = JSON.parse(storage.getItem('magicapp_v2_4_autosave_v1') || 'null');
    if (record(legacy?.contract?.head)) seed['zamer.contractTpl'] = JSON.stringify({ head: legacy.contract.head });
  }
  return seed;
}

/** Initialize the separate origin once; subsequent comparisons keep its edits. */
export function applyComparisonSeed(storage, seed) {
  if (!record(seed) || Object.keys(seed).some(key => !SEED_KEYS.includes(key))) throw new Error('Неверный набор данных для сравнения');
  const pending = [];
  for (const [key, raw] of Object.entries(seed)) {
    if (typeof raw !== 'string') throw new Error('Неверный формат данных');
    const value = JSON.parse(raw);
    if (!record(value) || (key === 'zamer.design.v1' && (value.version !== 1 || !Array.isArray(value.projects)))) throw new Error('Не удалось прочитать сохранённые данные');
    if (storage.getItem(key) === null) pending.push([key, raw]);
  }
  const written = [];
  try {
    for (const [key, raw] of pending) { storage.setItem(key, raw); written.push(key); }
  } catch (cause) {
    const failures = [];
    for (const key of written) { try { storage.removeItem(key); } catch (error) { failures.push(error); } }
    if (failures.length) throw new AggregateError([cause, ...failures], 'Не удалось завершить копирование данных');
    throw cause;
  }
  return written.length;
}
