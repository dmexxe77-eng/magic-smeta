import {gzipSync, gunzipSync, strToU8, strFromU8} from 'fflate';

const PREFIX = 'zamer-gzip-v1:';
const MAX_BYTES = 64 * 1024 * 1024;
export const isCompressedSnapshot = value => typeof value === 'string' && value.startsWith(PREFIX);
export const isStorageQuotaError = error => error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;

/** Keep every JSON field; compression changes only the physical desktop storage value. */
export function encodeSnapshot(raw) {
  const bytes = strToU8(raw);
  if (bytes.length > MAX_BYTES) throw new Error('Desktop snapshot is too large');
  const compressed = gzipSync(bytes, {level:1, mtime:0});
  let binary = '';
  for (let start = 0; start < compressed.length; start += 0x8000) binary += String.fromCharCode(...compressed.subarray(start, start + 0x8000));
  return PREFIX + btoa(binary);
}

export function decodeSnapshot(raw) {
  if (!isCompressedSnapshot(raw)) return raw;
  const binary = atob(raw.slice(PREFIX.length)), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (bytes.length < 18) throw new Error('Invalid compressed desktop snapshot');
  const end = bytes.length - 4, size = new DataView(bytes.buffer).getUint32(end, true);
  if (size > MAX_BYTES) throw new Error('Desktop snapshot is too large');
  const decoded = gunzipSync(bytes);
  if (decoded.length !== size || decoded.length > MAX_BYTES) throw new Error('Invalid desktop snapshot size');
  return strFromU8(decoded);
}
