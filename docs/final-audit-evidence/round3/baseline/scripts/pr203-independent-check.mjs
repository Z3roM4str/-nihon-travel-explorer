import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const URL = 'http://127.0.0.1:4301/pr203-review-harness.html';
const TK = 'nihon.travellers.v1', DK = 'nihon.manualPlanningDraft';
const boundary = { start: {kind:'unselected'}, end:{kind:'unselected'} };
const day = (id, placeIds=[]) => ({id, placeIds, accommodationBoundary:boundary});
const travellers = {version:1,travellers:[{id:'p1',label:'Synthetic A'},{id:'p2',label:'Synthetic B'}],activeTravellerId:'p1',interests:[{placeId:'JP-044',stances:[{travellerId:'p1',stance:'interested'}],carriedOver:false}]};
const draft = {version:8,routeIds:['JP-044'],days:[day('d1',['JP-044'])],startDate:null,endDate:null,visitStartTimes:{},accommodations:[],accommodationLegs:[],interHubSegments:[],zoneAccommodationChoices:[]};
const results=[];
async function setup(extra={}) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(({TK,DK,t,d,extra})=>{
    if (!localStorage.getItem('__reviewSeed')) {
      localStorage.setItem('__reviewSeed','1');
      localStorage.setItem(TK,JSON.stringify(t)); localStorage.setItem(DK,JSON.stringify(d));
      for(const [k,v] of Object.entries(extra)) localStorage.setItem(k,v);
    }
    const real=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if((window.failReviewWrites && (k===TK || k===DK)) || window.failReviewKey===k) throw new DOMException('synthetic quota','QuotaExceededError'); return real.call(this,k,v);};
    window.addEventListener('storage', e=>{if(window.dropReviewEvents)e.stopImmediatePropagation();},true);
  },{TK,DK,t:travellers,d:draft,extra});
  const a=await ctx.newPage(); await a.goto(URL); await a.waitForFunction(()=>window.review);
  await a.waitForTimeout(100);
  return {ctx,a};
}
async function remote(ctx) {
 const p=await ctx.newPage(); await p.route('**/blank-review',r=>r.fulfill({contentType:'text/html',body:'<html>Isolated lock holder</html>'}));
 await p.goto('http://127.0.0.1:4301/blank-review'); return p;
}
async function hold(p,key) {
 await p.evaluate(key=>{window.acquired=false; void navigator.locks.request('nihon:'+key,()=>new Promise(resolve=>{window.releaseReviewLock=resolve;window.acquired=true;}));},key);
 await p.waitForFunction(()=>window.acquired);
}
async function test(id,fn) {
 try{const detail=await fn();results.push({id,...detail});console.log(JSON.stringify(results.at(-1)));}
 catch(e){results.push({id,error:String(e.stack)});console.log(JSON.stringify(results.at(-1)));}
}
for(const replacement of ['{invalid-json',JSON.stringify({...draft,version:9,marker:'future original'})]) {
 await test('queued-write-protection-'+(replacement.startsWith('{invalid')?'invalid':'future'),async()=>{
  const {ctx,a}=await setup(); const b=await remote(ctx); await a.bringToFront(); await hold(b,DK);
  await a.evaluate(()=>{window.dropReviewEvents=true;window.review.planning.addEmptyDay();});
  await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:DK,value:replacement});
  await b.evaluate(()=>window.releaseReviewLock()); await a.waitForTimeout(450);
  const actual=await a.evaluate(k=>localStorage.getItem(k),DK);
  const detail={expected:'original unchanged',preserved:actual===replacement,actual}; await ctx.close(); return detail;
 });
}
await test('retry-clobbers-other-tab-and-export',async()=>{
 const {ctx,a}=await setup();
 await a.evaluate(()=>{window.failReviewWrites=true; window.review.travellers.toggleSaved('JP-021');});
 await a.waitForFunction(()=>window.review.getPersistenceState()==='error');
 await a.evaluate(()=>{window.dropReviewEvents=true;});
 const b=await ctx.newPage(); await b.goto(URL); await b.waitForFunction(()=>window.review); await b.evaluate(()=>window.review.travellers.toggleSaved('JP-077'));
 await b.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).interests.some(i=>i.placeId==='JP-077'),TK);
 await a.waitForTimeout(2800); await b.close();
 const before=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests.map(i=>i.placeId),TK);
 const memoryBefore=await a.evaluate(()=>window.review.travellers.savedIds);
 await a.evaluate(()=>{window.failReviewWrites=false;window.review.retryPersistence();});
 const after=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests.map(i=>i.placeId),TK);
 const downloadPromise=a.waitForEvent('download'); const outcome=await a.evaluate(()=>window.review.backup.exportBackup());
 const download=await downloadPromise; const chunks=[];for await(const c of await download.createReadStream())chunks.push(c);
 const exported=JSON.parse(Buffer.concat(chunks).toString()).data.travellers.interests.map(i=>i.placeId);
 await a.waitForTimeout(500);
 const final=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).interests.map(i=>i.placeId),TK);
 await ctx.close(); return {before,memoryBefore,after,exportOutcome:outcome,exported,final,retainedRemote:final.includes('JP-077')};
});
await test('retry-overwrites-protected-future',async()=>{
 const {ctx,a}=await setup();const b=await remote(ctx);await a.bringToFront();
 await a.evaluate(()=>{window.failReviewWrites=true;window.review.travellers.toggleSaved('JP-021');});await a.waitForFunction(()=>window.review.getPersistenceState()==='error');
 const original=JSON.stringify({...travellers,version:2,marker:'do not overwrite'});
 await b.evaluate(({key,value})=>localStorage.setItem(key,value),{key:TK,value:original});
 await a.waitForFunction(()=>window.review.getProtectionSnapshot().some(p=>p.status==='incompatible'));
 await a.evaluate(()=>{window.failReviewWrites=false;window.review.retryPersistence();});
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
 const days=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).days.length,DK);
 await b.evaluate(()=>window.releaseReviewLock());await ctx.close();return {expectedDays:2,actualDays:days};
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
 await a.evaluate(({t,d,key})=>{window.failReviewKey=key;window.review.backup.confirmImport(window.review.makeRestorePlan(t,d));},{t:importedTravellers,d:importedDraft,key:DK});
 await a.waitForTimeout(100);
 const importState=await a.evaluate(()=>window.review.backup.importState);
 const before=await a.evaluate(({TK,DK})=>({t:JSON.parse(localStorage.getItem(TK)),d:JSON.parse(localStorage.getItem(DK))}),{TK,DK});
 await a.evaluate(()=>{window.failReviewKey=null;window.review.retryPersistence();});await a.waitForTimeout(100);
 const after=await a.evaluate(({TK,DK})=>({t:JSON.parse(localStorage.getItem(TK)),d:JSON.parse(localStorage.getItem(DK))}),{TK,DK});
 await ctx.close();return {importState,beforeLabel:before.t.travellers[0].label,beforeStart:before.d.startDate,afterLabel:after.t.travellers[0].label,afterStart:after.d.startDate,rollbackStayedIntact:after.d.startDate===before.d.startDate};
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
 const elapsedMs=Date.now()-started;const days=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).days.length,DK);
 await b.evaluate(()=>window.releaseReviewLock());await ctx.close();return {elapsedMs,expectedDays:2,actualDays:days,reloaded:elapsedMs>=2900&&elapsedMs<5000};
});
await browser.close();
for(const r of results) {
 r.pass=!r.error;
 for(const key of ['preserved','retainedRemote','localDayPreserved','recovered','rollbackStayedIntact','correct','reloaded']) if(key in r)r.pass&&=r[key];
 if('expectedDays' in r)r.pass&&=r.actualDays===r.expectedDays;
 if('expectedDay' in r)r.pass&&=r.actualDays.length===1&&r.actualDays[0]===r.expectedDay;
}
writeFileSync('/workspace/scratch/pr203-independent-results.json',JSON.stringify(results,null,2));
console.log(`Independent regressions: ${results.filter(r=>r.pass).length} pass, ${results.filter(r=>!r.pass).length} fail (expected guarantees)`);
if(results.some(r=>!r.pass))process.exitCode=1;
