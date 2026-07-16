// PWA San Martino 2.0 — cache per l'uso offline sul sentiero
const CACHE = 'sm2-v3';
const PRECACHE = ['./', './index.html', './manifest.json', './icon-512.png', './logo.svg', './canonica.jpg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tile OpenStreetMap (mappa 2D): cache-first, fondamentale offline
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Stessa origine (app, JS, CSS, immagini): network-first con cache di riserva
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
    );
    return;
  }
  // Tutto il resto (Supabase, satellite 3D): solo rete
});
