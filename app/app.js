(() => {
"use strict";

const CFG=window.COMUNIO_CONFIG;
const $=id=>document.getElementById(id);
const POS={porteros:"portero",defensas:"defensa",medios:"medio",delanteros:"delantero"};
const POS_LABEL={portero:"🥅 Porteros",defensa:"🛡️ Defensas",medio:"⚙️ Medios",delantero:"🎯 Delanteros"};

let motorCalendario=null;
let calendarCursor=null;

function isoFromDate(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function madridDateObject(){
  const now=motorCalendario
    ? motorCalendario.ahoraMadrid()
    : {fecha:localDate()};
  const [y,m,d]=now.fecha.split("-").map(Number);
  return new Date(y,m-1,d);
}
function clauseCalendarState(date){
  if(!motorCalendario)return{state:"closed",reason:"Calendario oficial no cargado.",label:"CERRADO"};
  const info=motorCalendario.estado(isoFromDate(date));
  return{state:info.estado,reason:info.motivo,label:info.etiqueta};
}
function renderCalendarToday(){
  const box=$("calendarTodayStatus");
  if(!motorCalendario){
    box.className="calendar-status closed";
    box.querySelector("strong").textContent="⚠️ CALENDARIO NO DISPONIBLE";
    box.querySelector("span").textContent="Por seguridad no se deben ejecutar cláusulas.";
    return;
  }
  const info=motorCalendario.estadoHoy();
  const label=info.estado==="especial"?"🟡 PERIODO ESPECIAL: ABIERTAS HOY":info.estado==="abierto"?"🟢 CLÁUSULAS ABIERTAS HOY":"🔴 CLÁUSULAS CERRADAS HOY";
  box.className=`calendar-status ${info.estado}`;
  box.querySelector("strong").textContent=label;
  box.querySelector("span").textContent=(info.estado==="abierto"||info.estado==="especial")
    ? `${info.motivo} Horario: ${motorCalendario.config.horario.inicio}–${motorCalendario.config.horario.fin}.`
    : info.motivo;
}
function renderCalendarRulesSummary(){
  const el=$("calendarRulesSummary");
  if(!el||!motorCalendario)return;
  const cfg=motorCalendario.config;
  const rows=[
    ["Horario oficial",`${cfg.horario.inicio}–${cfg.horario.fin}`],
    ["Regla ordinaria",(cfg.regla_ordinaria?.motivo_abierto||"").replace(/^Temporada ordinaria:\s*/i,"")],
    ...cfg.periodos.map(p=>[`${p.inicio} – ${p.fin}`,p.titulo||p.motivo]),
    ...cfg.fechas.map(f=>[f.fecha,`${f.estado==="cerrado"?"Cerrado":"Abierto"} · ${f.motivo}`])
  ];
  el.innerHTML=rows.map(([a,b])=>`<div><span>${escapeHtml(a)}</span><b>${escapeHtml(b)}</b></div>`).join("");

  const hours=$("appRuleHours");
  if(hours)hours.textContent=`${cfg.horario.inicio}–${cfg.horario.fin}`;
  const ordinary=$("appRuleOrdinary");
  if(ordinary)ordinary.textContent=(cfg.regla_ordinaria?.motivo_abierto||"").replace(/^Temporada ordinaria:\s*/i,"");
  const specials=$("appRuleSpecialPeriods");
  if(specials){
    specials.innerHTML=[
      ...cfg.periodos.map(p=>`<li><strong>${escapeHtml(p.inicio)} – ${escapeHtml(p.fin)}:</strong> ${escapeHtml(p.motivo)}</li>`),
      ...cfg.fechas.filter(f=>f.estado!=="cerrado").map(f=>`<li><strong>${escapeHtml(f.fecha)}:</strong> ${escapeHtml(f.motivo)}</li>`)
    ].join("")||"<li>No hay periodos especiales configurados.</li>";
  }
}
function setCalendarMonth(date){
  if(!motorCalendario)return;
  const meses=motorCalendario.meses();
  const first=meses[0],last=meses[meses.length-1];
  const min=new Date(first.anio,first.mes,1),max=new Date(last.anio,last.mes,1);
  let d=new Date(date.getFullYear(),date.getMonth(),1);
  if(d<min)d=min;if(d>max)d=max;
  calendarCursor=d;renderCalendar();
}
function renderCalendar(){
  if(!calendarCursor||!motorCalendario)return;
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  const names=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  $("calendarMonthLabel").textContent=`${names[m]} ${y}`;
  const grid=$("calendarGrid");grid.innerHTML="";
  const first=new Date(y,m,1),offset=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate();
  for(let i=0;i<offset;i++){const b=document.createElement("div");b.className="cal-blank";grid.appendChild(b);}
  const todayIso=motorCalendario.ahoraMadrid().fecha;
  for(let n=1;n<=total;n++){
    const d=new Date(y,m,n),iso=isoFromDate(d),raw=motorCalendario.estado(iso);
    const info={state:raw.estado,reason:raw.motivo};
    const b=document.createElement("button");b.type="button";b.className=`cal-day ${info.state}`;
    if(iso===todayIso)b.classList.add("today");
    b.innerHTML=`<span>${n}</span><i class="cal-dot"></i>`;
    b.addEventListener("click",()=>{
      grid.querySelectorAll(".selected").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");
      const f=d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
      const status=info.state==="special"?"Periodo especial · ABIERTO":info.state==="open"?"ABIERTO":"CERRADO";
      $("calendarDetail").innerHTML=`<strong>${f} · ${status}</strong>${escapeHtml(info.reason)}${info.state!=="closed"?`<br>Horario: ${motorCalendario.config.horario.inicio}–${motorCalendario.config.horario.fin}.`:""}`;
    });
    grid.appendChild(b);
  }
  const meses=motorCalendario.meses(),firstM=meses[0],lastM=meses[meses.length-1];
  $("calendarPrev").disabled=(y===firstM.anio&&m===firstM.mes);
  $("calendarNext").disabled=(y===lastM.anio&&m===lastM.mes);
}
function openRulesTab(name){
  document.querySelectorAll(".rules-tab").forEach(b=>b.classList.toggle("active",b.dataset.rulesTab===name));
  ["General","Clauses","Badteam"].forEach(k=>$("rules"+k).classList.add("hidden"));
  const map={general:"rulesGeneral",clauses:"rulesClauses",badteam:"rulesBadteam"};
  $(map[name]||"rulesGeneral").classList.remove("hidden");
  if(name==="clauses"){
    renderCalendarToday();renderCalendarRulesSummary();
    if(!calendarCursor)setCalendarMonth(madridDateObject());
  }
}


let supa=null, session=null, profile=null;
let players=[], badPlayers=[];
let clauseExecutions=[], badPurchases=[];
let schedule=null, pendingAction=null, currentView="clauses", historyPeriod="today";

const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const euros=n=>Math.round(Number(n)||0).toLocaleString("es-ES")+" €";
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const demoKey=k=>`comunio_laviana_demo_${k}`;
const isConfigured=()=>!CFG.DEMO_MODE&&CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY;

function localDate(offset=0){
  const d=new Date(); d.setDate(d.getDate()+offset);
  return new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function localTime(){
  return new Intl.DateTimeFormat("en-GB",{timeZone:CFG.TIMEZONE,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
}
function specialMultiplier(v){
  v=Number(v)||0;
  if(v<=500000)return 3;
  if(v<=999999)return 2;
  if(v<=3999999)return 1.5;
  if(v<=7999999)return 1.3;
  if(v<=11999999)return 1.25;
  return 1.2;
}
function normalizePosition(v){
  const p=norm(v);
  if(p.includes("port"))return "portero";
  if(p.includes("def"))return "defensa";
  if(p.includes("medio")||p.includes("centro")||p.includes("mc"))return "medio";
  if(p.includes("del")||p.includes("ata"))return "delantero";
  return "";
}
function showToast(msg,bad=false){
  const t=$("toast");t.textContent=msg;t.style.background=bad?"#7c2d32":"#166c3c";
  t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),2800);
}

async function boot(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
  bindUI();
  try{ motorCalendario=await ComunioCalendario.cargar("../calendario-clausulas.json"); }
  catch(e){ console.error("Calendario oficial:",e); }

  if(isConfigured()){
    supa=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
    const {data:{session:s}}=await supa.auth.getSession();session=s;
    supa.auth.onAuthStateChange((_e,s)=>{session=s;refreshSession().catch(console.error);});
    await refreshSession();
  }else{
    $("demoBanner").classList.remove("hidden");
    await loadWebData();
    const saved=localStorage.getItem(demoKey("user"));
    if(saved){profile={manager_name:saved,role:"demo"};await enterApp();}
    else showLogin();
  }
}

function bindUI(){
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));

  $("filtersBtn").addEventListener("click",()=>$("filterPanel").classList.toggle("collapsed"));
  $("searchInput").addEventListener("input",renderPlayers);
  $("positionFilter").addEventListener("change",()=>{collapse("filterPanel");renderPlayers();});
  $("ownerFilter").addEventListener("change",()=>{collapse("filterPanel");renderPlayers();});
  $("clearFiltersBtn").addEventListener("click",()=>{$("searchInput").value="";$("positionFilter").value="";$("ownerFilter").value="";renderPlayers();});

  $("badFiltersBtn").addEventListener("click",()=>$("badFilterPanel").classList.toggle("collapsed"));
  $("badSearchInput").addEventListener("input",renderBadPlayers);
  $("badPositionFilter").addEventListener("change",()=>{collapse("badFilterPanel");renderBadPlayers();});
  $("badClearFiltersBtn").addEventListener("click",()=>{$("badSearchInput").value="";$("badPositionFilter").value="";renderBadPlayers();});
  $("badRulesBtn").addEventListener("click",()=>$("badRulesBox").classList.toggle("hidden"));

  $("cancelExecuteBtn").addEventListener("click",closeModal);
  $("confirmExecuteBtn").addEventListener("click",executePending);
  $("confirmModal").addEventListener("click",e=>{if(e.target===$("confirmModal"))closeModal();});

  $("sessionBtn").addEventListener("click",sessionAction);
  $("magicLinkBtn").addEventListener("click",sendMagicLink);
  $("demoEnterBtn").addEventListener("click",()=>{
    const name=$("demoUserSelect").value;if(!name)return;
    localStorage.setItem(demoKey("user"),name);profile={manager_name:name,role:"demo"};enterApp();
  });

  document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("[data-period]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");historyPeriod=b.dataset.period;loadNews();
  }));
  $("historyDate").addEventListener("change",()=>{
    historyPeriod="date";document.querySelectorAll("[data-period]").forEach(x=>x.classList.remove("active"));loadNews();
  });

  document.querySelectorAll(".rules-tab").forEach(b=>b.addEventListener("click",()=>openRulesTab(b.dataset.rulesTab)));
  document.querySelectorAll("[data-open-rule]").forEach(b=>b.addEventListener("click",()=>openRulesTab(b.dataset.openRule)));
  $("calendarPrev").addEventListener("click",()=>setCalendarMonth(new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1)));
  $("calendarNext").addEventListener("click",()=>setCalendarMonth(new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1)));
  $("calendarTodayBtn").addEventListener("click",()=>setCalendarMonth(madridDateObject()));

}
function collapse(id){if(window.innerWidth<700)$(id).classList.add("collapsed");}

async function refreshSession(){
  if(!session){showLogin();return;}
  const {data,error}=await supa.from("profiles").select("manager_name,role").eq("id",session.user.id).single();
  if(error||!data){showLogin("Tu usuario todavía no está vinculado a un participante.");return;}
  profile=data;await enterApp();
}
function showLogin(msg=""){
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  $("loginView").classList.remove("hidden");$("sessionBtn").textContent="Entrar";$("loginMessage").textContent=msg;
  if(CFG.DEMO_MODE||!isConfigured()){
    $("demoLogin").classList.remove("hidden");$("realLogin").classList.add("hidden");
    $("loginHelp").textContent="Prueba local: elige un participante.";
    fillDemoUsers();
  }else{
    $("realLogin").classList.remove("hidden");$("demoLogin").classList.add("hidden");
    $("loginHelp").textContent="Recibirás un enlace de acceso en tu email.";
  }
}
async function sessionAction(){
  if(!profile){showLogin();return;}
  if(CFG.DEMO_MODE){localStorage.removeItem(demoKey("user"));profile=null;showLogin();}
  else{await supa.auth.signOut();profile=null;showLogin();}
}
async function sendMagicLink(){
  const email=$("emailInput").value.trim();if(!email){$("loginMessage").textContent="Escribe tu email.";return;}
  $("loginMessage").textContent="Enviando…";
  const {error}=await supa.auth.signInWithOtp({email,options:{emailRedirectTo:location.href}});
  $("loginMessage").textContent=error?error.message:"Enlace enviado. Abre el email desde este móvil.";
}

async function enterApp(){
  $("loginView").classList.add("hidden");$("sessionBtn").textContent=profile.manager_name||"Salir";
  if(isConfigured())await loadRealData();else await loadDemoData();
  fillFilters();updateStatusUI();renderPlayers();renderBadPlayers();renderActivityMini();showView(currentView);
}

async function firstJson(paths){
  for(const u of paths){
    try{const r=await fetch(u+"?v="+Date.now(),{cache:"no-store"});if(r.ok)return await r.json();}catch{}
  }
  throw new Error("No se pudo cargar "+paths.join(" / "));
}
async function loadWebData(){
  const [d,e,b]=await Promise.all([
    firstJson(["../datos.json","datos.json"]),
    firstJson(["../equipos.json","equipos.json"]),
    firstJson(["../equipomalo.json","equipomalo.json"])
  ]);
  const teams=e.equipos||e||{};
  const p=[];
  Object.entries(POS).forEach(([group,pos])=>{
    (d[group]||[]).forEach(x=>p.push({
      name:x.jugador,owner_name:x.propietario,team:teams[x.jugador]||"",
      position:pos,points:Number(x.puntos)||0,market_value:Number(x.valor)||0,
      clause_value:Number(x.clausula)||0,active:true
    }));
  });
  players=p;

  badPlayers=(b.jugadores||[]).map(x=>{
    const value=Number(x.valor)||0;
    return {
      name:x.jugador,team:teams[x.jugador]||x.equipo||"",
      position:normalizePosition(x.posicion),points:Number(x.puntos)||0,
      market_value:value,multiplier:specialMultiplier(value),
      clause_value:Math.round(value*specialMultiplier(value)),available:true
    };
  }).filter(x=>x.name&&x.position);
}

async function loadRealData(){
  const [p,b,s,c,m]=await Promise.all([
    supa.from("players").select("*").eq("active",true).order("clause_value",{ascending:false}),
    supa.from("team_malo_players").select("*").eq("available",true).order("clause_value",{ascending:false}),
    supa.from("clause_days").select("*").eq("day",localDate()).maybeSingle(),
    supa.from("clause_executions").select("*").eq("clause_day",localDate()).order("executed_at",{ascending:true}),
    supa.from("team_malo_purchases").select("*").eq("purchase_day",localDate()).order("executed_at",{ascending:true})
  ]);
  if(p.error)throw p.error;if(b.error)throw b.error;
  players=p.data||[];badPlayers=b.data||[];schedule=s.data||null;
  clauseExecutions=c.data||[];badPurchases=m.data||[];
}
async function loadDemoData(){
  if(!players.length||!badPlayers.length)await loadWebData();
  schedule={day:localDate(),enabled:true,opens_at:CFG.DEFAULT_OPEN+":00",closes_at:CFG.DEFAULT_CLOSE+":00"};
  clauseExecutions=JSON.parse(localStorage.getItem(demoKey("clauses_"+localDate()))||"[]");
  badPurchases=JSON.parse(localStorage.getItem(demoKey("badbuys_"+localDate()))||"[]");

  // Una compra al Equipo Malo elimina el jugador del stock de la demo.
  const bought=new Set(allDemoBadPurchases().map(x=>x.player_name));
  badPlayers=badPlayers.map(x=>({...x,available:!bought.has(x.name)}));
}
function allDemoBadPurchases(){
  const out=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith(demoKey("badbuys_"))){
      try{out.push(...JSON.parse(localStorage.getItem(k)||"[]"));}catch{}
    }
  }
  return out;
}

function fillDemoUsers(){
  const owners=[...new Set(players.map(p=>p.owner_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  $("demoUserSelect").innerHTML=owners.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
}
function fillFilters(){
  const owners=[...new Set(players.map(p=>p.owner_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  $("ownerFilter").innerHTML='<option value="">Todos</option>'+owners.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
}

function clauseAvailability(){
  if(CFG.DEMO_MODE&&CFG.DEMO_FORCE_CLAUSES_OPEN)return{open:true,label:"Demo abierta",detail:"Prueba de cláusulas activada"};

  // En demo, la app usa directamente el MISMO calendario oficial que la web.
  if(CFG.DEMO_MODE || !isConfigured()){
    if(!motorCalendario)return{open:false,label:"Calendario no disponible",detail:"Por seguridad las cláusulas quedan cerradas"};
    const info=motorCalendario.estadoAhora();
    if(info.estado==="cerrado")return{open:false,label:"Día cerrado",detail:info.motivo};
    if(!info.abiertoAhora){
      const t=info.hora,open=motorCalendario.config.horario.inicio,close=motorCalendario.config.horario.fin;
      return t<open
        ? {open:false,label:"Todavía cerrado",detail:`Abre a las ${open}`}
        : {open:false,label:"Horario cerrado",detail:`Cerró a las ${close}`};
    }
    return{open:true,label:info.estado==="especial"?"Periodo especial abierto":"Cláusulas abiertas",detail:`Disponible hasta las ${motorCalendario.config.horario.fin}`};
  }

  // En modo real, Supabase recibe una copia generada por el mismo JSON desde admin.html.
  if(!schedule||!schedule.enabled)return{open:false,label:"Día cerrado",detail:"Hoy no es día de cláusulas"};
  const t=localTime(),open=String(schedule.opens_at||"15:00").slice(0,5),close=String(schedule.closes_at||"21:00").slice(0,5);
  if(t<open)return{open:false,label:"Todavía cerrado",detail:`Abre a las ${open}`};
  if(t>=close)return{open:false,label:"Horario cerrado",detail:`Cerró a las ${close}`};
  return{open:true,label:"Cláusulas abiertas",detail:`Disponible hasta las ${close}`};
}
function badTeamAvailability(){
  if(CFG.DEMO_MODE&&CFG.DEMO_FORCE_BADTEAM_OPEN)return{open:true,label:"Demo abierta",detail:"Prueba de Equipo Malo activada"};
  const t=localTime(),open=CFG.BADTEAM_OPEN||"12:00",close=CFG.BADTEAM_CLOSE||"00:00";
  const ok=close==="00:00" ? t>=open : (t>=open&&t<close);
  return ok
    ? {open:true,label:"Equipo Malo abierto",detail:"Disponible hasta las 00:00"}
    : {open:false,label:"Equipo Malo cerrado",detail:"Abre todos los días a las 12:00"};
}
const executorUsed=()=>clauseExecutions.some(e=>(e.executor_name||"")===profile?.manager_name);
const blockedOwners=()=>new Set(clauseExecutions.map(e=>e.target_owner_name).filter(Boolean));
function availablePlayers(){
  const blocked=blockedOwners();
  return players.filter(p=>p.active!==false&&p.owner_name!==profile?.manager_name&&!blocked.has(p.owner_name));
}
function availableBadPlayers(){
  return badPlayers.filter(p=>p.available!==false);
}
function todayNews(){
  return [
    ...clauseExecutions.map(e=>({...e,_type:"clause",_time:e.executed_at})),
    ...badPurchases.map(e=>({...e,_type:"badteam",_time:e.executed_at}))
  ].sort((a,b)=>new Date(a._time)-new Date(b._time));
}

function updateStatusUI(){
  const a=clauseAvailability();
  $("homeStatusTitle").textContent=a.label;$("homeStatusText").textContent=a.detail+(executorUsed()?" · Ya has utilizado tu cláusula de hoy.":"");
  $("homeStatusDot").className="status-dot "+(a.open?"open":"closed");
  $("statAvailable").textContent=availablePlayers().length;
  $("statBadTeam").textContent=availableBadPlayers().length;
  $("statNews").textContent=todayNews().length;

  const state=$("userStateBanner");
  if(executorUsed()){state.textContent="✓ Ya has utilizado tu cláusula de hoy. Puedes seguir consultando.";state.classList.remove("hidden");}
  else if(!a.open){state.textContent=`🔒 ${a.detail}. El servidor validará el horario.`;state.classList.remove("hidden");}
  else state.classList.add("hidden");

  const bad=badTeamAvailability(), bs=$("badTeamStateBanner");
  if(!bad.open){bs.textContent=`🔒 ${bad.detail}. Las compras se habilitan automáticamente a las 12:00.`;bs.classList.remove("hidden");}
  else bs.classList.add("hidden");
}

function renderPlayers(){
  if(!profile)return;
  const q=norm($("searchInput").value),pos=$("positionFilter").value,owner=$("ownerFilter").value;
  const a=clauseAvailability(),used=executorUsed();
  let list=availablePlayers().filter(p=>{
    if(pos&&p.position!==pos)return false;if(owner&&p.owner_name!==owner)return false;
    if(q&&![p.name,p.owner_name,p.team].some(x=>norm(x).includes(q)))return false;return true;
  }).sort((a,b)=>b.clause_value-a.clause_value||a.name.localeCompare(b.name,"es"));

  renderChips("activeFilters",[
    q?`🔎 ${$("searchInput").value}`:"",
    pos?POS_LABEL[pos]:"",
    owner?`👤 ${owner}`:""
  ]);
  $("playersCount").textContent=`${list.length} jugadores · mayor cláusula primero`;
  const box=$("playersList");
  if(!list.length){box.innerHTML='<div class="empty">No hay jugadores disponibles con esos filtros.</div>';return;}
  box.innerHTML="";
  list.forEach(p=>{
    const row=document.createElement("article");row.className="player-row";
    const btnText=used?"YA USADA":(a.open?"EJECUTAR":"CERRADO");
    row.innerHTML=`
      <div><div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-meta">${escapeHtml(p.owner_name)} · ${escapeHtml(p.team||"Sin equipo")}</div>
      <div class="player-extra">${Number(p.points)||0} pts · Valor ${euros(p.market_value)}</div></div>
      <div class="clause-col"><div class="clause-label">CLÁUSULA</div><div class="clause-value">${euros(p.clause_value)}</div></div>
      <button class="execute-btn" ${(!a.open||used)?"disabled":""}>${btnText}</button>`;
    row.querySelector(".execute-btn").addEventListener("click",()=>openAction("clause",p));
    box.appendChild(row);
  });
}

function renderBadPlayers(){
  if(!profile)return;
  const q=norm($("badSearchInput").value),pos=$("badPositionFilter").value,a=badTeamAvailability();
  let list=availableBadPlayers().filter(p=>{
    if(pos&&p.position!==pos)return false;
    if(q&&![p.name,p.team].some(x=>norm(x).includes(q)))return false;return true;
  }).sort((a,b)=>b.clause_value-a.clause_value||a.name.localeCompare(b.name,"es"));

  renderChips("badActiveFilters",[q?`🔎 ${$("badSearchInput").value}`:"",pos?POS_LABEL[pos]:""]);
  $("badPlayersCount").textContent=`${list.length} jugadores · puedes comprar todos los que quieras`;
  const box=$("badPlayersList");
  if(!list.length){box.innerHTML='<div class="empty">No hay jugadores disponibles con esos filtros.</div>';return;}
  box.innerHTML="";
  list.forEach(p=>{
    const row=document.createElement("article");row.className="player-row";
    row.innerHTML=`
      <div><div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-meta">${escapeHtml(p.team||"Sin equipo")} · × ${Number(p.multiplier).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="player-extra">${Number(p.points)||0} pts · Valor ${euros(p.market_value)}</div></div>
      <div class="clause-col"><div class="clause-label">PRECIO EQUIPO MALO</div><div class="clause-value">${euros(p.clause_value)}</div></div>
      <button class="execute-btn bad-buy-btn" ${!a.open?"disabled":""}>${a.open?"COMPRAR":"CERRADO"}</button>`;
    row.querySelector(".execute-btn").addEventListener("click",()=>openAction("badteam",p));
    box.appendChild(row);
  });
}
function renderChips(id,arr){
  const el=$(id),chips=arr.filter(Boolean);
  if(chips.length){el.innerHTML=chips.map(c=>`<span class="chip">${escapeHtml(c)}</span>`).join("");el.classList.remove("hidden");}
  else el.classList.add("hidden");
}

function openAction(type,p){
  if(type==="clause"){
    if(executorUsed()){showToast("Ya has utilizado tu cláusula de hoy.",true);return;}
    if(!clauseAvailability().open){showToast("Las cláusulas están cerradas.",true);return;}
    $("modalIcon").textContent="⚡";$("modalTitle").textContent="Ejecutar cláusula";
    $("confirmText").innerHTML=`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.owner_name)} · ${escapeHtml(p.team||"")}<br><br>Cláusula: <strong>${euros(p.clause_value)}</strong><br><small>Al confirmar, todos los jugadores de ${escapeHtml(p.owner_name)} desaparecerán del listado de hoy.</small>`;
  }else{
    if(!badTeamAvailability().open){showToast("Equipo Malo está cerrado. Abre a las 12:00.",true);return;}
    $("modalIcon").textContent="💀";$("modalTitle").textContent="Comprar al Equipo Malo";
    $("confirmText").innerHTML=`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.team||"")}<br><br>Valor: ${euros(p.market_value)} · × ${Number(p.multiplier).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})}<br>Precio: <strong>${euros(p.clause_value)}</strong><br><small>Una vez confirmada la compra, el jugador desaparecerá del listado para todos.</small>`;
  }
  pendingAction={type,player:p};$("confirmModal").classList.remove("hidden");
}
function closeModal(){pendingAction=null;$("confirmModal").classList.add("hidden");}

async function executePending(){
  if(!pendingAction)return;
  $("confirmExecuteBtn").disabled=true;
  try{
    const {type,player}=pendingAction;
    if(isConfigured()){
      if(type==="clause")await executeRealClause(player);
      else await executeRealBadPurchase(player);
      await loadRealData();
    }else{
      if(type==="clause")executeDemoClause(player);
      else executeDemoBadPurchase(player);
      await loadDemoData();
    }
    closeModal();
    showToast(type==="clause"
      ?`✅ Cláusula ejecutada. ${player.owner_name} queda bloqueado hoy.`
      :`✅ ${player.name} comprado al Equipo Malo.`);
    updateStatusUI();renderPlayers();renderBadPlayers();renderActivityMini();
  }catch(e){
    showToast(humanError(e),true);
    if(isConfigured())await loadRealData();
    updateStatusUI();renderPlayers();renderBadPlayers();renderActivityMini();
  }finally{$("confirmExecuteBtn").disabled=false;}
}
async function executeRealClause(p){
  const {error}=await supa.from("clause_executions").insert({player_name:p.name});
  if(error)throw error;
}
async function executeRealBadPurchase(p){
  const {error}=await supa.from("team_malo_purchases").insert({player_name:p.name});
  if(error)throw error;
}
function executeDemoClause(p){
  const key=demoKey("clauses_"+localDate()),arr=JSON.parse(localStorage.getItem(key)||"[]");
  if(arr.some(x=>x.executor_name===profile.manager_name))throw new Error("EXECUTOR_ALREADY_USED");
  if(arr.some(x=>x.target_owner_name===p.owner_name))throw new Error("OWNER_ALREADY_BLOCKED");
  arr.push({
    id:crypto.randomUUID(),clause_day:localDate(),executed_at:new Date().toISOString(),
    executor_name:profile.manager_name,target_owner_name:p.owner_name,player_name:p.name,
    team:p.team,position:p.position,points:p.points,market_value:p.market_value,clause_value:p.clause_value
  });
  localStorage.setItem(key,JSON.stringify(arr));
}
function executeDemoBadPurchase(p){
  if(allDemoBadPurchases().some(x=>x.player_name===p.name))throw new Error("BAD_PLAYER_ALREADY_BOUGHT");
  const key=demoKey("badbuys_"+localDate()),arr=JSON.parse(localStorage.getItem(key)||"[]");
  arr.push({
    id:crypto.randomUUID(),purchase_day:localDate(),executed_at:new Date().toISOString(),
    buyer_name:profile.manager_name,player_name:p.name,team:p.team,position:p.position,
    points:p.points,market_value:p.market_value,multiplier:p.multiplier,clause_value:p.clause_value
  });
  localStorage.setItem(key,JSON.stringify(arr));
}
function humanError(e){
  const s=String(e?.message||e||"");
  if(s.includes("one_clause_per_executor_day")||s.includes("EXECUTOR_ALREADY_USED"))return "Ya has ejecutado tu cláusula de hoy.";
  if(s.includes("one_received_per_owner_day")||s.includes("OWNER_ALREADY_BLOCKED"))return "Ese propietario acaba de recibir una cláusula.";
  if(s.includes("CLAUSES_CLOSED"))return "Las cláusulas están cerradas ahora mismo.";
  if(s.includes("CLAUSE_DAY_CLOSED"))return "Hoy no es día de cláusulas.";
  if(s.includes("BADTEAM_CLOSED"))return "Equipo Malo está cerrado. Abre a las 12:00.";
  if(s.includes("BAD_PLAYER_ALREADY_BOUGHT")||s.includes("BAD_PLAYER_NOT_AVAILABLE"))return "Ese jugador acaba de ser comprado por otro usuario.";
  if(s.includes("CANNOT_TARGET_SELF"))return "No puedes ejecutar una cláusula sobre tu propio equipo.";
  return "La operación no se pudo completar. La lista se ha actualizado por si otro usuario llegó antes.";
}

function renderActivityMini(){
  const arr=[...todayNews()].sort((a,b)=>new Date(b._time)-new Date(a._time)).slice(0,5);
  $("activityMiniList").innerHTML=arr.length?arr.map(newsHtml).join(""):'<div class="empty">Todavía no hay actividad hoy.</div>';
  const buys=[...badPurchases].sort((a,b)=>new Date(b.executed_at)-new Date(a.executed_at)).slice(0,4);
  $("badTodayMiniList").innerHTML=buys.length?buys.map(e=>newsHtml({...e,_type:"badteam",_time:e.executed_at})).join(""):'<div class="empty">Todavía no hay compras al Equipo Malo hoy.</div>';
}

async function loadNews(){
  let day=historyPeriod==="today"?localDate():historyPeriod==="yesterday"?localDate(-1):($("historyDate").value||localDate());
  const title=day===localDate()?"Noticias de hoy":day===localDate(-1)?"Noticias de ayer":`Noticias del ${formatDate(day)}`;
  $("historyTitle").querySelector("h2").textContent=title;

  let clauses=[],buys=[];
  if(isConfigured()){
    const [c,b]=await Promise.all([
      supa.from("clause_executions").select("*").eq("clause_day",day).order("executed_at",{ascending:true}),
      supa.from("team_malo_purchases").select("*").eq("purchase_day",day).order("executed_at",{ascending:true})
    ]);
    clauses=c.data||[];buys=b.data||[];
  }else{
    clauses=JSON.parse(localStorage.getItem(demoKey("clauses_"+day))||"[]");
    buys=JSON.parse(localStorage.getItem(demoKey("badbuys_"+day))||"[]");
  }
  const arr=[
    ...clauses.map(e=>({...e,_type:"clause",_time:e.executed_at})),
    ...buys.map(e=>({...e,_type:"badteam",_time:e.executed_at}))
  ].sort((a,b)=>new Date(a._time)-new Date(b._time));

  $("historyCount").textContent=`${arr.length} noticias`;
  $("historyList").innerHTML=arr.length?arr.map(newsHtml).join(""):'<div class="empty">No hubo actividad ese día.</div>';
}
function newsHtml(e){
  const time=new Intl.DateTimeFormat("es-ES",{timeZone:CFG.TIMEZONE,hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(e._time||e.executed_at));
  if(e._type==="badteam"){
    return `<article class="history-item"><div class="history-time">${time}</div><div>
      <span class="news-type badteam">💀 EQUIPO MALO</span>
      <div class="history-main">${escapeHtml(e.buyer_name||"")} compró a ${escapeHtml(e.player_name||"")}</div>
      <div class="history-sub">${euros(e.clause_value)} · ${escapeHtml(e.team||"")}</div>
    </div></article>`;
  }
  return `<article class="history-item"><div class="history-time">${time}</div><div>
    <span class="news-type clause">⚡ CLÁUSULA</span>
    <div class="history-main">${escapeHtml(e.executor_name||"")} → ${escapeHtml(e.player_name||"")}</div>
    <div class="history-sub">de ${escapeHtml(e.target_owner_name||"")} · ${euros(e.clause_value)}</div>
  </div></article>`;
}

function showView(name){
  currentView=name;
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  const map={home:"homeView",clauses:"clausesView",news:"newsView",badteam:"badteamView",rules:"rulesView"};
  $(map[name]||"clausesView").classList.remove("hidden");
  document.querySelectorAll(".main-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("pageTitle").textContent=name==="home"?"Inicio":name==="news"?"Noticias":name==="badteam"?"Equipo Malo":name==="rules"?"Normas":"Cláusulas";
  if(name==="news")loadNews();
  if(name==="rules")openRulesTab(document.querySelector(".rules-tab.active")?.dataset.rulesTab||"general");
  window.scrollTo({top:0,behavior:"smooth"});
}
function formatDate(iso){const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;}

boot().catch(e=>{
  console.error(e);
  document.body.innerHTML='<div style="padding:30px;color:white;font-family:sans-serif">No se pudo iniciar la aplicación.<br><small>'+escapeHtml(e.message)+'</small></div>';
});
})();
