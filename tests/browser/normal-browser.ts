import {test as base} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export {expect} from '@playwright/test';
export type {Page} from '@playwright/test';

/** Chromium uses a fresh normal disk profile: its off-the-record backend rejected
 * the former monolithic package. WPE WebKit's persistent-context CacheStorage
 * silently drops even cache.put(new Response('hello')), independent of this app.
 * Its standard isolated context passes the identical API probe. That runner can
 * prove reload/offline within one context, not persistence across browser processes.
 * Never access a personal browser profile. */
export const test=base.extend({
 context:async({playwright,browserName,baseURL,viewport,headless,launchOptions},use)=>{
  if(browserName==='webkit'){
   const browser=await playwright.webkit.launch({...launchOptions,headless});
   const context=await browser.newContext({baseURL,viewport:viewport??undefined,acceptDownloads:true});
   try{await use(context);}finally{try{await context.close();}finally{await browser.close();}}
   return;
  }
  const profile=await mkdtemp(join(tmpdir(),'doom-browser-normal-'));
  const context=await playwright[browserName].launchPersistentContext(profile,{
   ...launchOptions,headless,baseURL,viewport:viewport??undefined,acceptDownloads:true,
  });
  try{await use(context);}finally{try{await context.close();}finally{await rm(profile,{recursive:true,force:true});}}
 },
 page:async({context},use)=>{const page=context.pages()[0]??await context.newPage();await page.bringToFront();await use(page);}
});
