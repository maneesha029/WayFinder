/*
 * WAYFINDER ONE service worker (A6b PWA).
 * Strategies:
 *  - navigations & shell: network-first, fall back to the cached shell when offline
 *  - static assets (/_next/static, fonts, icons): stale-while-revalidate
 *  - API GETs: network-first with a cache fallback for trip reads (offline pack
 *    handles the rest; mutations are never cached)
 */
const SHELL = 'wf-shell-v1';
const PACK = 'wf-offline-pack-v1';
const SHELL_URLS = ['/', '/trips', '/login', '/manifest.webmanifest', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== PACK).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(css|js|woff2?|png|svg|jpg|webp|pmtiles)$/.test(url.pathname)
  );
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && request.method === 'GET') cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // last resort for navigations: the cached shell
    if (request.mode === 'navigate') {
      const shell = await caches.open(SHELL);
      for (const url of ['/', '/offline.html']) {
        const hit = await shell.match(url);
        if (hit) return hit;
      }
    }
    throw new Error('offline and not cached');
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/offline-pack') || url.pathname.includes('/vouchers/')) {
    event.respondWith(networkFirst(event.request, PACK));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, SHELL));
  }
});
