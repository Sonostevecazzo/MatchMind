const CACHE='matchmind-pwa-v63-20261104-fallback-live-nav';
const APP_SHELL=[
 './','./index.html','./matches.html','./live.html','./explore.html','./league.html',
 './team.html','./match.html','./players.html','./analysis-lab.html','./bets.html','./data.html','./settings.html',
 './site.css','./mobile-readable.css','./live.css','./analysis.css','./site-core.js','./site-pages.js','./live.js','./bets-engine.js','./tipsaudit.js','./bets.js','./elo.js','./rounds.js','./manifest.webmanifest','./icon.svg'
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
 if(url.origin!==location.origin||url.pathname.includes('/api/'))return;
 if(request.method==='POST'&&url.pathname.endsWith('/share-target')){event.respondWith((async()=>{try{const form=await request.formData();const file=form.get('screenshot');const textValue=[form.get('title'),form.get('text'),form.get('url')].filter(Boolean).join('\n');const db=await new Promise((resolve,reject)=>{const open=indexedDB.open('matchmind-shared-imports',1);open.onupgradeneeded=()=>open.result.createObjectStore('items',{keyPath:'id',autoIncrement:true});open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('items','readwrite');tx.objectStore('items').add({file:file&&file.size?file:null,text:textValue,createdAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return Response.redirect(new URL('./bets.html?import=shared',self.registration.scope),303);}catch(error){return Response.redirect(new URL('./bets.html?import=failed',self.registration.scope),303);}})());return;}
 if(request.method!=='GET')return;

 // Prefer the deployed HTML, CSS and JS. Use the cache only when offline.
 if(request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/')||/\.(?:css|js|json|webmanifest|svg)$/.test(url.pathname)){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request,{cache:'no-store',signal:AbortSignal.timeout(6000)});
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
