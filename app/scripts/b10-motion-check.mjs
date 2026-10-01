import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {preview} from 'vite';
// B10: computed motion and real interaction; before records violations, after enforces §03.6.
const before=process.env.NIHON_B10_BEFORE==='1';
const out=process.env.NIHON_B10_OUT??'logs/b10-motion'; mkdirSync(out,{recursive:true});
const engine=process.env.NIHON_BROWSER==='webkit'?webkit:chromium;
const server=await preview({build:{outDir:process.env.NIHON_B10_DIST??'dist'},preview:{host:'127.0.0.1',port:0,open:false}});
const browser=await engine.launch({executablePath:process.env.NIHON_WEBKIT_PATH});
const results=[];
try{
 for(const reducedMotion of ['no-preference','reduce'])for(const width of [320,390,839,840,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1440?900:844},reducedMotion});
  await context.addInitScript(()=>localStorage.setItem('nihon.onboarding.seen.v1','1'));
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  const card=page.locator('.national-start__hub').filter({hasText:'Tokio'});
  const inspect=locator=>locator.evaluate(el=>{
   const s=getComputedStyle(el), r=el.getBoundingClientRect();
   return {transition:s.transitionProperty,duration:s.transitionDuration,animation:s.animationName,animationDuration:s.animationDuration,transform:s.transform,width:r.width,height:r.height};
  });
  const more=await inspect(page.locator('.explorer-home__more-card').first());
  const mapCard=await inspect(page.locator('.explorer-home__map-card'));
  await page.locator('.explorer-home__map-card').click();
  const national=await inspect(page.locator('.national__sheet'));
  await page.goto(server.resolvedUrls.local[0]);
  const home=await inspect(card);await card.hover();await page.waitForTimeout(250); const hover=await inspect(card);
  await card.click(); await page.locator('.place-card').first().waitFor();
  const save=page.locator('.place-card__save').first();
  const placeCard=await inspect(page.locator('.place-card').first());
  const saveControl=await inspect(save);
  await save.click();
  const mark=await save.locator('.place-card__save-icon').evaluate(el=>({style:getComputedStyle(el).animationName,frames:el.getAnimations().flatMap(a=>a.effect.getKeyframes().map(f=>({transform:f.transform,offset:f.offset})))}));
  const toast=await inspect(page.locator('.save-toast'));
  const media=await inspect(page.locator('.place-card__image').first());
  const filters=page.locator('.explorer-bar__filters'); await filters.click();
  const sheet=await inspect(page.locator('.sheet'));
  const summaries=await page.locator('.filter-group__summary').evaluateAll(els=>els.map(el=>({name:el.innerText,...{width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}})));
  const chevron=await inspect(page.locator('.filter-group__chevron').first());
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
  await page.keyboard.press('Escape');assert.ok(await filters.evaluate(el=>el===document.activeElement),'Escape returns focus to opener');
  await filters.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  assert.ok(await filters.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),'keyboard return remains visible');
  await page.locator('.tab-bar__item:visible, .nav-rail__item:visible').filter({hasText:'Nosotros'}).click();
  await page.getByRole('button',{name:'Ver de nuevo',exact:true}).click();
  const onboarding=await inspect(page.locator('.onboarding'));
  const primary=await inspect(page.locator('.onboarding .button--primary'));
  const primaryBox=await page.locator('.onboarding .button--primary').boundingBox();
  if(!before)assert.ok(primary.height>=48&&primaryBox.y+primaryBox.height<=844,'primary minimum and visible CTA');
  await page.keyboard.press('Escape');
  results.push({width,reducedMotion,home,hover,more,mapCard,national,placeCard,saveControl,toast,onboarding,primary,mark,media,sheet,summaries,chevron,overflow,errors});
  if(!before){
   assert.ok(summaries.every(r=>r.width>=44&&r.height>=44),'§03.7 target minimum');
   assert.ok(home.duration.split(',').every(x=>parseFloat(x)===0),'no animated card hover');
   for(const state of [more,mapCard,national,placeCard,saveControl,media])assert.ok(state.duration.split(',').every(x=>parseFloat(x)===0),'only named motion or instantaneous state');
   assert.equal(toast.animation,'none');assert.equal(onboarding.animation,'none');
   assert.ok(chevron.duration.split(',').every(x=>parseFloat(x)===0),'chevron state instantaneous');
   if(reducedMotion==='reduce'){
    assert.equal(sheet.animation,'none');assert.equal(mark.style,'none');assert.equal(mark.frames.length,0);
    assert.ok(media.duration.split(',').every(x=>parseFloat(x)===0));
   }else if(mark.frames.length){assert.deepEqual(mark.frames.map(f=>f.transform),['scale(1)','scale(1.18)','scale(1)']);}
  }
  assert.equal(overflow,0);assert.deepEqual(errors,[]);
  if([390,1440].includes(width)&&reducedMotion==='no-preference'){
   await page.locator('.tab-bar__item:visible, .nav-rail__item:visible').filter({hasText:'Explorar'}).click();
   await filters.click();await page.waitForTimeout(350);await page.screenshot({path:`${out}/${width}-filters.png`});
  }
  await context.close();
 }
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
 console.log(`B10 motion ${before?'BEFORE recorded':'PASS'}: ${results.length} states, Escape/keyboard return, targets, reduced motion and overflow.`);
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
