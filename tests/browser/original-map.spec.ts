import { test, expect } from './normal-browser';
import { selectClassic } from './legacy-profile';

test('original map selection persists, allows combat/traversal, and activates its exit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#play')).toBeEnabled();
  await selectClassic(page);
  await page.locator('#content').click();
  await page.getByRole('button', { name: 'Estação Aurora · mapa original', exact: true }).click();
  await expect(page.locator('#panel')).toContainText('✓ Estação Aurora.wad');
  await page.reload();
  await expect(page.locator('#selectedContent')).toHaveText('Estação Aurora.wad');
  await page.locator('#play').click();
  await expect(page.locator('#resume')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).doom._web_state(0))).toBeGreaterThan(3);
  await expect.poll(() => page.evaluate(() => (window as any).doom._web_state(1))).toBe(0);
  const initial = await page.evaluate(() => [(window as any).doom._web_state(2), (window as any).doom._web_state(3)]);
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => [(window as any).doom._web_state(2), (window as any).doom._web_state(3)])).not.toEqual(initial);
  await page.keyboard.down('KeyJ');
  // Walk east across Reception, Energy Core and Evacuation in real simulation.
  await expect.poll(() => page.evaluate(() => (window as any).doom._web_state(2) / 65536), { timeout: 30000 }).toBeGreaterThan(1470);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyJ');
  await expect.poll(() => page.evaluate(() => (window as any).doom._web_state(5))).toBeGreaterThan(0);
  // Hold use across simulation ticks; an instantaneous press need not span a tic.
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyE');
  await expect.poll(() => page.evaluate(() => (window as any).doom._web_state(1))).toBe(1);
});

test('corrupted original map is rejected without changing content selection', async ({ page }) => {
  await page.route('**/aurora.wad', route => route.fulfill({ body: Buffer.from('corrupt'), contentType: 'application/octet-stream' }));
  await page.goto('/');
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#content').click();
  await page.getByRole('button', { name: 'Estação Aurora · mapa original', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Mapa original corrompido');
  await expect(page.locator('#selectedContent')).toHaveText('Freedoom Phase 1');
  await page.reload();
  await expect(page.locator('#selectedContent')).toHaveText('Freedoom Phase 1');
});

test('optional map discovery times out without preventing Freedoom play', async ({ page }) => {
  await page.route('**/aurora.json', () => new Promise(() => {}));
  await page.goto('/');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 6000 });
  await expect(page.locator('#selectedContent')).toHaveText('Freedoom Phase 1');
});
