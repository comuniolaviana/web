(() => {
"use strict";
// Misma fuente y mismo diseño de la ficha de Información; no se modifica Supabase.
const fmt = n => new Intl.NumberFormat("es-ES").format(Number(n) || 0);
const compact = n => { const v=Number(n)||0; return v>=1e6 ? (v/1e6).toLocaleString("es-ES",{maximumFractionDigits:2})+" M€" : v>=1000?(v/1000).toLocaleString("es-ES",{maximumFractionDigits:0})+" k€":fmt(v)+" €"; };
const safe = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normal = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();
const position = {t:"Portero",a:"Defensa",m:"Centrocampista",s:"Delantero"};
const events = {gol:"⚽ Gol",asistencia:"🎯 Asistencia",amarilla:"🟨 Amarilla",roja:"🟥 Roja","doble-amarilla":"🟨 Doble amarilla",entra:"🔄 Entrada",sale:"🔁 Sustitución",star:"⭐ Destacado",penalty:"🥅 Penalti"};

const STORAGE_TTL=15*60*1000;
let ficheroFecha="", fichasFecha="", sourceMismatch=false, lastAttempt=0, lastCheckedDate="", lastSignature="", loaded=false, inflight=null;
let fichaMap=new Map(), catalogMap=new Map(), previousFocus=null, previousOverflow="", openToken=0;

function madridDay(){
 return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function shortDate(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day||""))return "—";
 const [y,m,d]=day.split("-");
 return d+"/"+m+"/"+y;
}
function statsFor(name){
 if(!loaded||sourceMismatch)return null;
 const ficha=fichaMap.get(normal(name));
 if(!ficha||ficha.error||!Array.isArray(ficha.jornadas)||!ficha.jornadas.some(w=>Number.isInteger(w.jornada)))return null;
 const stats={gol:0,asistencia:0,amarilla:0};
 for(const w of ficha.jornadas){
  if(!Number.isInteger(w.jornada))continue;
  for(const event of Array.isArray(w.eventos)?w.eventos:[]){
   if(Object.prototype.hasOwnProperty.call(stats,event))stats[event]++;
  }
 }
 return stats;
}
function compactStats(name){
 const stats=statsFor(name);
 const display=(icon,key,label)=>'<span class="myteam-stat-pill" title="'+safe(label)+' · Comuniazo '+shortDate(fichasFecha)+'" aria-label="'+safe(label)+': '+(stats?stats[key]:"dato no disponible")+'">'+icon+'<b>'+(stats?stats[key]:"—")+'</b></span>';
 return '<span class="myteam-stat-pills" aria-label="Estadísticas de la temporada">'+
  display("⚽","gol","Goles")+display("👟","asistencia","Asistencias")+display("🟨","amarilla","Tarjetas amarillas")+'</span>';
}
async function refreshIfNeeded(publication="",force=false){
 const signature=String(publication||"");
 const currentDay=madridDay(),now=Date.now();
 if(inflight)return inflight;
 if(!force && lastSignature===signature && lastCheckedDate===currentDay && now-lastAttempt<STORAGE_TTL)
  return loaded;
 lastAttempt=now;lastSignature=signature;lastCheckedDate=currentDay;
 inflight=(async()=>{
  const base="../datos-comuniazo-prueba/";
  const qs="?v="+Date.now();
  const [catalogResponse,fichasResponse]=await Promise.all([
   fetch(base+"ultimo.json"+qs,{cache:"no-store"}),
   fetch(base+"fichas-2627.json"+qs,{cache:"no-store"})
  ]);
  if(!catalogResponse.ok||!fichasResponse.ok)throw Error("No se pudieron descargar las fichas de Comuniazo.");
  const [catalog,feed]=await Promise.all([catalogResponse.json(),fichasResponse.json()]);
  if(!Array.isArray(catalog.jugadores)||catalog.jugadores.length<550
    ||!Array.isArray(feed.fichas)||feed.fichas.length<500)
     throw Error("Descarga incompleta: se conservan los datos anteriores.");
  const updatedCatalog=new Map(),updatedFichas=new Map();
  for(const row of catalog.jugadores){
   const key=normal(row.jugador);
   if(key && !updatedCatalog.has(key))updatedCatalog.set(key,row);
  }
  for(const row of feed.fichas){
   const key=normal(row.jugador);
   if(key && !updatedFichas.has(key))updatedFichas.set(key,row);
  }
  const a=String(catalog.fecha||"").slice(0,10),b=String(feed.fecha||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(a)||!(/^\d{4}-\d{2}-\d{2}$/.test(b)))throw Error("Las fichas no indican una fecha válida.");
  catalogMap=updatedCatalog;fichaMap=updatedFichas;
  ficheroFecha=a;fichasFecha=b;sourceMismatch=a!==b;
  loaded=true;
  document.dispatchEvent(new Event("mi-equipo-fichas-cargadas"));
  return true;
 })().catch(error=>{
  console.warn("Estadísticas de Mi equipo:",error);
  return loaded;
 }).finally(()=>{inflight=null;});
 return inflight;
}

function details(p){
 const f=fichaMap.get(normal(p.jugador));
 const weeks=Array.isArray(f?.jornadas)?f.jornadas:[];
 const rounds=weeks.filter(x=>Number.isInteger(x.jornada));
 const numeric=rounds.filter(x=>Number.isFinite(Number(x.puntos))&&x.puntos!==null);
 const avg=numeric.length?numeric.reduce((sum,x)=>sum+Number(x.puntos),0)/numeric.length:null;
 const best=numeric.length?Math.max(...numeric.map(x=>Number(x.puntos))):null;
 const count={};for(const w of rounds)for(const e of w.eventos||[])count[e]=(count[e]||0)+1;
 const pills=Object.entries(count).filter(([_,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([e,v])=>`<span class="inf-event">${safe(events[e]||e)} · ${v}</span>`).join("");
 const stats=Object.values(f?.estadisticas_visibles||{}).filter(Boolean);
 const url=String(p.url_ficha||f?.url||"");
 const allowed=/^https:\/\/www\.comuniazo\.com\/comunio-apuestas\/jugadores\/[a-z0-9-]+\/?$/.test(url);
 return `<div class="inf-detail-hero">
  <span class="inf-detail-label">✦ FICHA DEL FUTBOLISTA · 2026/27</span>
  <h2 id="infDetailName">${safe(p.jugador)}</h2>
  <p>${safe(p.equipo)}</p>
  <div class="inf-detail-badges"><span>⚽ ${safe(position[p.posicion_filtro]||"Posición no disponible")}</span><span>📅 Actualizado ${safe(p.fecha||"—")}</span><span>Comuniazo</span></div>
 </div>
 <div class="inf-detail-stats"><div><strong>${fmt(p.puntos)}</strong><small>PUNTOS TOTALES</small></div><div><strong>${compact(p.valor_eur)}</strong><small>VALOR ACTUAL</small></div><div><strong>${avg===null?"—":avg.toLocaleString("es-ES",{maximumFractionDigits:1})}</strong><small>MEDIA / JUGADA</small></div></div>
 <div class="inf-detail-section"><h3>📈 Rendimiento de la temporada</h3><div class="inf-detail-stats" style="padding:0"><div><strong>${numeric.length}</strong><small>JORNADAS PUNTUADAS</small></div><div><strong>${best===null?"—":fmt(best)}</strong><small>MEJOR JORNADA</small></div><div><strong>${Object.values(count).reduce((a,b)=>a+b,0)}</strong><small>EVENTOS REGISTRADOS</small></div></div></div>
 <div class="inf-detail-section"><h3>⭐ Eventos de la temporada</h3><div class="inf-events">${pills||'<p class="inf-note">Sin eventos registrados en las fichas descargadas.</p>'}</div></div>
 <div class="inf-detail-section"><h3>📅 Puntos jornada a jornada</h3>
 <div class="inf-rounds">${rounds.length?rounds.map(w=>`<div class="inf-round ${Number(w.puntos)<0?"negative":""}"><span>JORNADA ${fmt(w.jornada)}</span><strong>${w.puntos===null?"—":fmt(w.puntos)}</strong><small>${safe((w.eventos||[]).map(e=>events[e]||e).join(" · ")||w.estado||"Sin eventos")}</small></div>`).join(""):'<p class="inf-note">Comuniazo no dispone de desglose por jornada para este jugador.</p>'}</div></div>
 ${stats.length?'<div class="inf-detail-section"><h3>💹 Evolución y otros datos</h3>'+stats.map(t=>'<div class="inf-valuation"><b>Datos publicados por Comuniazo</b>'+safe(t)+'</div>').join("")+'</div>':''}
 <div class="inf-detail-section"><p class="inf-note">Datos de Comuniazo. Las puntuaciones pueden diferir de las utilizadas oficialmente en Comunio Laviana.</p>
 ${allowed?'<a class="inf-source-link" href="'+safe(url)+'" rel="noopener noreferrer" target="_blank">Consultar ficha original de Comuniazo ↗</a>':''}</div>`;
}


const modal=()=>document.getElementById("myTeamInfoModal");
const closeButton=()=>document.getElementById("myTeamInfoClose");
const dialog=()=>document.getElementById("myTeamInfoDialog");
function close(){
 const node=modal();
 if(!node||node.hidden)return;
 ++openToken;
 node.hidden=true;
 document.body.style.overflow=previousOverflow;
 if(previousFocus?.isConnected)previousFocus.focus();
 previousFocus=null;
}
async function open(player,publication=""){
 if(!player||!player.name||!modal())return;
 const token=++openToken;
 const node=modal();
 previousFocus=document.activeElement;
 previousOverflow=document.body.style.overflow;
 document.body.style.overflow="hidden";
 node.hidden=false;
 document.getElementById("myTeamInfoBody").innerHTML='<div class="myinfo-loading" id="myTeamInfoTitle">Cargando ficha de '+safe(player.name)+'…</div>';
 dialog().scrollTop=0;
 closeButton().focus();
 await refreshIfNeeded(publication,!loaded);
 if(token!==openToken||node.hidden)return;
 const row=catalogMap.get(normal(player.name));
 const model={
  jugador:player.name,
  equipo:player.team||row?.equipo||"",
  posicion_filtro:({portero:"t",defensa:"a",medio:"m",delantero:"s"})[player.position]||row?.posicion_filtro||"",
  puntos:Number(player.points)||0,
  valor_eur:Number(player.market_value)||0,
  fecha:ficheroFecha||"—",
  url_ficha:row?.url_ficha||""
 };
 let content=details(model).replace('id="infDetailName"','id="myTeamInfoTitle"');
 const owner=safe(player.owner_name||"—");
 const market=euros(player.clause_value);
 const notice=!loaded?"No se pudieron cargar las fichas de Comuniazo.":sourceMismatch?
  "⚠️ La descarga de puntuaciones y la de fichas pertenecen a fechas distintas; revisa la actualización.":
  ficheroFecha!==madridDay()?
  "Última descarga: "+shortDate(ficheroFecha)+". Los datos aún no son los de hoy.":"Datos descargados: "+shortDate(ficheroFecha)+".";
 content+='<div class="myinfo-league"><h3>🔐 Datos de Comunio Laviana</h3>'+
 '<div><span>Cláusula actual</span><strong>'+market+'</strong></div>'+
 '<div><span>Propietario</span><strong>'+owner+'</strong></div>'+
 '<p>'+safe(notice)+'</p></div>';
 if(!loaded||sourceMismatch)
  content+='<p class="myinfo-warning">Los goles, asistencias y tarjetas no se consideran verificados hasta disponer de las dos descargas.</p>';
 document.getElementById("myTeamInfoBody").innerHTML=content;
 dialog().scrollTop=0;
}
function euros(value){return Math.round(Number(value)||0).toLocaleString("es-ES")+" €";}
function init(){
 const node=modal();
 if(!node)return;
 closeButton().addEventListener("click",close);
 document.getElementById("myTeamInfoBackdrop").addEventListener("click",close);
 document.addEventListener("keydown",e=>{
  if(node.hidden)return;
  if(e.key==="Escape"){e.preventDefault();close();return;}
  if(e.key!=="Tab")return;
  const tabbables=[...node.querySelectorAll('button:not([disabled]),a[href]')].filter(x=>x.getClientRects().length);
  if(!tabbables.length)return;
  const first=tabbables[0],last=tabbables[tabbables.length-1];
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
 });
}
window.ComunioMyTeamInfo={compactStats,refreshIfNeeded,open,close};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
