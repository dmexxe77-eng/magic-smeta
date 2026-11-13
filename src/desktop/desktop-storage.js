import {createDesignStorage, validateDesignSnapshot} from '../design-bridge/design-storage.js';
import {nomKey} from './nomenclature-identity.js';
import {validProjectCalculation} from './project-catalog.js';
import {packSnapshotImages, unpackSnapshotImages, validateSnapshotImages} from './snapshot-images.js';

export function desktopMigrationMetadata(value) {
  if (!value) return undefined;
  const {report, ...metadata} = value;
  return metadata;
}

const hasCalculationSnapshot = project => project.calculationSnapshotVersion != null || project.rooms.some(room =>
  room?.catalogSnapshot != null || Object.values(room || {}).some(value => Array.isArray(value)
    ? value.some(instance => instance?.presetSnapshot != null) : value?.presetSnapshot != null));

/** Equal display names can refer to different catalogue records in real backups. */
export function validateDesktopSnapshot(value) {
  if (!validateSnapshotImages(value) || !Array.isArray(value.nom) || !value.presets || typeof value.presets !== 'object') return false;
  if (value.catalogFolderOrder != null && (!Array.isArray(value.catalogFolderOrder)
    || value.catalogFolderOrder.some(id => typeof id !== 'string' || !id.length)
    || new Set(value.catalogFolderOrder).size !== value.catalogFolderOrder.length)) return false;
  const ids = value.nom.map(item => item?.nid || item?.id).filter(id => id != null);
  if (new Set(ids).size !== ids.length) return false;
  const editsValid = edits => edits != null && typeof edits === 'object' && !Array.isArray(edits)
    && Object.values(edits).every(line => line != null && typeof line === 'object' && !Array.isArray(line)
      && ['q','p'].every(key => line[key] == null || Number.isFinite(line[key]) && line[key] >= 0));
  if (!Array.isArray(value.projects) || value.projects.some(project => !Array.isArray(project?.rooms)
    || hasCalculationSnapshot(project) && !validProjectCalculation(project)
    || project.rooms.some(room => room?.estEd != null && !editsValid(room.estEd)))) return false;
  const presets = Object.fromEntries(Object.entries(value.presets).map(([block, list]) => [block,
    Array.isArray(list) ? list.map(preset => ({...preset, items: Array.isArray(preset?.items)
      ? preset.items.map(item => ({...item, variants: Array.isArray(item?.variants)
        ? item.variants.map(option => ({...option, n: String(nomKey(option))})) : item?.variants})) : preset?.items})) : list,
  ]));
  return validateDesignSnapshot({...value, presets});
}

export function createDesktopDesignStorage(options = {}) {
  const store = createDesignStorage({...options, validateSnapshot: validateDesktopSnapshot});
  const load = store.load, save = store.save;
  store.load = () => {
    const value = load();
    return value === null ? null : unpackSnapshotImages(value);
  };
  store.save = value => {
    try {return save(packSnapshotImages(value));}
    catch {return save(null);}
  };
  const adapter = () => options.storage ?? options.getStorage?.();
  return Object.defineProperties(store, {
    persistence:{get:() => adapter()?.persistence},
    persistenceKey:{get:() => adapter()?.persistenceKey},
  });
}
