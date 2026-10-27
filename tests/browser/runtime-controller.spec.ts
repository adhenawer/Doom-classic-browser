import {test,expect,type Page} from './normal-browser';
import {selectClassic} from './legacy-profile';
import {contentServer} from './content-server';
import {readFile} from 'node:fs/promises';

const root=process.env.QA_DIST??'dist';
const hash='7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d';
async function diagnostics(page:Page) {
  return page.evaluate(async()=>({
    status:document.querySelector('#status')?.textContent,
    offline:document.querySelector('#offline')?.textContent,
    controller:navigator.serviceWorker.controller?.scriptURL??null,
    registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),
    caches:await Promise.all((await caches.keys()).map(async name=>({name,entries:(await(await caches.open(name)).keys()).length}))),
  }));
}

test('reload during shell installation recovers an activated worker whose initial claim missed the document',async({page},info)=>{
  const offline=JSON.parse(await readFile(root+'/offline-index.json','utf8'));
  const shellPart=offline.resources[0].replace(/^\.\//,'');
  const source=await readFile(root+'/sw.js','utf8');
  const activate=source.indexOf("self.addEventListener('activate'");
  const claim=source.indexOf('await self.clients.claim();',activate);
  expect(activate).toBeGreaterThan(-1);expect(claim).toBeGreaterThan(activate);
  // Inject exactly the missed initial claim, retaining the real installation,
  // caches, fetch handler and recovery message handler under review.
  const worker=source.slice(0,claim)+'/* Test: initial claim missed this document. */'+source.slice(claim+'await self.clients.claim();'.length);
  let release:(()=>void)|undefined,held=false;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const requests:string[]=[];
  const server=await contentServer('/missed-worker-claim/',async(path,_req,res)=>{
    if(path==='sw.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'}).end(worker);return true;}
    if(path===shellPart){held=true;await gate;}
    if(path.startsWith('content/'))requests.push(path);
    return false;
  });
  try {
    await page.goto(server.url);await selectClassic(page);
    await expect.poll(()=>held).toBe(true);
    await page.reload();await expect(page.locator('#play')).toBeEnabled();
    expect(await page.evaluate(()=>navigator.serviceWorker.controller===null)).toBe(true);
    release!();
    await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state),{timeout:15000}).toBe('activated');
    expect(await page.evaluate(()=>navigator.serviceWorker.controller===null)).toBe(true);
    expect(requests).toEqual([]);
    await info.attach('before-recovery',{body:JSON.stringify(await diagnostics(page)),contentType:'application/json'});
    await page.locator('#play').press('Enter');
    await expect(page.locator('#resume')).toBeVisible({timeout:30000});
    expect(await page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await expect(page.locator('#offline')).toContainText('E1M1 disponível offline');
    expect(await page.evaluate(()=>(window as any).doom._web_state(34))).toBe(101);
    const index=JSON.parse(await readFile(root+'/content-index.json','utf8')),wad=index.iwads[hash];
    const allowed=new Set([...wad.bootstrap,...wad.maps.E1M1.ranges].flatMap((r:any)=>r.asset.parts.map((p:any)=>p.file.replace(/^\.\//,''))));
    expect(requests.length).toBeGreaterThan(0);expect(requests.every(path=>allowed.has(path))).toBe(true);
  } finally {
    release?.();
    await info.attach('worker-diagnostics',{body:JSON.stringify(await diagnostics(page)),contentType:'application/json'});
    await server.close();
  }
});

test('failed shell installation reports an explicit startup error without loading a runtime or map',async({page},info)=>{
  const offline=JSON.parse(await readFile(root+'/offline-index.json','utf8'));
  const shellPart=offline.resources[0].replace(/^\.\//,'');
  let release:(()=>void)|undefined,failures=0;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const forbidden:string[]=[];
  const server=await contentServer('/failed-worker-install/',async(path,_req,res)=>{
    if(path===shellPart){failures++;await gate;res.writeHead(503).end('Controlled shell installation failure');return true;}
    if(path.startsWith('content/')||offline.runtime.includes('./'+path))forbidden.push(path);
    return false;
  });
  try {
    await page.goto(server.url);await selectClassic(page);
    await expect.poll(()=>failures).toBeGreaterThan(0);
    await page.locator('#play').press('Enter');
    release!();
    await expect(page.locator('#launchStatus')).toContainText('Erro:',{timeout:15000});
    await expect(page.locator('#loadingBack')).toBeVisible();
    expect(await page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(false);
    expect(forbidden).toEqual([]);
    await page.locator('#loadingBack').press('Enter');await expect(page.locator('#play')).toBeEnabled();
  } finally {
    release?.();
    await info.attach('worker-diagnostics',{body:JSON.stringify(await diagnostics(page)),contentType:'application/json'});
    await server.close();
  }
});
