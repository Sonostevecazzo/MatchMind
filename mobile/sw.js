const CACHE='matchmind-pwa-v14-20261031';
const APP_SHELL=[
 './','./index.html','./matches.html','./explore.html','./league.html',
 './team.html','./match.html','./players.html','./analysis-lab.html','./data.html','./settings.html',
 './site.css','./site-core.js','./elo.js','./site-pages.js','./manifest.webmanifest','./icon.svg'
];

self.addEventListener('install',event=>{
 event.waitUntil(
  caches.open(CACHE)
   .then(cache=>cache.addAll(APP_SHELL))
   .then(()=>self.skipWaiting())
 );
});

self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname.includes('/api/'))return;

 // Prefer the deployed HTML, CSS and JS. Use the cache only when offline.
 if(request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/')||/\.(?:css|js|webmanifest|svg)$/.test(url.pathname)){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok){
     const copy=response.clone();
     const cache=await caches.open(CACHE);
     await cache.put(request,copy);
    }
    return response;
   }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate')return caches.match('./index.html');
    throw error;
   }
  })());
 }
});
