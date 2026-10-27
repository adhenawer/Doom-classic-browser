import {pathToFileURL} from 'node:url';
import {test, expect, type Page} from './normal-browser';
import {selectClassic} from './legacy-profile';
import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';

const hash='7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d';
type Part={file:string};
type Asset={parts:Part[]};
type Range={offset:number;asset:Asset};
const files=(ranges:Range[])=>new Set(ranges.flatMap(range=>range.asset.parts.map(part=>part.file.replace(/^\.\//,''))));
async function cheat(page:Page, value:string) {
  // Exercise the engine's normal cheat-driven transition, not the downloader API.
  const modern=await page.evaluate(()=>(window as any).doom._web_state(19))===2;
  if(modern) value='idcleve'+value.at(-2)+'m'+value.at(-1);
  for(const character of value) {
    await page.evaluate(character=>{const doom=(window as any).doom,k=character.charCodeAt(0);doom._web_key(k,1,k);doom._web_key(k,0,k);},character);
    await page.waitForTimeout(40);
  }
  // EDGE asks to confirm its change-level input; Classic applies the two digits directly.
  if(modern) await page.keyboard.press('Enter');
}
async function ready(page:Page,map:string) {
  await expect(page.locator('#loadingScreen')).toBeHidden({timeout:120000});
  await expect(page.locator('#offline')).toContainText(`${map} disponível offline`,{timeout:120000});
  if(await page.locator('#resume').isVisible()) await page.locator('#resumeButton').press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_state(1))).toBe(0);
  const match=/^E(\d+)M(\d+)$/.exec(map)!;
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_state(34))).toBe(Number(match[1])*100+Number(match[2]));
}

for(const profile of ['classic','modern'] as const) test(`native ${profile} map transitions fetch only requested geometry and reuse verified content without prefetch`,async({page})=>{
  test.setTimeout(240000);
  const manifest=JSON.parse(await readFile((process.env.QA_DIST??'dist')+'/content-index.json','utf8'));
  const wad=manifest.iwads[hash];
  const initial=new Set([...files(wad.bootstrap),...files(wad.maps.E1M1.ranges)]);
  const second=files(wad.maps.E1M2.ranges);
  const third=files(wad.maps.E1M3.ranges);
  const requests:string[]=[];
  let active=0,peak=0,failSecond=true;
  const root=process.env.QA_DIST ? pathToFileURL(process.env.QA_DIST.replace(/\/$/,'')+'/') : new URL('../../dist/',import.meta.url),mount='/lazy-map-qa/';
  const server=createServer((req,res)=>{
    const path=new URL(req.url!,'http://localhost').pathname;
    if(!path.startsWith(mount)){res.writeHead(404).end();return;}
    const relative=path.slice(mount.length)||'index.html';
    const file=new URL(relative,root);
    if(!file.href.startsWith(root.href)){res.writeHead(403).end();return;}
    if(relative.startsWith('content/')) {
      requests.push(relative);active++;peak=Math.max(peak,active);res.once('close',()=>active--);
      if(second.has(relative)&&!initial.has(relative)&&failSecond){res.writeHead(503).end('Next map deliberately unavailable');return;}
    }
    const send=()=>{
      const mime=relative.endsWith('.wasm')?'application/wasm':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.json')?'application/json':relative.endsWith('.html')?'text/html':'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});
      const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
    };
    // Hold independent transfers briefly so bounded concurrency is observable.
    if(relative.startsWith('content/'))setTimeout(send,60);else send();
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}${mount}`);await selectClassic(page);
    if(profile==='modern') {
      await page.locator('#settings').press('Enter');
      await page.locator('[data-setting="resolution"]').selectOption('modern');
      await page.locator('[data-setting="modernSize"]').selectOption('1280');
      await page.locator('[data-setting="modernHD"]').setChecked(false);
      await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
      await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
      await page.getByRole('button',{name:'Voltar',exact:true}).press('Enter');
      await expect(page.locator('#home')).toBeVisible();
    }
    expect(requests).toEqual([]); // Merely opening the shell must not download a map.
    await page.locator('#play').press('Enter');await ready(page,'E1M1');
    await page.waitForTimeout(1500);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(file=>initial.has(file))).toBe(true);
    expect(peak).toBeGreaterThan(1);expect(peak).toBeLessThanOrEqual(3);
    if(profile==='modern') {
      const nodes=await page.evaluate(()=>{
        const fs=(window as any).doom.FS,paths:string[]=[];
        const walk=(path:string,depth:number)=>{if(depth>8)return;for(const name of fs.readdir(path)){if(['.','..','proc','dev'].includes(name))continue;const p=path.replace(/\/$/,'')+'/'+name;try{if(fs.isDir(fs.stat(p).mode))walk(p,depth+1);else if(p.endsWith('.xwa'))paths.push(p);}catch{}}};
        walk('/',0);return paths;
      });
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.every(path=>path.endsWith('-E1M1.xwa'))).toBe(true);
    }
    const firstRequests=[...requests];
    await cheat(page,'idclev12');
    await expect(page.locator('#loadingBack')).toBeVisible({timeout:120000});
  await expect(page.locator('#loadingBack')).toHaveText('Tentar novamente',{timeout:30000});
    expect(requests.some(file=>second.has(file)&&!initial.has(file))).toBe(true);
    expect(requests.some(file=>third.has(file)&&!initial.has(file)&&!second.has(file))).toBe(false);
    // Failure retains the active engine and verified parts; no lower-quality fallback.
    expect(await page.evaluate(()=>!!(window as any).doom)).toBe(true);
    failSecond=false;await page.locator('#loadingBack').press('Enter');await ready(page,'E1M2');
    expect(requests.every(file=>initial.has(file)||second.has(file))).toBe(true);
    for(const file of new Set(firstRequests))expect(requests.filter(value=>value===file)).toHaveLength(1);
    await page.keyboard.press('KeyK');
    await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
    await page.keyboard.press('Enter');
    await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_text())).toBe(1);
    await page.keyboard.type('LAZY MAP TWO');await page.keyboard.press('Enter');
    await expect(page.locator('#status')).toHaveText('Save persistido em IndexedDB.');
    const beforeReturn=requests.length;
    await cheat(page,'idclev11');await ready(page,'E1M1');
    expect(requests).toHaveLength(beforeReturn);
    // A fresh boot loading a save must not prepare E1M1 as a hidden stepping stone.
    await page.reload();await expect(page.locator('#play')).toBeEnabled();
    await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('doom-content-v1-'))await caches.delete(name);});
    requests.length=0;
    await page.locator('#load').press('Enter');
    await page.getByRole('button',{name:'Carregar slot 1',exact:true}).press('Enter');
    await ready(page,'E1M2');
    const loadAllowed=new Set([...files(wad.bootstrap),...second]);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(file=>loadAllowed.has(file))).toBe(true);
  } finally {server.close();server.closeAllConnections();}
});

test('initial save picker cancels with Escape without preparing a map or leaving startup pending',async({page})=>{
  const contentRequests:string[]=[];
  page.on('request',request=>{if(new URL(request.url()).pathname.includes('/content/'))contentRequests.push(request.url());});
  await page.goto('/');await selectClassic(page);
  await page.locator('#load').press('Enter');
  await expect(page.getByRole('button',{name:'Iniciar nova partida',exact:true})).toBeVisible({timeout:30000});
  expect(contentRequests).toEqual([]);
  await Promise.all([page.waitForEvent('domcontentloaded'),page.keyboard.press('Escape')]);
  await expect(page.locator('#play')).toBeEnabled();
  expect(await page.evaluate(()=>!!(window as any).doom)).toBe(false);
  expect(contentRequests).toEqual([]);
});
