// SPDX-License-Identifier: GPL-2.0-or-later
// Run with the production preview and no concurrent tests. Cloud-only evidence.
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const url=process.argv[2]??'http://127.0.0.1:4173/';
const output=process.argv[3]??'build/resolution-measurement';await mkdir(output,{recursive:true});
const b=await chromium.launch({headless:true});const results=[];
try{
 for(const resolution of ['classic','high']){
  const context=await b.newContext({viewport:{width:1180,height:820}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const warmth of ['cold','warm']){
   console.error('Measuring',resolution,warmth);
   const navigation=performance.now();await page.goto(url);await expect(page.locator('#play')).toBeEnabled();const shellMs=performance.now()-navigation;
   if(resolution==='high'&&warmth==='cold'){
    await page.locator('#settings').press('Enter');await page.locator('[data-setting="resolution"]').selectOption('high');
    await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
    await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
    await page.keyboard.press('KeyV');await expect(page.locator('#home')).toBeVisible();
   }
   const start=performance.now();await page.locator('#play').press('Enter');await expect(page.locator('#resume')).toBeVisible({timeout:60000});const bootMs=performance.now()-start;
   const dimensions=await page.evaluate(()=>({width:window.doom._web_state(17),height:window.doom._web_state(18),viewWidth:window.doom._web_state(20),viewHeight:window.doom._web_state(21),backend:window.doom._web_state(19),optionalRules:window.doom._web_state(22)}));
   // Freeze one actual renderer callback at the same logical tic before capture.
   await page.evaluate(()=>{
    const p=window.doomPresentation,frame=p.frame.bind(p);window.__frozen=0;
    p.frame=()=>{frame();const t=window.doom._web_state(0);if(!window.__frozen&&t>=35){window.doom._web_suspend(1);window.__frozen=t;}};
   });
   await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.__frozen)).toBeGreaterThan(0);
   const screenshotTic=await page.evaluate(()=>window.__frozen);
   if(warmth==='cold')await page.screenshot({path:`${output}/${resolution}.png`});
   await page.evaluate(()=>{
    // Replace the temporary freeze hook; retain the renderer's original method.
    const p=window.doomPresentation;
    p.frame=Object.getPrototypeOf(p).frame.bind(p);window.__presentTimes=[];
    const frame=p.frame.bind(p);p.frame=()=>{window.__presentTimes.push(performance.now());frame();};
    window.doom._web_audio();window.doom._web_suspend(0);
   });
   const cadence=await page.evaluate(()=>new Promise(resolve=>{
    const intervals=[],tasks=[];let last=performance.now(),observer;
    try{observer=new PerformanceObserver(entries=>tasks.push(...entries.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});}catch{}
    const ticStart=window.doom._web_state(0),start=performance.now();
    function tick(now){intervals.push(now-last);last=now;if(intervals.length<180)requestAnimationFrame(tick);else{
     observer?.disconnect();intervals.sort((a,b)=>a-b);
     const t=window.__presentTimes,delta=t.slice(1).map((v,i)=>v-t[i]).sort((a,b)=>a-b);
     resolve({samples:180,elapsedMs:performance.now()-start,rafMedianMs:intervals[90],rafP95Ms:intervals[171],rafP99Ms:intervals[178],sdlPresentCallbacks:t.length,sdlIntervalP95Ms:delta.length?delta[Math.min(delta.length-1,Math.ceil(delta.length*.95)-1)]:null,logicalTics:window.doom._web_state(0)-ticStart,longTasks:tasks.length,longestTaskMs:tasks.length?Math.max(...tasks):0});
    }}requestAnimationFrame(tick);
   }));
   await page.evaluate(()=>window.doom._web_suspend(1));
   results.push({resolution,warmth,shellMs,bootMs,dimensions,screenshotTic,...cadence,errors:[...errors]});
  }
  await context.close();
 }
 const inventory=JSON.parse(await readFile('dist/offline-index.json','utf8'));
 const sizes=await Promise.all(inventory.resources.map(async p=>(await readFile('dist/'+p.replace(/^\.\//,''))).byteLength));
 const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()?'modified':'clean',browser:b.version(),viewport:{width:1180,height:820},iwadSHA256:createHash('sha256').update(await readFile('web/generated/freedoom1.wad')).digest('hex'),scene:'Freedoom 0.13 E1M1 spawn, skill3, sharp presentation; screenshots after renderer callback at tic>=35',artifact:inventory.version,runtimeBytes:sizes.reduce((a,b)=>a+b,0),resources:inventory.resources.length,engineHashes:{classic:inventory.hashes['chocolate-doom.wasm'],high:inventory.hashes['crispy-doom.wasm']},results,limitations:['Two samples per mode in headless Linux, not device performance certification','rAF cadence and SDL submission intervals are scheduling observations, not GPU timing or physical display FPS','Logical tics are observed over this short window; physical input/Bluetooth latency, RAM total and energy not measured','Classic-to-high source and physics are related but not asserted bit-identical; profiles and saves stay separate']};
 await writeFile(`${output}/resolution.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await b.close();}
