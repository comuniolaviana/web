(()=>{"use strict";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const link=s=>/^[a-z0-9_-]+\.html$/i.test(String(s))?s:"#";
const linkImage=s=>/^[a-z0-9_-]+[.]svg$/i.test(String(s))?s:"";
async function catalog(){const [c,z]=await Promise.allSettled(["cronicas.json","zorro-publicaciones.json"].map(async p=>{const r=await fetch(p+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error(p);return r.json()}));const chron=c.status==="fulfilled"?(c.value.articles||[]):[];const fox=z.status==="fulfilled"?(z.value.articles||[]):[];return [...chron.map(x=>({...x,kind:"cronica"})),...fox.map(x=>({...x,kind:"zorro"}))].filter(x=>x.title&&x.url&&(!x.published_at||Date.parse(x.published_at)<=Date.now())).sort((a,b)=>Date.parse(b.published_at||"1970-01-01")-Date.parse(a.published_at||"1970-01-01"));}
function card(x){return '<a href="'+link(x.url)+'" style="display:block;text-decoration:none;color:#fff;background:#193d2b;border:1px solid #3e7450;border-radius:13px;padding:14px"><small style="color:#b9e9c5">'+safe(x.kind==="zorro"?"🦊 VIEJO ZORRO":"🎙️ CRÓNICA")+'</small>'+(x.image?'<img src="'+linkImage(x.image)+'" alt="Ilustración de la publicación" style="width:100%;max-height:250px;object-fit:cover;border-radius:9px;margin:9px 0">':'')+'<strong style="display:block;margin:6px 0;font-size:17px">'+safe(x.title)+'</strong><span style="color:#d2e4d7;font-size:13px">'+safe(x.excerpt||"")+'</span><span style="display:block;margin-top:8px;color:#a5e9b8">Leer publicación →</span></a>';}
async function render(){const arr=await catalog();const news=document.getElementById("newsView");if(news&&!document.getElementById("zorroFeatured")){const old=news.querySelector(".chronicles-section");if(old){const box=document.createElement("section");box.id="zorroFeatured";box.className="chronicles-section";box.innerHTML='<div class="chronicles-heading"><div><span>🎙️ REDACCIÓN COMUNIO LAVIANA</span><h2>Última publicación</h2></div></div><div id="zorroFeaturedContent" class="chronicles-list"></div>';old.before(box);old.hidden=true;old.style.display="none";}}const featured=document.getElementById("zorroFeaturedContent");if(featured)featured.innerHTML=arr.length?card(arr[0]):'<p style="color:#aebdb6">Próximamente.</p>';const stories=document.getElementById("zorroStories");if(stories)stories.innerHTML=arr.filter(x=>x.kind==="zorro").map(card).join("")||'<p class="muted">Todavía no hay andanzas publicadas.</p>';const latest=document.getElementById("zorroLatest");if(latest)latest.innerHTML=arr.find(x=>x.kind==="zorro")?card(arr.find(x=>x.kind==="zorro")):'<p class="muted">Todavía no hay andanzas publicadas.</p>';}


const madridDay=date=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const madridHour=date=>new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",hour:"2-digit",minute:"2-digit",hour12:false}).format(date);
const sameDay=x=>x.published_at&&madridDay(new Date(x.published_at))===madridDay(new Date());
function dailyNode(x){
 const node=document.createElement("article");node.className="history-item";node.dataset.zorroArticle=x.id||x.url;
 const time=madridHour(new Date(x.published_at));
 node.innerHTML='<div class="history-time">'+safe(time)+'</div><div><span class="news-type" style="background:#3c5b33;color:#fff4cb">'+(x.kind==="cronica"?"🎙️ CRÓNICA DE JORNADA":"🦊 VIEJO ZORRO")+'</span><div class="history-main">'+safe(x.title)+'</div><div class="history-sub">'+safe(x.excerpt||"")+'</div>'+(x.image&&linkImage(x.image)?'<a href="'+link(x.url)+'" style="display:block;margin:10px 0"><img src="'+linkImage(x.image)+'" alt="Ilustración" style="width:100%;max-height:300px;object-fit:contain;border-radius:10px"></a>':'')+'<a href="'+link(x.url)+'" style="display:block;margin-top:8px;color:#d5a33e">Leer la crónica →</a></div>';
 return node;
}
let dailyArticles=[];
function insertDailyFox(){
 const list=document.getElementById("historyList");if(!list)return;
 const active=document.querySelector(".history-toolbar .period-btn.active");
 if(active?.dataset.period&&active.dataset.period!=="today"){list.querySelectorAll("[data-zorro-article]").forEach(n=>n.remove());return}
 const dateInput=document.getElementById("historyDate");
 if(!active&&dateInput?.value&&dateInput.value!==madridDay(new Date()))return;
 const toSeconds=value=>{const m=String(value||"").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]||0):-1};
 for(const x of dailyArticles.filter(sameDay)){
  if([...list.querySelectorAll("[data-zorro-article]")].some(n=>n.dataset.zorroArticle===(x.id||x.url)))continue;
  const node=dailyNode(x),t=toSeconds(madridHour(new Date(x.published_at)));
  const next=[...list.children].find(el=>el.classList.contains("history-item")&&toSeconds(el.querySelector(".history-time")?.textContent)<t);
  if(next)list.insertBefore(node,next);else list.appendChild(node);
 }
}
function insertHomeFox(){
 const box=document.getElementById("homeNewsList");if(!box)return;
 const fox=dailyArticles.find(sameDay);if(!fox)return;
 const row=box.querySelector("[data-zorro-home]");
 if(row){if(row.dataset.zorroHome===(fox.id||fox.url))return;row.remove()}
 const now=new Date(fox.published_at),ago=Math.max(0,Math.floor((Date.now()-now.getTime())/60000));
 const label=ago<60?(ago<1?"Ahora":"Hace "+ago+" min"):(ago<1440?"Hace "+Math.floor(ago/60)+" h":madridDay(now));
 const btn=document.createElement("button");btn.type="button";btn.className="v65-news-row";btn.dataset.zorroHome=fox.id||fox.url;
 btn.innerHTML='<span class="v65-news-icon">'+(fox.kind==="cronica"?"🎙️":"🦊")+'</span><span><b>'+safe(fox.title)+'</b><small>'+safe(label)+'</small></span><i>›</i>';
 btn.addEventListener("click",()=>location.href=link(fox.url));
 const rows=[...box.querySelectorAll(".v65-news-row")];
 const stamp=new Date(fox.published_at).getTime();
 // Home entries are sorted newest-first; use native timestamps when supplied.
 const native=rows.map(el=>Date.parse(el.dataset.newsTime||""));
 const position=native.findIndex(t=>Number.isFinite(t)&&t<stamp);
 if(position>=3||(position<0&&rows.length>=3))return;
 if(position>=0&&rows[position])box.insertBefore(btn,rows[position]);else if(!rows.length)box.prepend(btn);else box.appendChild(btn);
 const all=[...box.querySelectorAll(".v65-news-row")];all.slice(3).forEach(el=>el.remove());
 box.querySelector(".v65-empty")?.remove();
}
async function refreshFox(){const arr=await catalog();dailyArticles=arr;await render();insertDailyFox();insertHomeFox();}
function watchDailyFox(){
 const list=document.getElementById("historyList");
 if(list)new MutationObserver(()=>{if(dailyArticles.some(x=>sameDay(x)&&![...list.querySelectorAll("[data-zorro-article]")].some(n=>n.dataset.zorroArticle===(x.id||x.url))))insertDailyFox()}).observe(list,{childList:true});
 const home=document.getElementById("homeNewsList");
 if(home)new MutationObserver(()=>{if(dailyArticles.some(sameDay)&&!home.querySelector("[data-zorro-home]"))insertHomeFox()}).observe(home,{childList:true});
 insertDailyFox();insertHomeFox();
}
// El acceso a Viejo Zorro ya está incluido en la cabecera principal.
// Evitamos añadir un segundo icono junto a Fair Play y Avisos.
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{refreshFox().catch(console.error);watchDailyFox()});else {refreshFox().catch(console.error);watchDailyFox()}document.addEventListener("visibilitychange",()=>{if(!document.hidden){refreshFox().catch(console.error)}});
setInterval(()=>{if(!document.hidden)refreshFox().catch(console.error)},60000);
})();