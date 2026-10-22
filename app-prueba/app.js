
const ZONA = "Europe/Madrid";
let config = null;
let usuario = localStorage.getItem("cl_usuario_v2") || "";
let jugadores = [];
let equipos = {};
let participantes = [];
let serverNow = null;
let serverCapturedAt = null;
let jugadorActivo = null;
let installPrompt = null;
let datosActualizado = "";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const norm = s => String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const euro = n => Math.round(Number(n)||0).toLocaleString("es-ES")+" €";

function nowReal(){
  if(serverNow && serverCapturedAt){
    return new Date(serverNow.getTime() + (Date.now()-serverCapturedAt));
  }
  return new Date();
}
function madridParts(date=nowReal()){
  const parts = new Intl.DateTimeFormat("sv-SE",{
    timeZone:ZONA,year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p=>[p.type,p.value]));
}
function hoy(){
  const p=madridParts(); return `${p.year}-${p.month}-${p.day}`;
}
function minutosAhora(){
  const p=madridParts(); return Number(p.hour)*60+Number(p.minute);
}
function minutos(txt){
  const [h,m]=String(txt).split(":").map(Number); return h*60+m;
}
function diaAbierto(){ return config.dias_abiertos.includes(hoy()); }
function horaAbierta(){
  const n=minutosAhora();
  return n>=minutos(config.hora_inicio) && n<minutos(config.hora_fin);
}
function datosDeHoy(){
  return String(datosActualizado||"").slice(0,10)===hoy();
}
function gateAbierto(){ return diaAbierto() && horaAbierta() && datosDeHoy(); }

function keyHist(){ return "cl_historial_v2"; }
function hist(){
  try{return JSON.parse(localStorage.getItem(keyHist())||"[]");}catch{return []}
}
function saveHist(x){ localStorage.setItem(keyHist(),JSON.stringify(x)); }
function operacionesHoy(){ return hist().filter(x=>x.fecha===hoy()); }
function pagoUsado(u){ return operacionesHoy().some(x=>norm(x.pagador)===norm(u)); }
function recibidoUsado(u){ return operacionesHoy().some(x=>norm(x.receptor)===norm(u)); }

async function cargar(){
  const [rc, rd, re] = await Promise.all([
    fetch("calendario.json?v="+Date.now(),{cache:"no-store"}),
    fetch("../datos.json?v="+Date.now(),{cache:"no-store"}),
    fetch("../equipos.json?v="+Date.now(),{cache:"no-store"}).catch(()=>null)
  ]);

  config = await rc.json();

  // Referencia de hora del servidor/CDN, si está disponible.
  const dh = rd.headers.get("date");
  if(dh){
    const d = new Date(dh);
    if(!Number.isNaN(d.getTime())){
      serverNow=d;
      serverCapturedAt=Date.now();
    }
  }

  const raw = await rd.json();
  datosActualizado = raw.actualizado || "";
  if(re && re.ok){
    const eraw=await re.json();
    equipos=eraw.equipos||eraw||{};
  }

  jugadores=["porteros","defensas","medios","delanteros"].flatMap(pos =>
    (raw[pos]||[]).map(j=>({...j,posicion:pos,equipo:equipoDe(j.jugador)}))
  );
  participantes=[...new Set(jugadores.map(j=>String(j.propietario||"").trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"es"));
}

function equipoDe(nombre){
  const d=equipos[nombre];
  if(typeof d==="string") return d;
  if(d&&typeof d==="object") return d.equipo||d.club||d.team||"";
  return "";
}

function fillUsers(){
  $("usuario").innerHTML=participantes.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join("");
  if(usuario && participantes.includes(usuario)) $("usuario").value=usuario;
}

function motivoJugador(j){
  if(!diaAbierto()) return "Hoy no es día de cláusulas";
  if(!datosDeHoy()) return "Datos no actualizados hoy";
  if(!horaAbierta()) return `Fuera de horario (${config.hora_inicio}–${config.hora_fin})`;
  if(pagoUsado(usuario)) return "Ya utilizaste tu cláusula";
  if(norm(j.propietario)===norm(usuario)) return "Es un jugador de tu equipo";
  if(recibidoUsado(j.propietario)) return `${j.propietario} ya recibió una cláusula`;
  if(operacionesHoy().some(x=>x.jugador===j.jugador)) return "Jugador ya clausulado";
  return "";
}
function puede(j){ return motivoJugador(j)===""; }

function renderGate(){
  const d=diaAbierto(), a=datosDeHoy(), h=horaAbierta(), ok=d&&a&&h;
  $("dot").className="dot "+(ok?"ok":"no");

  if(ok){
    $("estadoTitulo").textContent="🟢 CLÁUSULAS ABIERTAS";
    $("estadoDetalle").textContent=`Hasta las ${config.hora_fin}.`;
  }else{
    $("estadoTitulo").textContent="🔒 CLÁUSULAS CERRADAS";
    if(!d) $("estadoDetalle").textContent="Hoy no está habilitado en el calendario.";
    else if(!a) $("estadoDetalle").textContent="La base de jugadores todavía no está actualizada hoy.";
    else $("estadoDetalle").textContent=`Horario permitido: ${config.hora_inicio}–${config.hora_fin}.`;
  }

  const setCheck=(id,ok,text)=>$(id).innerHTML=`<div class="check ${ok?"ok":"no"}">${ok?"✅":"❌"} ${esc(text)}</div>`;
  setCheck("checkDia",d,d?"Día habilitado en el calendario":"Día cerrado en el calendario");
  setCheck("checkDatos",a,a?`Datos actualizados hoy · ${datosActualizado}`:`Última actualización: ${datosActualizado||"sin fecha"}`);
  setCheck("checkHora",h,h?`Dentro del horario ${config.hora_inicio}–${config.hora_fin}`:`Fuera del horario ${config.hora_inicio}–${config.hora_fin}`);
}

function renderMiEstado(){
  const p=pagoUsado(usuario), r=recibidoUsado(usuario);
  $("estadoPagar").textContent=p?"UTILIZADA":"DISPONIBLE";
  $("estadoPagar").className=p?"blocked":"available";
  $("estadoRecibir").textContent=r?"RECIBIDA":"DISPONIBLE";
  $("estadoRecibir").className=r?"blocked":"available";
}

function renderLista(){
  const q=norm($("buscar").value);
  // REGLA REAL: si un propietario ya recibió una cláusula hoy,
  // TODOS sus jugadores desaparecen inmediatamente de la lista.
  const visibles=jugadores
    .filter(j=>!recibidoUsado(j.propietario))
    .filter(j=>!q || norm(j.jugador).includes(q)||norm(j.propietario).includes(q)||norm(j.equipo).includes(q))
    .sort((a,b)=>Number(b.clausula)-Number(a.clausula));

  $("lista").innerHTML=visibles.map(j=>{
    const m=motivoJugador(j), ok=!m;
    return `<article class="player ${ok?"":"locked"}">
      <div><h3>${esc(j.jugador)}</h3><div class="sub">${esc(j.propietario)}${j.equipo?" · "+esc(j.equipo):""}</div></div>
      <div class="amount"><small>CLÁUSULA</small>${euro(j.clausula)}</div>
      <button data-name="${encodeURIComponent(j.jugador)}" ${ok?"":"disabled"}>${ok?"EJECUTAR CLÁUSULA":esc(m)}</button>
    </article>`;
  }).join("") || `<div class="card muted">No hay jugadores disponibles con este filtro.</div>`;

  document.querySelectorAll(".player button[data-name]").forEach(b=>{
    b.addEventListener("click",()=>{
      const name=decodeURIComponent(b.dataset.name);
      const j=jugadores.find(x=>x.jugador===name);
      abrirModal(j);
    });
  });
}

function abrirModal(j){
  jugadorActivo=j;
  const m=motivoJugador(j);
  $("mJugador").textContent=j.jugador;
  $("mProp").textContent=j.propietario;
  $("mEquipo").textContent=j.equipo||"—";
  $("mImporte").textContent=euro(j.clausula);
  $("mAviso").textContent=m || `Al confirmar: ${usuario} utilizará su cláusula y ${j.propietario} quedará protegido. Todos sus jugadores desaparecerán para el resto de usuarios.`;
  $("confirmar").disabled=!!m;
  $("modal").classList.remove("hidden");
}
function cerrar(){ $("modal").classList.add("hidden"); jugadorActivo=null; }

function ejecutar(){
  if(!jugadorActivo) return;
  // Se vuelven a comprobar TODAS las reglas justo antes de registrar.
  const m=motivoJugador(jugadorActivo);
  if(m){ toast("❌ "+m); cerrar(); refrescar(); return; }

  const p=madridParts();
  const item={
    id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),
    fecha:hoy(),
    hora:`${p.hour}:${p.minute}:${p.second}`,
    pagador:usuario,
    receptor:jugadorActivo.propietario,
    jugador:jugadorActivo.jugador,
    importe:Number(jugadorActivo.clausula)||0
  };
  const h=hist(); h.unshift(item); saveHist(h);
  cerrar();
  refrescar();
  toast(`✅ ${item.pagador} → ${item.jugador} (${item.receptor})`);
}

function renderHist(){
  const h=hist();
  $("historial").innerHTML=h.length?h.map(x=>`
    <div class="history"><b>${esc(x.pagador)}</b> paga cláusula de <b>${esc(x.jugador)}</b> a ${esc(x.receptor)} · ${euro(x.importe)}
      <small>${esc(x.fecha)} · ${esc(x.hora)}</small>
    </div>`).join(""):`<p class="muted">Todavía no hay operaciones de prueba.</p>`;
}

function refrescar(){
  renderGate(); renderMiEstado(); renderLista(); renderHist();
}
function show(){
  $("login").classList.toggle("hidden",!!usuario);
  $("app").classList.toggle("hidden",!usuario);
  if(usuario){
    $("saludo").textContent="Hola, "+usuario;
    $("cuentaUsuario").textContent=usuario;
    refrescar();
  }
}
function toast(t){
  $("toast").textContent=t;$("toast").classList.remove("hidden");
  setTimeout(()=>$("toast").classList.add("hidden"),2600);
}

$("entrar").addEventListener("click",()=>{
  usuario=$("usuario").value;localStorage.setItem("cl_usuario_v2",usuario);show();
});
$("salir").addEventListener("click",()=>{
  usuario="";localStorage.removeItem("cl_usuario_v2");show();
});
$("buscar").addEventListener("input",renderLista);
$("cerrar").addEventListener("click",cerrar);
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))cerrar()});
$("confirmar").addEventListener("click",ejecutar);
$("reiniciar").addEventListener("click",()=>{
  if(confirm("¿Borrar todas las ejecuciones de prueba guardadas en este móvil?")){
    localStorage.removeItem(keyHist());refrescar();toast("Pruebas reiniciadas");
  }
});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));
  ["clausulas","historial","cuenta"].forEach(t=>$("tab-"+t).classList.toggle("hidden",t!==b.dataset.tab));
  if(b.dataset.tab==="historial")renderHist();
}));

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();installPrompt=e;$("installBtn").classList.remove("hidden");
});
$("installBtn").addEventListener("click",async()=>{
  if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;
  installPrompt=null;$("installBtn").classList.add("hidden");
});
function installHelp(){
  const ua=navigator.userAgent.toLowerCase();
  $("installText").innerHTML=/iphone|ipad|ipod/.test(ua)
    ?"iPhone: Safari → Compartir → <b>Añadir a pantalla de inicio</b>."
    :"Android: menú del navegador → <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.";
}

(async function(){
  installHelp();
  try{
    await cargar();fillUsers();show();
  }catch(e){
    console.error(e);alert("No se pudieron cargar los datos de la prueba.");
  }
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(console.warn);
  setInterval(()=>{if(usuario)refrescar()},15000);
})();
