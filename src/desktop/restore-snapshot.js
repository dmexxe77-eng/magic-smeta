import {getDesktopPersistence, DESKTOP_SNAPSHOT_KEYS} from './browser-snapshot-storage.js';
import {serializeSnapshotBackup} from './snapshot-backup.js';

export function activeDesktopSnapshotKey(dataset = globalThis.window?.MAGIC_MAIN) {
  return dataset?.migration?.sourceHash ? DESKTOP_SNAPSHOT_KEYS[0] : DESKTOP_SNAPSHOT_KEYS[1];
}

/** Pause the old page's autosave so pagehide cannot overwrite an imported copy. */
export async function restoreDesktopSnapshot(snapshot, engine, {
  persistence = getDesktopPersistence(), key = activeDesktopSnapshotKey(),
  reload = () => window.location.reload(), targetWindow = globalThis.window,
  targetDocument = globalThis.document,
} = {}) {
  const raw = serializeSnapshotBackup(snapshot);
  if (!persistence) throw new Error('Хранилище ещё не готово. Копия не заменена.');
  const ready = engine?._designStorageReady;
  if (engine) {
    engine._desktopRestoring = true;
    engine._desktopRestoreCommitted = false;
    engine._designStorageReady = false;
    clearTimeout(engine._designSaveTimer);
    engine._designSaveTimer = null;
    targetWindow?.removeEventListener('pagehide', engine._designPageHide);
    targetDocument?.removeEventListener('visibilitychange', engine._designVisibility);
  }
  try {
    if (!await persistence.recover(key, raw)) throw new Error('Браузер не смог сохранить копию. Исходный расчёт остаётся открытым.');
  } catch (error) {
    if (engine) engine._desktopRestoring = false;
    if (engine && ready) {
      engine.startDesignStorage();
      engine.saveDesign();
    }
    throw error;
  }
  if (engine) engine._desktopRestoreCommitted = true;
  reload();
  return true;
}
