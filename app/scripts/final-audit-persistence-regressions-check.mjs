import { chromium, webkit } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const BROWSER = process.env.NIHON_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const PORT = Number(process.env.NIHON_PORT ?? 4303);
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: {host:'127.0.0.1',port:PORT,strictPort:true}, logLevel:'error' });
await server.listen();
const browser = await (BROWSER === 'webkit' ? webkit : chromium).launch(BROWSER === 'webkit' ? {} : process.env.NIHON_CHROMIUM_PATH ? {executablePath:process.env.NIHON_CHROMIUM_PATH} : {});
const BASE = `http://127.0.0.1:${PORT}`;
const HARNESS_URL = BASE + '/scripts/fixtures/final-audit-persistence.html';
const DIRTY = execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim().length > 0;
const SHA = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
console.log(`sha=${SHA} dirty=${DIRTY} browser=${BROWSER} regression-source=Codex-d26d86b`);
const TK = 'nihon.travellers.v1', DK = 'nihon.manualPlanningDraft';
const boundary = { start: {kind:'unselected'}, end:{kind:'unselected'} };
const day = (id, placeIds=[]) => ({id, placeIds, accommodationBoundary:boundary});
const travellers = {version:1,travellers:[{id:'p1',label:'Synthetic A'},{id:'p2',label:'Synthetic B'}],activeTravellerId:'p1',interests:[{placeId:'JP-044',stances:[{travellerId:'p1',stance:'interested'}],carriedOver:false}]};
const draft = {version:8,routeIds:['JP-044'],days:[day('d1',['JP-044'])],startDate:null,endDate:null,visitStartTimes:{},accommodations:[],accommodationLegs:[],interHubSegments:[],zoneAccommodationChoices:[]};
const results=[];
async function setup(extra={}) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(({TK,DK,t,d,extra})=>{
    if (location.pathname === '/blank-independent-reader') return;
    if (!localStorage.getItem('__reviewSeed')) {
      localStorage.setItem('__reviewSeed','1');
      localStorage.setItem(TK,JSON.stringify(t)); localStorage.setItem(DK,JSON.stringify(d));
      for(const [k,v] of Object.entries(extra)) localStorage.setItem(k,v);
    }
    const real=Storage.prototype.setItem, get=Storage.prototype.getItem;
    window.reviewStorageTrace=[];
    Storage.prototype.getItem=function(k){const v=get.call(this,k);if(window.recordReviewStorage&&this===localStorage&&(k===DK||(k===TK&&window.recordReviewTravellers)))window.reviewStorageTrace.push({kind:'get',key:k,at:Date.now(),value:v});return v;};
    Storage.prototype.setItem=function(k,v){if((window.failReviewWrites && (k===TK || k===DK)) || window.failReviewKey===k) throw new DOMException('synthetic quota','QuotaExceededError');const result=real.call(this,k,v);if(window.recordReviewStorage&&this===localStorage&&(k===DK||(k===TK&&window.recordReviewTravellers)))window.reviewStorageTrace.push({kind:'set',key:k,at:Date.now(),value:v});return result;};
    window.addEventListener('storage', e=>{if(window.dropReviewEvents)e.stopImmediatePropagation();},true);
  },{TK,DK,t:travellers,d:draft,extra});
  const a=await ctx.newPage(); await a.goto(HARNESS_URL); await a.waitForFunction(()=>window.review);
  await a.waitForTimeout(100);
  return {ctx,a};
}
async function remote(ctx) {
 const p=await ctx.newPage(); await p.route('**/blank-review',r=>r.fulfill({contentType:'text/html',body:'<html>Isolated lock holder</html>'}));
 await p.goto(BASE + '/blank-review'); return p;
}
async function hold(p,key) {
 await p.evaluate(key=>{window.acquired=false; void navigator.locks.request('nihon:'+key,()=>new Promise(resolve=>{window.releaseReviewLock=resolve;window.acquired=true;}));},key);
 await p.waitForFunction(()=>window.acquired);
}
async function test(id,fn) {
 if (process.env.NIHON_ONLY && !process.env.NIHON_ONLY.split(',').includes(id)) return;
 try{const detail=await fn();results.push({id,...detail});console.log(JSON.stringify(results.at(-1)));}
 catch(e){results.push({id,error:String(e.stack)});console.log(JSON.stringify(results.at(-1)));}
}
async function queuedProtection(replacement) {
 const {ctx,a}=await setup(); const b=await remote(ctx); await a.bringToFront(); await hold(b,DK);
 await a.evaluate(()=>{window.recordReviewStorage=true;window.dropReviewEvents=true;window.review.planning.addEmptyDay();});
 const published=await b.evaluate(({key,value})=>{window.recordReviewStorage=true;localStorage.setItem(key,value);return {at:Date.now(),value:localStorage.getItem(key)};},{key:DK,value:replacement});
 await b.evaluate(()=>window.releaseReviewLock()); await a.waitForTimeout(450);
 const actual=await a.evaluate(k=>localStorage.getItem(k),DK);
 const remoteActual=await b.evaluate(k=>localStorage.getItem(k),DK);
 const trace=await a.evaluate(()=>window.reviewStorageTrace);
 const detail={expected:'original unchanged',preserved:actual===replacement&&remoteActual===replacement,correct:published.value===replacement&&trace.every(x=>x.kind!=='set'),actual,remoteActual,published,trace};
 await ctx.close(); return detail;
}
for(const replacement of ['{invalid-json',JSON.stringify({...draft,version:9,marker:'future original'})]) {
 await test('queued-write-protection-'+(replacement.startsWith('{invalid')?'invalid':'future'),()=>queuedProtection(replacement));
}
await test('queued-protection-repeated-publication-before-release',async()=>{
 const attempts=[];
 for(let i=0;i<12;i++) {
  const replacement=i%2===0?'{invalid-json':JSON.stringify({...draft,version:9,marker:'future original '+i});
  const detail=await queuedProtection(replacement);attempts.push(detail);
 }
 return {correct:attempts.every(x=>x.preserved&&x.correct),attempts};
});
await test('retry-clobbers-other-tab-and-export',async()=>{
 const {ctx,a}=await setup();
 await a.evaluate(()=>{window.failReviewWrites=true; window.review.travellers.toggleSaved('JP-021');});
 await a.waitForFunction(()=>window.review.getPersistenceState()==='error');
 await a.evaluate(()=>{window.dropReviewEvents=true;});
 const b=await ctx.newPage(); await b.goto(HARNESS_URL); await b.waitForFunction(()=>window.review); await b.evaluate(()=>window.review.travellers.toggleSaved('JP-077'));
 await b.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).interests.some(i=>i.placeId==='JP-077'),TK);
 await a.waitForTimeout(2800); await b.close();
 const before=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests.map(i=>i.placeId),TK);
 const memoryBefore=await a.evaluate(()=>window.review.travellers.savedIds);
 await a.evaluate(async()=>{window.failReviewWrites=false;await window.review.retryPersistence();});
 const after=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests.map(i=>i.placeId),TK);
 const downloadPromise=a.waitForEvent('download'); const outcome=await a.evaluate(()=>window.review.backup.exportBackup());
 const download=await downloadPromise; const chunks=[];for await(const c of await download.createReadStream())chunks.push(c);
 const exported=JSON.parse(Buffer.concat(chunks).toString()).data.travellers.interests.map(i=>i.placeId);
 await a.waitForTimeout(500);
 const final=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests.map(i=>i.placeId),TK);
 await ctx.close(); return {before,memoryBefore,after,exportOutcome:outcome,exported,final,retainedRemote:final.includes('JP-077'),exportContainsBoth:exported.includes('JP-077')&&exported.includes('JP-021')&&JSON.stringify([...exported].sort())===JSON.stringify([...final].sort())};
});
await test('retry-overwrites-protected-future',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>{window.failReviewWrites=true;window.review.travellers.toggleSaved('JP-021');});await a.waitForFunction(()=>window.review.getPersistenceState()==='error');
 const original=JSON.stringify({...travellers,version:2,marker:'do not overwrite'});
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:TK,value:original});
 await a.waitForFunction(()=>window.review.getProtectionSnapshot().some(p=>p.status==='incompatible'));
 await a.evaluate(async()=>{window.failReviewWrites=false;await window.review.retryPersistence();});
 const actual=await a.evaluate(k=>localStorage.getItem(k),TK);
 await ctx.close();return {expected:'future original unchanged',preserved:actual===original,actual};
});
await test('lineage-full-drops-missing-operation',async()=>{
 const history=Array.from({length:95},(_,i)=>'synthetic-history-'+i);
 const {ctx,a}=await setup({[DK]:JSON.stringify({...draft,_w:history})});const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>window.review.planning.addEmptyDay());await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===2,DK,{timeout:5000});
 const localWritten=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 const overwritten={...draft,days:[...draft.days,day('remote-day')],_w:[...history,'remote-write']};
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:JSON.stringify(overwritten)});
 await a.waitForTimeout(650);const final=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 await ctx.close();return {expectedDays:3,actualDays:final.days.length,localDayPreserved:final.days.some(d=>d.id===localWritten.days[1].id),lineageLength:final._w.length};
});
for (const full of [false,true]) await test('pending-replay-inclusion-'+(full?'full':'short'),async()=>{
 const history=Array.from({length:94},(_,i)=>'synthetic-history-'+i);
 const {ctx,a}=await setup({[DK]:JSON.stringify({...draft,_w:history})});const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>window.review.planning.addEmptyDay());await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===2,DK,{timeout:5000});
 const written=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 await hold(b,DK);
 const lostBranch={...draft,days:[...draft.days,day('remote-day')],_w:[...history,'remote-branch']};
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:JSON.stringify(lostBranch)});
 await a.waitForFunction(()=>window.review.planning.planningDays?.length===3,undefined,{timeout:5000});
 const containsOriginal={...written,startDate:'2027-03-01',_w:full?[...written._w,'contains-original']:written._w};
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:JSON.stringify(containsOriginal)});
 await a.waitForFunction(()=>window.review.planning.startDate==='2027-03-01');
 await b.evaluate(()=>window.releaseReviewLock());await a.waitForTimeout(600);
 const final=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 await ctx.close();return {expectedDays:2,actualDays:final.days.length,originalWriteStillIncluded:final._w.includes(written._w.at(-1)),lineageLength:final._w.length};
});
await test('operation-included-under-earlier-write-id',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>window.review.planning.addEmptyDay());await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===2,DK,{timeout:5000});
 const first=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 const lost={...draft,days:[...draft.days,day('remote-first')],_w:['remote-first-write']};
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:JSON.stringify(lost)});
 await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===3,DK,{timeout:5000});
 const second=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 const containsFirst={...first,days:[...first.days,day('remote-second')],_w:[...first._w,'remote-second-write']};
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:JSON.stringify(containsFirst)});
 await a.waitForTimeout(500);const final=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 await ctx.close();return {expectedDays:3,actualDays:final.days.length,firstIdIncluded:final._w.includes(first._w.at(-1)),secondIdAbsent:!final._w.includes(second._w.at(-1))};
});
await test('pending-survives-reload-while-lock-held',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();await hold(b,DK);
 await a.evaluate(()=>window.review.planning.addEmptyDay());await a.reload();await a.waitForFunction(()=>window.review);
 const held=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).days.length,DK);
 const local=await a.evaluate(()=>window.review.planning.planningDays.length);
 await b.evaluate(()=>window.releaseReviewLock());
 await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===2,DK);
 const days=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).days.length,DK);
 await ctx.close();return {expectedDays:2,actualDays:days,queuePreserved:local===2,lockRespected:held===1};
});
await test('abandoned-lock-released-on-close',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();await hold(b,DK);
 await a.evaluate(()=>window.review.planning.addEmptyDay());await b.close();
 await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===2,DK);
 await ctx.close();return {recovered:true};
});
await test('restore-drops-pending-journal',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();await hold(b,DK);
 await a.evaluate(()=>window.review.planning.addEmptyDay());
 const restored={...draft,days:[day('restored-day',['JP-044'])],startDate:'2027-03-01'};
 await a.evaluate(({key,value})=>{localStorage.setItem(key,value);window.review.notifyStorageReplaced();},{key:DK,value:JSON.stringify(restored)});
 await b.evaluate(()=>window.releaseReviewLock());await a.waitForTimeout(500);const actual=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 await ctx.close();return {expectedDay:'restored-day',actualDays:actual.days.map(d=>d.id),startDate:actual.startDate};
});
await test('failed-restore-retry-applies-partial-import',async()=>{
 const {ctx,a}=await setup();
 const importedTravellers={...travellers,travellers:[{id:'p1',label:'Imported A'},{id:'p2',label:'Imported B'}]};
 const importedDraft={...draft,startDate:'2027-03-03'};
 await a.evaluate(async({t,d,key})=>{window.failReviewKey=key;await window.review.backup.confirmImport(window.review.makeRestorePlan(t,d));},{t:importedTravellers,d:importedDraft,key:DK});
 await a.waitForTimeout(100);
 const importState=await a.evaluate(()=>window.review.backup.importState);
 const before=await a.evaluate(({TK,DK})=>({t:JSON.parse(localStorage.getItem(TK)),d:JSON.parse(localStorage.getItem(DK))}),{TK,DK});
 await a.evaluate(async()=>{window.failReviewKey=null;await window.review.retryPersistence();});await a.waitForTimeout(100);
 const after=await a.evaluate(({TK,DK})=>({t:JSON.parse(localStorage.getItem(TK)),d:JSON.parse(localStorage.getItem(DK))}),{TK,DK});
 await ctx.close();return {importState,beforeLabel:before.t.travellers[0].label,beforeStart:before.d.startDate,afterLabel:after.t.travellers[0].label,afterStart:after.d.startDate,rollbackStayedIntact:JSON.stringify(after)===JSON.stringify(before)};
});
await test('stale-active-traveller-attribution',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>window.dropReviewEvents=true);
 await b.evaluate(({key,t})=>localStorage.setItem(key,JSON.stringify({...t,activeTravellerId:'p2'})),{key:TK,t:travellers});
 const viewed=await a.evaluate(()=>window.review.travellers.activeTraveller.id);
 await a.evaluate(()=>window.review.travellers.toggleSaved('JP-021'));await a.waitForTimeout(350);
 const attributed=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests.find(i=>i.placeId==='JP-021').stances[0].travellerId,TK);
 await ctx.close();return {viewedTraveller:viewed,attributedTraveller:attributed,correct:attributed===viewed};
});
await test('h03-module-refresh-timeout-preserves-pending',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();await hold(b,DK);
 const started=Date.now();
 await a.evaluate(()=>{
   window.review.planning.addEmptyDay();
   const link=document.createElement('link');link.rel='modulepreload';link.href='/synthetic-hanging-chunk.js';document.head.appendChild(link);
   window.fetch=()=>new Promise(()=>{});
   void window.review.reloadRefreshingModules();
 });
 await a.waitForFunction(()=>!window.fetch.toString().includes('new Promise'),undefined,{timeout:5000});await a.waitForFunction(()=>window.review);
 const elapsedMs=Date.now()-started;
 const local=await a.evaluate(()=>window.review.planning.planningDays.length);
 await b.evaluate(()=>window.releaseReviewLock());
 await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===2,DK);
 const days=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).days.length,DK);
 await ctx.close();return {elapsedMs,expectedDays:2,actualDays:days,queuePreserved:local===2,reloaded:elapsedMs>=2900&&elapsedMs<5000};
});
for (const replacement of ['{invalid-json', JSON.stringify({...travellers,version:2})]) await test('retry-queued-retained-events-'+(replacement.startsWith('{invalid')?'invalid':'future'),async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>{window.failReviewWrites=true;window.review.travellers.toggleSaved('JP-021');});await a.waitForFunction(()=>window.review.getPersistenceState()==='error');
 await hold(b,TK);await a.evaluate(()=>{window.recordReviewStorage=true;window.recordReviewTravellers=true;window.dropReviewEvents=true;window.failReviewWrites=false;void window.review.retryPersistence();});
 await b.evaluate(({key,value})=>{window.recordReviewStorage=true;window.recordReviewTravellers=true;localStorage.setItem(key,value);},{key:TK,value:replacement});
 await b.evaluate(()=>window.releaseReviewLock());await a.waitForTimeout(400);
 const actual=await a.evaluate(k=>localStorage.getItem(k),TK);
 const outcome=await a.evaluate(()=>window.review.backup.exportBackup());
 const copy=await a.evaluate(k=>sessionStorage.getItem('nihon.pending.v1.'+k),TK);
 // Diagnostics begin AFTER the original verdict observations; no timing or
 // assertion changes. The reader deliberately receives no seed/wrappers/Nihon.
 const observe = key => ({documentId: window.reviewDocumentId ||= crypto.randomUUID(), url: location.href, raw: localStorage.getItem(key), trace: window.reviewStorageTrace});
 const documents = {a:await a.evaluate(observe,TK),b:await b.evaluate(observe,TK)};
 const independent=await ctx.newPage();await independent.route('**/blank-independent-reader',r=>r.fulfill({contentType:'text/html',body:'<html>Unseeded native reader</html>'}));
 await independent.goto(BASE+'/blank-independent-reader');
 documents.native=await independent.evaluate(key=>({documentId:crypto.randomUUID(),url:location.href,raw:localStorage.getItem(key),hasReview:!!window.review,hasTrace:!!window.reviewStorageTrace}),TK);
 const storageState=await ctx.storageState();
 await ctx.close();return {preserved:actual===replacement,correct:outcome.ok===false&&copy!==null&&copy.includes('JP-021'),exportOutcome:outcome,expected:replacement,actual,pendingCopy:copy,documents,storageState,profileKind:'private context; not a disk-durability claim'};
});
for (const lineage of ['full','missing','malformed']) await test('ambiguous-lineage-'+lineage+'-survives-reload',async()=>{
 const history=Array.from({length:95},(_,i)=>'history-'+i);
 const {ctx,a}=await setup({[DK]:JSON.stringify({...draft,_w:history})});const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>window.review.planning.addEmptyDay());await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).days.length===2,DK);
 const local=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).days[1].id,DK);
 const replacement={...draft,days:[day('external',['JP-044'])],...(lineage==='full'?{_w:Array.from({length:96},(_,i)=>'unknown-'+i)}:lineage==='malformed'?{_w:['duplicate','duplicate']}:{})};
 const raw=JSON.stringify(replacement);
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:raw});await a.waitForTimeout(350);
 const before=await a.evaluate(k=>sessionStorage.getItem('nihon.pending.v1.'+k),DK);
 await a.reload();await a.waitForFunction(()=>window.review);
 const next=JSON.stringify({...replacement,startDate:'2027-03-15'});
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:next});await a.waitForTimeout(350);
 await a.evaluate(()=>window.review.retryPersistence());
 const actual=await a.evaluate(k=>localStorage.getItem(k),DK);
 const copy=await a.evaluate(k=>sessionStorage.getItem('nihon.pending.v1.'+k),DK);
 const outcome=await a.evaluate(()=>window.review.backup.exportBackup());
 await ctx.close();return {preserved:actual===next,correct:before===copy&&copy.includes(local)&&!outcome.ok,exportOutcome:outcome};
});
for(const queued of [false,true]) await test('removed-viewed-traveller-'+(queued?'queued':'requested'),async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();await a.evaluate(()=>window.dropReviewEvents=true);
 if(queued){await hold(b,TK);await a.evaluate(()=>window.review.travellers.toggleSaved('JP-021'));}
 const replacement={...travellers,travellers:[travellers.travellers[1]],activeTravellerId:'p2',interests:[]};
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:TK,value:JSON.stringify(replacement)});
 if(queued)await b.evaluate(()=>window.releaseReviewLock());else await a.evaluate(()=>window.review.travellers.toggleSaved('JP-021'));
 await a.waitForTimeout(350);
 const final=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),TK);
 const messages=await a.evaluate(()=>window.review.getPersistenceProblems().map(p=>p.message));
 await ctx.close();return {correct:!final.interests.some(i=>i.placeId==='JP-021')&&messages.some(m=>m.includes('ya no existe')),messages};
});
await test('remove-interest-preserves-viewed-traveller',async()=>{
 const two={...travellers,interests:[{placeId:'JP-044',stances:[{travellerId:'p1',stance:'interested'},{travellerId:'p2',stance:'interested'}],carriedOver:false}]};
 const {ctx,a}=await setup({[TK]:JSON.stringify(two)});const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>window.dropReviewEvents=true);await b.evaluate(({key,t})=>localStorage.setItem(key,JSON.stringify({...t,activeTravellerId:'p2'})),{key:TK,t:two});
 await a.evaluate(()=>window.review.travellers.removeSaved('JP-044'));await a.waitForTimeout(350);
 const final=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests[0].stances,TK);
 await ctx.close();return {correct:final.length===1&&final[0].travellerId==='p2',stances:final};
});
await test('rollback-intact-after-reload-and-retry',async()=>{
 const {ctx,a}=await setup();
 await a.evaluate(async({t,d,key})=>{window.failReviewKey=key;await window.review.backup.confirmImport(window.review.makeRestorePlan(t,d));},{t:{...travellers,travellers:[{id:'p1',label:'Imported A'}]},d:{...draft,startDate:'2027-03-03'},key:DK});
 const rolledBack=await a.evaluate(()=>window.review.backup.importState.rolledBack);
 await a.reload();await a.waitForFunction(()=>window.review);await a.evaluate(()=>window.review.retryPersistence());
 const actual=await a.evaluate(({TK,DK})=>({t:JSON.parse(localStorage.getItem(TK)),d:JSON.parse(localStorage.getItem(DK)),copy:sessionStorage.getItem('nihon.pending.v1.restore')}),{TK,DK});
 await ctx.close();return {correct:rolledBack&&actual.t.travellers[0].label==='Synthetic A'&&actual.d.startDate===null&&actual.copy===null,rolledBack};
});
await test('incomplete-rollback-blocks-retry-reload-and-preserves-preimage',async()=>{
 const {ctx,a}=await setup();
 await a.evaluate(async({t,d,key})=>{
   const real=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){if(k===key){window.failReviewWrites=true;throw new DOMException('quota','QuotaExceededError');}return real.call(this,k,v);};
   await window.review.backup.confirmImport(window.review.makeRestorePlan(t,d));
 },{t:{...travellers,travellers:[{id:'p1',label:'Imported A'}]},d:{...draft,startDate:'2027-03-03'},key:DK});
 const rolledBack=await a.evaluate(()=>window.review.backup.importState.rolledBack);
 const preimage=await a.evaluate(()=>sessionStorage.getItem('nihon.pending.v1.restore'));
 await a.reload();await a.waitForFunction(()=>window.review);
 const before=await a.evaluate(({TK,DK})=>[localStorage.getItem(TK),localStorage.getItem(DK)],{TK,DK});
 await a.evaluate(async()=>{window.review.planning.addEmptyDay();window.review.travellers.toggleSaved('JP-021');await window.review.retryPersistence();});await a.waitForTimeout(350);
 const after=await a.evaluate(({TK,DK})=>[localStorage.getItem(TK),localStorage.getItem(DK)],{TK,DK});
 const outcome=await a.evaluate(()=>window.review.backup.exportBackup());
 const pending=await a.evaluate(()=>sessionStorage.getItem('nihon.pending.v1.restore'));
 await ctx.close();return {correct:rolledBack===false&&preimage===pending&&preimage.includes('Synthetic A')&&JSON.stringify(before)===JSON.stringify(after)&&!outcome.ok,rolledBack,exportOutcome:outcome};
});
await test('lock-rejection-never-bypasses-exclusion',async()=>{
 const {ctx,a}=await setup();
 await a.evaluate(()=>window.review.flushAllPendingWrites());
 const before=await a.evaluate(k=>localStorage.getItem(k),DK);
 await a.evaluate(()=>{
  window.rejectedReviewLockCalls=0;
  const reject=()=>{window.rejectedReviewLockCalls++;return Promise.reject(new Error('synthetic rejected lock'));};
  Object.getPrototypeOf(navigator.locks).request=reject;
  if(navigator.locks.request!==reject)throw new Error('Rejected-lock injection was not installed');
  window.review.planning.addEmptyDay();
 });await a.waitForTimeout(350);
 await a.evaluate(()=>window.review.retryPersistence());
 const outcome=await a.evaluate(()=>window.review.backup.exportBackup());
 const after=await a.evaluate(k=>localStorage.getItem(k),DK);
 const messages=await a.evaluate(()=>window.review.getPersistenceProblems().map(p=>p.message));
 const rejectedCalls=await a.evaluate(()=>window.rejectedReviewLockCalls);
 await ctx.close();return {preserved:before===after,correct:rejectedCalls>0&&!outcome.ok&&messages.some(m=>m.includes('acceso')),rejectedCalls,exportOutcome:outcome,messages};
});
await test('queued-stop-operation-rejects-removed-day',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();await hold(b,DK);
 await a.evaluate(()=>{window.dropReviewEvents=true;window.review.planning.removePlaceFromDay('JP-044','d1');});
 const replacement={...draft,days:[day('replacement',['JP-044'])],_w:['remote-write']};const raw=JSON.stringify(replacement);
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:raw});await b.evaluate(()=>window.releaseReviewLock());await a.waitForTimeout(350);
 const after=await a.evaluate(k=>localStorage.getItem(k),DK);
 const messages=await a.evaluate(()=>window.review.getPersistenceProblems().map(p=>p.message));
 await ctx.close();return {preserved:after===raw,correct:messages.some(m=>m.includes('otra pestaña')),messages};
});

await test('zone-choice-shares-queued-journal-and-protection',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();await hold(b,DK);
 await a.evaluate(()=>{
   window.dropReviewEvents=true;window.review.planning.addEmptyDay();
   window.review.zones.chooseZone({id:'synthetic-zone',hub:'Kyoto',anchor:{label:'Synthetic hotel',lat:35,lng:135}});
 });
 const held=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).days.length,DK);
 await b.evaluate(()=>window.releaseReviewLock());await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).zoneAccommodationChoices.length===1,DK);
 const written=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 await hold(b,DK);await a.evaluate(()=>window.review.zones.clearZone());
 const original=JSON.stringify({...draft,version:9});await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:original});
 await b.evaluate(()=>window.releaseReviewLock());await a.waitForTimeout(350);
 const actual=await a.evaluate(k=>localStorage.getItem(k),DK);
 await ctx.close();return {preserved:actual===original,correct:held===1&&written.days.length===2&&written.accommodations.length===1};
});
await test('read-failure-is-protected-not-empty',async()=>{
 const {ctx,a}=await setup();const before=await a.evaluate(k=>localStorage.getItem(k),DK);
 await a.evaluate(key=>{
  const real=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===key)throw new DOMException('denied','SecurityError');return real.call(this,k);};
  window.review.planning.addEmptyDay();
 },DK);await a.waitForTimeout(350);
 const protectedRead=await a.evaluate(()=>window.review.getProtectionSnapshot().some(p=>p.status==='unreadable'));
 const outcome=await a.evaluate(()=>window.review.backup.exportBackup());
 await a.reload();await a.waitForFunction(()=>window.review);const after=await a.evaluate(k=>localStorage.getItem(k),DK);
 await ctx.close();return {preserved:before===after,correct:protectedRead&&!outcome.ok,exportOutcome:outcome};
});
await test('restore-null-draft-does-not-resurrect-old-shortlist',async()=>{
 const {ctx,a}=await setup();
 const imported={...travellers,interests:[{placeId:'JP-021',stances:[{travellerId:'p2',stance:'interested'}],carriedOver:false}]};
 await a.evaluate(async(t)=>{await window.review.backup.confirmImport(window.review.makeRestorePlan(t,null));},imported);
 await a.waitForTimeout(500);
 const actual=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),DK);
 await ctx.close();return {correct:actual.routeIds.includes('JP-021')&&!actual.routeIds.includes('JP-044'),actualRoute:actual.routeIds};
});
await test('second-failed-restore-keeps-first-preimage',async()=>{
 const {ctx,a}=await setup();
 await a.evaluate(async({t,d,key})=>{
  const real=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&window.breakRollback){window.failReviewWrites=true;throw new DOMException('quota','QuotaExceededError');}return real.call(this,k,v);};
  window.breakRollback=true;await window.review.backup.confirmImport(window.review.makeRestorePlan(t,d));
 },{t:{...travellers,travellers:[{id:'p1',label:'First imported'}]},d:{...draft,startDate:'2027-03-03'},key:DK});
 const original=await a.evaluate(()=>sessionStorage.getItem('nihon.pending.v1.restore'));
 await a.evaluate(async({t,d,key})=>{window.breakRollback=false;window.failReviewWrites=false;window.failReviewKey=key;await window.review.backup.confirmImport(window.review.makeRestorePlan(t,d));},{t:{...travellers,travellers:[{id:'p1',label:'Second imported'}]},d:{...draft,startDate:'2027-03-04'},key:DK});
 const after=await a.evaluate(()=>sessionStorage.getItem('nihon.pending.v1.restore'));
 await a.reload();await a.waitForFunction(()=>window.review);
 const reloaded=await a.evaluate(()=>sessionStorage.getItem('nihon.pending.v1.restore'));
 await ctx.close();return {correct:original!==null&&original===after&&after===reloaded&&original.includes('Synthetic A'),preimageKept:after!==null};
});
await test('preimage-copy-failure-does-not-leave-unstarted-restore-block',async()=>{
 const {ctx,a}=await setup();
 await a.evaluate(async({t,d})=>{
  const real=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===sessionStorage&&k==='nihon.pending.v1.restore')throw new DOMException('quota','QuotaExceededError');return real.call(this,k,v);};
  await window.review.backup.confirmImport(window.review.makeRestorePlan(t,d));
  window.review.travellers.toggleSaved('JP-021');
 },{t:{...travellers,travellers:[{id:'p1',label:'Imported'}]},d:{...draft,startDate:'2027-03-03'}});
 await a.waitForTimeout(450);
 const actual=await a.evaluate(({TK,DK})=>({t:JSON.parse(localStorage.getItem(TK)),d:JSON.parse(localStorage.getItem(DK))}),{TK,DK});
 await ctx.close();return {correct:actual.t.travellers[0].label==='Synthetic A'&&actual.d.startDate===null&&actual.t.interests.some(i=>i.placeId==='JP-021'),interestAccepted:actual.t.interests.some(i=>i.placeId==='JP-021')};
});
await test('recovered-lock-clears-safe-noop-problem-without-writing',async()=>{
 const {ctx,a}=await setup();await a.evaluate(()=>window.review.flushAllPendingWrites());
 const originalTraveller=await a.evaluate(k=>localStorage.getItem(k),TK);
 await a.evaluate(()=>{
  window.reviewLockPrototype=Object.getPrototypeOf(navigator.locks);
  window.reviewLockDescriptor=Object.getOwnPropertyDescriptor(window.reviewLockPrototype,'request');
  const reject=()=>Promise.reject(new Error('synthetic rejected lock'));
  window.reviewLockPrototype.request=reject;
  if(navigator.locks.request!==reject)throw new Error('Rejected-lock injection was not installed');
  window.review.planning.addEmptyDay();
 });await a.waitForTimeout(150);
 const rejected=await a.evaluate(()=>window.review.backup.exportBackup());
 await a.evaluate(async()=>{Object.defineProperty(window.reviewLockPrototype,'request',window.reviewLockDescriptor);await window.review.retryPersistence();});
 const recovered=await a.evaluate(()=>window.review.backup.exportBackup());
 const actual=await a.evaluate(({TK,DK})=>({traveller:localStorage.getItem(TK),days:JSON.parse(localStorage.getItem(DK)).days.length,problems:window.review.getPersistenceProblems()}),{TK,DK});
 await ctx.close();return {correct:!rejected.ok&&recovered.ok&&actual.days===2&&actual.traveller===originalTraveller,rejected,recovered,remaining:actual.problems};
});
await browser.close();await server.close();
for(const r of results) {
 r.pass=!r.error;
 for(const key of ['preserved','retainedRemote','localDayPreserved','recovered','rollbackStayedIntact','correct','reloaded','queuePreserved','lockRespected','exportContainsBoth','originalWriteStillIncluded','firstIdIncluded','secondIdAbsent','preimageKept','interestAccepted']) if(key in r)r.pass&&=r[key];
 if('expectedDays' in r)r.pass&&=r.actualDays===r.expectedDays;
 if('expectedDay' in r)r.pass&&=r.actualDays.length===1&&r.actualDays[0]===r.expectedDay;
}
if(process.env.NIHON_EVIDENCE_OUT) writeFileSync(process.env.NIHON_EVIDENCE_OUT + `/persistence-regressions-${BROWSER}.json`,JSON.stringify({sha:SHA,dirty:DIRTY,browser:BROWSER,results},null,2));
console.log(`Persistence regressions: ${results.filter(r=>r.pass).length} pass, ${results.filter(r=>!r.pass).length} fail (expected guarantees)`);
if(results.some(r=>!r.pass))process.exitCode=1;
