import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {preview} from 'vite';
const out=process.env.NIHON_B10_OUT??'logs/b10-a11y-surfaces';mkdirSync(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});const browser=await chromium.launch();const rows=[];
try{
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1440?900:width===320?568:844}});
  await context.addInitScript(()=>{
   localStorage.setItem('nihon.onboarding.seen.v1','1');
   const ids=['JP-044','JP-203'];const boundary={start:{kind:'unselected'},end:{kind:'unselected'}};
   localStorage.setItem('nihon.manualPlanningDraft',JSON.stringify({version:8,routeIds:ids,days:ids.map((id,i)=>({id:`a11y-day-${i}`,placeIds:[id],accommodationBoundary:boundary})),startDate:'2027-02-22',endDate:'2027-02-23',visitStartTimes:{},accommodations:[],accommodationLegs:[],interHubSegments:[],zoneAccommodationChoices:[]}));
   localStorage.setItem('nihon.travellers.v1',JSON.stringify({version:1,travellers:[{id:'a11y-a',label:'Persona 1'},{id:'a11y-b',label:'Persona 2'}],activeTravellerId:'a11y-a',interests:ids.map(placeId=>({placeId,stances:[{travellerId:'a11y-a',stance:'interested'}],carriedOver:false}))}));
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.resolvedUrls.local[0]);
  const audit=async state=>{
   await page.waitForTimeout(350);
   const measurements=await page.evaluate(()=>{
    const visible=el=>el.checkVisibility({visibilityProperty:true,opacityProperty:true})&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&!el.closest('[hidden]');
    const scope=document.querySelector('.onboarding,.sheet-scrim')??document;
    const controls=[...scope.querySelectorAll('button,summary,input,select,textarea,a[href]')].filter(visible).map(el=>{
     const r=el.getBoundingClientRect(),s=getComputedStyle(el),after=getComputedStyle(el,'::after');
     let width=r.width,height=r.height;
     if(after.content!=='none'&&after.position==='absolute'&&after.pointerEvents!=='none'){width=Math.max(width,parseFloat(after.width)||0);height=Math.max(height,parseFloat(after.height)||0);}
     if(el.labels?.length){for(const label of el.labels){const box=label.getBoundingClientRect();width=Math.max(width,box.width);height=Math.max(height,box.height);}}
     return {tag:el.tagName,class:el.className,name:el.getAttribute('aria-label')||[...(el.labels??[])].map(l=>l.innerText).join(' ')||el.innerText||el.getAttribute('title')||'',width,height,disabled:el.disabled??false,primary:el.classList.contains('button--primary'),color:s.color,background:s.backgroundColor};
    });
    return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),controls,imagesWithoutAlt:[...document.images].filter(visible).filter(img=>!img.hasAttribute('alt')).map(img=>img.src)};
   });
   const unnamed={};for(const role of ['button','textbox','combobox'])unnamed[role]=await page.getByRole(role,{name:'',exact:true}).count();
   if(['us','credits','national-map','days','onboarding'].includes(state))await page.screenshot({path:`${out}/${width}-${state}.png`});
   rows.push({width,state,...measurements,unnamed});assert.equal(measurements.overflow,0,`${state}: reflow`);assert.deepEqual(measurements.imagesWithoutAlt,[]);
  };
  await audit('home');
  await page.locator('.explorer-home__map-card').click();await page.locator('.national__attribution-button').waitFor();await audit('national-map');
  await page.locator('.national__attribution-button').click();await audit('national-attribution');await page.keyboard.press('Escape');
  await page.goto(server.resolvedUrls.local[0]);await page.locator('.national-start__hub').filter({hasText:'Tokio'}).click();await page.locator('.place-card').first().waitFor();await audit('hub');
  if(await page.locator('.explorer-bar__pane').isVisible()){await page.locator('.explorer-bar__pane').click();await audit('hub-map');await page.locator('.explorer-bar__pane').click();}
  await page.locator('.place-card__open').first().click();await page.locator('.place-detail').waitFor();await audit('detail');
  await page.locator('.gallery__credits').click();await audit('credits');await page.keyboard.press('Escape');
  await page.locator('.place-sources__summary').click();await audit('detail-sources');
  await page.goto(server.resolvedUrls.local[0]);
  const nav=name=>page.locator('.tab-bar__item:visible,.nav-rail__item:visible').filter({hasText:name}).click();
  await nav('Quiero ir');await audit('want');await nav('Viaje');await page.locator('.viaje-nav').waitFor();await audit('days');
  for(const name of ['Dónde dormir','Reservas','Resumen']){await page.locator('.viaje-nav__item').filter({hasText:name}).click();await audit(name);}
  await nav('Nosotros');await audit('us');await page.getByRole('button',{name:'Ver de nuevo',exact:true}).click();await audit('onboarding');
  for(let step=1;step<=2;step++){await page.locator('.onboarding .button--primary').click();await audit('onboarding-'+step);}
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);await context.close();
 }
 writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));
 const issues=rows.flatMap(r=>r.controls.filter(c=>!c.disabled&&(c.width<43.5||c.height<(c.primary?47.5:43.5))).map(c=>({width:r.width,state:r.state,...c})));
 writeFileSync(`${out}/target-issues.json`,JSON.stringify(issues,null,2));
 assert.deepEqual(issues,[], 'effective targets meet the project 44/48px floors');
 assert.ok(rows.every(r=>Object.values(r.unnamed).every(n=>n===0)), 'all audited controls have accessible names');
 console.log(`B10 accessibility inventory: ${rows.length} states, no overflow/pageerrors/missing alt; ${issues.length} target observations for review. Accessible unnamed controls: ${rows.filter(r=>Object.values(r.unnamed).some(Boolean)).map(r=>r.width+'/'+r.state+':'+JSON.stringify(r.unnamed)).join('; ')||'none'}. DOM inventory is not physical screen-reader certification.`);
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
