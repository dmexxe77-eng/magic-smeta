import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {CRM_EQUIPMENT_CATALOG_SEEDS} from '../src/data/crm-equipment-catalog.js';

// Isolated tests use a real one-pixel WebP, never customer catalogue photo bytes.
export const CRM_PHOTO_FIXTURE_BYTES = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=', 'base64');

export function writeCrmPhotoFixture(root) {
  const directory = path.join(root, 'online-src/crm-equipment-photos');
  const manifestFile = path.join(root, 'online-src/crm-equipment-photo-manifest.json');
  fs.mkdirSync(directory, {recursive:true});
  const files = [...new Set(CRM_EQUIPMENT_CATALOG_SEEDS.flatMap(seed => seed.rows.map(row => row.img)))];
  const images = files.map(file => {
    fs.writeFileSync(path.join(directory, file), CRM_PHOTO_FIXTURE_BYTES);
    return {file, bytes:CRM_PHOTO_FIXTURE_BYTES.length,
      sha256:crypto.createHash('sha256').update(CRM_PHOTO_FIXTURE_BYTES).digest('hex')};
  });
  const manifest = {version:1, images};
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  return {directory, manifestFile, manifest};
}
