import {validateDesktopSnapshot} from './desktop-storage.js';
import {packSnapshotImages, unpackSnapshotImages} from './snapshot-images.js';

export const MAX_SNAPSHOT_BACKUP_BYTES = 64 * 1024 * 1024;

const bytesIn = text => new TextEncoder().encode(text).byteLength;
const invalidBackup = () => new Error('Это не резервная копия онлайн-версии ЗАМЕРX или файл повреждён. Данные не изменены.');

function assertSnapshot(snapshot) {
  try {
    if (validateDesktopSnapshot(snapshot)) return;
  } catch {
    // A malformed nested record must be rejected without reaching the live engine.
  }
  throw invalidBackup();
}

export function parseSnapshotBackup(text) {
  if (typeof text !== 'string') throw invalidBackup();
  if (bytesIn(text) > MAX_SNAPSHOT_BACKUP_BYTES) throw new Error('Файл слишком большой. Максимальный размер резервной копии — 64 МБ.');
  let snapshot;
  try {snapshot = JSON.parse(text.replace(/^\uFEFF/, ''));} catch {throw invalidBackup();}
  assertSnapshot(snapshot);
  return unpackSnapshotImages(snapshot);
}

/** JSON preserves photos, catalogue identities and all additional engine metadata. */
export function serializeSnapshotBackup(snapshot) {
  assertSnapshot(snapshot);
  const text = JSON.stringify(packSnapshotImages(snapshot));
  if (bytesIn(text) > MAX_SNAPSHOT_BACKUP_BYTES) throw new Error('Резервная копия превышает 64 МБ.');
  return text;
}

export function snapshotBackupSummary(snapshot) {
  assertSnapshot(snapshot);
  return {
    projects:snapshot.projects.length,
    rooms:snapshot.projects.reduce((count, project) => count + project.rooms.length, 0),
    nom:snapshot.nom.length,
    presets:Object.values(snapshot.presets).reduce((count, presets) => count + presets.length, 0),
  };
}

export function snapshotBackupFilename(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `zamerx_backup_${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.json`;
}
