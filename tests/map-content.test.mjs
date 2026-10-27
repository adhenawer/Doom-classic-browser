import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import ts from 'typescript';
const transpile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const deliverySource = transpile(await readFile('web/content-delivery.ts','utf8'));
const mapSource = transpile(await readFile('web/map-content.ts','utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let serial = 0;
async function fixture() {
  const objects = new Map(), counts = new Map(), stores = new Map(), files = new Map(), writes = [];
  let networkEnabled = true, openStreams = 0;
  Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://game.test/game/index.html'}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
  globalThis.caches = {async open(name) {
    if (!stores.has(name)) stores.set(name,new Map()); const map=stores.get(name);
    return {async match(key){return map.get(String(key))?.clone();},async put(key,res){map.set(String(key),res.clone());},async delete(key){return map.delete(String(key));}};
  }};
  globalThis.fetch = async input => {
    const path = new URL(input,'https://game.test/game/').pathname;
    counts.set(path,(counts.get(path)??0)+1);
    if (!networkEnabled) throw new Error('offline');
    return objects.has(path) ? new Response(objects.get(path)) : new Response('missing',{status:404});
  };
  const asset = (bytes, metadata={}) => {
    bytes=Uint8Array.from(bytes); const sha256=hash(bytes), file=`content/${sha256}.bin`;
    objects.set('/game/'+file,bytes);
    return {bytes:bytes.length,sha256,parts:[{file,bytes:bytes.length,sha256,offset:0}],...metadata};
  };
  const bootstrap=asset([73,87,65,68,1,2,3,4,5,6,7,8]);
  const first=asset([11,12,13,14]), second=asset([21,22,23]);
  const shared=asset([101,102],{path:'hires/SHARED.png',width:4096,height:4096,channels:3});
  const firstImage=asset([111,112],{path:'hires/FIRST.png',width:512,height:512,channels:4});
  const futureImage=asset([121,122],{path:'hires/FUTURE.png',width:1024,height:1024,channels:3});
  const original=new Uint8Array(80); original.set(await bytes(bootstrap),0); original.set(await bytes(first),24); original.set(await bytes(second),60);
  function bytes(a){return objects.get('/game/'+a.parts[0].file);}
  const logicalHash=hash(original);
  const index={version:1,iwads:{[logicalHash]:{bytes:80,sha256:logicalHash,bootstrap:[{offset:0,asset:bootstrap}],maps:{
    E1M1:{ranges:[{offset:24,asset:first}],hdAssets:['shared','first']},
    E1M2:{ranges:[{offset:60,asset:second}],hdAssets:['shared','future']}
  }}},hd:{assets:{shared,first:firstImage,future:futureImage}}};
  objects.set('/game/content-index.json',JSON.stringify(index));
  const fs={mkdirTree(){},writeFile(path,data){files.set(path,Uint8Array.from(data));writes.push({path,bytes:data.length});},
    open(path,flags){assert.equal(flags,'r+');assert.ok(files.has(path));openStreams++;return path;},
    write(path,data,offset,length,position){files.get(path).set(data.subarray(offset,offset+length),position);writes.push({path,bytes:length,position});return length;},
    close(){openStreams--;}};
  const deliveryURL='data:text/javascript;base64,'+Buffer.from(deliverySource).toString('base64')+'#'+serial++;
  const code=mapSource.replace("'./content-delivery'",JSON.stringify(deliveryURL));
  const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')+'#'+serial++);
  return {...api,index,logicalHash,original,fs,files,writes,counts,objects,bootstrap,first,second,shared,firstImage,futureImage,bytes,
    offline(){networkEnabled=false;},online(){networkEnabled=true;},openStreams:()=>openStreams};
}
const path = asset => '/game/'+asset.parts[0].file;
test('initialization downloads bootstrap only; image dimensions are metadata and future bytes remain absent',async()=>{
  const f=await fixture(), content=new f.MapContent(f.index,f.logicalHash,true);
  await content.initialize(f.fs);
  assert.deepEqual([...f.counts.keys()],[path(f.bootstrap)]);
  assert.deepEqual(f.files.get('/game.wad').slice(0,12),f.bytes(f.bootstrap));
  assert.ok(f.files.get('/game.wad').slice(12).every(byte=>byte===0));
  assert.equal(f.files.get('/lazy-hd/hires/FUTURE.png').length,0);
  assert.deepEqual(content.lazyImages['hires/SHARED.png'],{width:4096,height:4096,channels:3,bytes:2});
  assert.equal(f.openStreams(),0);
});
test('only requested map ranges and images download; repeat and shared maps reuse content without future prefetch',async()=>{
  const f=await fixture(), content=new f.MapContent(f.index,f.logicalHash,true);
  await content.initialize(f.fs); await content.prepareMap('E1M1');
  assert.deepEqual(new Set(f.counts.keys()),new Set([f.bootstrap,f.first,f.shared,f.firstImage].map(path)));
  assert.equal(f.counts.has(path(f.second)),false);assert.equal(f.counts.has(path(f.futureImage)),false);
  assert.deepEqual(f.files.get('/game.wad').slice(24,28),f.bytes(f.first));
  assert.ok(f.files.get('/game.wad').slice(60,63).every(byte=>byte===0));
  const writes=f.writes.length; await content.prepareMap('E1M1');assert.equal(f.writes.length,writes);
  assert.ok([...f.counts.values()].every(count=>count===1));
  await content.prepareMap('E1M2');
  assert.ok([...f.counts.values()].every(count=>count===1));
  assert.equal(f.writes.filter(w=>w.path==='/lazy-hd/hires/SHARED.png'&&w.bytes>0).length,1);
  assert.deepEqual(f.files.get('/game.wad'),f.original);
  assert.equal(content.hash,f.logicalHash);assert.equal(content.wad.sha256,f.logicalHash);
  assert.equal(hash(f.files.get('/game.wad')),f.logicalHash);assert.equal(f.openStreams(),0);
});
test('offline availability is scoped to bootstrap plus requested map and never fetches',async()=>{
  const f=await fixture(), content=new f.MapContent(f.index,f.logicalHash,true);
  await content.initialize(f.fs);await content.prepareMap('E1M1');f.offline();
  const counts=new Map(f.counts);
  assert.equal(await content.availableOffline('E1M1'),true);assert.equal(await content.availableOffline('E1M2'),false);
  assert.deepEqual(f.counts,counts);
  const reloaded=new f.MapContent(f.index,f.logicalHash,true);
  await reloaded.initialize(f.fs);await reloaded.prepareMap('E1M1');assert.deepEqual(f.counts,counts);
  await assert.rejects(reloaded.prepareMap('E1M2'),/offline/);
  assert.deepEqual(f.files.get('/game.wad').slice(24,28),f.bytes(f.first));
  assert.ok(f.files.get('/game.wad').slice(60,63).every(byte=>byte===0));
  f.online();await reloaded.prepareMap('E1M2');assert.equal(await reloaded.availableOffline('E1M2'),true);
});
test('unknown map and missing HD catalog asset fail without fetching unrelated content',async()=>{
  const f=await fixture(), content=new f.MapContent(f.index,f.logicalHash,true);
  await assert.rejects(content.prepareMap('E1M1'),/não inicializado/);
  await content.initialize(f.fs); const counts=new Map(f.counts);
  await assert.rejects(content.prepareMap('E9M9'),/não está no catálogo/);
  await assert.rejects(content.availableOffline('E9M9'),/não está no catálogo/);
  f.index.iwads[f.logicalHash].maps.E1M1.hdAssets.push('unknown');
  await assert.rejects(content.prepareMap('E1M1'),/Material HD ausente/);assert.deepEqual(f.counts,counts);
});
test('HD-disabled mode fetches only requested WAD data; malformed offsets cannot write beyond IWAD',async()=>{
  const f=await fixture(), content=new f.MapContent(f.index,f.logicalHash,false);
  await content.initialize(f.fs);await content.prepareMap('E1M1');
  assert.deepEqual(new Set(f.counts.keys()),new Set([path(f.bootstrap),path(f.first)]));
  assert.deepEqual(content.lazyImages,{});assert.equal(f.files.size,1);
  f.index.iwads[f.logicalHash].maps.E1M1.ranges[0].offset=79;
  assert.throws(()=>new f.MapContent(f.index,f.logicalHash,true),/Intervalo/);
});
test('content catalog is pinned once per document across callers',async()=>{
  const f=await fixture();const [first,second]=await Promise.all([f.loadContentIndex(),f.loadContentIndex()]);
  assert.equal(first,second);assert.equal(f.counts.get('/game/content-index.json'),1);
  f.objects.set('/game/content-index.json',JSON.stringify({version:2}));
  assert.equal(await f.loadContentIndex(),first);assert.equal(f.counts.get('/game/content-index.json'),1);
});
