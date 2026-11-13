import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const sha256 = value => createHash('sha256').update(value).digest('hex');

// Cloud/local zlib versions can encode identical component sources differently.
// Latin-1 preserves every non-payload byte; decoded payload bytes stay explicit.
export function canonicalAppHtml(input) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const decodedModules = [];
  const canonical = raw.toString('latin1').replace(/"data":"(H4sI[A-Za-z0-9+/=]+)"/g, (_, encoded) => {
    const decoded = gunzipSync(Buffer.from(encoded, 'base64'));
    decodedModules.push(decoded);
    return '"data":"decoded-base64:' + decoded.toString('base64') + '"';
  });
  const bytes = Buffer.from(canonical, 'latin1');
  return { bytes, decodedModules, rawHash: sha256(raw), canonicalHash: sha256(bytes) };
}
