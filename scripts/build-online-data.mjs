/** Publish only the validated desktop dataset into local build assets. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateDesktopSnapshot, desktopMigrationMetadata} from '../src/desktop/desktop-storage.js';
import {LUMFER_CATALOG_SEED} from '../src/data/lumfer-track-catalog.js';
import {CRM_EQUIPMENT_CATALOG_SEEDS} from '../src/data/crm-equipment-catalog.js';
import {applyCatalogSeed} from '../src/utils/catalog-seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const photoPrefix = '/online/nom/';
const validPhotoName = value => typeof value === 'string' && /^nom-[a-z0-9_-]+\.(?:png|jpe?g|gif|webp|avif)$/i.test(value);
const validCrmPhotoName = value => typeof value === 'string' && /^crm_[a-f0-9]{32}\.webp$/.test(value);
const catalogSeeds = [LUMFER_CATALOG_SEED, ...CRM_EQUIPMENT_CATALOG_SEEDS];
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

function verifiedCrmImages(projectRoot) {
  const manifestFile = path.join(projectRoot, 'online-src/crm-equipment-photo-manifest.json');
  let manifest;
  try {
    if (!fs.lstatSync(manifestFile).isFile()) throw new Error('Not a regular file');
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (cause) {
    throw new Error('CRM catalogue photo manifest is missing or invalid', {cause});
  }
  if (manifest?.version !== 1 || !Array.isArray(manifest.images)) throw new Error('Invalid CRM catalogue photo manifest');
  const entries = new Map();
  for (const image of manifest.images) {
    if (!validCrmPhotoName(image?.file) || !validHash(image.sha256)
      || !Number.isSafeInteger(image.bytes) || image.bytes <= 0) throw new Error('Invalid CRM catalogue photo manifest entry');
    if (entries.has(image.file)) throw new Error('Duplicate CRM catalogue photo manifest entry');
    entries.set(image.file, image);
  }
  const referenced = new Set();
  for (const row of CRM_EQUIPMENT_CATALOG_SEEDS.flatMap(seed => seed.rows)) {
    if (!validCrmPhotoName(row.img) || row.imageUrl !== photoPrefix + row.img) throw new Error(`CRM catalogue photo reference mismatch for ${row.id}`);
    if (!entries.has(row.img)) throw new Error(`Missing CRM catalogue photo manifest entry for ${row.id}`);
    referenced.add(row.img);
  }
  if ([...entries.keys()].some(file => !referenced.has(file))) throw new Error('CRM catalogue photo manifest contains unreferenced files');
  return [...entries.values()].map(image => {
    const source = path.join(projectRoot, 'online-src/crm-equipment-photos', image.file);
    if (!fs.lstatSync(source, {throwIfNoEntry:false})?.isFile()) throw new Error(`CRM catalogue photo is missing or not a regular file: ${image.file}`);
    const bytes = fs.readFileSync(source);
    if (bytes.length !== image.bytes || sha256(bytes) !== image.sha256.toLowerCase()) throw new Error(`CRM catalogue photo integrity mismatch: ${image.file}`);
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`CRM catalogue photo is not a WebP: ${image.file}`);
    return {file:image.file, bytes};
  });
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
  const crmImages = verifiedCrmImages(projectRoot);
  const metadata = desktopMigrationMetadata(data.migration);
  const updated = applyCatalogSeed(data, catalogSeeds);
  if (!validateDesktopSnapshot(updated)) throw new Error('Online catalog update did not pass validation');
  const payload = publicFields({...updated,catalogSeed:catalogSeeds,migration:{...metadata,sourceFile:path.basename(metadata.sourceFile || '')}});
  const directory = path.join(projectRoot,'public/online');
  fs.mkdirSync(directory,{recursive:true});
  const photoDirectory = path.join(directory, 'nom');
  fs.mkdirSync(photoDirectory, {recursive:true});
  for (const image of crmImages) {
    const destination = path.join(photoDirectory, image.file), previous = fs.lstatSync(destination, {throwIfNoEntry:false});
    if (previous && !previous.isFile()) throw new Error(`CRM catalogue photo output is not a regular file: ${image.file}`);
  }
  for (const image of crmImages) fs.writeFileSync(path.join(photoDirectory, image.file), image.bytes);
  fs.writeFileSync(path.join(directory,'main-data.js'),'/* Working data for the separate online version. */\nwindow.MAGIC_MAIN='+JSON.stringify(payload).replace(/</g,'\\u003c')+';\n');
  log(`Online working data: ${data.projects.length} projects, ${data.projects.reduce((sum,project)=>sum+project.rooms.length,0)} rooms, ${payload.nom.length} catalogue records.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeOnlineData();
