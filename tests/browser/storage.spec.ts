import {test,expect} from './normal-browser';
import {selectClassic} from './legacy-profile';

const stored='Configurações armazenadas neste navegador.';

test('settings acknowledge only the latest committed write and survive reopening',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/');await selectClassic(page);
 await expect(page.locator('#status')).toHaveText(stored);
 await page.evaluate(()=>{
  const io=(window as any).__settingsIO={gates:{} as Record<string,{release:boolean;started:boolean;ended:boolean}>,writes:[] as {value:any;committed:boolean;aborted:boolean}[],openGate:undefined as any};
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
   const request=put.apply(this,args);
   if(this.name==='data'&&args[1]==='settings'){
    const record={value:structuredClone(args[0]),committed:false,aborted:false};io.writes.push(record);
    this.transaction.addEventListener('complete',()=>{record.committed=true;});
    this.transaction.addEventListener('abort',()=>{record.aborted=true;});
   }
   return request;
  };
  io.openGate=async(name:string,waitForStart:boolean)=>{
   const db:IDBDatabase=await new Promise((resolve,reject)=>{const r=indexedDB.open('doom-ipad-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const transaction=db.transaction('data','readwrite'),store=transaction.objectStore('data');
   const gate=io.gates[name]={release:false,started:false,ended:false};
   const started=new Promise<void>(resolve=>{
    const next=()=>{
     const request=store.get('__qa_settings_gate__');
     request.onsuccess=()=>{if(!gate.started){gate.started=true;resolve();}if(!gate.release)next();};
    };next();
   });
   transaction.addEventListener('complete',()=>{gate.ended=true;db.close();});
   transaction.addEventListener('abort',()=>{gate.ended=true;db.close();});
   if(waitForStart)await started;
  };
 });
 try{
  // Keep a real write transaction alive using queued requests, rather than sleeping.
  await page.evaluate(()=>(window as any).__settingsIO.openGate('first',true));
  await page.locator('#settings').press('Enter');
  await page.locator('[data-setting="initial"]').fill('95');
  await page.locator('[data-setting="musicVolume"]').fill('0');
  await page.locator('[data-setting="alwaysRun"]').press('Enter');
  await expect(page.locator('[data-setting="alwaysRun"]')).toBeChecked();
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).__settingsIO.writes.length)).toBe(1);
  expect(await page.evaluate(()=>(window as any).__settingsIO.writes[0].committed)).toBe(false);
  await expect(page.locator('#status')).not.toHaveText(stored);

  // This gate queues after write1 and before write2, exposing stale acknowledgements.
  await page.evaluate(()=>(window as any).__settingsIO.openGate('second',false));
  await page.locator('[data-setting="initial"]').fill('135');
  await page.locator('[data-setting="musicVolume"]').fill('11');
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).__settingsIO.writes.length)).toBe(2);
  await expect(page.locator('#status')).not.toHaveText(stored);
  await page.evaluate(()=>{(window as any).__settingsIO.gates.first.release=true;});
  await expect.poll(()=>page.evaluate(()=>{const io=(window as any).__settingsIO;return io.writes[0].committed&&io.gates.second.started;})).toBe(true);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  expect(await page.evaluate(()=>(window as any).__settingsIO.writes[1].committed)).toBe(false);
  await expect(page.locator('#status')).not.toHaveText(stored);
  await page.evaluate(()=>{(window as any).__settingsIO.gates.second.release=true;});
  await expect.poll(()=>page.evaluate(()=>(window as any).__settingsIO.writes[1].committed)).toBe(true);
  await expect(page.locator('#status')).toHaveText(stored);
  expect(await page.evaluate(()=>(window as any).__settingsIO.writes.map((w:any)=>({initial:w.value.initial,music:w.value.musicVolume,run:w.value.alwaysRun,aborted:w.aborted})))).toEqual([
   {initial:95,music:0,run:true,aborted:false},{initial:135,music:11,run:true,aborted:false}
  ]);
  expect(await page.evaluate(()=>!!(window as any).doom)).toBe(false);
  await page.reload();await expect(page.locator('#settings')).toBeEnabled();
  await page.locator('#settings').press('Enter');
  await expect(page.locator('[data-setting="initial"]')).toHaveValue('135');
  await expect(page.locator('[data-setting="musicVolume"]')).toHaveValue('11');
  await expect(page.locator('[data-setting="alwaysRun"]')).toBeChecked();
 }finally{
  await page.evaluate(()=>{const io=(window as any).__settingsIO;if(io)for(const gate of Object.values(io.gates)as any[])gate.release=true;}).catch(()=>{});
 }
});
