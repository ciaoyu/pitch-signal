const CACHE_NAME = 'pitchsignal-v20260703-push';
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

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '比赛有新动态' };
  }

  const matchId = data.matchId ? String(data.matchId) : '';
  const url = data.url || (matchId ? `/#match/${encodeURIComponent(matchId)}` : '/#live');
  event.waitUntil(self.registration.showNotification(data.title || 'PitchSignal', {
    body: data.body || '比赛有新动态',
    icon: data.icon || '/static/icon-192-v3.png',
    badge: data.badge || '/static/icon-192-v3.png',
    tag: data.tag || (matchId ? `goal-${matchId}` : 'pitchsignal-update'),
    renotify: true,
    data: { ...data, matchId, url },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const matchId = data.matchId ? String(data.matchId) : '';
  const targetUrl = new URL(
    data.url || (matchId ? `/#match/${encodeURIComponent(matchId)}` : '/#live'),
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      for (const client of clients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if ('navigate' in client) await client.navigate(targetUrl);
        await client.focus();
        if (matchId) client.postMessage({ type: 'OPEN_MATCH', matchId });
        return;
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
