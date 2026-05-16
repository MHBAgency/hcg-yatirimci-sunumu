/* Hikmet Çetin Gold — Service Worker
 * Cache-first strategy for offline-first presentation
 * Tüm static asset'ler pre-cache edilir, HTML için network-first
 */

const CACHE_VERSION = 'hcg-v11-2026-05-16-css-cleanup';
const CACHE_NAME = `hcg-presentation-${CACHE_VERSION}`;

// Tüm kritik asset'ler — sunum başlamadan önce pre-cache edilir
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './styles/dna.css',

  // Scripts
  './scripts/navigation.js',
  './scripts/map-world.js',
  './scripts/three-cil-tank.js',
  './scripts/three-roaster.js',
  './scripts/three-oxygen.js',
  './scripts/three-carbon-adsorption.js',
  './scripts/three-carbon-regen.js',
  './scripts/three-electrowinning.js',
  './scripts/equipment-toggle.js',
  './scripts/loading-progress.js',
  './scripts/sw-register.js',

  // Three.js (yerel)
  './vendor/three/three.module.js',
  './vendor/three/addons/controls/OrbitControls.js',
  './vendor/three/addons/environments/RoomEnvironment.js',

  // Görseller
  './assets/images/plant-overview.jpeg',
  './assets/images/cil-tanks.jpeg',
  './assets/images/carbon-regen.jpeg',
  './assets/images/electrowinning.jpeg',
  './assets/images/roasting.jpeg',
  './assets/images/oxygen-plant.jpeg',
  './assets/images/adsorption.jpeg',
  './assets/images/ore-samples.jpeg',

  // İkonlar
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Tek tek ekle: bir dosya 404'lerse diğerlerini bozmasın
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const req = new Request(url, { cache: 'reload' });
            const resp = await fetch(req);
            if (resp.ok) {
              await cache.put(url, resp.clone());
              // Progress update
              self.clients.matchAll().then((clients) => {
                clients.forEach((c) => c.postMessage({
                  type: 'precache-progress',
                  url: url,
                }));
              });
            }
          } catch (err) {
            console.warn('[SW] Cache miss for', url, err);
          }
        })
      );
      // Don't fail install if some optional assets missing
      return results;
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k.startsWith('hcg-presentation-') && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Sadece kendi origin'imiz için cache yap
  if (url.origin !== self.location.origin) return;

  // HTML: network-first (güncel sürüm yakalanır)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Diğer asset'ler: cache-first (offline çalışır)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Arka planda yenile
        fetch(req).then((resp) => {
          if (resp.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resp.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});

// Manuel cache trigger: ana sayfa tüm asset'leri pre-fetch ister
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'precache-all') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
  }
});
