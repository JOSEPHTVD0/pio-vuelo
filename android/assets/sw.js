var CACHE = 'piovuelo-v20';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/data.js',
  './js/audio.js',
  './js/save.js',
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
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (res) {
        if (e.request.method === 'GET') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    }).catch(function () { return caches.match('./index.html'); })
  );
});