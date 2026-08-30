
const CACHE_VERSION = 'v5'; // Incrémente à chaque déploiement
const CACHE_NAME = 'compteur-' + CACHE_VERSION;

const ASSETS = [
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
  './icon-192.png',
  './icon-512.png',
  './favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .catch(err => console.error('SW install: échec de mise en cache', err))
      .then(() => self.skipWaiting())
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
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) {
        return cached;
      }

      // Pas en cache : on va sur le réseau, et on met en cache la réponse
      // au passage pour la prochaine fois (au lieu d'échouer directement).
      return fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Vraiment hors-ligne et rien en cache : pour une navigation,
          // on retombe sur la page d'accueil si elle est disponible ;
          // sinon on renvoie une vraie Response (jamais null/undefined).
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html').then(fallback =>
              fallback || new Response(
                '<h1>Hors-ligne</h1><p>Cette page n\'est pas disponible sans connexion.</p>',
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              )
            );
          }
          return new Response('', { status: 404, statusText: 'Offline asset not cached' });
        });
    })
  );
});
