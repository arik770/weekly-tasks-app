// Service worker for "רשימת משימות שבועי"
// Caches the app shell so the page still opens (and works) when there's no network.
// All actual task/check/note data lives in localStorage on the page itself —
// this worker only caches the static files needed to load the app.

const CACHE_NAME = 'weekly-tasks-cache-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './apple-touch-icon.png'
];

// Install: pre-cache the app shell. Each file is cached individually (instead of
// cache.addAll, which fails ALL-OR-NOTHING) so that one missing/misnamed file
// during upload doesn't break the entire service worker installation.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] could not cache', url, err);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// Activate: clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for the HTML (so updates are picked up quickly),
// falling back to cache when offline. Cache-first for everything else.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHTML = req.headers.get('accept') && req.headers.get('accept').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});

// Handle notification clicks:
// - Clicking the "אישור" action OR anywhere on the notification → just close it,
//   do NOT open the app (as requested).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // action === 'dismiss' or click on body — either way, just close.
  // Do not call clients.openWindow() so the app stays closed.
});
