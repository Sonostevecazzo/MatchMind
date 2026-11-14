const CACHE="quotalab-shell-v1";
const ASSETS=["./","./index.html","./styles.css","./app.js","./engine.js","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("quotalab-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin)return;
 event.respondWith(fetch(request).then(response=>{
   if(response.ok&&url.pathname.includes("/quotalab/")){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
   return response;
 }).catch(async()=>{const cached=await caches.match(request);if(cached)return cached;if(request.mode==="navigate")return caches.match("./index.html");throw new Error("Risorsa offline non disponibile");}));
});