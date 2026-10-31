(() => {
"use strict";
const root=document.getElementById("datosComuniazoPanel");if(!root)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fmt=n=>new Intl.NumberFormat("es-ES").format(Number(n)||0);
let rows=[];let fichas=null;let loaded=false;
function render(){
 const q=$("czBuscar").value.toLocaleLowerCase("es");
 const equipo=$("czEquipo").value,pos=$("czPos").value,orden=$("czOrden").value,estado=$("czEstadoEquipo").value;
 const list=rows.filter(x=>(x.jugador+" "+x.equipo).toLocaleLowerCase("es").includes(q)&&(!equipo||x.equipo===equipo)&&(!pos||x.posicion_filtro===pos)&&(estado==="todos"||(estado==="con"?Boolean(x.equipo&&x.equipo.trim()):!x.equipo||!x.equipo.trim())));
 const [campo,dir]=orden.split("-");
 list.sort((a,b)=>{const diff=campo==="nombre"?a.jugador.localeCompare(b.jugador,"es"):(Number(a[campo==="valor"?"valor_eur":"puntos"])||0)-(Number(b[campo==="valor"?"valor_eur":"puntos"])||0);return dir==="desc"?-diff:diff;});
 $("czEstado").textContent=rows.length+" descargados · "+rows.filter(x=>x.equipo&&x.equipo.trim()).length+" con equipo · "+rows.filter(x=>!x.equipo||!x.equipo.trim()).length+" sin equipo (pendientes de revisar) · "+list.length+" visibles · Fuente puntos y valor: Comuniazo · equipo y posición: referencia previa de Comunio Stats";
 $("czListado").innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>Jugador</th><th>Equipo</th><th>Pos.</th><th>Valor Comuniazo</th><th>Puntos Comuniazo</th></tr></thead><tbody>'+list.map(x=>'<tr><td><button type="button" class="czAbrir" data-name="'+esc(x.jugador)+'" style="background:none;border:0;text-decoration:underline;color:inherit;cursor:pointer;font:inherit;padding:0">'+esc(x.jugador)+'</button></td><td>'+esc(x.equipo||"—")+'</td><td>'+esc(({t:"POR",a:"DEF",m:"MED",s:"DEL"})[x.posicion_filtro]||"—")+'</td><td style="text-align:right;white-space:nowrap">'+fmt(x.valor_eur)+' €</td><td style="text-align:right">'+fmt(x.puntos)+'</td></tr>').join("")+'</tbody></table>';
}
for(const id of ["czBuscar","czEstadoEquipo","czEquipo","czPos","czOrden"])$(id).addEventListener(id==="czBuscar"?"input":"change",render);
$("czDesplegable").addEventListener("toggle",()=>{if($("czDesplegable").open&&!loaded){loaded=true;load();}});
$("czListado").addEventListener("click",e=>{
 const btn=e.target.closest(".czAbrir");if(!btn)return;
 const name=btn.dataset.name;
 const player=rows.find(x=>x.jugador===name);
 const f=fichas&&fichas.find(x=>x.jugador===name);
 let panel=$("czFicha");
 if(!panel){panel=document.createElement("div");panel.id="czFicha";panel.style.cssText="padding:16px;border:1px solid #aaa;border-radius:10px;margin:14px 0";$("czListado").before(panel);}
 panel.hidden=false;
 const url=f&&f.url||"https://www.comuniazo.com/comunio-apuestas/jugadores/"+encodeURIComponent(slug(name));
 const totals={};if(f)for(const w of f.jornadas)for(const event of w.eventos)totals[event]=(totals[event]||0)+1;
 const labels={"gol":"Goles","asistencia":"Asistencias","amarilla":"Amarillas","roja":"Rojas","doble-amarilla":"Dobles amarillas","entra":"Entradas","sale":"Sustituciones","star":"Destacado","penalty":"Penaltis"};
 panel.innerHTML='<button type="button" id="czCerrar" style="float:right">Cerrar ×</button><h3>'+esc(name)+' · 2026/27</h3><p><strong>'+fmt(player.puntos)+' puntos</strong> · Valor '+fmt(player.valor_eur)+' €</p>'+
 (f&&f.jornadas.length?'<h4>Jornadas y eventos</h4><div style="overflow-x:auto"><table style="width:100%"><thead><tr><th>Jornada</th><th>Puntos</th><th>Estado / eventos</th></tr></thead><tbody>'+f.jornadas.map(w=>'<tr><td>J'+w.jornada+'</td><td>'+ (w.puntos===null?'—':w.puntos)+'</td><td>'+esc([w.estado,...w.eventos.map(x=>labels[x]||x)].filter(Boolean).join(", ")||"—")+'</td></tr>').join("")+'</tbody></table></div><h4>Eventos registrados en las jornadas</h4><p>'+Object.entries(totals).map(([k,v])=>esc(labels[k]||k)+': '+v).join(' · ')+'</p>': '<p>El desglose individual todavía no está disponible para este jugador.</p>')+
 (f&&Object.keys(f.estadisticas_visibles||{}).length?'<h4>Otras estadísticas publicadas</h4>'+Object.entries(f.estadisticas_visibles).map(([k,v])=>'<p>'+esc(v)+'</p>').join(""):'')+
 '<p><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Ver ficha original en Comuniazo</a></p>';
 panel.querySelector("#czCerrar").onclick=()=>{panel.hidden=true;};
 panel.scrollIntoView({block:"nearest",behavior:"smooth"});
});
async function load(){try{
 const response=await fetch("../datos-comuniazo-prueba/ultimo.json?v="+Date.now(),{cache:"no-store"});
 if(!response.ok)throw Error("Archivo no disponible");
 const data=await response.json();rows=data.jugadores||[];
 if(rows.length<550)throw Error("Descarga incompleta");
 const equipos=[...new Set(rows.map(x=>x.equipo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
 $("czEquipo").innerHTML='<option value="">Todos los equipos</option>'+equipos.map(e=>'<option value="'+esc(e)+'">'+esc(e)+'</option>').join("");
 render();
 try{const f=await fetch("../datos-comuniazo-prueba/fichas-2627.json?v="+Date.now(),{cache:"no-store"});if(f.ok){const d=await f.json();if(d.temporada==="2026/27")fichas=d.fichas||[];}}catch(_){}
}catch(e){$("czEstado").textContent="Datos no disponibles: "+e.message;}}
const main=document.getElementById("adminMain");
if(!main.classList.contains("hidden")&&$("czDesplegable").open){loaded=true;load();}
else{const observer=new MutationObserver(()=>{if(!main.classList.contains("hidden")){observer.disconnect();if($("czDesplegable").open&&!loaded){loaded=true;load();}}});observer.observe(main,{attributes:true,attributeFilter:["class"]});}
})();
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