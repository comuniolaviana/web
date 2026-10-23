(() => {
 "use strict";
 const host=document.getElementById("chroniclesList");
 if(!host)return;
 const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeLink=x=>/^[a-z0-9_-]+\.html$/i.test(String(x))?x:"#";
 async function render(){
   try{
     const r=await fetch("cronicas.json?v=1",{cache:"no-store"});
     if(!r.ok)throw Error("No se puede acceder al catálogo");
     const db=await r.json();
     host.innerHTML=(db.articles||[]).map(a=>
       '<a class="chronicle-card" href="'+safeLink(a.url)+'">'+
       '<small>'+safe(a.eyebrow)+'</small>'+
       '<strong>'+safe(a.title)+'</strong>'+
       '<span>'+safe(a.excerpt)+'</span>'+
       '<em>Leer crónica completa →</em></a>'
     ).join("")||'<p>Todavía no hay crónicas publicadas.</p>';
   }catch(e){if(!host.querySelector(".chronicle-card"))host.innerHTML='<a class="chronicle-card" href="cronica-jornada-9.html"><small>CRÓNICA · JORNADA 9</small><strong>Eduardo resucita, Ubaldo se escapa y Laureano entra en crisis</strong><em>Leer crónica completa →</em></a>';}
 }
 render();
})();