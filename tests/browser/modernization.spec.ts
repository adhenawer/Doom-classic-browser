import { test, expect } from '@playwright/test';
const state = (page: any, n: number) => page.evaluate((n: number) => window.doom._web_state(n), n);
async function configure(page: any) {
  await page.locator('#settings').press('Enter');
  await expect(page.locator('#panel h2')).toHaveText('Configurações');
}
async function save(page: any) {
  await page.getByRole('button', {name:'Salvar configurações', exact:true}).press('Enter');
  await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
  await page.keyboard.press('KeyV');
}
test('comfort input produces vanilla walk/run commands, releases keys and survives classic save/load', async ({page}) => {
  await page.goto('/'); await expect(page.locator('#play')).toBeEnabled();
  await configure(page);
  await page.locator('[data-preset="precision"]').press('Enter');
  await expect(page.locator('[data-setting="initial"]')).toHaveValue('35');
  await page.locator('[data-setting="alwaysRun"]').press('Enter');
  await expect(page.locator('[data-setting="alwaysRun"]')).toBeChecked();
  await page.locator('[data-setting="sfxVolume"]').fill('11');
  await page.locator('[data-setting="musicVolume"]').fill('0'); await save(page);
  await expect(page.locator('#profileSummary')).toContainText('Conforto');
  await page.reload(); await expect(page.locator('#profileSummary')).toContainText('Conforto');
  await page.locator('#play').press('Enter'); await expect(page.locator('#resume')).toBeVisible({timeout:60000});
  await page.keyboard.press('Enter');
  await expect.poll(()=>state(page,14)).toBe(1);
  await expect.poll(()=>state(page,15)).toBe(11); await expect.poll(()=>state(page,16)).toBe(0);
  await page.keyboard.down('KeyW'); await expect.poll(()=>state(page,6)).toBe(50);
  await page.keyboard.down('ShiftLeft'); await expect.poll(()=>state(page,6)).toBe(25);
  await page.keyboard.down('ArrowRight'); await expect.poll(()=>state(page,10)).toBe(150);
  await page.keyboard.up('ShiftLeft'); await expect.poll(()=>state(page,6)).toBe(50);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#resume')).toBeVisible();
  await page.keyboard.up('KeyW'); await page.keyboard.up('ArrowRight'); await page.keyboard.press('Enter');
  await expect.poll(()=>state(page,6)).toBe(0); await expect.poll(()=>state(page,10)).toBe(0);
  await page.keyboard.press('KeyK');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_text())).toBe(1);
  await page.keyboard.type('COMFORT'); await page.keyboard.press('Enter');
  await expect(page.locator('#status')).toHaveText('Save persistido em IndexedDB.');
  await page.keyboard.press('KeyH'); await configure(page);
  await page.getByRole('button',{name:'Restaurar experiência clássica'}).press('Enter');
  await expect(page.locator('[data-setting="alwaysRun"]')).not.toBeChecked();
  await page.keyboard.press('KeyV'); await page.locator('#load').press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(0);
  await expect.poll(()=>state(page,14)).toBe(0);
  await page.keyboard.down('KeyW'); await expect.poll(()=>state(page,6)).toBe(25); await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyJ'); await page.keyboard.down('KeyW');
  await page.keyboard.press('KeyP'); await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_menu())).toBe(1);
  await page.keyboard.up('KeyJ'); await page.keyboard.up('KeyW'); await page.keyboard.press('KeyV');
  await expect.poll(()=>state(page,6)).toBe(0);
});
test('launcher fits desktop and narrow browser; presets preserve remapping and legacy settings migrate', async ({page}) => {
  await page.goto('/'); await expect(page.locator('#play')).toBeEnabled();
  await page.evaluate(async()=>{
    const d:IDBDatabase=await new Promise((resolve,reject)=>{const r=indexedDB.open('doom-ipad-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const bindings={forward:['KeyW','ArrowUp'],backward:['KeyS','ArrowDown'],strafeLeft:['KeyA'],strafeRight:['KeyD'],turnLeft:['ArrowLeft'],turnRight:['ArrowRight'],fire:['KeyZ'],run:['ShiftLeft','ShiftRight'],use:['Space','KeyE'],next:['KeyQ'],previous:['KeyR'],map:['Tab','KeyM'],menu:['Escape','KeyP'],back:['Backspace','KeyV'],save:['F2','KeyK'],load:['F3','KeyL'],shell:['F10','KeyH']};
    await new Promise<void>((resolve,reject)=>{const t=d.transaction('data','readwrite');t.objectStore('data').put({initial:75,acceleration:360,maximum:180,sensitivity:1,deceleration:0,bindings},'settings');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)});d.close();
  });
  await page.reload(); await expect(page.locator('#play')).toBeFocused(); await configure(page);
  await expect(page.locator('[data-setting="initial"]')).toHaveValue('75');
  await expect(page.locator('[data-setting="alwaysRun"]')).not.toBeChecked();
  await expect(page.locator('[data-setting="musicVolume"]')).toHaveValue('6');
  await page.locator('[data-preset="responsive"]').press('Enter');
  await expect(page.locator('[data-setting="maximum"]')).toHaveValue('240');
  await page.keyboard.press('KeyV'); await page.locator('#controls').press('Enter');
  await expect(page.locator('[data-action="fire"]')).toHaveText('Atirar: Z');
  await page.keyboard.press('KeyV');
  for(const size of [{width:1180,height:820},{width:390,height:844}]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await expect(page.locator('#play')).toBeFocused();
    await page.keyboard.press('ArrowDown'); await expect(page.locator('#content')).toBeFocused();
    await page.keyboard.press('ArrowUp');
  }
});

test('audio suspends with the game; independent music mute is exact without muting gunshots', async ({page}) => {
  await page.goto('/'); await expect(page.locator('#play')).toBeEnabled();
  await configure(page); await page.locator('[data-setting="musicVolume"]').fill('0'); await save(page);
  await page.locator('#play').press('Enter'); await expect(page.locator('#resume')).toBeVisible({timeout:60000});
  const audioState=()=>page.evaluate(()=>(window as any).doom.SDL2.audioContext.state);
  await expect.poll(audioState).toBe('suspended');
  await page.keyboard.press('Enter'); await expect.poll(audioState).toBe('running');
  await page.evaluate(()=>{
    const node=(window as any).doom.SDL2.audio.scriptProcessorNode, original=node.onaudioprocess;
    (window as any).__audioPeak=0;
    node.onaudioprocess=(e:AudioProcessingEvent)=>{original(e);for(let c=0;c<e.outputBuffer.numberOfChannels;c++)for(const v of e.outputBuffer.getChannelData(c))(window as any).__audioPeak=Math.max((window as any).__audioPeak,Math.abs(v));};
  });
  await page.waitForTimeout(1000); await page.evaluate(()=>(window as any).__audioPeak=0);
  await page.waitForTimeout(400); expect(await page.evaluate(()=>(window as any).__audioPeak)).toBe(0);
  await page.keyboard.down('KeyJ');
  await expect.poll(()=>page.evaluate(()=>(window as any).__audioPeak)).toBeGreaterThan(.001);
  await page.keyboard.up('KeyJ');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#resume')).toBeVisible(); await expect.poll(audioState).toBe('suspended');
  await page.keyboard.press('Enter'); await expect.poll(audioState).toBe('running');
  await page.keyboard.press('KeyH'); await configure(page);
  await page.locator('[data-setting="musicVolume"]').fill('6');
  await page.locator('[data-setting="sfxVolume"]').fill('0'); await save(page);
  await page.locator('#play').press('Enter'); await expect.poll(audioState).toBe('running');
  await page.evaluate(()=>(window as any).__audioPeak=0);
  await expect.poll(()=>page.evaluate(()=>(window as any).__audioPeak)).toBeGreaterThan(.001);
  await page.keyboard.press('KeyH'); await configure(page);
  await page.locator('[data-setting="alwaysRun"]').focus(); await page.keyboard.press('KeyV'); await expect(page.locator('#home')).toBeVisible();
  await configure(page); await page.locator('[data-setting="presentation"]').focus(); await page.keyboard.press('Backspace'); await expect(page.locator('#home')).toBeVisible();
});
