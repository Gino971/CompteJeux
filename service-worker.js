
const CACHE_VERSION = 'v3'; // Incrémente à chaque déploiement
const CACHE_NAME = 'compteur-' + CACHE_VERSION;
self.addEventListener('install', event => {
  const assets = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './421.js',
    './morpion.js',
    './simon.js',
    './timer.js',
    './ODS9.txt',
    './manifest.json',
    './Icon-192.png',
    './Icon-512.png',
    './favicon.ico'
  ];
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(assets)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(response => {
      if (response) {
        return response;
      }

      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }

      return new Response('', { status: 404, statusText: 'Offline asset not cached' });
    })
  );
});
