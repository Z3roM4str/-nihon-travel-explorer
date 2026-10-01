import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {preview} from 'vite';
const before=process.env.NIHON_B10_BEFORE==='1';const out=process.env.NIHON_B10_OUT??'logs/b10-gallery';mkdirSync(out,{recursive:true});
const engine=process.env.NIHON_BROWSER==='webkit'?webkit:chromium;
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});const browser=await engine.launch({executablePath:engine===webkit?process.env.NIHON_WEBKIT_PATH:undefined});const rows=[];
try{
 for(const reducedMotion of ['no-preference','reduce']){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion});
  await context.addInitScript(()=>{
   localStorage.setItem('nihon.onboarding.seen.v1','1');
   const original=Element.prototype.scrollTo;window.__b10ScrollCalls=[];
   Element.prototype.scrollTo=function(...args){if(this.classList.contains('gallery__track'))window.__b10ScrollCalls.push(args[0]);return original.apply(this,args);};
  });
  const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);await page.locator('.national-start__hub').filter({hasText:'Tokio'}).click();await page.locator('.place-card__open').first().click();await page.locator('.gallery__track').waitFor();
  const track=page.locator('.gallery__track');await track.focus();await page.keyboard.press('ArrowRight');
  const calls=await page.evaluate(()=>window.__b10ScrollCalls);assert.equal(calls.length,1,'keyboard gallery navigation remains explicit');
  const call=calls[0];if(!before)assert.equal(call.behavior,reducedMotion==='reduce'?'auto':'smooth');
  const credit=page.locator('.gallery__credits');await credit.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
  const focus=await credit.evaluate(el=>({visible:el.matches(':focus-visible'),outline:getComputedStyle(el).outlineColor}));
  const box=await credit.boundingBox();await page.mouse.click(box.x-4,box.y+box.height/2);
  const hit=await page.locator('.credits-sheet__list').isVisible();
  if(!before){assert.ok(hit,'44px pseudo area receives pointer outside the 32px visual circle');assert.ok(focus.visible);assert.equal(focus.outline,'rgb(255, 255, 255)');}
  const links=hit?await page.locator('.credits-sheet__list a').evaluateAll(els=>els.map(el=>({text:el.textContent,href:el.href,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))):[];
  if(!before)assert.ok(links.every(l=>l.width>=44&&l.height>=44),'credit links meet the floor');
  rows.push({reducedMotion,call,focus,box,hit,links});await context.close();
 }
 writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(`B10 gallery ${before?'BEFORE recorded':'PASS'}: normal/reduced keyboard scroll, real credits hit area, focus and links.`);
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
