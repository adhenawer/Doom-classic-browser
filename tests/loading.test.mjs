import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const source=ts.transpileModule(await readFile('web/loading.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {readPart}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const response=chunks=>new Response(new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(new Uint8Array(chunk));c.close();}}));
test('HD streams into its exact buffer range with cumulative progress and hashes only that range',async()=>{
  const pack=new Uint8Array(10).fill(99),data=new Uint8Array([1,2,3,4]),progress=[];
  await readPart(response([[1],[2,3],[4]]),pack.subarray(3,7),hash(data),n=>progress.push(n));
  assert.deepEqual([...pack],[99,99,99,1,2,3,4,99,99,99]);assert.deepEqual(progress,[1,3,4]);
});
test('HD rejects truncated, oversized and corrupt parts before use',async()=>{
  for(const chunks of [[[1]],[[1,2,3]],[[2,1]]])
    await assert.rejects(readPart(response(chunks),new Uint8Array(2),hash(new Uint8Array([1,2])),()=>{}));
});
test('HD stream propagates network errors',async()=>{
  const failed=new Response(new ReadableStream({start(c){c.error(new Error('connection lost'));}}));
  await assert.rejects(readPart(failed,new Uint8Array(2),'',()=>{}),/connection lost/);
});
