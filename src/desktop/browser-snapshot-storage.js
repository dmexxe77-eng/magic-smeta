import {validateDesktopSnapshot} from './desktop-storage.js';
import {decodeSnapshot, encodeSnapshot, isStorageQuotaError} from './snapshot-codec.js';

export const DESKTOP_SNAPSHOT_DB = 'zamer.desktop.snapshots.v1';
export const DESKTOP_SNAPSHOT_KEYS = ['zamer.desktop.working.v1', 'zamer.desktop.v1'];
const STORE = 'snapshots';

export class DesktopSnapshotLoadError extends Error {
  constructor(key, cause) {
    super('Не удалось восстановить сохранённые данные. Исходная запись оставлена без изменений.', {cause});
    this.name = 'DesktopSnapshotLoadError';
    this.kind = 'load';
    this.key = key;
  }
}

function saveError(error) {
  const quota = isStorageQuotaError(error);
  return {kind:quota ? 'quota' : 'storage', message:quota
    ? 'Не удалось сохранить: закончилось место в хранилище браузера. Изменения оставлены в редакторе.'
    : 'Не удалось сохранить: браузер запретил запись данных. Изменения оставлены в редакторе.'};
}

function validatedRaw(raw, validateSnapshot) {
  const decoded = decodeSnapshot(raw);
  if (typeof decoded !== 'string' || !validateSnapshot(JSON.parse(decoded))) {
    throw new Error('Invalid desktop snapshot');
  }
  return decoded;
}

function openDatabase(indexedDB, name) {
  return new Promise((resolve, reject) => {
    let request;
    let abandoned = false;
    try { request = indexedDB.open(name, 1); } catch (error) { reject(error); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error || new Error('Cannot open desktop database'));
    request.onblocked = () => {
      abandoned = true;
      reject(new Error('Desktop database is blocked'));
    };
    request.onsuccess = () => {
      if (abandoned) request.result.close();
      else resolve(request.result);
    };
  });
}

function readRecord(db, key) {
  return new Promise((resolve, reject) => {
    let tx, request;
    try {
      tx = db.transaction(STORE, 'readonly');
      request = tx.objectStore(STORE).get(key);
    } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () => reject(tx.error || request.error || new Error('Cannot read desktop snapshot'));
  });
}

function writeRecord(db, key, raw, revision) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      try { tx = db.transaction(STORE, 'readwrite', {durability:'strict'}); }
      catch (error) {
        if (!(error instanceof TypeError)) throw error;
        tx = db.transaction(STORE, 'readwrite');
      }
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Cannot write desktop snapshot'));
      tx.objectStore(STORE).put({version:1, raw, revision, updatedAt:Date.now()}, key);
    } catch (error) {
      try { tx?.abort(); } catch { /* A transaction that already ended cannot be aborted. */ }
      reject(error);
    }
  });
}

/**
 * Synchronous editor cache backed by ordered, durable browser transactions.
 * An accepted setItem is pending until oncomplete, and a failed latest value stays
 * in the cache for retry. Existing localStorage entries are never removed.
 */
export function createBrowserSnapshotStorage(options = {}) {
  const validateSnapshot = options.validateSnapshot ?? validateDesktopSnapshot;
  const keys = new Set(options.keys ?? DESKTOP_SNAPSHOT_KEYS);
  if (!keys.size || [...keys].some(key => !DESKTOP_SNAPSHOT_KEYS.includes(key))) throw new Error('Unsupported desktop snapshot key');
  const states = new Map([...keys].map(key => [key,
    {raw:null, revision:0, committedRevision:0, pending:false, error:null}]));
  const waiting = new Map();
  const listeners = new Set();
  const flushWaiters = new Set();
  let db = null;
  let mode = 'uninitialized';
  let initialized = false;
  let initializePromise;
  let active = null;
  let pumpQueued = false;
  const localStorage = () => options.storage ?? (options.getStorage ?? (() => globalThis.localStorage))();
  const stateFor = key => {
    if (!keys.has(key)) throw new Error('Unsupported desktop snapshot key');
    return states.get(key);
  };
  const statusFor = key => {
    const {pending, error, revision, committedRevision} = stateFor(key);
    return {key, pending, error, revision, committedRevision, mode};
  };
  const notify = key => {
    const status = statusFor(key);
    // Observers must not turn a completed transaction into a failed write.
    for (const listener of listeners) {
      try { listener(status); } catch (error) { globalThis.reportError?.(error); }
    }
    for (const waiter of flushWaiters) {
      const state = states.get(waiter.key);
      if (!state.pending) {
        flushWaiters.delete(waiter);
        waiter.resolve(!state.error && state.committedRevision >= state.revision);
      }
    }
  };
  const schedulePump = () => {
    if (pumpQueued || active) return;
    pumpQueued = true;
    queueMicrotask(() => { pumpQueued = false; void pump(); });
  };
  const pump = async () => {
    if (active || !waiting.size) return;
    const [key, job] = waiting.entries().next().value;
    waiting.delete(key);
    active = {key, ...job};
    const state = states.get(key);
    try {
      await writeRecord(db, key, job.raw, job.revision);
      state.committedRevision = Math.max(state.committedRevision, job.revision);
      if (state.revision === job.revision) state.error = null;
    } catch (error) {
      // A newer queued revision owns the status; an older failure cannot replace it.
      if (state.revision === job.revision) state.error = saveError(error);
    } finally {
      active = null;
      state.pending = waiting.has(key);
      notify(key);
      schedulePump();
    }
  };
  const enqueue = (key, state) => {
    waiting.set(key, {raw:state.raw, revision:state.revision});
    state.pending = true;
    state.error = null;
    notify(key);
    schedulePump();
  };
  const writeFallback = (key, state) => {
    try {
      const storage = localStorage();
      try { storage.setItem(key, state.raw); }
      catch (error) {
        if (!isStorageQuotaError(error)) throw error;
        storage.setItem(key, encodeSnapshot(state.raw));
      }
      state.committedRevision = state.revision;
      state.error = null;
    } catch (error) {
      state.error = saveError(error);
      throw error;
    } finally {
      state.pending = false;
      notify(key);
    }
  };
  const service = {
    get mode() { return mode; },
    get initialized() { return initialized; },
    initialize() {
      if (initializePromise) return initializePromise;
      initializePromise = (async () => {
        try {
          const factory = 'indexedDB' in options ? options.indexedDB : globalThis.indexedDB;
          if (!factory) throw new Error('IndexedDB is unavailable');
          db = await openDatabase(factory, options.dbName ?? DESKTOP_SNAPSHOT_DB);
          const connection = db;
          connection.onversionchange = () => connection.close();
          mode = 'indexedDB';
        } catch { mode = 'localStorage'; }
        for (const key of keys) {
          const state = states.get(key);
          try {
            const record = db ? await readRecord(db, key) : undefined;
            if (record !== undefined) {
              if (record?.version !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 0) {
                throw new Error('Invalid desktop snapshot record');
              }
              state.raw = validatedRaw(record.raw, validateSnapshot);
              state.revision = state.committedRevision = record.revision;
              continue;
            }
            const legacy = localStorage()?.getItem(key) ?? null;
            if (legacy == null) continue;
            state.raw = validatedRaw(legacy, validateSnapshot);
            state.revision = 1;
            if (db) {
              try {
                await writeRecord(db, key, state.raw, state.revision);
                state.committedRevision = state.revision;
              } catch (error) { state.error = saveError(error); }
            } else state.committedRevision = state.revision;
          } catch (error) { throw new DesktopSnapshotLoadError(key, error); }
        }
        initialized = true;
        return service;
      })();
      return initializePromise;
    },
    getItem(key) {
      if (!initialized) throw new Error('Desktop persistence has not initialized');
      return stateFor(key).raw;
    },
    setItem(key, raw) {
      if (!initialized) throw new Error('Desktop persistence has not initialized');
      const state = stateFor(key);
      const next = validatedRaw(raw, validateSnapshot);
      if (state.raw === next) return;
      state.raw = next;
      state.revision += 1;
      if (mode === 'indexedDB') enqueue(key, state);
      else writeFallback(key, state);
    },
    getStatus:statusFor,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retry(key) {
      const state = stateFor(key);
      if (!initialized) throw new Error('Desktop persistence has not initialized');
      if (state.raw != null && !state.pending && (state.error || state.revision > state.committedRevision)) {
        if (mode === 'indexedDB') enqueue(key, state);
        else { try { writeFallback(key, state); } catch { /* Status retains the write error. */ } }
      }
      return service.flush(key);
    },
    flush(key) {
      if (key == null) return Promise.all([...keys].map(item => service.flush(item))).then(results => results.every(Boolean));
      const state = stateFor(key);
      if (!state.pending) return Promise.resolve(!state.error && state.committedRevision >= state.revision);
      return new Promise(resolve => flushWaiters.add({key, resolve}));
    },
    async recover(key, raw) {
      const state = stateFor(key);
      const next = validatedRaw(raw, validateSnapshot);
      if (initialized) { service.setItem(key, next); return service.retry(key); }
      if (!initializePromise || mode === 'uninitialized') throw new Error('Initialize desktop persistence before recovery');
      // Recovery is an explicit user import, never an automatic fallback to seeds.
      state.raw = next;
      state.revision += 1;
      state.pending = true;
      state.error = null;
      notify(key);
      try {
        if (db) {
          await writeRecord(db, key, state.raw, state.revision);
          state.committedRevision = state.revision;
        } else writeFallback(key, state);
      } catch (error) {
        state.error = saveError(error);
        state.pending = false;
        notify(key);
        return false;
      }
      state.pending = false;
      notify(key);
      db?.close();
      db = null;
      initializePromise = undefined;
      await service.initialize();
      return true;
    },
    close() { db?.close(); },
  };
  return service;
}

let desktopPersistence;
export async function initializeDesktopPersistence(options) {
  desktopPersistence ??= createBrowserSnapshotStorage(options);
  return desktopPersistence.initialize();
}
export function getDesktopPersistence() { return desktopPersistence; }
