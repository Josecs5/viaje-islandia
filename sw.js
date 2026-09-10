/* Service worker — Viaje a Islandia
 * Precache del shell + (Task 4) caché de tiles al usarlos. Sin dependencias.
 */
'use strict';

const SHELL_CACHE = 'shell-v13';
const TILE_CACHE  = 'tiles-v1';
const TILE_MAX = 300;

// PNG transparente 1×1 para responder tiles cuando no hay red ni caché.
const TRANSPARENT_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  c => c.charCodeAt(0)
);

function isTile(url) {
  return /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname);
}

async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= TILE_MAX) return;
  const excess = keys.slice(0, keys.length - TILE_MAX);
  await Promise.all(excess.map(req => cache.delete(req)));
}

async function tileFetch(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    // Leaflet pide los tiles sin CORS: la respuesta es opaca (status 0, ok false)
    // pero se puede cachear. Los errores reales (basic/cors con ok false) no.
    if (res && (res.ok || res.type === 'opaque')) {
      try {
        await cache.put(request, res.clone());
        trimTileCache();
      } catch (e) { /* quota u otro: se responde igualmente */ }
    }
    return res;
  } catch (e) {
    return new Response(TRANSPARENT_PNG, { headers: { 'Content-Type': 'image/png' } });
  }
}

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css?v=13',
  './app.js?v=13',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon.svg',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/fonts/fonts.css',
  './vendor/fonts/space-grotesk-500.woff2',
  './vendor/fonts/space-grotesk-600.woff2',
  './vendor/fonts/space-grotesk-700.woff2',
  './vendor/fonts/inter-400.woff2',
  './vendor/fonts/inter-500.woff2',
  './vendor/fonts/inter-600.woff2',
  './vendor/fonts/inter-700.woff2',
  './vendor/fonts/ibm-plex-mono-400.woff2',
  './vendor/fonts/ibm-plex-mono-500.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(
      // 'reload' evita que un asset servido rancio por la caché HTTP del
      // navegador quede horneado en el precache del SW.
      SHELL_ASSETS.map(u => new Request(u, { cache: 'reload' }))
    ))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, TILE_CACHE];
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => !keep.includes(n)).map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navegación: cache-first contra index.html (arranque offline instantáneo).
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(hit => hit || fetch(request))
    );
    return;
  }

  // Tiles de OpenStreetMap: cache-first en tiles-v1, con tope y fallback.
  if (isTile(url)) {
    event.respondWith(tileFetch(request));
    return;
  }

  // Shell mismo origen: cache-first con fallback a red.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request))
    );
    return;
  }

  // Cross-origin no-tile (Nominatim, Wikimedia): sin interceptar.
});
