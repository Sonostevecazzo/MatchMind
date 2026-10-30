const CACHE='matchmind-pwa-v3';
const APP_SHELL=[
 './','./index.html','./matches.html','./explore.html','./league.html',
 './team.html','./match.html','./players.html','./analysis-lab.html','./data.html',
 './site.css','./site-core.js','./site-pages.js','./manifest.webmanifest','./icon.svg'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname.includes('/api/'))return;
 if(request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/') ){
  event.respondWith(fetch(request).then(response=>{
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response;
  }).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))));
  return;
 }
 if(/\.(?:css|js|webmanifest|svg)$/.test(url.pathname)){
  event.respondWith(caches.match(request).then(hit=>{
   const fresh=fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(()=>hit);
   return hit||fresh;
  }));
 }
});