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
 const equipo=$("czEquipo").value,pos=$("czPos").value,orden=$("czOrden").value;
 const list=rows.filter(x=>(x.jugador+" "+x.equipo).toLocaleLowerCase("es").includes(q)&&(!equipo||x.equipo===equipo)&&(!pos||x.posicion_filtro===pos));
 const [campo,dir]=orden.split("-");
 list.sort((a,b)=>{const diff=campo==="nombre"?a.jugador.localeCompare(b.jugador,"es"):(Number(a[campo==="valor"?"valor_eur":"puntos"])||0)-(Number(b[campo==="valor"?"valor_eur":"puntos"])||0);return dir==="desc"?-diff:diff;});
 $("czEstado").textContent=rows.length+" jugadores · "+list.length+" visibles · Fuente puntos y valor: Comuniazo · equipo y posición: referencia previa de Comunio Stats";
 $("czListado").innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>Jugador</th><th>Equipo</th><th>Pos.</th><th>Valor Comuniazo</th><th>Puntos Comuniazo</th></tr></thead><tbody>'+list.map(x=>'<tr><td><button type="button" class="czAbrir" data-name="'+esc(x.jugador)+'" style="background:none;border:0;text-decoration:underline;color:inherit;cursor:pointer;font:inherit;padding:0">'+esc(x.jugador)+'</button></td><td>'+esc(x.equipo||"—")+'</td><td>'+esc(({t:"POR",a:"DEF",m:"MED",s:"DEL"})[x.posicion_filtro]||"—")+'</td><td style="text-align:right;white-space:nowrap">'+fmt(x.valor_eur)+' €</td><td style="text-align:right">'+fmt(x.puntos)+'</td></tr>').join("")+'</tbody></table>';
}
for(const id of ["czBuscar","czEquipo","czPos","czOrden"])$(id).addEventListener(id==="czBuscar"?"input":"change",render);
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