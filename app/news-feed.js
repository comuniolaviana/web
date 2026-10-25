(()=>{
"use strict";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const link=s=>/^[a-z0-9_-]+\.html$/i.test(String(s))?s:"#";
const dayOf=value=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
let catalogs={},catalogRequest=null,catalogAt=0;
async function editorials(){
 if(catalogAt&&Date.now()-catalogAt<30000)return articles();
 if(catalogRequest)return catalogRequest;
 catalogRequest=(async()=>{
  const results=await Promise.allSettled(["cronicas.json","zorro-publicaciones.json"].map(async path=>{
   const r=await fetch(path+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error(path);
   const data=await r.json();if(!Array.isArray(data.articles))throw Error(path);
   catalogs[path]=data.articles.map(x=>({...x,kind:path==="cronicas.json"?"cronica":"zorro"}));
  }));
  if(results.every(x=>x.status==="rejected")&&!Object.keys(catalogs).length)throw Error("Catálogo de noticias no disponible");
  if(results.every(x=>x.status==="fulfilled"))catalogAt=Date.now();
  return articles();
 })();
 try{return await catalogRequest;}finally{catalogRequest=null;}
}
function articles(){return Object.values(catalogs).flat().filter(x=>x.title&&link(x.url)!=="#"&&(!x.published_at||Date.parse(x.published_at)<=Date.now())).sort((a,b)=>Date.parse(b.published_at||"1970-01-01")-Date.parse(a.published_at||"1970-01-01"));}
async function load({client,day=null,limit=100,demoEvents=[]}={}){
 const editorialPromise=editorials();
 const specs=[["clause_executions","clause_day","executed_at","clause"],["team_malo_purchases","purchase_day","executed_at","badteam"],["team_malo_sales","sale_day","executed_at","badsale"],["fairplay_cards",null,"sanctioned_at","fairplay"]];
 const nativePromise=client?Promise.all(specs.map(async([table,dateColumn,time,type])=>{
  let q=client.from(table).select("*").order(time,{ascending:false});
  if(day&&dateColumn)q=q.eq(dateColumn,day);
  if(day&&!dateColumn)q=q.gte(time,new Date(Date.parse(day+"T00:00:00Z")-14*3600000).toISOString()).lt(time,new Date(Date.parse(day+"T00:00:00Z")+38*3600000).toISOString());
  // Filter the broad Fair Play date window before truncating the requested day.
  if(!day)q=q.limit(limit);
  const r=await q;if(r.error)throw r.error;
  return (r.data||[]).filter(x=>!day||dateColumn||dayOf(x[time])===day).map(x=>({...x,_type:type,_time:x[time]}));
 })): [demoEvents];
 const [native,editorial]=await Promise.all([nativePromise,editorialPromise]);
 return [...native.flat(),...editorial.filter(x=>!day||(x.published_at&&dayOf(x.published_at)===day)).map(x=>({...x,_type:"editorial",_time:x.published_at||"1970-01-01T00:00:00Z"}))].sort((a,b)=>Date.parse(b._time)-Date.parse(a._time)).slice(0,limit);
}
function articleHtml(x){
 const time=x.published_at?new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(x.published_at)):"Archivo";
 return '<article class="history-item"><div class="history-time">'+safe(time)+'</div><div><span class="news-type">'+(x.kind==="cronica"?"🎙️ CRÓNICA DE JORNADA":"🦊 VIEJO ZORRO")+'</span><div class="history-main">'+safe(x.title)+'</div><div class="history-sub">'+safe(x.excerpt||"")+'</div><a href="'+link(x.url)+'" class="fairplay-news-link">Leer publicación completa →</a></div></article>';
}
window.ComunioNews={load,editorials,link,articleHtml};
})();
