// SPDX-License-Identifier: GPL-2.0-or-later
import { readdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
for (const name of ['icon.svg', 'manifest.webmanifest']) await copyFile(`web/${name}`, `dist/${name}`);
let html = await readFile('dist/index.html', 'utf8');
html = html.replace(/href="[^"]*\.webmanifest"/, 'href="./manifest.webmanifest"').replace(/href="[^"]*\.svg"/, 'href="./icon.svg"');
await writeFile('dist/index.html', html);
execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '--exclude=./.git', '--exclude=./node_modules', '--exclude=./build', '--exclude=./dist', '--exclude=./web/generated', '--exclude=./test-results', '--exclude=./playwright-report', '-czf', 'dist/source.tar.gz', '.', '-C', 'build', 'dependency-sources']);
async function walk(path) {
  const names = await readdir(path);
  return (await Promise.all(names.sort().map(async name => {
    const p = `${path}/${name}`;
    return (await stat(p)).isDirectory() ? walk(p) : [p];
  }))).flat();
}
for (const required of ['doom.js', 'chocolate-doom.wasm', 'freedoom1.wad', 'FREEDOOM-COPYING.txt', 'source.tar.gz']) {
  if (!(await stat(`dist/${required}`)).size) throw new Error(`Missing artifact: ${required}`);
}
const files = (await walk('dist')).filter(p => !p.endsWith('/sw.js') && !p.endsWith('/offline-index.json'));
const hashes = Object.fromEntries(await Promise.all(files.map(async p => [p.slice(5), createHash('sha256').update(await readFile(p)).digest('hex')])));
const version = createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0, 16);
// Corresponding source is a separate online download, not needed to execute offline.
const resources = Object.keys(hashes).filter(p => p !== 'source.tar.gz').map(p => `./${p}`);
await writeFile('dist/offline-index.json', JSON.stringify({ version, resources, hashes }, null, 2));
await writeFile('dist/sw.js', `// Generated from complete build ${version}
const RESOURCES = ${JSON.stringify([...resources, './offline-index.json'])};
const SCOPE = new URL(self.registration.scope);
const PREFIX = 'doom-' + encodeURIComponent(SCOPE.pathname) + '-';
const CACHE = PREFIX + '${version}';
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try { await cache.addAll(RESOURCES.map(p => new URL(p, SCOPE).href)); }
  catch (e) { await caches.delete(CACHE); throw e; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = event.request.mode === 'navigate' ? new URL('index.html', SCOPE).href : event.request;
    const hit = await cache.match(key);
    if (hit) return hit;
    return fetch(event.request);
  })());
});
`);
console.log(`Offline build ${version}: ${resources.length} resources`);
