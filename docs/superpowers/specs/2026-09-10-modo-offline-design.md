# Modo offline (service worker) — Diseño

Fecha: 2026-09-10
Estado: aprobado el diseño; pendiente de plan de implementación
Ámbito: arquitectónico (añade un subsistema nuevo y revierte "sin service worker" del README)

> **Enmienda 2026-09-10 (tras revisión de implementación):**
> - §5 y las constraints globales decían "solo host `*.tile.openstreetmap.org`".
>   El mapa base real de la app es CARTO (`{s}.basemap.cartocdn.com/dark_all/…`);
>   OSM es solo el fallback tras varios `tileerror`. `isTile()` reconoce **ambos**
>   hosts. La caché de 300 tiles cache-on-use no cambia el perfil de peticiones
>   (mismo argumento que §7 hacía para OSM); atribución de CARTO intacta.
> - El "no-objetivo" de §2 "no se cachean respuestas opacas de terceros" se
>   mantiene: los tiles se piden con `crossOrigin: 'anonymous'` (CARTO y OSM
>   envían `ACAO: *`), así que el SW ve respuestas `cors` con status real y
>   cachea solo `res.ok`. Se descarta el cacheo de respuestas opacas.
> - `activate` borra solo cachés propias (`/^(shell|tiles)-v\d+$/`), no todas las
>   del origen — en GitHub Pages el origen es compartido entre proyectos.

## 1. Problema

La app se usará conduciendo por Islandia en octubre, donde la cobertura es
irregular (4G lento e intermitente, tramos sin señal). Hoy es una PWA **sin**
service worker: sin conexión no arranca. Los datos del viaje ya viven en
`localStorage`, pero el shell (HTML/CSS/JS), Leaflet y las fuentes se piden a la
red en cada carga, y Leaflet + fuentes vienen de CDN (unpkg, Google Fonts).

El cache-busting actual es manual: `?v=12` en `style.css` y `app.js` dentro de
`index.html`. Ya hubo un incidente por caché desalineada (commit `8c5882f`,
"página en blanco por assets cacheados desalineados"), así que la estrategia de
actualización es la zona de riesgo del diseño.

Despliegue: sitio estático en GitHub Pages, `https://josecs5.github.io/viaje-islandia/`,
HTTPS, scope en subcarpeta (`scope: "./"`, `id: "/viaje-islandia/"` en el
manifiesto). Sin build. Vanilla JS, sin framework.

## 2. Objetivo y no-objetivos

### Objetivo

Que la app arranque y sea plenamente usable sin conexión: **shell + datos del
viaje**. Itinerario, Datos, Ideas, Ruta y Emergencias funcionan al 100% offline.
El mapa muestra los tiles que ya se hayan visto con conexión (se cachean al
usarlos); un día nuevo sin señal se ve con pines y trazado sobre fondo gris.

Las publicaciones de versiones nuevas llegan a la app instalada **de forma
automática**: al detectarse, la app se recarga sola en cuanto es seguro hacerlo.

### No-objetivos

- No se precargan tiles del mapa por adelantado (nada de descargar la ring road).
- No se cachean las fotos de Wikimedia Commons (siguen siendo online).
- No se cachea la geocodificación (Nominatim sigue siendo online; su fallo ya
  está gestionado con un toast).
- No se cachean respuestas opacas de terceros.
- No se toca `localStorage` ni el modelo de datos.
- No se introduce build ni dependencias de tooling (nada de Workbox).

## 3. Decisiones (con alternativas descartadas)

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Alcance offline | Solo shell + datos; tiles cache-on-use | Precargar ruta (20-60 MB, riesgo); + fotos Wikimedia |
| Llegada de versiones | Recarga automática inmediata, con guardas | Toast "actualizar"; actualización silenciosa al reabrir |
| Leaflet y fuentes | Vendorizadas en el repo | Cachear el CDN en runtime (respuestas opacas, primer arranque sin ellas) |
| Implementación del SW | `sw.js` a mano, ~150 líneas | Workbox (tooling de build en proyecto sin build); mínimo sin caché de tiles (rompe el mapa offline) |
| Fuentes web | Vendorizar los pesos actuales (opción a) | Eliminarlas y usar el stack de sistema (cambia el aspecto) |

## 4. Archivos y estructura

### Nuevos

- `sw.js` — en la **raíz** del repo (obligatorio para que el scope cubra todo
  `/viaje-islandia/`).
- `vendor/leaflet/` — `leaflet.js`, `leaflet.css` e `images/` (5 PNG:
  `marker-icon.png`, `marker-icon-2x.png`, `marker-shadow.png`, `layers.png`,
  `layers-2x.png`), de Leaflet 1.9.4 sin modificar.
- `vendor/fonts/` — `fonts.css` con los `@font-face` + los `.woff2`:
  - Space Grotesk 500 / 600 / 700
  - Inter 400 / 500 / 600 / 700
  - IBM Plex Mono 400 / 500
  - woff2, subconjunto latino, `font-display: swap`
  - ~12 archivos, ~200-350 KB en total

### Modificados

- `index.html`:
  - Quitar los 3 `<link>` de Google Fonts (2 `preconnect` + 1 `stylesheet`) →
    `<link rel="stylesheet" href="vendor/fonts/fonts.css">`.
  - Quitar el `<link>` y el `<script>` de unpkg de Leaflet (con sus `integrity` y
    `crossorigin`) → rutas locales `vendor/leaflet/leaflet.css` y
    `vendor/leaflet/leaflet.js`.
  - Subir `?v=12` → `?v=13` en `style.css` y `app.js`.
- `app.js` — bloque nuevo de registro + actualización/recarga, ~40-50 líneas en
  su propio IIFE al final del archivo.
- `README.md` — quitar "PWA (sin modo offline)" y "Sin service worker";
  documentar el comportamiento offline y cómo forzar una recarga.
- `tokens.css` — sin cambios y **fuera del precache** (no lo usa la app).

## 5. Cachés y estrategia de `fetch` (en `sw.js`)

### Cachés (nombres versionados)

- **`shell-v13`** — precache en `install`. Lista explícita:
  - `./` y `./index.html`
  - `./style.css?v=13` y `./app.js?v=13` (con el query, para casar con lo que
    pide `index.html`)
  - `./manifest.json`
  - `./icons/icon-192.png`, `./icons/icon-512.png`,
    `./icons/icon-maskable-512.png`, `./icons/apple-touch-icon.png`,
    `./icons/icon.svg`
  - `./vendor/leaflet/leaflet.js`, `./vendor/leaflet/leaflet.css`,
    `./vendor/leaflet/images/marker-icon.png`,
    `./vendor/leaflet/images/marker-icon-2x.png`,
    `./vendor/leaflet/images/marker-shadow.png`,
    `./vendor/leaflet/images/layers.png`,
    `./vendor/leaflet/images/layers-2x.png`
  - `./vendor/fonts/fonts.css` + cada `.woff2`
- **`tiles-v1`** — runtime, cache-on-use. Solo peticiones a
  `*.tile.openstreetmap.org`. Tope ~300 entradas; al superarlo, se borran las más
  antiguas (orden de `cache.keys()`). **Versión propia e independiente** del
  shell: no se purga en cada release; solo si se sube el `-v1` a mano.

### Router de `fetch`

1. **No-GET** → no se intercepta (pasa a la red).
2. **Navegación** (`request.mode === 'navigate'`) → **cache-first** contra
   `./index.html`. Nunca espera a la red → arranque offline instantáneo. La
   frescura la garantiza el ciclo de actualización (sección 6), no el `fetch`.
3. **Shell mismo-origen** (coincide con una entrada del precache, con o sin
   `?v=`) → **cache-first**, con fallback a red. No re-cachea en runtime; el
   precache se renueva solo en el `install` del siguiente release.
4. **Tiles de OSM** → **cache-first** contra `tiles-v1`. Si falta y hay red: se
   descarga, se clona a la caché (con recorte de tamaño) y se responde. Si falta
   y no hay red: se responde un PNG transparente 1×1 para que Leaflet no rompa.
   El `cache.put` va en `try/catch`: si falla (quota), se responde el tile de red
   sin cachear.
5. **Nominatim / Wikimedia Commons / cualquier otro cross-origin** → **solo
   red**, sin caché ni fallback. Si falla, la app ya lo gestiona.

### Sutileza del `?v=`

`index.html` pide `app.js?v=13`; el precache guarda esa URL exacta. Tras un
release a `?v=14`, el `index.html` nuevo (ya servido por el SW nuevo) pedirá
`?v=14`, y el `install` del SW nuevo lo habrá precacheado. Coherente en cada
versión.

## 6. Ciclo de vida y actualización

### En `sw.js`

- **`install`** → `event.waitUntil(cache.addAll(<lista shell>))`. **No** llama a
  `skipWaiting()` por su cuenta: espera a que la página se lo pida.
- **`message`** → al recibir `{ type: 'SKIP_WAITING' }`, llama a
  `self.skipWaiting()`.
- **`activate`** → `event.waitUntil(...)`: borra toda caché cuyo nombre no esté
  en la lista permitida (`shell-v13`, `tiles-v1`); luego `self.clients.claim()`.
- **`fetch`** → el router de la sección 5.

### En `app.js` (IIFE de registro)

1. `if ('serviceWorker' in navigator)` → en el evento `load`,
   `navigator.serviceWorker.register('sw.js')`. Si rechaza: `catch` con
   `console.warn`, la app sigue online, sin error visible.
2. `reg.update()` al arrancar, y también cuando la app vuelve a primer plano tras
   estar oculta (`visibilitychange` → visible, throttle 15 min), para que un fix
   llegue sin cerrar del todo la PWA.
3. `reg.addEventListener('updatefound', ...)` → sobre `reg.installing`, escuchar
   `statechange`. Cuando llega a `installed` **y**
   `navigator.serviceWorker.controller` no es `null` (es una actualización, no la
   primera instalación) → marcar `pendingUpdate = true` e intentar aplicar.
4. **`isSafeToReload()`** → `true` si `#sheet` y `#confirm` están ambos `hidden`.
   - Si es seguro → `postMessage({ type: 'SKIP_WAITING' })` al worker en espera
     (`reg.waiting`).
   - Si no → reintentar cuando: se cierre el sheet, la app vuelva a primer plano,
     o pase un intervalo corto (p. ej. 2 s).
5. `navigator.serviceWorker.addEventListener('controllerchange', ...)` →
   `location.reload()` **una sola vez** (booleano `reloaded` en el módulo).

### Anti-bucle

Justo antes de recargar: `sessionStorage['sw-reload-at'] = String(Date.now())`.
Al cargar, si se va a recargar otra vez y `Date.now() - sw-reload-at < 10000`,
**no recargar**: queda servida la versión nueva igualmente y un `console.warn`.
`sessionStorage` se limpia al cerrar la PWA → la siguiente sesión vuelve a
intentarlo. Así una versión rota no deja la app en un ciclo de refrescos.

### Primera instalación

`installed` con `navigator.serviceWorker.controller === null` → no se recarga
nada: la página ya es la última. El SW toma el control en la siguiente
navegación.

## 7. Errores y casos límite

- **Falla el precache** (asset 404 / sin red en `install`): `cache.addAll` es
  atómico → el SW no se instala; se reintenta en la siguiente carga. Correcto:
  mejor sin SW que a medias. Antes de publicar, verificar que todas las URLs de
  la lista responden 200.
- **Quota llena** al guardar un tile: `cache.put` en `try/catch`; si falla, se
  responde el tile de red sin cachear. Una escritura fallida nunca rompe la
  respuesta. El recorte a ~300 entradas mantiene `tiles-v1` acotado (~15-30 MB).
- **SW no soportado / incógnito**: `if ('serviceWorker' in navigator)` lo cubre;
  la app funciona como hoy, online. `?v=13` sigue de red de seguridad de
  cache-busting.
- **iOS standalone**: SW OK desde iOS 11.3. Safari puede expulsar el SW tras
  semanas sin uso → al reabrir con red se re-registra y re-precachea. Aceptable
  para el patrón de uso (antes y durante el viaje).
- **`./` vs `./index.html`**: GitHub Pages sirve lo mismo en ambas; se
  precachean las dos y la navegación resuelve contra `./index.html` (casa con
  `start_url`).
- **Leaflet sin SRI**: al vendorizar se pierde la comprobación de integridad.
  Mitigación: fichero clavado a 1.9.4, sin modificar, con el cambio visible en
  git.
- **`register()` rechaza**: `catch` + `console.warn`; la app sigue online, sin
  error visible al usuario.
- **Borrado de datos del sitio**: se lleva caché + `localStorage`, igual que hoy.
  El SW no toca `localStorage`.
- **Política de uso de tiles de OSM**: cache-on-use con tope no supone descarga
  masiva; el volumen de peticiones no cambia respecto a hoy.

## 8. Pruebas y verificación

Sin framework de test y sin build → checklist manual, servida por `http.server`
local y en el deploy de GitHub Pages.

1. **Carga online** → DevTools > Application: SW activo; Cache Storage `shell-v13`
   con todos los assets de la lista; consola sin errores.
2. **Offline (DevTools > Network > Offline) + recarga** → la app arranca; se ven
   Datos, Itinerario, Ideas, Ruta y Emergencias; fuentes y estilos correctos;
   Leaflet carga.
3. **Mapa offline** → día ya visto online: tiles presentes. Día nuevo: pines y
   trazado sobre gris, sin romper.
4. **Geocodificar offline** → toast de error controlado (comportamiento actual).
5. **Ciclo de actualización** → publicar `?v=14` + cambio en `sw.js`
   (`shell-v14`), desplegar, reabrir la app → se detecta; con el sheet cerrado,
   se recarga una vez y aparece el cambio; `shell-v13` borrada, `tiles-v1`
   intacta.
6. **Guarda `isSafeToReload`** → repetir el paso 5 con el bottom-sheet abierto →
   no recarga hasta cerrarlo.
7. **Anti-bucle** → forzar dos `controllerchange` seguidos → una sola recarga; un
   segundo intento en < 10 s se omite con `console.warn`.
8. **Lighthouse PWA** → "installable" y checks de PWA en verde.
9. **iPhone real** → añadir a pantalla de inicio, modo avión, abrir → funciona;
   reconectar y forzar update → llega.

## 9. Impacto en el README

- Cabecera: "PWA (sin modo offline)" → "PWA con modo offline".
- Sección de estructura: añadir `sw.js` y `vendor/`.
- Quitar "Sin service worker. Leaflet se carga por CDN." → "Service worker para
  uso sin conexión. Leaflet y fuentes incluidos en el repo."
- Añadir nota: cómo se actualiza (recarga automática) y que "borrar datos del
  sitio" limpia también la caché.
