(() => {
"use strict";
const root=document.getElementById("datosComunioPanel");if(!root)return;
const $=id=>document.getElementById(id);
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number=n=>new Intl.NumberFormat("es-ES").format(Number(n)||0);
let rows=[];
function render(){
 const q=$("dcBuscar").value.toLocaleLowerCase("es"),p=$("dcPos").value,t=$("dcEquipo").value,o=$("dcOrden").value;
 let shown=rows.filter(x=>(!p||x.posicion_filtro===p)&&(!t||x.equipo===t)&&(!q||(x.jugador+" "+x.equipo).toLocaleLowerCase("es").includes(q)));
 shown.sort((a,b)=>o==="nombre"?a.jugador.localeCompare(b.jugador,"es"):Number(b[o==="valor"?"valor_eur":"puntos"])-Number(a[o==="valor"?"valor_eur":"puntos"]));
 $("datosComunioEstado").textContent=rows.length+" jugadores · "+shown.length+" visibles · "+(rows[0]?.fecha||"")+" · fuente: estadísticas de Comunio (datos experimentales)";
 $("dcListado").innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>Jugador</th><th>Equipo</th><th>Pos.</th><th>Valor</th><th>Puntos</th></tr></thead><tbody>'+shown.slice(0,550).map(x=>'<tr><td>'+escape(x.jugador)+'</td><td>'+escape(x.equipo)+'</td><td>'+escape(({t:"POR",a:"DEF",m:"MED",s:"DEL"})[x.posicion_filtro])+'</td><td style="text-align:right;white-space:nowrap">'+number(x.valor_eur)+' €</td><td style="text-align:right">'+number(x.puntos)+'</td></tr>').join("")+'</tbody></table>';
}
for(const id of ["dcBuscar","dcPos","dcEquipo","dcOrden"])$(id).addEventListener("input",render);
async function load(){
 try{
  const response=await fetch("../datos-comunio-prueba/ultimo.json?v="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw Error("El archivo aún no está publicado en esta versión de la web");
  const payload=await response.json();rows=payload.jugadores||[];
  if(rows.length<500)throw Error("Datos incompletos");
  const teams=[...new Set(rows.map(x=>x.equipo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  $("dcEquipo").innerHTML='<option value="">Todos los equipos</option>'+teams.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join("");
  render();
 }catch(e){$("datosComunioEstado").textContent="Datos no disponibles: "+e.message;}
}
const observer=new MutationObserver(()=>{if(!document.getElementById("adminMain").classList.contains("hidden")){observer.disconnect();load();}});
observer.observe(document.getElementById("adminMain"),{attributes:true,attributeFilter:["class"]});
})();