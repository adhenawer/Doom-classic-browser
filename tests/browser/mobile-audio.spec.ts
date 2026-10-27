import {test,expect,type Page} from '@playwright/test';

const audioState=(page:Page)=>page.evaluate(()=>{const d=(window as any).doom;return(d.modernAudioContext??d.SDL2.audioContext).state;});
const state=(page:Page,index:number)=>page.evaluate(index=>(window as any).doom._web_state(index),index);
async function configure(page:Page,profile:string) {
  await page.goto('/');await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').tap();
  await page.locator('[data-setting="resolution"]').selectOption(profile);
  await page.locator('[data-setting="modernSize"]').selectOption('1280');
  await page.locator('[data-setting="modernHD"]').setChecked(false);
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).tap();
  await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
  await page.getByRole('button',{name:'Voltar',exact:true}).tap();
  await page.locator('#play').tap();
  await expect(page.locator('#resumeButton')).toBeVisible({timeout:120000});
}
async function nextMap(page:Page,modern:boolean) {
  for(const character of modern?'idcleve1m2':'idclev12') {
    await page.evaluate(character=>{const d=(window as any).doom,k=character.charCodeAt(0);d._web_key(k,1,k);d._web_key(k,0,k);},character);
    await page.waitForTimeout(45);
  }
  if(modern)await page.evaluate(()=>{const d=(window as any).doom;d._web_key(13,1,13);d._web_key(13,0,13);});
}

test.describe('mobile audio and fire placement',()=>{
  test.use({hasTouch:true,viewport:{width:844,height:390}});
  for(const profile of ['classic','high','modern'])test(`${profile}: touch restores real audio after a map, interruption and suspension without unlocking shell audio`,async({page},info)=>{
    test.setTimeout(180000);
    await configure(page,profile);
    await expect.poll(()=>audioState(page)).toBe('suspended');
    await page.locator('#resumeButton').tap();
    await expect.poll(()=>audioState(page)).toBe('running');
    await page.evaluate(()=>{
      const d=(window as any).doom,context=d.modernAudioContext??d.SDL2.audioContext;
      const node=d.modernAudioNode??d.SDL2.audio.scriptProcessorNode,process=node.onaudioprocess,resume=context.resume;
      const probe=(window as any).__mobileAudio={peak:0,resumes:0,trustedTouchEnds:0};
      document.addEventListener('touchend',event=>{if(event.isTrusted)probe.trustedTouchEnds++;},{passive:true});
      context.resume=function(...args:any[]){probe.resumes++;return Reflect.apply(resume,this,args);};
      node.onaudioprocess=function(event:AudioProcessingEvent){Reflect.apply(process,this,[event]);for(const value of event.outputBuffer.getChannelData(0))probe.peak=Math.max(probe.peak,Math.abs(value));};
    });
    await expect.poll(()=>page.evaluate(()=>(window as any).__mobileAudio.peak)).toBeGreaterThan(.001);
    // Suspend the actual Web Audio context while gameplay remains active. This
    // exercises recovery without claiming to emulate an iOS phone interruption.
    for(const selector of ['[data-hold="fire"]','.move-stick','.look-stick','[data-hold="use"]']) {
      await page.evaluate(async()=>{const d=(window as any).doom;await(d.modernAudioContext??d.SDL2.audioContext).suspend();(window as any).__mobileAudio.peak=0;});
      await expect.poll(()=>audioState(page)).toBe('suspended');
      await page.locator(selector).tap();
      await expect.poll(()=>audioState(page)).toBe('running');
      await expect.poll(()=>page.evaluate(()=>(window as any).__mobileAudio.peak)).toBeGreaterThan(.001);
    }
    expect(await page.evaluate(()=>(window as any).__mobileAudio.trustedTouchEnds)).toBeGreaterThan(0);
    await nextMap(page,profile==='modern');
    await expect(page.locator('#resumeButton')).toBeVisible({timeout:60000});
    expect(await state(page,34)).toBe(102);await expect.poll(()=>audioState(page)).toBe('suspended');
    await page.locator('#resumeButton').tap();await expect.poll(()=>audioState(page)).toBe('running');
    await page.setViewportSize({width:390,height:844});
    await expect(page.locator('#rotatePrompt')).toBeVisible();await expect.poll(()=>audioState(page)).toBe('suspended');
    await page.setViewportSize({width:844,height:390});
    await page.locator('#resumeButton').tap();await expect.poll(()=>audioState(page)).toBe('running');
    await page.locator('[data-command="shell"]').tap();await expect(page.locator('#shell')).toBeVisible();
    await expect.poll(()=>audioState(page)).toBe('suspended');
    await page.evaluate(()=>(window as any).__mobileAudio.resumes=0);
    await page.locator('#settings').tap();
    await page.getByRole('button',{name:'Voltar',exact:true}).tap();
    expect(await page.evaluate(()=>(window as any).__mobileAudio.resumes)).toBe(0);
    expect(await audioState(page)).toBe('suspended');
    await page.locator('#play').tap();await expect.poll(()=>audioState(page)).toBe('running');
    await info.attach('mobile-audio',{body:JSON.stringify(await page.evaluate(()=>(window as any).__mobileAudio)),contentType:'application/json'});
    await page.screenshot({path:info.outputPath(`${profile}-touch-audio.png`)});
  });

  test('fire stays on the left with a separate touch target above the movement stick',async({page},info)=>{
    await configure(page,'classic');await page.locator('#resumeButton').tap();
    for(const [width,height] of [[844,390],[667,375],[568,320],[1024,768]]) {
      await page.setViewportSize({width,height});
      const tic=await state(page,0);await expect.poll(()=>state(page,0)).toBeGreaterThan(tic+3);
      const fire=await page.locator('[data-hold="fire"]').boundingBox(),move=await page.locator('.move-stick').boundingBox();
      expect(fire).not.toBeNull();expect(move).not.toBeNull();
      expect(fire!.x).toBeGreaterThanOrEqual(0);expect(fire!.y).toBeGreaterThanOrEqual(0);
      expect(fire!.x+fire!.width).toBeLessThanOrEqual(width/2);
      expect(fire!.y+fire!.height).toBeLessThanOrEqual(move!.y);
      expect(fire!.width).toBeGreaterThanOrEqual(44);expect(fire!.height).toBeGreaterThanOrEqual(44);
      const target=await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('[data-hold="fire"]'),{x:fire!.x+fire!.width/2,y:fire!.y+fire!.height/2});
      expect(target).toBe(true);
      if(width===844)await page.screenshot({path:info.outputPath(`fire-left-${width}x${height}.png`)});
    }
  });
});
