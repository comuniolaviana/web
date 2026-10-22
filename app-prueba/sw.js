
const CACHE="comunio-laviana-v3";
const SHELL=["./","index.html","app.css","app.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{
    if(new URL(e.request.url).pathname.includes("/app-prueba/")){
      const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));
    }
    return r;
  }).catch(()=>caches.match(e.request)));
});
