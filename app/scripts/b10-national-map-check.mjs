import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {preview} from 'vite';
const before=process.env.NIHON_B10_BEFORE==='1';
const out=process.env.NIHON_B10_OUT??'logs/b10-national-map';mkdirSync(out,{recursive:true});
const server=await preview({build:{outDir:process.env.NIHON_B10_DIST??'dist'},preview:{host:'127.0.0.1',port:0}});
const engine=process.env.NIHON_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch(engine===webkit?{executablePath:process.env.NIHON_WEBKIT_PATH}:{});const rows=[];
try{for(const [width,height]of [[320,568],[390,844],[1440,900]]){
 const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(()=>localStorage.setItem('nihon.onboarding.seen.v1','1'));
 const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);const home=page.locator('.app__body--home'),opener=page.locator('.explorer-home__map-card');await opener.scrollIntoViewIfNeeded();await opener.focus();
 const start=await home.evaluate(el=>el.scrollTop);assert.ok(start>0,'map starts from the lower home section');const storage=await page.evaluate(()=>JSON.stringify(localStorage));await page.keyboard.press('Enter');await page.locator('.national__attribution-button').waitFor();
 const position=await page.locator('.app__body--national').evaluate(el=>({scrollTop:el.scrollTop,height:el.clientHeight}));await page.screenshot({path:`${out}/${width}-map.png`});
 const chip=page.getByRole('button',{name:'Ajustar panel a 75%',exact:true});await chip.scrollIntoViewIfNeeded();const box=await chip.boundingBox();await page.mouse.click(box.x+box.width/2,box.y-1);const expanded=await page.locator('.national__sheet--75').isVisible();if(!expanded)await chip.click();await page.locator('.national__sheet--75').waitFor();
 const backClear=await page.locator('.national__back-button').evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(hit===el||el.contains(hit));});
 await page.getByRole('button',{name:'Ajustar panel a 25%',exact:true}).click();await page.locator('.national__back-button').click();await opener.waitFor();const returned=await home.evaluate(el=>el.scrollTop);const focus=await opener.evaluate(el=>el===document.activeElement);
 const unchanged=await page.evaluate(prior=>JSON.stringify(localStorage)===prior,storage);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 rows.push({width,height,start,position,chipBox:box,expanded,backClear,returned,focus,unchanged,overflow});
 if(!before){assert.equal(position.scrollTop,0,'map visible before any automatic scrolling');assert.ok(expanded,'44px pseudo target receives pointer above the 40px chip');assert.ok(backClear,'75% panel does not occlude the back control on a short screen');assert.ok(Math.abs(start-returned)<1,'home returns to its exact scroll');assert.ok(focus,'keyboard opener regains focus');assert.ok(unchanged);assert.equal(overflow,0);}
 await context.close();
}writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(`B10 national map ${before?'BEFORE recorded':'PASS'}: 3 viewports; map scroll, 40/44px real hit, home position/focus and storage.`);}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
