import {test,expect} from './normal-browser';
import {readFile} from 'node:fs/promises';

const hash='7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d';

test('E1M8 registers the complete HD catalogue but fetches and decodes only its original PNG dependencies',async({page},info)=>{
 test.setTimeout(180000);
 const index=JSON.parse(await readFile((process.env.QA_DIST??'dist')+'/content-index.json','utf8'));
 const wad=index.iwads[hash],map=wad.maps.E1M8;
 const images=map.hdAssets.map((id:string)=>index.hd.assets[id]);
 const required=[...wad.bootstrap.map((range:any)=>range.asset),...map.ranges.map((range:any)=>range.asset),...images];
 const allowed=new Set(required.flatMap((asset:any)=>asset.parts.map((part:any)=>part.file.replace(/^\.\//,''))));
 const requests:string[]=[],errors:string[]=[];
 page.on('request',request=>{const path=new URL(request.url()).pathname,at=path.indexOf('/content/');if(at>=0)requests.push(path.slice(at+1));});
 page.on('pageerror',error=>errors.push(error.message));
 // Test-only entry-point selection. All preparation, image decoding and drawing
 // still use the production host, native map barrier and renderer.
 await page.addInitScript(()=>{
  let value:any;
  Object.defineProperty(window,'createDoomModern',{configurable:true,get:()=>value,set:(factory:any)=>{
   value=async(options:any)=>{
    const module=await factory(options),call=module.callMain.bind(module);
    module.callMain=(args:string[])=>{const next=[...args],at=next.indexOf('-warp');if(at<0)throw new Error('Missing native warp argument');next[at+1]='E1M8';call(next);};
    return module;
   };
  }});
 });
 await page.goto('/');await expect(page.locator('#play')).toBeEnabled();
 await page.locator('#settings').press('Enter');
 await page.locator('[data-setting="resolution"]').selectOption('modern');
 await page.locator('[data-setting="modernSize"]').selectOption('1280');
 await page.locator('[data-setting="modernHD"]').setChecked(true);
 await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
      await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
      await page.getByRole('button',{name:'Voltar',exact:true}).press('Enter');
      await expect(page.locator('#home')).toBeVisible();
 await page.locator('#play').press('Enter');
 await expect(page.locator('#resume')).toBeVisible({timeout:120000});
 await expect(page.locator('#loadingScreen')).toBeHidden();
 await expect(page.locator('#offline')).toContainText('E1M8 disponível offline');
 const state=await page.evaluate(()=>{const d=(window as any).doom;return {map:d._web_state(34),registered:d._web_state(23),uploaded:d._web_state(24),maxWidth:d._web_state(25),worldReady:d._web_state(33)};});
 expect(state.map).toBe(108);expect(state.registered).toBe(1115);expect(state.uploaded).toBeGreaterThan(0);expect(state.worldReady).toBe(1);
 expect(requests.length).toBeGreaterThan(0);expect(requests.every(path=>allowed.has(path))).toBe(true);
 expect(new Set(requests).size).toBe(requests.length);
 const actual=await page.evaluate(async images=>{
  const fs=(window as any).doom.FS,result:Record<string,string>={};
  for(const image of images){const bytes=fs.readFile('/lazy-hd/'+image.path);result[image.path]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
  return result;
 },images.map((asset:any)=>({path:asset.path})));
 for(const image of images)expect(actual[image.path]).toBe(image.sha256);
 // These original 4K images are not E1M8 dependencies; metadata-only nodes may
 // exist but their bytes must not have been transferred or decoded.
 expect(map.hdAssets).not.toContain('BASE2');expect(map.hdAssets).not.toContain('FLAT1');
 expect(await page.evaluate(()=>{const fs=(window as any).doom.FS;return ['BASE2','FLAT1'].map(name=>fs.stat('/lazy-hd/hires/'+name+'.png').size);})).toEqual([0,0]);
 await page.locator('#resumeButton').press('Enter');
 await expect.poll(()=>page.evaluate(()=>(window as any).doom._web_state(0))).toBeGreaterThan(3);
 await page.screenshot({path:info.outputPath('e1m8-original-hd.png')});
 await info.attach('hd-map-evidence',{body:JSON.stringify({state,images:images.length,requests:requests.length,originalHashes:actual},null,2),contentType:'application/json'});
 expect(errors).toEqual([]);
});
