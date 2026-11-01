(() => {
"use strict";
const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("es-ES").format(Number(n) || 0);
const compact = n => { const v=Number(n)||0; return v>=1e6 ? (v/1e6).toLocaleString("es-ES",{maximumFractionDigits:2})+" M€" : v>=1000?(v/1000).toLocaleString("es-ES",{maximumFractionDigits:0})+" k€":fmt(v)+" €"; };
const safe = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normal = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();
const position = {t:"Portero",a:"Defensa",m:"Centrocampista",s:"Delantero"};
const events = {gol:"⚽ Gol",asistencia:"🎯 Asistencia",amarilla:"🟨 Amarilla",roja:"🟥 Roja","doble-amarilla":"🟨 Doble amarilla",entra:"🔄 Entrada",sale:"🔁 Sustitución",star:"⭐ Destacado",penalty:"🥅 Penalti"};
let players=[], fichaMap=new Map(), shown=30, pos="", sort="pointsDesc", loaded=false, selected=null, lastFocus=null;
function card(p) {
 const initials=p.jugador.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toLocaleUpperCase("es");
 return `<button class="inf-player" type="button" data-player="${safe(p.jugador)}" aria-label="Ver ficha completa de ${safe(p.jugador)}">
    <div class="inf-player-top"><div class="inf-avatar" aria-hidden="true">${safe(initials)}</div><div><span class="inf-player-team">${safe(p.equipo)}</span><strong class="inf-player-name">${safe(p.jugador)}</strong></div></div>
    <span class="inf-position">${safe(position[p.posicion_filtro]||"")}</span>
    <div class="inf-player-numbers"><div><strong>${fmt(p.puntos)}</strong><small>PUNTOS</small></div><div><strong>${compact(p.valor_eur)}</strong><small>VALOR</small></div></div>
    <div class="inf-player-footer"><span>Ver estadísticas</span><span class="inf-open-arrow" aria-hidden="true">↗</span></div>
  </button>`;
}
function filtered(){
 const q=normal($("infSearch").value),team=normal($("infTeam").value);
 const out=players.filter(p=>(!q||normal(p.jugador+" "+p.equipo).includes(q))&&(!team||normal(p.equipo).includes(team))&&(!pos||p.posicion_filtro===pos));
 out.sort((a,b)=>{
  const result=sort==="nameAsc"?a.jugador.localeCompare(b.jugador,"es"):
   sort==="nameDesc"?b.jugador.localeCompare(a.jugador,"es"):
   sort==="valueAsc"?Number(a.valor_eur)-Number(b.valor_eur):
   sort==="valueDesc"?Number(b.valor_eur)-Number(a.valor_eur):
   sort==="pointsAsc"?Number(a.puntos)-Number(b.puntos):
   Number(b.puntos)-Number(a.puntos);
  return result||a.jugador.localeCompare(b.jugador,"es");
 });
 return out;
}
function render(){
 const list=filtered();
 $("infResultCount").textContent=fmt(list.length)+" jugadores encontrados";
 $("infPlayers").innerHTML=list.length?list.slice(0,shown).map(card).join(""):'<div class="inf-empty">No encontramos futbolistas con esos filtros. Prueba otra búsqueda.</div>';
 $("infMore").hidden=list.length<=shown;
 const useFeatured=!pos&&!$("infSearch").value.trim()&&!$("infTeam").value&&sort==="pointsDesc";
 $("infFeatured").hidden=!useFeatured;
 if(useFeatured){
  $("infFeatured").innerHTML='<div class="inf-featured-head"><span>🏆 LOS MÁS DESTACADOS</span><small>Ranking por puntos</small></div><div class="inf-featured-grid">'+list.slice(0,3).map(card).join("")+'</div>';
  $("infPlayers").innerHTML=list.length>3?list.slice(3,shown+3).map(card).join(""):'';
  $("infMore").hidden=list.length<=shown+3;
 }
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
function openPlayer(name,origin){
 const player=players.find(p=>p.jugador===name);if(!player)return;
 selected=name;lastFocus=origin||document.activeElement;
 $("infDetailBody").innerHTML=details(player);
 $("infOverlay").hidden=false;document.body.style.overflow="hidden";
 $("infDetailBody").parentElement.scrollTop=0;$("infClose").focus();
}
function close(){if($("infOverlay").hidden)return;$("infOverlay").hidden=true;document.body.style.overflow="";selected=null;lastFocus?.focus?.();}
async function load(){
 try{
 const url="../datos-comuniazo-prueba/";
 const responses=await Promise.all([
 fetch(url+"ultimo.json?v="+Date.now(),{cache:"no-store"}),
 fetch(url+"fichas-2627.json?v="+Date.now(),{cache:"no-store"}).catch(()=>null)
 ]);
 if(!responses[0].ok)throw Error("No pudimos cargar la última descarga de Comuniazo.");
 const data=await responses[0].json();
 if(!Array.isArray(data.jugadores)||data.jugadores.length<500)throw Error("La descarga está incompleta.");
 players=data.jugadores.filter(p=>p&&p.fuente_equipo==="Comuniazo"&&p.equipo_estado==="asignado"&&typeof p.equipo==="string"&&p.equipo.trim()&&position[p.posicion_filtro]&&Number.isFinite(Number(p.puntos))&&Number.isFinite(Number(p.valor_eur)));
 if(!players.length)throw Error("No hay jugadores con equipo verificado.");
 if(responses[1]?.ok){try{const f=await responses[1].json();if(Array.isArray(f.fichas))fichaMap=new Map(f.fichas.map(x=>[normal(x.jugador),x]));}catch(e){console.warn("Fichas Comuniazo no disponibles",e)}}
 $("infDate").textContent=data.fecha?data.fecha.split("-").reverse().join("/"):"Última descarga";
 const teams=[...new Set(players.map(p=>p.equipo))].sort((a,b)=>a.localeCompare(b,"es"));
 $("infTotal").textContent=fmt(players.length);
 $("infTeams").textContent=fmt(teams.length);
 $("infRound").textContent=fmt(Math.max(0,...[...fichaMap.values()].flatMap(f=>(f.jornadas||[]).map(w=>Number(w.jornada)||0))));
 loaded=true;render();
 }catch(e){$("infPlayers").innerHTML='<div class="inf-empty">⚠ '+safe(e.message)+'<br><button id="infRetry" type="button" style="margin-top:12px;padding:12px;border:0;border-radius:12px">Volver a intentar</button></div>';$("infResultCount").textContent="No se pudo cargar la información";}
}
$("infSearch").addEventListener("input",()=>{shown=30;render()});
$("infTeam").addEventListener("input",()=>{shown=30;render()});
$("infSort").addEventListener("change",()=>{sort=$("infSort").value;shown=30;render()});
$("infFilterBtn").addEventListener("click",()=>{const opened=$("infFilters").hidden;$("infFilters").hidden=!opened;$("infFilterBtn").setAttribute("aria-expanded",String(opened))});
document.querySelectorAll("[data-pos]").forEach(b=>b.addEventListener("click",()=>{pos=b.dataset.pos;shown=30;document.querySelectorAll("[data-pos]").forEach(x=>x.classList.toggle("is-active",x===b));render()}));
$("infPlayers").addEventListener("click",e=>{const btn=e.target.closest("[data-player]");if(btn)openPlayer(btn.dataset.player,btn)});
$("infFeatured").addEventListener("click",e=>{const btn=e.target.closest("[data-player]");if(btn)openPlayer(btn.dataset.player,btn)});
$("infPlayers").addEventListener("click",e=>{if(e.target.id==="infRetry")load()});
$("infMore").addEventListener("click",()=>{shown+=30;render()});
$("infClose").addEventListener("click",close);
$("infOverlayBg").addEventListener("click",close);
document.addEventListener("keydown",e=>{if(e.key==="Escape")close();if(e.key==="Tab"&&!$("infOverlay").hidden){const focusable=$("infOverlay").querySelectorAll('button,a[href]');const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
load();
})();
