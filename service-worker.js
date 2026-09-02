const CACHE='julius-zero-room-v0-3-0';
const SHELL=['./','./index.html','./styles.css?v=0.3.0','./app.js?v=0.3.0','./manifest.json','./firebase-config.js','./cloud-sync.js?v=0.3.0','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/julius/normal.png','./assets/julius/think.png','./assets/julius/stern.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith('julius-zero-room-')).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):Response.error())));
});
