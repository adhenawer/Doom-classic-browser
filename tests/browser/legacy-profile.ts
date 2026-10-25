import {expect, type Page} from '@playwright/test';

/** Existing suites exercise the retained Classic backend deliberately. New installations
 * now start Modern; selecting Classic through the UI preserves that regression coverage. */
export async function selectClassic(page: Page) {
  await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').press('Enter');
  await page.locator('[data-setting="resolution"]').selectOption('classic');
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
  await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
  await page.keyboard.press('KeyV');
  await expect(page.locator('#play')).toBeFocused();
}
