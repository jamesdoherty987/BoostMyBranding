/* Minimal offline-capable service worker for the client PWA.
   Scope is controlled by where the registration happens (from the portal
   layout), so this SW will only control requests to /portal/*. */
const CACHE = 'bmb-portal-v3';
// Only cache assets we know exist at install time. The portal routes
// themselves are skipped — they'll be fetched and cached lazily on first
// visit, which also avoids the SW install failing on a fresh deploy
// where /portal/dashboard hasn't been server-rendered yet.
const SHELL = ['/manifest.json', '/icon-192.svg', '/icon-512.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Use addAll in a try/catch so one failed asset doesn't block install.
      Promise.all(
        SHELL.map((url) =>
          c.add(url).catch((err) => console.warn('[sw] skip', url, err)),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Only handle portal-scoped requests to avoid interfering with
  // marketing pages + client sites.
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/portal') && url.pathname !== '/manifest.json') return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches
          .open(CACHE)
          .then((c) => c.put(request, copy))
          .catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((m) => m ?? new Response('', { status: 504 }))),
  );
});
