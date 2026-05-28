const CACHE = 'study-collab-v1';
const ASSETS = ['/', '/manifest.webmanifest', '/icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(r => r || caches.match('/'))));
});
