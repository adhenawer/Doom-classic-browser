import {pathToFileURL} from 'node:url';
import {test,expect,type Page} from './normal-browser';
import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
// Recording every response body adds hundreds of MB of inspector traffic.
// Preserve explicit screenshots, GPU JSON, native milestones and failure diagnostics
// while measuring the complete real content without HAR body recording.
test.use({trace:'off'});
const hash='7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d';
const slot=`/persist/saves-modern/${hash}/savegame/slot000/`;
const state=(page:Page,n:number)=>page.evaluate(n=>(window as any).doom._web_state(n),n);
const digest=(page:Page,path:string)=>page.evaluate(async path=>{
 const bytes=new Uint8Array((window as any).doom.FS.readFile(path));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
},path);
// Share one deadline across startup, first HD frame and deferred native loading.
// A software WebGL frame can block WebKit beyond the default assertion timeout.
function startupBudget() {
 const deadline=Date.now()+120000;
 return ()=>{const left=deadline-Date.now();if(left<=0)throw new Error('Modern startup exceeded the shared 120 s budget');return left;};
}
async function boot(page:Page,load=false,ammo?:number) {
 const remaining=startupBudget(),began=Date.now();
 const step=(phase:string)=>console.log('MODERN_BOOT_STEP',new Date().toISOString(),JSON.stringify({phase,load,elapsed:Date.now()-began}));
 step('play-before');
 await page.locator(load?'#load':'#play').press('Enter',{timeout:remaining()});
 if(load) await page.getByRole('button',{name:'Carregar slot 1',exact:true}).press('Enter',{timeout:remaining()});
 step('play-return');
 try {
  await page.waitForFunction(()=>!document.querySelector<HTMLElement>('#resume')!.hidden || document.querySelector('#status')?.textContent?.startsWith('Erro:'),undefined,{timeout:remaining(),polling:2000});
  const status=await page.locator('#status').innerText();if(status.startsWith('Erro:'))throw new Error(status);
  await expect(page.locator('#resume')).toBeVisible({timeout:remaining()});step('resume-visible');
  if(await page.locator('#game').getAttribute('data-renderer')==='modern'){
   const ready=await page.evaluate(()=>{const d=(window as any).doom;return {phase:d._web_state(26),ticks:d._web_state(27),worldSwaps:d._web_state(28),ready:d._web_state(33)};});
   console.log('MODERN_READY_INVARIANT',JSON.stringify(ready));
   expect(ready.phase).toBe(0);expect(ready.ready).toBe(1);expect(ready.ticks).toBeGreaterThan(0);expect(ready.worldSwaps).toBeGreaterThan(0);
  }
 } catch(e) {
  console.log('MODERN_BOOT_FAILURE',await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,gameHidden:(document.querySelector('#game')as HTMLElement)?.hidden,engine:!!(window as any).doom,canvas:document.querySelector('canvas')?.getAttribute('width'),state:(window as any).doom?[0,1,17,18,23,24,25].map(n=>(window as any).doom._web_state(n)):null})));
  throw e;
 }
 step('resume-before');await page.keyboard.press('Enter');step('resume-return');
 await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu()),{timeout:remaining()}).toBe(0);
 await expect.poll(()=>state(page,1),{timeout:remaining()}).toBe(0);
 if(ammo!==undefined)await expect.poll(()=>state(page,11),{timeout:remaining()}).toBe(ammo);
}
async function save(page:Page,name:string) {
 await page.keyboard.press('KeyK');
 await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
 await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_text())).toBe(1);
 for(let i=0;i<24;i++)await page.keyboard.press('Backspace',{delay:8});
 await page.keyboard.type(name,{delay:35});await page.keyboard.press('Enter');
 await expect(page.locator('#status')).toHaveText('Save persistido em IndexedDB.',{timeout:20000});
}
async function configure(page:Page,resolution:'classic'|'high'|'modern',modernSize='1280',modernHD=true,modernHUD='overlay') {
 const settingsButton=page.locator('#settings');
 await expect(settingsButton).toBeVisible({timeout:5000});await settingsButton.focus();await expect(settingsButton).toBeFocused();await settingsButton.press('Enter');
 await expect(page.locator('#panel h2')).toHaveText('Configurações',{timeout:5000});
 await page.locator('[data-setting="resolution"]').selectOption(resolution,{timeout:5000});
 await page.locator('[data-setting="modernSize"]').selectOption(modernSize);
 await page.locator('[data-setting="modernHD"]').setChecked(modernHD);
 await page.locator('[data-setting="modernHUD"]').selectOption(modernHUD);
 await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
 await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
}
async function restart(page:Page) {
 await page.getByRole('button',{name:'Aplicar nova resolução',exact:true}).press('Enter');
 await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('button',{name:'Aplicar resolução e reiniciar',exact:true}).press('Enter')]);
 await expect(page.locator('#play')).toBeEnabled();
}

test('Modern default renders real GPU geometry with HD, keyboard, audio, isolated native saves and backup v3',async({page},info)=>{
 test.setTimeout(600000);
 const index=JSON.parse(await readFile((process.env.QA_DIST??'dist')+'/content-index.json','utf8')),wad=index.iwads[hash];
 const allowedAssets=[...wad.bootstrap.map((r:any)=>r.asset),...wad.maps.E1M1.ranges.map((r:any)=>r.asset),...wad.maps.E1M1.hdAssets.map((id:string)=>index.hd.assets[id])];
 const allowedParts=new Set(allowedAssets.flatMap((asset:any)=>asset.parts.map((part:any)=>part.file.replace(/^\.\//,''))));
 const contentRequests:string[]=[];
 page.on('request',request=>{const path=new URL(request.url()).pathname;const at=path.indexOf('/content/');if(at>=0)contentRequests.push(path.slice(at+1));});
 const errors:string[]=[],scriptErrors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{const text=message.text();if(text.includes('[doom-host]')) console.log('HOST_STAGE',new Date().toISOString(),text);if(text.includes('[doom]')&&/initialisation complete|Building XGL|Entering |Initializ|Parsing|StartupSound/i.test(text))console.log('MODERN_STAGE',new Date().toISOString(),text);});
 page.on('console',message=>{const text=message.text();if(text.includes('[modern-host]')||text.includes('MODERN_NATIVE'))console.log('MODERN_DIAGNOSTIC',new Date().toISOString(),text);});

 page.on('console',message=>{const text=message.text();if(text.includes('[doom]')&&(/\b(?:lua|script)\b.*\b(?:error|failed|panic)\b/i.test(text)||/\b(?:error|failed|panic)\b.*\b(?:lua|script)\b/i.test(text)))scriptErrors.push(text);});
 await page.addInitScript(()=>{(window as any).doomTraceModern=true;Element.prototype.requestPointerLock=()=>{throw new Error('Pointer Lock must not be requested');};});
 await page.goto('/');await expect(page.locator('#play')).toBeEnabled();
 await expect(page.locator('#profileSummary')).toContainText('1920×1440');
 await expect(page.locator('#shell')).toHaveAttribute('data-resolution','modern');
 await page.locator('#settings').press('Enter');await expect(page.locator('[data-setting="modernHUD"]')).toHaveValue('overlay');await page.keyboard.press('KeyV');
 await boot(page);
 expect(contentRequests.length).toBeGreaterThan(0);
 expect(contentRequests.every(path=>allowedParts.has(path))).toBe(true);
 expect(new Set(contentRequests).size).toBe(contentRequests.length);
 expect([await state(page,17),await state(page,18),await state(page,19)]).toEqual([1920,1440,2]);
 expect(await state(page,22)).toBe(0);
 await expect.poll(()=>state(page,23)).toBeGreaterThan(0);
 await expect.poll(()=>state(page,24)).toBeGreaterThan(0);
 expect(await state(page,25)).toBeGreaterThanOrEqual(256);
 const gpu=await page.evaluate(()=>{
  const c=document.querySelector<HTMLCanvasElement>('#canvas')!,gl=c.getContext('webgl2');
  return {version:gl?.getParameter(gl.VERSION),width:gl?.drawingBufferWidth,height:gl?.drawingBufferHeight,locked:!!document.pointerLockElement,rect:c.getBoundingClientRect().toJSON(),viewport:Array.from(gl?.getParameter(gl.VIEWPORT)??[]),scissor:Array.from(gl?.getParameter(gl.SCISSOR_BOX)??[]),css:{width:getComputedStyle(c).width,height:getComputedStyle(c).height}};
 });
 expect(gpu.version).toContain('WebGL 2');expect([gpu.width,gpu.height]).toEqual([1920,1440]);expect(gpu.locked).toBe(false);
 const viewport=page.viewportSize()!;expect(gpu.rect.x).toBeGreaterThanOrEqual(-1);expect(gpu.rect.y).toBeGreaterThanOrEqual(-1);
 expect(gpu.rect.right).toBeLessThanOrEqual(viewport.width+1);expect(gpu.rect.bottom).toBeLessThanOrEqual(viewport.height+1);
 expect(gpu.rect.width/gpu.rect.height).toBeCloseTo(4/3,3);expect(gpu.rect.x+gpu.rect.width/2).toBeCloseTo(viewport.width/2,0);
 expect(gpu.viewport).toEqual([0,0,1920,1440]);await info.attach('gpu-layout',{body:JSON.stringify(gpu,null,2),contentType:'application/json'});
 expect(await page.evaluate(()=>{const fs=(window as any).doom.FS;return fs.stat('/lazy-hd/hires/BASE2.png').size;})).toBe(88602011);
 expect(await digest(page,'/lazy-hd/hires/BASE2.png')).toBe('cd7dfc69866c6b67af3e1fe8a17b700fdf24954cebd9fa46d52877ae8af05d64');
 // Read the actual world synchronously after renderer presentation, never a static fixture.
 await page.evaluate(()=>{
  const presentation=(window as any).doomPresentation,original=presentation.frame.bind(presentation);
  (window as any).__modernPixels=0;
  presentation.frame=()=>{original();if((window as any).__modernPixels)return;
   const c=document.querySelector<HTMLCanvasElement>('#canvas')!,gl=c.getContext('webgl2')!;
   const w=gl.drawingBufferWidth,h=Math.floor(gl.drawingBufferHeight/2),bytes=new Uint8Array(w*h*4);
   // Middle world band excludes the native HUD and avoids relying on a tiny dark corridor region.
   gl.readPixels(0,Math.floor(gl.drawingBufferHeight/4),w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
   for(let i=0;i<bytes.length;i+=4)if(bytes[i]+bytes[i+1]+bytes[i+2]>20)(window as any).__modernPixels++;
  };
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).__modernPixels),{timeout:15000}).toBeGreaterThan(100);
 const start=[await state(page,2),await state(page,3),await state(page,4)];
 await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');await page.keyboard.down('ArrowRight');
 await expect.poll(()=>state(page,6)).toBeGreaterThan(0);await expect.poll(()=>state(page,7)).toBeGreaterThan(0);await expect.poll(()=>state(page,10)).toBe(180);
 expect([await state(page,2),await state(page,3)]).not.toEqual(start.slice(0,2));expect(await state(page,4)).not.toBe(start[2]);
 const walking=await state(page,6);await page.keyboard.down('ShiftLeft');await expect.poll(()=>state(page,6)).toBeGreaterThan(walking);await page.keyboard.up('ShiftLeft');
 await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.up('ArrowRight');
 await expect.poll(()=>state(page,6)).toBe(0);await expect.poll(()=>state(page,10)).toBe(0);
 await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowRight');await expect.poll(()=>state(page,8)).toBe(0);
 await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');
 const ammo=await state(page,11);await page.keyboard.down('KeyJ');await expect.poll(()=>state(page,11)).toBeLessThan(ammo);await page.keyboard.up('KeyJ');
 await page.keyboard.down('KeyE');await expect.poll(async()=>(await state(page,9))&2).toBe(2);await page.keyboard.up('KeyE');await page.keyboard.press('KeyP');await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
 await page.keyboard.press('ArrowDown');await page.keyboard.press('KeyV');await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(0);
 await page.keyboard.down('KeyW');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('KeyW');
 await expect(page.locator('#resume')).toBeVisible();const tic=await state(page,0);await page.waitForTimeout(250);expect(await state(page,0)).toBe(tic);
 await expect.poll(()=>page.evaluate(()=>(window as any).doom.modernAudioContext.state)).toBe('suspended');
 await page.keyboard.press('Enter');await expect.poll(()=>state(page,6)).toBe(0);
 await expect.poll(()=>state(page,0)).toBeGreaterThan(tic);
 await expect.poll(()=>page.evaluate(()=>(window as any).doom.modernAudioContext.state)).toBe('running');
 await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_audio())).toBe(1);
 await page.evaluate(()=>{
  const node=(window as any).doom.modernAudioNode,original=node.onaudioprocess;
  (window as any).__modernPcmPeak=0;
  node.onaudioprocess=(e:AudioProcessingEvent)=>{original(e);for(const value of e.outputBuffer.getChannelData(0))(window as any).__modernPcmPeak=Math.max((window as any).__modernPcmPeak,Math.abs(value));};
 });
 await page.keyboard.down('KeyJ');await expect.poll(()=>page.evaluate(()=>(window as any).__modernPcmPeak)).toBeGreaterThan(.001);await page.keyboard.up('KeyJ');
 await page.screenshot({path:info.outputPath('modern-real-gpu-hd.png')});
 await save(page,'MODERN');const nativeSave=await digest(page,slot+'head.esg');
 const savedAmmo=await state(page,11);await page.keyboard.down('KeyJ');await expect.poll(()=>state(page,11)).toBeLessThan(savedAmmo);await page.keyboard.up('KeyJ');
 await page.keyboard.press('KeyH');await page.locator('#saves').press('Enter');
 await expect(page.getByRole('button',{name:/^Excluir Moderno HD/})).toHaveCount(1);
 const [backup]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Exportar backup de saves e configurações'}).press('Enter')]);
 const parsed=JSON.parse(await readFile((await backup.path())!,'utf8'));
 expect(parsed.version).toBe(3);expect(parsed.profiles.modern.id).toBe('edge-modern-v1');
 expect(parsed.files.some((f:any)=>f.path===slot+'head.esg')).toBe(true);
 expect(parsed.files.every((f:any)=>!f.path.includes('/current/'))).toBe(true);
 const invalid=structuredClone(parsed);invalid.profiles.modern.commit='0'.repeat(40);
 await page.locator('#backupFile').setInputFiles({name:'invalid-modern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
 await expect(page.locator('#status')).toContainText('Formato de backup inválido');expect(await digest(page,slot+'head.esg')).toBe(nativeSave);
 await page.getByRole('button',{name:/^Excluir Moderno HD/}).press('Enter');await page.getByRole('button',{name:'Confirmar exclusão',exact:true}).press('Enter');
 await expect(page.getByRole('button',{name:/^Excluir Moderno HD/})).toHaveCount(0);
 await page.locator('#backupFile').setInputFiles({name:'restore-modern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(parsed))});
 await expect(page.locator('#status')).toHaveText('Backup importado e persistido.');expect(await digest(page,slot+'head.esg')).toBe(nativeSave);
 await page.reload();await expect(page.locator('#play')).toBeEnabled();await boot(page,true,savedAmmo);
 console.log('MODERN_SAVE_RESTORED',JSON.stringify({phase:'HD-reload',expected:savedAmmo,actual:await state(page,11)}));
 expect(await digest(page,slot+'head.esg')).toBe(nativeSave);
 // A resolution/quality change is pending until restart; it cannot replace a live runtime.
 await page.keyboard.press('KeyH');await configure(page,'modern','1280',false,'classic');
 expect([await state(page,17),await state(page,18)]).toEqual([1920,1440]);
 await restart(page);await boot(page);
 expect([await state(page,17),await state(page,18),await state(page,19)]).toEqual([1280,960,2]);
 expect(await page.evaluate(()=>{try{(window as any).doom.FS.stat('/lazy-hd/hires');return true;}catch{return false;}})).toBe(false);
 expect(await digest(page,slot+'head.esg')).toBe(nativeSave);
 const loadRemaining=startupBudget();
 await page.keyboard.press('KeyL');await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu()),{timeout:loadRemaining()}).toBe(1);await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu()),{timeout:loadRemaining()}).toBe(0);await expect.poll(()=>state(page,11),{timeout:loadRemaining()}).toBe(savedAmmo);
 console.log('MODERN_SAVE_RESTORED',JSON.stringify({phase:'HD-disabled',expected:savedAmmo,actual:await state(page,11)}));
 await page.keyboard.press('KeyH');await page.locator('#settings').press('Enter');await expect(page.locator('[data-setting="modernHUD"]')).toHaveValue('classic');
 expect(errors).toEqual([]);expect(scriptErrors).toEqual([]);
});

test('Prepared Modern map reopens without network, persists saves and recovers from GPU context loss',async({page,context,browserName},info)=>{
 test.setTimeout(600000);
 const root=process.env.QA_DIST ? pathToFileURL(process.env.QA_DIST.replace(/\/$/,'')+'/') : new URL('../../dist/',import.meta.url),mount='/modern-offline/';
 const server=createServer((req,res)=>{
  const path=new URL(req.url!,'http://localhost').pathname;
  if(!path.startsWith(mount)){res.writeHead(404).end();return;}
  const file=new URL(path.slice(mount.length)||'index.html',root);
  if(!file.href.startsWith(root.href)){res.writeHead(403).end();return;}
  const mime=path.endsWith('.wasm')?'application/wasm':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
  res.writeHead(200,{'Content-Type':file.pathname.endsWith('index.html')?'text/html':mime,'Cache-Control':'no-store'});
  const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}${mount}`);await expect(page.locator('#play')).toBeEnabled();
  await configure(page,'modern','1280',true);await page.keyboard.press('KeyV');
  await boot(page);await page.keyboard.press('KeyH');
  const offlineDiagnostics=()=>page.evaluate(async()=>{
   const index=await(await fetch('./offline-index.json')).json(),required=index.resources.map((path:string)=>new URL(path,location.href).href),inventory=[];
   for(const name of await caches.keys()){const urls=(await(await caches.open(name)).keys()).map(r=>r.url);inventory.push({name,count:urls.length,missing:required.filter((url:string)=>!urls.includes(url)),extra:urls.filter(url=>!required.includes(url))});}
   const workers=(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state}));
   return {offline:document.querySelector('#offline')?.textContent,controller:navigator.serviceWorker.controller?.scriptURL,version:index.version,required:required.length,inventory,workers};
  });
  const diagnosticTimer=setTimeout(()=>{offlineDiagnostics().then(value=>console.log('MODERN_OFFLINE_WAIT',JSON.stringify(value,null,2))).catch(error=>console.log('MODERN_OFFLINE_DIAGNOSTIC_ERROR',String(error)));},20000);
  try { await expect(page.locator('#offline')).toContainText('E1M1 disponível offline',{timeout:180000}); }
  catch(e) {console.log('MODERN_OFFLINE_FAILURE',JSON.stringify(await offlineDiagnostics(),null,2));throw e;}
  finally {clearTimeout(diagnosticTimer);}
  // Only this explicitly played profile/map is prepared. Reopening must use cached assets.
  await page.reload();await expect(page.locator('#play')).toBeEnabled();
  server.close();server.closeAllConnections();await once(server,'close');if(browserName==='chromium')await context.setOffline(true);
  await boot(page);expect([await state(page,17),await state(page,18),await state(page,19)]).toEqual([1280,960,2]);
  await page.keyboard.down('KeyW');await expect.poll(()=>state(page,6)).toBeGreaterThan(0);await page.keyboard.up('KeyW');await save(page,'OFFMODERN');
  const saved=await digest(page,slot+'head.esg');
  await page.evaluate(()=>{
   const gl=document.querySelector<HTMLCanvasElement>('#canvas')!.getContext('webgl2')!;
   const ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw new Error('Cannot exercise actual WebGL2 context loss');ext.loseContext();
  });
  await expect(page.locator('#status')).toContainText('Contexto WebGL2 perdido');await expect(page.locator('#resume')).toBeVisible();
  expect(await digest(page,slot+'head.esg')).toBe(saved);
  await page.screenshot({path:info.outputPath('modern-context-loss-suspended.png')});
  await page.keyboard.press('Enter');await expect(page.locator('#panel h2')).toHaveText('Aplicar resolução');
  await expect(page.getByRole('button',{name:'Retomar resolução atual',exact:true})).toHaveCount(0);
  await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('button',{name:'Aplicar resolução e reiniciar',exact:true}).press('Enter')]);
  await expect(page.locator('#play')).toBeEnabled();await boot(page,true);expect(await digest(page,slot+'head.esg')).toBe(saved);
  expect(await digest(page,slot+'head.esg')).toBe(saved);
 }finally{if(server.listening){server.close();server.closeAllConnections();}}
});

test('HD associates only with the exact authorized Freedoom revision and legacy preferences remain Classic',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');await expect(page.locator('#play')).toBeEnabled();
 // An otherwise identical, structurally valid free IWAD with an unused trailing byte has a
 // different identity. It stands in for an arbitrary user IWAD without commercial fixtures.
 const source=await readFile('web/generated/freedoom1.wad'),different=Buffer.concat([source,Buffer.from([0])]);
 await page.locator('#wadFile').setInputFiles({name:'freedoom-different-revision.wad',mimeType:'application/octet-stream',buffer:different});
 await expect(page.locator('#status')).toContainText('IWAD validado e armazenado');await page.keyboard.press('KeyV');
 await configure(page,'modern','1280',true);await page.keyboard.press('KeyV');await boot(page);
 expect(await state(page,19)).toBe(2);expect(await state(page,1)).toBe(0);
 expect(await page.evaluate(()=>{try{(window as any).doom.FS.stat('/lazy-hd/hires');return true;}catch{return false;}})).toBe(false);
 // Actual legacy records, lacking every new renderer field, retain the original backend.
 await page.evaluate(async()=>{
  const db:IDBDatabase=await new Promise((resolve,reject)=>{const r=indexedDB.open('doom-ipad-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const t=db.transaction('data','readwrite');t.objectStore('data').put({initial:75,acceleration:360,maximum:180,sensitivity:1,deceleration:0},'settings');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});db.close();
 });
 await page.reload();await expect(page.locator('#shell')).toHaveAttribute('data-resolution','classic');
 await page.locator('#settings').press('Enter');await expect(page.locator('[data-setting="resolution"]')).toHaveValue('classic');
 await expect(page.locator('[data-setting="initial"]')).toHaveValue('75');
});

test('failed HD map download preserves the shell and retries original content without lowering quality',async({page})=>{
 test.setTimeout(300000);
 const index=JSON.parse(await readFile((process.env.QA_DIST??'dist')+'/content-index.json','utf8'));
 const hd=index.hd.assets[index.iwads[hash].maps.E1M1.hdAssets[0]];
 const failedFile=hd.parts[0].file.replace(/^\.\//,'');
 let failing=true,failedRequests=0;
 const root=process.env.QA_DIST ? pathToFileURL(process.env.QA_DIST.replace(/\/$/,'')+'/') : new URL('../../dist/',import.meta.url),mount='/modern-map-failure/';
 const server=createServer((req,res)=>{
  const path=new URL(req.url!,'http://localhost').pathname;
  if(!path.startsWith(mount)){res.writeHead(404).end();return;}
  if(path===mount+failedFile&&failing){failedRequests++;res.writeHead(503).end('Controlled missing HD asset');return;}
  const file=new URL(path.slice(mount.length)||'index.html',root);
  if(!file.href.startsWith(root.href)){res.writeHead(403).end();return;}
  const mime=path.endsWith('.wasm')?'application/wasm':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
  res.writeHead(200,{'Content-Type':file.pathname.endsWith('index.html')?'text/html':mime,'Cache-Control':'no-store'});
  const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}${mount}`);
  await expect(page.locator('#play')).toBeEnabled();
  await configure(page,'modern','1280',true);await page.keyboard.press('KeyV');
  await page.locator('#play').press('Enter');
  await expect(page.locator('#loadingBack')).toBeVisible({timeout:120000});
  await expect(page.locator('#loadingBack')).toHaveText('Tentar novamente',{timeout:120000});
  expect(failedRequests).toBeGreaterThan(0);
  expect(await page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.locator('#offline')).not.toContainText('E1M1 disponível offline');
  failing=false;await page.locator('#loadingBack').press('Enter');
  await expect(page.locator('#resume')).toBeVisible({timeout:120000});
  await expect(page.locator('#loadingScreen')).toBeHidden();
  await expect(page.locator('#offline')).toContainText('E1M1 disponível offline');
  expect(await digest(page,'/lazy-hd/hires/BASE2.png')).toBe('cd7dfc69866c6b67af3e1fe8a17b700fdf24954cebd9fa46d52877ae8af05d64');
 }finally{if(server.listening){server.close();server.closeAllConnections();}}
});
