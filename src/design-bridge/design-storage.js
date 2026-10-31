/** Persistence for /design only. Main application and contract storage stay independent. */
export const DESIGN_STORAGE_KEY = 'zamer.design.v1';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const identifier = value => (typeof value === 'string' && value.length > 0) || Number.isFinite(value);
const safeBlockId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value)
  && !['__proto__', 'constructor', 'prototype'].includes(value);
const position = value => record(value) && typeof value.n === 'string' && typeof value.u === 'string' && nonnegative(value.p);
const presetPosition = value => position(value) && (value.variants == null || (Array.isArray(value.variants)
  && value.variants.length > 0 && value.variants.every(position)
  && new Set(value.variants.map(option => option.n)).size === value.variants.length));
const contour = value => Array.isArray(value) && value.every(point => Array.isArray(point) && point.length >= 2
  && Number.isFinite(point[0]) && Number.isFinite(point[1]));

/** Validate fields used by the mobile editor while retaining additional data unchanged. */
export function validateDesignSnapshot(value) {
  try {
    if (!record(value) || value.version !== 1 || !Array.isArray(value.blocks) || !record(value.presets)
      || !Array.isArray(value.nom) || !Array.isArray(value.roomOpts) || !Array.isArray(value.projects)
      || !record(value.estEd) || (value.profile != null && !record(value.profile))) return false;
    const ids = new Set();
    for (const block of value.blocks) {
      if (!record(block) || !safeBlockId(block.id) || ids.has(block.id) || typeof block.title !== 'string') return false;
      ids.add(block.id);
      if (!Array.isArray(value.presets[block.id])) return false;
    }
    if (!ids.has('canvas') || !ids.has('main')) return false;
    if (Object.keys(value.presets).some(id => !ids.has(id))) return false;
    for (const list of Object.values(value.presets)) {
      const presetIds = new Set();
      for (const preset of list) {
        if (!record(preset) || !identifier(preset.id) || presetIds.has(preset.id)
          || typeof preset.name !== 'string' || !Array.isArray(preset.items) || !preset.items.every(presetPosition)) return false;
        presetIds.add(preset.id);
      }
    }
    if (!value.nom.every(item => position(item) && typeof item.br === 'string')
      || !value.roomOpts.every(option => position(option) && identifier(option.id))) return false;
    const projectIds = new Set();
    for (const project of value.projects) {
      if (!record(project) || !identifier(project.id) || projectIds.has(project.id)
        || typeof project.name !== 'string' || !Array.isArray(project.rooms)) return false;
      projectIds.add(project.id);
      const roomIds = new Set();
      for (const room of project.rooms) {
        if (!record(room) || !identifier(room.id) || roomIds.has(room.id) || !contour(room.v)
          || !record(room.canvas) || !record(room.main)
          || (room.extraItems != null && (!Array.isArray(room.extraItems)
            || !room.extraItems.every(item => position(item) && nonnegative(item.qty))))
          || (room.holes != null && (!Array.isArray(room.holes) || !room.holes.every(contour)))) return false;
        roomIds.add(room.id);
        for (const block of value.blocks) {
          if (block.single || block.id === 'canvas' || block.id === 'main' || room[block.id] == null) continue;
          if (!Array.isArray(room[block.id]) || !room[block.id].every(instance => record(instance)
            && identifier(instance.id) && (instance.qty == null || nonnegative(instance.qty)))) return false;
        }
      }
    }
    return Object.values(value.estEd).every(project => record(project) && Object.values(project).every(line => record(line)
      && (line.q == null || nonnegative(line.q)) && (line.p == null || nonnegative(line.p))));
  } catch {
    return false;
  }
}

/** Keep a full snapshot, retry failed writes and report at most once per editor session. */
export function createDesignStorage({ storage, getStorage = () => globalThis.localStorage, onError = () => {} } = {}) {
  let lastSaved = null;
  let reported = false;
  const report = action => {
    if (reported) return;
    reported = true;
    onError(action === 'load'
      ? 'Не удалось восстановить данные редактора. Открыты исходные данные.'
      : 'Не удалось сохранить изменения на этом устройстве. Проверьте свободное место и доступ к хранилищу.');
  };
  const access = () => storage ?? getStorage();
  return {
    load() {
      try {
        const raw = access().getItem(DESIGN_STORAGE_KEY);
        if (raw == null) return null;
        const value = JSON.parse(raw);
        if (!validateDesignSnapshot(value)) throw new Error('Invalid mobile snapshot');
        lastSaved = JSON.stringify(value);
        return value;
      } catch {
        report('load');
        return null;
      }
    },
    save(value) {
      try {
        if (!validateDesignSnapshot(value)) throw new Error('Invalid mobile snapshot');
        const raw = JSON.stringify(value);
        if (raw === lastSaved) return true;
        access().setItem(DESIGN_STORAGE_KEY, raw);
        lastSaved = raw;
        return true;
      } catch {
        report('save');
        return false;
      }
    },
  };
}
