(() => {
"use strict";
const root=document.getElementById("datosComuniazoPanel");if(!root)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fmt=n=>new Intl.NumberFormat("es-ES").format(Number(n)||0);
let rows=[];
function render(){
 const q=$("czBuscar").value.toLocaleLowerCase("es");
 const list=rows.filter(x=>(x.jugador+" "+x.equipo).toLocaleLowerCase("es").includes(q));
 $("czEstado").textContent=rows.length+" jugadores · "+list.length+" visibles · Fuente puntos y valor: Comuniazo · equipo y posición: referencia previa de Comunio Stats";
 $("czListado").innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>Jugador</th><th>Equipo</th><th>Pos.</th><th>Valor Comuniazo</th><th>Puntos Comuniazo</th></tr></thead><tbody>'+list.map(x=>'<tr><td><a href="https://www.comuniazo.com/comunio-apuestas/jugadores/'+encodeURIComponent(slug(x.jugador))+'" target="_blank" rel="noopener noreferrer">'+esc(x.jugador)+'</a></td><td>'+esc(x.equipo||"—")+'</td><td>'+esc(({t:"POR",a:"DEF",m:"MED",s:"DEL"})[x.posicion_filtro]||"—")+'</td><td style="text-align:right;white-space:nowrap">'+fmt(x.valor_eur)+' €</td><td style="text-align:right">'+fmt(x.puntos)+'</td></tr>').join("")+'</tbody></table>';
}
$("czBuscar").addEventListener("input",render);
async function load(){try{
 const response=await fetch("../datos-comuniazo-prueba/ultimo.json?v="+Date.now(),{cache:"no-store"});
 if(!response.ok)throw Error("Archivo no disponible");
 const data=await response.json();rows=data.jugadores||[];
 if(rows.length<550)throw Error("Descarga incompleta");
 render();
}catch(e){$("czEstado").textContent="Datos no disponibles: "+e.message;}}
const main=document.getElementById("adminMain");
if(!main.classList.contains("hidden"))load();
else{const observer=new MutationObserver(()=>{if(!main.classList.contains("hidden")){observer.disconnect();load();}});observer.observe(main,{attributes:true,attributeFilter:["class"]});}
})();