const CACHE="comunio-laviana-app-v6-31-administracion-oficial";
const STATIC=[
  "./","./index.html","./styles.css","./notifications.css","./notifications.js",
  "./home-v63.css","./home-v63.js","./news-feed.js",
  "./config.js","./app.js","./fairplay.html","./mercado.html","./mercado.js","./manifest.json","./notification-badge.svg",
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
  // Las PWAs instaladas antiguas pueden seguir abriendo index.html?v=5-5:
  // para navegar a Inicio, solicitar siempre la última entrada versionada.
  if(e.request.mode==="navigate" && (u.pathname.endsWith("/app/") || u.pathname.endsWith("/app/index.html"))){
    const currentIndex=new URL("./index.html?v=6-31",self.registration.scope);
    e.respondWith(
      fetch(currentIndex.href,{cache:"no-store"}).then(async r=>{
        if(!r.ok)throw Error("No se pudo recuperar la portada vigente");
        const copy=r.clone();
        const cache=await caches.open(CACHE);
        await cache.put(e.request,copy);
        return r;
      }).catch(async()=>await caches.match(e.request)||await caches.match("./index.html"))
    );
    return;
  }
  // Administración debe abrir siempre la versión del comparador oficial:
  // evita que el antiguo JavaScript marque como correcta una cláusula no ejecutada.
  if(e.request.mode==="navigate" && u.pathname.endsWith("/app/admin.html")){
    const currentAdmin=new URL("./admin.html?v=6-31",self.registration.scope);
    e.respondWith(
      fetch(currentAdmin.href,{cache:"no-store"}).then(async r=>{
        if(!r.ok)throw Error("Administración no disponible");
        const cache=await caches.open(CACHE);
        await cache.put(e.request,r.clone());
        return r;
      }).catch(async()=>await caches.match(e.request))
    );
    return;
  }
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

