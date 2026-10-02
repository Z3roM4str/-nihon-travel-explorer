import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
import {preview} from 'vite';

// Embedded Days uses destination-panel--scroll; the tall analysis-body must chain
// a real wheel gesture to it. No programmatic scroll or locator autoscroll is used.
const engine=process.env.NIHON_BROWSER==='webkit'?webkit:chromium;
const out=process.env.NIHON_B10_OUT??'/tmp/b10-embedded-scroll';mkdirSync(out,{recursive:true});
const server=await preview({root:fileURLToPath(new URL('..',import.meta.url)),preview:{host:'127.0.0.1',port:0}});
const browser=await engine.launch({executablePath:engine===webkit?process.env.NIHON_WEBKIT_PATH:process.env.NIHON_CHROMIUM_PATH});
const results=[];
try{
 for(const width of [320,390]){
  const height=width===320?568:844;
  const context=await browser.newContext({viewport:{width,height}});context.setDefaultTimeout(10000);
  await context.addInitScript(()=>localStorage.setItem('nihon.onboarding.seen.v1','1'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Viaje',exact:true}).click();await page.locator('.day-card').waitFor();
  await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  if(process.env.NIHON_SCROLL_MUTANT==='contained')await page.addStyleTag({content:'.analysis-dialog--embedded .analysis-body { overscroll-behavior-y: contain !important; }'});
  const owner=page.locator('.destination-panel--scroll:visible');
  const before=await owner.evaluate(el=>el.scrollTop),storeBefore=await page.evaluate(()=>JSON.stringify({...localStorage}));
  await page.mouse.move(width/2,height/2);await page.mouse.wheel(0,160);
  let waitFailure=null;
  try{await page.waitForFunction(previous=>document.querySelector('.destination-panel--scroll')?.scrollTop>previous,before);}
  catch(e){waitFailure=e.message;}
  const after=await owner.evaluate(el=>el.scrollTop),storeAfter=await page.evaluate(()=>JSON.stringify({...localStorage}));
  const row={width,before,after,unchanged:storeBefore===storeAfter,errors,waitFailure,mutant:process.env.NIHON_SCROLL_MUTANT??null};results.push(row);
  await page.screenshot({path:`${out}/${width}.png`});writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
  assert.ok(after>before,'real wheel over Days content must scroll its destination owner');
  assert.equal(storeBefore,storeAfter,'scroll must not mutate persisted data');assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
  await context.close();
 }
 console.log(`Embedded Days scroll PASS (${engine===webkit?'webkit':'chromium'}): 320/390, real wheel, unchanged persistence`);
}finally{await browser.close();await server.close();}
