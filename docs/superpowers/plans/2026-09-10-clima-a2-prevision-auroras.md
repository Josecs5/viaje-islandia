# Clima · A2 — Previsión de auroras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En cada tarjeta de la pantalla Clima, una línea de previsión de auroras para esa noche —Kp máximo de la noche y nubosidad media en la ventana de oscuridad, en la ubicación donde se duerme— con aviso destacado cuando coincidan Kp decente y cielo despejado.

**Architecture:** Todo en `app.js` + CSS/README/release. Nuevo `state.aurora = {kp:[], clouds:{}, fetched}` alimentado por `refreshAurora()`, que hace **dos** peticiones (NOAA SWPC para Kp, Open-Meteo multi-coordenada para nubes) cuando hay conexión, las cachea y vuelve a pintar Clima. `sky()` expone `loc {lat,lng}`. `auroraFor(s)` cruza Kp + nubes con la ventana de oscuridad de la noche y da un `{txt, level, stale}`; `climaCard` añade una `sky-line` con ese texto y clases de realce. Release `shell-v19`.

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. `fetch` a `services.swpc.noaa.gov` y `api.open-meteo.com` (gratis, sin clave, CORS `*`, verificado). Reutiliza `sky`/`locForDate`/`eachDay` (A1) y el patrón de `refreshFx` (D1). Verificación manual con DevTools servida por `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-clima-a2-prevision-auroras-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva**. IIFE, `'use strict'`, copy/comentarios en español.
- `state.aurora = { kp: [{t:'<ISO UTC>', kp:<number>, pred:<bool>}], clouds: { '<lat>,<lng>': [{t:'<ISO UTC>', pct:<number>}] }, fetched: '<ISO>'|null }`. `blankAurora() = { kp: [], clouds: {}, fetched: null }`.
- `blankState()` += `aurora: blankAurora()`. `load()` += `aurora: Object.assign(blankAurora(), p.aurora || {})`. `seedState()` lo hereda.
- **NOAA Kp**: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` → array de `{time_tag:'<ISO naïve UTC>', kp:<number>, observed:'observed'|'predicted', noaa_scale}`. Se normaliza a `{t: time_tag + 'Z', kp, pred: observed !== 'observed'}` filtrando `typeof kp === 'number'`.
- **Open-Meteo nubes**: `https://api.open-meteo.com/v1/forecast?latitude=<a,b,…>&longitude=<a,b,…>&hourly=cloud_cover&forecast_days=16&timezone=UTC` → **array** de resultados (uno por coordenada, en orden); cada uno con `hourly.time[]` + `hourly.cloud_cover[]`. Se normaliza a `clouds[key] = time.map((t,j) => ({t: t+'Z', pct: cloud_cover[j]}))`.
- Coordenadas: `eachDay(inicio,fin).map(locForDate)`, deduplicadas; `key = lat.toFixed(2) + ',' + lng.toFixed(2)`. La petición a Open-Meteo lleva las lat/lng en el **mismo orden** que el array `locs` para poder mapear los resultados por índice.
- `refreshAurora()`: guard `!navigator.onLine` → return; guard `state.aurora.fetched && Date.now() - Date.parse(state.aurora.fetched) < 2*3600e3` → return; guard `!state.meta.fechaInicio || !state.meta.fechaFin` → return. `Promise.all([fetchKp, fetchClouds])` con `.catch(() => null)` **antes** del `.then` de éxito (patrón D1 F2); en éxito construye `state.aurora`, `save()`, `renderClima()`. `.catch` final vacío — **sin `toast`, sin `console.error`**.
- Llamada a `refreshAurora()`: en el `try` de init tras `refreshFx()`, y en `showScreen` cuando `name === 'clima'`.
- `sky()` return += `loc: { lat: loc.lat, lng: loc.lng }`.
- `auroraFor(s)` → `{ txt:<string>, level:'alta'|'media'|'baja'|null, stale:<bool> }`. Umbrales exactos en la spec §7; resumen:
  - ventana = `s.darkWindow` si existe; si no, `[s.sunset+60min, ese día 02:00 UTC + 1 día si <sunset]`; sin `sunset` → `{txt:'—', level:null, stale:false}`.
  - `maxKp` = máx `kp.kp` con `t` en la ventana ±90 min; `null` si ninguna entrada cae dentro.
  - `cloudPct` = media de `pct` de la clave de `clouds` más cercana a `s.loc` (haversine), horas dentro de la ventana; `null` si no hay.
  - `level`: `null` si ambos `null`; `'alta'` si `maxKp>=3 && cloudPct!=null && cloudPct<=35 && s.darkWindow`; `'media'` si `(maxKp>=3 && (cloudPct==null||cloudPct<=65)) || maxKp>=5`; `'baja'` en otro caso con algún dato.
  - `stale` = `state.aurora.fetched` con > 18 h.
  - `txt`: ver spec §7.5 (incluye «previsión disponible ~3 días antes» para noches a > 3 días de hoy sin Kp, y «sin datos — mira vedur.is (Aurora)» sin fetch/offline; sufijo « (hace N h)» si `stale`).
- `climaCard`: tras la línea de luna / `moon.inDarkWindow`, añadir `skyLine('🌌', 'auroras: ' + esc(a.txt))`; `a.level==='alta'` → `p.classList.add('sky-line--alert')` y `c.classList.add('sky-card--aurora')`; `a.level==='media'` → `'sky-line--warm'`; `(!a.level || a.stale)` → atenuar el `<span>` de texto (`is-dim`).
- Release: `?v=18 → ?v=19` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`; `sw.js` `shell-v18 → shell-v19`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache **28**.
- Commits: uno por tarea, español, sin atribución. `git push origin main` tras cada commit.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `blankAurora` + `aurora` en `blankState`/`load`; `refreshAurora()`; `sky().loc`; hooks en init y `showScreen`; `auroraFor(s)`; línea en `climaCard`. |
| `index.html` | Modificar | `?v=18 → ?v=19`. |
| `sw.js` | Modificar | `shell-v18 → shell-v19`; `?v=19` en `SHELL_ASSETS`. |
| `style.css` | Modificar | `.sky-line--alert`, `.sky-line--warm`, `.sky-card--aurora`, `.sky-line .is-dim`. |
| `README.md` | Modificar | Una frase. |

Orden: **1** (estado + fetch + `sky().loc` + hooks + release) → **2** (`auroraFor` + línea en la tarjeta + CSS + README).

---

### Task 1: Estado `aurora`, `refreshAurora()`, `sky().loc`, hooks y release `shell-v19`

**Files:**
- Modify: `app.js` (`blankFx`/`blankFuel` zona ~línea 147-154; `load` ~línea 407-410; `sky` return ~línea 2589-2610; `showScreen` ~línea 2349; init `try` ~línea 2808-2813; función nueva `refreshAurora` junto a `renderClima` ~línea 2800), `index.html`, `sw.js`
- Test: verificación manual por consola/Network de DevTools

**Interfaces:**
- Consumes: `state`, `navigator.onLine`, `locForDate`, `eachDay`, `renderClima`, `save`, `haversine` (existe, usada por B1/A1).
- Produces:
  - `blankAurora()` → `{ kp: [], clouds: {}, fetched: null }`.
  - `state.aurora` presente tras `load()`.
  - `refreshAurora()` → void (async por dentro); puebla `state.aurora` y llama `renderClima()`.
  - `sky(dateStr).loc` → `{ lat:<number>, lng:<number> }`.

- [ ] **Step 1: `blankAurora` y `aurora` en `blankState`**

En `app.js`:
```js
  const blankFx = () => ({ rate: 150, date: null, source: 'default', stamp: null });
  const blankFuel = () => ({ consumo: 7, precioL: 309, tipo: 'Diésel' });

  const blankState = () => ({
    meta: { titulo: 'Viaje a Islandia', fechaInicio: '', fechaFin: '' },
    vuelos: [], coches: [], alojamientos: [], excursiones: [], comidas: [], lugares: [], recomendaciones: [],
    gastos: [], fx: blankFx(), combustible: blankFuel()
  });
```
→
```js
  const blankFx = () => ({ rate: 150, date: null, source: 'default', stamp: null });
  const blankFuel = () => ({ consumo: 7, precioL: 309, tipo: 'Diésel' });
  const blankAurora = () => ({ kp: [], clouds: {}, fetched: null });

  const blankState = () => ({
    meta: { titulo: 'Viaje a Islandia', fechaInicio: '', fechaFin: '' },
    vuelos: [], coches: [], alojamientos: [], excursiones: [], comidas: [], lugares: [], recomendaciones: [],
    gastos: [], fx: blankFx(), combustible: blankFuel(), aurora: blankAurora()
  });
```

- [ ] **Step 2: `aurora` en `load()`**

En `app.js`, `load()`:
```js
        fx: Object.assign(blankFx(), p.fx || {}),
        combustible: Object.assign(blankFuel(), p.combustible || {})
      };
```
→
```js
        fx: Object.assign(blankFx(), p.fx || {}),
        combustible: Object.assign(blankFuel(), p.combustible || {}),
        aurora: Object.assign(blankAurora(), p.aurora || {})
      };
```

- [ ] **Step 3: `sky()` expone `loc`**

En `app.js`, en el objeto que devuelve `sky()`, añadir `loc` (p. ej. justo tras `locLabel`):
```js
    return {
      date: dateStr,
      locLabel: loc.label,
      loc: { lat: loc.lat, lng: loc.lng },
      sunrise: isDate(t.sunrise) ? t.sunrise : null,
```
(el resto del objeto sin cambios).

- [ ] **Step 4: `refreshAurora()`**

En `app.js`, justo **antes** de `function renderClima() {`:
```js
  /* ==========================================================
     Clima · A2 — Previsión de auroras (NOAA Kp + Open-Meteo nubes)
     ========================================================== */
  const NOAA_KP = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

  function auroraLocs() {
    const seen = new Set(), out = [];
    eachDay(state.meta.fechaInicio, state.meta.fechaFin).forEach(d => {
      const l = locForDate(d);
      const key = l.lat.toFixed(2) + ',' + l.lng.toFixed(2);
      if (!seen.has(key)) { seen.add(key); out.push({ key, lat: l.lat, lng: l.lng }); }
    });
    return out;
  }

  // Kp de NOAA (~3 días) + nubosidad de Open-Meteo (~16 días) por ubicación de
  // pernocta. Cacheado en state.aurora; refresco máx. cada 2 h. Fallo silencioso
  // (solo red/HTTP/parseo; si renderClima peta, que se vea en consola).
  function refreshAurora() {
    if (!navigator.onLine) return;
    if (!state.meta.fechaInicio || !state.meta.fechaFin) return;
    const f = state.aurora && state.aurora.fetched;
    if (f && Date.now() - Date.parse(f) < 2 * 3600e3) return;

    const locs = auroraLocs();
    if (!locs.length) return;
    const om = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + locs.map(l => l.lat).join(',')
      + '&longitude=' + locs.map(l => l.lng).join(',')
      + '&hourly=cloud_cover&forecast_days=16&timezone=UTC';

    Promise.all([
      fetch(NOAA_KP).then(r => (r.ok ? r.json() : Promise.reject())),
      fetch(om).then(r => (r.ok ? r.json() : Promise.reject()))
    ])
      .catch(() => null)
      .then(pair => {
        if (!pair) return;
        const [kpRaw, omRaw] = pair;
        const kp = (Array.isArray(kpRaw) ? kpRaw : [])
          .filter(x => x && x.time_tag && typeof x.kp === 'number')
          .map(x => ({ t: x.time_tag + 'Z', kp: x.kp, pred: x.observed !== 'observed' }));
        const results = Array.isArray(omRaw) ? omRaw : [omRaw];
        const clouds = {};
        results.forEach((res, i) => {
          if (!locs[i] || !res || !res.hourly || !Array.isArray(res.hourly.time)) return;
          const H = res.hourly;
          clouds[locs[i].key] = H.time.map((t, j) => ({ t: t + 'Z', pct: H.cloud_cover[j] }));
        });
        state.aurora = { kp, clouds, fetched: new Date().toISOString() };
        save();
        renderClima();
      });
  }
```
*(`eachDay`, `locForDate`, `renderClima`, `save` se resuelven en tiempo de ejecución — `refreshAurora` solo se llama desde el init y `showScreen`, cuando ya están definidos, igual que `refreshFx`.)*

- [ ] **Step 5: Hook en `showScreen` y en el init**

En `showScreen`, antes del bloque `if (name === 'clima' && !climaScrolled)`:
```js
    if (name === 'clima') refreshAurora();
    if (name === 'clima' && !climaScrolled) {
```
En el `try` de init:
```js
    renderAll();
    showScreen(location.hash.slice(1) || 'datos');
    refreshFx();
    refreshAurora();
  } catch (err) {
```

- [ ] **Step 6: Release `shell-v19`**

- `index.html`: `style.css?v=18` → `?v=19`; `app.js?v=18` → `?v=19`.
- `sw.js`: `const SHELL_CACHE = 'shell-v18';` → `'shell-v19'`; `'./style.css?v=18'` → `'./style.css?v=19'`; `'./app.js?v=18'` → `'./app.js?v=19'`.

- [ ] **Step 7: Verificar fetch, forma del estado y guards**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
Navegador limpio (Unregister SW + borrar Cache Storage + `localStorage.clear()`), abrir `http://localhost:8000/`, ir a **Clima**. En DevTools:
- Network: una petición `services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` (200) y una `api.open-meteo.com/v1/forecast?latitude=…&hourly=cloud_cover…` (200; respuesta **array**).
- `JSON.parse(localStorage.getItem('islandia_trip_v1')).aurora` → `kp` es array de `{t,kp,pred}` (t termina en `Z`), `clouds` es objeto con 1+ claves tipo `"64.14,-21.94"` cuyo valor es array de `{t,pct}`, `fetched` es ISO.
- `caches.keys()` → `["shell-v19"]`; `(await (await caches.open('shell-v19')).keys()).length` → **28**; sin `shell-v18`.
- `document.querySelector('link[rel=stylesheet]')` y el `<script>` de `app.js` con `?v=19`.
- Consola sin errores.

- [ ] **Step 8: Verificar guards (frescura y offline)**

- Volver a otra pantalla y a **Clima** de nuevo dentro de 2 min → **no** hay segunda petición NOAA/Open-Meteo (guard de frescura por `fetched`).
- DevTools → Network **Offline**; `localStorage.clear()`; recargar; ir a Clima → **no** hay peticiones; `...aurora` = `{kp:[],clouds:{},fetched:null}`; consola sin errores, sin `toast`.
- Quitar las fechas del viaje (Datos → no se puede; en su lugar en consola: `state.meta.fechaInicio=''` no persiste). Alternativa: comprobar por lectura de código que `refreshAurora` sale si `!state.meta.fechaInicio`.

- [ ] **Step 9: Commit y push**

```powershell
git add app.js index.html sw.js
git commit -m "Clima A2: estado aurora, refreshAurora (NOAA Kp + Open-Meteo nubes), sky().loc y release shell-v19" -q
git push origin main
```

---

### Task 2: `auroraFor(s)`, línea de auroras en la tarjeta, CSS y README

**Files:**
- Modify: `app.js` (`auroraFor` nuevo junto a `refreshAurora`/`climaCard` ~línea 2730; `climaCard` ~línea 2770-2780), `style.css`, `README.md`
- Test: verificación manual en navegador (checklist spec §12)

**Interfaces:**
- Consumes: de la Task 1 — `state.aurora`, `sky().loc`. Existentes: `haversine`, `esc`, `skyLine`, `fmtDur` no necesaria, `hoyYMD`, `el`.
- Produces: `auroraFor(s)` → `{ txt:string, level:'alta'|'media'|'baja'|null, stale:boolean }`; línea `🌌` en cada `climaCard`.

- [ ] **Step 1: `auroraFor(s)`**

En `app.js`, justo antes de `function climaCard(s) {` (o tras `refreshAurora`):
```js
  // Kp + nubes de la noche de `s` cruzados con su ventana de oscuridad.
  function auroraFor(s) {
    const A = state.aurora || { kp: [], clouds: {}, fetched: null };
    const stale = !!A.fetched && (Date.now() - Date.parse(A.fetched)) > 18 * 3600e3;

    // Ventana de la noche [ini, fin] en ms UTC.
    let ini, fin;
    if (s.darkWindow) {
      ini = s.darkWindow.start.getTime();
      fin = s.darkWindow.end.getTime();
    } else if (isDate(s.sunset)) {
      ini = s.sunset.getTime() + 60 * 60e3;
      const d2 = new Date(s.sunset); d2.setUTCDate(d2.getUTCDate() + 1); d2.setUTCHours(2, 0, 0, 0);
      fin = d2.getTime();
    } else {
      return { txt: '—', level: null, stale: false };
    }
    const M = 90 * 60e3; // margen para encajar bloques de 3 h de Kp

    // maxKp en la ventana
    let maxKp = null;
    A.kp.forEach(e => {
      const ms = Date.parse(e.t);
      if (ms >= ini - M && ms <= fin + M && (maxKp == null || e.kp > maxKp)) maxKp = e.kp;
    });

    // nubes: clave más cercana a s.loc
    let cloudPct = null;
    const keys = Object.keys(A.clouds);
    if (keys.length && s.loc) {
      let best = null, bestD = Infinity;
      keys.forEach(k => {
        const [la, lo] = k.split(',').map(Number);
        const d = haversine({ lat: la, lng: lo }, s.loc);
        if (d < bestD) { bestD = d; best = k; }
      });
      const arr = (A.clouds[best] || []).filter(x => {
        const ms = Date.parse(x.t);
        return ms >= ini && ms <= fin && typeof x.pct === 'number';
      });
      if (arr.length) cloudPct = Math.round(arr.reduce((s2, x) => s2 + x.pct, 0) / arr.length);
    }

    // nivel
    let level = null;
    if (maxKp != null || cloudPct != null) {
      if (maxKp != null && maxKp >= 3 && cloudPct != null && cloudPct <= 35 && s.darkWindow) level = 'alta';
      else if ((maxKp != null && maxKp >= 3 && (cloudPct == null || cloudPct <= 65)) || (maxKp != null && maxKp >= 5)) level = 'media';
      else level = 'baja';
    }

    // texto
    const kpTxt = maxKp == null ? null : (Number.isInteger(maxKp) ? String(maxKp) : maxKp.toFixed(1));
    const palabra = level === 'alta' ? 'buena' : level === 'media' ? 'posible' : level === 'baja' ? 'floja' : '';
    let txt;
    if (maxKp == null && cloudPct == null) {
      const lejano = Date.parse(s.date + 'T00:00:00Z') - Date.now() > 3 * 86400e3;
      txt = !A.fetched ? 'sin datos — mira vedur.is (Aurora)'
        : lejano ? 'previsión disponible ~3 días antes'
        : 'sin datos esta noche';
    } else if (cloudPct == null) {
      txt = `Kp ${kpTxt}${palabra ? ' · ' + palabra : ''}`;
    } else if (maxKp == null) {
      txt = `nubes ${cloudPct}% · Kp sin previsión`;
    } else {
      txt = `Kp ${kpTxt} · nubes ${cloudPct}%${palabra ? ' · ' + palabra : ''}`;
    }
    if (stale) {
      const h = Math.round((Date.now() - Date.parse(A.fetched)) / 3600e3);
      txt += ` (hace ${h} h)`;
    }
    return { txt, level, stale };
  }
```

- [ ] **Step 2: Línea de auroras en `climaCard`**

En `app.js`, en `climaCard(s)`, **después** del bloque de `s.moon.inDarkWindow` y **antes** de `return c;`:
```js
    const a = auroraFor(s);
    const pa = skyLine('🌌', `auroras: ${esc(a.txt)}`);
    if (a.level === 'alta') { pa.classList.add('sky-line--alert'); c.classList.add('sky-card--aurora'); }
    else if (a.level === 'media') pa.classList.add('sky-line--warm');
    if (!a.level || a.stale) {
      const sp = pa.querySelector('span:last-child');
      if (sp) sp.classList.add('is-dim');
    }
    c.appendChild(pa);

    return c;
```

- [ ] **Step 3: Estilos**

En `style.css`, junto a las reglas `.sky-*`:
```css
.sky-line--alert span:last-child { color: var(--c-accent); font-weight: 600; }
.sky-line--warm  span:last-child { color: var(--c-text-1); }
.sky-line .is-dim { color: var(--c-text-2); }
.sky-card--aurora { border-color: color-mix(in oklab, var(--c-accent) 55%, var(--c-border-soft)); }
```
*(Comprobar con `Select-String -Path style.css -Pattern "\.sky-line|\.sky-card|is-dim"` si ya existe una regla `.is-dim` equivalente; si la hay, no duplicar.)*

- [ ] **Step 4: README**

En `README.md`, en el párrafo de descripción, añadir tras la parte de luz/luna o de Clima: "y una **previsión de auroras** por noche (índice Kp de NOAA + nubosidad de Open-Meteo) con aviso cuando coinciden cielo despejado y actividad alta."

- [ ] **Step 5: Verificar (checklist spec §12)**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio, **Clima**:
1. Cada tarjeta gana una línea `🌌 auroras: …` bajo la de la luna.
2. Días a > 3 días de hoy sin Kp: «previsión disponible ~3 días antes» o «nubes X%» (según cobertura de Open-Meteo), en gris tenue.
3. Forzar en consola datos de prueba y re-render:
   ```js
   state.aurora = { fetched: new Date().toISOString(), kp: [{t: new Date(Date.now()+36e5).toISOString(), kp: 6, pred: true}], clouds: {} };
   // fija clouds bajo para la 1ª clave que use auroraFor: más simple, comprueba el nivel 'media' por Kp>=5
   renderClima();
   ```
   → alguna tarjeta muestra la línea en color de texto normal (nivel «media», Kp 6) o de acento si además `cloudPct<=35`.
4. Simular «alta»: `state.aurora.clouds = { '<clave real>': [{t:'<hora dentro de la ventana>', pct: 10}] }` con `kp>=3` → esa tarjeta: línea en acento + `.sky-card--aurora` (borde realzado).
5. Network Offline + `localStorage.clear()` + recargar → todas las tarjetas: «sin datos — mira vedur.is (Aurora)» en gris; sol/luna intactos; consola limpia.
6. `caches.keys()` → `shell-v19` con **28** entradas; sin `shell-v18`; `tiles-v2` intacta.
7. Recorrer las 5 pantallas → consola sin errores.

- [ ] **Step 6: Commit y push**

```powershell
git add app.js style.css README.md
git commit -m "Clima A2: linea de prevision de auroras por noche en cada tarjeta" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2 objetivo: línea por noche con Kp máx + nubosidad media + aviso | Task 2 Steps 1-2 |
| §3 no-objetivos (sin mapa/óvalo/histórico/push; no toca A1 salvo `sky().loc`; sin Kp propio; A3 aparte) | `refreshAurora` solo lee; `sky` solo añade `loc`; sin lógica de predicción |
| §4 fuentes (NOAA endpoint + shape; Open-Meteo multi-coord + shape; SW passthrough) | Global Constraints + Task 1 Step 4 |
| §5 modelo (`blankAurora`, `blankState`, `load`, `seedState`) | Task 1 Steps 1-2 |
| §6 `refreshAurora` (3 guards, `Promise.all`, `.catch` antes del éxito, `save`+`renderClima`, silencio) | Task 1 Step 4 |
| §6 llamada en init + `showScreen('clima')` | Task 1 Step 5 |
| §7 `auroraFor` (ventana, maxKp ±90 min, cloudPct clave más cercana, niveles, textos, stale) | Task 2 Step 1 (código verbatim de los umbrales del spec) |
| §8 render en `climaCard` (línea, clases `--alert`/`--warm`/`is-dim`, `sky-card--aurora`) | Task 2 Step 2 |
| §9 estilos | Task 2 Step 3 |
| §10 integración + release `?v=19`/`shell-v19`/precache 28 | Task 1 Steps 3-6, Task 2 Steps 2-3 |
| §11 casos borde (sin fechas, offline, > 3 días, clouds vacío, kp no numérico, un fetch falla, darkWindow null, fetched viejo, husos) | Guards de `refreshAurora`; `auroraFor` con checks `== null`; `Promise.all().catch`; ventana aproximada; sufijo stale; todo en UTC |
| §12 pruebas 1-9 | Task 1 Steps 7-8, Task 2 Step 5 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". `refreshAurora` y `auroraFor` van completas en sus Steps. Verificaciones con `Run:`/`Expected:` concretos (forma de `state.aurora`, recuento de caché, nº de peticiones, textos exactos de la línea). La nota de `Select-String` para `.is-dim` da la acción concreta (no duplicar si existe).

**3. Consistencia de tipos y nombres**

- `blankAurora()` → `{ kp:[], clouds:{}, fetched:null }` — Task 1 Step 1; usado en `load` (Step 2) y como fallback en `auroraFor` (Task 2 Step 1).
- `state.aurora.kp` = `[{t,kp,pred}]`, `.clouds` = `{key:[{t,pct}]}`, `.fetched` = ISO|null — escrito solo por `refreshAurora` (Task 1 Step 4), leído solo por `auroraFor` (Task 2 Step 1). Claves y tipos idénticos (`t` siempre con sufijo `Z`; `kp`/`pct` números).
- `key` = `lat.toFixed(2)+','+lng.toFixed(2)` — generado en `auroraLocs` (Task 1 Step 4) y re-parseado con `k.split(',').map(Number)` en `auroraFor` (Task 2 Step 1). Mismo formato.
- Orden de coords en la URL de Open-Meteo = orden de `locs` = orden de `results` → `clouds[locs[i].key]` (Task 1 Step 4). Consistente.
- `sky(dateStr).loc` = `{lat,lng}` — Task 1 Step 3; consumido por `auroraFor(s)` vía `s.loc` (Task 2 Step 1) para `haversine({lat,lng}, s.loc)`. `haversine` ya existe y toma objetos `{lat,lng}`.
- `auroraFor(s)` → `{txt,level,stale}` — Task 2 Step 1; consumido en `climaCard` (Task 2 Step 2): `a.txt` (a `esc()`), `a.level` (`'alta'|'media'|'baja'|null`), `a.stale` (bool).
- `refreshAurora` — Task 1 Step 4 (`function`, hoisted); llamada en `showScreen` y en el `try` de init (Task 1 Step 5). Sin argumentos.
- `skyLine(icon, html)` — existe; `climaCard` (Task 2 Step 2) la usa igual que las demás líneas; se le pasa `esc(a.txt)` ya escapado.
- Clases CSS: `.sky-line--alert`, `.sky-line--warm`, `.sky-card--aurora`, `.is-dim` — Task 2 Step 3 las define; Task 2 Step 2 las aplica. `.sky-line`, `.sky-card`, `.card`, `--c-accent`, `--c-text-1`, `--c-text-2`, `--c-border-soft` ya existen.
- `shell-v19` / `?v=19` — Task 1 Step 6; verificado Steps 7-8 y Task 2 Step 5. Precache 28 = las 28 de D3 con `style.css`/`app.js` a `?v=19` (sustituyen). Sin assets nuevos (NOAA/Open-Meteo son runtime, no se precachean).

Sin inconsistencias.
