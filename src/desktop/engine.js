import { useSyncExternalStore } from 'react';
import { MobileEngine } from './generated/mobile-engine.js';
import { openDrawingWorkspace } from './ui-actions.js';
import {getDesktopPersistence} from './browser-snapshot-storage.js';
import {DESKTOP_STORAGE_KEY, DESKTOP_WORKING_STORAGE_KEY} from './engine-base.js';

export * from './generated/mobile-engine.js';
export { DESKTOP_STORAGE_KEY } from './engine-base.js';

export const engine = new MobileEngine({ platform: 'ipad', theme: 'light', startScreen: 'home' });
engine.bindPersistence(getDesktopPersistence(), window.MAGIC_MAIN?.migration?.sourceHash ? DESKTOP_WORKING_STORAGE_KEY : DESKTOP_STORAGE_KEY);
engine.openDraw = room => openDrawingWorkspace(engine, room);
engine.mount();
const protectUnsavedChanges = event => {
  if (engine._desktopRestoreCommitted) return;
  // Enqueue the current edit even if its ordinary 120 ms debounce has not fired.
  if (!engine._desktopRestoring) engine.saveDesign();
  if (!engine.persistencePending && !engine.persistenceError && !engine._desktopRestoring) return;
  event.preventDefault();
  event.returnValue = '';
};
window.addEventListener('beforeunload', protectUnsavedChanges);

export function useEngine() {
  const version = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getServerSnapshot);
  return { engine, state: engine.state, version };
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  engine.unmount();
  engine._unsubscribePersistence?.();
  window.removeEventListener('beforeunload', protectUnsavedChanges);
});
