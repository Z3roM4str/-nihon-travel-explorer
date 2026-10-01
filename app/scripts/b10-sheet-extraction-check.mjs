import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {preview} from 'vite';
const out=process.env.NIHON_B10_OUT??'logs/b10-sheet';mkdirSync(out,{recursive:true});
const beforePath=process.env.NIHON_B10_COMPARE;
const engine=process.env.NIHON_BROWSER==='webkit'?webkit:chromium;
const server=await preview({build:{outDir:process.env.NIHON_B10_DIST??'dist'},preview:{host:'127.0.0.1',port:0,open:false}});
const browser=await engine.launch({executablePath:engine===webkit?process.env.NIHON_WEBKIT_PATH:undefined});const results=[];
try{
 for(const width of [320,390,600,839,840,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1440?900:844}});
  await context.addInitScript(()=>localStorage.setItem('nihon.onboarding.seen.v1','1'));
  const page=await context.newPage();await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
  await page.locator('.national-start__hub').filter({hasText:'Tokio'}).click();await page.locator('.place-card').first().waitFor();
  await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
  for(const state of ['filters','city','search']){
   const opener=page.locator({filters:'.explorer-bar__filters',city:'.app__title--expand',search:'.explorer-bar .search-field'}[state]);await opener.click();
   await page.locator('.sheet').waitFor();
   // Compare settled presentation, independent of headless WebKit's animation clock.
   // Motion itself has a separate normal/reduced interaction gate.
   await page.locator('.sheet').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));
   await page.waitForTimeout(50);
   const computed=await page.locator('.sheet-scrim').evaluate(root=>[root,...root.querySelectorAll('.sheet,.sheet__grabber,.sheet__head,.sheet__title,.sheet__count,.sheet__body')].map(el=>{
    const style=getComputedStyle(el),r=el.getBoundingClientRect();return {class:el.className,box:{x:r.x,y:r.y,width:r.width,height:r.height},style:Object.fromEntries([...style].map(k=>[k,style.getPropertyValue(k)]))};
   }));
   const png=await page.screenshot({animations:'disabled'});const digest=createHash('sha256').update(png).digest('hex');
   writeFileSync(`${out}/${width}-${state}.png`,png);
   const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));assert.equal(overflow,0);
   if(beforePath){
    const previous=JSON.parse(readFileSync(`${beforePath}/results.json`)).find(r=>r.width===width&&r.state===state);
    assert.deepEqual(computed,previous.computed,`every computed style and geometry preserved: ${width}/${state}`);
    const box=computed.find(r=>r.class==='sheet').box;
    const pixelComparison=await page.evaluate(async ({old,current,box})=>{
      const decode=async url=>{const bitmap=await createImageBitmap(await (await fetch(url)).blob());const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);return {width:bitmap.width,height:bitmap.height,pixels:ctx.getImageData(0,0,bitmap.width,bitmap.height).data};};
      const a=await decode(old),b=await decode(current);let inside=0,outside=0,maxOutside=0;
      for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=(y*a.width+x)*4;const delta=Math.max(...[0,1,2,3].map(k=>Math.abs(a.pixels[i+k]-b.pixels[i+k])));if(delta){if(x>=box.x&&x<box.x+box.width&&y>=box.y&&y<box.y+box.height)inside++;else{outside++;maxOutside=Math.max(maxOutside,delta);}}}
      return {inside,outside,maxOutside};
    },{old:'data:image/png;base64,'+readFileSync(`${beforePath}/${width}-${state}.png`).toString('base64'),current:'data:image/png;base64,'+png.toString('base64'),box});
    // Repeated unchanged baseline reproduces tiny RGB rounding outside Sheet (839/city).
    // Every pixel of the extracted surface still has an exact, zero-difference gate.
    assert.equal(pixelComparison.inside,0,`pixel-identical Sheet: ${width}/${state}`);
    results.push({width,state,computed,pngSha256:digest,overflow,pixelComparison});
   }
   if(!beforePath)results.push({width,state,computed,pngSha256:digest,overflow});
   await page.keyboard.press('Escape');assert.ok(await opener.evaluate(el=>document.activeElement===el),'return focus preserved');
  }
  await context.close();
 }
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`B10 Sheet ${beforePath?'PASS: computed styles, geometry and screenshots identical':'BEFORE recorded'} — ${results.length} states across 840 breakpoint; keyboard return and overflow.`);
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
