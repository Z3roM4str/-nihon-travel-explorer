import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {chromium,webkit} from 'playwright';
import {preview} from 'vite';
const out=process.env.NIHON_B10_OUT??'/tmp/b10-map-boundary';mkdirSync(out,{recursive:true});
const engine=process.env.NIHON_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({executablePath:engine===webkit?process.env.NIHON_WEBKIT_PATH:process.env.NIHON_CHROMIUM_PATH});
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});const url=server.resolvedUrls.local[0];
const manifest=JSON.parse(readFileSync('dist/map-manifest.json'));const rows=[];
const closure=(key,acc=new Set())=>{if(acc.has(key))return acc;acc.add(key);for(const dep of manifest[key].imports??[])closure(dep,acc);return acc;};
const critical=closure('index.html');
const resources=Object.entries(manifest).map(([key,m])=>({key,file:m.file,critical:critical.has(key),raw:readFileSync('dist/'+m.file).length,gzip:gzipSync(readFileSync('dist/'+m.file),{level:9}).length}));
assert.ok(resources.filter(r=>r.critical).reduce((n,r)=>n+r.gzip,0)<=253742,'protect aggregate synchronous JS as well as unchanged entry gate');
const mapKey='src/components/map-runtime.ts';const leaf=resources.find(r=>r.key===mapKey);assert.ok(leaf&&!leaf.critical);
assert.deepEqual([...closure(mapKey)].filter(key=>!critical.has(key)),[mapKey],'the whole recoverable map graph is a single deferred asset');
const mapRequest=r=>r.includes('/'+leaf.file);
const nav=(p,name)=>p.locator('.tab-bar__item:visible,.nav-rail__item:visible').filter({hasText:name}).click();
async function fresh(width,motion){
 const context=await browser.newContext({viewport:{width,height:width===320?568:width===390?844:900},reducedMotion:motion});
 await context.addInitScript(()=>{localStorage.setItem('nihon.onboarding.seen.v1','1');});
 if(process.env.NIHON_B10_MAP_MUTANT==='eager')await context.addInitScript(file=>{
  document.addEventListener('DOMContentLoaded',()=>{const script=document.createElement('script');script.type='module';script.src=file;document.head.append(script);},{once:true});
 },url+leaf.file);
 const page=await context.newPage();const requests=[],failures=[],errors=[];
 page.on('request',r=>requests.push(r.url()));page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('.explorer-home').waitFor();await page.waitForTimeout(1700);
 assert.ok(!requests.some(mapRequest),'no map runtime or shared Leaflet from idle prefetch');
 return{page,context,requests,failures,errors};
}
const storage=p=>p.evaluate(()=>JSON.stringify(localStorage));
// Capture resting views only: flyTo and the subsequent chrome correction can overlap.
// The exact pane assertion remains; this also waits for stable geographic coordinates.
const settleMap=l=>l.evaluate(el=>new Promise((resolve,reject)=>{
 let previous='',stable=0,frames=0;
 const tick=()=>{const style=[...el.querySelectorAll('.leaflet-map-pane,.leaflet-tile-container,.leaflet-marker-icon')].map(node=>node.getAttribute('style')).join('|');stable=style===previous?stable+1:0;previous=style;
  if(stable>=15&&!el.classList.contains('leaflet-zoom-anim')&&!el.classList.contains('leaflet-pan-anim'))resolve();
  else if(++frames>300)reject(new Error('map never reaches rest'));else requestAnimationFrame(tick);};requestAnimationFrame(tick);
}));
const view=l=>l.evaluate(el=>{const tile=[...el.querySelectorAll('.leaflet-tile')].at(-1),r=el.getBoundingClientRect(),t=tile?.getBoundingClientRect(),m=tile?.src.match(/\/(\d+)\/(\d+)\/(\d+)\.png/);return m&&t?{z:+m[1],x:+m[2]*256+r.x+r.width/2-t.x,y:+m[3]*256+r.y+r.height/2-t.y}:null;});
const box=l=>l.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
async function openMap(page,kind,width){
 if(kind==='national'){await page.locator('.explorer-home__map-card').click();return page.locator('.national-map');}
 await page.locator('.explorer-home__city-card').filter({hasText:'Tokio'}).click();await page.locator('.place-card').first().waitFor();
 if(width<1200)await page.locator('.explorer-bar__pane').click();return page.locator('.place-map');
}
try{
 if(!process.env.NIHON_MAP_FAILURES_ONLY) {
 for(const width of [320,390,1440])for(const motion of ['no-preference','reduce'])for(const kind of ['national','place']){
  const {page,context,requests,errors}=await fresh(width,motion);
  if(kind==='place'&&width<1200){
   await page.locator('.explorer-home__city-card').filter({hasText:'Tokio'}).click();await page.locator('.place-card').first().waitFor();await page.waitForTimeout(250);
   assert.ok(!requests.some(mapRequest),'mobile list leaves map untouched');
  }
  const before=await storage(page);
  // Hold the real map entry; this checks visible feedback and its stable box on slow networks.
  let release;const hold=new Promise(resolve=>{release=resolve;});
  await page.route(`**/${leaf.file}*`,async r=>{await hold;await r.continue();});
  const map=kind==='place'&&width<1200?(await page.locator('.explorer-bar__pane').click(),page.locator('.place-map')):await openMap(page,kind,width);
  const feedback=kind==='national'?page.locator('.national__map-fallback'):page.locator('.map-loading');
  await feedback.waitFor();assert.ok((await feedback.innerText()).includes('Cargando el mapa'));assert.equal(await feedback.getAttribute('role'),'status');
  const loadingBox=await box(feedback);release();await map.waitFor({state:'visible'});await settleMap(map);const readyBox=await box(map);
  assert.deepEqual(readyBox,loadingBox,'loading keeps map dimensions and position');
  if(kind==='national')assert.equal(await map.locator('path.leaflet-interactive').count(),47);
  else assert.ok(await map.locator('.place-marker,.place-cluster').count()>0);
  const count=requests.filter(mapRequest).length;
  if(kind==='national'){
   await page.getByRole('button',{name:'Volver a la portada'}).click();assert.ok(await page.locator('.explorer-home__map-card').evaluate(el=>el===document.activeElement));
   await page.locator('.explorer-home__map-card').click();await page.locator('.national-map').waitFor();
  }else{
   await settleMap(map);
   const viewBefore=await view(map);
   const centerBefore=await map.locator('.leaflet-map-pane').getAttribute('style');
   if(width<1200){await page.locator('.explorer-bar__pane').click();await page.locator('.explorer-bar__pane').click();}
   await nav(page,'Nosotros');await nav(page,'Explorar');await map.waitFor({state:'visible'});await settleMap(map);
   assert.deepEqual(await view(map),viewBefore,'reopening preserves exact geographic center and zoom');
   assert.equal(await map.locator('.leaflet-map-pane').getAttribute('style'),centerBefore,'reopening preserves map position');
  }
  assert.equal(requests.filter(mapRequest).length,count,'warm reopen has no map refetch');
  assert.equal(await storage(page),before,'consulting maps does not persist');assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/${kind}-${width}-${motion}.png`});rows.push({kind,width,motion,loadingBox,readyBox,requests,errors});writeFileSync(`${out}/partial-results.json`,JSON.stringify({resources,rows},null,2));console.log(`${kind} ${width} ${motion} PASS`);await context.close();
 }
 }
 for(const kind of ['national','place'])for(const fault of ['entry','repeated','manifest','geometry']){
  if(fault==='geometry'&&kind!=='national')continue;
  const {page,context,requests,errors,failures}=await fresh(390,'reduce');const before=await storage(page);
  const pattern=fault==='geometry'?'**/japan-prefectures.geojson':`**/${leaf.file}*`;
  let failed=0;await page.route(pattern,r=>{if(failed++<(fault==='repeated'?2:1))return r.fulfill({status:404,contentType:'text/plain',body:'B10 expected loading failure'});return r.continue();});
  const map=await openMap(page,kind,390);const feedback=kind==='national'?page.locator('.national__map-fallback'):page.locator('.map-loading');
  await feedback.getByText(/No se pudo cargar el mapa/).waitFor();assert.ok(!await map.count(),'failed module leaves app alive');
  const consoleMessages=[];page.on('console',m=>consoleMessages.push({type:m.type(),text:m.text()}));const responses=[];page.on('response',r=>responses.push({url:r.url(),status:r.status()}));
  const retry=feedback.getByRole('button',{name:'Reintentar',exact:true});
  if(fault==='manifest'){let manifestFailures=0;await page.route('**/map-manifest.json',r=>manifestFailures++===0?r.fulfill({status:503,body:'Manifest unavailable'}):r.continue());}
  await retry.focus();await retry.press('Enter');
  if(fault==='repeated'||fault==='manifest'){
   await feedback.getByText(/No se pudo cargar el mapa/).waitFor();assert.deepEqual(errors,[]);await retry.focus();await retry.press('Enter');
  }
  await map.waitFor({state:'visible'}).catch(async error=>{writeFileSync(`${out}/${kind}-${fault}-failure.json`,JSON.stringify({kind,fault,requests,failures,errors,responses,consoleMessages,feedback:await feedback.innerText()},null,2));await page.screenshot({path:`${out}/${kind}-${fault}-failure.png`});throw error;});
  assert.ok(await map.evaluate(el=>el===document.activeElement),'retry restores focus on the loaded map');assert.equal(await storage(page),before);
  assert.deepEqual(errors,[],'handled fetch failures must not escape into React');
  if(fault!=='geometry'){
   const recoveredCount=requests.filter(mapRequest).length;
   if(kind==='national'){await page.getByRole('button',{name:'Volver a la portada'}).click();await openMap(page,'place',390);await page.locator('.place-map').waitFor();}
   else {await page.locator('.app__title--expand').click();await page.getByRole('button',{name:'Ver todo Japón'}).click();await openMap(page,'national',390);await page.locator('.national-map').waitFor();}
   assert.equal(requests.filter(mapRequest).length,recoveredCount,'all surfaces reuse the recovered runtime');
   assert.equal(await storage(page),before,'switching recovered surfaces does not persist');assert.deepEqual(errors,[]);
  }
  rows.push({kind,fault,requests,failures,errors});writeFileSync(`${out}/partial-results.json`,JSON.stringify({resources,rows},null,2));console.log(`${kind} ${fault} PASS`);await context.close();
 }

 for(const width of [320,390,1440])for(const motion of ['no-preference','reduce']){
  const {page,context,requests,errors}=await fresh(width,motion);
  await nav(page,'Viaje');await page.locator('.analysis-dialog--embedded').waitFor();
  await page.locator('.viaje-nav__item').filter({hasText:'Dónde dormir'}).click();
  const panel=page.locator('.zone-panel--embedded');await panel.waitFor();
  const cards=panel.locator('.zone-card');await cards.first().waitFor();
  await cards.nth(0).locator('input[type=checkbox]').check();await cards.nth(1).locator('input[type=checkbox]').check();
  const before=await storage(page);assert.ok(!requests.some(mapRequest),'zone catalogue and selections do not prefetch maps');
  let release;const hold=new Promise(resolve=>{release=resolve;});await page.route(`**/${leaf.file}*`,async r=>{await hold;await r.fulfill({status:404,body:'Expected map fault'});});
  await panel.getByRole('button',{name:'Comparar',exact:true}).click();
  const feedback=panel.locator('.map-loading');await feedback.waitFor();await feedback.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const loadingBox=await box(feedback);release();
  await feedback.getByText(/No se pudo cargar el mapa/).waitFor();assert.equal(await panel.locator('.zone-column').count(),2,'comparison remains usable on map failure');
  await page.unroute(`**/${leaf.file}*`);await feedback.getByRole('button',{name:'Reintentar',exact:true}).click();
  const map=panel.locator('.zone-map');await map.waitFor();await settleMap(map);assert.deepEqual(await box(map),loadingBox,'zone map loading/error keeps dimensions');
  assert.ok(await map.evaluate(el=>el===document.activeElement),'zone retry returns focus');assert.equal(await map.locator('.zone-marker__pin--on').count(),2);
  const count=requests.filter(mapRequest).length;await nav(page,'Nosotros');await nav(page,'Viaje');await map.waitFor({state:'visible'});assert.equal(requests.filter(mapRequest).length,count);
  assert.equal(await storage(page),before,'zone map retry/reopen leaves persisted comparison and V8 intact');assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/zone-${width}-${motion}.png`});rows.push({kind:'zone',width,motion,loadingBox,requests,errors});writeFileSync(`${out}/partial-results.json`,JSON.stringify({resources,rows},null,2));console.log(`zone ${width} ${motion} PASS`);await context.close();
 }
 writeFileSync(`${out}/results.json`,JSON.stringify({resources,rows},null,2));console.log(`B10 map boundary PASS: ${rows.length} cold/warm/slow/failure scenarios; ${resources.filter(r=>r.critical).reduce((n,r)=>n+r.gzip,0)} B aggregate initial JS gzip; entry ${resources.find(r=>r.key==='index.html').gzip}.`);
}finally{await browser.close();await server.close();}
