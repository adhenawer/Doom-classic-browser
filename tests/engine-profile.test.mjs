import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = ts.transpileModule(await readFile('web/engine-profile.ts','utf8'), {
  compilerOptions:{ module:ts.ModuleKind.ES2022, target:ts.ScriptTarget.ES2022 }
}).outputText;
const {engineProfiles,backupProfiles,modernBackupProfiles,modernContent,modernParts,modernSizes,sanitizeModernSize,sanitizeResolution,saveDirectory,validateSavePath,validateBackupProfiles} =
  await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const hash='a'.repeat(64);

test('legacy resolution remains classic; high selects a separate pinned binary and internal framebuffer',()=>{
  for(const raw of [undefined,null,false,0,'640x400','HIGH',{},['high']]) assert.equal(sanitizeResolution(raw),'classic');
  assert.equal(sanitizeResolution('high'),'high');
  assert.notEqual(engineProfiles.classic.loader,engineProfiles.high.loader);
  assert.notEqual(engineProfiles.classic.factory,engineProfiles.high.factory);
  assert.notEqual(engineProfiles.classic.wasm,engineProfiles.high.wasm);
  assert.equal(engineProfiles.high.width*engineProfiles.high.height,4*engineProfiles.classic.width*engineProfiles.classic.height);
});

test('save directories preserve the legacy namespace and isolate high-res without accepting path injection',()=>{
  assert.equal(saveDirectory('classic',hash),`/persist/saves/${hash}`);
  assert.equal(saveDirectory('high',hash),`/persist/saves-hires/${hash}`);
  for(const invalid of ['../'+hash,hash.toUpperCase(),hash+'\n','a'.repeat(63),null]) assert.throws(()=>saveDirectory('high',invalid));
  assert.throws(()=>saveDirectory('future',hash));
});

test('v1 backups stay legacy-only; v2 paths permit exactly known roots and six slots',()=>{
  const classic=`${saveDirectory('classic',hash)}/doomsav0.dsg`;
  const high=`${saveDirectory('high',hash)}/doomsav5.dsg`;
  assert(validateSavePath(classic,1));assert(validateSavePath(classic,2));
  assert(!validateSavePath(high,1));assert(validateSavePath(high,2));
  for(const bad of [null,high+'/x',high+'\n',high.replace('saves-hires','saves/../saves-hires'),high.replace('doomsav5','doomsav6'),high.replace('doomsav5','doomsav10'),high.replace(hash,'A'.repeat(64)),high.replace('saves-hires','saves-modern')]) {
    assert(!validateSavePath(bad,1));assert(!validateSavePath(bad,2));
  }
  for(const version of [undefined,null,0,4,'2']) assert(!validateSavePath(classic,version));
});

test('backup profile metadata rejects unknown engines, mismatched pins, partial and expanded schemas',()=>{
  assert(validateBackupProfiles(structuredClone(backupProfiles)));
  for(const raw of [undefined,null,[],{}, {classic:backupProfiles.classic}, {...backupProfiles,future:backupProfiles.high},
    {...backupProfiles,high:{...backupProfiles.high,commit:'f'.repeat(40)}},
    {...backupProfiles,high:{...backupProfiles.high,id:backupProfiles.classic.id}},
    {...backupProfiles,classic:{...backupProfiles.classic,extra:true}},
    {classic:backupProfiles.high,high:backupProfiles.classic}]) assert(!validateBackupProfiles(raw));
});

test('backup/runtime engine identities match the independently consumed build source pins',async()=>{
  const classic=JSON.parse(await readFile('engine/UPSTREAM.json','utf8'));
  const high=JSON.parse(await readFile('engine/CRISPY.json','utf8'));
  assert.equal(engineProfiles.classic.commit,classic.commit);
  assert.equal(engineProfiles.high.commit,high.commit);
});


test('modern profile is a pinned GPU backend, with isolated slots and explicit quality options',async()=>{
  assert.equal(sanitizeResolution('modern'),'modern');
  const pin=JSON.parse(await readFile('engine/EDGE.json','utf8'));
  assert.equal(engineProfiles.modern.commit,pin.commit);
  assert.equal(new Set(Object.values(engineProfiles).map(p=>p.factory)).size,3);
  assert.equal(saveDirectory('modern',hash),`/persist/saves-modern/${hash}`);
  assert.deepEqual(modernSizes[sanitizeModernSize(undefined)],[1920,1440]);
  assert.deepEqual(modernSizes[sanitizeModernSize('3840')],[3840,2880]);
  assert.equal(sanitizeModernSize('99999'),'1920');
  assert(validateBackupProfiles(modernBackupProfiles,3));
  assert(!validateBackupProfiles(modernBackupProfiles,2));
  assert(!validateBackupProfiles(backupProfiles,3));
  assert(!validateBackupProfiles({...modernBackupProfiles,modern:{...modernBackupProfiles.modern,commit:'f'.repeat(40)}},3));
});
test('modern backup v3 isolates native chunked slots from Classic and rejects config and transient data',()=>{
  const prefix=`/persist/saves-modern/${hash}/savegame/`;
  for (const name of ['head.esg','e1m1.esg','e4m9.esg','head.png']) {
    assert(validateSavePath(prefix+'slot000/'+name,3));
    assert(!validateSavePath(prefix+'slot000/'+name,2));
  }
  for (const bad of ['current/head.esg','slot008/head.esg','slot999/head.esg','slot000/../../head.esg','slot000/edge.cfg','slot000/head.esg/x','slot000/map01.esg','slot000/HEAD.esg','slot000/head.esg\n']) assert(!validateSavePath(prefix+bad,3));
  assert(validateSavePath(`/persist/saves/${hash}/doomsav0.dsg`,3));
  assert(validateSavePath(`/persist/saves-hires/${hash}/doomsav5.dsg`,3));
});


test('HD runtime content pin matches the independently validated build output and targets only the known IWAD',async()=>{
  const source=JSON.parse(await readFile('engine/MODERN-CONTENT.json','utf8'));
  assert.equal(modernContent.iwad,source.iwad.sha256);
  assert.equal(modernContent.sha256,source.output.sha256);
  assert.equal(modernContent.bytes,source.output.bytes);
  assert.equal(modernContent.images,source.output.assetCount);
  assert.equal(modernContent.file,source.output.file);
});


test('chunk delivery preserves the full pinned archive, contiguous ranges and exact build pins',async()=>{
  const {createHash}=await import('node:crypto');
  const pin=JSON.parse(await readFile('engine/MODERN-CONTENT.json','utf8'));
  assert.deepEqual(modernParts,pin.delivery.parts);
  const whole=createHash('sha256');let offset=0;
  for(const [i,part]of modernParts.entries()){
    assert.equal(part.file,`modern-hd.${String(i).padStart(3,'0')}.bin`);
    assert.equal(part.offset,offset);assert(part.bytes>0&&part.bytes<=32*1024*1024);
    const bytes=await readFile('web/generated/'+part.file);
    assert.equal(bytes.length,part.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),part.sha256);
    whole.update(bytes);offset+=bytes.length;
  }
  assert.equal(offset,modernContent.bytes);
  assert.equal(whole.digest('hex'),modernContent.sha256);
});
