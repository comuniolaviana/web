const CACHE="comunio-laviana-app-v6-0";
const STATIC=["./","./index.html","./styles.css","./config.js","./app.js","./manifest.json","../calendario-engine.js","../calendario-clausulas.json"];

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

  // En V6 intentamos red siempre primero para evitar que el móvil se quede
  // visualmente atrapado en una versión anterior. Si no hay red, usamos caché.
  e.respondWith(
    fetch(e.request,{cache:"no-store"})
      .then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});
