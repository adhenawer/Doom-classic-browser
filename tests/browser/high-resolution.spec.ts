import {test, expect, type Page} from './normal-browser';
import {selectClassic} from './legacy-profile';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
const hash='7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d';
const classic=`/persist/saves/${hash}/doomsav0.dsg`, high=`/persist/saves-hires/${hash}/doomsav0.dsg`;
const state=(p:Page,n:number)=>p.evaluate(n=>(window as any).doom._web_state(n),n);
const data=(p:Page,path:string)=>p.evaluate(async path=>{
  const bytes=new Uint8Array((window as any).doom.FS.readFile(path));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
},path);
async function boot(p:Page,load=false) {
  await p.locator(load?'#load':'#play').press('Enter');
  await expect(p.locator('#resume')).toBeVisible({timeout:60000});await p.keyboard.press('Enter');
  if(load) {await expect.poll(()=>p.evaluate(()=>(window as any).doom._web_menu())).toBe(1);await p.keyboard.press('Enter');}
  await expect.poll(()=>p.evaluate(()=>(window as any).doom._web_menu())).toBe(0);
}
async function save(p:Page,label:string) {
  await p.keyboard.press('KeyK');await expect.poll(()=>p.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await p.keyboard.press('Enter');await expect.poll(()=>p.evaluate(()=>(window as any).doom._web_text())).toBe(1);
  for(let i=0;i<24;i++) await p.keyboard.press('Backspace',{delay:8});
  await p.keyboard.type(label,{delay:8});await p.keyboard.press('Enter');
  await expect(p.locator('#status')).toHaveText('Save persistido em IndexedDB.',{timeout:10000});
}
async function select(p:Page,resolution:'classic'|'high') {
  await p.locator('#settings').press('Enter');await p.locator('[data-setting="resolution"]').selectOption(resolution);
  await p.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
  await expect(p.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
}
async function restart(p:Page) {
  await p.getByRole('button',{name:'Aplicar nova resolução',exact:true}).press('Enter');
  await Promise.all([p.waitForEvent('domcontentloaded'),p.getByRole('button',{name:'Aplicar resolução e reiniciar',exact:true}).press('Enter')]);
  await expect(p.locator('#play')).toBeEnabled();
}
test.beforeEach(async ({page}) => { await page.goto('/'); await selectClassic(page); });

test('real 640x400 renderer, keyboard, classic-save copy, isolated saves, v1/v2 backups and reversible restart',async({page},info)=>{
  test.setTimeout(180000); // Three engine boots plus save/backup round-trips.
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('#play')).toBeEnabled();await boot(page);
  expect([await state(page,17),await state(page,18)]).toEqual([320,200]);
  await page.keyboard.down('KeyJ'); await expect.poll(()=>state(page,11)).toBeLessThan(50); await page.keyboard.up('KeyJ');
  await save(page,'CLASSIC');const original=await data(page,classic), legacyAmmo=await state(page,11);
  await page.keyboard.press('KeyH');await select(page,'high');
  expect(await state(page,17)).toBe(320); // Saving preferences cannot replace a live engine.
  await page.keyboard.press('KeyV');await page.locator('#play').press('Enter');
  await expect(page.locator('#panel h2')).toHaveText('Aplicar resolução');
  await page.getByRole('button',{name:'Retomar resolução atual'}).press('Enter');
  expect(await state(page,19)).toBe(0);
  await page.keyboard.press('KeyH');await page.locator('#settings').press('Enter');await restart(page);
  await expect(page.locator('#profileSummary')).toContainText('640×400');await boot(page,true);
  expect([await state(page,17),await state(page,18),await state(page,19)]).toEqual([640,400,1]);
  expect([await state(page,20),await state(page,21)]).toEqual([640,336]);
  expect(await state(page,11)).toBe(legacyAmmo);
  expect(await state(page,22)).toBe(0); // No free aim, freelook, jump or over/under.
  expect(await page.evaluate(()=>!!(window as any).createDoom)).toBe(false);
  expect(await data(page,high)).toEqual(original);expect(await data(page,classic)).toEqual(original);
  await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');await page.keyboard.down('ArrowRight');
  await expect.poll(()=>state(page,6)).toBe(25);await expect.poll(()=>state(page,7)).toBe(24);await expect.poll(()=>state(page,10)).toBe(180);
  await page.keyboard.down('ShiftLeft');await expect.poll(()=>state(page,6)).toBe(50);
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.up('ArrowRight');
  await expect.poll(()=>state(page,6)).toBe(0);await expect.poll(()=>state(page,10)).toBe(0);
  const ammo=await state(page,11);await page.keyboard.down('KeyJ');await expect.poll(()=>state(page,11)).toBeLessThan(ammo);await page.keyboard.up('KeyJ');await page.keyboard.press('KeyE');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('#resume')).toBeVisible();await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom.SDL2.audioContext.state)).toBe('running');
  await page.evaluate(()=>{
    const node=(window as any).doom.SDL2.audio.scriptProcessorNode, original=node.onaudioprocess;
    (window as any).__highPeak=0;
    node.onaudioprocess=(e:AudioProcessingEvent)=>{original(e);for(const sample of e.outputBuffer.getChannelData(0))(window as any).__highPeak=Math.max((window as any).__highPeak,Math.abs(sample));};
  });
  await expect.poll(()=>page.evaluate(()=>(window as any).__highPeak)).toBeGreaterThan(.001);
  await page.screenshot({path:info.outputPath('true-high-resolution.png')});
  await save(page,'HIGH');const highData=await data(page,high);expect(highData).not.toEqual(original);expect(await data(page,classic)).toEqual(original);
  await page.keyboard.press('KeyH');await page.locator('#saves').press('Enter');
  await expect(page.getByRole('button',{name:/^Excluir Alta/})).toHaveCount(1);await expect(page.getByRole('button',{name:/^Excluir Clássica/})).toHaveCount(1);
  const [backup]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Exportar backup de saves e configurações'}).press('Enter')]);
  const json=JSON.parse(await readFile((await backup.path())!,'utf8'));expect(json.version).toBe(2);expect(json.files.length).toBe(2);expect(json.profiles.high.id).toBe('crispy-doom-hires-v1');
  const invalid=structuredClone(json);invalid.profiles.high.commit='0'.repeat(40);
  await page.locator('#backupFile').setInputFiles({name:'bad-profile.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
  await expect(page.locator('#status')).toContainText('Formato de backup inválido');expect(await data(page,high)).toEqual(highData);
  const legacy={version:1,settings:{...json.settings,resolution:undefined},files:json.files.filter((f:any)=>f.path===classic)};
  await page.locator('#backupFile').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await expect(page.locator('#status')).toHaveText('Backup importado e persistido.');
  expect(await state(page,19)).toBe(1); // Backup restores a preference, not another live runtime.
  await page.keyboard.press('KeyV');await page.locator('#settings').press('Enter');await restart(page);await boot(page,true);
  expect([await state(page,17),await state(page,18)]).toEqual([320,200]);
  expect(await state(page,11)).toBe(legacyAmmo);
  expect(await data(page,classic)).toEqual(original);expect(await data(page,high)).toEqual(highData);expect(errors).toEqual([]);
});
test('prepare only Classic, stop server, then select and play high resolution offline with persistent saves',async({page,context,browserName})=>{
  test.setTimeout(360000); // Full HD preparation plus Classic/High boots, all resources retained.
  const root=new URL('../../dist/',import.meta.url),mount='/high-resolution-offline/';
  const server=createServer(async(req,res)=>{try{
    const path=new URL(req.url!,'http://localhost').pathname;if(!path.startsWith(mount)){res.writeHead(404).end();return;}
    const file=new URL(path.slice(mount.length)||'index.html',root);if(!file.href.startsWith(root.href)){res.writeHead(403).end();return;}
    const mime=path.endsWith('.wasm')?'application/wasm':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.svg')?'image/svg+xml':'text/html';
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(await readFile(file));
  }catch{res.writeHead(404).end();}});
  server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${(server.address() as any).port}${mount}`;
  try{
    await page.goto(url);await selectClassic(page);await expect(page.locator('#play')).toBeEnabled();await boot(page);await save(page,'OFFCLASSIC');
    await expect(page.locator('#offline')).toContainText('Preparado para offline',{timeout:180000});
    server.close();server.closeAllConnections();await once(server,'close');if(browserName==='chromium')await context.setOffline(true);
    await page.keyboard.press('KeyH');await select(page,'high');await restart(page);await boot(page,true);
    expect([await state(page,17),await state(page,18)]).toEqual([640,400]);
    await page.keyboard.down('KeyW');await expect.poll(()=>state(page,6)).toBe(25);await page.keyboard.up('KeyW');await save(page,'OFFHIGH');
    const saved=await data(page,high);await page.reload();await expect(page.locator('#play')).toBeEnabled();await boot(page,true);
    expect(await state(page,17)).toBe(640);expect(await data(page,high)).toEqual(saved);
    await page.keyboard.press('KeyH');await select(page,'classic');await restart(page);await boot(page,true);
    expect(await state(page,17)).toBe(320);expect(await data(page,high)).toEqual(saved);
  }finally{if(server.listening){server.close();server.closeAllConnections();}}
});
