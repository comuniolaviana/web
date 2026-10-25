const CACHE="comunio-laviana-app-v6-24";
const STATIC=[
  "./","./index.html","./styles.css","./notifications.css","./notifications.js",
  "./home-v63.css","./home-v63.js","./news-feed.js",
  "./config.js","./app.js","./fairplay.html","./manifest.json","./notification-badge.svg",
  "../calendario-engine.js","../calendario-clausulas.json"
];

self.addEventListener("install",e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting())
));

self.addEventListener("activate",e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.pathname.endsWith(".json") || u.hostname.includes("supabase")) return;
  e.respondWith(
    fetch(e.request,{cache:"no-store"})
      .then(r=>{
        if(r.ok){const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));}
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});

self.addEventListener("push",event=>{
  let data={};
  try{ data=event.data?event.data.json():{}; }
  catch{ data={title:"Comunio Laviana",body:event.data?.text()||"Nueva actividad en la liga."}; }

  const title=data.title||"Comunio Laviana";
  const special=data.special||data.type||"";
  const receivedClause=special==="clause_received";
  const options={
    body:data.body||"Nueva actividad en la liga.",
    icon:"./icon-192.svg",
    badge:"./notification-badge.svg",
    tag:data.tag||"comunio-laviana",
    renotify:true,
    silent:false,
    requireInteraction:receivedClause,
    timestamp:Date.now(),
    vibrate:receivedClause?[260,100,260,100,650]:[220,90,220],
    data:{url:data.url||"./index.html",type:data.type||"",special}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=event.notification?.data?.url||"./index.html";
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of list){
      if("focus" in client){
        if("navigate" in client) try{ await client.navigate(target); }catch{}
        return client.focus();
      }
    }
    return clients.openWindow(target);
  })());
});

