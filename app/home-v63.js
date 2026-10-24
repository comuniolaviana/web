(() => {
"use strict";

const CFG = window.COMUNIO_CONFIG;
if (!CFG || /admin\.html$/i.test(location.pathname)) return;
const client = window.supabase?.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
if (!client) return;

const $ = id => document.getElementById(id);
let freshness = {
  clauses:{updated:false,sourceUpdated:""},
  team_malo:{updated:false,sourceUpdated:""}
};
let schedule=null, lastRefresh=0;

function localDate(){
  return new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE||"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function localTime(){
  return new Intl.DateTimeFormat("en-GB",{timeZone:CFG.TIMEZONE||"Europe/Madrid",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
}
function sourceDate(v){ return String(v||"").trim().slice(0,10); }
function isFresh(v){ return sourceDate(v)===localDate(); }
function displayUpdate(v){
  const s=String(v||"").trim();
  if(!s) return "Sin fecha de actualización";
  const [d,t=""]=s.split(" ");
  const [y,m,day]=(d||"").split("-");
  if(!y||!m||!day) return s;
  return `Última actualización: ${day}/${m}/${y}${t?" "+t.slice(0,5):""}`;
}
function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function euros(n){ return Math.round(Number(n)||0).toLocaleString("es-ES")+" €"; }

function proxy(selector){ return document.querySelector(selector); }
function clickProxy(selector){ proxy(selector)?.click(); }

function ensureChrome(){
  document.body.classList.add("v65-ui");

  if(!$("v65Header")){
    const header=document.createElement("header");
    header.id="v65Header";
    header.className="v65-header";
    header.innerHTML=`
      <div class="v65-brandmark"><span>👑</span><b>⚽</b></div>
      <div class="v65-brandcopy">
        <strong>Comunio Laviana</strong>
        <small>TEMPORADA 2026/27</small>
      </div>
      <nav class="v65-headlinks" aria-label="Accesos directos">
        <a href="viejo-zorro.html" class="v65-shortcut" aria-label="Viejo Zorro"><span>🦊</span><small>Viejo Zorro</small></a>
        <a href="fairplay.html" class="v65-shortcut" aria-label="Fair Play"><span>🟨</span><small>Fair Play</small></a>
        <button id="v65Bell" class="v65-headbtn" type="button" aria-label="Notificaciones"><span>🔔</span><small>Avisos</small></button>
      </nav>`;
    document.body.prepend(header);
    $("v65Bell")?.addEventListener("click",()=>{
      const card=$("notificationCard");
      if(!card) return;
      card.classList.toggle("v65-notif-open");
      if(card.classList.contains("v65-notif-open")){
        card.scrollIntoView({behavior:"smooth",block:"center"});
      }
    });
  }

  if(!$("v65BottomNav")){
    const nav=document.createElement("nav");
    nav.id="v65BottomNav";
    nav.className="v65-bottom-nav";
    nav.innerHTML=`
      <button data-v65-go="home"><span>🏠</span><b>Inicio</b></button>
      <button data-v65-go="rules"><span>📜</span><b>Normas</b></button>
      <a href="jornadas.html"><span>📅</span><b>Jornadas</b></a>
      <button data-v65-go="honours"><span>🏆</span><b>Palmarés</b></button>
      <a id="v65AdminBottom" class="hidden" href="admin.html"><span>🛠️</span><b>Admin</b></a>`;
    document.body.appendChild(nav);
    nav.querySelectorAll("[data-v65-go]").forEach(btn=>btn.addEventListener("click",()=>{
      const name=btn.dataset.v65Go;
      clickProxy(`.main-nav [data-view="${name}"]`);
      setActiveNav(name);
    }));
  }

  const admin=proxy("#adminNav");
  $("v65AdminBottom")?.classList.toggle("hidden",admin?.classList.contains("hidden")!==false);
}

function setActiveNav(name){
  document.querySelectorAll("#v65BottomNav button").forEach(b=>b.classList.toggle("active",b.dataset.v65Go===name));
}
function statusShell(icon,title,subtitle,key){
  return `
    <div class="v65-card-title">
      <span class="v65-card-icon">${icon}</span>
      <div><strong>${title}</strong><small>${subtitle}</small></div>
      <span class="v65-chevron">›</span>
    </div>
    <div id="${key}PeriodBox" class="v65-period">
      <span id="${key}PeriodIcon">▶</span>
      <div><b id="${key}Period">Comprobando…</b><small id="${key}PeriodSub"></small></div>
    </div>
    <div class="v65-info-row"><span>◷ <em>Horario oficial</em></span><b id="${key}Hours">—</b></div>
    <div class="v65-info-row"><span>▣ <em id="${key}DayLabel">Día permitido</em></span><b id="${key}Day">—</b></div>
    <div id="${key}FreshRow" class="v65-fresh-row">
      <span>▤</span><div><b id="${key}Fresh">Comprobando datos…</b><small id="${key}FreshTime"></small></div><strong id="${key}FreshIcon">…</strong>
    </div>
    <div id="${key}Lock" class="v65-lock hidden"></div>
    <div class="v65-card-cta" id="${key}Cta"></div>`;
}

function ensureHome(){
  const home=$("homeView"); if(!home)return;
  const oldHero=home.querySelector(":scope > .hero-card");
  const oldStats=home.querySelector(":scope > .stats-grid");
  const oldActions=home.querySelector(":scope > .home-actions");
  [oldHero,oldStats,oldActions].forEach(x=>x?.classList.add("v65-legacy-hidden"));

  let root=$("homeV65Root");
  if(!root){
    root=document.createElement("div");
    root.id="homeV65Root";
    root.className="v65-home";
    root.innerHTML=`
      <button id="homeV65Team" class="v65-team-card" type="button">
        <span class="v65-team-icon">👕</span>
        <span><b>Mi equipo</b><small>Ver plantilla, puntos, valor y estadísticas</small></span>
        <i>›</i>
      </button>

      <div class="v65-status-grid">
        <button id="homeClausesCard" class="v65-status-card" type="button">
          ${statusShell("🔨","CLÁUSULAS","Todas las cláusulas de la liga","clauses")}
        </button>
        <button id="homeBadCard" class="v65-status-card" type="button">
          ${statusShell("👹","EQUIPO MALO","Compras y ventas al equipo malo","bad")}
        </button>
      </div>

      <section class="v65-news">
        <div class="v65-news-head"><div><span>📰</span><strong>Noticias</strong></div><button id="homeNewsAll" type="button">Ver todas ›</button></div>
        <div id="homeNewsList" class="v65-news-list"><div class="v65-empty">Cargando actividad…</div></div>
      </section>`;
    home.insertBefore(root,oldHero||home.firstChild);
    $("homeV65Team")?.addEventListener("click",()=>home.querySelector('.home-actions [data-go="myteam"]')?.click());
    $("homeClausesCard")?.addEventListener("click",()=>home.querySelector('.home-actions [data-go="clauses"]')?.click());
    $("homeBadCard")?.addEventListener("click",()=>home.querySelector('.home-actions [data-go="badteam"]')?.click());
    $("homeNewsAll")?.addEventListener("click",()=>clickProxy('.main-nav [data-view="news"]'));
  }
}

function clausePeriod(){
  const open=String(schedule?.opens_at||CFG.DEFAULT_OPEN||"15:00").slice(0,5);
  const close=String(schedule?.closes_at||CFG.DEFAULT_CLOSE||"21:00").slice(0,5);
  if(!schedule||!schedule.enabled) return {state:"closed",label:"HOY NO ES DÍA",sub:"Hoy no se pueden ejecutar cláusulas",day:"✕",dayLabel:"Hoy no es día de cláusulas",hours:`${open} – ${close}`,openNow:false};
  const t=localTime();
  if(t<open) return {state:"pending",label:`HOY SE ABRE A LAS ${open}`,sub:"Aún no puedes ejecutar cláusulas",day:"✓",dayLabel:"Hoy es día de cláusulas",hours:`${open} – ${close}`,openNow:false};
  if(t>=close) return {state:"closed",label:"HORARIO TERMINADO",sub:`Cerró a las ${close}`,day:"✓",dayLabel:"Hoy es día de cláusulas",hours:`${open} – ${close}`,openNow:false};
  return {state:"open",label:"ABIERTO AHORA",sub:"Puedes ejecutar cláusulas",day:"✓",dayLabel:"Hoy es día de cláusulas",hours:`${open} – ${close}`,openNow:true};
}
function badPeriod(){
  const open=CFG.BADTEAM_OPEN||"12:00",close=CFG.BADTEAM_CLOSE||"00:00",t=localTime();
  const ok=close==="00:00"?t>=open:(t>=open&&t<close);
  return ok
    ? {state:"open",label:"ABIERTO AHORA",sub:"Puedes realizar operaciones",day:"✓",dayLabel:"Hoy es día de Equipo Malo",hours:`${open} – ${close}`,openNow:true}
    : {state:"pending",label:`HOY SE ABRE A LAS ${open}`,sub:"Aún no puedes realizar operaciones",day:"✓",dayLabel:"Hoy es día de Equipo Malo",hours:`${open} – ${close}`,openNow:false};
}

function paint(key,p,fresh){
  const card=key==="clauses"?$("homeClausesCard"):$("homeBadCard"); if(!card)return;
  card.dataset.state=p.state;
  $(key+"Period").textContent=p.label;
  $(key+"PeriodSub").textContent=p.sub;
  $(key+"Hours").textContent=p.hours;
  $(key+"DayLabel").textContent=p.dayLabel;
  $(key+"Day").textContent=p.day;
  $(key+"FreshRow").dataset.fresh=fresh.updated?"yes":"no";
  $(key+"Fresh").textContent=fresh.updated?"Datos actualizados hoy":"Datos pendientes de actualizar";
  $(key+"FreshTime").textContent=displayUpdate(fresh.sourceUpdated);
  $(key+"FreshIcon").textContent=fresh.updated?"✓":"!";
  $(key+"PeriodIcon").textContent=p.state==="open"?"▶":p.state==="pending"?"◷":"■";
  $(key+"Cta").innerHTML=key==="clauses"?"Ver todas las cláusulas <span>›</span>":"Ver equipo malo <span>›</span>";
  const lock=$(key+"Lock"), blocked=p.openNow&&!fresh.updated;
  lock.classList.toggle("hidden",!blocked);
  lock.textContent=blocked?"🔒 Operaciones bloqueadas hasta actualizar los datos":"";
}

async function loadStatus(){
  const day=localDate();
  const [sched,sync]=await Promise.all([
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

function relativeTime(v){
  const d=new Date(v||0), now=new Date();
  if(!Number.isFinite(d.getTime()))return "";
  const min=Math.max(0,Math.floor((now-d)/60000));
  if(min<1)return "Ahora";
  if(min<60)return `Hace ${min} min`;
  const h=Math.floor(min/60); if(h<24)return `Hace ${h} h`;
  return new Intl.DateTimeFormat("es-ES",{timeZone:CFG.TIMEZONE||"Europe/Madrid",day:"2-digit",month:"2-digit"}).format(d);
}
function newsRow(e){
  const ago=relativeTime(e._time);
  let icon="🔨",cls="clause",title="";
  if(e._type==="inauguracion"){
    icon="🦊";cls="fairplay";title=`<span style="display:block">${escapeHtml(e.title)}</span><img src="zorro-inauguracion-cover.svg" alt="Cartel de inauguración" style="width:100%;max-height:260px;object-fit:cover;border-radius:10px;margin:9px 0"><span style="font-size:13px">¡Bienvenidos a la nueva aplicación! Pulsa para ver la noticia.</span>`;
  }else if(e._type==="fairplay"){
    icon="🟨";cls="fairplay";title=`${escapeHtml(e.manager_name)} recibe ${e.card_count===2?"dos tarjetas amarillas":"una tarjeta amarilla"}: ${escapeHtml(e.reason)}`;
  }else if(e._type==="badteam"){
    icon="🪙";cls="buy";title=`${escapeHtml(e.buyer_name||"")} ficha a ${escapeHtml(e.player_name||"")} por ${euros(e.clause_value)}`;
  }else if(e._type==="badsale"){
    icon="↔";cls="sale";title=`${escapeHtml(e.player_name||"")} al Equipo Malo por ${euros(e.sale_value??e.market_value)}`;
  }else{
    title=`${escapeHtml(e.executor_name||"")} ejecuta la cláusula de ${escapeHtml(e.player_name||"")}`;
  }
  return `<button class="v65-news-row" type="button"><span class="v65-news-icon ${cls}">${icon}</span><span><b>${title}</b><small>${ago}</small></span><i>›</i></button>`;
}
async function loadHomeNews(){
  const box=$("homeNewsList");if(!box)return;
  const day=localDate();
  const [c,b,s,f,pubs]=await Promise.all([
    client.from("clause_executions").select("*").eq("clause_day",day).order("executed_at",{ascending:false}),
    client.from("team_malo_purchases").select("*").eq("purchase_day",day).order("executed_at",{ascending:false}),
    client.from("team_malo_sales").select("*").eq("sale_day",day).order("executed_at",{ascending:false}),
    client.from("fairplay_cards").select("*").gte("sanctioned_at",new Date(Date.now()-48*3600000).toISOString()).order("sanctioned_at",{ascending:false}),
    fetch("zorro-publicaciones.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{articles:[]}).catch(()=>({articles:[]}))
  ]);
  const arr=[
    ...((pubs.articles||[]).filter(x=>x.published_at&&Date.parse(x.published_at)<=Date.now()&&new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE||"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(x.published_at))===day).map(x=>({...x,_type:"inauguracion",_time:x.published_at}))),
    ...(c.data||[]).map(x=>({...x,_type:"clause",_time:x.executed_at})),
    ...(b.data||[]).map(x=>({...x,_type:"badteam",_time:x.executed_at})),
    ...(s.data||[]).map(x=>({...x,_type:"badsale",_time:x.executed_at})),
    ...(f.data||[]).filter(x=>new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE||"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(x.sanctioned_at))===day).map(x=>({...x,_type:"fairplay",_time:x.sanctioned_at}))
  ].sort((a,b)=>new Date(b._time)-new Date(a._time)).slice(0,3);
  box.innerHTML=arr.length?arr.map(newsRow).join(""):'<div class="v65-empty">Todavía no hay movimientos hoy.</div>';
  box.querySelectorAll(".v65-news-row").forEach((node,i)=>node.addEventListener("click",()=>{if(arr[i]?._type==="inauguracion")location.href="zorro-inauguracion-2026.html";else if(arr[i]?._type==="fairplay")location.href="fairplay.html?card="+encodeURIComponent(arr[i].id);else clickProxy('.main-nav [data-view="news"]');}));
}

function setStaleLock(selector,locked,label){
  document.querySelectorAll(selector).forEach(btn=>{
    if(locked){
      if(btn.dataset.v65Stale!=="1"){
        btn.dataset.v65Stale="1";
        btn.dataset.v65WasDisabled=btn.disabled?"1":"0";
        btn.dataset.v65Html=btn.innerHTML;
        if(label)btn.innerHTML=label;
      }
      btn.disabled=true;btn.classList.add("v65-stale-disabled");
    }else if(btn.dataset.v65Stale==="1"){
      btn.disabled=btn.dataset.v65WasDisabled==="1";
      if(btn.dataset.v65Html)btn.innerHTML=btn.dataset.v65Html;
      btn.classList.remove("v65-stale-disabled");
      delete btn.dataset.v65Stale;delete btn.dataset.v65WasDisabled;delete btn.dataset.v65Html;
    }
  });
}
function applyLocks(){
  setStaleLock("#playersList .execute-btn",!freshness.clauses.updated,"SIN ACTUALIZAR");
  setStaleLock("#badPlayersList .bad-buy-btn",!freshness.team_malo.updated,"SIN ACTUALIZAR");
  setStaleLock("#myTeamList .sell-bad-btn",!freshness.team_malo.updated,"BLOQUEADO");
}
async function refresh(force=false){
  ensureChrome();ensureHome();
  if(force||Date.now()-lastRefresh>45000){
    lastRefresh=Date.now();
    try{await loadStatus();}catch(e){console.error(e);}
    try{await loadHomeNews();}catch(e){console.error(e);}
  }
  paint("clauses",clausePeriod(),freshness.clauses);
  paint("bad",badPeriod(),freshness.team_malo);
  applyLocks();
}

function init(){
  ensureChrome();ensureHome();refresh(true);
  setActiveNav("home");
  let n=0;
  const warm=setInterval(()=>{ensureChrome();ensureHome();applyLocks();if(++n>=12)clearInterval(warm);},1000);
  setInterval(()=>refresh(false),60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh(true);});
  client.auth.onAuthStateChange((_e,s)=>{if(s)setTimeout(()=>refresh(true),250);});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();