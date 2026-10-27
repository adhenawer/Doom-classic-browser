import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
const main = await readFile('web/main.ts','utf8');
const start = main.indexOf('async function ensureRuntimeController()');
const end = main.indexOf('\nfunction mapProgress',start);
const code = ts.transpileModule(main.slice(start,end).replace('import.meta.env.DEV','false').replaceAll('import.meta.url', JSON.stringify('https://game.test/game/assets.js')),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const scriptURL='https://game.test/game/sw.js';
class Events {
  listeners = new Map();
  addEventListener(type,handler) { if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler); }
  removeEventListener(type,handler) { this.listeners.get(type)?.delete(handler); }
  emit(type,event={}) { for(const handler of this.listeners.get(type)??[])handler(event); }
  size() { return [...this.listeners.values()].reduce((n,items)=>n+items.size,0); }
}
function fixture({active=true,installing=false,waiting=false}={}) {
  const sw=new Events(), registration=new Events(), timeouts=new Map(), intervals=new Map(), warnings=[];let id=0, readyResolve;
  const worker = state => Object.assign(new Events(),{state,scriptURL,messages:[],postMessage(data){this.messages.push(data);}});
  registration.active=active?worker('activated'):null;
  registration.installing=installing?worker('installing'):null;
  registration.waiting=waiting?worker('installed'):null;
  sw.controller=null;sw.register=async()=>registration;
  sw.ready=new Promise(resolve=>{readyResolve=resolve;});
  const context=createContext({URL,console:{warn(...args){warnings.push(args);}},navigator:{serviceWorker:sw},location:{href:'https://game.test/game/index.html'},
    setTimeout(fn){const key=++id;timeouts.set(key,fn);return key;},clearTimeout(key){timeouts.delete(key);},
    setInterval(fn){const key=++id;intervals.set(key,fn);return key;},clearInterval(key){intervals.delete(key);}});
  runInContext(code,context);
  return {sw,registration,timeouts,intervals,warnings,run:()=>context.ensureRuntimeController(),ready:()=>readyResolve(registration),
    control(worker=registration.active){sw.controller=worker;sw.emit('controllerchange');}};
}
const flush = () => new Promise(resolve=>setImmediate(resolve));
function clean(f) {assert.equal(f.timeouts.size,0);assert.equal(f.intervals.size,0);assert.equal(f.sw.size(),0);assert.equal(f.registration.size(),0);}
test('active worker missed navigation claim: demand-claim repairs control without touching waiting update',async()=>{
  const f=fixture({waiting:true});let completed=false;
  const promise=f.run().then(()=>{completed=true;});await flush();f.ready();await flush();
  assert.equal(completed,false,'ready and active alone must not unlock runtime/catalog requests');
  assert.ok(f.registration.active.messages.length>=1);
  assert.ok(f.registration.active.messages.every(message=>message.type==='doom-runtime-claim'));
  assert.equal(f.registration.waiting.messages.length,0);
  f.control();await promise;assert.equal(completed,true);clean(f);
});
test('first installation requests claim once activated; installing and waiting workers are never messaged',async()=>{
  const f=fixture({active:false,installing:true}), installing=f.registration.installing;
  const promise=f.run();await flush();assert.equal(installing.messages.length,0);
  installing.state='installed';f.registration.installing=null;f.registration.waiting=installing;installing.emit('statechange');
  assert.equal(installing.messages.length,0);
  installing.state='activated';f.registration.waiting=null;f.registration.active=installing;installing.emit('statechange');
  assert.equal(installing.messages[0].type,'doom-runtime-claim');
  f.control();await promise;clean(f);assert.equal(installing.size(),0);
});
test('missed controllerchange is detected by retry; controlled document does not claim a waiting update',async()=>{
  const f=fixture({waiting:true}), promise=f.run();await flush();
  f.sw.controller=f.registration.active;
  for(const callback of f.intervals.values())callback();
  await promise;clean(f);assert.equal(f.registration.waiting.messages.length,0);
  const before=f.registration.active.messages.length;await f.run();assert.equal(f.registration.active.messages.length,before);
});
test('failed first installation rejects promptly and removes observers instead of waiting sixty seconds',async()=>{
  const f=fixture({active:false,installing:true}), installing=f.registration.installing;
  const promise=f.run();const rejection=assert.rejects(promise,/instalação.*falhou/);await flush();
  installing.state='redundant';f.registration.installing=null;installing.emit('statechange');
  await rejection;clean(f);assert.equal(installing.size(),0);
});
test('failed update does not reject a valid active worker; first-install failure message does',async()=>{
  const f=fixture({installing:true}), promise=f.run();await flush();
  f.sw.emit('message',{source:f.registration.installing,data:{type:'doom-offline-error'}});
  f.control();await promise;clean(f);
  const first=fixture({active:false,installing:true}), failed=first.run();const rejection=assert.rejects(failed,/instalação.*falhou/);await flush();
  first.sw.emit('message',{source:first.registration.installing,data:{type:'doom-offline-error'}});
  await rejection;clean(first);
});
test('unresolved controller timeout identifies active/installing/waiting states',async()=>{
  const f=fixture({waiting:true}), promise=f.run();const rejection=assert.rejects(promise,error=>{assert.match(error.message,/Confira a conexão, feche as abas/);assert.doesNotMatch(error.message,/active|installing|waiting/);return true;});await flush();
  for(const callback of f.timeouts.values())callback();
  await rejection;clean(f);
  assert.equal(f.warnings[0][0],'[offline-controller] timeout');
  assert.deepEqual({...f.warnings[0][1]},{active:'activated',installing:'none',waiting:'installed'});
});

test('active worker with a different shell rejects recovery without promoting waiting worker',async()=>{
  const f=fixture({waiting:true}), promise=f.run();const rejection=assert.rejects(promise,/página e a versão offline são diferentes/);await flush();
  assert.equal(f.registration.active.messages[0].entry,'https://game.test/game/assets.js');
  f.sw.emit('message',{source:f.registration.active,data:{type:'doom-runtime-version-mismatch'}});
  await rejection;assert.equal(f.sw.controller,null);assert.equal(f.registration.waiting.messages.length,0);clean(f);
});
