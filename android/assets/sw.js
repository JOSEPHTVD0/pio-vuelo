var CACHE = 'piovuelo-v24';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/firebase-config.js',
  './js/data.js',
  './js/audio.js',
  './js/save.js',
  './js/cloud.js',
  './js/ads.js',
  './js/fx.js',
  './js/bg.js',
  './js/entities.js',
  './js/game.js',
  './js/ui.js',
  './js/main.js',
  './icons/pwa-192.png',
  './icons/pwa-512.png',
  './icons/pwa-maskable-192.png',
  './icons/pwa-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url;

  /* Firebase, gstatic y cualquier API externa van SIEMPRE a la red.
     Si se cachean, el ranking puede quedarse congelado o fallar. */
  try { url = new URL(req.url); } catch (err) { return; }
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  /* Navegación: red primero y, si no hay conexión, la portada cacheada. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* Estáticos del juego: caché primero. */
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
