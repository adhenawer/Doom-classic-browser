import {test, expect, type Page} from '@playwright/test';

const state = (page: Page, index: number) => page.evaluate(index => (window as any).doom._web_state(index), index);

// Observe the first real world-angle change, rather than a backend's command
// sign: Chocolate adds angleturn, while EDGE subtracts angle_turn.
async function checkDirection(page: Page, direction: 'left' | 'right', press: () => Promise<unknown>, release: () => Promise<unknown>) {
  await page.evaluate(() => {
    const runtime = (window as any).doom;
    const probe = (window as any).__turnDirection = {start: runtime._web_state(4), delta: 0, active: true};
    const sample = () => {
      if (!probe.active) return;
      // Signed modular BAM delta also handles crossing 0 / 2^32.
      probe.delta = (runtime._web_state(4) - probe.start) | 0;
      if (!probe.delta) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  try {
    await press();
    await expect.poll(() => page.evaluate(() => (window as any).__turnDirection.delta)).not.toBe(0);
    const delta = await page.evaluate(() => (window as any).__turnDirection.delta);
    expect(Math.sign(delta), `${direction}: actual world-angle delta ${delta}`).toBe(direction === 'left' ? 1 : -1);
  } finally {
    await release();
    await page.evaluate(() => { (window as any).__turnDirection.active = false; });
  }
  await expect.poll(() => state(page,8)).toBe(0);
  const tic = await state(page,0);
  await expect.poll(() => state(page,0)).toBeGreaterThan(tic + 2);
}

test.describe('world turn direction', () => {
  test.use({hasTouch: true, viewport: {width:844, height:390}});
  for (const profile of ['classic', 'high', 'modern']) {
    test(`${profile}: keyboard arrows and touch stick turn toward the requested side`, async ({page, browserName}) => {
      test.setTimeout(180000);
      await page.goto('/');
      await expect(page.locator('#settings')).toBeEnabled();
      await page.locator('#settings').tap();
      await page.locator('[data-setting="resolution"]').selectOption(profile);
      await page.locator('[data-setting="modernSize"]').selectOption('1280');
      await page.locator('[data-setting="modernHD"]').setChecked(false);
      await page.getByRole('button',{name:'Salvar configurações',exact:true}).tap();
      await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
      await page.getByRole('button',{name:'Voltar',exact:true}).tap();
      await page.locator('#play').tap();
      await expect(page.locator('#resumeButton')).toBeVisible({timeout:120000});
      await page.locator('#resumeButton').tap();
      await expect(page.locator('.look-stick')).toBeVisible();
      await expect.poll(() => state(page,1)).toBe(0);

      for (const direction of ['left', 'right'] as const) {
        const key = direction === 'left' ? 'ArrowLeft' : 'ArrowRight';
        await checkDirection(page, direction, () => page.keyboard.down(key), () => page.keyboard.up(key));
      }
      const stick = (await page.locator('.look-stick').boundingBox())!;
      const session = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
      for (const direction of ['left', 'right'] as const) {
        const x = stick.x + stick.width/2 + (direction === 'left' ? -30 : 30), y = stick.y + stick.height/2;
        await checkDirection(page, direction, async () => {
          if (session) await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});
          else { await page.mouse.move(x,y); await page.mouse.down(); }
        }, async () => {
          if (session) await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          else await page.mouse.up();
        });
      }
      await session?.detach();
    });
  }
});
