import {upgradeWorkingPhotos} from './photo-recovery.js';
import {decodeSnapshot, encodeSnapshot, isCompressedSnapshot, isStorageQuotaError} from './snapshot-codec.js';
import {getDesktopPersistence} from './browser-snapshot-storage.js';

/** Minimal synchronous state host for the shared mobile business engine. */
export class DCLogic {
  constructor(props = {}) {
    this.props = { platform: 'ipad', theme: 'light', startScreen: 'home', ...props };
    this._listeners = new Set();
    this._version = 0;
    this._mounted = false;
    this._updateQueued = false;
    this._persistenceError = null;
  }

  subscribe = listener => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  getSnapshot = () => this._version;
  getServerSnapshot = () => 0;
  get version() { return this._version; }
  get persistenceError() { return this._persistenceError || this._persistenceStatus?.error || null; }
  get persistencePending() { return !!this._persistenceStatus?.pending; }

  bindPersistence(persistence, key) {
    if (!persistence || this._persistence === persistence && this._persistenceKey === key) return;
    this._unsubscribePersistence?.();
    this._persistence = persistence;
    this._persistenceKey = key;
    this._persistenceStatus = persistence.getStatus(key);
    this._unsubscribePersistence = persistence.subscribe(status => {
      if (status.key !== this._persistenceKey) return;
      this._persistenceStatus = status;
      this._notifyPersistence();
    });
  }

  _notifyPersistence() {
    this._version += 1;
    for (const listener of this._listeners) listener();
  }

  persistDesignSnapshot(store, snapshot) {
    if (this._desktopRestoring) return false;
    this.bindPersistence(store.persistence, store.persistenceKey);
    const saved = store.save(snapshot);
    // Autosave stores the pre-edit snapshot while a preset transaction is open.
    // That successful baseline write cannot acknowledge a failed draft commit.
    if (!saved || !this._presetDraft?.commitFailed) {
      const error = saved ? null : store.error || {kind:'storage', message:'Не удалось сохранить изменения в браузере.'};
      if (error?.kind !== this._persistenceError?.kind || error?.message !== this._persistenceError?.message) {
        this._persistenceError = error;
        this._notifyPersistence();
      }
    }
    return saved;
  }

  retryDesignSave() {
    const saved = this._presetDraft?.commitFailed ? this.finishPresetDraft(true) : this.saveDesign();
    if (!saved) return false;
    return this._persistence ? this._persistence.retry(this._persistenceKey) : true;
  }

  async toastWhenSaved(message) {
    if (this._presetDraft && !this._presetDraft.commitFailed) {
      this.toast('Изменения внесены в пресет. Сохраните пресет.');
      return true;
    }
    if (!this.saveDesign()) return false;
    const saved = this._persistence ? await this._persistence.flush(this._persistenceKey) : true;
    if (saved) this.toast(message);
    return saved;
  }

  setState(change, callback) {
    const patch = typeof change === 'function' ? change(this.state, this.props) : change;
    if (patch != null) {
      this.state = { ...this.state, ...patch };
      this.forceUpdate();
    }
    callback?.call(this);
  }

  forceUpdate() {
    this._version += 1;
    for (const listener of this._listeners) listener();
    this._scheduleLifecycle();
  }

  _scheduleLifecycle() {
    if (!this._mounted || this._updateQueued) return;
    this._updateQueued = true;
    Promise.resolve().then(() => {
      this._updateQueued = false;
      if (this._mounted) this.componentDidUpdate?.(this.props);
    });
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this.componentDidMount?.();
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    this.componentWillUnmount?.();
  }
}

export const DESKTOP_STORAGE_KEY = 'zamer.desktop.v1';
export const DESKTOP_WORKING_STORAGE_KEY = 'zamer.desktop.working.v1';
const MOBILE_STORAGE_KEY = 'zamer.design.v1';

function upgradeWorkingStatuses(raw, dataset) {
  if (raw == null || !(dataset?.migration?.statusMappingVersion >= 2)) return raw;
  try {
    const saved = JSON.parse(raw);
    if (saved?.migration?.sourceHash !== dataset.migration.sourceHash
      || !(Number(saved.migration.statusMappingVersion || 0) < 2)
      || !Array.isArray(saved.projects) || !Array.isArray(dataset.projects)) return raw;
    const awaitingAgreement = new Set(dataset.projects.filter(project => project.status === 'discuss').map(project => project.id));
    return JSON.stringify({ ...saved, migration: { ...saved.migration, statusMappingVersion: 2 },
      projects: saved.projects.map(project => project.status === 'estimate' && awaitingAgreement.has(project.id)
        ? { ...project, status: 'discuss' } : project) });
  } catch { return raw; }
}

/** Reuse the validated mobile schema while isolating every desktop write. */
export function createDesktopStorage(getStorage = () => getDesktopPersistence() || window.localStorage, getDataset = () => globalThis.window?.MAGIC_MAIN) {
  const compressedKeys = new Set();
  const working = () => !!getDataset()?.migration?.sourceHash;
  const desktopKey = () => working() ? DESKTOP_WORKING_STORAGE_KEY : DESKTOP_STORAGE_KEY;
  return {
    get persistence() {const storage = getStorage(); return typeof storage?.getStatus === 'function' ? storage : null;},
    get persistenceKey() {return desktopKey();},
    getItem(key) {
      const storage = getStorage();
      if (key !== MOBILE_STORAGE_KEY) return storage.getItem(key);
      const saved = storage.getItem(desktopKey());
      if (isCompressedSnapshot(saved)) compressedKeys.add(desktopKey());
      const raw = decodeSnapshot(saved);
      return working() ? upgradeWorkingPhotos(upgradeWorkingStatuses(raw, getDataset()), getDataset()) : raw ?? (this.persistence ? null : storage.getItem(MOBILE_STORAGE_KEY));
    },
    setItem(key, value) {
      const target = key === MOBILE_STORAGE_KEY ? desktopKey() : key, storage = getStorage();
      if (this.persistence) {storage.setItem(target, value); return;}
      if (key !== MOBILE_STORAGE_KEY) {storage.setItem(target, value);return;}
      if (compressedKeys.has(target)) {storage.setItem(target, encodeSnapshot(value));return;}
      try {storage.setItem(target, value);} catch (error) {
        if (!isStorageQuotaError(error)) throw error;
        storage.setItem(target, encodeSnapshot(value));
        compressedKeys.add(target);
      }
    },
    removeItem(key) {
      const target = key === MOBILE_STORAGE_KEY ? desktopKey() : key;
      getStorage().removeItem(target);
      compressedKeys.delete(target);
    },
  };
}

/** Local device dates follow the operator's calendar, without UTC day shifts. */
export function desktopToday(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function desktopDisplayDate(date = new Date()) {
  return desktopToday(date).split('-').reverse().join('.');
}

export function desktopPeriodStart(period, date = new Date()) {
  const months = { month: 1, quarter: 3, year: 12 }[period] ?? 0;
  const day = date.getDate();
  const start = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  start.setDate(Math.min(day, lastDay));
  return desktopToday(start).replaceAll('-', '');
}

export function desktopTodayLabel(date = new Date()) {
  const label = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
