import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { canonicalAppHtml } from './release-build-identity.mjs';

const payload = Buffer.from('const message = "Проверенный исходник";\n'.repeat(100));
const html = compressed => Buffer.from('<script>{"compressed":true,"data":"' + compressed.toString('base64') + '"}</script><p>Кириллица</p>');
test('different gzip levels and OS headers preserve exact decoded source and surrounding HTML', () => {
  const fast = gzipSync(payload, { level: 1 }), dense = gzipSync(payload, { level: 9 });
  fast[9] = 3; dense[9] = 255;
  const a = canonicalAppHtml(html(fast)), b = canonicalAppHtml(html(dense));
  assert.notEqual(a.rawHash, b.rawHash);
  assert.deepEqual(a.decodedModules, [payload]); assert.deepEqual(b.decodedModules, [payload]);
  assert.deepEqual(a.bytes, b.bytes); assert.equal(a.canonicalHash, b.canonicalHash);
});
test('a changed decoded component cannot match', () => {
  const a = canonicalAppHtml(html(gzipSync(payload)));
  const b = canonicalAppHtml(html(gzipSync(Buffer.concat([payload, Buffer.from('// changed')]))));
  assert.notDeepEqual(a.decodedModules, b.decodedModules); assert.notEqual(a.canonicalHash, b.canonicalHash);
});
test('a changed non-payload HTML byte cannot match', () => {
  const source = html(gzipSync(payload)), changed = Buffer.concat([source, Buffer.from(' ')]);
  const a = canonicalAppHtml(source), b = canonicalAppHtml(changed);
  assert.deepEqual(a.decodedModules, b.decodedModules); assert.notDeepEqual(a.bytes, b.bytes);
});
