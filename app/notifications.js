(() => {
"use strict";

const CFG = window.COMUNIO_CONFIG;
if (!CFG || CFG.DEMO_MODE || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;

const client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
let currentSession = null;
let uiReady = false;

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
}
function supported(){
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
function b64ToUint8Array(base64String){
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
function card(){
  return document.getElementById("notificationCard");
}
function closePanel(delay=0){
  const run=()=>card()?.classList.remove("v65-notif-open");
  if(delay) setTimeout(run,delay); else run();
}
function setState(kind, title, text, buttonText="", showTest=false){
  const el = card();
  if (!el) return;
  el.dataset.state = kind;
  el.querySelector(".notif-title").textContent = title;
  el.querySelector(".notif-text").textContent = text;
  const mainBtn = el.querySelector("#notifMainBtn");
  const testBtn = el.querySelector("#notifTestBtn");
  if (buttonText){
    mainBtn.textContent = buttonText;
    mainBtn.classList.remove("hidden");
  } else {
    mainBtn.classList.add("hidden");
  }
  testBtn.classList.toggle("hidden", !showTest);
  document.body.dataset.pushState = kind;
}
function ensureUI(){
  if (uiReady) return;
  const home = document.getElementById("homeView");
  if (!home) return;
  const hero = home.querySelector(".hero-card");
  if (!hero) return;

  const el = document.createElement("section");
  el.id = "notificationCard";
  el.className = "notification-card";
  el.innerHTML = `
    <div class="notif-icon">🔔</div>
    <div class="notif-copy">
      <strong class="notif-title">Notificaciones</strong>
      <span class="notif-text">Comprobando este dispositivo…</span>
    </div>
    <button id="notifCloseBtn" type="button" class="notif-close" aria-label="Cerrar">✕</button>
    <div class="notif-actions">
      <button id="notifMainBtn" type="button" class="notif-main hidden">Activar</button>
      <button id="notifTestBtn" type="button" class="notif-test hidden">Probar aviso</button>
    </div>`;
  hero.insertAdjacentElement("afterend", el);

  el.querySelector("#notifMainBtn").addEventListener("click", async () => {
    let subscribed = false;
    try {
      if (supported()) {
        const reg = await getRegistration();
        subscribed = !!(await reg.pushManager.getSubscription());
      }
    } catch {}
    if (Notification.permission === "granted" && subscribed) {
      await disableNotifications();
    } else {
      await enableNotifications();
    }
  });
  el.querySelector("#notifTestBtn").addEventListener("click", testNotification);
  el.querySelector("#notifCloseBtn").addEventListener("click",()=>closePanel());

  uiReady = true;
  refreshState();
}
async function getRegistration(){
  return await navigator.serviceWorker.ready;
}
async function saveSubscription(sub){
  const json = sub.toJSON();
  const keys = json.keys || {};
  const { error } = await client.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh || "",
    p_auth: keys.auth || "",
    p_user_agent: navigator.userAgent || ""
  });
  if (error) throw error;
}
async function syncExistingSubscription(){
  if (!currentSession || !supported()) return;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) await saveSubscription(sub);
}
async function enableNotifications(){
  try {
    if (!currentSession){
      setState("warning","Inicia sesión","Entra con tu usuario antes de activar las notificaciones.");
      return;
    }
    if (isIOS() && !isStandalone()){
      setState("warning","Instala primero la app","En iPhone debes añadir Comunio Laviana a la pantalla de inicio y abrirla desde el icono.");
      return;
    }
    if (!supported()){
      setState("error","No disponible","Este navegador no admite notificaciones push para esta app.");
      return;
    }

    setState("loading","Activando…",Notification.permission === "granted" ? "Registrando este dispositivo…" : "Acepta el permiso de notificaciones cuando aparezca.");
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted"){
      await refreshState();
      return;
    }

    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();

    if (!sub){
      const { data:key, error:keyError } = await client.rpc("get_vapid_public_key");
      if (keyError) throw keyError;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8Array(key)
      });
    }

    await saveSubscription(sub);
    setState("ok","Notificaciones activadas","Recibirás todos los movimientos de Noticias. Si te pagan una cláusula, el aviso será especial.","Desactivar",true);
    closePanel(850);
  } catch (e){
    console.error("Notificaciones:", e);
    setState("error","No se pudieron activar","Vuelve a intentarlo dentro de la app.","Reintentar");
  }
}
async function disableNotifications(){
  try {
    if (!supported()) return;
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub && currentSession){
      await client.rpc("delete_push_subscription",{p_endpoint:sub.endpoint});
    }
    if (sub) await sub.unsubscribe();
    setState("off","Notificaciones desactivadas","Puedes volver a activarlas cuando quieras.","Activar");
    closePanel(500);
  } catch (e){
    console.error(e);
    refreshState();
  }
}
async function testNotification(){
  const btn = document.getElementById("notifTestBtn");
  if (btn) btn.disabled = true;
  try {
    const { data, error } = await client.functions.invoke("notify-operation", {
      body: { test: true }
    });
    if (error) throw error;
    if (!data?.sent){
      setState("warning","No se pudo enviar la prueba","Revisa que las notificaciones sigan activadas.","Desactivar",true);
    } else {
      setState("ok","Prueba enviada","Te acabamos de enviar una notificación de prueba.","Desactivar",true);
      closePanel(900);
    }
  } catch (e){
    console.error("Prueba push:", e);
    setState("error","Falló la prueba","Comprueba los permisos del dispositivo.","Desactivar",true);
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function refreshState(){
  ensureUI();
  if (!card()) return;

  if (isIOS() && !isStandalone()){
    setState("warning","Activa avisos en el móvil","En iPhone instala la app en la pantalla de inicio para poder recibir notificaciones.","Cómo activar");
    const btn = document.getElementById("notifMainBtn");
    if (btn) btn.onclick = () => {
      alert("En Safari pulsa Compartir → Añadir a pantalla de inicio. Después abre Comunio Laviana desde el nuevo icono y vuelve a esta pantalla.");
    };
    return;
  }
  if (!supported()){
    setState("error","Notificaciones no disponibles","Este navegador o dispositivo no admite push web.");
    return;
  }
  if (!currentSession){
    setState("off","Notificaciones","Inicia sesión para configurar los avisos.");
    return;
  }
  if (Notification.permission === "denied"){
    setState("error","Notificaciones bloqueadas","Debes permitirlas desde los ajustes del navegador o de la app.");
    return;
  }

  try {
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (Notification.permission === "granted" && sub){
      await saveSubscription(sub);
      setState("ok","Notificaciones activadas","Todos los movimientos de Noticias + aviso especial si te pagan una cláusula.","Desactivar",true);
    } else {
      setState("off","Activa las notificaciones","Recibe avisos aunque la app esté cerrada.","Activar");
    }
  } catch (e){
    console.error(e);
    setState("off","Activa las notificaciones","Recibe avisos aunque la app esté cerrada.","Activar");
  }
}
async function onSignedOut(){
  if (!supported()) return;
  try {
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {}
}


let personalClauseChecking = false;
async function refreshPersonalClauseAlert(){
  if(personalClauseChecking) return;
  const uid = currentSession?.user?.id;
  const oldAlert = document.getElementById("personalClauseAlert");
  if(!uid){ oldAlert?.remove(); return; }
  personalClauseChecking=true;
  try{
    const {data:profile,error:profileError}=await client.from("profiles")
      .select("manager_name").eq("id",uid).maybeSingle();
    if(profileError || !profile?.manager_name) return;
    const since=new Date(Date.now()-48*60*60*1000).toISOString();
    const {data:clauses,error:clauseError}=await client.from("clause_executions")
      .select("id,executed_at,executor_name,player_name,clause_value")
      .eq("target_owner_name",profile.manager_name)
      .gte("executed_at",since)
      .order("executed_at",{ascending:false})
      .limit(12);
    if(clauseError || currentSession?.user?.id!==uid) return;
    const key="comunio-clausulas-vistas-"+uid;
    let seen=[];
    try{ seen=JSON.parse(localStorage.getItem(key)||"[]"); }catch{}
    if(!Array.isArray(seen)) seen=[];
    const unseen=(clauses||[]).filter(x=>!seen.includes(x.id));
    oldAlert?.remove();
    if(!unseen.length) return;
    const home=document.getElementById("homeView");
    if(!home) return;
    const first=unseen[0];
    const alert=document.createElement("section");
    alert.id="personalClauseAlert";
    alert.className="personal-clause-alert";
    alert.setAttribute("role","alert");
    const heading=document.createElement("strong");
    heading.textContent="🚨 ¡ATENCIÓN! TE HAN PAGADO UNA CLÁUSULA";
    const description=document.createElement("p");
    const amount=Math.round(Number(first.clause_value)||0).toLocaleString("es-ES")+" €";
    const when=new Date(first.executed_at).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"});
    description.textContent=first.executor_name+" ha fichado a "+first.player_name+" por "+amount+" ("+when+")."+(unseen.length>1?" Tienes "+unseen.length+" avisos de cláusulas pendientes de revisar.":"");
    const actions=document.createElement("div");
    actions.className="personal-clause-actions";
    const acknowledge=document.createElement("button");
    acknowledge.type="button";
    acknowledge.textContent="He visto el aviso";
    acknowledge.addEventListener("click",()=>{
      const ids=unseen.map(x=>x.id);
      const updated=[...new Set([...seen,...ids])].slice(-150);
      try{localStorage.setItem(key,JSON.stringify(updated));}catch{}
      alert.remove();
    });
    actions.appendChild(acknowledge);
    alert.append(heading,description,actions);
    home.prepend(alert);
  }catch(error){
    console.warn("Aviso personal de cláusula:",error);
  }finally{
    personalClauseChecking=false;
  }
}

async function init(){
  ensureUI();
  const { data:{ session } } = await client.auth.getSession();
  currentSession = session;
  if (session) {
    try { await syncExistingSubscription(); } catch(e){ console.error(e); }
  }
  await refreshState();
  await refreshPersonalClauseAlert();
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden) refreshPersonalClauseAlert();
  });
  window.addEventListener("focus",refreshPersonalClauseAlert);

  client.auth.onAuthStateChange(async (event, session) => {
    currentSession = session;
    if (event === "SIGNED_OUT"){
      await onSignedOut();
    } else if (session){
      try { await syncExistingSubscription(); } catch(e){ console.error(e); }
    }
    await refreshState();
    await refreshPersonalClauseAlert();
  });
}

if (document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init, {once:true});
} else {
  init();
}
})();
