// Come FamilyLoop: Network First con fallback alla cache.
// Le tile della mappa vengono messe in cache per l'uso offline sul sentiero.
const CACHE_NAME = 'camminata-sm-v1';
const urlsToCache = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(urlsToCache)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Cache First per le tile OSM (fondamentale offline in montagna)
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
            return res;
          })
      )
    );
    return;
  }
  // Network First per il resto
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
