// SPDX-License-Identifier: GPL-2.0-or-later
// Actual rendered-scene evidence; run alone against a production preview.
import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const url=process.argv[2]??'http://127.0.0.1:4173/', output=process.argv[3]??'build/modern-evidence';
await mkdir(output,{recursive:true});
const results=[],profiles=[];let currentContext,browserVersion='';
const git=(...args)=>execFileSync('git',['-c','safe.directory='+process.cwd(),...args],{encoding:'utf8'}).trim();
const cases=process.env.MODERN_4K_ONLY?[{name:'modern-3840',size:'3840',hd:true}]:[
 {name:'modern-original-materials',size:'1920',hd:false},
 {name:'modern-hd-materials',size:'1920',hd:true},
 {name:'modern-3840',size:'3840',hd:true}
];
try{
 for(const item of cases){
  console.error('Measuring',item.name);
  const profile=await mkdtemp(join(tmpdir(),'doom-modern-measure-'));profiles.push(profile);
  const context=currentContext=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1180,height:820}}),page=context.pages()[0]??await context.newPage(),errors=[];
  browserVersion=context.browser()?.version()??'unknown';await page.bringToFront();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').press('Enter');
  await page.locator('[data-setting="resolution"]').selectOption('modern');
  await page.locator('[data-setting="modernSize"]').selectOption(item.size);
  await page.locator('[data-setting="modernHD"]').setChecked(item.hd);
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
  await expect(page.locator('#status')).toHaveText('Configurações armazenadas neste navegador.');
  await page.keyboard.press('KeyV');const started=performance.now();
  await page.locator('#play').press('Enter');await expect(page.locator('#resume')).toBeVisible({timeout:120000});
  const bootMs=performance.now()-started;
  await page.evaluate(()=>{
   const presentation=window.doomPresentation,frame=presentation.frame.bind(presentation);window.__frozen=0;
   presentation.frame=()=>{frame();const tic=window.doom._web_state(0);if(!window.__frozen&&tic>=105){window.doom._web_suspend(1);window.__frozen=tic;}};
  });
  await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.__frozen),{timeout:60000}).toBeGreaterThan(0);
  const state=await page.evaluate(()=>{
   const s=n=>window.doom._web_state(n),c=document.querySelector('#canvas'),gl=c.getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
   return {tic:window.__frozen,position:[s(2),s(3),s(4)],width:s(17),height:s(18),backend:s(19),view:[s(20),s(21)],optionalRules:s(22),hdRegistered:s(23),hdUploads:s(24),hdDecodedMaxWidth:s(25),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],glVersion:gl.getParameter(gl.VERSION),renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
  });
  await page.screenshot({path:`${output}/${item.name}.png`});
  // Capture the retained native Canvas at 1:1 CSS pixels as well. Buffer size
  // was measured independently; a larger screenshot alone proves no resolution.
  await page.setViewportSize({width:state.width,height:state.height});
  await page.screenshot({path:`${output}/${item.name}-native.png`});
  await page.setViewportSize({width:1180,height:820});
  // A second pose exposes the large BASE2 wall without teleporting the player.
  await page.evaluate(()=>{
   const p=window.doomPresentation,frame=Object.getPrototypeOf(p).frame.bind(p);window.__rearFrozen=0;
   const turnEnd=window.doom._web_state(0)+40;let stopped=false;
   p.frame=()=>{frame();const tic=window.doom._web_state(0);if(!stopped&&tic>=turnEnd){window.doom._web_rotate(0,0);stopped=true;}
    if(!window.__rearFrozen&&tic>=turnEnd+3){window.doom._web_suspend(1);window.__rearFrozen=tic;}};
   window.doom._web_suspend(0);window.doom._web_rotate(0,1);
  });
  await expect.poll(()=>page.evaluate(()=>window.__rearFrozen),{timeout:60000}).toBeGreaterThan(0);
  const rearPose=await page.evaluate(()=>({tic:window.__rearFrozen,position:[2,3,4].map(n=>window.doom._web_state(n))}));
  await page.screenshot({path:`${output}/${item.name}-rear.png`});
  await page.evaluate(()=>{
   const p=window.doomPresentation;p.frame=Object.getPrototypeOf(p).frame.bind(p);window.__presentTimes=[];
   const frame=p.frame.bind(p);p.frame=()=>{window.__presentTimes.push(performance.now());frame();};window.doom._web_suspend(0);
  });
  const cadence=await page.evaluate(()=>new Promise(resolve=>{
   const times=[],tasks=[];let last=performance.now(),observer,done=false,raf=0,timer;
   try{observer=new PerformanceObserver(e=>tasks.push(...e.getEntries().map(v=>v.duration)));observer.observe({type:'longtask'});}catch{}
   const started=performance.now(),ticStart=window.doom._web_state(0);
   const stats=values=>{values.sort((a,b)=>a-b);return{samples:values.length,p50:values[Math.floor(values.length*.5)]??null,p95:values[Math.min(values.length-1,Math.ceil(values.length*.95)-1)]??null,p99:values[Math.min(values.length-1,Math.ceil(values.length*.99)-1)]??null};};
   function finish(reason){if(done)return;done=true;clearTimeout(timer);cancelAnimationFrame(raf);observer?.disconnect();
    const native=window.__presentTimes,delta=native.slice(1).map((v,i)=>v-native[i]);
    resolve({collectionStop:reason,elapsedMs:performance.now()-started,rafMs:stats(times),presentMs:stats(delta),logicalTics:window.doom._web_state(0)-ticStart,longTasks:tasks.length,longestTaskMs:tasks.length?Math.max(...tasks):0});
   }
   function frame(now){if(done)return;times.push(now-last);last=now;if(times.length>=120)finish('120 observations');else raf=requestAnimationFrame(frame);}
   timer=setTimeout(()=>finish('5 second observation window'),5000);raf=requestAnimationFrame(frame);
  }));
  const result={...item,bootMs,...state,rearPose,cadence,errors};results.push(result);
  await writeFile(`${output}/${item.name}.json`,JSON.stringify(result,null,2));
  console.error('Completed',item.name,JSON.stringify({drawingBuffer:state.drawingBuffer,renderer:state.renderer,hdUploads:state.hdUploads,cadence}));
  await context.close();currentContext=undefined;
 }
 const inventory=JSON.parse(await readFile('dist/offline-index.json','utf8'));
 let runtimeBytes=0;for(const name of inventory.resources)runtimeBytes+=(await stat('dist/'+name.slice(2))).size;
 const value={commit:git('rev-parse','HEAD'),workingTree:git('status','--porcelain')?'modified':'clean',browser:browserVersion,context:'Normal persistent profile; fresh per experiment',viewport:{width:1180,height:820},scene:'Freedoom 0.13 E1M1 spawn, skill3, modern overlay HUD, HQ2x2, smoothing1, mipmapping2; no input; frozen on present at tic>=105',engineSHA256:createHash('sha256').update(await readFile('web/generated/edge.wasm')).digest('hex'),artifact:inventory.version,runtimeBytes,resources:inventory.resources.length,results,limitations:['Headless Chromium on shared cloud Linux; not an iPad measurement','rAF and present callbacks are scheduling/submission observations, not GPU duration or physical FPS','Observation window stops at 120 rAF observations or a 5 second timer; timer delivery may itself be delayed by rendering; small samples do not support stable tail estimates','Cold launches have distinct browser contexts and cache conditions; no statistical performance comparison claimed','Configured WASM heap is not total memory; CPU/GPU memory, physical latency, energy and subjective audio quality not measured']};
 await writeFile(`${output}/measurement.json`,JSON.stringify(value,null,2));console.log(JSON.stringify(value,null,2));
}finally{await currentContext?.close();for(const profile of profiles)await rm(profile,{recursive:true,force:true});}
