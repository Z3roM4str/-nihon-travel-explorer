// Director reference only. No production persistence or backend. Vite serves canonical TS adapters.
import { getAllPlaces, getHubs } from '../../../app/src/data/store.ts';
import { resolvePlaceImages } from '../../../app/src/data/place-images.ts';
import { matchesQuery, splitCategory } from '../../../app/src/lib/place.ts';
import { resolveDuration, formatRange } from '../../../app/src/lib/duration.ts';
import { interpretPlaceReservation, describeReservationForUi } from '../../../app/src/lib/reservation.ts';
import { interpretPlaceFebMarStatus, describeFebMarStatusForUi } from '../../../app/src/lib/feb-mar-status.ts';
import { describePhotographyProcessing } from '../../../app/src/lib/photography-attribution.ts';

const $ = (s) => document.querySelector(s);
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  check:'m5 12 4 4L19 6',
  image:'M3 3h18v18H3ZM3 16l5-5 5 5 3-3 5 5M8 7h.01',
  clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  compass:'m16 8-3 5-5 3 3-5ZM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  minus:'M8 12h8M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.check}"/></svg>`;
const grades = {S:['Imprescindible','star'],A:['Muy recomendable','check'],B:['Recomendable','check'],C:['Opcional','compass'],D:['Prescindible','minus']};
const places = getAllPlaces();
const hubs = getHubs();
const saved = new Set();
let limit = 12, view = 'explore', selected = null, opener = null, timer;
const badge = p => `<span class="grade ${p.grade==='A'?'grade-a':''}">${icon((grades[p.grade]||[])[1])}${escape((grades[p.grade]||['Sin clasificación'])[0])}</span>`;
const duration = p => { const r=resolveDuration(p.duration); return r?formatRange(r):p.duration.raw; };
const reservation = p => describeReservationForUi(interpretPlaceReservation(p),p.reservation.leadTime);
const assetUrl = image => new URL('../../../app/public/' + image.url.replace(/^\//,''),import.meta.url).href;
function credits(im){
  if(!im) return '';
  return `<details class="credits"><summary>Créditos de la foto</summary><p>${escape(im.credit)} · <a href="${escape(im.sourceUrl)}" target="_blank" rel="noreferrer">${escape(im.source)}</a> · <a href="${escape(im.licenseUrl)}" target="_blank" rel="noreferrer">${escape(im.license)}</a><br>${escape(im.sourceFileTitle)}${im.attributionTitle?'<br>'+escape(im.attributionTitle):''}<br>${escape(describePhotographyProcessing(im.processing))} · Recorte de visualización</p></details>`;
}
function photo(p, clickable=false){
  const im=resolvePlaceImages(p.id,p.images)[0];
  return `<div class="frame">${clickable?`<a class="photo-link" href="#${p.id}" data-place="${p.id}" aria-label="Ver ${escape(p.name)}">`:""}${im?`<img src="${escape(assetUrl(im))}" alt="${escape(im.alt)}" loading="lazy" decoding="async" width="800" height="600" data-image="${p.id}">`:`<div class="placeholder">${icon('image')}<span>Fotografía pendiente</span></div>`}${clickable?"</a>":""}</div>${credits(im)}`;
}
function want(p){return `<button class="want" data-want="${p.id}" aria-pressed="${saved.has(p.id)}" aria-label="Quiero ir a ${escape(p.name)}">${icon('heart')}<span>${saved.has(p.id)?'Quiero ir ✓':'Quiero ir'}</span></button>`;}
function card(p){
  const cat=splitCategory(p.category).label, r=reservation(p), f=describeFebMarStatusForUi(interpretPlaceFebMarStatus(p));
  return `<article class="card" data-card="${p.id}">${photo(p,true)}<div class="card-body">${badge(p)}<h3><a href="#${p.id}" data-place="${p.id}">${escape(p.name)}</a></h3><p class="meta">${escape(p.hub)} · ${escape(p.neighborhood||p.municipality)}<br>${escape(cat)}</p><p class="description">${escape(p.description)}</p><div class="facts"><span class="fact">${icon('clock')}${escape(duration(p))}</span>${r.tag?`<span>${escape(r.tag.label)}</span>`:''}</div>${f.tone!=='confirmed'?'<span class="season">Feb–mar: revisar condiciones</span>':''}<span class="spacer"></span>${want(p)}</div></article>`;
}
function ordered(input){
  const out=[];
  for(const grade of ['S','A','B','C','D',...new Set(input.map(p=>p.grade).filter(g=>!grades[g]))]){
    const groups=hubs.map(h=>input.filter(p=>p.grade===grade&&p.hub===h).sort((a,b)=>a.id.localeCompare(b.id)));
    for(let n=0;n<Math.max(0,...groups.map(g=>g.length));n++)for(const group of groups)if(group[n])out.push(group[n]);
  }
  return out;
}
function filtered(){return ordered(places.filter(p=>(view!=='saved'||saved.has(p.id))&&(!$('#hub').value||p.hub===$('#hub').value)&&(!$('#category').value||p.category===$('#category').value)&&matchesQuery(p,$('#query').value)));}
function bindImages(){
  document.querySelectorAll('img[data-image]').forEach(img=>{img.onerror=()=>{const box=img.parentElement;box.innerHTML=`<div class="placeholder">${icon('image')}<span>No pudimos cargar esta foto</span><button class="secondary" data-retry="${img.dataset.image}">Reintentar</button></div>`;};});
}
function render(){
  const ps=filtered();
  $('#cards').innerHTML=ps.length?ps.slice(0,limit).map(card).join(''):`<section class="empty"><h3>${view==='saved'?'Su viaje empieza con un lugar':'No encontramos coincidencias'}</h3><p>${view==='saved'?'Marca Quiero ir en los lugares que te interesan.':'Prueba con otro término o quita los filtros.'}</p><button class="secondary" id="reset">${view==='saved'?'Explorar Japón':'Quitar filtros'}</button></section>`;
  $('#results').textContent=`${ps.length} lugares`;
  $('#count').textContent=saved.size;
  $('#more').hidden=ps.length<=limit;
  $('#result-title').textContent=view==='saved'?'Mis intereses':($('#hub').value?`Descubre ${$('#hub').value}`:'Lugares para descubrir');
  document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  bindImages();
}
function toggle(id){
  saved.has(id)?saved.delete(id):saved.add(id);
  document.querySelectorAll(`[data-want="${id}"]`).forEach(b=>{b.setAttribute('aria-pressed',String(saved.has(id)));b.querySelector('span').textContent=saved.has(id)?'Quiero ir ✓':'Quiero ir';});
  $('#count').textContent=saved.size;
  $('#toast').textContent=saved.has(id)?'Añadido a tus intereses de la referencia':'Interés retirado';$('#toast').hidden=false;
  clearTimeout(timer);timer=setTimeout(()=>$('#toast').hidden=true,2500);
  // Keep the current card mounted so the reference does not steal focus on toggle.
}
function openPlace(id,button){
  const p=places.find(x=>x.id===id);if(!p)return;
  selected=p;opener=button;
  const r=reservation(p);
  $('#detail-content').innerHTML=`<div class="detail-grid"><div class="detail-media">${photo(p)}</div><div class="detail-body"><h2 id="detail-title">${escape(p.name)}</h2><p class="meta">${escape(p.hub)} · ${escape(p.neighborhood||p.municipality)}</p><div style="margin-top:16px">${badge(p)}</div><p class="description">${escape(p.description)}</p><h3>Por qué puede gustarte</h3><p>${escape(p.differentiator)}</p><p class="facts">${icon('clock')}${escape(duration(p))}${r.tag?' · '+escape(r.tag.label):''}</p><div class="notice">Para febrero–marzo de 2027: ${escape(p.febMar2027.status)}. Consulta las condiciones antes de fijar fechas.</div><details><summary>La experiencia</summary><p>${escape(p.experience)}</p><p>Mejor momento: ${escape(p.bestTime)}</p><p>Mejor época: ${escape(p.bestSeason)}</p></details><details><summary>Antes de ir</summary><dl class="practical">${[['Horario',p.schedule.hours],['Cierres',p.schedule.closures],['Reserva',r.practicalRow],['Turismo',p.tourismLevel],['Aglomeración',p.crowdLevel],['Precio registrado',`${p.price.min}–${p.price.max} ${p.price.currency}`]].map(([k,v])=>`<div><dt>${k}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl></details><details><summary>Para febrero–marzo de 2027</summary><p>${escape(p.febMar2027.status)}</p><p>${escape(p.febMar2027.warning)}</p><p>${escape(p.febMar2027.action)}</p></details><details><summary>Cómo llegar y accesibilidad</summary><p>${escape(p.transport)}</p><p>${escape(p.accessibility)}</p></details><details><summary>Fuentes y actualización</summary><p>Datos: ${escape(p.updatedAt)}</p>${p.officialUrl?`<p><a target="_blank" rel="noreferrer" href="${escape(p.officialUrl)}">Sitio oficial</a></p>`:''}${p.googleMapsUrl?`<p><a target="_blank" rel="noreferrer" href="${escape(p.googleMapsUrl)}">Google Maps</a></p>`:''}<p lang="ja">${escape(p.japaneseName)}</p></details><div class="detail-footer">${want(p)}</div></div></div>`;
  $('#detail').showModal();$('#close').focus();bindImages();
}
$('#search-icon').innerHTML=icon('search');
$('#hub').insertAdjacentHTML('beforeend',hubs.map(h=>`<option>${escape(h)}</option>`).join(''));
$('#category').insertAdjacentHTML('beforeend',[...new Set(places.map(p=>p.category))].map(c=>`<option value="${escape(c)}">${escape(splitCategory(c).label)}</option>`).join(''));
$('#query').addEventListener('input',()=>{limit=12;render();});
for(const id of ['hub','category'])$('#'+id).addEventListener('change',()=>{limit=12;render();});
$('#more').onclick=()=>{limit+=12;render();};
$('#close').onclick=()=>$('#detail').close();
$('#detail').addEventListener('close',()=>{selected=null;opener?.focus();});
document.addEventListener('click',e=>{
  const w=e.target.closest('[data-want]');if(w){toggle(w.dataset.want);return;}
  const a=e.target.closest('[data-place]');if(a){e.preventDefault();openPlace(a.dataset.place,a);return;}
  const v=e.target.closest('[data-view]');if(v){view=v.dataset.view;limit=12;render();return;}
  if(e.target.closest('#reset')){view='explore';$('#hub').value='';$('#category').value='';$('#query').value='';limit=12;render();return;}
  const retry=e.target.closest('[data-retry]');if(retry){if(selected)openPlaceAfterRetry();else render();}
});
function openPlaceAfterRetry(){const id=selected.id,original=opener;$('#detail').close();openPlace(id,original);}
render();
