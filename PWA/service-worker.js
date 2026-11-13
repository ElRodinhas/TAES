/* Caches only the app shell; household data remains in localStorage. */
const CACHE_NAME = 'smart-pantry-shell-v5';
const APP_FILES = [
  './', './index.html', './styles.css', './app.js', './profiles.js', './barcode-validation.js', './export.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './scan.html', './scanner.js', './pantry.html', './pantry.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('smart-pantry-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
