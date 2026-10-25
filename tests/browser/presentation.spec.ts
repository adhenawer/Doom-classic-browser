import { test, expect } from './normal-browser';
import {selectClassic} from './legacy-profile';

test.beforeEach(async ({page}) => { await page.goto('/'); await selectClassic(page); });

test('optional CRT presents real frames, preserves keyboard/focus and falls back on context loss', async ({page}, info) => {
  await page.goto('/');
  await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').press('Enter');
  await page.locator('[data-setting="presentation"]').selectOption('crt');
  await page.locator('[data-setting="brightness"]').fill('1.1');
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
  await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
  await page.reload();
  await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').press('Enter');
  await expect(page.locator('[data-setting="presentation"]')).toHaveValue('crt');
  await expect(page.locator('[data-setting="brightness"]')).toHaveValue('1.1');
  await page.keyboard.press('KeyV');
  await page.locator('#play').press('Enter');
  await expect(page.locator('#resume')).toBeVisible({timeout:60000});
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvas')).toBeFocused();
  const diagnostic = () => page.evaluate(() => (window as any).doomPresentation.diagnostics());
  const first = await diagnostic();
  if (first.active === 'crt') {
    // Read in the synchronous presentation callback, before WebGL discards a
    // non-preserved drawing buffer. This is a rendered DOOM frame, not a fixture.
    await page.evaluate(() => {
      const p = (window as any).doomPresentation, frame = p.frame.bind(p);
      (window as any).__crtPixels = 0;
      p.frame = () => {
        frame();
        if ((window as any).__crtPixels) return;
        const layer = document.querySelector<HTMLCanvasElement>('#presentation');
        const gl = layer?.getContext('webgl');
        if (!layer || !gl) return;
        const data = new Uint8Array(layer.width*layer.height*4);
        gl.readPixels(0,0,layer.width,layer.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
        for (let i=0;i<data.length;i+=4) if (data[i]+data[i+1]+data[i+2]>20) (window as any).__crtPixels++;
      };
    });
    await expect.poll(async () => (await diagnostic()).frames).toBeGreaterThan(20);
    await expect.poll(() => page.evaluate(() => (window as any).__crtPixels)).toBeGreaterThan(100);
    await expect(page.locator('#presentation')).toBeVisible();
    await expect(page.locator('#presentation')).toHaveAttribute('aria-hidden','true');
    await expect(page.locator('#canvas')).toHaveCSS('opacity','0');
  } else {
    expect(first.active).toBe('sharp');
    expect(first.message).toContain('indisponível');
    info.annotations.push({type:'CRT fallback',description:first.message});
    await expect(page.locator('#canvas')).not.toHaveCSS('opacity','0');
  }
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => (window as any).doom._web_state(6))).toBeGreaterThan(0);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#resume')).toBeVisible();
  await expect(page.locator('#resumeButton')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvas')).toBeFocused();
  await page.screenshot({path:info.outputPath('presentation-real-level.png')});
  await info.attach('presentation-diagnostics',{body:JSON.stringify(await diagnostic(),null,2),contentType:'application/json'});
  if ((await diagnostic()).active === 'crt') {
    await page.evaluate(() => {
      const layer=document.querySelector<HTMLCanvasElement>('#presentation')!;
      const extension=layer.getContext('webgl')!.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('Cannot validate actual WebGL context loss');
      extension.loseContext();
    });
    await expect.poll(async () => (await diagnostic()).active).toBe('sharp');
    await expect(page.locator('#presentation')).toHaveCount(0);
    await expect(page.locator('#canvas')).not.toHaveCSS('opacity','0');
    const tic=await page.evaluate(() => (window as any).doom._web_state(0));
    await expect.poll(() => page.evaluate(() => (window as any).doom._web_state(0))).toBeGreaterThan(tic);
  }
});
