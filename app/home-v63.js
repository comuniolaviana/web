(() => {
"use strict";

const CFG = window.COMUNIO_CONFIG;
if (!CFG || /admin\.html$/i.test(location.pathname)) return;

const client = window.supabase?.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
if (!client) return;

let freshness = {
  clauses: { updated: false, sourceUpdated: "" },
  team_malo: { updated: false, sourceUpdated: "" }
};
let schedule = null;
let homeEnhanced = false;
let lastRefresh = 0;

const $ = id => document.getElementById(id);
const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

function localDate(){
  return new Intl.DateTimeFormat("sv-SE",{
    timeZone: CFG.TIMEZONE || "Europe/Madrid",
    year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date());
}
function localTime(){
  return new Intl.DateTimeFormat("en-GB",{
    timeZone: CFG.TIMEZONE || "Europe/Madrid",
    hour:"2-digit",minute:"2-digit",hour12:false
  }).format(new Date());
}
function sourceDate(value){
  return String(value||"").trim().slice(0,10);
}
function displayUpdate(value){
  const s=String(value||"").trim();
  if(!s) return "Sin fecha de actualización";
  const [d,t=""] = s.split(" ");
  const [y,m,day] = d.split("-");
  return `Última actualización: ${day}/${m}/${y}${t ? " · "+t.slice(0,5) : ""}`;
}
function isFresh(value){
  return sourceDate(value) === localDate();
}
function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function euros(n){
  return Math.round(Number(n)||0).toLocaleString("es-ES")+" €";
}

function enhanceHome(){
  const home = $("homeView");
  if (!home || homeEnhanced) return;

  const oldTeam = home.querySelector('[data-go="myteam"]');
  const oldClauses = home.querySelector('[data-go="clauses"]');
  const oldBad = home.querySelector('[data-go="badteam"]');
  if (!oldTeam || !oldClauses || !oldBad) return;

  // Conservamos los botones originales para mantener los listeners de app.js.
  oldTeam.className = "home-v63-team hero-card";
  oldTeam.innerHTML = `
    <span class="home-v63-team-icon">👕</span>
    <span class="home-v63-team-copy">
      <strong>Mi equipo</strong>
      <small>Plantilla, puntos, valor y cláusulas</small>
    </span>
    <span class="home-v63-arrow">›</span>`;

  oldClauses.className = "home-v63-status-card";
  oldClauses.id = "homeClausesCard";
  oldClauses.innerHTML = statusCardShell("⚡","CLÁUSULAS","Todas las cláusulas de la liga","clauses");

  oldBad.className = "home-v63-status-card";
  oldBad.id = "homeBadCard";
  oldBad.innerHTML = statusCardShell("💀","EQUIPO MALO","Compras y ventas al Equipo Malo","bad");

  const notificationCard = $("notificationCard");
  home.innerHTML = "";
  home.appendChild(oldTeam);
  if (notificationCard) home.appendChild(notificationCard);

  const statusGrid = document.createElement("div");
  statusGrid.className = "home-v63-status-grid";
  statusGrid.append(oldClauses, oldBad);
  home.appendChild(statusGrid);

  const news = document.createElement("section");
  news.className = "home-v63-news";
  news.innerHTML = `
    <div class="home-v63-news-head">
      <div><span>📰</span><strong>Noticias</strong></div>
      <button id="homeNewsAll" type="button">Ver todas ›</button>
    </div>
    <div id="homeNewsList" class="home-v63-news-list">
      <div class="home-v63-empty">Cargando actividad…</div>
    </div>`;
  home.appendChild(news);

  const topNews = document.querySelector('.main-nav [data-view="news"]');
  if (topNews) {
    topNews.classList.add("v63-news-nav-hidden");
    $("homeNewsAll")?.addEventListener("click", () => topNews.click());
  }

  homeEnhanced = true;
}

function statusCardShell(icon,title,subtitle,key){
  return `
    <span class="home-v63-card-top">
      <span class="home-v63-card-icon">${icon}</span>
      <span class="home-v63-card-heading">
        <strong>${title}</strong>
        <small>${subtitle}</small>
      </span>
      <span class="home-v63-arrow">›</span>
    </span>
    <span id="${key}Period" class="home-v63-period">Comprobando…</span>
    <span class="home-v63-meta">
      <span>🕒 Horario oficial</span>
      <b id="${key}Hours">—</b>
    </span>
    <span class="home-v63-meta">
      <span>📅 Día permitido</span>
      <b id="${key}Day">—</b>
    </span>
    <span id="${key}FreshRow" class="home-v63-fresh">
      <span id="${key}FreshIcon">⏳</span>
      <span>
        <b id="${key}Fresh">Comprobando datos…</b>
        <small id="${key}FreshTime"></small>
      </span>
    </span>
    <span id="${key}Lock" class="home-v63-lock hidden"></span>`;
}

function clausePeriod(){
  const open = String(schedule?.opens_at || CFG.DEFAULT_OPEN || "15:00").slice(0,5);
  const close = String(schedule?.closes_at || CFG.DEFAULT_CLOSE || "21:00").slice(0,5);
  if (!schedule || !schedule.enabled) {
    return {state:"closed",label:"HOY NO ES DÍA DE CLÁUSULAS",day:"No",hours:`${open} – ${close}`,openNow:false};
  }
  const t=localTime();
  if(t<open) return {state:"pending",label:`HOY SE ABRE A LAS ${open}`,day:"Sí",hours:`${open} – ${close}`,openNow:false};
  if(t>=close) return {state:"closed",label:"HORARIO TERMINADO",day:"Sí",hours:`${open} – ${close}`,openNow:false};
  return {state:"open",label:"ABIERTO AHORA",day:"Sí",hours:`${open} – ${close}`,openNow:true};
}
function badPeriod(){
  const open=CFG.BADTEAM_OPEN||"12:00";
  const close=CFG.BADTEAM_CLOSE||"00:00";
  const t=localTime();
  const openNow = close==="00:00" ? t>=open : (t>=open && t<close);
  if(openNow) return {state:"open",label:"ABIERTO AHORA",day:"Sí",hours:`${open} – ${close}`,openNow:true};
  return {state:"pending",label:`HOY SE ABRE A LAS ${open}`,day:"Sí",hours:`${open} – ${close}`,openNow:false};
}

function paintCard(key, period, fresh){
  const card = key==="clauses" ? $("homeClausesCard") : $("homeBadCard");
  if(!card) return;

  card.dataset.state = period.state;
  const p=$(key+"Period");
  const h=$(key+"Hours");
  const d=$(key+"Day");
  const fr=$(key+"FreshRow");
  const fi=$(key+"FreshIcon");
  const ft=$(key+"Fresh");
  const ftime=$(key+"FreshTime");
  const lock=$(key+"Lock");

  if(p) p.textContent=period.label;
  if(h) h.textContent=period.hours;
  if(d) d.textContent=period.day;
  if(fr) fr.dataset.fresh = fresh.updated ? "yes" : "no";
  if(fi) fi.textContent = fresh.updated ? "✅" : "⚠️";
  if(ft) ft.textContent = fresh.updated ? "Datos actualizados hoy" : "Datos pendientes de actualizar";
  if(ftime) ftime.textContent = displayUpdate(fresh.sourceUpdated);

  const blocked = period.openNow && !fresh.updated;
  if(lock){
    lock.classList.toggle("hidden",!blocked);
    lock.textContent = blocked ? "🔒 Operaciones bloqueadas hasta actualizar los datos" : "";
  }
}

async function loadStatus(){
  const day=localDate();
  const [sched, sync] = await Promise.all([
    client.from("clause_days").select("*").eq("day",day).maybeSingle(),
    client.from("data_sync_state").select("source,source_updated").in("source",["clauses","team_malo"])
  ]);

  if(!sched.error) schedule=sched.data||null;

  if(!sync.error){
    const map=Object.fromEntries((sync.data||[]).map(x=>[x.source,x.source_updated||""]));
    freshness.clauses={sourceUpdated:map.clauses||"",updated:isFresh(map.clauses)};
    freshness.team_malo={sourceUpdated:map.team_malo||"",updated:isFresh(map.team_malo)};
  }
}

function setStaleLock(selector, locked, label){
  document.querySelectorAll(selector).forEach(btn=>{
    if(locked){
      if(btn.dataset.v63Stale!=="1"){
        btn.dataset.v63Stale="1";
        btn.dataset.v63WasDisabled=btn.disabled?"1":"0";
        btn.dataset.v63Html=btn.innerHTML;
      }
      btn.disabled=true;
      btn.classList.add("v63-stale-disabled");
      if(label) btn.innerHTML=label;
      btn.title="Datos pendientes de actualizar";
    }else if(btn.dataset.v63Stale==="1"){
      btn.disabled=btn.dataset.v63WasDisabled==="1";
      if(btn.dataset.v63Html) btn.innerHTML=btn.dataset.v63Html;
      btn.classList.remove("v63-stale-disabled");
      btn.removeAttribute("title");
      delete btn.dataset.v63Stale;
      delete btn.dataset.v63WasDisabled;
      delete btn.dataset.v63Html;
    }
  });
}

function applyOperationLocks(){
  setStaleLock("#playersList .execute-btn", !freshness.clauses.updated, "SIN ACTUALIZAR");
  setStaleLock("#badPlayersList .bad-buy-btn", !freshness.team_malo.updated, "SIN ACTUALIZAR");
  setStaleLock("#myTeamList .sell-bad-btn", !freshness.team_malo.updated, 'BLOQUEADO<small>DATOS ⚠️</small>');

  const clauseBanner=$("userStateBanner");
  if(clauseBanner && !freshness.clauses.updated){
    clauseBanner.textContent="⚠️ Datos de cláusulas pendientes de actualizar. No se puede ejecutar ninguna cláusula.";
    clauseBanner.classList.remove("hidden");
    clauseBanner.classList.add("v63-stale-banner");
  } else if(clauseBanner) {
    clauseBanner.classList.remove("v63-stale-banner");
  }

  [$("badTeamStateBanner"),$("myTeamBadState")].forEach(el=>{
    if(!el) return;
    if(!freshness.team_malo.updated){
      el.textContent="⚠️ Equipo Malo pendiente de actualizar. Compras y ventas están bloqueadas.";
      el.classList.remove("hidden");
      el.classList.add("v63-stale-banner");
    } else {
      el.classList.remove("v63-stale-banner");
    }
  });
}

function newsTime(value){
  const d=new Date(value||0);
  if(!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES",{
    timeZone:CFG.TIMEZONE||"Europe/Madrid",hour:"2-digit",minute:"2-digit"
  }).format(d);
}
function newsRow(e){
  const time=newsTime(e._time);
  if(e._type==="badteam"){
    return `<article class="home-v63-news-row">
      <span class="home-v63-news-icon buy">💀</span>
      <span><b>${escapeHtml(e.buyer_name||"")} compra a ${escapeHtml(e.player_name||"")}</b>
      <small>${euros(e.clause_value)} · ${time}</small></span></article>`;
  }
  if(e._type==="badsale"){
    return `<article class="home-v63-news-row">
      <span class="home-v63-news-icon sale">💰</span>
      <span><b>${escapeHtml(e.seller_name||"")} vende a ${escapeHtml(e.player_name||"")}</b>
      <small>${euros(e.sale_value??e.market_value)} · ${time}</small></span></article>`;
  }
  return `<article class="home-v63-news-row">
    <span class="home-v63-news-icon clause">⚡</span>
    <span><b>${escapeHtml(e.executor_name||"")} ejecuta la cláusula de ${escapeHtml(e.player_name||"")}</b>
    <small>de ${escapeHtml(e.target_owner_name||"")} · ${euros(e.clause_value)} · ${time}</small></span></article>`;
}

async function loadHomeNews(){
  const box=$("homeNewsList");
  if(!box) return;
  const day=localDate();
  const [c,b,s]=await Promise.all([
    client.from("clause_executions").select("*").eq("clause_day",day).order("executed_at",{ascending:false}),
    client.from("team_malo_purchases").select("*").eq("purchase_day",day).order("executed_at",{ascending:false}),
    client.from("team_malo_sales").select("*").eq("sale_day",day).order("executed_at",{ascending:false})
  ]);

  const arr=[
    ...(c.data||[]).map(x=>({...x,_type:"clause",_time:x.executed_at})),
    ...(b.data||[]).map(x=>({...x,_type:"badteam",_time:x.executed_at})),
    ...(s.data||[]).map(x=>({...x,_type:"badsale",_time:x.executed_at}))
  ].sort((a,b)=>new Date(b._time)-new Date(a._time)).slice(0,4);

  box.innerHTML=arr.length?arr.map(newsRow).join(""):'<div class="home-v63-empty">Todavía no hay movimientos hoy.</div>';
}

async function refreshHome(force=false){
  enhanceHome();
  const now=Date.now();
  if(force || now-lastRefresh>45000){
    lastRefresh=now;
    try{ await loadStatus(); }catch(e){ console.error("Portada V6.3:",e); }
    try{ await loadHomeNews(); }catch(e){ console.error("Noticias portada:",e); }
  }
  paintCard("clauses",clausePeriod(),freshness.clauses);
  paintCard("bad",badPeriod(),freshness.team_malo);
  applyOperationLocks();
}

function init(){
  enhanceHome();
  refreshHome(true);

  const observer=new MutationObserver(()=>{
    enhanceHome();
    paintCard("clauses",clausePeriod(),freshness.clauses);
    paintCard("bad",badPeriod(),freshness.team_malo);
    applyOperationLocks();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  setInterval(()=>refreshHome(false),60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshHome(true);});

  client.auth.onAuthStateChange((_event,session)=>{
    if(session) setTimeout(()=>refreshHome(true),250);
  });
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",()=>setTimeout(init,0),{once:true});
}else{
  setTimeout(init,0);
}
})();