(()=>{"use strict";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const link=s=>/^[a-z0-9_-]+\.html$/i.test(String(s))?s:"#";
const linkImage=s=>/^[a-z0-9_-]+[.]svg$/i.test(String(s))?s:"";
async function catalog(){const [c,z]=await Promise.allSettled(["cronicas.json","zorro-publicaciones.json"].map(async p=>{const r=await fetch(p+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error(p);return r.json()}));const chron=c.status==="fulfilled"?(c.value.articles||[]):[];const fox=z.status==="fulfilled"?(z.value.articles||[]):[];return [...chron.map(x=>({...x,kind:"cronica"})),...fox.map(x=>({...x,kind:"zorro"}))].filter(x=>x.title&&x.url&&(!x.published_at||Date.parse(x.published_at)<=Date.now())).sort((a,b)=>Date.parse(b.published_at||"1970-01-01")-Date.parse(a.published_at||"1970-01-01"));}
function card(x){return '<a href="'+link(x.url)+'" style="display:block;text-decoration:none;color:#fff;background:#193d2b;border:1px solid #3e7450;border-radius:13px;padding:14px"><small style="color:#b9e9c5">'+safe(x.kind==="zorro"?"🦊 VIEJO ZORRO":"🎙️ CRÓNICA")+'</small>'+(x.image?'<img src="'+linkImage(x.image)+'" alt="Ilustración de la publicación" style="width:100%;max-height:250px;object-fit:cover;border-radius:9px;margin:9px 0">':'')+'<strong style="display:block;margin:6px 0;font-size:17px">'+safe(x.title)+'</strong><span style="color:#d2e4d7;font-size:13px">'+safe(x.excerpt||"")+'</span><span style="display:block;margin-top:8px;color:#a5e9b8">Leer publicación →</span></a>';}
async function render(){const arr=await catalog();const news=document.getElementById("newsView");if(news&&!document.getElementById("zorroFeatured")){const old=news.querySelector(".chronicles-section");if(old){const box=document.createElement("section");box.id="zorroFeatured";box.className="chronicles-section";box.innerHTML='<div class="chronicles-heading"><div><span>🎙️ REDACCIÓN COMUNIO LAVIANA</span><h2>Última publicación</h2></div></div><div id="zorroFeaturedContent" class="chronicles-list"></div>';old.before(box);old.hidden=true;old.style.display="none";}}const featured=document.getElementById("zorroFeaturedContent");if(featured)featured.innerHTML=arr.length?card(arr[0]):'<p style="color:#aebdb6">Próximamente.</p>';const stories=document.getElementById("zorroStories");if(stories)stories.innerHTML=arr.filter(x=>x.kind==="zorro").map(card).join("")||'<p class="muted">Todavía no hay andanzas publicadas.</p>';const latest=document.getElementById("zorroLatest");if(latest)latest.innerHTML=arr.find(x=>x.kind==="zorro")?card(arr.find(x=>x.kind==="zorro")):'<p class="muted">Todavía no hay andanzas publicadas.</p>';}

function insertDailyFox(){
 const list=document.getElementById("historyList");
 if(!list||document.getElementById("zorroDailyNews"))return;
 const active=document.querySelector(".history-toolbar .period-btn.active");
 if(active?.dataset.period&&active.dataset.period!=="today")return;
 const dateInput=document.getElementById("historyDate");
 if(!active&&dateInput?.value){const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());if(dateInput.value!==today)return}
 const now=Date.now(),release=Date.parse("2026-10-24T14:55:00+02:00");
 if(now<release||now>release+24*60*60*1000)return;
 const node=document.createElement("article");node.id="zorroDailyNews";node.className="history-item";
 node.innerHTML='<div class="history-time">14:55</div><div><span class="news-type" style="background:#3c5b33;color:#fff4cb">🦊 INAUGURACIÓN</span><div class="history-main">Operación Gallinero: ¡comienza la cacería!</div><div class="history-sub">Bienvenidos a la nueva aplicación de Comunio Laviana · Apertura 15:00</div><a href="zorro-inauguracion-2026.html" style="display:block;margin:10px 0"><img src="zorro-inauguracion-cover.svg" alt="Cartel de inauguración de Comunio Laviana" style="width:100%;max-height:300px;object-fit:contain;border-radius:10px"></a><a href="zorro-inauguracion-2026.html" style="display:block;margin-top:8px;color:#d5a33e">Ver la ilustración y leer la noticia →</a></div>';
 const foxTime=14*3600+55*60;
 const toSeconds=(value)=>{
   const match=String(value||"").trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
   return match?Number(match[1])*3600+Number(match[2])*60+Number(match[3]||0):-1;
 };
 const entries=[...list.children].filter(el=>el.classList.contains("history-item"));
 const next=entries.find(el=>toSeconds(el.querySelector(".history-time")?.textContent)<foxTime);
 if(next)list.insertBefore(node,next);
 else list.appendChild(node);
 const count=document.getElementById("historyCount");if(count){const n=parseInt(count.textContent,10);if(Number.isFinite(n))count.textContent=(n+1)+" noticias"}
}
function watchDailyFox(){
 const list=document.getElementById("historyList");if(!list)return;
 new MutationObserver(()=>{if(!document.getElementById("zorroDailyNews"))insertDailyFox()}).observe(list,{childList:true});
 insertDailyFox();
 const release=Date.parse("2026-10-24T14:55:00+02:00");if(Date.now()<release)setTimeout(()=>{render().catch(console.error);insertDailyFox()},release-Date.now()+1000);
}

// El acceso a Viejo Zorro ya está incluido en la cabecera principal.
// Evitamos añadir un segundo icono junto a Fair Play y Avisos.
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{render().catch(console.error);watchDailyFox()});else {render().catch(console.error);watchDailyFox()}document.addEventListener("visibilitychange",()=>{if(!document.hidden){render().catch(console.error);insertDailyFox()}});
})();