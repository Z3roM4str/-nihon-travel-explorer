import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {preview} from 'vite';
const out=process.env.NIHON_B10_OUT??'logs/b10-performance';mkdirSync(out,{recursive:true});
const server=await preview({build:{outDir:process.env.NIHON_B10_DIST??'dist'},preview:{host:'127.0.0.1',port:0,open:false}});
const browser=await chromium.launch();const results=[];
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
  await context.addInitScript(()=>localStorage.setItem('nihon.onboarding.seen.v1','1'));
  const page=await context.newPage();let requests=[];page.on('request',r=>requests.push(r.url()));
  for(const temperature of ['cold','warm']){
   await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
   const home=await page.evaluate(()=>({time:performance.now(),resources:performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>({path:new URL(r.name).pathname,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize,duration:r.duration}))}));
   requests=[];await page.locator('.national-start__hub').filter({hasText:'Tokio'}).click();
   await page.locator('.place-card').first().waitFor();await page.waitForLoadState('networkidle');
   const list=requests.filter(u=>u.includes('/images/places/'));
   assert.ok(list.every(u=>u.endsWith('-800w.webp')),'lists request identity card renditions only');
   assert.equal(requests.filter(u=>/OrderedSequenceBuilder.*\.js/.test(u)).length,0,'no new planner demand on hub navigation');
   const cards=await page.locator('.place-card').evaluateAll(els=>els.map(el=>({id:el.getAttribute('data-place-id'),image:el.querySelector('img')?.getAttribute('src')})));
   const listTime=await page.evaluate(()=>performance.now());
   requests=[];await page.locator('.place-card__open').first().click();
   await page.locator('.place-detail').waitFor();await page.waitForLoadState('networkidle');
   const detail={photos:requests.filter(u=>u.includes('/images/places/')),slides:await page.locator('.place-detail .gallery__slide').count()};
   results.push({width,temperature,home,listTime,listRequests:list.map(u=>new URL(u).pathname),cards,detail:{...detail,photos:detail.photos.map(u=>new URL(u).pathname)}});
  }
  await context.close();
 }
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log('B10 performance PASS: cold/warm 390/1440; local identity-only list requests and detail/gallery measurements. Timing samples are not a benchmark SLA.');
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
