(() => {
"use strict";
const $=id=>document.getElementById(id);
const button=$("czActualizarTodo"),status=$("czActualizacionMsg"),panel=$("czDesplegable");
if(!button||!status||!panel)return;
const cfg=window.COMUNIO_CONFIG;
const supa=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const key="comunio-pending-download-2627";
let pending=sessionStorage.getItem(key)||"",tracking=false,checked=false;
function show(message,error=false){status.textContent=message;status.style.color=error?"#f87171":"";}
async function api(action,extra={}){
 const {data:{session}}=await supa.auth.getSession();
 if(!session)throw Error("Debes iniciar sesión como administrador.");
 const response=await fetch(cfg.SUPABASE_URL+"/functions/v1/actualizar-comuniazo",{
  method:"POST",cache:"no-store",
  headers:{"Content-Type":"application/json",apikey:cfg.SUPABASE_ANON_KEY,Authorization:"Bearer "+session.access_token},
  body:JSON.stringify({action,...extra})
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.error||"Error en la conexión.");
 return data;
}
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function follow(id){
 if(tracking)return;
 tracking=true;button.disabled=true;
 let failures=0;
 try{
  for(let attempt=0;attempt<170;attempt++){
   try{
    const data=await api("status",{request_id:id});
    failures=0;
    if(data.status==="completed"){
     sessionStorage.removeItem(key);pending="";
     if(data.conclusion!=="success"){show("La descarga ha fallado. Puedes intentarlo de nuevo.",true);return;}
     show("✓ Descarga completada. "+(data.players_downloaded||"")+" jugadores; "+(data.updated_values||0)+" precios modificados. Los puntos oficiales se han conservado.");
     document.dispatchEvent(new CustomEvent("comuniazo-updated"));
     return;
    }
    show(data.message||"Descarga en curso...");
   }catch(e){if(++failures>=4)throw e;show("Comprobando el estado...");}
   await sleep(7000);
  }
  show("La descarga sigue pendiente de comprobación. Reabre Administración para consultar.",true);
 }catch(e){show("No se ha podido comprobar: "+e.message+". Reabre la sección para reintentar.",true);}
 finally{tracking=false;button.disabled=false;}
}
button.addEventListener("click",async()=>{
 if(tracking)return;
 button.disabled=true;show("Iniciando descarga...");
 try{
  const result=await api("start");
  pending=result.request_id;sessionStorage.setItem(key,pending);
  show(result.message||"Descarga iniciada.");
  await follow(pending);
 }catch(e){show("No se ha iniciado: "+e.message,true);}
 finally{button.disabled=false;}
});
panel.addEventListener("toggle",async()=>{
 if(!panel.open)return;
 if(pending){follow(pending);return;}
 if(checked)return;
 checked=true;show("Comprobando conexión...");
 try{const result=await api("check");show(result.message||"Conexión preparada.");}
 catch(e){checked=false;show("Conexión no verificada: "+e.message,true);}
});
if(panel.open){if(pending)follow(pending);else panel.dispatchEvent(new Event("toggle"));}
})();