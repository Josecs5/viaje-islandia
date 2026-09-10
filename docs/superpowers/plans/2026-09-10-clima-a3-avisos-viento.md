# Clima · A3 — Avisos de viento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una línea de aviso de viento por día en el Itinerario (junto a la de viabilidad de B1 y la de combustible de D2): velocidad y ráfaga máximas previstas para las horas de conducción de ese día, con consejo específico de Islandia según la intensidad.

**Architecture:** Reutiliza la fontanería de A2. La petición a Open-Meteo se amplía a `wind_speed_10m,wind_gusts_10m`; `state.aurora` se renombra a `state.meteo = {kp, clouds, wind, fetched}` (ya no es solo auroras). `refreshMeteo()` (ex-`refreshAurora`) construye también `wind` y re-pinta Itinerario además de Clima. `windFor(day)` cruza la ráfaga máxima de la ventana de conducción con la ubicación del día; `dayBlock` añade una `.day-wind` con 3 niveles (`info`/`aviso`/`fuerte`). Release `shell-v20`.

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. `fetch` a `api.open-meteo.com` (mismo endpoint de A2). Verificación manual con DevTools servida por `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-clima-a3-avisos-viento-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva**. IIFE, `'use strict'`, copy/comentarios en español.
- **Renombrado A2**: `blankAurora→blankMeteo`, `refreshAurora→refreshMeteo`, `auroraLocs→meteoLocs`, `auroraFetching→meteoFetching`, `state.aurora→state.meteo`, la clave `aurora:` en `blankState`/`load` → `meteo:`. **Se conservan** sin tocar: `auroraFor` (es de auroras), `sky-card--aurora`, `sky-line--alert`/`--warm`, el texto de UI «auroras:», el header/comentarios «Clima · A2».
- `blankMeteo() = { kp: [], clouds: {}, wind: {}, fetched: null }`.
- `load()`: `meteo: Object.assign(blankMeteo(), p.meteo || p.aurora || {})` (arrastra el `aurora` antiguo del localStorage).
- Petición Open-Meteo (en `refreshMeteo`): `...&hourly=cloud_cover,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&forecast_days=16&timezone=UTC`. Unidades verificadas: `wind_speed_10m`/`wind_gusts_10m` en `km/h`.
- En el `.then` de `refreshMeteo`, el guard de cada resultado exige `Array.isArray` de `hourly.time`, `hourly.cloud_cover`, `hourly.wind_speed_10m` **y** `hourly.wind_gusts_10m`. Se construye `wind[key] = H.time.map((t,j)=>({t:t+'Z', spd:H.wind_speed_10m[j], gust:H.wind_gusts_10m[j]})).filter(x => typeof x.gust === 'number' && inTrip(x.t))`. `wind` parte de lo cacheado: `Object.assign({}, (state.meteo && state.meteo.wind) || {})`.
- `state.meteo = { kp, clouds, wind, fetched: new Date().toISOString() }`. Al resolver: `save(); renderClima(); renderItinerario();`.
- `showScreen`: `refreshMeteo()` también cuando `name === 'itinerario'` (además de `'clima'`).
- `windFor(day)` → `null` o `{ txt, level:'info'|'aviso'|'fuerte', stale }`:
  - `loc = locForDate(day.date)`; ventana `day.date` `08:00`–`21:00` UTC.
  - clave de `state.meteo.wind` más cercana a `loc` (haversine); si dist `> 40` km → `return null`.
  - `maxGust`/`maxSpd` = máximos de `gust`/`spd` en la ventana; sin entradas → `return null`.
  - `stale` = `state.meteo.fetched` con > 18 h.
  - por `maxGust` km/h: `< 45` → `return null`; `45–64` → `info` `viento {spd} km/h, rachas {gust}`; `65–89` → `aviso` `rachas {gust} km/h — abre las puertas del coche agarrándolas con fuerza`; `≥ 90` → `fuerte` `rachas {gust} km/h — puertas con las dos manos; ojo en puentes, altos y tramos de grava; mal día para tienda de campaña o F-roads`.
  - `spd`/`gust` con `Math.round`. Sufijo ` (hace {h} h)` si `stale`.
- `dayBlock`: tras la línea `.day-fuel` (D2) y antes de `const fotos = …`, si `windFor(day)` no es `null`, añadir `<p class="day-wind">💨 {esc(w.txt)}</p>` con clase `day-wind--aviso` / `day-wind--fuerte` según nivel, y `is-dim` si `w.stale || w.level === 'info'`.
- CSS: `.day-wind` (base, `--step--1`, `--c-text-2`, `margin: var(--space-4) 0 0`), `.day-wind--aviso { color: var(--c-warning); }`, `.day-wind--fuerte { color: var(--c-danger); font-weight: 600; }`, `.day-wind.is-dim { color: var(--c-text-2); }`. `--c-warning` y `--c-danger` ya existen en `:root`.
- Release: `?v=19 → ?v=20` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`; `sw.js` `shell-v19 → shell-v20`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache **28**.
- Commits: uno por tarea, español, sin atribución. `git push origin main` tras cada commit.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | Renombres `aurora→meteo`; `blankMeteo` con `wind`; URL Open-Meteo + `wind` en `refreshMeteo`; `renderItinerario()` al resolver; hook `showScreen('itinerario')`; `windFor(day)`; línea `.day-wind` en `dayBlock`. |
| `index.html` | Modificar | `?v=19 → ?v=20`. |
| `sw.js` | Modificar | `shell-v19 → shell-v20`; `?v=20` en `SHELL_ASSETS`. |
| `style.css` | Modificar | `.day-wind`, `.day-wind--aviso`, `.day-wind--fuerte`, `.day-wind.is-dim`. |
| `README.md` | Modificar | Una frase. |

Orden: **1** (rename + fetch de viento + hooks + release) → **2** (`windFor` + línea `.day-wind` + CSS + README).

---

### Task 1: Renombrado `aurora→meteo`, viento en `refreshMeteo`, hooks y release `shell-v20`

**Files:**
- Modify: `app.js` (`blankAurora` ~línea 149; `blankState` ~línea 154; `load` ~línea 411; sección A2 completa ~líneas 2803-2870; `showScreen` ~líneas 2349-2360; init `try` ~línea 2976), `index.html`, `sw.js`
- Test: verificación manual por consola/Network de DevTools

**Interfaces:**
- Consumes: `state`, `eachDay`, `locForDate`, `renderClima`, `renderItinerario`, `save`.
- Produces:
  - `blankMeteo()` → `{ kp: [], clouds: {}, wind: {}, fetched: null }`.
  - `state.meteo` presente tras `load()` (arrastra `p.aurora` si existía).
  - `refreshMeteo()` → void; puebla `state.meteo` (`kp`, `clouds`, **`wind`**) y llama `renderClima()` + `renderItinerario()`.

- [ ] **Step 1: `blankMeteo` (con `wind`) y renombre en `blankState`**

En `app.js`:
```js
  const blankAurora = () => ({ kp: [], clouds: {}, fetched: null });
```
→
```js
  const blankMeteo = () => ({ kp: [], clouds: {}, wind: {}, fetched: null });
```
Y en `blankState`:
```js
    gastos: [], fx: blankFx(), combustible: blankFuel(), aurora: blankAurora()
```
→
```js
    gastos: [], fx: blankFx(), combustible: blankFuel(), meteo: blankMeteo()
```

- [ ] **Step 2: renombre en `load()`**

```js
        aurora: Object.assign(blankAurora(), p.aurora || {})
```
→
```js
        meteo: Object.assign(blankMeteo(), p.meteo || p.aurora || {})
```

- [ ] **Step 3: renombres en la sección A2 + viento en `refreshMeteo`**

En `app.js`, en el bloque `Clima · A2`:

(a) Comentario y firma:
```js
  // pernocta. Cacheado en state.aurora; refresco máx. cada 2 h. Fallo silencioso
  // (solo red/HTTP/parseo; si renderClima peta, que se vea en consola).
  let auroraFetching = false;
  function refreshAurora() {
    if (auroraFetching) return;                       // ya hay una petición en curso (init + showScreen)
    if (!navigator.onLine) return;
    if (!state.meta.fechaInicio || !state.meta.fechaFin) return;
    const f = state.aurora && state.aurora.fetched;
    if (f && Date.now() - Date.parse(f) < 2 * 3600e3) return;

    const locs = auroraLocs();
```
→
```js
  // pernocta. Cacheado en state.meteo; refresco máx. cada 2 h. Fallo silencioso
  // (solo red/HTTP/parseo; si el re-render peta, que se vea en consola).
  let meteoFetching = false;
  function refreshMeteo() {
    if (meteoFetching) return;                        // ya hay una petición en curso (init + showScreen)
    if (!navigator.onLine) return;
    if (!state.meta.fechaInicio || !state.meta.fechaFin) return;
    const f = state.meteo && state.meteo.fetched;
    if (f && Date.now() - Date.parse(f) < 2 * 3600e3) return;

    const locs = meteoLocs();
```

(b) `auroraLocs` → `meteoLocs` (la definición, unas líneas más arriba):
```js
  function auroraLocs() {
```
→
```js
  function meteoLocs() {
```

(c) URL Open-Meteo:
```js
      + '&hourly=cloud_cover&forecast_days=16&timezone=UTC';
```
→
```js
      + '&hourly=cloud_cover,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&forecast_days=16&timezone=UTC';
```

(d) `auroraFetching` → `meteoFetching` en las dos asignaciones internas (`auroraFetching = true;` y `auroraFetching = false;`).

(e) El `.then`: construir `wind`, comprobar sus arrays, y re-pintar también el Itinerario:
```js
        const results = Array.isArray(omRaw) ? omRaw : [omRaw];
        // Parte de lo cacheado: si Open-Meteo no devuelve una ubicación, no se pierde su serie previa.
        const clouds = Object.assign({}, (state.aurora && state.aurora.clouds) || {});
        results.forEach((res, i) => {
          if (!locs[i] || !res || !res.hourly || !Array.isArray(res.hourly.time) || !Array.isArray(res.hourly.cloud_cover)) return;
          const H = res.hourly;
          clouds[locs[i].key] = H.time
            .map((t, j) => ({ t: t + 'Z', pct: H.cloud_cover[j] }))
            .filter(x => typeof x.pct === 'number' && inTrip(x.t));
        });
        state.aurora = { kp, clouds, fetched: new Date().toISOString() };
        save();
        renderClima();
```
→
```js
        const results = Array.isArray(omRaw) ? omRaw : [omRaw];
        // Parten de lo cacheado: si Open-Meteo no devuelve una ubicación, no se pierde su serie previa.
        const clouds = Object.assign({}, (state.meteo && state.meteo.clouds) || {});
        const wind = Object.assign({}, (state.meteo && state.meteo.wind) || {});
        results.forEach((res, i) => {
          if (!locs[i] || !res || !res.hourly || !Array.isArray(res.hourly.time)) return;
          const H = res.hourly;
          if (Array.isArray(H.cloud_cover)) {
            clouds[locs[i].key] = H.time
              .map((t, j) => ({ t: t + 'Z', pct: H.cloud_cover[j] }))
              .filter(x => typeof x.pct === 'number' && inTrip(x.t));
          }
          if (Array.isArray(H.wind_speed_10m) && Array.isArray(H.wind_gusts_10m)) {
            wind[locs[i].key] = H.time
              .map((t, j) => ({ t: t + 'Z', spd: H.wind_speed_10m[j], gust: H.wind_gusts_10m[j] }))
              .filter(x => typeof x.gust === 'number' && inTrip(x.t));
          }
        });
        state.meteo = { kp, clouds, wind, fetched: new Date().toISOString() };
        save();
        renderClima();
        renderItinerario();
```

- [ ] **Step 4: renombres en `auroraFor` y su comentario `state.aurora`**

En `auroraFor(s)`:
```js
  function auroraFor(s) {
    const A = state.aurora || { kp: [], clouds: {}, fetched: null };
```
→
```js
  function auroraFor(s) {
    const A = state.meteo || { kp: [], clouds: {}, wind: {}, fetched: null };
```
*(La función `auroraFor` en sí NO se renombra — sigue siendo específica de auroras. Solo cambia la fuente `state.aurora → state.meteo`.)*

- [ ] **Step 5: hooks — `showScreen` e init**

En `showScreen`:
```js
    if (name === 'clima') refreshAurora();
```
→
```js
    if (name === 'clima' || name === 'itinerario') refreshMeteo();
```
En el `try` de init:
```js
    refreshFx();
    refreshAurora();
  } catch (err) {
```
→
```js
    refreshFx();
    refreshMeteo();
  } catch (err) {
```

- [ ] **Step 6: Release `shell-v20`**

- `index.html`: `style.css?v=19` → `?v=20`; `app.js?v=19` → `?v=20`.
- `sw.js`: `const SHELL_CACHE = 'shell-v19';` → `'shell-v20'`; `'./style.css?v=19'` → `'./style.css?v=20'`; `'./app.js?v=19'` → `'./app.js?v=20'`.

- [ ] **Step 7: Verificar rename, fetch de viento y estado**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
Navegador limpio (Unregister SW + borrar Cache Storage + `localStorage.clear()`), abrir `http://localhost:8000/`, ir a **Itinerario**. En DevTools:
- Network: la petición a `api.open-meteo.com/v1/forecast` lleva `hourly=cloud_cover,wind_speed_10m,wind_gusts_10m` y `wind_speed_unit=kmh`.
- `JSON.parse(localStorage.getItem('islandia_trip_v1'))` → tiene `meteo` (con `kp`, `clouds`, `wind`, `fetched`) y **no** tiene `aurora`.
- `state.meteo.wind` es un objeto; sus valores son arrays de `{t,spd,gust}` (o vacíos si el viaje está lejos, por el recorte a ventana).
- Ir a **Clima** → las líneas de auroras (A2) siguen funcionando igual (usan `state.meteo` ahora).
- `caches.keys()` → `["shell-v20"]`; `(await (await caches.open('shell-v20')).keys()).length` → **28**; sin `shell-v19`.
- `?v=20` en el `<link>` y el `<script>`.
- Consola sin errores.

- [ ] **Step 8: Verificar migración desde `aurora`**

En consola:
```js
const s = JSON.parse(localStorage.getItem('islandia_trip_v1'));
s.aurora = { kp: [{ t: '2026-10-10T22:00:00Z', kp: 5, pred: true }], clouds: { '64.14,-21.94': [] }, fetched: '2026-10-09T20:00:00Z' };
delete s.meteo;
localStorage.setItem('islandia_trip_v1', JSON.stringify(s));
location.reload();
```
Tras recargar: `JSON.parse(localStorage.getItem('islandia_trip_v1')).meteo` existe y contiene el `kp`/`clouds`/`fetched` que estaban en `aurora` (más `wind: {}`), y ningún error en consola.

- [ ] **Step 9: Commit y push**

```powershell
git add app.js index.html sw.js
git commit -m "Clima A3: renombra aurora->meteo, anade viento a la peticion de Open-Meteo y release shell-v20" -q
git push origin main
```

---

### Task 2: `windFor(day)`, línea `.day-wind` en el Itinerario, CSS y README

**Files:**
- Modify: `app.js` (`windFor` nuevo junto a `dayBlock` ~línea 1690; línea `.day-wind` en `dayBlock` ~línea 1723), `style.css`, `README.md`
- Test: verificación manual en navegador (checklist spec §12)

**Interfaces:**
- Consumes: de la Task 1 — `state.meteo.wind`. Existentes: `locForDate`, `haversine`, `el`, `esc`.
- Produces: `windFor(day)` → `null` | `{ txt:string, level:'info'|'aviso'|'fuerte', stale:boolean }`; línea `.day-wind` en `dayBlock`.

- [ ] **Step 1: `windFor(day)`**

En `app.js`, justo antes de `function dayBlock(day) {`:
```js
  // Viento previsto (Open-Meteo) para las horas de conducción del día, en la zona
  // de la pernocta. Devuelve null si no hay dato o si la ráfaga máx. no llega a 45 km/h.
  function windFor(day) {
    const W = (state.meteo && state.meteo.wind) || {};
    const keys = Object.keys(W);
    if (!keys.length) return null;
    const loc = locForDate(day.date);
    let best = null, bestD = Infinity;
    keys.forEach(k => {
      const [la, lo] = k.split(',').map(Number);
      const d = haversine({ lat: la, lng: lo }, loc);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (bestD > 40) return null;

    const ini = Date.parse(day.date + 'T08:00:00Z');
    const fin = Date.parse(day.date + 'T21:00:00Z');
    let maxGust = null, maxSpd = null;
    (W[best] || []).forEach(x => {
      const ms = Date.parse(x.t);
      if (ms < ini || ms > fin) return;
      if (typeof x.gust === 'number' && (maxGust == null || x.gust > maxGust)) maxGust = x.gust;
      if (typeof x.spd === 'number' && (maxSpd == null || x.spd > maxSpd)) maxSpd = x.spd;
    });
    if (maxGust == null || maxGust < 45) return null;

    const g = Math.round(maxGust), v = maxSpd == null ? null : Math.round(maxSpd);
    let level, txt;
    if (maxGust < 65) {
      level = 'info';
      txt = `viento ${v != null ? v + ' km/h, ' : ''}rachas ${g}`;
    } else if (maxGust < 90) {
      level = 'aviso';
      txt = `rachas ${g} km/h — abre las puertas del coche agarrándolas con fuerza`;
    } else {
      level = 'fuerte';
      txt = `rachas ${g} km/h — puertas con las dos manos; ojo en puentes, altos y tramos de grava; mal día para tienda de campaña o F-roads`;
    }
    const stale = !!(state.meteo && state.meteo.fetched) && (Date.now() - Date.parse(state.meteo.fetched)) > 18 * 3600e3;
    if (stale) {
      const h = Math.round((Date.now() - Date.parse(state.meteo.fetched)) / 3600e3);
      txt += ` (hace ${h} h)`;
    }
    return { txt, level, stale };
  }
```

- [ ] **Step 2: Línea `.day-wind` en `dayBlock`**

En `app.js`, en `dayBlock`, tras el bloque de `.day-fuel`:
```js
      pf.innerHTML = `⛽ ~<span>${litTxt} L</span> · ${fmtISK(fe.isk)} <span class="muted">· ≈ ${fmtEUR(fe.eur)}</span>`;
      wrap.appendChild(pf);
    }

    const fotos = fotosDelDia(day);
```
→
```js
      pf.innerHTML = `⛽ ~<span>${litTxt} L</span> · ${fmtISK(fe.isk)} <span class="muted">· ≈ ${fmtEUR(fe.eur)}</span>`;
      wrap.appendChild(pf);
    }

    const w = windFor(day);
    if (w) {
      const pw = el('p', 'day-wind');
      if (w.level === 'aviso') pw.classList.add('day-wind--aviso');
      else if (w.level === 'fuerte') pw.classList.add('day-wind--fuerte');
      if (w.stale || w.level === 'info') pw.classList.add('is-dim');
      pw.innerHTML = `💨 ${esc(w.txt)}`;
      wrap.appendChild(pw);
    }

    const fotos = fotosDelDia(day);
```

- [ ] **Step 3: Estilos**

En `style.css`, junto a `.day-fuel` (D2):
```css
.day-wind {
  font-size: var(--step--1);
  color: var(--c-text-2);
  margin: var(--space-4) 0 0;
}
.day-wind.is-dim { color: var(--c-text-2); }
.day-wind--aviso { color: var(--c-warning); }
.day-wind--fuerte { color: var(--c-danger); font-weight: 600; }
```

- [ ] **Step 4: README**

En `README.md`, en el párrafo de la pestaña Clima o del Itinerario, añadir: "y **avisos de viento** por día (ráfagas de Open-Meteo) con la acción concreta —puertas del coche, puentes, tiendas, F-roads."

- [ ] **Step 5: Verificar (checklist spec §12)**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio, **Itinerario**:
1. `state.meteo.wind` presente (arrays por clave o vacíos si el viaje está lejos).
2. Inyectar datos de prueba y re-render:
   ```js
   const s = JSON.parse(localStorage.getItem('islandia_trip_v1'));
   const key = Object.keys(s.meteo.wind)[0] || '64.14,-21.94';
   const mk = (d,h,g,v) => ({ t: d+'T'+('0'+h).slice(-2)+':00:00Z', spd: v, gust: g });
   s.meteo.wind[key] = [mk('2026-10-12',12,72,45), mk('2026-10-12',15,72,45), mk('2026-10-14',13,98,60)];
   s.meteo.fetched = new Date().toISOString();
   localStorage.setItem('islandia_trip_v1', JSON.stringify(s));
   ```
   Recargar (bounce por manifest.json → index.html) → si la clave está a ≤ 40 km de la pernocta de esos días: el 12 muestra `💨 rachas 72 km/h — abre las puertas…` en ámbar; el 14 `💨 rachas 98 km/h — puertas con las dos manos…` en rojo y negrita. (Si la clave real de esos días queda lejos, usar la clave que corresponda a su `locForDate`.)
3. Ráfaga < 45 → sin línea `.day-wind` ese día.
4. `state.meteo.fetched` a > 18 h → la línea añade « (hace N h)» y sale atenuada.
5. Offline + `localStorage.clear()` + recargar Itinerario → sin línea de viento; B1 (viabilidad) y D2 (combustible) intactos; consola sin errores.
6. `caches.keys()` → `shell-v20` con **28** entradas; sin `shell-v19`; `tiles-v2` intacta.
7. Recorrer las 5 pantallas → consola limpia.

- [ ] **Step 6: Commit y push**

```powershell
git add app.js style.css README.md
git commit -m "Clima A3: linea de aviso de viento por dia en el itinerario" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2 objetivo: línea de viento por día en el Itinerario con consejo por intensidad | Task 2 Steps 1-2 |
| §3 no-objetivos (sin pronóstico propio, no toca B1, sin mapa/dirección, sin push, no repetir Ideas) | `.day-wind` aparte de `dayPlan`; solo spd+gust |
| §4 fuente (misma petición A2 + wind, km/h) | Task 1 Step 3c |
| §5 rename `aurora→meteo` + `blankMeteo` con `wind` + `load` con fallback `p.aurora` | Task 1 Steps 1-4 |
| §6 `refreshMeteo` (URL, `wind`, guards de arrays, `wind` desde caché, re-pinta Clima+Itinerario, hook `itinerario`) | Task 1 Steps 3, 5 |
| §7 `windFor` (loc, ventana 08-21 UTC, clave más cercana ≤40 km, maxGust/maxSpd, `stale`, 3 niveles + copy, `Math.round`) | Task 2 Step 1 (código verbatim de umbrales/copy del spec) |
| §8 render en `dayBlock` (`.day-wind`, clases por nivel, `is-dim` para info/stale) | Task 2 Step 2 |
| §9 estilos (`--c-warning`, `--c-danger` — existen) | Task 2 Step 3 |
| §10 integración + release `?v=20`/`shell-v20`/precache 28 | Task 1 Steps 6-8, Task 2 Steps 2-3 |
| §11 casos borde (sin fechas/offline/lejano, `ICE_CENTER`, `gust` null, migración, `renderItinerario` oculto, día sin conducir, husos) | Guards de `refreshMeteo`/`windFor`; recorte; `load` fallback; `renderItinerario` reconstruye aunque `hidden` |
| §12 pruebas 1-7 | Task 1 Steps 7-8, Task 2 Step 5 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". `windFor` y todos los cambios de `refreshMeteo` van completos en sus Steps. Verificaciones con `Run:`/`Expected:` concretos (query string de Open-Meteo, forma de `state.meteo`, recuento de caché, textos de la línea por nivel).

**3. Consistencia de tipos y nombres**

- `blankMeteo()` → `{ kp:[], clouds:{}, wind:{}, fetched:null }` — Task 1 Step 1; usado en `load` (Step 2), fallback en `auroraFor` (Step 4) y `windFor` (Task 2 Step 1).
- `state.meteo.wind` = `{ '<lat>,<lng>': [{t,spd,gust}] }` — escrito solo por `refreshMeteo` (Task 1 Step 3e), leído solo por `windFor` (Task 2 Step 1). Claves = `locs[i].key` = `lat.toFixed(2)+','+lng.toFixed(2)` (de `meteoLocs`, sin cambios respecto a `auroraLocs`). `windFor` re-parsea con `k.split(',').map(Number)` — mismo formato que `auroraFor`.
- `refreshMeteo` (ex-`refreshAurora`) — Task 1 Step 3; llamado en `showScreen` (`clima`/`itinerario`) y en init (Step 5). Sin argumentos. `meteoLocs`/`meteoFetching` renombrados consistentemente.
- `auroraFor` — **no** se renombra (Task 1 Step 4 solo cambia su fuente a `state.meteo`); sigue llamándose desde `climaCard` igual. `state.meteo` tiene `kp`/`clouds` con la misma forma que tenía `state.aurora`, así que `auroraFor` no necesita más cambios.
- `windFor(day)` → `null | {txt, level, stale}` — Task 2 Step 1; consumido en `dayBlock` (Task 2 Step 2): `w.txt` (a `esc()`), `w.level` (`'info'|'aviso'|'fuerte'`), `w.stale` (bool). `day` = objeto de `buildItinerary().days` (`{date, idx, items, km}`), el mismo que ya recibe `dayBlock`.
- `inTrip(iso)` — helper local dentro del `.then` de `refreshMeteo` (definido en A2 por el recorte F7); Task 1 Step 3e lo reutiliza para `wind`. Ya está en scope.
- Clases CSS: `.day-wind`, `.day-wind--aviso`, `.day-wind--fuerte` — Task 2 Step 3 las define; Task 2 Step 2 las aplica. `.is-dim` (sin scope `.sky-line`) ya existe como regla genérica en `style.css` para Clima; `.day-wind.is-dim` se define explícito por si acaso. `--c-warning` (`style.css:31`) y `--c-danger` (`style.css:32`) ya existen.
- `shell-v20` / `?v=20` — Task 1 Step 6; verificado Steps 7-8 y Task 2 Step 5. Precache 28 = las 28 de A2 con `style.css`/`app.js` a `?v=20`. Sin assets nuevos (Open-Meteo es runtime).

Sin inconsistencias.
