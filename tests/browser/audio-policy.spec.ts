import {test,expect,type Page} from './normal-browser';

const native=(page:Page,index:number)=>page.evaluate(index=>(window as any).doom._web_state(index),index);
const audioState=(page:Page)=>page.evaluate(()=>(window as any).doom.modernAudioContext.state);

test('native audio stays suspended in shell menus and active gameplay avoids redundant resume calls',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');await expect(page.locator('#settings')).toBeEnabled();
 await page.locator('#settings').press('Enter');
 await page.locator('[data-setting="resolution"]').selectOption('modern');
 await page.locator('[data-setting="modernSize"]').selectOption('1280');
 await page.locator('[data-setting="modernHD"]').setChecked(false);
 await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
 await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
 await page.getByRole('button',{name:'Voltar',exact:true}).press('Enter');
 await page.locator('#play').press('Enter');
 await expect(page.locator('#resume')).toBeVisible({timeout:120000});
 await page.keyboard.press('Enter');
 await expect.poll(()=>audioState(page)).toBe('running');
 expect([await native(page,17),await native(page,18),await native(page,19)]).toEqual([1280,960,2]);

 await page.keyboard.press('KeyH');
 await expect(page.locator('#shell')).toBeVisible();
 await expect.poll(()=>audioState(page)).toBe('suspended');
 await page.evaluate(()=>{
  const context=(window as any).doom.modernAudioContext,original=context.resume;
  (window as any).__audioPolicyResumeCalls=0;
  // Observe the real context without replacing it or modifying its promises.
  context.resume=function(...args:any[]){
   (window as any).__audioPolicyResumeCalls++;
   return Reflect.apply(original,this,args);
  };
 });
 // This is the first shell click after native audio initialization. Enter on a
 // button synthesizes a click, which must not unlock paused gameplay audio.
 await page.locator('#settings').press('Enter');
 await expect(page.locator('[data-setting="resolution"]')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__audioPolicyResumeCalls)).toBe(0);
 expect(await audioState(page)).toBe('suspended');

 await page.getByRole('button',{name:'Voltar',exact:true}).press('Enter');
 await page.locator('#play').press('Enter');
 await expect.poll(()=>audioState(page)).toBe('running');
 expect(await page.evaluate(()=>(window as any).__audioPolicyResumeCalls)).toBe(1);
 await page.evaluate(()=>{
  const runtime=(window as any).doom,node=runtime.modernAudioNode,original=node.onaudioprocess;
  (window as any).__audioPolicyResumeCalls=0;
  (window as any).__audioPolicyPcmPeak=0;
  node.onaudioprocess=function(event:AudioProcessingEvent){
   Reflect.apply(original,this,[event]);
   for(const sample of event.outputBuffer.getChannelData(0))
    (window as any).__audioPolicyPcmPeak=Math.max((window as any).__audioPolicyPcmPeak,Math.abs(sample));
  };
 });
 const ammo=await native(page,11);
 for(const key of ['KeyW','KeyD','ArrowRight','KeyJ'])await page.keyboard.down(key);
 await expect.poll(()=>native(page,6)).toBeGreaterThan(0);
 await expect.poll(()=>native(page,7)).toBeGreaterThan(0);
 await expect.poll(()=>native(page,10)).toBeGreaterThan(0);
 await expect.poll(()=>native(page,11)).toBeLessThan(ammo);
 await expect.poll(()=>page.evaluate(()=>(window as any).__audioPolicyPcmPeak)).toBeGreaterThan(.001);
 for(const key of ['KeyW','KeyD','ArrowRight','KeyJ'])await page.keyboard.up(key);
 await expect.poll(()=>native(page,6)).toBe(0);
 await expect.poll(()=>native(page,10)).toBe(0);
 for(const key of ['KeyS','KeyA','ArrowLeft'])await page.keyboard.down(key);
 await expect.poll(()=>native(page,6)).toBeLessThan(0);
 await expect.poll(()=>native(page,7)).toBeLessThan(0);
 await expect.poll(()=>native(page,8)).toBeLessThan(0); // EDGE subtracts this command: negative turns left.
 for(const key of ['KeyS','KeyA','ArrowLeft'])await page.keyboard.up(key);
 expect(await page.evaluate(()=>(window as any).__audioPolicyResumeCalls)).toBe(0);
 expect(await audioState(page)).toBe('running');
});
