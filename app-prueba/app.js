
const ZONA = "Europe/Madrid";
const PAGINAS = {
  equipomalo:{titulo:"Equipo Malo",url:"../equipomalo.html"},
  normas:{titulo:"Normas",url:"../normas.html"},
  copa:{titulo:"Copa",url:"../copa.html"},
  palmares:{titulo:"Palmarés",url:"../palmares.html"},
  estadisticas:{titulo:"Estadísticas",url:"../estadisticas.html"},
  fairplay:{titulo:"Fair Play",url:"../fairplay.html"}
};
const TITULOS={inicio:"Inicio",clausulas:"Cláusulas",calendario:"Calendario",...Object.fromEntries(Object.entries(PAGINAS).map(([k,v])=>[k,v.titulo]))};
const POSICIONES=[
  {key:"porteros",titulo:"🥅 PORTEROS"},
  {key:"defensas",titulo:"🛡️ DEFENSAS"},
  {key:"medios",titulo:"⚙️ MEDIOS"},
  {key:"delanteros",titulo:"🎯 DELANTEROS"}
];

let usuario=localStorage.getItem("cl_usuario_v3")||"";
let datosRaw=null, equipos={}, calendario=null;
let jugadoresPorPosicion={};
let participantes=[];
let jugadorActivo=null;
let serverNow=null, serverCapturedAt=null;
let installPrompt=null;
let currentView="inicio";

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const euro=n=>Math.round(Number(n)||0).toLocaleString("es-ES")+" €";

function nowReal(){
  if(serverNow&&serverCapturedAt) return new Date(serverNow.getTime()+(Date.now()-serverCapturedAt));
  return new Date();
}
function madridParts(date=nowReal()){
  const p=new Intl.DateTimeFormat("sv-SE",{timeZone:ZONA,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(date);
  return Object.fromEntries(p.map(x=>[x.type,x.value]));
}
function hoy(){const p=madridParts();return `${p.year}-${p.month}-${p.day}`}
function minutosAhora(){const p=madridParts();return Number(p.hour)*60+Number(p.minute)}
function minutos(s){const [h,m]=String(s).split(":").map(Number);return h*60+m}
function equipoDe(nombre){
  const d=equipos[nombre];
  if(typeof d==="string")return d;
  if(d&&typeof d==="object")return d.equipo||d.club||d.team||"";
  return "";
}

function extraerCalendarioDesdeIndex(html){
  const marca="const calendarioClausulas";
  const p=html.indexOf(marca);
  if(p<0) throw new Error("No encuentro el calendario oficial en index.html");
  const inicio=html.indexOf("{",p);
  let nivel=0, fin=-1, comilla=null, escape=false;
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
  const literal=html.slice(inicio,fin);
  return Function('"use strict";return ('+literal+')')();
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
  for(const [ini,fin,motivo] of calendario.especiales||[]){
    if(fecha>=ini&&fecha<=fin)return {estado:"especial",motivo};
  }
  const ds=fechaDiaSemana(fecha);
  if(ds===0||ds===6)return {estado:"abierto",motivo:"Temporada ordinaria: abiertas los sábados y domingos."};
  return {estado:"cerrado",motivo:"Temporada ordinaria: solo se permiten sábados y domingos."};
}
function diaAbierto(){const e=estadoFecha(hoy());return e.estado==="abierto"||e.estado==="especial"}
function horaAbierta(){const n=minutosAhora();return n>=minutos(calendario.horaInicio)&&n<minutos(calendario.horaFin)}
function datosDeHoy(){return String(datosRaw?.actualizado||"").slice(0,10)===hoy()}
function gateAbierto(){return diaAbierto()&&horaAbierta()&&datosDeHoy()}

function historial(){
  try{return JSON.parse(localStorage.getItem("cl_historial_v3")||"[]")}catch{return[]}
}
function guardarHistorial(h){localStorage.setItem("cl_historial_v3",JSON.stringify(h))}
function operacionesHoy(){return historial().filter(x=>x.fecha===hoy())}
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

function rellenarUsuarios(){
  $("usuarioSelect").innerHTML=participantes.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join("");
  if(usuario){
    const match=participantes.find(u=>norm(u)===norm(usuario));
    if(match){usuario=match;$("usuarioSelect").value=match}
  }
}

function motivoJugador(j){
  if(!diaAbierto())return "Hoy no es día de cláusulas";
  if(!datosDeHoy())return "Datos no actualizados hoy";
  if(!horaAbierta())return `Fuera de horario (${calendario.horaInicio}–${calendario.horaFin})`;
  if(pagoUsado(usuario))return "Ya utilizaste tu cláusula";
  if(norm(j.propietario)===norm(usuario))return "Jugador de tu propio equipo";
  if(recibidoUsado(j.propietario))return `${j.propietario} ya recibió una cláusula`;
  if(operacionesHoy().some(x=>x.jugador===j.jugador))return "Jugador ya clausulado";
  return "";
}

function gateHTML(){
  const fecha=hoy(),info=estadoFecha(fecha);
  const d=diaAbierto(),a=datosDeHoy(),h=horaAbierta(),ok=d&&a&&h;
  const estadoTexto=ok?"🟢 CLÁUSULAS ABIERTAS":"🔒 CLÁUSULAS CERRADAS";
  let detalle="";
  if(!d)detalle=info.motivo;
  else if(!a)detalle="El listado de jugadores todavía no está actualizado hoy.";
  else if(!h)detalle=`Horario permitido: ${calendario.horaInicio}–${calendario.horaFin}.`;
  else detalle=`Puedes ejecutar hasta las ${calendario.horaFin}.`;

  return `<span class="eyebrow">ESTADO DE CLÁUSULAS</span>
    <h2>${estadoTexto}</h2>
    <p>${esc(detalle)}</p>
    <div class="gate-checks">
      <div class="check ${d?"ok":"no"}">${d?"✅":"❌"} ${d?"Día habilitado por el calendario oficial":"Día cerrado por el calendario oficial"}</div>
      <div class="check ${a?"ok":"no"}">${a?"✅":"❌"} ${a?"Datos actualizados hoy · "+esc(datosRaw.actualizado):"Última actualización: "+esc(datosRaw.actualizado||"sin fecha")}</div>
      <div class="check ${h?"ok":"no"}">${h?"✅":"❌"} ${h?"Dentro del horario":"Fuera del horario"} ${calendario.horaInicio}–${calendario.horaFin}</div>
    </div>`;
}

function renderEstados(){
  const html=gateHTML(),open=gateAbierto();
  for(const id of ["gateInicio","gateClausulas"]){
    $(id).innerHTML=html;$(id).className="gate card "+(open?"open":"closed");
  }
  const p=pagoUsado(usuario),r=recibidoUsado(usuario);
  for(const id of ["inicioPagar","estadoPagar"]){$(id).textContent=p?"UTILIZADA":"DISPONIBLE";$(id).className=p?"blocked":"available"}
  for(const id of ["inicioRecibir","estadoRecibir"]){$(id).textContent=r?"RECIBIDA":"DISPONIBLE";$(id).className=r?"blocked":"available"}
}

function renderClausulas(){
  const q=norm($("buscar").value);
  const cont=$("clausulasContenido");
  cont.innerHTML="";
  let total=0;

  for(const pos of POSICIONES){
    const lista=jugadoresPorPosicion[pos.key]
      .filter(j=>!recibidoUsado(j.propietario))
      .filter(j=>!q||norm(j.jugador).includes(q)||norm(j.propietario).includes(q)||norm(j.equipo).includes(q));

    if(!lista.length)continue;
    total+=lista.length;

    const sec=document.createElement("section");
    sec.className="position-section";
    sec.innerHTML=`<div class="position-heading"><h2>${pos.titulo}</h2><span>${lista.length} · mayor a menor cláusula</span></div><div class="players"></div>`;
    const grid=sec.querySelector(".players");

    for(const j of lista){
      const motivo=motivoJugador(j),ok=!motivo;
      const art=document.createElement("article");
      art.className="player "+(ok?"":"locked");
      art.innerHTML=`<div class="player-top">
        <div><h3>${esc(j.jugador)}</h3><div class="player-sub">${esc(j.propietario)}${j.equipo?" · "+esc(j.equipo):""}</div></div>
        <div class="clause"><small>CLÁUSULA</small>${euro(j.clausula)}</div>
      </div>
      <div class="player-data">
        <div class="datum"><span>Puntos</span><strong>${Number(j.puntos)||0}</strong></div>
        <div class="datum"><span>Valor actual</span><strong>${euro(j.valor)}</strong></div>
      </div>
      <button class="player-action" ${ok?"":"disabled"}>${ok?"EJECUTAR CLÁUSULA":esc(motivo)}</button>`;
      art.querySelector("button").addEventListener("click",()=>abrirModal(j));
      grid.appendChild(art);
    }
    cont.appendChild(sec);
  }

  if(!total)cont.innerHTML=`<div class="card muted">No hay jugadores disponibles que coincidan con la búsqueda.</div>`;
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
  $("modalAviso").textContent=motivo||`Al confirmar, ${usuario} gastará su cláusula de hoy y ${j.propietario} quedará protegido: todos sus jugadores desaparecerán de la lista.`;
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
  cerrarModal();refrescar();toast(`✅ ${item.pagador} → ${item.jugador} (${item.receptor})`);
}

function renderCalendario(){
  const e=estadoFecha(hoy());
  const abierto=e.estado==="abierto"||e.estado==="especial";
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
      const key=`${y}-${String(m+1).padStart(2,"0")}-${String(n).padStart(2,"0")}`;
      const info=estadoFecha(key);
      const b=document.createElement("button");
      const cls=info.estado==="especial"?"special":info.estado==="abierto"?"open":"closed";
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

function renderHistorial(){
  const h=historial();
  $("historial").innerHTML=h.length?h.map(x=>`<div class="state-row"><span><b>${esc(x.pagador)}</b> → ${esc(x.jugador)} (${esc(x.receptor)})</span><strong>${euro(x.importe)}</strong></div>`).join(""):`<p class="muted">Todavía no hay ejecuciones en esta prueba.</p>`;
}

function limpiarPaginaIframe(){
  const f=$("webFrame");
  try{
    const doc=f.contentDocument;
    if(!doc)return;
    const st=doc.createElement("style");
    st.textContent=`
      nav.menu{display:none!important}
      body>header, header.hero{display:none!important}
      main{margin-top:12px!important}
      .page{padding-top:8px!important}
    `;
    doc.head.appendChild(st);

    doc.querySelectorAll("a[href]").forEach(a=>{
      const href=(a.getAttribute("href")||"").split("?")[0].split("#")[0];
      const map={
        "index.html":"clausulas","equipomalo.html":"equipomalo","normas.html":"normas",
        "copa.html":"copa","palmares.html":"palmares","estadisticas.html":"estadisticas",
        "fairplay.html":"fairplay","clausulas-reglamento.html":"calendario"
      };
      if(map[href]){
        a.addEventListener("click",ev=>{ev.preventDefault();window.parent.abrirSeccion(map[href])});
      }
    });
  }catch(e){console.warn("No se pudo adaptar la página interna",e)}
}
window.abrirSeccion=abrirSeccion;

function abrirSeccion(view){
  currentView=view;
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  document.querySelectorAll(".app-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("appTitle").textContent=TITULOS[view]||"Comunio Laviana";

  if(view==="inicio")$("view-inicio").classList.remove("hidden");
  else if(view==="clausulas"){$("view-clausulas").classList.remove("hidden");renderEstados();renderClausulas()}
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
  if(currentView==="clausulas")renderClausulas();
  if(currentView==="calendario")renderCalendario();
  renderHistorial();
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
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),2800)}
function ayudaInstalacion(){
  const ua=navigator.userAgent.toLowerCase();
  $("installHelp").innerHTML=/iphone|ipad|ipod/.test(ua)
    ?"En iPhone: Safari → Compartir → <b>Añadir a pantalla de inicio</b>."
    :"En Android: menú del navegador → <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.";
}

$("entrarBtn").addEventListener("click",()=>{usuario=$("usuarioSelect").value;localStorage.setItem("cl_usuario_v3",usuario);mostrar()});
$("salirBtn").addEventListener("click",()=>{usuario="";localStorage.removeItem("cl_usuario_v3");mostrar()});
$("buscar").addEventListener("input",renderClausulas);
$("cerrarModal").addEventListener("click",cerrarModal);
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))cerrarModal()});
$("confirmarBtn").addEventListener("click",ejecutar);
$("nav").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>abrirSeccion(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>abrirSeccion(b.dataset.go)));
$("webFrame").addEventListener("load",limpiarPaginaIframe);

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").classList.add("hidden")});

(async function init(){
  ayudaInstalacion();
  try{
    await cargarDatos();
    rellenarUsuarios();
    mostrar();
  }catch(e){
    console.error(e);
    document.body.innerHTML=`<div style="padding:24px;color:white;font-family:Arial"><h2>No se pudo cargar la aplicación</h2><p>${esc(e.message)}</p></div>`;
  }
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(console.warn);
  setInterval(()=>refrescar(),15000);
})();
