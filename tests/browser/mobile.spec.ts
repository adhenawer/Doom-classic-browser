import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { selectClassic } from './legacy-profile';
const state = (page: Page, n: number) => page.evaluate(n => (window as any).doom._web_state(n), n);
test('desktop detection keeps keyboard interface', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-controls', 'desktop');
  await expect(page.locator('#touchControls')).toBeHidden();
});
test.describe('mobile experience', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test('automatic touch, landscape gate, menus, save name and hybrid input', async ({page, browserName}, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-controls', 'mobile');
    await selectClassic(page);
    await expect(page.locator('#play')).toBeEnabled();
    await page.locator('#play').tap();
    await expect(page.locator('#resume')).toBeVisible({timeout:60000});
    await page.setViewportSize({width:390,height:844});
    await expect(page.locator('#rotatePrompt')).toBeVisible();
    const paused = await state(page,0); await page.waitForTimeout(100); expect(await state(page,0)).toBe(paused);
    await page.setViewportSize({width:844,height:390});
    await expect(page.locator('#rotatePrompt')).toBeHidden();
    await page.locator('#resumeButton').tap();
    await expect(page.locator('#touchControls')).toBeVisible();
    const resumed = await state(page,0);
    await expect.poll(()=>state(page,0)).toBeGreaterThan(resumed + 35);
    await page.screenshot({path:info.outputPath('mobile-landscape.png')});
    if (browserName === 'chromium') {
      const session = await page.context().newCDPSession(page);
      const box = await page.locator('.move-stick').boundingBox();
      const look = await page.locator('.look-stick').boundingBox();
      const fire = await page.locator('[data-hold="fire"]').boundingBox();
      const point = (b: NonNullable<typeof box>, id: number, dx=0, dy=0) => ({id,x:b.x+b.width/2+dx,y:b.y+b.height/2+dy});
      const ammo = await state(page,11);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(box!,1,30,-30),point(look!,2,30),point(fire!,3)]});
      await expect.poll(()=>state(page,6)).toBeGreaterThan(0);
      await expect.poll(()=>state(page,7)).toBeGreaterThan(0);
      await expect.poll(()=>state(page,8)).not.toBe(0);
      await expect.poll(()=>state(page,11)).toBeLessThan(ammo);
      await page.keyboard.down('KeyW');
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await expect.poll(()=>state(page,7)).toBe(0);
      await expect.poll(()=>state(page,8)).toBe(0);
      await expect.poll(()=>state(page,6)).toBeGreaterThan(0);
      await page.keyboard.up('KeyW');
      await expect.poll(()=>state(page,6)).toBe(0);
      // Native pointercancel releases movement too.
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(box!,1,0,-30)]});
      await expect.poll(()=>state(page,6)).toBeGreaterThan(0);
      await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await expect.poll(()=>state(page,6)).toBe(0);
    }
    for (const name of ['MOBILE7', 'ABCDEFGHIJKLMNOPQRST', 'SHORT']) {
      await page.locator('[data-key="188"]').tap();
      await expect(page.locator('.touch-menu')).toBeVisible();
      await page.locator('.touch-menu [data-command="13"]').tap();
      await expect(page.locator('.touch-name')).toBeVisible();
      await page.getByRole('textbox',{name:'Nome do save'}).fill(name);
      await page.getByRole('button',{name:'Salvar nome',exact:true}).tap();
      await expect(page.locator('.touch-name')).toBeHidden();
      await expect(page.locator('#status')).toHaveText('Save persistido em IndexedDB.');
      const labels = await page.evaluate(() => {
        const fs = (window as any).doom.FS;
        const scan = (path: string): string[] => fs.readdir(path).filter((n:string)=>n!=='.'&&n!=='..').flatMap((n:string)=> {
          const p = path+'/'+n;
          return fs.isDir(fs.stat(p).mode) ? scan(p) : p.endsWith('.dsg') ? [new TextDecoder().decode(fs.readFile(p).slice(0,24)).split('\0')[0]] : [];
        });
        return scan('/persist');
      });
      expect(labels).toContain(name);
    }
    await page.setViewportSize({width:390,height:844});
    await expect(page.locator('#rotatePrompt')).toBeVisible();
    await expect(page.locator('#resume')).toBeVisible();
    await page.locator('#rotateHome').tap();
    await expect(page.locator('#shell')).toBeVisible();
    await page.locator('#controls').tap();
    await page.locator('#controlMode').selectOption('desktop');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-controls','desktop');
    expect(errors).toEqual([]);
  });
});

test.describe('Modern mobile integration', () => {
  test.use({hasTouch:true, viewport:{width:844,height:390}});
  test('Modern accepts touch actions, native save text and landscape suspension', async ({page},info) => {
    test.setTimeout(180000);
    await page.goto('/'); await expect(page.locator('#settings')).toBeEnabled();
    await page.locator('#settings').tap();
    await page.locator('[data-setting="resolution"]').selectOption('modern');
    await page.locator('[data-setting="modernSize"]').selectOption('1280');
    await page.locator('[data-setting="modernHD"]').setChecked(false);
    await page.getByRole('button',{name:'Salvar configurações',exact:true}).tap();
    await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
    await page.getByRole('button',{name:'Voltar',exact:true}).tap();
    await page.locator('#play').tap();
    await expect(page.locator('#resumeButton')).toBeVisible({timeout:120000});
    await page.locator('#resumeButton').tap();
    await expect(page.locator('#touchControls')).toBeVisible();
    await expect.poll(()=>state(page,19)).toBe(2);
    // Freeze logical time from inside the native pre-swap callback. Browser
    // timers must still run while a partially completed native frame is paused.
    await page.evaluate(() => {
      const runtime = (window as any).doom, previous = runtime.onFrame;
      runtime.onFrame = () => {
        previous?.(); runtime.onFrame = previous;
        const probe = (window as any).__pauseProbe = { first: -1, second: -2, resumed: false, tic: -1 };
        runtime._web_suspend(1);
        setTimeout(() => {
          probe.first = runtime._web_state(0);
          setTimeout(() => {
            probe.second = runtime._web_state(0);
            runtime._web_audio(); runtime._web_suspend(0);
            probe.tic = runtime._web_state(0); probe.resumed = true;
          }, 50);
        }, 100);
      };
    });
    await expect.poll(()=>page.evaluate(()=>(window as any).__pauseProbe?.resumed),{timeout:15000}).toBe(true);
    const pause = await page.evaluate(()=>(window as any).__pauseProbe);
    expect(pause.first).toBe(pause.second);
    await expect.poll(()=>state(page,0)).toBeGreaterThan(pause.tic);

    const box=await page.locator('.move-stick').boundingBox();
    await page.mouse.move(box!.x+box!.width/2,box!.y+10); await page.mouse.down();
    await expect.poll(()=>state(page,6)).toBeGreaterThan(0);
    await page.mouse.up(); await expect.poll(()=>state(page,6)).toBe(0);
    await page.keyboard.down('KeyW');
    const fire=await page.locator('[data-hold="fire"]').boundingBox(); const ammo=await state(page,11);
    await page.mouse.move(fire!.x+fire!.width/2,fire!.y+fire!.height/2); await page.mouse.down();
    await expect.poll(()=>state(page,11)).toBeLessThan(ammo);
    await page.mouse.up(); await page.keyboard.up('KeyW');
    await expect.poll(()=>state(page,6)).toBe(0);
    await page.screenshot({path:info.outputPath('modern-mobile-landscape.png')});
    await page.locator('[data-key="188"]').tap();
    await expect(page.locator('.touch-menu')).toBeVisible();
    await page.locator('.touch-menu [data-command="13"]').tap();
    await expect(page.locator('.touch-name')).toBeVisible();
    await page.getByRole('textbox',{name:'Nome do save'}).fill('MOBILE7');
    await page.getByRole('button',{name:'Salvar nome',exact:true}).tap();
    await expect(page.locator('.touch-name')).toBeHidden({timeout:15000});
    await expect(page.locator('#status')).toHaveText('Save persistido em IndexedDB.',{timeout:20000});
    await page.keyboard.press('KeyH');
    await expect(page.locator('#shell')).toBeVisible();
    await page.locator('#settings').focus(); await expect(page.locator('#settings')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#panel h2')).toHaveText('Configurações');
    await expect(page.locator('[data-setting="resolution"]')).toHaveValue('modern');
    await page.getByRole('button',{name:'Voltar',exact:true}).tap();
    await page.locator('#play').tap(); await expect(page.locator('#touchControls')).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    await expect(page.locator('#rotatePrompt')).toBeVisible();
    const tic=await state(page,0);await page.waitForTimeout(100);expect(await state(page,0)).toBe(tic);
  });
});
