/* Service worker · CDSS Hemorragia Subgaleal Neonatal
   Dr. Jano Jaramillo — Médico Pediatra y Neonatólogo
   Cambia VERSION en cada publicación para forzar la actualización. */
const VERSION = 'subgaleal-neo-v1.0.0';
const CORE = ['./', './index.html'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Cada recurso por separado: si uno falla, la instalación no se cae.
    await Promise.all(CORE.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res && res.ok) await cache.put(url, res);
      } catch (e) { /* sin red: se cacheará en la primera visita */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Red con tiempo límite: evita que la app "se quede cargando" con señal débil.
function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function navigationHandler(event) {
  const cache = await caches.open(VERSION);
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || await Promise.race([fetch(event.request), timeout(3500)]);
    if (res && res.ok) {
      cache.put('./index.html', res.clone());
      cache.put('./', res.clone());
    }
    return res;
  } catch (e) {
    return (await cache.match(event.request, { ignoreSearch: true })) ||
           (await cache.match('./index.html')) ||
           (await cache.match('./')) ||
           new Response('<h1>Sin conexión</h1><p>Abre la app una vez con internet para guardarla.</p>',
             { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const network = fetch(request).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol === 'data:' || url.protocol === 'blob:') return;

  if (req.mode === 'navigate') {
    event.respondWith(navigationHandler(event));
    return;
  }
  if (url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});
