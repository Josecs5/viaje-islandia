# Clima · A1 — Luz y luna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una sección nueva "Clima" que muestra, para cada día del viaje, salida/puesta de sol, duración y delta de luz, hora dorada AM/PM, ventana de oscuridad astronómica y fase/salida/puesta de luna — calculado localmente con SunCalc, sin API, funcionando offline; y reubicar la pestaña "Ruta" (su tarjeta de Google Maps pasa al final de "Mapas").

**Architecture:** SunCalc 1.9.0 se vendoriza en `vendor/suncalc/` y se carga con un `<script defer>` (patrón ya usado para Leaflet y las fuentes). En `app.js`, funciones puras (`locForDate`, `sky`) calculan los datos de cada día a partir de `state.meta` y `state.alojamientos` — sin almacenamiento, se recalcula en cada render. `renderClima()` pinta una tarjeta `.card` por día en `#screen-clima`. La 5ª pestaña deja de ser "Ruta"; su `.ruta-card` se mueve verbatim dentro de `#screen-mapas`. Es un release nuevo del service worker (`shell-v14`).

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. SunCalc 1.9.0 (astronomía). Service Worker (modo offline ya existente). Verificación manual con DevTools servida por `python -m http.server`, cotejo de números contra timeanddate.com.

**Spec:** `docs/superpowers/specs/2026-09-10-clima-a1-luz-y-luna-design.md`

## Global Constraints

- Vanilla JS, sin build, sin dependencias de tooling. Estilo del repo: IIFE, `'use strict'`, comentarios en español, copy de UI en español.
- **Ninguna API externa.** Todo es cálculo local (lat/lng/fecha). Funciona offline.
- **Sin `localStorage`** para esta feature: se recalcula en cada `renderClima()`.
- **No se toca** `buildItinerary()` ni el motor de itinerario.
- SunCalc clavado a **1.9.0**, vendorizado **sin modificar** en `vendor/suncalc/suncalc.js`.
- Pestaña: nombre exacto **"Clima"**, `data-tab="clima"`, `id="screen-clima"`, `id="clima-body"`, función `renderClima()`.
- Release: `?v=13` → **`?v=14`** en `index.html` (style.css y app.js) y en la lista `SHELL_ASSETS` de `sw.js`, **a la vez**. `sw.js`: `SHELL_CACHE` `'shell-v13'` → **`'shell-v14'`**. `TILE_CACHE` (`'tiles-v2'`) **sin cambios**.
- La `.ruta-card` se mueve **verbatim** dentro de `#screen-mapas`, justo tras `<ol id="map-legend">`, envuelta en `<div class="map-route"><h3>Recorrido completo en Google Maps</h3> … </div>`.
- `<section id="screen-ruta">` se elimina. En `app.js`, `SCREENS` cambia `'ruta'` → `'clima'`. `RUTA_URL`, el handler `on('#ruta-copy', …)` y el `<a id="ruta-open">` **no cambian** (el elemento se mueve, no se borra).
- Fallback de ubicación: `{ lat: 64.9, lng: -18.6, label: 'centro de Islandia' }`.
- Ubicación de un día = alojamiento cuya estancia cubre esa noche (`checkin <= ymd < checkout`, con `loc.lat`/`loc.lng`); si no, retroceder noche a noche; si nada, centro de Islandia.
- La fecha del día se fija a **mediodía local** — `parseDate(ymd)` (helper existente) ya devuelve `new Date(y, m-1, d, 12, 0, 0, 0)`.
- Nombre de fase de luna: tabla exacta del spec §5 (rangos de `phase` de SunCalc: `<0.02`|`>=0.98` nueva; `0.02–0.24` Creciente; `0.24–0.26` Cuarto creciente; `0.26–0.48` Gibosa creciente; `0.48–0.52` Luna llena; `0.52–0.74` Gibosa menguante; `0.74–0.76` Cuarto menguante; `0.76–0.98` Menguante).
- `inDarkWindow`: altitud de la luna en inicio, medio y fin de la ventana → las tres `>0` = `'sí'`; una o dos = `'a medias'`; ninguna = `'no'`; `null` si `darkWindow` es `null`.
- Horas formateadas `HH:MM` locales; `null` o `Invalid Date` → `—`.
- El **delta de luz se muestra todos los días**, incluido el primero (comparado con la víspera).
- Commits: uno por tarea, mensaje en español, sin líneas de atribución.

---

## Estructura de archivos

| Archivo | Se crea/modifica | Responsabilidad |
|---|---|---|
| `vendor/suncalc/suncalc.js` | Crear | Copia sin modificar de SunCalc 1.9.0 (sol, crepúsculos, luna). |
| `index.html` | Modificar | Pestaña 5 "Ruta"→"Clima"; borrar `#screen-ruta`; mover `.ruta-card` a `#screen-mapas`; añadir `#screen-clima`; `<script>` de SunCalc; `?v=14`. |
| `sw.js` | Modificar | `shell-v14`; añadir `suncalc.js` al precache; `?v=14` en la lista. |
| `app.js` | Modificar | `SCREENS`: `'ruta'`→`'clima'`; funciones `locForDate`/`moonPhaseName`/`sky`/`hhmm`; `renderClima()`; engancharla en `renderAll()`; `climaScrolled`. |
| `style.css` | Modificar | `.map-route` (separador); tarjetas y líneas de `#screen-clima`; `?v`. |
| `README.md` | Modificar | Fila de estructura; nota de que "Ruta" vive en "Mapas". |

Orden: **1** (SunCalc + release) → **2** (reestructura de navegación, entregable: nav nueva + sección "Clima" vacía) → **3** (funciones de astronomía, probables por consola) → **4** (`renderClima()` + estilos + README).

---

### Task 1: Vendorizar SunCalc y subir la versión de release

**Files:**
- Create: `vendor/suncalc/suncalc.js`
- Modify: `index.html` (bloque de `<script>` al final del `<body>`; línea del `<link>` de `style.css`), `sw.js` (`SHELL_CACHE`, `SHELL_ASSETS`)
- Test: verificación manual en navegador (DevTools)

**Interfaces:**
- Consumes: nada.
- Produces: variable global `window.SunCalc` disponible en el ámbito de `app.js`, con métodos `getTimes(date, lat, lng)`, `getMoonIllumination(date)`, `getMoonTimes(date, lat, lng)`, `getMoonPosition(date, lat, lng)`. `sw.js` sirviendo `SHELL_CACHE = 'shell-v14'` con `./vendor/suncalc/suncalc.js` en el precache.

- [ ] **Step 1: Descargar SunCalc 1.9.0**

Desde la raíz del repo, en PowerShell:

```powershell
New-Item -ItemType Directory -Force vendor/suncalc | Out-Null
curl.exe -sL "https://unpkg.com/suncalc@1.9.0/suncalc.js" -o "vendor/suncalc/suncalc.js"
Get-Item vendor/suncalc/suncalc.js | Select-Object Name, Length
```
Expected: `suncalc.js` de ~6–8 KB, no 0 bytes.

- [ ] **Step 2: Comprobar que es el UMD esperado**

Run:
```powershell
Select-String -Path vendor/suncalc/suncalc.js -Pattern "SunCalc|getMoonTimes|getTimes" | Select-Object -First 5
```
Expected: aparecen `SunCalc.getTimes`, `SunCalc.getMoonIllumination`, `SunCalc.getMoonTimes`, `SunCalc.getMoonPosition`, y al final un bloque que asigna a `window.SunCalc` cuando no hay `module`/`define`.

- [ ] **Step 3: Añadir el `<script>` a `index.html`**

En `index.html`, en el bloque de scripts al final del `<body>`, dejar:
```html
  <script src="vendor/leaflet/leaflet.js" defer></script>
  <script src="vendor/suncalc/suncalc.js" defer></script>
  <script src="app.js?v=14" defer></script>
```
(es decir: añadir la línea de `suncalc.js` entre Leaflet y `app.js`, y en la misma edición cambiar `app.js?v=13` → `app.js?v=14`).

- [ ] **Step 4: Subir la versión de `style.css` en `index.html`**

En `index.html`, la línea `<link rel="stylesheet" href="style.css?v=13">` → `href="style.css?v=14"`.

- [ ] **Step 5: Actualizar `sw.js`**

En `sw.js`:
- `const SHELL_CACHE = 'shell-v13';` → `'shell-v14'`.
- En `SHELL_ASSETS`: `'./style.css?v=13'` → `'./style.css?v=14'`; `'./app.js?v=13'` → `'./app.js?v=14'`.
- En `SHELL_ASSETS`, tras `'./vendor/leaflet/leaflet.js',` añadir `'./vendor/suncalc/suncalc.js',`.

- [ ] **Step 6: Verificar SunCalc y el nuevo precache (online)**

Run:
```powershell
python -m http.server 8000
```
En un navegador limpio (DevTools > Application > Service Workers > Unregister; borrar Cache Storage), abrir `http://localhost:8000/` y recargar. En la consola de DevTools:
```js
typeof SunCalc
SunCalc.getTimes(new Date(2026,9,9,12,0,0), 64.1466, -21.9426).sunrise
SunCalc.getMoonIllumination(new Date(2026,9,9)).fraction
```
Expected:
- `"object"` para `typeof SunCalc`.
- `.sunrise` es un `Date` válido (mañana del 9 oct, hora ~08:xx).
- `.fraction` es un número entre 0 y 1.
- DevTools > Application > Cache Storage: `shell-v14` con **28 entradas** (las 27 anteriores + `./vendor/suncalc/suncalc.js`). `tiles-v2` intacta.
- Sin errores en consola. Sin peticiones a unpkg/CDN.

- [ ] **Step 7: Verificar el ciclo de actualización desde `shell-v13`**

Con una pestaña ya cargada y controlada por un SW `shell-v13` (si no lo tienes: hacer `git stash`, cargar, `git stash pop`), volver a cargar la app.
Expected: la app se recarga **una vez**; tras recargar, Cache Storage tiene `shell-v14` (28 entradas) y **no** `shell-v13`; `tiles-v2` sigue. Consola sin errores.

- [ ] **Step 8: Commit**

```powershell
git add vendor/suncalc index.html sw.js
git commit -m "Vendorizar SunCalc 1.9.0 y subir a shell-v14" -q
```

---

### Task 2: Reestructura de navegación — "Ruta" → "Clima" y tarjeta de Ruta a "Mapas"

**Files:**
- Modify: `index.html` (tabbar 5º botón; `<section id="screen-ruta">`; `#screen-mapas`; nueva `<section id="screen-clima">`), `app.js` (`SCREENS`), `style.css` (`.map-route`)
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: pestaña `data-tab="clima"` que muestra `<section id="screen-clima">` con un `<div id="clima-body">` vacío. `#screen-ruta` ya no existe. `.ruta-card` (con `#ruta-open`, `#ruta-copy`, `#ruta-url`) vive dentro de `#screen-mapas`. `SCREENS` en `app.js` = `['datos','itinerario','mapas','reco','clima']`.

- [ ] **Step 1: Renombrar la 5ª pestaña en `index.html`**

En la `<nav class="tabbar">`, el 5º `<button class="tab" data-tab="ruta" …>` pasa a:
```html
    <button class="tab" data-tab="clima" type="button" aria-current="false">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="9" r="3.2"/><path d="M8 2.5v1.6M8 13.9v1.6M2.5 9h1.6M11.9 9h1.6M4.1 5.1l1.1 1.1M10.8 11.8l1.1 1.1M11.9 5.1l-1.1 1.1M5.2 11.8l-1.1 1.1"/><path d="M20.5 14.5a5 5 0 0 1-6.4-6.1 5.4 5.4 0 1 0 6.4 6.1Z"/></svg>
      <span>Clima</span>
    </button>
```
(sol pequeño arriba-izquierda + luna creciente abajo-derecha; mismo estilo de trazo que los otros iconos).

- [ ] **Step 2: Eliminar `<section id="screen-ruta">` y guardar su `.ruta-card`**

En `index.html`, localizar el bloque completo:
```html
    <!-- ============ RUTA GOOGLE MAPS ============ -->
    <section class="screen" id="screen-ruta" data-screen="ruta" hidden>
      <div class="screen-head">
        <h2>Ruta Google Maps</h2>
        <p class="muted">El recorrido completo del viaje, ya trazado.</p>
      </div>
      <div class="ruta-card">
        …
      </div>
    </section>
```
Copiar el `<div class="ruta-card"> … </div>` interno (con su SVG decorativo y el `.ruta-card__body` que contiene `#ruta-open`, `#ruta-copy`, `#ruta-url`) y luego **borrar toda la `<section id="screen-ruta">`**.

- [ ] **Step 3: Insertar la `.ruta-card` en `#screen-mapas`**

En `index.html`, dentro de `<section … id="screen-mapas">`, justo después de `<ol id="map-legend" class="legend"></ol>` y antes del cierre `</section>`, insertar:
```html
      <div class="map-route">
        <h3>Recorrido completo en Google Maps</h3>
        <div class="ruta-card">
          <div class="ruta-card__map" aria-hidden="true">
            <svg viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice">
              <defs>
                <pattern id="rutaGrid" width="26" height="26" patternUnits="userSpaceOnUse">
                  <path d="M26 0H0V26" fill="none" stroke="currentColor" stroke-width="1" opacity="0.14"/>
                </pattern>
              </defs>
              <rect width="320" height="190" fill="url(#rutaGrid)"/>
              <path class="ruta-line" d="M26 150 C 74 54, 128 34, 168 92 S 256 168, 296 52"
                    fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 11"/>
              <circle class="ruta-pin" cx="26" cy="150" r="7"/>
              <circle class="ruta-pin" cx="296" cy="52" r="7"/>
            </svg>
          </div>
          <div class="ruta-card__body">
            <p class="ruta-card__title">Ruta del viaje por Islandia</p>
            <p class="ruta-card__sub">Ábrela en Google Maps para navegar con todas las paradas del recorrido.</p>
            <a class="btn btn--accent btn--block ruta-open" id="ruta-open"
               href="https://maps.app.goo.gl/co4RMxLFR9xbP5eX7" target="_blank" rel="noopener">Abrir en Google Maps</a>
            <button class="btn btn--ghost btn--block" id="ruta-copy" type="button">Copiar enlace</button>
            <p class="ruta-card__link" id="ruta-url">maps.app.goo.gl/co4RMxLFR9xbP5eX7</p>
          </div>
        </div>
      </div>
```

- [ ] **Step 4: Añadir la sección `#screen-clima` (vacía) a `index.html`**

En `<main>`, tras el cierre de `<section … id="screen-mapas">` (donde estaba `#screen-ruta`), insertar:
```html
    <!-- ============ CLIMA ============ -->
    <section class="screen" id="screen-clima" data-screen="clima" hidden>
      <div class="screen-head">
        <h2>Clima</h2>
        <p class="muted">Luz y luna de cada día. Meteo, auroras y carreteras llegarán aquí.</p>
      </div>
      <div id="clima-body"></div>
    </section>
```

- [ ] **Step 5: Actualizar `SCREENS` en `app.js`**

En `app.js`, la línea:
```js
  const SCREENS = ['datos', 'itinerario', 'mapas', 'reco', 'ruta'];
```
→
```js
  const SCREENS = ['datos', 'itinerario', 'mapas', 'reco', 'clima'];
```
No se toca nada más de la navegación (los listeners son genéricos por `data-tab`). El handler `on('#ruta-copy', …)` y `RUTA_URL` se quedan como están: el elemento sigue existiendo, movido.

- [ ] **Step 6: Añadir estilos de `.map-route` a `style.css`**

En `style.css`, junto a las reglas de la sección de mapas, añadir:
```css
.map-route {
  margin-top: var(--space-24, 24px);
  padding-top: var(--space-16, 16px);
  border-top: 1px solid var(--c-border, #2a2f37);
}
.map-route h3 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--step-1, 1.05rem);
  margin: 0 0 var(--space-12, 12px);
}
```
(Si esos tokens no existen con ese nombre exacto, usar los que el resto de `style.css` ya usa para separadores y sub-títulos; comprobar con `Select-String -Path style.css -Pattern "--c-border|--space-24|--step-1"`.)

- [ ] **Step 7: Verificar la reestructura**

Run:
```powershell
python -m http.server 8000
```
Abrir `http://localhost:8000/`, forzar la versión nueva del SW (Unregister + recargar dos veces, o skipWaiting).
Expected:
- La barra inferior tiene 5 pestañas y la 5ª dice **"Clima"** con un icono sol+luna. No hay "Ruta".
- Al tocar "Clima" se abre una pantalla con el título "Clima", el subtítulo, y nada más (cuerpo vacío).
- En **Mapas**, bajo la leyenda numerada, aparece **"Recorrido completo en Google Maps"** y la tarjeta: el recuadro decorativo con la línea de puntos y dos pines se ve; **"Abrir en Google Maps"** abre `https://maps.app.goo.gl/co4RMxLFR9xbP5eX7` en pestaña nueva; **"Copiar enlace"** muestra el toast "Enlace copiado.".
- En la URL, poner `#ruta` a mano y recargar → la app abre en **"Datos"** sin romper.
- DevTools > Console sin errores.
- `document.getElementById('screen-ruta')` en consola → `null`.

- [ ] **Step 8: Commit**

```powershell
git add index.html app.js style.css
git commit -m "Nav: pestana Ruta -> Clima; la ruta de Google Maps pasa a Mapas" -q
```

---

### Task 3: Funciones de astronomía (`locForDate`, `moonPhaseName`, `sky`, `hhmm`)

**Files:**
- Modify: `app.js` (bloque nuevo de funciones, antes de `renderAll`)
- Test: verificación manual por consola de DevTools (cotejo contra timeanddate.com)

**Interfaces:**
- Consumes: de la Task 1 — `window.SunCalc`. Helpers existentes de `app.js`: `parseDate(ymd)` (→ `Date` a mediodía local), `ymd(date)` (→ `'YYYY-MM-DD'`), `eachDay(a,b)`, `pad2(n)`, `state.meta`, `state.alojamientos`.
- Produces (todas en el IIFE de `app.js`, accesibles desde `renderClima` de la Task 4):
  - `ICE_CENTER` = `{ lat: 64.9, lng: -18.6, label: 'centro de Islandia' }`.
  - `locForDate(ymd: string) -> { lat: number, lng: number, label: string }`.
  - `moonPhaseName(phase: number) -> string`.
  - `hhmm(d: Date|null) -> string` (`'HH:MM'` o `'—'`).
  - `sky(ymd: string) -> objeto del día` con la forma del spec §5:
    `{ date, locLabel, sunrise, sunset, dayLengthMin, deltaVsPrevMin, goldenAM:{start,end}, goldenPM:{start,end}, darkWindow:{start,end}|null, moon:{ phaseName, illumPct, rise, set, alwaysUp, alwaysDown, inDarkWindow } }`.

- [ ] **Step 1: Escribir el bloque de funciones**

En `app.js`, justo antes de `function renderAll() {`, añadir:

```js
  /* ==========================================================
     Clima · A1 — Luz y luna (cálculo local con SunCalc)
     ========================================================== */
  const ICE_CENTER = { lat: 64.9, lng: -18.6, label: 'centro de Islandia' };
  const isDate = d => d instanceof Date && !isNaN(d.getTime());

  // Ubicación de un día = alojamiento donde se duerme esa noche; si no, la
  // noche anterior; si nada, el centro de Islandia.
  function locForDate(ymd) {
    let d = ymd;
    for (let i = 0; i < 40; i++) {
      const a = state.alojamientos.find(x =>
        x.checkin && x.checkout && x.checkin <= d && d < x.checkout &&
        x.loc && x.loc.lat != null && x.loc.lng != null);
      if (a) return { lat: a.loc.lat, lng: a.loc.lng, label: a.nombre || 'Alojamiento' };
      const dt = parseDate(d);
      if (!dt) break;
      dt.setDate(dt.getDate() - 1);
      d = ymd(dt);
      if (state.meta.fechaInicio && d < state.meta.fechaInicio) break;
    }
    return { lat: ICE_CENTER.lat, lng: ICE_CENTER.lng, label: ICE_CENTER.label };
  }

  function moonPhaseName(p) {
    if (p < 0.02 || p >= 0.98) return 'Luna nueva';
    if (p < 0.24) return 'Creciente';
    if (p < 0.26) return 'Cuarto creciente';
    if (p < 0.48) return 'Gibosa creciente';
    if (p < 0.52) return 'Luna llena';
    if (p < 0.74) return 'Gibosa menguante';
    if (p < 0.76) return 'Cuarto menguante';
    return 'Menguante';
  }

  const hhmm = d => (isDate(d) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '—');

  function dayLenMin(dateNoon, loc) {
    const t = SunCalc.getTimes(dateNoon, loc.lat, loc.lng);
    if (!isDate(t.sunrise) || !isDate(t.sunset)) return null;
    return Math.round((t.sunset - t.sunrise) / 60000);
  }

  function moonInDarkWindow(win, loc) {
    if (!win) return null;
    const pts = [win.start.getTime(), (win.start.getTime() + win.end.getTime()) / 2, win.end.getTime()];
    const up = pts.filter(ms =>
      SunCalc.getMoonPosition(new Date(ms), loc.lat, loc.lng).altitude > 0).length;
    return up === 3 ? 'sí' : up === 0 ? 'no' : 'a medias';
  }

  function sky(ymd) {
    const loc = locForDate(ymd);
    const noon = parseDate(ymd);
    const prev = parseDate(ymd); prev.setDate(prev.getDate() - 1);
    const next = parseDate(ymd); next.setDate(next.getDate() + 1);

    const t = SunCalc.getTimes(noon, loc.lat, loc.lng);
    const tNext = SunCalc.getTimes(next, loc.lat, loc.lng);

    const todayLen = dayLenMin(noon, loc);
    const prevLen = dayLenMin(prev, loc);

    const darkWindow = (isDate(t.night) && isDate(tNext.nightEnd))
      ? { start: t.night, end: tNext.nightEnd } : null;

    const mi = SunCalc.getMoonIllumination(noon);
    const mt = SunCalc.getMoonTimes(noon, loc.lat, loc.lng);

    return {
      date: ymd,
      locLabel: loc.label,
      sunrise: isDate(t.sunrise) ? t.sunrise : null,
      sunset: isDate(t.sunset) ? t.sunset : null,
      dayLengthMin: todayLen,
      deltaVsPrevMin: (todayLen != null && prevLen != null) ? todayLen - prevLen : null,
      goldenAM: { start: isDate(t.sunrise) ? t.sunrise : null, end: isDate(t.goldenHourEnd) ? t.goldenHourEnd : null },
      goldenPM: { start: isDate(t.goldenHour) ? t.goldenHour : null, end: isDate(t.sunset) ? t.sunset : null },
      darkWindow,
      moon: {
        phaseName: moonPhaseName(mi.phase),
        illumPct: Math.round(mi.fraction * 100),
        rise: mt.rise || null,
        set: mt.set || null,
        alwaysUp: !!mt.alwaysUp,
        alwaysDown: !!mt.alwaysDown,
        inDarkWindow: moonInDarkWindow(darkWindow, loc)
      }
    };
  }
```

- [ ] **Step 2: Verificar `sky()` contra timeanddate.com**

Run:
```powershell
python -m http.server 8000
```
Abrir la app, y en la consola de DevTools (las funciones están en el IIFE, así que exponerlas temporalmente para probar: no se puede llamarlas directamente). En su lugar, pegar en consola una réplica mínima usando `SunCalc` directamente para cotejar, y confiar en la verificación visual de la Task 4 para `sky()` end-to-end. Comprobación directa:
```js
const loc = { lat: 64.1466, lng: -21.9426 }; // Reikiavik
const t = SunCalc.getTimes(new Date(2026,9,10,12), loc.lat, loc.lng);
[t.sunrise.toTimeString().slice(0,5), t.sunset.toTimeString().slice(0,5)]
```
Expected: comparar con timeanddate.com/sun/iceland/reykjavik para el **10 oct 2026** → salida y puesta dentro de **±3 min**. Repetir con Vík (`63.4186, -19.0060`) y Akureyri (`65.6835, -18.1002`) para otras dos fechas del viaje.
```js
SunCalc.getMoonIllumination(new Date(2026,9,10)).phase
```
Expected: comparar la fase con timeanddate.com/moon/phases → el nombre que daría `moonPhaseName()` coincide con la fase real de esa fecha.

- [ ] **Step 3: Verificar el fallback de ubicación y los bordes de luna**

En consola:
```js
// alojamientos sembrados: a2 Vík 09→10 oct, a5 Húsavík 12→13 oct
SunCalc.getMoonTimes(new Date(2026,9,12,12), 66.045, -17.338)
```
Expected: el objeto trae `rise` **o** `set` (o ambos); si falta uno, es `undefined` (lo que `sky()` convierte a `null`). Localizar recorriendo `for (let d=8; d<=16; d++) console.log(d, SunCalc.getMoonTimes(new Date(2026,9,d,12), 64.1,-21.9))` un día del rango 8–16 oct donde falte `rise` o `set`, y anotarlo para la verificación visual de la Task 4 (Step 6 de la Task 4).

- [ ] **Step 4: Commit**

```powershell
git add app.js
git commit -m "Clima A1: funciones de calculo de luz y luna (SunCalc)" -q
```

---

### Task 4: `renderClima()`, estilos y README

**Files:**
- Modify: `app.js` (`renderClima()`; `climaScrolled`; llamada en `renderAll()`), `style.css` (tarjetas de `#screen-clima`), `README.md`
- Test: verificación manual en navegador (checklist del spec §8)

**Interfaces:**
- Consumes: de la Task 3 — `sky(ymd)`, `hhmm(d)`. Helpers existentes: `eachDay(a,b)`, `fmtDiaSemana(ymd)`, `fmtFecha(ymd)`, `cap(s)`, `fmtDur(min)`, `hoyYMD()`, `notice(msg)` (devuelve un nodo de aviso), `esc(s)`, `el(tag, cls)`.
- Produces: `renderClima()` pintando `#clima-body`; llamada añadida en `renderAll()`; variable `climaScrolled` en el bloque de flags `*Init`.

- [ ] **Step 1: Añadir `climaScrolled` al bloque de flags**

En `app.js`, la línea:
```js
  let itinDayInit = false, mapDayInit = false;
```
→
```js
  let itinDayInit = false, mapDayInit = false, climaScrolled = false;
```

- [ ] **Step 2: Escribir `renderClima()`**

En `app.js`, tras el bloque de funciones de la Task 3 y antes de `renderAll`, añadir:

```js
  function skyLine(icon, html) {
    const p = el('p', 'sky-line');
    p.innerHTML = `<span class="sky-ic">${icon}</span>${html}`;
    return p;
  }

  function climaCard(s) {
    const c = el('section', 'card sky-card');
    if (s.date === hoyYMD()) c.classList.add('day--hoy');

    const head = el('div', 'sky-card__head');
    head.textContent = `${cap(fmtDiaSemana(s.date))}, ${fmtFecha(s.date)} · ${s.locLabel}`;
    c.appendChild(head);

    // Sol
    let sol = `${hhmm(s.sunrise)} – ${hhmm(s.sunset)}`;
    if (s.dayLengthMin != null) sol += `  ·  ${fmtDur(s.dayLengthMin)}`;
    if (s.deltaVsPrevMin != null) {
      const d = s.deltaVsPrevMin;
      const cls = d > 0 ? 'sky-delta sky-delta--up' : 'sky-delta';
      sol += `  ·  <span class="${cls}">${d > 0 ? '+' : '−'}${Math.abs(d)} min</span>`;
    }
    c.appendChild(skyLine('☀️', sol));

    // Hora dorada
    if (isDate(s.goldenAM.start) && isDate(s.goldenAM.end) && isDate(s.goldenPM.start) && isDate(s.goldenPM.end)) {
      c.appendChild(skyLine('📸',
        `dorada  ${hhmm(s.goldenAM.start)}–${hhmm(s.goldenAM.end)}   ·   ${hhmm(s.goldenPM.start)}–${hhmm(s.goldenPM.end)}`));
    }

    // Ventana de oscuridad
    if (s.darkWindow) {
      c.appendChild(skyLine('🌑', `oscuridad  ${hhmm(s.darkWindow.start)} – ${hhmm(s.darkWindow.end)}`));
    }

    // Luna
    let luna = `${esc(s.moon.phaseName)} ${s.moon.illumPct}%`;
    if (s.moon.alwaysUp) {
      luna += '  ·  sobre el horizonte toda la noche';
    } else if (s.moon.alwaysDown) {
      luna += '  ·  no sale';
    } else {
      if (s.moon.rise) luna += `  ·  sale ${hhmm(s.moon.rise)}`;
      if (s.moon.set) luna += `  ·  se pone ${hhmm(s.moon.set)}`;
    }
    c.appendChild(skyLine('🌙', luna));

    if (s.moon.inDarkWindow) {
      const p = el('p', 'sky-line sky-line--sub');
      const cls = s.moon.inDarkWindow === 'no' ? 'is-dim' : '';
      p.innerHTML = `<span class="sky-ic"></span><span class="${cls}">en la ventana oscura: ${esc(s.moon.inDarkWindow)}</span>`;
      c.appendChild(p);
    }

    return c;
  }

  function renderClima() {
    const body = $('#clima-body');
    if (!body) return;
    body.innerHTML = '';

    if (!state.meta.fechaInicio || !state.meta.fechaFin) {
      body.appendChild(notice('Añade las fechas de inicio y fin en «Datos del viaje» para ver la luz y la luna de cada día.'));
      return;
    }
    if (typeof SunCalc === 'undefined') {
      body.appendChild(notice('No se pudo cargar el cálculo de sol y luna. Recarga la app.'));
      return;
    }

    const days = eachDay(state.meta.fechaInicio, state.meta.fechaFin);
    let todayCard = null;
    days.forEach(ymd => {
      const card = climaCard(sky(ymd));
      if (ymd === hoyYMD()) todayCard = card;
      body.appendChild(card);
    });

    if (todayCard && !climaScrolled) {
      climaScrolled = true;
      setTimeout(() => todayCard.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
    }
  }
```

*(Nota: si `notice` no existe con esa firma, usar el mismo patrón que `renderItinerario` para el aviso de "sin fechas" — comprobar en `app.js` cómo lo hace esa función y replicarlo.)*

- [ ] **Step 3: Enganchar `renderClima()` en `renderAll()`**

En `app.js`, `function renderAll()`:
```js
  function renderAll() {
    paintAppbar();
    renderDatos();
    renderItinerario();
    renderMapas();
    renderReco();
    renderClima();
  }
```

- [ ] **Step 4: Estilos de `#screen-clima` en `style.css`**

En `style.css`, junto a los estilos de las otras secciones:
```css
.sky-card { margin-bottom: var(--space-12, 12px); }
.sky-card__head {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--step-1, 1.05rem);
  margin-bottom: var(--space-8, 8px);
}
.sky-line {
  display: flex;
  gap: var(--space-8, 8px);
  align-items: baseline;
  margin: 2px 0;
  font-size: var(--step-0, 1rem);
  line-height: 1.4;
}
.sky-line--sub { color: var(--c-text-2, #9aa4b2); font-size: var(--step--1, 0.9rem); }
.sky-ic { flex: 0 0 1.4em; text-align: center; }
.sky-delta { color: var(--c-text-2, #9aa4b2); }
.sky-delta--up { color: var(--c-accent, #4ade80); }
.sky-line .is-dim { color: var(--c-text-2, #9aa4b2); }
```
(Si algún token no existe con ese nombre, usar el que `style.css` ya use para texto secundario / acento — `Select-String -Path style.css -Pattern "--c-text-2|--c-accent|--step-0"`.)

- [ ] **Step 5: Actualizar `README.md`**

- En la tabla de "Estructura", la fila de `vendor/` (añadida en el modo offline) menciona también SunCalc: `| vendor/ | Leaflet 1.9.4, SunCalc 1.9.0 y fuentes web servidos desde el repo |`.
- Añadir fila: `| — | La pestaña "Clima" calcula luz y luna de cada día con SunCalc, sin conexión |` (o integrarlo en la descripción de `app.js`).
- En el texto, una línea: `La pestaña "Ruta" dejó de existir; el enlace al recorrido completo en Google Maps está ahora al final de "Mapas".`

- [ ] **Step 6: Verificar la sección "Clima" (checklist del spec §8)**

Run:
```powershell
python -m http.server 8000
```
Con el viaje sembrado (8–16 oct 2026) y el SW en `shell-v14`:

1. La pestaña "Clima" lista **9 tarjetas**, una por día, en orden.
2. Cotejar 2–3 días contra timeanddate.com (Reikiavik, Vík, Akureyri): salida/puesta de sol **±3 min**, duración del día coherente, fase e iluminación de luna correctas.
3. El **delta** es negativo (~4–6 min) y aparece **también el primer día** (8 oct, comparado con el 7).
4. La cabecera de cada tarjeta muestra el alojamiento correcto: día 2 (9 oct) "Vík Cottages", día 5 (12 oct) "Fosshotel Húsavík", día 8 (15 oct) el de esa noche, día 9 (16 oct, check-out + vuelo) usa la ubicación de la noche anterior (etiqueta = ese alojamiento, no "centro de Islandia").
5. En el día anotado en la Task 3 Step 3 (luna sin `rise` o sin `set`), la línea de luna se adapta (omite el trozo que falta) y no muestra "undefined" ni "—" de más.
6. La línea "en la ventana oscura: …" aparece bajo la de luna, atenuada cuando es "no".
7. **Hoy**: cambiar temporalmente `state.meta` en consola a un rango que incluya hoy (`state.meta.fechaInicio='<hoy-2>'; state.meta.fechaFin='<hoy+2>'; renderAll()`), abrir "Clima" → la tarjeta de hoy está resaltada (`day--hoy`) y la sección hace scroll hasta ella. Recargar para restaurar.
8. **Sin fechas**: en Datos (o consola: `state.meta.fechaInicio=''; renderAll()`), "Clima" muestra el aviso "Añade las fechas…". Recargar para restaurar.
9. **Offline**: DevTools > Network > Offline, recargar → "Clima" funciona idéntico (todo es cálculo local; `suncalc.js` está en `shell-v14`). Consola sin errores.
10. `#ruta` en la URL → cae en "Datos".
11. DevTools > Console: sin errores ni warnings en ninguna pantalla.

- [ ] **Step 7: Commit**

```powershell
git add app.js style.css README.md
git commit -m "Clima A1: seccion Luz y luna (renderClima + estilos)" -q
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2 objetivo: sección "Clima", 5º hueco, luz+luna por día | Task 2 (sección) + Task 4 (contenido) |
| §2 objetivo: "Ruta" → tarjeta en "Mapas" | Task 2 Steps 2-3 |
| §2 no-objetivos (sin API, sin localStorage, no tocar buildItinerary, sin tarjeta "hoy" separada, sin hora azul, sin compat de `#ruta`) | Respetado en Tasks 3-4; sin pasos que los contradigan |
| §3 decisiones: pestaña "Clima", ubicación por alojamiento de la noche, detalle recomendado, SunCalc vendorizado | Global Constraints + Task 1 (SunCalc) + Task 3 (`locForDate`, `sky`) |
| §4 nuevos: `vendor/suncalc/suncalc.js`, `#screen-clima` | Task 1 Step 1, Task 2 Step 4 |
| §4 modificados: index.html (pestaña, borrar screen-ruta, mover ruta-card, script, `?v=14`), sw.js (`shell-v14`, precache), app.js (`SCREENS`, funciones, `renderClima`, `renderAll`), style.css, README | Tasks 1, 2, 3, 4 |
| §4 release `?v=13→14` en index.html y SHELL_ASSETS a la vez; `shell-v13→v14`; `tiles-v2` intacta | Task 1 Steps 3-5, verificado en Step 7 |
| §5 `locForDate` con fallback noche anterior → centro de Islandia | Task 3 Step 1 (`locForDate`) |
| §5 `sky(date, loc)` con todas las llamadas SunCalc, `date` a mediodía | Task 3 Step 1 (`sky` usa `parseDate` = mediodía) |
| §5 tabla de fases | Task 3 Step 1 (`moonPhaseName`) — rangos copiados del spec |
| §5 `inDarkWindow` (3 muestras) | Task 3 Step 1 (`moonInDarkWindow`) |
| §5 forma del objeto por día | Task 3 Step 1 (`sky` return) — campos = spec |
| §6 UI: cabecera, sol, dorada, oscuridad, luna, sub-línea, hoy+scroll, aviso sin fechas, aviso SunCalc ausente | Task 4 Steps 2 (`climaCard`, `renderClima`) |
| §6 formato `hhmm`, `—` para null | Task 3 Step 1 (`hhmm`) |
| §6 delta todos los días incl. el primero | Task 3 Step 1 (`sky` no excluye el primer día) + Task 4 verificación Step 6.3 |
| §7 errores: sin fechas, SunCalc ausente, día sin ubicación, `getMoonTimes` incompleto, `night`/`nightEnd` inválido, cruce de medianoche, DST, deep-link `#ruta`, rendimiento | Task 3 (`isDate`, `mt.rise||null`, `darkWindow` null-safe), Task 4 (`renderClima` avisos), Task 2 Step 5/7 (`#ruta`) |
| §8 pruebas 1-11 | Task 1 Steps 6-7, Task 2 Step 7, Task 3 Steps 2-3, Task 4 Step 6 |
| §9 README | Task 4 Step 5 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". Cada paso de código lleva el código real. Las verificaciones llevan `Run:` y `Expected:`. Dos notas condicionales ("si `notice` no existe con esa firma…", "si algún token no existe…") dan la acción concreta (replicar `renderItinerario` / `Select-String` para el nombre real) en vez de dejarlo abierto — son defensivas ante nombres del repo que el plan no puede garantizar sin abrir el archivo, no huecos de diseño.

**3. Consistencia de tipos y nombres**

- `sky(ymd)` — la Task 3 la define tomando **`ymd: string`** (no un `Date`); la Task 4 la llama con `sky(ymd)` desde `eachDay(...)`. Coherente. (El spec §5 la titulaba `sky(date, loc)`; el plan la implementa como `sky(ymd)` que resuelve `loc` internamente vía `locForDate` — más simple y con la misma salida. Registrado aquí como desviación deliberada.)
- `hhmm`, `isDate`, `locForDate`, `moonPhaseName`, `ICE_CENTER` — definidas en Task 3 Step 1, usadas en Task 4 Step 2. `isDate` se usa en ambas.
- `climaScrolled` — declarada en Task 4 Step 1, usada en Task 4 Step 2.
- `renderClima` — definida en Task 4 Step 2, llamada en Task 4 Step 3.
- `SCREENS` incluye `'clima'` (Task 2 Step 5) → `showScreen('clima')` muestra `#screen-clima` (Task 2 Step 4). El `id` `screen-clima` y `data-tab="clima"` coinciden.
- `#clima-body` — creado en Task 2 Step 4, poblado en Task 4 Step 2 (`$('#clima-body')`).
- `shell-v14` — Task 1 Steps 3-5, verificado Step 6-7; `SHELL_ASSETS` gana `./vendor/suncalc/suncalc.js` (Step 5) y `suncalc.js` se referencia en `index.html` (Step 3). Recuento 28 = 27 previas + 1.
- `.ruta-card` / `#ruta-open` / `#ruta-copy` / `#ruta-url` — markup movido verbatim (Task 2 Step 3), handler `on('#ruta-copy', …)` intacto (Task 2 Step 5).
- Clases CSS: `.map-route` (Task 2 Step 6 crea, Task 2 Step 3 la usa en el markup), `.sky-card` / `.sky-line` / `.sky-ic` / `.sky-delta` (Task 4 Step 4 crea, Task 4 Step 2 las usa).

Una inconsistencia menor corregida en Task 4 Step 2: la sub-línea de "ventana oscura" usaba `dim.trim() || 'x'`; ahora `const cls = … ? 'is-dim' : ''` y `class="${cls}"` (una `class` vacía es inocua).
