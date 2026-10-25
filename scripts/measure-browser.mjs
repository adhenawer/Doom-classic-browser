// SPDX-License-Identifier: GPL-2.0-or-later
// Run after build and outside other tests. Measures this cloud browser only.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const origin = process.argv[2] ?? 'http://127.0.0.1:4173/';
const output = process.argv[3] ?? 'build/modern-benchmark';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({headless:true});
const results = [];
try {
  for (const mode of ['sharp','crt']) {
    const context = await browser.newContext({viewport:{width:1180,height:820}});
    const page = await context.newPage();
    for (const warmth of ['cold','warm']) {
      const start = performance.now();
      await page.goto(origin); await page.locator('#play:not(:disabled)').waitFor();
      const shellMs = performance.now()-start;
      if (mode==='sharp' && warmth==='cold') await page.screenshot({path:`${output}/after-launcher.png`});
      if (mode==='crt' && warmth==='cold') {
        await page.locator('#settings').press('Enter');
        await page.locator('[data-setting="presentation"]').selectOption(mode);
        await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
        await page.keyboard.press('KeyV');
      }
      const engineStart=performance.now();
      await page.locator('#play').press('Enter');
      await page.locator('#resume:not([hidden])').waitFor({timeout:60000});
      const bootMs=performance.now()-engineStart;
      await page.keyboard.press('Enter');
      const cadence=await page.evaluate(()=>new Promise(resolve=>{
        const a=[];let last=performance.now();const tasks=[];
        let observer;
        try { observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'}); } catch {}
        function frame(now){a.push(now-last);last=now;if(a.length<180)requestAnimationFrame(frame);else{
          observer?.disconnect();a.sort((a,b)=>a-b);
          resolve({samples:a.length,rafMedianMs:a[90],rafP95Ms:a[171],rafP99Ms:a[178],longTasks:tasks.length,longestTaskMs:tasks.length?Math.max(...tasks):0});
        }}requestAnimationFrame(frame);
      }));
      const diagnostics=await page.evaluate(()=>window.doomPresentation.diagnostics());
      // Freeze the engine without the resume overlay; a screenshot is not an FPS measurement.
      await page.evaluate(()=>window.doom._web_suspend(1));
      if(warmth==='cold')await page.screenshot({path:`${output}/after-level-${mode}.png`});
      results.push({mode,warmth,shellMs,bootMs,...cadence,presentation:diagnostics});
    }
    await context.close();
  }
  const files=JSON.parse(await readFile('dist/offline-index.json','utf8'));
  const sizes=await Promise.all(files.resources.map(async p=>(await readFile('dist/'+p.replace(/^\.\//,''))).byteLength));
  const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()?'modified':'clean',browser:browser.version(),viewport:{width:1180,height:820},iwadSHA256:createHash('sha256').update(await readFile('web/generated/freedoom1.wad')).digest('hex'),scene:'Freedoom 0.13 E1M1 spawn, no input for 180 requestAnimationFrame callbacks',artifactVersion:files.version,runtimeHashes:Object.fromEntries(Object.entries(files.hashes).filter(([name])=>name==='chocolate-doom.wasm'||name.endsWith('.js')||name.endsWith('.css'))),resources:files.resources.length,runtimeBytes:sizes.reduce((a,b)=>a+b,0),results,limitations:['Two samples per mode in headless Linux; not sustained target-device performance','rAF cadence is browser scheduling, not engine render FPS','renderMs is CPU/API upload and submission cost, not GPU time','No physical input, Bluetooth latency, device memory, listening quality or energy measurement','Cold CRT shader compilation happens before this cadence window; bootMs includes startup but does not isolate shader cost']};
  await writeFile(`${output}/after.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
