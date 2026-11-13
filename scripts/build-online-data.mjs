/** Publish only the validated desktop dataset into local build assets. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateDesktopSnapshot, desktopMigrationMetadata} from '../src/desktop/desktop-storage.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const photoPrefix = '/online/nom/';
const validPhotoName = value => typeof value === 'string' && /^nom-[a-z0-9_-]+\.(?:png|jpe?g|gif|webp|avif)$/i.test(value);
const sourceOnlyFields = new Set(['_main', 'sourcePhoto', 'sourceImg']);

function publicFields(value) {
  if (Array.isArray(value)) return value.map(publicFields);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sourceOnlyFields.has(key))
    .map(([key, item]) => [key, publicFields(item)]));
}

function verifyImages(data, directory) {
  const images = data.migration.report.images;
  if (!Array.isArray(images)) throw new Error('Online data has no catalogue photo manifest');
  const byId = new Map();
  const filenames = new Set();
  for (const image of images) {
    if (image?.id == null || !validPhotoName(image.file) || !validHash(image.sha256)
      || !Number.isSafeInteger(image.bytes) || image.bytes <= 0) throw new Error('Invalid online catalogue photo manifest entry');
    const id = String(image.id);
    if (byId.has(id) || filenames.has(image.file)) throw new Error(`Duplicate online catalogue photo manifest entry for ${id}`);
    byId.set(id, image);
    filenames.add(image.file);
    const file = path.join(directory, image.file);
    if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) throw new Error(`Missing regular online catalogue photo for ${id}`);
    const bytes = fs.readFileSync(file);
    if (bytes.length !== image.bytes || sha256(bytes) !== image.sha256.toLowerCase()) throw new Error(`Online catalogue photo integrity mismatch for ${id}`);
  }
  for (const item of data.nom) {
    const id = String(item.nid ?? item.id);
    const image = byId.get(id);
    if (image && item.imageUrl !== photoPrefix + image.file) throw new Error(`Online catalogue photo reference mismatch for ${id}`);
    if (!item.imageUrl?.startsWith(photoPrefix)) continue;
    const name = item.imageUrl.slice(photoPrefix.length);
    if (!validPhotoName(name) || !image || image.file !== name) throw new Error(`Missing online catalogue photo manifest entry for ${id}`);
    byId.delete(id);
  }
  if (byId.size) throw new Error('Online catalogue photo manifest contains unknown records');
}

export function writeOnlineData({projectRoot = root, log = console.log} = {}) {
  const source = path.join(projectRoot,'online-src/working-data.json');
  const data = JSON.parse(fs.readFileSync(source,'utf8'));
  if (!validateDesktopSnapshot(data)) throw new Error('Online working data did not pass validation');
  if (!validHash(data.migration?.sourceHash)) throw new Error('Online data has no valid source SHA-256');
  if (sha256(fs.readFileSync(source + '.source.json')) !== data.migration.sourceHash.toLowerCase()) throw new Error('Online data source SHA-256 mismatch');
  if (data.migration.report?.parityOk !== true) throw new Error('Online data has no successful calculation parity report');
  const unavailable = data.migration.report.unavailablePhotos || [];
  if (unavailable.length) throw new Error(`Online data is missing ${unavailable.length} original catalogue photos`);
  verifyImages(data, path.join(projectRoot,'public/online/nom'));
  const metadata = desktopMigrationMetadata(data.migration);
  const payload = publicFields({...data,migration:{...metadata,sourceFile:path.basename(metadata.sourceFile || '')}});
  const directory = path.join(projectRoot,'public/online');
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'main-data.js'),'/* Working data for the separate online version. */\nwindow.MAGIC_MAIN='+JSON.stringify(payload).replace(/</g,'\\u003c')+';\n');
  log(`Online working data: ${data.projects.length} projects, ${data.projects.reduce((sum,project)=>sum+project.rooms.length,0)} rooms, ${data.nom.length} catalogue records.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeOnlineData();
