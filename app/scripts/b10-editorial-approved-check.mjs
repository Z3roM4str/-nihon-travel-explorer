import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// A test-only export seam exercises the existing presentation functions, with real
// domain summaries. It changes no production exports or persistence contracts.
const server = await createServer({ server: { middlewareMode: true }, plugins: [{
  name: 'b10-editorial-test-seam', enforce: 'pre',
  transform(code, id) {
    if (id.endsWith('/components/OrderedSequenceBuilder.tsx')) return code + '\nexport { TransferAndVisitTotals, interHubInactiveText };';
  },
}] });
const out = process.env.NIHON_B10_OUT ?? '/tmp/b10-editorial'; mkdirSync(out,{recursive:true});
try {
 const {TransferAndVisitTotals,interHubInactiveText}=await server.ssrLoadModule('/src/components/OrderedSequenceBuilder.tsx');
 const {orderedSequenceFromLookup}=await server.ssrLoadModule('/src/lib/ordered-sequence.ts');
 const {summarizeSelection}=await server.ssrLoadModule('/src/lib/selection.ts');
 const {TravellerManager}=await server.ssrLoadModule('/src/components/TravellerManager.tsx');
 const results=[];
 for(const [known,total] of [[0,0],[1,1],[3,3],[0,1],[0,3],[1,3],[2,3],[2,4]]){
  let calls=0;
  const summary=orderedSequenceFromLookup(Array.from({length:total+1},(_,i)=>String(i)),()=>calls++<known?{minutes:{minMinutes:10,maxMinutes:20}}:null).summary;
  const before=JSON.stringify(summary);
  const html=renderToStaticMarkup(createElement(TransferAndVisitTotals,{visitSummary:summarizeSelection([]),sequenceSummary:summary}));
  const text=html.replace(/<[^>]+>/g,'').replace(/\s+/g,' ');
  if(!total)assert.ok(!text.includes('traslados'),'zero-connection branch remains absent');
  else{
   const expected=known===total?`traslados totales · ${known} ${total===1?'conexión':'conexiones'} con tiempo registrado`:`traslados conocidos · ${known} de ${total} ${total===1?'conexión':'conexiones'} con tiempo registrado`;
   assert.ok(text.includes(expected),`${text} contains ${expected}`);
   const missing=total-known;
   if(missing)assert.ok(text.includes(`${missing}${missing===1?'conexión':'conexiones'} sin tiempo registrado`),text);
  }
  assert.equal(JSON.stringify(summary),before);
  results.push({known,total,text,summary});
 }
 const reasons={
  'invalid-day-partition':'Este traslado queda inactivo porque el reparto por días no es válido.',
  'from-hub-mismatch':'La ciudad o región actual de uno de los puntos ya no coincide con la registrada.',
  'to-hub-mismatch':'La ciudad o región actual de uno de los puntos ya no coincide con la registrada.',
  'same-current-hub':'Los dos puntos pertenecen actualmente a la misma ciudad o región.',
  'missing-from-place':'Uno de los puntos ya no forma parte del viaje actual.',
  'not-consecutive-in-day':'Estos lugares ya no son consecutivos dentro del mismo día.',
 };
 for(const [reason,expected]of Object.entries(reasons))assert.equal(interHubInactiveText(reason),expected);
 const html=renderToStaticMarkup(createElement(TravellerManager,{travellers:[],activeTravellerId:null,placesOnlyWantedBy:()=>[],placesMarkedBy:()=>[],onSetActive:()=>{},onRename:()=>{}}));
 assert.ok(html.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').includes('Sólo cambia de quién es cada «Quiero ir». El plan del viaje, los días, las fechas y el alojamiento son compartidos por los dos.'));
 writeFileSync(`${out}/results.json`,JSON.stringify({results,reasons},null,2));
 console.log('E01/E02/E03/E04: domain summaries and actual rendered copy PASS; complete 1/N, partial 0/1/N, zero omitted, invalid and hub reasons; no mutation.');
}finally{await server.close();}
