import { test, expect } from './normal-browser';
import {selectClassic} from './legacy-profile';
import type { Page } from './normal-browser';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
const state = (page: Page, n: number) => page.evaluate(n => (window as any).doom._web_state(n), n);
async function boot(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.locator('#play')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#resume')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('#resume')).toBeHidden();
  await expect.poll(() => state(page, 1)).toBe(0);
}
test.beforeEach(async ({page}) => { await page.goto('/'); await selectClassic(page); });

test('keyboard shell, settings persistence, remapping, reserved modifier fallback', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#play')).toBeFocused();
  for (let i=0;i<3;i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel h2')).toHaveText('Configurações');
  await page.locator('[data-setting="initial"]').fill('75');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-setting="acceleration"]')).toBeFocused();
  for (let n=0;n<4;n++) await page.keyboard.press('Enter');
  await expect(page.locator('[data-setting="alwaysRun"]')).toBeFocused();
  for (let n=0;n<9;n++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Salvar configurações'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
  await page.reload();
  await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').press('Enter');
  await expect(page.locator('[data-setting="initial"]')).toHaveValue('75');
  await page.keyboard.press('KeyV');
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('#controls').press('Enter');
  await page.locator('[data-action="fire"]').press('Enter');
  await page.keyboard.press('KeyZ');
  await expect(page.locator('[data-action="fire"]')).toHaveText('Atirar: Z');
  await page.keyboard.press('Backspace');
  await expect(page.locator('#home')).toBeVisible();
});
test('real IWAD, rendered level, simultaneous input, ramp, shooting, menu, focus, save/load', async ({page}, info) => {
  const errors: string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await boot(page);
  await expect.poll(() => state(page, 0)).toBeGreaterThan(3);
  const start=[await state(page,2),await state(page,3),await state(page,4)];
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await page.keyboard.down('ArrowLeft');
  await expect.poll(() => state(page,6)).toBeGreaterThan(0);
  await expect.poll(() => state(page,7)).toBeGreaterThan(0);
  await expect.poll(() => state(page,10)).toBe(180);
  expect([await state(page,2),await state(page,3)]).not.toEqual(start.slice(0,2));
  expect(await state(page,4)).not.toBe(start[2]);
  await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.up('ArrowLeft');
  await expect.poll(() => state(page,10)).toBe(0);
  await expect.poll(() => state(page,6)).toBe(0);
  await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowRight');
  await expect.poll(() => state(page,8)).toBe(0);
  await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');
  const ammo=await state(page,11);await page.keyboard.down('KeyJ');
  await expect.poll(() => state(page,11)).toBeLessThan(ammo);await page.keyboard.up('KeyJ');
  await page.keyboard.press('Space');
  await page.keyboard.press('KeyP');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('KeyV');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(0);
  await page.keyboard.down('KeyW');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#resume')).toBeVisible();await page.keyboard.up('KeyW');
  const tic=await state(page,0);await page.waitForTimeout(200);expect(await state(page,0)).toBe(tic);
  await page.keyboard.press('Enter');await expect.poll(()=>state(page,6)).toBe(0);
  await page.keyboard.down('Control');await page.keyboard.press('KeyZ');await page.keyboard.up('Control');
  await expect(page.locator('#resume')).toBeVisible();await page.keyboard.press('Enter');
  await page.keyboard.press('KeyK');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_text())).toBe(1);
  await page.keyboard.type('MVP');await page.keyboard.press('Enter');
  await expect(page.locator('#status')).toHaveText('Save persistido em IndexedDB.',{timeout:10000});
  const saves=await page.evaluate(()=>{const f=(window as any).doom.FS;const scan=(p:string):string[]=>f.readdir(p).filter((n:string)=>n!=='.'&&n!=='..').flatMap((n:string)=>{const s=p+'/'+n;return f.isDir(f.stat(s).mode)?scan(s):[s]});return scan('/persist').filter((p:string)=>p.endsWith('.dsg'))});
  expect(saves.length).toBeGreaterThan(0);
  await page.keyboard.press('KeyL');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(0);
  await page.screenshot({path:info.outputPath('real-level.png')});
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>(window as any).doom._web_audio())).toBe(1);
  await page.evaluate(() => {
    const node = (window as any).doom.SDL2.audio.scriptProcessorNode;
    const original = node.onaudioprocess;
    (window as any).__pcmPeak = 0;
    node.onaudioprocess = (e: AudioProcessingEvent) => {
      original(e);
      const pcm = e.outputBuffer.getChannelData(0);
      for (let i=0; i<pcm.length; i++) (window as any).__pcmPeak = Math.max((window as any).__pcmPeak, Math.abs(pcm[i]));
    };
  });
  await expect.poll(()=>page.evaluate(()=>(window as any).__pcmPeak)).toBeGreaterThan(0);
  await page.keyboard.press('KeyH');await page.locator('#saves').press('Enter');
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button',{name:'Exportar backup de saves e configurações'}).press('Enter')]);
  const backupText = await readFile((await backup.path())!, 'utf8');
  const parsed = JSON.parse(backupText);expect(parsed.files.length).toBeGreaterThan(0);
  await page.getByRole('button',{name:/^Excluir /}).first().press('Enter');
  await page.getByRole('button',{name:'Confirmar exclusão',exact:true}).press('Enter');
  await expect(page.getByRole('button',{name:/^Excluir /})).toHaveCount(0);
  await page.locator('#backupFile').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await expect(page.locator('#status')).toHaveText('Backup importado e persistido.');
  await expect(page.getByRole('button',{name:/^Excluir /})).toHaveCount(1);
  parsed.files[0].path='/persist/../../bad.dsg';
  await page.locator('#backupFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(parsed))});
  await expect(page.locator('#status')).toContainText('Caminho ou tamanho de save inválido');
  await expect(page.getByRole('button',{name:/^Excluir /})).toHaveCount(1);
});
test('IWAD import persists metadata and blob; invalid file is rejected without replacement', async ({page}) => {
  await page.goto('/');await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#wadFile').setInputFiles('web/generated/freedoom1.wad');
  await expect(page.locator('#status')).toContainText('IWAD validado e armazenado');
  await page.reload();await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#content').press('Enter');await expect(page.locator('#panel')).toContainText('✓ freedoom1.wad');
  await page.locator('#wadFile').setInputFiles({name:'bad.wad',mimeType:'application/octet-stream',buffer:Buffer.from('not a wad')});
  await expect(page.locator('#status')).toContainText('Erro:');
  await expect(page.locator('#panel')).toContainText('✓ freedoom1.wad');
  await page.keyboard.press('Backspace');await page.locator('#play').press('Enter');
  await expect(page.locator('#resume')).toBeVisible({timeout:60000});await page.keyboard.press('Enter');
  await expect.poll(()=>state(page,1)).toBe(0);
});
test('complete offline cache, re-open engine without network, persisted save', async ({page,context,browserName}) => {
  test.setTimeout(300000); // The full cache now includes the roughly 399 MB Modern HD package.
  // Shut the actual HTTP server down: no network fallback can satisfy a cache miss.
  // Playwright's WebKit offline emulation itself produced an internal navigation error.
  const root = new URL('../../dist/', import.meta.url);
  const mount = '/doom-browser-check/';
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://localhost').pathname;
      if (!path.startsWith(mount)) { res.writeHead(404).end(); return; }
      const url = new URL(path.slice(mount.length) || 'index.html', root);
      if (!url.href.startsWith(root.href)) { res.writeHead(403).end(); return; }
      const mime = path.endsWith('.wasm') ? 'application/wasm' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : path.endsWith('.webmanifest') ? 'application/manifest+json' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
      res.writeHead(200, {'Content-Type':mime, 'Cache-Control':'no-store'});res.end(await readFile(url));
    } catch { res.writeHead(404).end(); }
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin = `http://127.0.0.1:${(server.address() as any).port}${mount}`;
  try {
  await page.goto(origin); await selectClassic(page); await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').press('Enter');
  await page.locator('[data-setting="presentation"]').selectOption('crt');
  await page.locator('[data-setting="brightness"]').fill('1.1');
  await page.locator('[data-setting="alwaysRun"]').press('Enter');
  await page.locator('[data-setting="musicVolume"]').fill('0');
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
  await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
  await page.keyboard.press('KeyV');
  await boot(page, origin);
  await expect(page.locator('#offline')).toContainText('Preparado para offline',{timeout:180000});
  await page.keyboard.press('KeyK');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_text())).toBe(1);
  await page.keyboard.type('OFFLINE');await page.keyboard.press('Enter');
  await expect(page.locator('#status')).toHaveText('Save persistido em IndexedDB.');
  server.close();server.closeAllConnections();await once(server,'close');
  if (browserName === 'chromium') await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#load').press('Enter');
  await expect(page.locator('#resume')).toBeVisible({timeout:60000});
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(0);
  await expect.poll(()=>state(page,1)).toBe(0);
  await expect.poll(()=>state(page,14)).toBe(1);
  await expect.poll(()=>state(page,16)).toBe(0);
  expect(await page.evaluate(()=>(window as any).doomPresentation.diagnostics().requested)).toBe('crt');
  await expect(page.locator('#canvas')).toHaveCSS('filter','brightness(1.1)');
  await page.keyboard.down('KeyW'); await expect.poll(()=>state(page,6)).toBe(50); await page.keyboard.up('KeyW');
  } finally { server.closeAllConnections(); server.close(); }
});
