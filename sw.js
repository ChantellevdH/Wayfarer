/* Wayfarer service worker — offline app shell + map tile cache */

const SHELL = 'wf-shell-v22';
const TILES = 'wf-tiles-v2';

const CORE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './vendor/maplibre-gl.css',
  './vendor/world.json',
  './vendor/maplibre-gl.js',
  './icon-180.png',
  './icon-192.png',
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(SHELL)
      .then(c=>Promise.allSettled(CORE.map(u=>c.add(u))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(
        ks.filter(k=>k!==SHELL && k!==TILES).map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const url = e.request.url;

  // Never cache the Wikidata query endpoint — it must be live.
  if(url.includes('query.wikidata.org')) return;

  // Map data (vector tiles, TileJSON, fonts): cache-first, so a cached
  // region renders with no signal at all.
  if(url.includes('tiles.openfreemap.org')){
    e.respondWith(
      caches.open(TILES).then(async c=>{
        const hit = await c.match(e.request);
        if(hit && hit.ok) return hit;   // never serve a stored error or empty
        try{
          const res = await fetch(e.request);
          if(res.ok) c.put(e.request, res.clone());
          return res;
        }catch{
          // Never-cached tile while offline: empty 204 renders as a blank
          // tile instead of an error, and MapLibre moves on quietly.
          return new Response(null, {status:204});
        }
      })
    );
    return;
  }

  // Everything else: cache-first, fall back to network.
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res=>{
        if(res.ok && e.request.method==='GET'){
          const copy = res.clone();
          caches.open(SHELL).then(c=>c.put(e.request, copy));
        }
        return res;
      }).catch(()=>hit)
    )
  );
});
