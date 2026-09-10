# Modo offline (service worker) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la PWA de viaje a Islandia arranque y sea plenamente usable sin conexión (shell + datos), con Leaflet y fuentes servidos desde el repo, tiles del mapa cacheados al usarlos, y recarga automática cuando se publica una versión nueva.

**Architecture:** Un `sw.js` escrito a mano en la raíz del repo. En `install` precachea una lista explícita del shell en la caché `shell-v13`; en `activate` borra cachés viejas y toma control. El `fetch` enruta: navegación y shell → cache-first; tiles de OpenStreetMap → cache-first en `tiles-v1` (con tope y fallback a PNG transparente); resto cross-origin → sin interceptar. Un IIFE de registro en `app.js` detecta el worker nuevo y, cuando no hay ningún bottom-sheet abierto, le manda `SKIP_WAITING` y recarga la página una sola vez, con cortafuegos anti-bucle.

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin frameworks. Service Worker API + Cache Storage API. Leaflet 1.9.4 (vendorizado). Despliegue en GitHub Pages (`https://josecs5.github.io/viaje-islandia/`). Verificación manual con DevTools servida por `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-modo-offline-design.md`

## Global Constraints

- Sin paso de build y sin dependencias de tooling. No usar Workbox.
- JavaScript vanilla, sin framework. Estilo del repo: IIFE, `'use strict'`, comentarios en español.
- Leaflet clavado a **1.9.4**, sin modificar los archivos descargados.
- Nombres de caché exactos: **`shell-v13`** (shell) y **`tiles-v1`** (tiles). La versión de `tiles-v1` es independiente y **no** cambia al subir la del shell.
- Versión de assets: subir `?v=12` → **`?v=13`** en `style.css` y `app.js` dentro de `index.html`, y usar `?v=13` en la lista de precache.
- Fuentes a vendorizar: Space Grotesk 500/600/700, Inter 400/500/600/700, IBM Plex Mono 400/500. Formato **woff2**, subconjunto **latino** (`unicode-range` que empieza en `U+0000-00FF`), `font-display: swap`.
- `sw.js` va en la **raíz** del repo (para que el scope cubra todo `/viaje-islandia/`).
- Actualización = **recarga automática**, permitida solo cuando `#sheet` y `#confirm` están ambos `hidden`. Anti-bucle: si la recarga anterior fue hace < **10 000 ms** (marca en `sessionStorage['sw-reload-at']`), no recargar.
- Caché de tiles: solo host `*.tile.openstreetmap.org`; tope **300** entradas; al superarlo, borrar las primeras que devuelva `cache.keys()`. Si falla `cache.put` (quota), responder el tile de red sin cachear. Sin red y sin caché → PNG transparente 1×1.
- Cross-origin que no sea tile (Nominatim, Wikimedia Commons): **no interceptar** (no llamar a `event.respondWith`).
- `tokens.css` no entra en el precache.
- Commits: uno por tarea, mensaje en español, sin líneas de atribución.

---

## Estructura de archivos

| Archivo | Se crea/modifica | Responsabilidad |
|---|---|---|
| `sw.js` | Crear (raíz) | Precache del shell, activación/limpieza de cachés, router de `fetch`, caché de tiles, handler `SKIP_WAITING`. |
| `vendor/leaflet/leaflet.js` `leaflet.css` `images/*.png` | Crear | Copia sin modificar de Leaflet 1.9.4 servida desde el repo. |
| `vendor/fonts/fonts.css` + `*.woff2` | Crear | `@font-face` locales (subconjunto latino) y sus archivos woff2. |
| `index.html` | Modificar | Quitar `<link>`/`<script>` de CDN (Google Fonts, unpkg); apuntar a `vendor/`; subir `?v=13`. |
| `app.js` | Modificar | Nuevo IIFE al final: registro del SW + orquestación de actualización/recarga. |
| `README.md` | Modificar | Reflejar que ya hay modo offline y service worker. |

Orden de tareas: **1** (Leaflet) y **2** (fuentes) dejan el shell listo para precachear → **3** crea el SW y el arranque offline → **4** añade la caché de tiles → **5** añade la recarga automática y actualiza el README.

---

### Task 1: Vendorizar Leaflet 1.9.4

**Files:**
- Create: `vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css`, `vendor/leaflet/images/marker-icon.png`, `vendor/leaflet/images/marker-icon-2x.png`, `vendor/leaflet/images/marker-shadow.png`, `vendor/leaflet/images/layers.png`, `vendor/leaflet/images/layers-2x.png`
- Modify: `index.html` (líneas 32-34 y 180-181)
- Test: verificación manual en navegador (sin framework de test en el repo)

**Interfaces:**
- Consumes: nada.
- Produces: los archivos `vendor/leaflet/leaflet.js` y `vendor/leaflet/leaflet.css` en rutas fijas, que la lista de precache de la Task 3 referencia textualmente.

- [ ] **Step 1: Descargar los archivos de Leaflet**

Desde la raíz del repo, en PowerShell:

```powershell
$dir = 'vendor/leaflet'
New-Item -ItemType Directory -Force "$dir/images" | Out-Null
$base = 'https://unpkg.com/leaflet@1.9.4/dist'
curl.exe -sL "$base/leaflet.js"  -o "$dir/leaflet.js"
curl.exe -sL "$base/leaflet.css" -o "$dir/leaflet.css"
foreach ($img in 'marker-icon.png','marker-icon-2x.png','marker-shadow.png','layers.png','layers-2x.png') {
  curl.exe -sL "$base/images/$img" -o "$dir/images/$img"
}
```

- [ ] **Step 2: Comprobar que los archivos existen y no vienen vacíos**

Run:
```powershell
Get-ChildItem -Recurse vendor/leaflet | Select-Object FullName, Length
```
Expected: 7 archivos. `leaflet.js` ~140-150 KB, `leaflet.css` ~14 KB, cada PNG entre 0.6 y 12 KB. Ninguno de 0 bytes.

- [ ] **Step 3: Comprobar que `leaflet.css` referencia `images/` en relativo**

Run:
```powershell
Select-String -Path vendor/leaflet/leaflet.css -Pattern 'images/(layers|marker)' | Select-Object -First 3
```
Expected: aparecen `url(images/layers.png)`, `url(images/marker-icon.png)`, etc. Como `leaflet.css` está en `vendor/leaflet/` y las imágenes en `vendor/leaflet/images/`, las rutas resuelven sin cambios.

- [ ] **Step 4: Repuntar `index.html` — CSS de Leaflet**

En `index.html`, sustituir estas líneas (32-34):
```html
  <!-- Leaflet (CDN) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
```
por:
```html
  <!-- Leaflet (local) -->
  <link rel="stylesheet" href="vendor/leaflet/leaflet.css">
```

- [ ] **Step 5: Repuntar `index.html` — JS de Leaflet**

En `index.html`, sustituir estas líneas (180-181):
```html
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" defer></script>
```
por:
```html
  <script src="vendor/leaflet/leaflet.js" defer></script>
```

- [ ] **Step 6: Servir y verificar el mapa online**

Run:
```powershell
python -m http.server 8000
```
Abrir `http://localhost:8000/` en el navegador. Ir a la pestaña **Mapas**, elegir un día.
Expected:
- El mapa se dibuja con tiles de OpenStreetMap, pines numerados y línea de recorrido.
- En DevTools > Network, `leaflet.js` y `leaflet.css` se piden a `localhost:8000/vendor/leaflet/...` con **200** (no a `unpkg.com`).
- En DevTools > Console, sin errores de Leaflet.
- Los iconos de marcador se ven (no cuadros rotos).

- [ ] **Step 7: Commit**

```powershell
git add vendor/leaflet index.html
git commit -m "Vendorizar Leaflet 1.9.4 (sin CDN)"
```

---

### Task 2: Vendorizar las fuentes web

**Files:**
- Create: `vendor/fonts/fonts.css`, `vendor/fonts/space-grotesk-500.woff2`, `vendor/fonts/space-grotesk-600.woff2`, `vendor/fonts/space-grotesk-700.woff2`, `vendor/fonts/inter-400.woff2`, `vendor/fonts/inter-500.woff2`, `vendor/fonts/inter-600.woff2`, `vendor/fonts/inter-700.woff2`, `vendor/fonts/ibm-plex-mono-400.woff2`, `vendor/fonts/ibm-plex-mono-500.woff2`
- Modify: `index.html` (líneas 27-30)
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: nada.
- Produces: `vendor/fonts/fonts.css` y exactamente 9 archivos `.woff2` con los nombres `<slug>-<peso>.woff2` (`slug` ∈ `space-grotesk`, `inter`, `ibm-plex-mono`). La lista de precache de la Task 3 los referencia uno a uno con esos nombres.

- [ ] **Step 1: Descargar los woff2 latinos y generar `fonts.css`**

Desde la raíz del repo, en PowerShell. El script pide a Google Fonts el CSS con un User-Agent de navegador moderno (así devuelve woff2), se queda con el bloque `@font-face` de subconjunto latino de cada peso (`unicode-range` que empieza en `U+0000-00FF`), descarga cada woff2 y escribe `fonts.css` con rutas locales:

```powershell
$ua  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
$url = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap'
$dir = 'vendor/fonts'
New-Item -ItemType Directory -Force $dir | Out-Null
$css = (Invoke-WebRequest -Uri $url -UserAgent $ua -UseBasicParsing).Content
$slug = @{ 'IBM Plex Mono' = 'ibm-plex-mono'; 'Inter' = 'inter'; 'Space Grotesk' = 'space-grotesk' }
$out = New-Object System.Collections.Generic.List[string]
foreach ($m in [regex]::Matches($css, '@font-face\s*\{[^}]*\}')) {
  $t = $m.Value
  if ($t -notmatch 'unicode-range:\s*U\+0000-00FF') { continue }
  $fam   = [regex]::Match($t, "font-family:\s*'([^']+)'").Groups[1].Value
  $wght  = [regex]::Match($t, 'font-weight:\s*(\d+)').Groups[1].Value
  $src   = [regex]::Match($t, 'src:\s*url\(([^)]+)\)').Groups[1].Value
  $range = [regex]::Match($t, 'unicode-range:\s*([^;}]+)').Groups[1].Value.Trim()
  $name  = "$($slug[$fam])-$wght.woff2"
  curl.exe -sL $src -o "$dir/$name"
  $out.Add("@font-face{font-family:'$fam';font-style:normal;font-weight:$wght;font-display:swap;src:url('$name') format('woff2');unicode-range:$range}")
}
Set-Content -Path "$dir/fonts.css" -Value ($out -join "`n") -Encoding utf8
"generados: $($out.Count) @font-face"
```

Expected en consola: `generados: 9 @font-face`.

- [ ] **Step 2: Comprobar los archivos**

Run:
```powershell
Get-ChildItem vendor/fonts | Select-Object Name, Length
```
Expected: `fonts.css` + 9 `.woff2` (`space-grotesk-500/600/700`, `inter-400/500/600/700`, `ibm-plex-mono-400/500`). Cada woff2 entre ~10 y ~40 KB, ninguno de 0 bytes.

Si el recuento **no** es 9: abrir el CSS remoto a mano
(`(Invoke-WebRequest -Uri $url -UserAgent $ua -UseBasicParsing).Content | Set-Content vendor/fonts/_debug.css`),
comprobar cuántos bloques `@font-face` tienen `unicode-range: U+0000-00FF` y ajustar. Borrar `_debug.css` al terminar. No continuar hasta tener 9.

- [ ] **Step 3: Verificar el contenido de `fonts.css`**

Run:
```powershell
Get-Content vendor/fonts/fonts.css
```
Expected: 9 líneas `@font-face`, cada una con `src:url('<slug>-<peso>.woff2') format('woff2')`, `font-display:swap` y un `unicode-range` que empieza por `U+0000-00FF`. Sin URLs de `fonts.gstatic.com`.

- [ ] **Step 4: Repuntar `index.html`**

En `index.html`, sustituir estas líneas (27-30):
```html
  <!-- Fuentes -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
```
por:
```html
  <!-- Fuentes (local) -->
  <link rel="stylesheet" href="vendor/fonts/fonts.css">
```

- [ ] **Step 5: Servir y verificar la tipografía**

Run:
```powershell
python -m http.server 8000
```
Abrir `http://localhost:8000/`.
Expected:
- La app se ve igual que antes: títulos en Space Grotesk, cuerpo en Inter, códigos/horas en IBM Plex Mono.
- DevTools > Network filtrado por `Font`: se cargan `.woff2` desde `localhost:8000/vendor/fonts/...` con **200**. Ninguna petición a `fonts.googleapis.com` ni `fonts.gstatic.com`.
- DevTools > Console: sin errores 404 de fuentes.

- [ ] **Step 6: Commit**

```powershell
git add vendor/fonts index.html
git commit -m "Vendorizar las fuentes web (woff2, subconjunto latino)"
```

---

### Task 3: Service worker — precache del shell y arranque offline

**Files:**
- Create: `sw.js` (raíz del repo)
- Modify: `index.html` (línea 36 y línea 182: `?v=12` → `?v=13`), `app.js` (nuevo IIFE al final, tras la línea 2164)
- Test: verificación manual con DevTools (Application + Network)

**Interfaces:**
- Consumes: `vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css` (Task 1); `vendor/fonts/fonts.css` y los 9 `.woff2` (Task 2).
- Produces:
  - `sw.js` con: constante `SHELL_CACHE = 'shell-v13'`, constante `TILE_CACHE = 'tiles-v1'`, listener `install` (precache), listener `message` (`{type:'SKIP_WAITING'}` → `self.skipWaiting()`), listener `activate` (borra cachés fuera de `[SHELL_CACHE, TILE_CACHE]` + `clients.claim()`), listener `fetch` con router: `navigate` → `caches.match('./index.html')`; mismo origen → cache-first; cross-origin → sin interceptar. **Sin lógica de tiles todavía** (la añade la Task 4).
  - `app.js`: IIFE que llama a `navigator.serviceWorker.register('sw.js')` en `window` `load` y a `reg.update()`. **Sin recarga automática todavía** (la añade la Task 5).

- [ ] **Step 1: Crear `sw.js`**

Crear `sw.js` en la raíz del repo con este contenido exacto:

```js
/* Service worker — Viaje a Islandia
 * Precache del shell + (Task 4) caché de tiles al usarlos. Sin dependencias.
 */
'use strict';

const SHELL_CACHE = 'shell-v13';
const TILE_CACHE  = 'tiles-v1';

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
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS))
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

  // Shell mismo origen: cache-first con fallback a red.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request))
    );
    return;
  }

  // Cross-origin (Nominatim, Wikimedia, tiles): sin interceptar por ahora.
});
```

- [ ] **Step 2: Subir la versión de assets en `index.html`**

En `index.html`, línea 36: `<link rel="stylesheet" href="style.css?v=12">` → `href="style.css?v=13"`.
En `index.html`, línea 182: `<script src="app.js?v=12" defer></script>` → `src="app.js?v=13"`.

- [ ] **Step 3: Añadir el IIFE de registro al final de `app.js`**

Al final de `app.js`, **después** de la línea 2164 (`})();` que cierra el IIFE principal), añadir:

```js

/* ==========================================================
   Service worker: registro
   (la actualización automática se añade en la Task 5)
   ========================================================== */
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.update();
    }).catch(function (e) {
      console.warn('[sw] registro fallido:', e);
    });
  });
})();
```

- [ ] **Step 4: Verificar el registro y el precache (online)**

Run:
```powershell
python -m http.server 8000
```
Abrir `http://localhost:8000/` con DevTools abierto. Recargar una vez.
Expected:
- DevTools > Application > Service Workers: `sw.js` en estado **activated and running**, sin errores.
- DevTools > Application > Cache Storage: existe `shell-v13` con **27 entradas** — las 27 URLs de `SHELL_ASSETS` (incluidas `style.css?v=13` y `app.js?v=13` con su query).
- DevTools > Console: sin errores. Sin peticiones a `unpkg.com`, `fonts.googleapis.com` ni `fonts.gstatic.com`.

- [ ] **Step 5: Verificar el arranque offline**

Con la pestaña ya cargada: DevTools > Network > marcar **Offline**. Recargar la página.
Expected:
- La app carga. Se ven y funcionan **Datos**, **Itinerario**, **Ideas**, **Ruta**.
- Estilos y tipografía correctos (fuentes desde caché).
- En **Mapas**, un día ya visto online muestra sus tiles; un día no visto muestra pines y recorrido sobre fondo gris (tiles fallan, pero la app no se rompe).
- DevTools > Console: los fallos de tiles/geocodificación no rompen la app; no hay pantalla en blanco.

- [ ] **Step 6: Verificar que sigue sin service worker si no está soportado**

En DevTools > Application > Service Workers, pulsar **Unregister**. DevTools > Network, desmarcar Offline. Recargar.
Expected: la app funciona igual que antes de esta tarea (online). Volver a recargar re-registra el SW.

- [ ] **Step 7: Commit**

```powershell
git add sw.js index.html app.js
git commit -m "Service worker: precache del shell y arranque offline"
```

---

### Task 4: Caché de tiles del mapa al usarlos

**Files:**
- Modify: `sw.js` (añadir helpers de tiles y una rama en el router de `fetch`)
- Test: verificación manual con DevTools

**Interfaces:**
- Consumes: de la Task 3 — `sw.js` con `TILE_CACHE = 'tiles-v1'` y el listener `fetch` con su router.
- Produces: en `sw.js` — funciones `isTile(url)`, `trimTileCache()`, `tileFetch(request)` y una constante `TILE_MAX = 300`; el router de `fetch` gana una rama para tiles **antes** de la rama de mismo origen. La caché `tiles-v1` se llena en runtime con respuestas de `*.tile.openstreetmap.org`.

- [ ] **Step 1: Añadir constante y helpers de tiles en `sw.js`**

En `sw.js`, justo después de la línea `const TILE_CACHE = 'tiles-v1';`, añadir:

```js
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
    if (res && res.ok) {
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
```

- [ ] **Step 2: Añadir la rama de tiles al router de `fetch`**

En `sw.js`, dentro del listener `fetch`, **entre** la rama de navegación y la de mismo origen, añadir:

```js
  // Tiles de OpenStreetMap: cache-first en tiles-v1, con tope y fallback.
  if (isTile(url)) {
    event.respondWith(tileFetch(request));
    return;
  }
```

El comentario final del listener queda como: `// Cross-origin no-tile (Nominatim, Wikimedia): sin interceptar.`

- [ ] **Step 3: Verificar que los tiles se cachean al usarlos**

Run:
```powershell
python -m http.server 8000
```
Abrir `http://localhost:8000/`, DevTools abierto. En Application > Service Workers pulsar **Unregister**, recargar dos veces para activar el `sw.js` nuevo (o pulsar **skipWaiting** en el panel). Confirmar que el SW activo es el nuevo.
Ir a **Mapas**, abrir un día, dejar que carguen los tiles.
Expected:
- DevTools > Application > Cache Storage: aparece `tiles-v1` con varias entradas `https://*.tile.openstreetmap.org/...png`.
- `shell-v13` sigue intacta.

- [ ] **Step 4: Verificar el mapa offline para un día ya visto**

DevTools > Network > **Offline**. Recargar. Ir a **Mapas** y abrir **el mismo día** de antes.
Expected: los tiles se ven (vienen de `tiles-v1`). El recorrido y los pines, también.

- [ ] **Step 5: Verificar el fallback de tile sin red ni caché**

Seguir offline. En **Mapas**, abrir un día **distinto**, no visto antes.
Expected: pines y línea de recorrido sobre fondo gris; **no** hay iconos de imagen rota (las peticiones de tile devuelven el PNG transparente 1×1). La consola no muestra excepciones sin capturar del SW.

- [ ] **Step 6: Verificar el tope de la caché (opcional pero recomendado)**

Volver online. En DevTools > Console, pegar:
```js
(async () => {
  const c = await caches.open('tiles-v1');
  const before = (await c.keys()).length;
  for (let i = 0; i < 320; i++) {
    await c.put(new Request('https://a.tile.openstreetmap.org/_fake/' + i + '.png'),
                new Response(new Blob()));
  }
  console.log('antes de trim (inyectado):', (await c.keys()).length);
})();
```
Luego abrir un día del mapa con red (dispara `tileFetch` → `trimTileCache`), y en Console:
```js
caches.open('tiles-v1').then(c => c.keys()).then(k => console.log('entradas tras trim:', k.length));
```
Expected: `entradas tras trim: 300` (o ligeramente por encima si justo se acaban de añadir tiles reales; nunca cientos por encima). Limpiar: `caches.delete('tiles-v1')` y recargar.

- [ ] **Step 7: Commit**

```powershell
git add sw.js
git commit -m "Service worker: cachear tiles del mapa al usarlos, con tope y fallback"
```

---

### Task 5: Actualización automática con guardas + README

**Files:**
- Modify: `app.js` (ampliar el IIFE de service worker añadido en la Task 3)
- Modify: `README.md`
- Test: verificación manual del ciclo de publicación con DevTools

**Interfaces:**
- Consumes: de la Task 3 — el IIFE `(function () { if (!('serviceWorker' in navigator)) return; ... })()` al final de `app.js`, y el handler `message` de `sw.js` que llama a `self.skipWaiting()`.
- Produces: el IIFE de `app.js` pasa a: detectar el worker nuevo (`updatefound` → `statechange` a `installed` con `controller` presente, y también `reg.waiting` ya presente al registrar), llamar a `applyUpdate(reg)` que comprueba `safeToReload()` (`#sheet` y `#confirm` ambos `hidden`) y o bien hace `reg.waiting.postMessage({type:'SKIP_WAITING'})` o reintenta a los 2 s; escuchar `controllerchange` para `location.reload()` una sola vez con guarda anti-bucle vía `sessionStorage['sw-reload-at']` (< 10 000 ms → no recarga); y llamar a `reg.update()` al volver a primer plano (throttle 15 min).

- [ ] **Step 1: Sustituir el IIFE de service worker en `app.js`**

Reemplazar **todo** el bloque añadido en la Task 3 (desde el comentario `/* ===... Service worker: registro ... ===*/` hasta su `})();`) por este:

```js

/* ==========================================================
   Service worker: registro y actualización automática
   ========================================================== */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var LOOP_KEY = 'sw-reload-at';
  var reloaded = false;

  // Solo es seguro recargar si no hay ningún panel modal abierto.
  function safeToReload() {
    var sheet = document.getElementById('sheet');
    var conf = document.getElementById('confirm');
    return (!sheet || sheet.hidden) && (!conf || conf.hidden);
  }

  // Pide al worker en espera que tome el control; si hay un modal abierto,
  // reintenta en 2 s.
  function applyUpdate(reg) {
    if (!reg.waiting) return;
    if (!safeToReload()) {
      setTimeout(function () { applyUpdate(reg); }, 2000);
      return;
    }
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  // El worker nuevo ha tomado el control: recargar una vez, salvo bucle.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloaded) return;
    reloaded = true;
    var last = +sessionStorage.getItem(LOOP_KEY) || 0;
    if (Date.now() - last < 10000) {
      console.warn('[sw] recarga omitida: posible bucle de actualización.');
      return;
    }
    try { sessionStorage.setItem(LOOP_KEY, String(Date.now())); } catch (e) {}
    location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.update();

      // Ya hay una versión nueva esperando de una carga anterior.
      if (reg.waiting && navigator.serviceWorker.controller) applyUpdate(reg);

      // Aparece una versión nueva mientras la app está abierta.
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            applyUpdate(reg);
          }
        });
      });

      // Al volver a primer plano tras un rato, buscar versión nueva.
      var lastCheck = Date.now();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - lastCheck < 15 * 60 * 1000) return;
        lastCheck = Date.now();
        reg.update();
      });
    }).catch(function (e) {
      console.warn('[sw] registro fallido:', e);
    });
  });
})();
```

- [ ] **Step 2: Verificar la primera instalación (sin recarga)**

Run:
```powershell
python -m http.server 8000
```
En DevTools > Application > Service Workers, **Unregister**, y borrar Cache Storage. Recargar.
Expected: el SW se instala y activa; `shell-v13` se llena; la página **no** se recarga sola (no había `controller` previo). Consola sin `[sw] recarga omitida`.

- [ ] **Step 3: Verificar la actualización automática**

Con la app cargada y el SW activo: editar `sw.js` y `index.html` para simular un release:
- En `sw.js`: `const SHELL_CACHE = 'shell-v13';` → `'shell-v14'`; y en `SHELL_ASSETS` cambiar `./style.css?v=13` → `./style.css?v=14` y `./app.js?v=13` → `./app.js?v=14`.
- En `index.html`: `style.css?v=13` → `?v=14` y `app.js?v=13` → `?v=14`.

Guardar. Volver al navegador (pestaña ya abierta, sin tocar nada) y esperar unos segundos, o disparar `visibilitychange` cambiando de pestaña y volviendo.
Expected:
- La página se recarga **una sola vez**.
- Tras recargar: DevTools > Application > Cache Storage tiene `shell-v14`; `shell-v13` ha desaparecido; `tiles-v1` sigue.
- Consola sin errores.

- [ ] **Step 4: Verificar la guarda con un modal abierto**

Repetir el ciclo del Step 3 (ahora `v14` → `v15`, `shell-v14` → `shell-v15`), pero **antes** de que llegue la actualización, abrir un formulario: pestaña **Ideas** > "+ Añadir recomendación" (esto quita el atributo `hidden` de `#sheet`).
Expected: la página **no** se recarga mientras el sheet está abierto. Al cerrar el sheet (botón Cancelar o ✕), en ≤ 2 s la página se recarga y aparece `shell-v15`.

- [ ] **Step 5: Verificar el cortafuegos anti-bucle**

En DevTools > Console:
```js
sessionStorage.setItem('sw-reload-at', String(Date.now()));
```
Luego repetir un ciclo de release (`v15` → `v16`, `shell-v15` → `shell-v16`) con el sheet cerrado.
Expected: la consola muestra `[sw] recarga omitida: posible bucle de actualización.` y la página **no** se recarga. La caché `shell-v16` se crea igualmente (queda servida en la siguiente carga manual). Limpiar: `sessionStorage.removeItem('sw-reload-at')`.

- [ ] **Step 6: Revertir los cambios de prueba**

Dejar `sw.js` y `index.html` de nuevo en `?v=13` / `shell-v13` (deshacer los Steps 3-5). Confirmar con:
```powershell
git diff -- sw.js index.html
```
Expected: sin cambios en `sw.js` ni `index.html` respecto al commit de la Task 4 / Task 3 (salvo el `?v=` si se decide dejar el bump real; para esta tarea se revierte a `v13`).

- [ ] **Step 7: Actualizar el README**

En `README.md`:
- Línea 3: `PWA (sin modo offline) para planificar...` → `PWA con modo offline para planificar...`
- En la lista de la sección "Estructura", añadir dos filas:
  | `sw.js` | Service worker: precache del shell y caché de tiles |
  | `vendor/` | Leaflet 1.9.4 y fuentes web servidos desde el repo |
- Sustituir la línea `Solo HTML, CSS y JavaScript. Sin frameworks. Sin service worker.` + `Leaflet se carga por CDN.` por:
  `Solo HTML, CSS y JavaScript. Sin frameworks. Service worker para uso sin conexión; Leaflet y las fuentes van incluidos en el repo.`
- Añadir un párrafo al final de "Estructura":
  `La app se actualiza sola: al detectar una versión nueva se recarga cuando no hay ningún formulario abierto. Si algo se queda raro, cierra la app del todo y vuelve a abrirla, o borra los datos del sitio en el navegador (se borran caché y datos).`

- [ ] **Step 8: Verificación final completa (offline + online)**

Run:
```powershell
python -m http.server 8000
```
- Online, primera carga: `shell-v13` con 27 entradas, SW activo, sin peticiones a CDNs.
- Offline + recarga: arrancan Datos, Itinerario, Ideas, Ruta; tipografía y estilos correctos; Mapas con día ya visto muestra tiles, día nuevo muestra gris sin romper.
- Lighthouse (pestaña de DevTools) > categoría **PWA**: "installable" en verde y sin fallos rojos de service worker.

- [ ] **Step 9: Commit**

```powershell
git add app.js README.md
git commit -m "Service worker: actualizacion automatica con guardas; README"
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea que lo implementa |
|---|---|
| §2 objetivo: shell + datos usables offline | Task 3 (precache + arranque offline) |
| §2 objetivo: mapa con tiles vistos | Task 4 |
| §2 objetivo: versiones nuevas automáticas | Task 5 |
| §2 no-objetivos (no precargar tiles, no cachear fotos/geocoding, no tocar localStorage, no build/Workbox) | Respetado en Tasks 3-5; sin pasos que los contradigan |
| §3 decisión: alcance solo shell + tiles on-use | Task 3 + Task 4 |
| §3 decisión: recarga automática con guardas | Task 5 |
| §3 decisión: Leaflet y fuentes vendorizadas | Task 1 + Task 2 |
| §3 decisión: sw.js a mano | Task 3 |
| §3 decisión: fuentes opción (a) | Task 2 |
| §4 archivos nuevos: sw.js, vendor/leaflet, vendor/fonts | Tasks 1, 2, 3 |
| §4 modificados: index.html, app.js, README.md | Tasks 1, 2, 3, 5 |
| §4: tokens.css fuera del precache | `SHELL_ASSETS` en Task 3 no lo incluye |
| §5 caché `shell-v13` con lista explícita | Task 3 Step 1 (`SHELL_ASSETS`, 27 entradas) |
| §5 caché `tiles-v1`, tope 300, versión independiente | Task 4 (`TILE_MAX`, `trimTileCache`; `activate` conserva `tiles-v1`) |
| §5 router: navigate / shell / tiles / cross-origin | Task 3 (navigate, shell, cross-origin passthrough) + Task 4 (tiles) |
| §5 sutileza `?v=` | Task 3 Steps 1-2 (html y precache a `?v=13` a la vez) |
| §6 install sin skipWaiting propio | Task 3 Step 1 (no hay `skipWaiting` en `install`) |
| §6 message → skipWaiting | Task 3 Step 1 (listener `message`) |
| §6 activate: borrar cachés + clients.claim | Task 3 Step 1 |
| §6 app.js: register, update, updatefound, isSafeToReload, controllerchange, anti-bucle, primera instalación, visibilitychange 15 min | Task 5 Step 1 |
| §7 errores: precache atómico, quota en tiles, SW no soportado, iOS, `./` vs index.html, sin SRI, register rechaza, borrado de datos | Task 3 (addAll atómico, `if 'serviceWorker'`, precache `./` + `./index.html`), Task 4 (`try/catch` en `cache.put`), Task 1/2 (Leaflet clavado), Task 5 (`.catch`) |
| §8 pruebas 1-9 | Task 3 Steps 4-6, Task 4 Steps 3-6, Task 5 Steps 2-5 y 8 |
| §9 README | Task 5 Step 7 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO"/"pendiente". Cada paso de código lleva el bloque de código real. Las verificaciones llevan comando (`Run:`) y `Expected:` concretos. No hay "similar a la Task N": el IIFE de la Task 5 se da entero, no como diff sobre la Task 3.

**3. Consistencia de tipos y nombres**

- `SHELL_CACHE` / `'shell-v13'`, `TILE_CACHE` / `'tiles-v1'`, `TILE_MAX` — mismos nombres en Tasks 3 y 4.
- `isTile`, `trimTileCache`, `tileFetch` — definidas en Task 4 Step 1, usadas en Task 4 Step 2. No se referencian antes.
- `safeToReload`, `applyUpdate`, `LOOP_KEY`, `reloaded` — definidas y usadas dentro del mismo IIFE en Task 5 Step 1.
- `{ type: 'SKIP_WAITING' }` — mismo literal en `sw.js` (Task 3, listener `message`) y en `app.js` (Task 5, `postMessage`).
- IDs del DOM `sheet` y `confirm` con atributo `hidden` — existen en `index.html` (verificado: `<div class="sheet" id="sheet" hidden>` y `<div class="confirm" id="confirm" hidden>`).
- `?v=13` — en `index.html` (Task 3 Step 2) y en `SHELL_ASSETS` (Task 3 Step 1) a la vez.
- Recuento de precache: 27 entradas en `SHELL_ASSETS` = 1 (`./`) + 1 (`index.html`) + 2 (css/js con `?v=13`) + 1 (`manifest.json`) + 5 (iconos) + 7 (leaflet) + 1 (`fonts.css`) + 9 (`woff2`). Coincide con el "27 entradas" de Task 3 Step 4.

Sin inconsistencias.
