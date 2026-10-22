
const ZONA="Europe/Madrid";
const PAGINAS={
  equipomalo:{titulo:"Equipo Malo",url:"../equipomalo.html"},
  normas:{titulo:"Normas",url:"../normas.html"},
  copa:{titulo:"Copa",url:"../copa.html"},
  palmares:{titulo:"Palmarés",url:"../palmares.html"},
  estadisticas:{titulo:"Estadísticas",url:"../estadisticas.html"},
  fairplay:{titulo:"Fair Play",url:"../fairplay.html"}
};
const TITULOS={inicio:"Inicio",clausulas:"Cláusulas",hoy:"Cláusulas de hoy",calendario:"Calendario",...Object.fromEntries(Object.entries(PAGINAS).map(([k,v])=>[k,v.titulo]))};
const POSICIONES=[
  {key:"porteros",titulo:"🥅 PORTEROS"},
  {key:"defensas",titulo:"🛡️ DEFENSAS"},
  {key:"medios",titulo:"⚙️ MEDIOS"},
  {key:"delanteros",titulo:"🎯 DELANTEROS"}
];

let usuario=localStorage.getItem("cl_usuario_v4")||"";
let datosRaw=null,equipos={},calendario=null,jugadoresPorPosicion={},participantes=[];
let jugadorActivo=null,serverNow=null,serverCapturedAt=null,installPrompt=null,currentView="inicio";

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const euro=n=>Math.round(Number(n)||0).toLocaleString("es-ES")+" €";

function nowReal(){
  if(serverNow&&serverCapturedAt)return new Date(serverNow.getTime()+(Date.now()-serverCapturedAt));
  return new Date();
}
function madridParts(date=nowReal()){
  const p=new Intl.DateTimeFormat("sv-SE",{timeZone:ZONA,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(date);
  return Object.fromEntries(p.map(x=>[x.type,x.value]));
}
function hoy(){const p=madridParts();return `${p.year}-${p.month}-${p.day}`}
function fechaBonita(fecha=hoy()){
  const [y,m,d]=fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}).format(new Date(Date.UTC(y,m-1,d,12)));
}
function minutosAhora(){const p=madridParts();return Number(p.hour)*60+Number(p.minute)}
function minutos(s){const [h,m]=String(s).split(":").map(Number);return h*60+m}
function equipoDe(nombre){
  const d=equipos[nombre];
  if(typeof d==="string")return d;
  if(d&&typeof d==="object")return d.equipo||d.club||d.team||"";
  return "";
}

function extraerCalendarioDesdeIndex(html){
  const marca="const calendarioClausulas",p=html.indexOf(marca);
  if(p<0)throw new Error("No encuentro el calendario oficial en index.html");
  const inicio=html.indexOf("{",p);
  let nivel=0,fin=-1,comilla=null,escape=false;
  for(let i=inicio;i<html.length;i++){
    const ch=html[i];
    if(comilla){
      if(escape){escape=false;continue}
      if(ch==="\\"){escape=true;continue}
      if(ch===comilla)comilla=null;
      continue;
    }
    if(ch==="'"||ch==='"'||ch==="`"){comilla=ch;continue}
    if(ch==="{")nivel++;
    if(ch==="}"){nivel--;if(nivel===0){fin=i+1;break}}
  }
  if(fin<0)throw new Error("Calendario oficial incompleto");
  return Function('"use strict";return ('+html.slice(inicio,fin)+')')();
}
function fechaDiaSemana(clave){
  const [y,m,d]=clave.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d,12)).getUTCDay();
}
function estadoFecha(fecha){
  if(!calendario)return {estado:"cerrado",motivo:"Calendario no disponible."};
  if(calendario.cierres?.[fecha])return {estado:"cerrado",motivo:calendario.cierres[fecha]};
  if(calendario.aperturas?.[fecha])return {estado:"abierto",motivo:calendario.aperturas[fecha]};
  if(fecha<calendario.inicioTemporada||fecha>calendario.finTemporada)return {estado:"cerrado",motivo:"Fuera del calendario de cláusulas 2026/27."};
  for(const [ini,fin,motivo] of calendario.especiales||[])if(fecha>=ini&&fecha<=fin)return {estado:"especial",motivo};
  const ds=fechaDiaSemana(fecha);
  if(ds===0||ds===6)return {estado:"abierto",motivo:"Temporada ordinaria: cláusulas abiertas los sábados y domingos."};
  return {estado:"cerrado",motivo:"Temporada ordinaria: solo se permiten sábados y domingos."};
}
function diaAbierto(){const e=estadoFecha(hoy());return e.estado==="abierto"||e.estado==="especial"}
function horaAbierta(){const n=minutosAhora();return n>=minutos(calendario.horaInicio)&&n<minutos(calendario.horaFin)}
function datosDeHoy(){return String(datosRaw?.actualizado||"").slice(0,10)===hoy()}

function historial(){
  try{return JSON.parse(localStorage.getItem("cl_historial_v4")||"[]")}catch{return[]}
}
function guardarHistorial(h){localStorage.setItem("cl_historial_v4",JSON.stringify(h))}
function operacionesHoy(){return historial().filter(x=>x.fecha===hoy()).sort((a,b)=>String(b.hora).localeCompare(String(a.hora)))}
function pagoUsado(u){return operacionesHoy().some(x=>norm(x.pagador)===norm(u))}
function recibidoUsado(u){return operacionesHoy().some(x=>norm(x.receptor)===norm(u))}

async function cargarDatos(){
  const [rd,re,ri]=await Promise.all([
    fetch("../datos.json?v="+Date.now(),{cache:"no-store"}),
    fetch("../equipos.json?v="+Date.now(),{cache:"no-store"}).catch(()=>null),
    fetch("../index.html?v="+Date.now(),{cache:"no-store"})
  ]);
  if(!rd.ok)throw new Error("No se pudo cargar datos.json");
  if(!ri.ok)throw new Error("No se pudo cargar el calendario oficial");

  const dateHeader=rd.headers.get("date");
  if(dateHeader){
    const d=new Date(dateHeader);
    if(!Number.isNaN(d.getTime())){serverNow=d;serverCapturedAt=Date.now()}
  }

  datosRaw=await rd.json();
  if(re&&re.ok){const e=await re.json();equipos=e.equipos||e||{}}
  calendario=extraerCalendarioDesdeIndex(await ri.text());

  jugadoresPorPosicion={};
  for(const pos of POSICIONES){
    jugadoresPorPosicion[pos.key]=(datosRaw[pos.key]||[])
      .map(j=>({...j,equipo:equipoDe(j.jugador),posicion:pos.key}))
      .sort((a,b)=>Number(b.clausula)-Number(a.clausula)||String(a.jugador).localeCompare(String(b.jugador),"es"));
  }

  participantes=[...new Set(POSICIONES.flatMap(p=>jugadoresPorPosicion[p.key]).map(j=>String(j.propietario||"").trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
}

function rellenarUsuariosYFiltros(){
  $("usuarioSelect").innerHTML=participantes.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join("");
  $("filtroPropietario").innerHTML=`<option value="">Todos</option>`+participantes.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join("");
  if(usuario){
    const match=participantes.find(u=>norm(u)===norm(usuario));
    if(match){usuario=match;$("usuarioSelect").value=match}
  }
}

function motivoJugador(j){
  if(!diaAbierto())return "Día cerrado";
  if(!datosDeHoy())return "Datos sin actualizar";
  if(!horaAbierta())return "Fuera de horario";
  if(pagoUsado(usuario))return "Pagar ya utilizada";
  if(norm(j.propietario)===norm(usuario))return "Jugador propio";
  if(recibidoUsado(j.propietario))return "Propietario protegido";
  if(operacionesHoy().some(x=>x.jugador===j.jugador))return "Ya clausulado";
  return "";
}
function puedeEjecutar(j){return motivoJugador(j)===""}

function estadoCompactoHTML(){
  const info=estadoFecha(hoy()),d=diaAbierto(),a=datosDeHoy(),h=horaAbierta();
  if(!d){
    return {cls:"closed",html:`<b>🔴 Cláusulas cerradas hoy</b><small>${esc(info.motivo)} · Datos: ${esc(datosRaw.actualizado||"—")}</small>`};
  }
  if(!a){
    return {cls:"closed",html:`<b>🔴 Datos no actualizados hoy</b><small>Última actualización: ${esc(datosRaw.actualizado||"—")} · No se puede ejecutar ninguna cláusula.</small>`};
  }
  if(!h){
    const antes=minutosAhora()<minutos(calendario.horaInicio);
    return {cls:"warn",html:`<b>🟠 Hoy hay cláusulas · ${antes?"Se abren a las "+calendario.horaInicio:"Horario finalizado"}</b><small>Horario oficial ${calendario.horaInicio}–${calendario.horaFin} · Datos actualizados hoy.</small>`};
  }
  return {cls:"open",html:`<b>🟢 Cláusulas abiertas hasta las ${calendario.horaFin}</b><small>Datos actualizados hoy · ${esc(datosRaw.actualizado)}</small>`};
}

function renderEstados(){
  const e=estadoCompactoHTML();
  for(const id of ["estadoCompactoInicio","estadoCompactoClausulas"]){
    $(id).className="status-strip "+e.cls;
    $(id).innerHTML=e.html;
  }
  const p=pagoUsado(usuario),r=recibidoUsado(usuario);
  for(const id of ["inicioPagar","estadoPagar"]){$(id).textContent=p?"UTILIZADA":"DISPONIBLE";$(id).className=p?"blocked":"available"}
  for(const id of ["inicioRecibir","estadoRecibir"]){$(id).textContent=r?"RECIBIDA":"DISPONIBLE";$(id).className=r?"blocked":"available"}
}

function filtrosActuales(){
  return {
    q:norm($("buscar").value),
    posicion:$("filtroPosicion").value,
    propietario:$("filtroPropietario").value
  };
}

function renderClausulas(){
  const f=filtrosActuales();
  const cont=$("clausulasContenido");
  cont.innerHTML="";
  let total=0;

  for(const pos of POSICIONES){
    if(f.posicion&&f.posicion!==pos.key)continue;

    const lista=jugadoresPorPosicion[pos.key]
      .filter(j=>!recibidoUsado(j.propietario))
      .filter(j=>!f.propietario||norm(j.propietario)===norm(f.propietario))
      .filter(j=>!f.q||norm(j.jugador).includes(f.q)||norm(j.propietario).includes(f.q)||norm(j.equipo).includes(f.q));

    if(!lista.length)continue;
    total+=lista.length;

    const sec=document.createElement("section");
    sec.className="position-section";
    sec.innerHTML=`<div class="position-heading"><h2>${pos.titulo}</h2><span>${lista.length} · cláusula ↓</span></div><div class="player-list"></div>`;
    const grid=sec.querySelector(".player-list");

    for(const j of lista){
      const motivo=motivoJugador(j),ok=!motivo;
      const row=document.createElement("article");
      row.className="player-row "+(ok?"":"locked");
      row.innerHTML=`
        <div class="player-main">
          <div class="player-name">${esc(j.jugador)}</div>
          <div class="player-owner">${esc(j.propietario)}${j.equipo?" · "+esc(j.equipo):""}</div>
          <div class="player-stats">${Number(j.puntos)||0} pts · Valor ${euro(j.valor)}</div>
        </div>
        <div class="player-money">
          <span>CLÁUSULA</span>
          <strong>${euro(j.clausula)}</strong>
        </div>
        <button class="execute-btn" type="button" ${ok?"":"disabled"}>
          EJECUTAR
          ${ok?"":`<span class="execute-reason">${esc(motivo)}</span>`}
        </button>`;
      row.querySelector("button").addEventListener("click",()=>abrirModal(j));
      grid.appendChild(row);
    }
    cont.appendChild(sec);
  }

  $("resumenListado").textContent=`${total} jugadores mostrados · ordenados por posición y cláusula de mayor a menor`;
  if(!total)cont.innerHTML=`<div class="card muted">No hay jugadores disponibles que coincidan con los filtros.</div>`;
}

function renderOperacionesHoy(){
  const ops=operacionesHoy();
  const html=ops.length?ops.map(x=>`
    <article class="news-item">
      <div class="news-time">${esc(String(x.hora||"").slice(0,5))}</div>
      <div class="news-main">
        <div class="route">⚡ <b>${esc(x.pagador)}</b> paga la cláusula de <b>${esc(x.jugador)}</b> a ${esc(x.receptor)}</div>
        <div class="meta">${esc(fechaBonita(x.fecha))}</div>
      </div>
      <div class="news-amount">${euro(x.importe)}</div>
    </article>`).join("")
    :`<div class="news-empty">Todavía no se ha ejecutado ninguna cláusula hoy.</div>`;

  $("operacionesHoyInicio").innerHTML=html;
  $("operacionesHoyPagina").innerHTML=html;
  $("contadorHoy").textContent=ops.length;
  $("contadorHoyPagina").textContent=ops.length;
}

function abrirModal(j){
  jugadorActivo=j;
  const motivo=motivoJugador(j);
  $("modalJugador").textContent=j.jugador;
  $("modalPropietario").textContent=j.propietario;
  $("modalEquipo").textContent=j.equipo||"—";
  $("modalPuntos").textContent=Number(j.puntos)||0;
  $("modalValor").textContent=euro(j.valor);
  $("modalClausula").textContent=euro(j.clausula);
  $("modalAviso").textContent=motivo||`Al confirmar, ${usuario} utilizará su cláusula de hoy y ${j.propietario} quedará protegido. Todos sus jugadores desaparecerán de la lista.`;
  $("confirmarBtn").disabled=!!motivo;
  $("modal").classList.remove("hidden");
}
function cerrarModal(){$("modal").classList.add("hidden");jugadorActivo=null}

function ejecutar(){
  if(!jugadorActivo)return;
  const motivo=motivoJugador(jugadorActivo);
  if(motivo){toast("❌ "+motivo);cerrarModal();refrescar();return}

  const p=madridParts();
  const item={
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    fecha:hoy(),hora:`${p.hour}:${p.minute}:${p.second}`,
    pagador:usuario,receptor:jugadorActivo.propietario,
    jugador:jugadorActivo.jugador,importe:Number(jugadorActivo.clausula)||0
  };
  const h=historial();h.unshift(item);guardarHistorial(h);
  cerrarModal();
  refrescar();
  toast(`✅ Cláusula ejecutada: ${item.jugador}`);
}

function renderCalendario(){
  const e=estadoFecha(hoy()),abierto=e.estado==="abierto"||e.estado==="especial";
  $("estadoCalendarioHoy").innerHTML=`<div class="today-box ${abierto?"open":"closed"}"><b>${abierto?"🟢 Abierto hoy":"🔴 Cerrado hoy"}</b><br>${esc(e.motivo)}<br><small>Horario cuando está abierto: ${calendario.horaInicio}–${calendario.horaFin}</small></div>`;

  const cont=$("calendarioMeses");cont.innerHTML="";
  const nombres=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const dias=["L","M","X","J","V","S","D"];
  const [sy,sm]=calendario.inicioTemporada.split("-").map(Number);
  const [ey,em]=calendario.finTemporada.split("-").map(Number);

  let y=sy,m=sm-1;
  while(y<ey||(y===ey&&m<=em-1)){
    const card=document.createElement("section");card.className="month-card";
    card.innerHTML=`<h3>${nombres[m]} ${y}</h3><div class="week">${dias.map(x=>`<div>${x}</div>`).join("")}</div><div class="days"></div>`;
    const grid=card.querySelector(".days");
    const first=new Date(y,m,1),offset=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate();

    for(let i=0;i<offset;i++){const d=document.createElement("div");d.className="day empty";grid.appendChild(d)}
    for(let n=1;n<=total;n++){
      const key=`${y}-${String(m+1).padStart(2,"0")}-${String(n).padStart(2,"0")}`,info=estadoFecha(key);
      const b=document.createElement("button"),cls=info.estado==="especial"?"special":info.estado==="abierto"?"open":"closed";
      b.className=`day ${cls} ${key===hoy()?"today":""}`;
      b.innerHTML=`<b>${n}</b><small>${info.estado==="especial"?"ESP":info.estado==="abierto"?"ABR":"CER"}</small>`;
      b.title=info.motivo;
      b.addEventListener("click",()=>toast(`${key}: ${info.motivo}`));
      grid.appendChild(b);
    }
    cont.appendChild(card);
    m++;if(m===12){m=0;y++}
  }
}

function limpiarPaginaIframe(){
  const f=$("webFrame");
  try{
    const doc=f.contentDocument;if(!doc)return;
    const st=doc.createElement("style");
    st.textContent=`nav.menu{display:none!important} body>header,header.hero{display:none!important} main{margin-top:12px!important}.page{padding-top:8px!important}`;
    doc.head.appendChild(st);
    doc.querySelectorAll("a[href]").forEach(a=>{
      const href=(a.getAttribute("href")||"").split("?")[0].split("#")[0];
      const map={"index.html":"clausulas","equipomalo.html":"equipomalo","normas.html":"normas","copa.html":"copa","palmares.html":"palmares","estadisticas.html":"estadisticas","fairplay.html":"fairplay","clausulas-reglamento.html":"calendario"};
      if(map[href])a.addEventListener("click",ev=>{ev.preventDefault();window.parent.abrirSeccion(map[href])});
    });
  }catch(e){console.warn(e)}
}
window.abrirSeccion=abrirSeccion;

function abrirSeccion(view){
  currentView=view;
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  document.querySelectorAll(".app-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("appTitle").textContent=TITULOS[view]||"Comunio Laviana";

  if(view==="inicio")$("view-inicio").classList.remove("hidden");
  else if(view==="clausulas"){$("view-clausulas").classList.remove("hidden");renderEstados();renderClausulas()}
  else if(view==="hoy"){$("view-hoy").classList.remove("hidden");renderOperacionesHoy()}
  else if(view==="calendario"){$("view-calendario").classList.remove("hidden");renderCalendario()}
  else if(PAGINAS[view]){
    $("view-web").classList.remove("hidden");
    const f=$("webFrame"),url=PAGINAS[view].url;
    if(f.dataset.url!==url){f.dataset.url=url;f.src=url+"?app="+Date.now()}
  }
  window.scrollTo({top:0,behavior:"smooth"});
}

function refrescar(){
  if(!usuario)return;
  renderEstados();
  renderOperacionesHoy();
  if(currentView==="clausulas")renderClausulas();
  if(currentView==="calendario")renderCalendario();
}

function mostrar(){
  $("loginView").classList.toggle("hidden",!!usuario);
  $("appView").classList.toggle("hidden",!usuario);
  if(usuario){
    $("holaUsuario").textContent=usuario;
    abrirSeccion(currentView);
    refrescar();
  }
}
function toast(msg){
  const t=$("toast");t.textContent=msg;t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"),2600);
}
function ayudaInstalacion(){
  const ua=navigator.userAgent.toLowerCase();
  $("installHelp").innerHTML=/iphone|ipad|ipod/.test(ua)
    ?"En iPhone: Safari → Compartir → <b>Añadir a pantalla de inicio</b>."
    :"En Android: menú del navegador → <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.";
}

$("entrarBtn").addEventListener("click",()=>{usuario=$("usuarioSelect").value;localStorage.setItem("cl_usuario_v4",usuario);mostrar()});
$("salirBtn").addEventListener("click",()=>{usuario="";localStorage.removeItem("cl_usuario_v4");mostrar()});
$("buscar").addEventListener("input",renderClausulas);
$("filtroPosicion").addEventListener("change",renderClausulas);
$("filtroPropietario").addEventListener("change",renderClausulas);
$("limpiarFiltros").addEventListener("click",()=>{
  $("buscar").value="";$("filtroPosicion").value="";$("filtroPropietario").value="";renderClausulas();
});
$("cerrarModal").addEventListener("click",cerrarModal);
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))cerrarModal()});
$("confirmarBtn").addEventListener("click",ejecutar);
$("nav").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>abrirSeccion(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>abrirSeccion(b.dataset.go)));
$("webFrame").addEventListener("load",limpiarPaginaIframe);

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").addEventListener("click",async()=>{
  if(!installPrompt)return;
  installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").classList.add("hidden");
});

(async function init(){
  ayudaInstalacion();
  try{
    await cargarDatos();
    rellenarUsuariosYFiltros();
    mostrar();
  }catch(e){
    console.error(e);
    document.body.innerHTML=`<div style="padding:24px;color:white;font-family:Arial"><h2>No se pudo cargar la aplicación</h2><p>${esc(e.message)}</p></div>`;
  }
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(console.warn);
  setInterval(()=>refrescar(),15000);
})();
