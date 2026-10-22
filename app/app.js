(() => {
"use strict";

const CFG = window.COMUNIO_CONFIG;
const $ = id => document.getElementById(id);
const POS = {
  porteros:"portero", defensas:"defensa", medios:"medio", delanteros:"delantero"
};
const POS_LABEL = {portero:"🥅 Porteros",defensa:"🛡️ Defensas",medio:"⚙️ Medios",delantero:"🎯 Delanteros"};

let supa = null;
let session = null;
let profile = null;
let players = [];
let teams = {};
let todayExecutions = [];
let schedule = null;
let pendingPlayer = null;
let currentView = "clauses";
let historyPeriod = "today";

function norm(s){
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
function euros(n){ return Math.round(Number(n)||0).toLocaleString("es-ES")+" €"; }
function localDate(offset=0){
  const d = new Date();
  d.setDate(d.getDate()+offset);
  return new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function localTime(){
  return new Intl.DateTimeFormat("es-ES",{timeZone:CFG.TIMEZONE,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
}
function showToast(msg, bad=false){
  const t=$("toast"); t.textContent=msg; t.style.background=bad?"#7c2d32":"#166c3c";
  t.classList.remove("hidden"); setTimeout(()=>t.classList.add("hidden"),2600);
}
function isConfigured(){
  return !CFG.DEMO_MODE && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY;
}
function demoKey(k){ return `comunio_laviana_demo_${k}`; }

async function boot(){
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
  bindUI();

  if (isConfigured()){
    supa = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    const {data:{session:s}} = await supa.auth.getSession();
    session=s;
    supa.auth.onAuthStateChange((_event,sess)=>{ session=sess; refreshSession().catch(console.error); });
    await refreshSession();
  }else{
    $("demoBanner").classList.remove("hidden");
    await loadWebPlayers();
    const saved=localStorage.getItem(demoKey("user"));
    if(saved){
      profile={manager_name:saved,role:"demo"};
      await enterApp();
    }else showLogin();
  }
}

function bindUI(){
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
  $("filtersBtn").addEventListener("click",()=>$("filterPanel").classList.toggle("collapsed"));
  $("searchInput").addEventListener("input",renderPlayers);
  $("positionFilter").addEventListener("change",()=>{collapseFiltersOnMobile();renderPlayers();});
  $("ownerFilter").addEventListener("change",()=>{collapseFiltersOnMobile();renderPlayers();});
  $("clearFiltersBtn").addEventListener("click",()=>{
    $("searchInput").value=""; $("positionFilter").value=""; $("ownerFilter").value="";
    renderPlayers();
  });
  $("cancelExecuteBtn").addEventListener("click",()=>closeModal());
  $("confirmExecuteBtn").addEventListener("click",executePending);
  $("confirmModal").addEventListener("click",e=>{if(e.target===$("confirmModal"))closeModal();});
  $("sessionBtn").addEventListener("click",sessionAction);
  $("magicLinkBtn").addEventListener("click",sendMagicLink);
  $("demoEnterBtn").addEventListener("click",()=>{
    const name=$("demoUserSelect").value;
    if(!name)return;
    localStorage.setItem(demoKey("user"),name);
    profile={manager_name:name,role:"demo"};
    enterApp();
  });
  document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("[data-period]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); historyPeriod=b.dataset.period; loadHistory();
  }));
  $("historyDate").addEventListener("change",()=>{historyPeriod="date";document.querySelectorAll("[data-period]").forEach(x=>x.classList.remove("active"));loadHistory();});
}

function collapseFiltersOnMobile(){
  if(window.innerWidth<700) $("filterPanel").classList.add("collapsed");
}

async function refreshSession(){
  if(!session){
    showLogin(); return;
  }
  const {data, error}=await supa.from("profiles").select("manager_name,role").eq("id",session.user.id).single();
  if(error || !data){
    showLogin("Tu usuario todavía no está vinculado a un participante de la liga.");
    return;
  }
  profile=data;
  await enterApp();
}

function showLogin(msg=""){
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  $("loginView").classList.remove("hidden");
  $("sessionBtn").textContent="Entrar";
  $("loginMessage").textContent=msg;
  if(CFG.DEMO_MODE || !isConfigured()){
    $("demoLogin").classList.remove("hidden"); $("realLogin").classList.add("hidden");
    $("loginHelp").textContent="Prueba local: elige un participante. Las operaciones solo se guardan en este dispositivo.";
    fillDemoUsers();
  }else{
    $("realLogin").classList.remove("hidden"); $("demoLogin").classList.add("hidden");
    $("loginHelp").textContent="Recibirás un enlace de acceso en tu email.";
  }
}

async function sessionAction(){
  if(!profile){ showLogin(); return; }
  if(CFG.DEMO_MODE){
    localStorage.removeItem(demoKey("user")); profile=null; showLogin();
  }else{
    await supa.auth.signOut(); profile=null; showLogin();
  }
}

async function sendMagicLink(){
  const email=$("emailInput").value.trim();
  if(!email){$("loginMessage").textContent="Escribe tu email.";return;}
  $("loginMessage").textContent="Enviando…";
  const {error}=await supa.auth.signInWithOtp({email,options:{emailRedirectTo:location.href}});
  $("loginMessage").textContent=error ? error.message : "Enlace enviado. Abre el email desde este móvil.";
}

async function enterApp(){
  $("loginView").classList.add("hidden");
  $("sessionBtn").textContent=profile.manager_name || "Salir";
  if(isConfigured()) await loadRealData();
  else await loadDemoData();
  fillFilters();
  updateStatusUI();
  renderPlayers();
  renderTodayMini();
  showView(currentView);
}

async function loadWebPlayers(){
  const urls = [
    ["../datos.json","datos.json"],
    ["../equipos.json","equipos.json"]
  ];
  async function firstOk(pair){
    for(const u of pair){
      try{const r=await fetch(u+"?v="+Date.now(),{cache:"no-store"});if(r.ok)return await r.json();}catch{}
    }
    throw new Error("No se pudo cargar "+pair.join(" / "));
  }
  const [d,e]=await Promise.all(urls.map(firstOk));
  teams=e.equipos||e||{};
  const out=[];
  Object.entries(POS).forEach(([group,pos])=>{
    (d[group]||[]).forEach(p=>out.push({
      name:p.jugador,owner_name:p.propietario,team:teams[p.jugador]||"",
      position:pos,points:Number(p.puntos)||0,market_value:Number(p.valor)||0,
      clause_value:Number(p.clausula)||0,active:true
    }));
  });
  players=out;
}

async function loadRealData(){
  const [p,s,e]=await Promise.all([
    supa.from("players").select("*").eq("active",true).order("clause_value",{ascending:false}),
    supa.from("clause_days").select("*").eq("day",localDate()).maybeSingle(),
    supa.from("clause_executions").select("*").eq("clause_day",localDate()).order("executed_at",{ascending:true})
  ]);
  if(p.error) throw p.error;
  players=p.data||[];
  schedule=s.data||null;
  todayExecutions=e.data||[];
}

async function loadDemoData(){
  if(!players.length) await loadWebPlayers();
  schedule={
    day:localDate(),enabled:true,
    opens_at:CFG.DEFAULT_OPEN+":00",closes_at:CFG.DEFAULT_CLOSE+":00"
  };
  todayExecutions=JSON.parse(localStorage.getItem(demoKey("executions_"+localDate()))||"[]");
}

function fillDemoUsers(){
  if(!players.length)return;
  const owners=[...new Set(players.map(p=>p.owner_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  $("demoUserSelect").innerHTML=owners.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
}

function fillFilters(){
  const owners=[...new Set(players.map(p=>p.owner_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  $("ownerFilter").innerHTML='<option value="">Todos</option>'+owners.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
}

function availability(){
  if(CFG.DEMO_MODE && CFG.DEMO_FORCE_OPEN) return {open:true,label:"Demo abierta",detail:"Prueba de botones activada"};
  if(!schedule || !schedule.enabled) return {open:false,label:"Día cerrado",detail:"Hoy no es día de cláusulas"};
  const t=localTime();
  const open=String(schedule.opens_at||"15:00").slice(0,5);
  const close=String(schedule.closes_at||"21:00").slice(0,5);
  if(t<open)return {open:false,label:"Todavía cerrado",detail:`Abre a las ${open}`};
  if(t>=close)return {open:false,label:"Horario cerrado",detail:`Cerró a las ${close}`};
  return {open:true,label:"Cláusulas abiertas",detail:`Disponible hasta las ${close}`};
}

function executorUsed(){
  return todayExecutions.some(e => (e.executor_name||"") === profile?.manager_name);
}
function blockedOwners(){
  return new Set(todayExecutions.map(e=>e.target_owner_name).filter(Boolean));
}
function availablePlayers(){
  const blocked=blockedOwners();
  return players.filter(p=>p.active!==false && p.owner_name!==profile?.manager_name && !blocked.has(p.owner_name));
}

function updateStatusUI(){
  const a=availability();
  $("homeStatusTitle").textContent=a.label;
  $("homeStatusText").textContent=a.detail+(executorUsed()?" · Ya has utilizado tu cláusula de hoy.":"");
  $("homeStatusDot").className="status-dot "+(a.open?"open":"closed");
  $("statAvailable").textContent=availablePlayers().length;
  $("statToday").textContent=todayExecutions.length;
  $("statBlockedOwners").textContent=blockedOwners().size;

  const state=$("userStateBanner");
  if(executorUsed()){
    state.textContent="✓ Ya has utilizado tu cláusula de hoy. Puedes seguir consultando jugadores e historial.";
    state.classList.remove("hidden");
  }else if(!a.open){
    state.textContent=`🔒 ${a.detail}. El servidor será quien valide el horario al ejecutar.`;
    state.classList.remove("hidden");
  }else state.classList.add("hidden");
}

function renderPlayers(){
  if(!profile)return;
  const q=norm($("searchInput").value);
  const pos=$("positionFilter").value;
  const owner=$("ownerFilter").value;
  const a=availability();
  const used=executorUsed();

  let list=availablePlayers().filter(p=>{
    if(pos && p.position!==pos)return false;
    if(owner && p.owner_name!==owner)return false;
    if(q && ![p.name,p.owner_name,p.team].some(x=>norm(x).includes(q)))return false;
    return true;
  }).sort((a,b)=>b.clause_value-a.clause_value || a.name.localeCompare(b.name,"es"));

  const chips=[];
  if(q)chips.push(`🔎 ${$("searchInput").value}`);
  if(pos)chips.push(POS_LABEL[pos]);
  if(owner)chips.push(`👤 ${owner}`);
  const af=$("activeFilters");
  if(chips.length){
    af.innerHTML=chips.map(c=>`<span class="chip">${escapeHtml(c)}</span>`).join("");
    af.classList.remove("hidden");
  }else af.classList.add("hidden");

  $("playersCount").textContent=`${list.length} jugadores · mayor cláusula primero`;
  $("playersHeading").textContent=pos?POS_LABEL[pos]:"⚡ Disponibles";

  const box=$("playersList");
  if(!list.length){box.innerHTML='<div class="empty">No hay jugadores disponibles con esos filtros.</div>';return;}

  box.innerHTML="";
  list.forEach(p=>{
    const row=document.createElement("article");
    row.className="player-row";
    const btnText = used ? "YA USADA" : (a.open ? "EJECUTAR" : "CERRADO");
    const btnSub = used ? "Hoy" : (a.open ? "" : (a.label==="Día cerrado"?"Día cerrado":a.detail));
    row.innerHTML=`
      <div>
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-meta">${escapeHtml(p.owner_name)} · ${escapeHtml(p.team||"Sin equipo")}</div>
        <div class="player-extra">${Number(p.points)||0} pts · Valor ${euros(p.market_value)}</div>
      </div>
      <div class="clause-col">
        <div class="clause-label">CLÁUSULA</div>
        <div class="clause-value">${euros(p.clause_value)}</div>
      </div>
      <button class="execute-btn" ${(!a.open||used)?"disabled":""}>
        ${btnText}${btnSub?`<small>${escapeHtml(btnSub)}</small>`:""}
      </button>`;
    row.querySelector(".execute-btn").addEventListener("click",e=>{e.stopPropagation();openExecute(p);});
    box.appendChild(row);
  });
}

function openExecute(p){
  if(executorUsed()){showToast("Ya has utilizado tu cláusula de hoy.",true);return;}
  if(!availability().open){showToast("Las cláusulas están cerradas ahora mismo.",true);return;}
  pendingPlayer=p;
  $("confirmText").innerHTML=
    `<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.owner_name)} · ${escapeHtml(p.team||"")}<br><br>`+
    `Cláusula: <strong>${euros(p.clause_value)}</strong><br><small>Al confirmar, todos los jugadores de ${escapeHtml(p.owner_name)} quedarán bloqueados para hoy.</small>`;
  $("confirmModal").classList.remove("hidden");
}
function closeModal(){pendingPlayer=null;$("confirmModal").classList.add("hidden");}

async function executePending(){
  if(!pendingPlayer)return;
  $("confirmExecuteBtn").disabled=true;
  try{
    if(isConfigured()) await executeReal(pendingPlayer);
    else executeDemo(pendingPlayer);
    const owner=pendingPlayer.owner_name;
    closeModal();
    showToast(`✅ Cláusula ejecutada. ${owner} queda bloqueado para hoy.`);
    if(isConfigured()) await loadRealData(); else await loadDemoData();
    updateStatusUI(); renderPlayers(); renderTodayMini();
  }catch(err){
    showToast(humanError(err),true);
    if(isConfigured()) await loadRealData();
    updateStatusUI(); renderPlayers(); renderTodayMini();
  }finally{
    $("confirmExecuteBtn").disabled=false;
  }
}

async function executeReal(p){
  // El cliente solo manda el jugador. El trigger del servidor decide propietario,
  // importe, horario y usuario, y las restricciones únicas resuelven carreras.
  const {error}=await supa.from("clause_executions").insert({player_name:p.name});
  if(error)throw error;
}

function executeDemo(p){
  const key=demoKey("executions_"+localDate());
  const arr=JSON.parse(localStorage.getItem(key)||"[]");
  if(arr.some(x=>x.executor_name===profile.manager_name))throw new Error("EXECUTOR_ALREADY_USED");
  if(arr.some(x=>x.target_owner_name===p.owner_name))throw new Error("OWNER_ALREADY_BLOCKED");
  arr.push({
    id:crypto.randomUUID(),clause_day:localDate(),executed_at:new Date().toISOString(),
    executor_name:profile.manager_name,target_owner_name:p.owner_name,player_name:p.name,
    team:p.team,position:p.position,points:p.points,market_value:p.market_value,clause_value:p.clause_value
  });
  localStorage.setItem(key,JSON.stringify(arr));
}

function humanError(err){
  const s=String(err?.message||err||"");
  if(s.includes("one_clause_per_executor_day")||s.includes("EXECUTOR_ALREADY_USED"))return "Ya has ejecutado tu cláusula de hoy.";
  if(s.includes("one_received_per_owner_day")||s.includes("OWNER_ALREADY_BLOCKED"))return "Ese propietario acaba de recibir una cláusula. Sus jugadores ya están bloqueados.";
  if(s.includes("one_player_per_day"))return "Ese jugador ya ha sido clausulado.";
  if(s.includes("CLAUSES_CLOSED"))return "Las cláusulas están cerradas ahora mismo.";
  if(s.includes("CLAUSE_DAY_CLOSED"))return "Hoy no es día de cláusulas.";
  if(s.includes("CANNOT_TARGET_SELF"))return "No puedes ejecutar una cláusula sobre tu propio equipo.";
  if(s.includes("PLAYER_NOT_FOUND"))return "El jugador ya no está disponible. Actualiza la pantalla.";
  return "No se pudo ejecutar. La información se ha actualizado por si otro usuario llegó antes.";
}

function renderTodayMini(){
  const el=$("todayMiniList");
  const arr=[...todayExecutions].sort((a,b)=>new Date(b.executed_at)-new Date(a.executed_at)).slice(0,4);
  if(!arr.length){el.innerHTML='<div class="empty">Todavía no hay cláusulas pagadas hoy.</div>';return;}
  el.innerHTML=arr.map(historyHtml).join("");
}

async function loadHistory(){
  let day;
  if(historyPeriod==="today")day=localDate();
  else if(historyPeriod==="yesterday")day=localDate(-1);
  else day=$("historyDate").value||localDate();

  const title = day===localDate()?"Cláusulas de hoy":day===localDate(-1)?"Cláusulas de ayer":`Cláusulas del ${formatDate(day)}`;
  $("historyTitle").querySelector("h2").textContent=title;

  let arr=[];
  if(isConfigured()){
    const {data,error}=await supa.from("clause_executions").select("*").eq("clause_day",day).order("executed_at",{ascending:true});
    if(error){$("historyList").innerHTML='<div class="empty">No se pudo cargar el historial.</div>';return;}
    arr=data||[];
  }else{
    arr=JSON.parse(localStorage.getItem(demoKey("executions_"+day))||"[]");
  }
  $("historyCount").textContent=`${arr.length} operaciones`;
  $("historyList").innerHTML=arr.length?arr.map(historyHtml).join(""):'<div class="empty">No hubo cláusulas ese día.</div>';
}
function historyHtml(e){
  const time=new Intl.DateTimeFormat("es-ES",{timeZone:CFG.TIMEZONE,hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(e.executed_at));
  return `<article class="history-item">
    <div class="history-time">${time}</div>
    <div>
      <div class="history-main">${escapeHtml(e.executor_name||"")} → ${escapeHtml(e.player_name||"")}</div>
      <div class="history-sub">de ${escapeHtml(e.target_owner_name||"")} · ${euros(e.clause_value)}</div>
    </div>
  </article>`;
}

function showView(name){
  currentView=name;
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  const map={home:"homeView",clauses:"clausesView",today:"todayView"};
  $(map[name]||"clausesView").classList.remove("hidden");
  document.querySelectorAll(".main-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("pageTitle").textContent=name==="home"?"Inicio":name==="today"?"Hoy":"Cláusulas";
  if(name==="today")loadHistory();
  window.scrollTo({top:0,behavior:"smooth"});
}

function formatDate(iso){
  const [y,m,d]=iso.split("-");
  return `${d}/${m}/${y}`;
}
function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

boot().catch(err=>{
  console.error(err);
  document.body.innerHTML='<div style="padding:30px;color:white;font-family:sans-serif">No se pudo iniciar la aplicación.<br><small>'+escapeHtml(err.message)+'</small></div>';
});
})();
