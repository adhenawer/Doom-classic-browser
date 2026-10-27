import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {contentServer} from './content-server';
test.use({hasTouch:true,viewport:{width:390,height:844}});
test('touch startup shows pending download and failure beside Play',async({page})=>{
  test.setTimeout(120000);
  let failDownload: (()=>void) | undefined;
  let failedRequests=0;
  const index=JSON.parse(await readFile((process.env.QA_DIST??'dist')+'/content-index.json','utf8'));
  const wad=index.iwads['7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d'];
  const part=wad.bootstrap[0].asset.parts[0].file;
  const server=await contentServer('/startup-failure/',async(path,_request,response)=>{
    if(path!==part.replace(/^\.\//,''))return false;
    failedRequests++;
    await new Promise<void>(resolve=>{failDownload=resolve;});
    response.writeHead(503).end('Unavailable');return true;
  });
  try {
  await page.goto(server.url);
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#play').tap();
  await expect(page.locator('#play')).toHaveText('Carregando…');
  await expect(page.locator('#loadingScreen')).toBeVisible();
  await expect(page.locator('[data-loading=stage]')).toBeInViewport();
  await expect(page.locator('#launchStatus')).toContainText('Carregando');
  await expect.poll(()=>!!failDownload,{timeout:60000}).toBe(true);
  expect(failedRequests).toBe(1);
  failDownload!();
  await expect(page.locator('#launchStatus')).toContainText('Erro:');
  await expect(page.locator('[data-loading=stage]')).toContainText('Erro:');
  await page.locator('#loadingBack').tap();
  await expect(page.locator('#loadingScreen')).toBeHidden();
  await expect(page.locator('#play')).toBeEnabled();
  await expect(page.locator('#play')).toContainText('Jogar');
  } finally {failDownload?.();await server.close();}
});

test('HD loading shows byte progress and fits iPhone portrait and landscape',async({page},info)=>{
  const source=ts.transpileModule(await readFile('web/loading.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  await page.goto('/'); await expect(page.locator('#play')).toBeEnabled();
  // Exercise the actual loading component with a controlled transfer sample;
  // this visual fixture is not a measurement of the full HD package download.
  await page.evaluate(async source=>{
    const {LoadingScreen}=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(source))));
    const screen=new LoadingScreen(document.querySelector('#loadingScreen'));
    screen.begin(); screen.stage('Recebendo texturas HD · 4/12');
    screen.part('network',100000000,398681345)(20000000);
  },source);
  await expect(page.locator('[data-loading=amount]')).toContainText('30% · 120.0 / 398.7 MB');
  for(const [name,width,height] of [['portrait',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});
    await expect(page.locator('[data-loading=stage]')).toBeInViewport();
    await expect(page.locator('[data-loading=hint]')).toBeInViewport();
    await page.screenshot({path:info.outputPath(`loading-${name}.png`)});
  }
});
