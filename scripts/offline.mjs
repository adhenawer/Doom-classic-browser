// SPDX-License-Identifier: GPL-2.0-or-later
import { readdir, readFile, writeFile, copyFile, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
for (const name of ['icon.svg', 'manifest.webmanifest']) await copyFile(`web/${name}`, `dist/${name}`);
let html = await readFile('dist/index.html', 'utf8');
html = html.replace(/href="[^"]*\.webmanifest"/, 'href="./manifest.webmanifest"').replace(/href="[^"]*\.svg"/, 'href="./icon.svg"');
await writeFile('dist/index.html', html);
execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '--exclude=./.git', '--exclude=__pycache__', '--exclude=./node_modules', '--exclude=./build', '--exclude=./work', '--exclude=./dist', '--exclude=./web/generated', '--exclude=./test-results', '--exclude=./playwright-report', '-czf', 'dist/source.tar.gz', '.', '-C', 'build', 'dependency-sources'], { stdio: 'inherit' });
async function walk(path) {
  const names = await readdir(path);
  return (await Promise.all(names.sort().map(async name => {
    const p = `${path}/${name}`;
    return (await stat(p)).isDirectory() ? walk(p) : [p];
  }))).flat();
}
// Keep originals in web/generated for build tooling; ship only content-addressed delivery objects.
for (const path of await walk('dist')) {
  if (/^dist\/(?:freedoom1\.wad|aurora\.wad|aurora-map\.wad|modern-hd\.epk|modern-hd\.\d+\.bin)$/.test(path)) await rm(path);
}
const runtimeFiles = ['doom.js', 'chocolate-doom.wasm', 'doom-high.js', 'crispy-doom.wasm', 'doom-modern.js', 'edge.wasm', 'doom-modern.data'];
for (const required of [...runtimeFiles, 'content-index.json', 'AURORA-CREDITS.txt', 'FREEDOOM-COPYING.txt', 'CRISPY-COPYING.txt', 'EDGE-COPYING.txt', 'EDGE-NOTICES.txt', 'MODERN-CONTENT-COPYING.txt', 'source.tar.gz']) {
  if (!(await stat(`dist/${required}`)).size) throw new Error(`Missing artifact: ${required}`);
}
const files = (await walk('dist')).filter(p => !['dist/sw.js', 'dist/offline-index.json', 'dist/source.tar.gz'].includes(p) && !p.startsWith('dist/content/'));
const hashes = {}, sizes = {};
for (const path of files) {
  const bytes = await readFile(path), name = path.slice(5);
  hashes[name] = createHash('sha256').update(bytes).digest('hex'); sizes[name] = bytes.length;
}
const version = createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0, 16);
const resources = Object.keys(hashes).filter(p => !runtimeFiles.includes(p)).map(p => `./${p}`);
const runtime = runtimeFiles.map(p => `./${p}`);
const index = { version, resources, hashes, runtime, sizes };
await writeFile('dist/offline-index.json', JSON.stringify(index, null, 2));
await writeFile('dist/sw.js', `// Generated shell/runtime build ${version}. Content downloads are owned by content-delivery.ts.
const INDEX = ${JSON.stringify(index)};
const SCOPE = new URL(self.registration.scope);
const ID = encodeURIComponent(SCOPE.pathname);
const SHELL = 'doom-shell-v1-' + ID + '-' + INDEX.version;
const OBJECTS = 'doom-runtime-v1-' + ID;
const LEGACY = 'doom-' + ID + '-';
const pending = new Map();
const absolute = path => new URL(path, SCOPE).href;
const INDEX_URL = absolute('./offline-index.json');
const routes = new Map([...INDEX.resources, ...INDEX.runtime].map(path => [absolute(path), path.slice(2)]));
function contentType(name) {
  const ext = name.slice(name.lastIndexOf('.'));
  return ({'.wasm':'application/wasm','.js':'text/javascript','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'})[ext] || 'application/octet-stream';
}
async function verify(response, name) {
  if (!response || !response.ok) throw new Error('Missing runtime asset: ' + name);
  const bytes = new Uint8Array(INDEX.sizes[name]);
  const reader = response.body && response.body.getReader();
  let offset = 0;
  try {
    if (reader) {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        if (offset + part.value.length > bytes.length) throw new Error('Oversized runtime asset: ' + name);
        bytes.set(part.value, offset); offset += part.value.length;
      }
    } else {
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.length !== bytes.length) throw new Error('Truncated runtime asset: ' + name);
      bytes.set(body); offset = body.length;
    }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2,'0')).join('');
    if (offset !== bytes.length || digest !== INDEX.hashes[name]) throw new Error('Corrupt runtime asset: ' + name);
    return new Response(bytes, { headers: {'Content-Type': contentType(name), 'Content-Length': String(bytes.length)} });
  } catch (error) { if (reader) await reader.cancel().catch(() => {}); throw error; }
  finally { if (reader) reader.releaseLock(); }
}
async function obtain(name) {
  const key = absolute('__runtime/' + INDEX.hashes[name]);
  const store = await caches.open(OBJECTS);
  const existing = await store.match(key);
  if (existing) {
    try { return await verify(existing, name); }
    catch { await store.delete(key); }
  }
  // Reuse verified objects from an existing monolithic install, without trusting its metadata.
  for (const oldName of (await caches.keys()).filter(value => value.startsWith(LEGACY))) {
    const old = await caches.open(oldName), response = await old.match(absolute(name));
    if (!response) continue;
    try { const valid = await verify(response, name); await store.put(key, valid.clone()); return valid; }
    catch { /* A different release can legitimately contain different bytes. */ }
  }
  const response = await verify(await fetch(new Request(absolute(name), {cache:'no-store'})), name);
  await store.put(key, response.clone());
  return response;
}
async function asset(name) {
  let task = pending.get(name);
  if (!task) {
    task = obtain(name).finally(() => { if (pending.get(name) === task) pending.delete(name); });
    pending.set(name, task);
  }
  return (await task).clone();
}
function indexResponse() { return new Response(JSON.stringify(INDEX), {headers:{'Content-Type':'application/json'}}); }
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL);
  try {
    for (const path of INDEX.resources) await cache.put(absolute(path), await asset(path.slice(2)));
    // Written last: a manifest in this cache describes a fully prepared shell.
    await cache.put(INDEX_URL, indexResponse());
  } catch (error) {
    // Keep verified objects and staging so a retry does not redownload completed work.
    const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of clients) if (new URL(client.url).pathname.startsWith(SCOPE.pathname))
      client.postMessage({type:'doom-offline-error',name:error && error.name ? String(error.name) : 'Error'});
    throw error;
  }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Activation only follows successful shell installation. Retain caches used by older documents.
  // Content-addressed assets and legacy installs are never deleted as an activation side effect.
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const rootNavigation = event.request.mode === 'navigate' && (url.pathname === SCOPE.pathname || url.pathname === new URL('index.html', SCOPE).pathname);
  if (url.href === INDEX_URL) { event.respondWith(Promise.resolve(indexResponse())); return; }
  const name = rootNavigation ? 'index.html' : routes.get(url.href);
  if (!name) return; // Includes content/*.bin: its verified persistent cache belongs to the explicit downloader.
  event.respondWith(asset(name));
});
`);
console.log(`Offline build ${version}: ${resources.length} shell resources, ${runtime.length} lazy runtime resources`);
