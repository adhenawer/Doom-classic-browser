import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createContext, runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
const script = resolve('scripts/offline.mjs');
const runtime = ['doom.js','chocolate-doom.wasm','doom-high.js','crispy-doom.wasm','doom-modern.js','edge.wasm','doom-modern.data'];
const required = ['content-index.json','AURORA-CREDITS.txt','FREEDOOM-COPYING.txt','CRISPY-COPYING.txt','EDGE-COPYING.txt','EDGE-NOTICES.txt','MODERN-CONTENT-COPYING.txt'];
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(),'doom-offline-'));
  t.after(() => rm(dir, { recursive:true, force:true }));
  for (const path of ['dist/content','web/generated','build/dependency-sources']) await mkdir(join(dir,path), {recursive:true});
  await writeFile(join(dir,'web/icon.svg'),'<svg/>'); await writeFile(join(dir,'web/manifest.webmanifest'),'{}');
  for (const name of [...runtime,...required,'index.html','assets.js']) await writeFile(join(dir,'dist',name),name === 'content-index.json' ? '{}' : 'fixture-'+name);
  await writeFile(join(dir,'dist/content/future.bin'),'never fetch this');
  for (const name of ['freedoom1.wad','aurora.wad','aurora-map.wad','modern-hd.000.bin','modern-hd.epk']) {
    await writeFile(join(dir,'dist',name),'old monolith'); await writeFile(join(dir,'web/generated',name),'tool input');
  }
  const stores = new Map(), counts = new Map(), network = new Map(), failures = new Set();
  let claims = 0;
  const caches = { async keys() { return [...stores.keys()]; }, async delete(name) { return stores.delete(name); }, async open(name) {
    if (!stores.has(name)) stores.set(name,new Map()); const map=stores.get(name);
    return { async match(key) { return map.get(typeof key === 'string' ? key : key.url)?.clone(); }, async put(key,response) { map.set(typeof key === 'string' ? key : key.url,response.clone()); }, async delete(key) { return map.delete(typeof key === 'string' ? key : key.url); } };
  } };
  async function build() {
    execFileSync(process.execPath,[script],{cwd:dir,stdio:'pipe'});
    for (const name of await readdir(join(dir,'dist'))) if ((await stat(join(dir,'dist',name))).isFile()) network.set(name,await readFile(join(dir,'dist',name)));
    const index = JSON.parse(await readFile(join(dir,'dist/offline-index.json'),'utf8'));
    const listeners = new Map();
    const context = createContext({ URL, Request, Response, Uint8Array, crypto:webcrypto, caches,
      fetch: async request => {
        const name=new URL(typeof request === 'string' ? request : request.url).pathname.slice('/game/'.length);
        counts.set(name,(counts.get(name)??0)+1);
        if (failures.has(name)) throw new Error('network interrupted');
        return new Response(network.get(name), {headers:{'Content-Type':'wrong/type'}});
      },
      self:{registration:{scope:'https://game.test/game/'},clients:{async claim(){claims++;},async matchAll(){return[];}},addEventListener(name,fn){listeners.set(name,fn);}}
    });
    runInContext(await readFile(join(dir,'dist/sw.js'),'utf8'),context);
    return { index, async event(name) { let work; listeners.get(name)({waitUntil(p){work=p;}}); return work; }, request(path,mode='cors') {
      let response; listeners.get('fetch')({request:{url:new URL(path,'https://game.test/game/').href,method:'GET',mode},respondWith(p){response=p;}}); return response;
    } };
  }
  return {dir,build,stores,counts,network,failures,caches,claims:()=>claims};
}
test('install fetches shell only; runtime is verified and fetched only on demand; content passes through',async t=>{
  const f=await fixture(t), worker=await f.build();
  await worker.event('install'); await worker.event('activate');
  for(const name of runtime) assert.equal(f.counts.has(name),false);
  assert.equal(f.counts.has('content/future.bin'),false); assert.equal(worker.request('content/future.bin'),undefined);
  assert.equal(worker.request('source.tar.gz'),undefined); assert.equal(f.claims(),1);
  const [first,second]=await Promise.all([worker.request('edge.wasm'),worker.request('edge.wasm')]);
  assert.equal(first.headers.get('Content-Type'),'application/wasm'); assert.equal(await first.text(),'fixture-edge.wasm');
  assert.equal(await second.text(),'fixture-edge.wasm'); assert.equal(f.counts.get('edge.wasm'),1);
  await worker.request('edge.wasm'); assert.equal(f.counts.get('edge.wasm'),1);
  assert.equal(f.counts.has('doom-modern.data'),false);
  assert.equal((await worker.request('./','navigate')).headers.get('Content-Type'),'text/html');
  assert.equal(worker.index.hashes['source.tar.gz'],undefined);
  for(const name of ['freedoom1.wad','aurora.wad','aurora-map.wad','modern-hd.000.bin','modern-hd.epk']) {
    await assert.rejects(stat(join(f.dir,'dist',name)),{code:'ENOENT'});
    assert.equal(await readFile(join(f.dir,'web/generated',name),'utf8'),'tool input');
  }
  assert.ok((await stat(join(f.dir,'dist/source.tar.gz'))).size>0);
});
test('new shell revision reuses unchanged runtime and shell hashes; source-only edits do not change runtime version',async t=>{
  const f=await fixture(t), old=await f.build(); await old.event('install'); await old.request('edge.wasm');
  const baseline=new Map(f.counts);
  await writeFile(join(f.dir,'dist/assets.js'),'updated interface');
  const newer=await f.build(); assert.notEqual(newer.index.version,old.index.version);
  await newer.event('install'); await newer.request('edge.wasm');
  for(const [name,count] of f.counts) assert.equal(count,(baseline.get(name)??0)+(name==='assets.js'?1:0));
  await writeFile(join(f.dir,'README.md'),'source-only documentation update');
  const sourceOnly=await f.build(); assert.equal(sourceOnly.index.version,newer.index.version);
});
test('interrupted install keeps completed staging, never marks incomplete shell ready and leaves existing/content caches intact',async t=>{
  const f=await fixture(t), old=await f.build(); await old.event('install'); await old.event('activate');
  const content=await f.caches.open('doom-content-v1-%2Fgame%2F'); await content.put('saved',new Response('content'));
  await writeFile(join(f.dir,'dist/assets.js'),'second version');
  await writeFile(join(f.dir,'dist/z-late.txt'),'last requested file');
  f.failures.add('z-late.txt'); const next=await f.build();
  await assert.rejects(next.event('install'),/interrupted/);
  const staging=f.stores.get('doom-shell-v1-%2Fgame%2F-'+next.index.version);
  assert.ok(staging.size>0); assert.equal(staging.has('https://game.test/game/offline-index.json'),false);
  assert.equal(f.claims(),1); assert.equal(await (await old.request('assets.js')).text(),'fixture-assets.js');
  const before=new Map(f.counts); f.failures.clear(); await next.event('install'); await next.event('activate');
  for(const [name,count] of f.counts) assert.equal(count,(before.get(name)??0)+(name==='z-late.txt'?1:0));
  assert.equal(await (await content.match('saved')).text(),'content');
  assert.ok(f.stores.has('doom-shell-v1-%2Fgame%2F-'+old.index.version));
});
test('runtime corruption is rejected before storage; corrupt cached object is repaired and legacy exact bytes are reused',async t=>{
  const f=await fixture(t), worker=await f.build();
  f.network.set('edge.wasm',new Uint8Array([1,2]));
  await assert.rejects(worker.request('edge.wasm'),/Corrupt/);
  const objects=f.stores.get('doom-runtime-v1-%2Fgame%2F'); assert.equal(objects.size,0);
  f.network.set('edge.wasm',Buffer.from('fixture-edge.wasm')); await worker.request('edge.wasm');
  objects.set('https://game.test/game/__runtime/'+worker.index.hashes['edge.wasm'],new Response('wrong'));
  await worker.request('edge.wasm'); assert.equal(f.counts.get('edge.wasm'),3);
  const legacy=await f.caches.open('doom-%2Fgame%2F-old');
  await legacy.put('https://game.test/game/chocolate-doom.wasm',new Response('fixture-chocolate-doom.wasm'));
  const response=await worker.request('chocolate-doom.wasm');
  assert.equal(await response.text(),'fixture-chocolate-doom.wasm'); assert.equal(f.counts.has('chocolate-doom.wasm'),false);
});
