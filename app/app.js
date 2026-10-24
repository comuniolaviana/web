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
      const status=info.state==="especial"?"Periodo especial · ABIERTO":info.state==="abierto"?"ABIERTO":"CERRADO";
      $("calendarDetail").innerHTML=`<strong>${f} · ${status}</strong>${escapeHtml(info.reason)}${info.state!=="cerrado"?`<br>Horario: ${motorCalendario.config.horario.inicio}–${motorCalendario.config.horario.fin}.`:""}`;
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
let clauseExecutions=[], badPurchases=[], badSales=[];
let dataSnapshotMs=0;
let statsData=null, statsLoading=false;
let palmaresData=null;
let schedule=null, pendingAction=null, currentView="home", historyPeriod="today";

const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const euros=n=>Math.round(Number(n)||0).toLocaleString("es-ES")+" €";
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const demoKey=k=>`comunio_laviana_v54_demo_${k}`;
const isConfigured=()=>!CFG.DEMO_MODE&&CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY;
const LOGIN_DOMAIN=CFG.LOGIN_DOMAIN||"comuniolaviana.app";
const LOGIN_USERS=Array.isArray(CFG.LOGIN_USERS)?CFG.LOGIN_USERS:[];
const LAST_LOGIN_USER_KEY="comunio_laviana_last_login_user";

function loginSlug(value){
  return norm(value).replace(/[^a-z0-9]+/g,"");
}
function loginEmail(value){
  const slug=loginSlug(value);
  return slug?`${slug}@${LOGIN_DOMAIN}`:"";
}

const sameManager=(a,b)=>norm(a)===norm(b);
function sourceDateMs(value){
  const s=String(value||"").trim();
  if(!s)return 0;
  const d=new Date(s.replace(" ","T"));
  return Number.isFinite(d.getTime())?d.getTime():0;
}
function allDemoRecords(kind){
  const out=[];
  const prefix=demoKey(kind+"_");
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith(prefix)){
      try{out.push(...JSON.parse(localStorage.getItem(k)||"[]"));}catch{}
    }
  }
  return out;
}
function allDemoClauses(){return allDemoRecords("clauses");}
function allDemoBadPurchases(){return allDemoRecords("badbuys");}
function allDemoBadSales(){return allDemoRecords("badsales");}
function eventTime(e){const t=new Date(e.executed_at||e._time||0).getTime();return Number.isFinite(t)?t:0;}

function effectiveLeaguePlayers(){
  if(isConfigured())return players.filter(p=>p.active!==false);

  const map=new Map(players.filter(p=>p.active!==false).map(p=>[p.name,{...p}]));
  const ops=[
    ...allDemoClauses().map(e=>({...e,_kind:"clause"})),
    ...allDemoBadSales().map(e=>({...e,_kind:"sale"})),
    ...allDemoBadPurchases().map(e=>({...e,_kind:"buy"}))
  ].filter(e=>eventTime(e)>dataSnapshotMs).sort((a,b)=>eventTime(a)-eventTime(b));

  for(const e of ops){
    let p=map.get(e.player_name);
    if(!p){
      p={
        name:e.player_name,team:e.team||"",position:e.position||"",
        points:Number(e.points)||0,market_value:Number(e.market_value)||0,
        clause_value:Number(e.clause_value)||0,active:true,owner_name:""
      };
      map.set(e.player_name,p);
    }
    if(e.team)p.team=e.team;
    if(e.position)p.position=e.position;
    if(Number.isFinite(Number(e.points)))p.points=Number(e.points)||0;
    if(Number(e.market_value)>0)p.market_value=Number(e.market_value);
    if(Number(e.clause_value)>0)p.clause_value=Number(e.clause_value);

    if(e._kind==="clause")p.owner_name=e.executor_name;
    if(e._kind==="sale")p.owner_name="Equipo Malo";
    if(e._kind==="buy")p.owner_name=e.buyer_name;
  }
  return [...map.values()];
}

function effectiveBadPlayers(){
  if(isConfigured())return badPlayers.filter(p=>p.available!==false);

  const map=new Map(badPlayers.map(p=>[p.name,{...p,available:p.available!==false}]));
  const ops=[
    ...allDemoBadSales().map(e=>({...e,_kind:"sale"})),
    ...allDemoBadPurchases().map(e=>({...e,_kind:"buy"}))
  ].sort((a,b)=>eventTime(a)-eventTime(b));

  for(const e of ops){
    if(e._kind==="sale"){
      const value=Number(e.market_value)||0;
      map.set(e.player_name,{
        name:e.player_name,team:e.team||"",position:e.position||"",
        points:Number(e.points)||0,market_value:value,
        multiplier:specialMultiplier(value),
        clause_value:Math.round(value*specialMultiplier(value)),
        available:true
      });
    }else{
      const p=map.get(e.player_name);
      if(p)p.available=false;
    }
  }
  return [...map.values()].filter(p=>p.available!==false);
}

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
  }else if(CFG.DEMO_MODE){
    $("demoBanner").classList.remove("hidden");
    await loadWebData();
    const saved=localStorage.getItem(demoKey("user"));
    if(saved){profile={manager_name:saved,role:"demo"};await enterApp();}
    else showLogin();
  }else{
    showLogin("Configuración pendiente: conecta Supabase para activar los 18 accesos personales.");
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
  $("passwordLoginBtn").addEventListener("click",signInWithPassword);
  $("usernameSelect").addEventListener("change",()=>{
    const name=$("usernameSelect").value;
    if(name)localStorage.setItem(LAST_LOGIN_USER_KEY,name);
    $("passwordInput").focus();
  });
  $("passwordInput").addEventListener("input",()=>{
    $("passwordInput").value=$("passwordInput").value.replace(/\D/g,"").slice(0,6);
  });
  $("passwordInput").addEventListener("keydown",e=>{if(e.key==="Enter")signInWithPassword();});
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

  $("statsPlayerSearch").addEventListener("input",renderStatsHistory);
  $("statsUserFilter").addEventListener("change",renderStatsHistory);
  $("statsClearBtn").addEventListener("click",()=>{
    $("statsPlayerSearch").value="";
    $("statsUserFilter").value="";
    renderStatsHistory();
  });
  $("statsRefreshBtn").addEventListener("click",()=>loadStatsData(true));

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
  if(CFG.DEMO_MODE){
    $("demoLogin").classList.remove("hidden");$("realLogin").classList.add("hidden");
    $("loginHelp").textContent="Prueba local: elige un participante.";
    fillDemoUsers();
  }else{
    $("realLogin").classList.remove("hidden");$("demoLogin").classList.add("hidden");
    fillLoginUsers();
    $("loginHelp").textContent=isConfigured()
      ?"Selecciona tu usuario e introduce tu PIN."
      :"Falta conectar Supabase en config.js antes de activar los accesos personales.";
    $("passwordLoginBtn").disabled=!isConfigured();
  }
}
function fillLoginUsers(){
  const select=$("usernameSelect");
  if(!select)return;
  const saved=localStorage.getItem(LAST_LOGIN_USER_KEY)||"";
  select.innerHTML='<option value="">Selecciona tu usuario</option>'+LOGIN_USERS.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if(LOGIN_USERS.includes(saved))select.value=saved;
}
async function sessionAction(){
  if(!profile){showLogin();return;}
  if(!isConfigured()){
    localStorage.removeItem(demoKey("user"));profile=null;showLogin();return;
  }
  await supa.auth.signOut();profile=null;showLogin();
}
async function signInWithPassword(){
  if(!isConfigured()){ $("loginMessage").textContent="Supabase todavía no está configurado.";return; }
  const username=$("usernameSelect").value.trim();
  const password=$("passwordInput").value;
  const email=loginEmail(username);
  if(!username){$("loginMessage").textContent="Selecciona tu usuario.";return;}
  if(!/^\d{6}$/.test(password)){$("loginMessage").textContent="Introduce tu PIN de 6 cifras.";return;}
  $("passwordLoginBtn").disabled=true;
  $("loginMessage").textContent="Comprobando acceso…";
  const {error}=await supa.auth.signInWithPassword({email,password});
  $("passwordLoginBtn").disabled=false;
  if(error){
    $("passwordInput").value="";
    $("loginMessage").textContent="Usuario o contraseña incorrectos.";
    return;
  }
  localStorage.setItem(LAST_LOGIN_USER_KEY,username);
  $("passwordInput").value="";
  $("loginMessage").textContent="";
}

async function enterApp(){
  $("loginView").classList.add("hidden");$("sessionBtn").textContent=profile.manager_name||"Salir";
  const adminNav=$("adminNav");
  if(adminNav)adminNav.classList.toggle("hidden",profile?.role!=="admin");
  if(isConfigured()){await syncLeagueData();await loadRealData();}else await loadDemoData();
  try{await loadPalmaresData();}catch(e){console.error("Palmarés:",e);}
  fillFilters();updateStatusUI();renderMyTeam();renderPlayers();renderBadPlayers();renderActivityMini();renderHonours();showView(currentView);
}

async function firstJson(paths){
  for(const u of paths){
    try{const r=await fetch(u+"?v="+Date.now(),{cache:"no-store"});if(r.ok)return await r.json();}catch{}
  }
  throw new Error("No se pudo cargar "+paths.join(" / "));
}
async function loadPalmaresData(){
  palmaresData=await firstJson(["../palmares.json","palmares.json"]);
}
function honourManagerName(name){
  if(!palmaresData)return String(name||"");
  return palmaresData.aliases?.[name]||String(name||"");
}
function honourManagerKey(name){
  return norm(honourManagerName(name));
}
function collectHonours(managerName){
  if(!palmaresData||!managerName)return[];
  const key=norm(managerName),out=[];
  for(const s of palmaresData.temporadas||[]){
    const league=s.liga||{};
    [["oro","liga_oro"],["plata","liga_plata"],["bronce","liga_bronce"]].forEach(pair=>{
      const slot=pair[0],type=pair[1],item=league[slot];
      if(item&&honourManagerKey(item.manager)===key)out.push({type,temporada:s.temporada,puntos:item.puntos??null,manager:item.manager});
    });
    if(s.copa&&honourManagerKey(s.copa.manager)===key)out.push({type:"copa",temporada:s.temporada,puntos:null,manager:s.copa.manager});
  }
  return out.sort((a,b)=>String(b.temporada).localeCompare(String(a.temporada)));
}
function trophyMeta(type){
  return {
    liga_oro:{label:"Campeón de Liga",short:"Liga · Oro",cls:"gold",icon:"🏆"},
    liga_plata:{label:"Segundo de Liga",short:"Liga · Plata",cls:"silver",icon:"🏆"},
    liga_bronce:{label:"Tercero de Liga",short:"Liga · Bronce",cls:"bronze",icon:"🏆"},
    copa:{label:"Campeón de Copa",short:"Copa",cls:"cup",icon:"🏆"}
  }[type]||{label:"Trofeo",short:"Trofeo",cls:"cup",icon:"🏆"};
}
function renderMyHonours(){
  const section=$("myHonoursSection");
  if(!section)return;
  if(!palmaresData||!profile){section.classList.add("hidden");return;}
  section.classList.remove("hidden");
  const list=collectHonours(profile.manager_name);
  const counts={liga_oro:0,liga_plata:0,liga_bronce:0,copa:0};
  list.forEach(x=>counts[x.type]=(counts[x.type]||0)+1);
  const totalTitles=counts.liga_oro+counts.copa;
  const podiums=counts.liga_oro+counts.liga_plata+counts.liga_bronce;
  $("myHonoursSummary").innerHTML="<span><b>"+totalTitles+"</b> títulos</span><span><b>"+podiums+"</b> podios de Liga</span><span><b>"+counts.copa+"</b> Copas</span>";
  const shelf=$("myHonoursShelf");
  if(!list.length){shelf.innerHTML='<div class="honours-empty">Aún no tienes trofeos históricos en el palmarés.</div>';return;}
  shelf.innerHTML=list.map(x=>{
    const m=trophyMeta(x.type);
    const pts=x.puntos!=null?" · "+Number(x.puntos)+" pts":"";
    return '<article class="trophy-card '+m.cls+'"><div class="trophy-icon">'+m.icon+'</div><div><b>'+m.label+'</b><span>'+escapeHtml(x.temporada)+pts+'</span></div></article>';
  }).join("");
}
function renderHonours(){
  const ranking=$("honoursRanking"),history=$("honoursHistory"),archive=$("honoursArchive");
  if(!ranking||!history)return;
  if(!palmaresData){ranking.innerHTML='<div class="empty">No se pudo cargar el palmarés.</div>';history.innerHTML="";return;}
  const map=new Map();
  const ensure=name=>{
    const display=honourManagerName(name),key=norm(display);
    if(!map.has(key))map.set(key,{name:display,gold:0,silver:0,bronze:0,cup:0});
    return map.get(key);
  };
  for(const s of palmaresData.temporadas||[]){
    const l=s.liga||{};
    if(l.oro)ensure(l.oro.manager).gold++;
    if(l.plata)ensure(l.plata.manager).silver++;
    if(l.bronce)ensure(l.bronce.manager).bronze++;
    if(s.copa)ensure(s.copa.manager).cup++;
  }
  const rows=[...map.values()].sort((a,b)=>(b.gold+b.cup)-(a.gold+a.cup)||(b.gold+b.silver+b.bronze)-(a.gold+a.silver+a.bronze)||a.name.localeCompare(b.name,"es"));
  ranking.innerHTML=rows.map((x,i)=>{
    const isMe=profile&&norm(x.name)===norm(profile.manager_name);
    return '<article class="honours-rank-row '+(isMe?"is-me":"")+'"><strong><span class="rank-num">'+(i+1)+'</span>'+escapeHtml(x.name)+(isMe?'<small>Tú</small>':"")+'</strong><div class="honours-counts"><span class="gold">🏆 '+x.gold+'</span><span class="silver">🥈 '+x.silver+'</span><span class="bronze">🥉 '+x.bronze+'</span><span class="cup">🏆 Copa '+x.cup+'</span></div></article>';
  }).join("");
  if(archive){
    const seasons=[...(palmaresData.temporadas||[])].filter(s=>Array.isArray(s.clasificacion)&&s.clasificacion.length).reverse();
    archive.innerHTML=seasons.length?seasons.map(s=>{
      const rows=s.clasificacion.map(r=>{
        const me=profile&&norm(honourManagerName(r.manager))===norm(profile.manager_name);
        return '<div class="archive-row '+(me?"is-me":"")+'"><span class="archive-pos">'+r.pos+'</span><b>'+escapeHtml(honourManagerName(r.manager))+'</b><span>'+Number(r.puntos)+' pts</span></div>';
      }).join("");
      return '<details class="archive-season"><summary><span>'+escapeHtml(s.temporada)+'</span><small>'+s.clasificacion.length+' jugadores</small></summary><div class="archive-table">'+rows+'</div></details>';
    }).join(""):'<div class="empty">No hay clasificaciones históricas disponibles.</div>';
  }

  history.innerHTML=[...(palmaresData.temporadas||[])].reverse().map(s=>{
    const l=s.liga||{};
    const item=(label,x,cls)=>'<div class="history-winner '+cls+'"><span>'+label+'</span><b>'+(x?escapeHtml(honourManagerName(x.manager)):"—")+'</b>'+(x&&x.puntos!=null?'<small>'+Number(x.puntos)+' pts</small>':"")+'</div>';
    return '<article class="season-card"><h3>'+escapeHtml(s.temporada)+'</h3><div class="season-podium">'+item("🏆 Liga",l.oro,"gold")+item("🥈 2.º",l.plata,"silver")+item("🥉 3.º",l.bronce,"bronze")+item("🏆 Copa",s.copa,"cup")+'</div></article>';
  }).join("");
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
  dataSnapshotMs=sourceDateMs(d.actualizado);

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

async function syncLeagueData(){
  try{
    const {data,error}=await supa.functions.invoke("sync-league-data",{body:{source:"app"}});
    if(error)throw error;
    if(data?.synced)console.info("Datos diarios sincronizados",data);
    return data||null;
  }catch(e){
    console.error("Sincronización diaria:",e);
    showToast("No se pudo sincronizar la actualización diaria",true);
    return null;
  }
}

async function loadRealData(){
  const [p,b,s,c,m,v]=await Promise.all([
    supa.from("players").select("*").eq("active",true).order("clause_value",{ascending:false}),
    supa.from("team_malo_players").select("*").eq("available",true).order("clause_value",{ascending:false}),
    supa.from("clause_days").select("*").eq("day",localDate()).maybeSingle(),
    supa.from("clause_executions").select("*").eq("clause_day",localDate()).order("executed_at",{ascending:true}),
    supa.from("team_malo_purchases").select("*").eq("purchase_day",localDate()).order("executed_at",{ascending:true}),
    supa.from("team_malo_sales").select("*").eq("sale_day",localDate()).order("executed_at",{ascending:true})
  ]);
  if(p.error)throw p.error;if(b.error)throw b.error;if(v.error)throw v.error;
  players=p.data||[];badPlayers=b.data||[];schedule=s.data||null;
  clauseExecutions=c.data||[];badPurchases=m.data||[];badSales=v.data||[];
}
async function loadDemoData(){
  if(!players.length||!badPlayers.length)await loadWebData();
  schedule={day:localDate(),enabled:true,opens_at:CFG.DEFAULT_OPEN+":00",closes_at:CFG.DEFAULT_CLOSE+":00"};
  clauseExecutions=JSON.parse(localStorage.getItem(demoKey("clauses_"+localDate()))||"[]");
  badPurchases=JSON.parse(localStorage.getItem(demoKey("badbuys_"+localDate()))||"[]");
  badSales=JSON.parse(localStorage.getItem(demoKey("badsales_"+localDate()))||"[]");
}

function fillDemoUsers(){
  const owners=[...new Set(players.map(p=>p.owner_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  $("demoUserSelect").innerHTML=owners.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
}
function fillFilters(){
  const owners=[...new Set(effectiveLeaguePlayers().map(p=>p.owner_name).filter(o=>o&&!sameManager(o,"Equipo Malo")))].sort((a,b)=>a.localeCompare(b,"es"));
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
  if(t>close)return{open:false,label:"Horario cerrado",detail:`Cerró a las ${close}`};
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
const executorUsed=()=>clauseExecutions.some(e=>sameManager(e.executor_name,profile?.manager_name));
const blockedOwners=()=>clauseExecutions.map(e=>e.target_owner_name).filter(Boolean);
function availablePlayers(){
  const blocked=blockedOwners();
  return effectiveLeaguePlayers().filter(p=>
    p.active!==false &&
    !sameManager(p.owner_name,profile?.manager_name) &&
    !sameManager(p.owner_name,"Equipo Malo") &&
    !blocked.some(o=>sameManager(o,p.owner_name))
  );
}
function availableBadPlayers(){
  return effectiveBadPlayers();
}
function myTeamPlayers(){
  if(!profile?.manager_name)return[];
  const selectedManager=norm(profile.manager_name);
  if(!selectedManager)return[];

  // MI EQUIPO = exclusivamente el propietario del usuario seleccionado.
  // No se reutiliza ningún filtro de Cláusulas ni se muestran otros propietarios.
  return effectiveLeaguePlayers().filter(p=>{
    if(p.active===false)return false;
    return norm(p.owner_name)===selectedManager;
  });
}
function todayNews(){
  return [
    ...clauseExecutions.map(e=>({...e,_type:"clause",_time:e.executed_at})),
    ...badPurchases.map(e=>({...e,_type:"badteam",_time:e.executed_at})),
    ...badSales.map(e=>({...e,_type:"badsale",_time:e.executed_at}))
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
  if(executorUsed()){state.textContent="🔴 CLÁUSULA USADA";state.classList.remove("hidden");}
  else if(!a.open){state.textContent=`🔒 ${a.detail}. El servidor validará el horario.`;state.classList.remove("hidden");}
  else state.classList.add("hidden");

  const bad=badTeamAvailability(), bs=$("badTeamStateBanner");
  if(!bad.open){bs.textContent=`🔒 ${bad.detail}. Las compras se habilitan automáticamente a las 12:00.`;bs.classList.remove("hidden");}
  else bs.classList.add("hidden");

  const ms=$("myTeamBadState");
  if(ms){
    if(!bad.open){ms.textContent=`🔒 ${bad.detail}. Las ventas al Equipo Malo se habilitan automáticamente a las 12:00.`;ms.classList.remove("hidden");}
    else ms.classList.add("hidden");
  }
}


function renderMyTeam(){
  if(!profile)return;
  const list=myTeamPlayers();
  const bad=badTeamAvailability();
  $("myTeamManager").textContent=String(profile.manager_name||"Mi equipo").toUpperCase();
  $("myTeamCount").textContent=list.length;
  const squadCountCard=$("myTeamCount")?.closest("article");
  if(squadCountCard){
    squadCountCard.classList.toggle("over-limit",list.length>16);
    squadCountCard.title=list.length>16?`Exceso de plantilla: ${list.length} jugadores (máximo 16)`:"Plantilla dentro del límite";
  }
  $("myTeamValue").textContent=euros(list.reduce((s,p)=>s+(Number(p.market_value)||0),0));
  $("myTeamPoints").textContent=list.reduce((s,p)=>s+(Number(p.points)||0),0);

  const box=$("myTeamList");
  if(!list.length){
    box.innerHTML='<div class="empty">No aparecen jugadores en tu plantilla.</div>';
    return;
  }

  const order=["portero","defensa","medio","delantero"];
  box.innerHTML="";
  order.forEach(pos=>{
    const rows=list
      .filter(p=>p.position===pos)
      .sort((a,b)=>(Number(b.market_value)||0)-(Number(a.market_value)||0)||a.name.localeCompare(b.name,"es"));
    if(!rows.length)return;

    const section=document.createElement("section");
    section.className="myteam-position";
    section.innerHTML=`<div class="myteam-position-head"><h3>${POS_LABEL[pos]}</h3><span>${rows.length} · valor ↓</span></div>`;
    rows.forEach(p=>{
      const row=document.createElement("article");
      row.className="myteam-row";
      row.innerHTML=`
        <div>
          <div class="player-name">${escapeHtml(p.name)}</div>
          <div class="player-meta">${escapeHtml(p.team||"Sin equipo")}</div>
          <div class="player-extra">${Number(p.points)||0} pts · Cláusula ${euros(p.clause_value)}</div>
        </div>
        <div class="myteam-value"><span>VALOR</span><b>${euros(p.market_value)}</b></div>
        <button class="sell-bad-btn" ${!bad.open?"disabled":""}>${bad.open?"VENDER":"CERRADO"}<small>AL 💀</small></button>`;
      row.querySelector(".sell-bad-btn").addEventListener("click",()=>openAction("badsale",p));
      section.appendChild(row);
    });
    box.appendChild(section);
  });
  renderMyHonours();
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
    const btnText=used?"USADA":(a.open?"EJECUTAR":"CERRADO");
    row.innerHTML=`
      <div><div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-meta">${escapeHtml(p.owner_name)} · ${escapeHtml(p.team||"Sin equipo")}</div>
      <div class="player-extra">${Number(p.points)||0} pts · Valor ${euros(p.market_value)}</div></div>
      <div class="clause-col"><div class="clause-label">CLÁUSULA</div><div class="clause-value">${euros(p.clause_value)}</div></div>
      <button class="execute-btn${used?" used":""}" ${(!a.open||used)?"disabled":""}>${btnText}</button>`;
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
  }else if(type==="badteam"){
    if(!badTeamAvailability().open){showToast("Equipo Malo está cerrado. Abre a las 12:00.",true);return;}
    $("modalIcon").textContent="💀";$("modalTitle").textContent="Comprar al Equipo Malo";
    $("confirmText").innerHTML=`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.team||"")}<br><br>Valor: ${euros(p.market_value)} · × ${Number(p.multiplier).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})}<br>Precio: <strong>${euros(p.clause_value)}</strong><br><small>Una vez confirmada la compra, el jugador desaparecerá del listado para todos.</small>`;
  }else if(type==="badsale"){
    if(!badTeamAvailability().open){showToast("Equipo Malo está cerrado. Abre a las 12:00.",true);return;}
    $("modalIcon").textContent="💰";$("modalTitle").textContent="Vender al Equipo Malo";
    $("confirmText").innerHTML=`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.team||"")}<br><br>Precio de venta: <strong>${euros(p.market_value)}</strong><br><small>La venta al Equipo Malo se hace por el valor de mercado actual. No se aplica multiplicador. Una vez comunicada, debe ejecutarse en Comunio antes de las 00:00 y no puede cancelarse.</small>`;
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
      else if(type==="badteam")await executeRealBadPurchase(player);
      else await executeRealBadSale(player);
      await loadRealData();
    }else{
      if(type==="clause")executeDemoClause(player);
      else if(type==="badteam")executeDemoBadPurchase(player);
      else executeDemoBadSale(player);
      await loadDemoData();
    }
    closeModal();
    showToast(type==="clause"
      ?`✅ Cláusula ejecutada. ${player.owner_name} queda bloqueado hoy.`
      :type==="badteam"
        ?`✅ ${player.name} comprado al Equipo Malo.`
        :`✅ ${player.name} vendido al Equipo Malo por ${euros(player.market_value)}.`);
    fillFilters();updateStatusUI();renderMyTeam();renderPlayers();renderBadPlayers();renderActivityMini();
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
async function executeRealBadSale(p){
  const {error}=await supa.from("team_malo_sales").insert({player_name:p.name});
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
  if(!effectiveBadPlayers().some(x=>x.name===p.name))throw new Error("BAD_PLAYER_ALREADY_BOUGHT");
  const key=demoKey("badbuys_"+localDate()),arr=JSON.parse(localStorage.getItem(key)||"[]");
  arr.push({
    id:crypto.randomUUID(),purchase_day:localDate(),executed_at:new Date().toISOString(),
    buyer_name:profile.manager_name,player_name:p.name,team:p.team,position:p.position,
    points:p.points,market_value:p.market_value,multiplier:p.multiplier,clause_value:p.clause_value
  });
  localStorage.setItem(key,JSON.stringify(arr));
}
function executeDemoBadSale(p){
  const mine=myTeamPlayers().some(x=>x.name===p.name);
  if(!mine)throw new Error("PLAYER_NOT_OWNED");
  const key=demoKey("badsales_"+localDate()),arr=JSON.parse(localStorage.getItem(key)||"[]");
  arr.push({
    id:crypto.randomUUID(),sale_day:localDate(),executed_at:new Date().toISOString(),
    seller_name:profile.manager_name,player_name:p.name,team:p.team,position:p.position,
    points:p.points,market_value:p.market_value,sale_value:p.market_value
  });
  localStorage.setItem(key,JSON.stringify(arr));
}
function humanError(e){
  const s=String(e?.message||e||"");
  if(s.includes("one_clause_per_executor_day")||s.includes("EXECUTOR_ALREADY_USED")||s.includes("ux_clause_one_per_executor_day"))return "Ya has ejecutado tu cláusula de hoy.";
  if(s.includes("one_received_per_owner_day")||s.includes("OWNER_ALREADY_BLOCKED")||s.includes("ux_clause_one_per_owner_day_ci"))return "Ese propietario acaba de recibir una cláusula. Sus jugadores ya no están disponibles hoy.";
  if(s.includes("ux_clause_one_player_per_day_ci"))return "Ese jugador acaba de recibir una cláusula de otro usuario. Se ha respetado la primera operación registrada por el servidor.";
  if(s.includes("CLAUSES_CLOSED"))return "Las cláusulas están cerradas ahora mismo.";
  if(s.includes("CLAUSE_DAY_CLOSED"))return "Hoy no es día de cláusulas.";
  if(s.includes("BADTEAM_CLOSED"))return "Equipo Malo está cerrado. Abre a las 12:00.";
  if(s.includes("BAD_PLAYER_ALREADY_BOUGHT")||s.includes("BAD_PLAYER_NOT_AVAILABLE"))return "Ese jugador acaba de ser comprado por otro usuario.";
  if(s.includes("PLAYER_NOT_OWNED")||s.includes("BAD_SALE_NOT_OWNER"))return "Ese jugador ya no pertenece a tu equipo. La plantilla se ha actualizado.";
  if(s.includes("CANNOT_TARGET_SELF"))return "No puedes ejecutar una cláusula sobre tu propio equipo.";
  return "La operación no se pudo completar. La lista se ha actualizado por si otro usuario llegó antes.";
}

function renderActivityMini(){
  const arr=[...todayNews()].sort((a,b)=>new Date(b._time)-new Date(a._time)).slice(0,5);
  $("activityMiniList").innerHTML=arr.length?arr.map(newsHtml).join(""):'<div class="empty">Todavía no hay actividad hoy.</div>';
  const badActivity=[
    ...badPurchases.map(e=>({...e,_type:"badteam",_time:e.executed_at})),
    ...badSales.map(e=>({...e,_type:"badsale",_time:e.executed_at}))
  ].sort((a,b)=>new Date(b._time)-new Date(a._time)).slice(0,4);
  $("badTodayMiniList").innerHTML=badActivity.length?badActivity.map(newsHtml).join(""):'<div class="empty">Todavía no hay actividad con el Equipo Malo hoy.</div>';
}

async function loadNews(){
  let day=historyPeriod==="today"?localDate():historyPeriod==="yesterday"?localDate(-1):($("historyDate").value||localDate());
  const title=day===localDate()?"Noticias de hoy":day===localDate(-1)?"Noticias de ayer":`Noticias del ${formatDate(day)}`;
  $("historyTitle").querySelector("h2").textContent=title;

  let clauses=[],buys=[],sales=[],fairplay=[];
  if(isConfigured()){
    const [c,b,s,f]=await Promise.all([
      supa.from("clause_executions").select("*").eq("clause_day",day).order("executed_at",{ascending:true}),
      supa.from("team_malo_purchases").select("*").eq("purchase_day",day).order("executed_at",{ascending:true}),
      supa.from("team_malo_sales").select("*").eq("sale_day",day).order("executed_at",{ascending:true}),
      supa.from("fairplay_cards").select("*").gte("sanctioned_at",new Date(Date.parse(day+"T00:00:00Z")-14*3600000).toISOString()).lt("sanctioned_at",new Date(Date.parse(day+"T00:00:00Z")+38*3600000).toISOString()).order("sanctioned_at",{ascending:true})
    ]);
    clauses=c.data||[];buys=b.data||[];sales=s.data||[];
    fairplay=(f.data||[]).filter(x=>new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE||"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(x.sanctioned_at))===day);
  }else{
    clauses=JSON.parse(localStorage.getItem(demoKey("clauses_"+day))||"[]");
    buys=JSON.parse(localStorage.getItem(demoKey("badbuys_"+day))||"[]");
    sales=JSON.parse(localStorage.getItem(demoKey("badsales_"+day))||"[]");
  }
  const arr=[
    ...clauses.map(e=>({...e,_type:"clause",_time:e.executed_at})),
    ...buys.map(e=>({...e,_type:"badteam",_time:e.executed_at})),
    ...sales.map(e=>({...e,_type:"badsale",_time:e.executed_at})),
    ...fairplay.map(e=>({...e,_type:"fairplay",_time:e.sanctioned_at}))
  ].sort((a,b)=>new Date(b._time)-new Date(a._time));

  $("historyCount").textContent=`${arr.length} noticias`;
  $("historyList").innerHTML=arr.length?arr.map(newsHtml).join(""):'<div class="empty">No hubo actividad ese día.</div>';
}
function newsHtml(e){
  const time=new Intl.DateTimeFormat("es-ES",{timeZone:CFG.TIMEZONE,hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(e._time||e.executed_at));
  if(e._type==="fairplay"){
    const numbers=e.card_count===2?e.card_number+" y "+(e.card_number+1):String(e.card_number);
    return `<article class="history-item"><div class="history-time">${time}</div><div>
      <span class="news-type fairplay">🟨 SANCIÓN FAIR PLAY · N.º ${numbers}</span>
      <div class="history-main">${escapeHtml(e.manager_name)} recibe ${e.card_count===2?"2 tarjetas amarillas":"1 tarjeta amarilla"}</div>
      <div class="history-sub">${escapeHtml(e.reason)}${Number(e.direct_fine)?" · Multa directa: "+euros(e.direct_fine):""}</div>
      <a href="fairplay.html?card=${encodeURIComponent(e.id)}" class="fairplay-news-link">Consultar en Fair Play →</a>
    </div></article>`;
  }
  if(e._type==="badteam"){
    return `<article class="history-item"><div class="history-time">${time}</div><div>
      <span class="news-type badteam">💀 COMPRA AL EQUIPO MALO</span>
      <div class="history-main">${escapeHtml(e.buyer_name||"")} compró a ${escapeHtml(e.player_name||"")}</div>
      <div class="history-sub">${euros(e.clause_value)} · ${escapeHtml(e.team||"")}</div>
    </div></article>`;
  }
  if(e._type==="badsale"){
    return `<article class="history-item"><div class="history-time">${time}</div><div>
      <span class="news-type sale">💰 VENTA AL EQUIPO MALO</span>
      <div class="history-main">${escapeHtml(e.seller_name||"")} vendió a ${escapeHtml(e.player_name||"")}</div>
      <div class="history-sub">${euros(e.sale_value??e.market_value)} · ${escapeHtml(e.team||"")}</div>
    </div></article>`;
  }
  return `<article class="history-item"><div class="history-time">${time}</div><div>
    <span class="news-type clause">⚡ CLÁUSULA</span>
    <div class="history-main">${escapeHtml(e.executor_name||"")} → ${escapeHtml(e.player_name||"")}</div>
    <div class="history-sub">de ${escapeHtml(e.target_owner_name||"")} · ${euros(e.clause_value)}</div>
  </div></article>`;
}

function statsNumber(n){return new Intl.NumberFormat("es-ES").format(Number(n)||0);}
function statsDateES(value){
  const s=String(value||"").slice(0,10),parts=s.split("-");
  return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}`:String(value||"");
}
function statsUpdatedLabel(value){
  const s=String(value||"").trim();
  if(!s)return "";
  const [date,time=""] = s.split(" ");
  return `${statsDateES(date)}${time?` · ${time.slice(0,5)}`:""}`;
}
async function loadStatsData(force=false){
  if(statsLoading)return;
  if(statsData&&!force){renderStats();return;}
  statsLoading=true;
  $("statsRefreshBtn").disabled=true;
  $("statsUpdated").textContent="Actualizando estadísticas…";
  try{
    const r=await fetch(`../estadisticas.json?v=${Date.now()}`,{cache:"no-store"});
    if(!r.ok)throw new Error("No se pudo cargar estadisticas.json");
    statsData=await r.json();
    renderStats();
  }catch(e){
    console.error("Estadísticas:",e);
    $("statsUpdated").textContent="No se pudieron cargar las estadísticas.";
    $("statsSquads").innerHTML='<div class="empty">No hay datos disponibles ahora mismo.</div>';
    $("statsManagers").innerHTML='<div class="empty">No hay datos disponibles ahora mismo.</div>';
    $("statsPlayers").innerHTML='<div class="empty">No hay datos disponibles ahora mismo.</div>';
    $("statsHistoryList").innerHTML='<div class="empty">No hay datos disponibles ahora mismo.</div>';
  }finally{
    statsLoading=false;
    $("statsRefreshBtn").disabled=false;
  }
}
function renderStats(){
  if(!statsData)return;
  const teams=Array.isArray(statsData.equipos)?statsData.equipos:[];
  const moved=Array.isArray(statsData.jugadoresMasTraspasados)?statsData.jugadoresMasTraspasados:[];
  const history=Array.isArray(statsData.historial)?statsData.historial:[];

  $("statsTotalTeams").textContent=statsNumber(teams.length);
  $("statsTotalPlayers").textContent=statsNumber(statsData.totalJugadores);
  $("statsTotalMoves").textContent=statsNumber(statsData.totalMovimientosUsuarios);
  $("statsMovedPlayers").textContent=statsNumber(moved.length);
  $("statsUpdated").textContent=statsData.actualizado
    ? `Actualizado ${statsUpdatedLabel(statsData.actualizado)} · desde ${statsDateES(statsData.fechaInicio||"2026-07-20")}`
    : `Datos desde ${statsDateES(statsData.fechaInicio||"2026-07-20")}`;

  const squads=[...teams].sort((a,b)=>(Number(b.jugadores)||0)-(Number(a.jugadores)||0)||String(a.propietario||"").localeCompare(String(b.propietario||""),"es"));
  $("statsSquads").innerHTML=squads.length?squads.map((x,i)=>statsRankRow(i+1,x.propietario,x.jugadores,"jugadores")).join(""):'<div class="empty">Sin datos de plantillas.</div>';

  const managers=[...teams].sort((a,b)=>(Number(b.movimientos)||0)-(Number(a.movimientos)||0)||String(a.propietario||"").localeCompare(String(b.propietario||""),"es"));
  $("statsManagers").innerHTML=managers.length?managers.map((x,i)=>statsRankRow(i+1,x.propietario,x.movimientos,"mov.")).join(""):'<div class="empty">Sin movimientos.</div>';

  const top=moved.slice(0,25);
  $("statsPlayers").innerHTML=top.length?top.map((x,i)=>statsRankRow(i+1,x.jugador,x.traspasos,"traspasos")).join(""):'<div class="empty">Todavía no hay traspasos registrados.</div>';

  const users=new Set();
  history.forEach(x=>{
    if(x.vendedor&&!['computer','equipomalo'].includes(norm(x.vendedor)))users.add(x.vendedor);
    if(x.comprador&&!['computer','equipomalo'].includes(norm(x.comprador)))users.add(x.comprador);
  });
  const select=$("statsUserFilter"),current=select.value;
  select.innerHTML='<option value="">Todos los usuarios</option>'+[...users].sort((a,b)=>a.localeCompare(b,"es")).map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
  if([...users].includes(current))select.value=current;
  renderStatsHistory();
}
function statsRankRow(rank,label,value,suffix){
  return `<div class="stats-rank-row">
    <span class="stats-rank-pos">${rank}</span>
    <strong>${escapeHtml(label||"—")}</strong>
    <span class="stats-rank-value">${statsNumber(value)} <small>${escapeHtml(suffix)}</small></span>
  </div>`;
}
function renderStatsHistory(){
  if(!statsData)return;
  const history=Array.isArray(statsData.historial)?statsData.historial:[];
  const q=norm($("statsPlayerSearch").value),user=$("statsUserFilter").value;
  const rows=history.filter(x=>{
    const playerOk=!q||norm(x.jugador).includes(q);
    const userOk=!user||x.vendedor===user||x.comprador===user;
    return playerOk&&userOk;
  }).slice(0,50);

  $("statsHistoryList").innerHTML=rows.length?rows.map(x=>`
    <article class="stats-transfer-row">
      <div class="stats-transfer-date">${statsDateES(x.fecha)}</div>
      <div class="stats-transfer-body">
        <div class="stats-transfer-route">${escapeHtml(x.vendedor||"—")} <span>→</span> ${escapeHtml(x.comprador||"—")}</div>
        <div class="stats-transfer-player">${escapeHtml(x.jugador||"—")}${x.precio?` <small>· ${statsNumber(x.precio)} €</small>`:""}</div>
      </div>
    </article>`).join(""):'<div class="empty">No hay movimientos que coincidan con la búsqueda.</div>';
}

function showView(name){
  currentView=name;
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  const map={home:"homeView",myteam:"myteamView",clauses:"clausesView",news:"newsView",badteam:"badteamView",stats:"statsView",honours:"honoursView",rules:"rulesView"};
  $(map[name]||"clausesView").classList.remove("hidden");
  document.querySelectorAll(".main-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("pageTitle").textContent=name==="home"?"Inicio":name==="myteam"?"Mi equipo":name==="news"?"Noticias":name==="badteam"?"Equipo Malo":name==="stats"?"Estadísticas":name==="honours"?"Palmarés":name==="rules"?"Normas":"Cláusulas";
  if(name==="myteam")renderMyTeam();
  if(name==="news")loadNews();
  if(name==="stats")loadStatsData();
  if(name==="honours")renderHonours();
  if(name==="rules")openRulesTab(document.querySelector(".rules-tab.active")?.dataset.rulesTab||"general");
  window.scrollTo({top:0,behavior:"smooth"});
}
function formatDate(iso){const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;}

boot().catch(e=>{
  console.error(e);
  document.body.innerHTML='<div style="padding:30px;color:white;font-family:sans-serif">No se pudo iniciar la aplicación.<br><small>'+escapeHtml(e.message)+'</small></div>';
});
})();
