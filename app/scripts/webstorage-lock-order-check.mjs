// Native counterfactual of the retained-events retry gate, without Nihon.
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html>Native storage and locks only</html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await webkit.launch();const results=[];
const out=process.env.NIHON_EVIDENCE_OUT??'webstorage-lock-order';mkdirSync(out,{recursive:true});
try {
 for(let i=0;i<24;i++) {
  const ctx=await browser.newContext();let detail={i};
  try {
   const a=await ctx.newPage(),b=await ctx.newPage();await a.goto(origin);await b.goto(origin);await a.bringToFront();
   await a.evaluate(()=>{localStorage.setItem('nihon.travellers.v1','A');window.drop=true;window.addEventListener('storage',e=>{if(window.drop)e.stopImmediatePropagation();},true);});
   await a.waitForTimeout(100);
   await b.evaluate(()=>{window.acquired=false;void navigator.locks.request('nihon:nihon.travellers.v1',()=>new Promise(resolve=>{window.release=resolve;window.acquired=true;}));});await b.waitForFunction(()=>window.acquired);
   await a.evaluate(()=>{window.done=false;window.observed=null;void navigator.locks.request('nihon:nihon.travellers.v1',async()=>{await new Promise(r=>setTimeout(r,0));window.observed={at:Date.now(),raw:localStorage.getItem('nihon.travellers.v1')};window.done=true;});});
   detail.published=await b.evaluate(()=>{localStorage.setItem('nihon.travellers.v1','{invalid-json');return{at:Date.now(),raw:localStorage.getItem('nihon.travellers.v1')};});
   await b.evaluate(()=>window.release());await a.waitForTimeout(400);
   detail.a=await a.evaluate(()=>({done:window.done,observed:window.observed,raw:localStorage.getItem('nihon.travellers.v1')}));
   detail.b=await b.evaluate(()=>localStorage.getItem('nihon.travellers.v1'));
   const c=await ctx.newPage();await c.goto(origin);detail.newDocument=await c.evaluate(()=>localStorage.getItem('nihon.travellers.v1'));
   detail.pass=detail.a.done&&detail.a.observed.raw==='{invalid-json'&&detail.a.raw==='{invalid-json'&&detail.b==='{invalid-json'&&detail.newDocument==='{invalid-json';
  } catch(e){detail.error=String(e.stack);detail.pass=false;}
  finally {await ctx.close();results.push(detail);writeFileSync(`${out}/results.json`,JSON.stringify({sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:await browser.version(),platform:process.platform,profileKind:'private contexts',results},null,2));}
 }
} finally {await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify({pass:results.filter(x=>x.pass).length,fail:results.filter(x=>!x.pass).length}));
if(results.some(x=>!x.pass))process.exitCode=1;
