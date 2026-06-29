const CACHE_NAME = 'pitchsignal-v20260630-2';
const STATIC_ASSETS = [
  '/static/manifest.json',
  '/static/icon-192-v3.png',
  '/static/icon-512-v3.png',
];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: keep application code network-first so deployments are visible immediately.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (
    e.request.mode === 'navigate' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Versioned icons and manifest can remain cache-first.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
