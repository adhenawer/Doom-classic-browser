import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = ts.transpileModule(await readFile('web/engine-profile.ts','utf8'), {
  compilerOptions:{ module:ts.ModuleKind.ES2022, target:ts.ScriptTarget.ES2022 }
}).outputText;
const {engineProfiles,backupProfiles,sanitizeResolution,saveDirectory,validateSavePath,validateBackupProfiles} =
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
  for(const version of [undefined,null,0,3,'2']) assert(!validateSavePath(classic,version));
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
