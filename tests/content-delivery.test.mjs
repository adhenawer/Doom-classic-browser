import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import ts from 'typescript';
const source = ts.transpileModule(await readFile('web/content-delivery.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let instance = 0;
async function harness() {
  const objects = new Map(), stores = new Map(), counts = new Map();
  let active = 0, peak = 0, delay = 8;
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { href: 'https://game.test/doom/index.html' } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  globalThis.caches = { async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return { async match(key) { return map.get(String(key))?.clone(); }, async put(key, response) { map.set(String(key), response.clone()); }, async delete(key) { return map.delete(String(key)); } };
  } };
  globalThis.fetch = async (input, { signal } = {}) => {
    const path = new URL(input).pathname;
    counts.set(path, (counts.get(path) ?? 0) + 1); active++; peak = Math.max(peak, active);
    try {
      await new Promise((resolve, reject) => {
        const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
        const timer = setTimeout(done, delay);
        const abort = () => { clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); };
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      });
      const value = objects.get(path);
      return value === undefined ? new Response('missing', { status: 404 }) : new Response(value);
    } finally { active--; }
  };
  const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#' + instance++);
  function asset(id, length = 1) {
    const values = Array.from({ length }, (_, i) => new Uint8Array([id, i, 42]));
    const bytes = Buffer.concat(values);
    return { bytes: bytes.length, sha256: hash(bytes), parts: values.map((value, i) => {
      const file = `objects/${hash(value)}.bin`; objects.set('/doom/' + file, value);
      return { file, bytes: value.length, sha256: hash(value), offset: i * 3 };
    }) };
  }
  return { ...api, asset, objects, stores, counts, peak: () => peak, delay: n => { delay = n; } };
}
test('parallel download is bounded at three, fetches only requested assets and reuses shared hashes', async () => {
  const h = await harness(), requested = h.asset(1, 7), future = h.asset(2, 3), progress = [];
  await h.prepareAssets([requested, requested], { onProgress: p => progress.push(p) });
  assert.equal(h.peak(), 3); assert.equal(h.counts.size, 7);
  for (const p of future.parts) assert.equal(h.counts.has('/doom/' + p.file), false);
  assert.equal(await h.hasAssets([requested]), true); assert.equal(await h.hasAssets([future]), false);
  assert.deepEqual(await h.readAsset(requested), new Uint8Array([1,0,42,1,1,42,1,2,42,1,3,42,1,4,42,1,5,42,1,6,42]));
  await h.prepareAssets([requested]); assert.ok([...h.counts.values()].every(n => n === 1));
  assert.deepEqual(progress.at(-1), { completedBytes: 21, totalBytes: 21, completedParts: 7, totalParts: 7 });
});
test('cache corruption is rejected offline and only the corrupt or failed object is downloaded again', async () => {
  const h = await harness(), a = h.asset(3, 3);
  await h.prepareAssets([a]);
  const map = [...h.stores.values()][0], bad = a.parts[1];
  map.set('https://game.test/doom/__content/' + bad.sha256, new Response(new Uint8Array([9,9,9])));
  assert.equal(await h.hasAssets([a]), false);
  await assert.rejects(h.readAsset(a), /não preparado/);
  h.objects.set('/doom/' + bad.file, new Uint8Array([9,9,9]));
  await assert.rejects(h.prepareAssets([a]), /corrompido/);
  h.objects.set('/doom/' + bad.file, new Uint8Array([3,1,42]));
  await h.prepareAssets([a]);
  assert.equal(h.counts.get('/doom/' + bad.file), 3);
  assert.equal(h.counts.get('/doom/' + a.parts[0].file), 1);
  assert.equal(h.counts.get('/doom/' + a.parts[2].file), 1);
  assert.equal(await h.hasAssets([a]), true);
  await assert.rejects(h.readAsset({ ...a, sha256: '0'.repeat(64) }), /montado corrompido/);
});
test('one cancelled consumer does not cancel a shared download and no cancelled queue continues', async () => {
  const h = await harness(), a = h.asset(4, 5), controller = new AbortController(); h.delay(30);
  const cancelled = h.prepareAssets([a], { signal: controller.signal });
  const observed = assert.rejects(cancelled, { name: 'AbortError' });
  const shared = h.prepareAssets([a]);
  controller.abort(); await observed; await shared;
  assert.equal(h.counts.size, 5); assert.ok([...h.counts.values()].every(n => n === 1)); assert.equal(h.peak(), 3);
  const b = h.asset(5, 7), stop = new AbortController();
  const cancelledOnly = h.prepareAssets([b], { signal: stop.signal });
  const rejected = assert.rejects(cancelledOnly, { name: 'AbortError' });
  await new Promise(r => setTimeout(r, 5)); stop.abort(); await rejected;
  await new Promise(r => setTimeout(r, 40));
  for (const part of b.parts.slice(3)) assert.equal(h.counts.has('/doom/' + part.file), false);
});
test('completed parts survive network errors; retry requests only missing parts', async () => {
  const h = await harness(), a = h.asset(6, 5);
  h.objects.delete('/doom/' + a.parts[4].file);
  await assert.rejects(h.prepareAssets([a]), /indisponível/);
  const completed = [...h.stores.values()][0].size; assert.ok(completed >= 3);
  h.objects.set('/doom/' + a.parts[4].file, new Uint8Array([6,4,42]));
  await h.prepareAssets([a]);
  for (const part of a.parts.slice(0,3)) assert.equal(h.counts.get('/doom/' + part.file), 1);
  assert.equal(h.counts.get('/doom/' + a.parts[4].file), 2);
  assert.equal(await h.hasAssets([a]), true);
});
test('invalid manifest and foreign paths cannot trigger downloads', async () => {
  const h = await harness(), a = h.asset(7);
  for (const file of ['https://other.test/file', '../outside.bin', 'objects/file?revision=1']) {
    await assert.rejects(h.prepareAssets([{ ...a, parts: [{ ...a.parts[0], file }] }]), /inválida/);
  }
  await assert.rejects(h.prepareAssets([{ ...a, parts: [{ ...a.parts[0], offset: 1 }] }]), /inválida/);
  assert.equal(h.counts.size, 0);
});
test('Web Locks coordinates separate page downloaders and rechecks verified persistent cache', async () => {
  const h = await harness(), a = h.asset(8, 2), tails = new Map();
  let lockRequests = 0;
  navigator.locks = { async request(name, { signal }, callback) {
    lockRequests++;
    const previous = tails.get(name) ?? Promise.resolve();
    let release; const tail = new Promise(r => { release = r; }); tails.set(name, tail);
    await previous;
    try { if (signal.aborted) throw new DOMException('aborted', 'AbortError'); return await callback(); }
    finally { release(); if (tails.get(name) === tail) tails.delete(name); }
  } };
  const secondPage = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#' + instance++);
  await Promise.all([h.prepareAssets([a]), secondPage.prepareAssets([a])]);
  assert.equal(lockRequests, 4); assert.equal(h.counts.size, 2);
  assert.ok([...h.counts.values()].every(n => n === 1));
});
test('truncated and oversized responses never become prepared cache entries', async () => {
  const h = await harness(), a = h.asset(9);
  for (const bytes of [new Uint8Array([9]), new Uint8Array([9,0,42,1])]) {
    h.objects.set('/doom/' + a.parts[0].file, bytes);
    await assert.rejects(h.prepareAssets([a]));
    assert.equal(await h.hasAssets([a]), false);
    assert.equal([...h.stores.values()][0].size, 0);
  }
});
