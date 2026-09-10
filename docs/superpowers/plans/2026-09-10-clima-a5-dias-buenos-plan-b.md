# Clima · A5 — Días buenos / malos y plan B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Marca de exteriores por día en el Itinerario (nubes + ráfaga + lluvia → `regular`/`malo`, un buen día no se pinta), un nudge de prioridad en la cabecera del Itinerario, y un bloque «Plan B para días de lluvia o viento» por zona en Ideas.

**Architecture:** Reutiliza `state.meteo` / `refreshMeteo` de A2-A3. La petición a Open-Meteo gana `precipitation`; `state.meteo.precip` se cachea/recorta/poda como `clouds`/`wind`. `outdoorFor(day)` puntúa la ventana de día y da `{level,txt,stale}`; `dayBlock` pinta `.day-out` solo si `regular`/`malo`; `outdoorRankBlock(it)` añade el nudge a la cabecera del Itinerario. `PLAN_B` + `renderPlanB(body)` es un bloque de contenido en Ideas gemelo de `renderCarreteras`. Release `shell-v22`.

**Tech Stack:** HTML + CSS + JS vanilla, sin build/framework/tests. `fetch` a `api.open-meteo.com` (mismo endpoint). Verificación manual con DevTools + `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-clima-a5-dias-buenos-plan-b-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva**. IIFE, `'use strict'`, copy/comentarios en español.
- `blankMeteo()` → `{ kp: [], clouds: {}, wind: {}, precip: {}, fetched: null }`. `load()` ya hace `Object.assign(blankMeteo(), p.meteo || p.aurora || {})` → cubre `precip`.
- `refreshMeteo`: URL `hourly` gana `,precipitation`. En el `.then`: `precip` parte de lo cacheado (`Object.assign({}, state.meteo.precip || {})`); por resultado, `if (Array.isArray(H.precipitation)) precip[locs[i].key] = H.time.map((t,j)=>({t:t+'Z', mm:H.precipitation[j]})).filter(x => typeof x.mm === 'number' && inTrip(x.t))`. La poda a `cur` incluye `precip`: `[clouds, wind, precip].forEach(...)`. El chequeo `hayDatos` incluye `precip`.
- `state.meteo = { kp, clouds, wind, precip, fetched }`.
- `outdoorFor(day)` → `null` | `{ level:'bueno'|'regular'|'malo', txt:string, stale:boolean }`:
  - `loc = locForDate(day.date)`; `isIceCenter(loc)` → `null`.
  - Ventana **de día**: `day.date` `09:00`–`19:00` UTC.
  - Una única clave más cercana a `loc` (haversine); `> 40 km` → `null`. Se usa esa clave en `clouds`, `wind` y `precip`.
  - `avgCloud` = media de `pct` en ventana; `maxGust` = máx `gust`; `sumPrecip` = suma `mm`; `hoursRain` = nº de horas con `mm >= 0.2`. Si **ninguna** de las tres series tiene entradas en la ventana → `null`.
  - `score = (avgCloud/100) + (maxGust>=70?2:maxGust>=50?1:0) + Math.min(sumPrecip,6)/2 + (hoursRain>=4?1:0)` (los términos ausentes valen 0).
  - `level`: `score < 1.4` → `bueno`; `score < 3.0` → `regular`; resto → `malo`.
  - factores presentes para el texto: `avgCloud!=null && avgCloud>=60` → `nubes {Math.round(avgCloud)}%`; `maxGust!=null && maxGust>=50` → `rachas {Math.round(maxGust)}`; `sumPrecip>=1` → `{sumPrecip.toFixed(sumPrecip<10?1:0)} mm`.
  - `txt`: `regular` → `'día irregular' + (factores.length ? ': ' + factores.join(' · ') : '')`; `malo` → `'día de plan B' + (factores.length ? ': ' + factores.join(' · ') : '') + ' — alternativas de interior en Ideas'`.
  - `stale` (`state.meteo.fetched` > 18 h) → `txt += ' (hace {h} h)'`. **No** atenúa.
- `dayBlock`: tras la línea `.day-plan` (B1) y **antes** del bloque `.day-fuel` (D2), si `outdoorFor(day)` da `regular`/`malo`: `<p class="day-out day-out--{level}">{🌧️|⛅} {esc(txt)}</p>`.
- `outdoorRankBlock(it)` → `<section class="itin-outlook">` (o `hidden` si < 2 días con dato). Calcula `outdoorFor` de cada `it.days[i]`; ordena por `score`… — como `outdoorFor` no expone `score`, `outdoorRankBlock` recomputa un score ligero propio **o** `outdoorFor` devuelve también `score` (elegir: **`outdoorFor` devuelve `score`** en el objeto, `dayBlock` lo ignora). Mejores = 2-3 de menor `score` con `level != 'malo'` o simplemente menor score; peores = 1-2 de mayor score. Texto: `Días con mejor pinta para exteriores: {mejores} · peores: {peores}. Si puedes mover una excursión al aire libre, hazla a un día verde.` — cada día como `Día {idx} ({fmtFecha corta})`.
- `renderItinerario`: `body.appendChild(outdoorRankBlock(it));` tras `body.appendChild(itinFuelBlock(it));` y antes de crear `.chips--itin`.
- `PLAN_B = { intro, zonas: [{ z, items:[str] }] }` (6 zonas). `renderPlanB(body)` gemela de `renderCarreteras`: `<section class="reco-cat">` badge `🌧️`, `<h3>Plan B para días de lluvia o viento</h3>`, `<p class="emerg-intro">{esc(intro)}</p>`, y `.reco-card` por zona con `` `<b>${esc(z.z)}.</b> ${esc(z.items.join(' · '))}` ``. Llamada en `renderReco()` tras `renderCarreteras(body)` y antes de `renderEmergencias(body)`.
- `esc()` en todo el texto variable (semilla incluida). Sin CSS nuevo para el bloque de Ideas.
- CSS nuevo: `.day-out`, `.day-out--regular`, `.day-out--malo`, `.itin-outlook`.
- Release: `?v=21 → ?v=22` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`; `sw.js` `shell-v21 → shell-v22`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache **28**.
- Commits: uno por tarea, español, sin atribución. `git push origin main` tras cada commit.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `precip` en `blankMeteo`/`refreshMeteo`; `outdoorFor(day)`; `.day-out` en `dayBlock`; `outdoorRankBlock(it)` + llamada en `renderItinerario`; `PLAN_B` + `renderPlanB(body)` + llamada en `renderReco`. |
| `index.html` | Modificar | `?v=21 → ?v=22`. |
| `sw.js` | Modificar | `shell-v21 → shell-v22`; `?v=22` en `SHELL_ASSETS`. |
| `style.css` | Modificar | `.day-out`, `.day-out--regular`, `.day-out--malo`, `.itin-outlook`. |
| `README.md` | Modificar | Una frase. |

Orden: **1** (precip + `outdoorFor` + línea `.day-out` + `outdoorRankBlock` + CSS + release) → **2** (`PLAN_B` + `renderPlanB` + README).

---

### Task 1: `precip`, `outdoorFor`, línea `.day-out`, nudge de cabecera, CSS y release `shell-v22`

**Files:**
- Modify: `app.js` (`blankMeteo` ~línea 149; `refreshMeteo` `.then` ~línea 2967-2998; `windFor`/`dayBlock` zona ~línea 1685-1790; `renderItinerario` ~línea 1600), `index.html`, `sw.js`, `style.css`
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: `state.meteo`, `locForDate`, `haversine`, `isIceCenter`, `el`, `esc`, `fmtFecha`, `buildItinerary().days`.
- Produces: `state.meteo.precip`; `outdoorFor(day)` → `null | {level,txt,stale,score}`; `outdoorRankBlock(it)` → `<section>`.

- [ ] **Step 1: `precip` en `blankMeteo`**

```js
  const blankMeteo = () => ({ kp: [], clouds: {}, wind: {}, fetched: null });
```
→
```js
  const blankMeteo = () => ({ kp: [], clouds: {}, wind: {}, precip: {}, fetched: null });
```

- [ ] **Step 2: `precipitation` en la URL y `precip` en el `.then` de `refreshMeteo`**

URL:
```js
      + '&hourly=cloud_cover,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&forecast_days=16&timezone=UTC';
```
→
```js
      + '&hourly=cloud_cover,wind_speed_10m,wind_gusts_10m,precipitation&wind_speed_unit=kmh&forecast_days=16&timezone=UTC';
```
`.then` — añadir `precip` junto a `clouds`/`wind`:
```js
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
        // Poda las claves de ubicaciones que ya no están en el viaje ...
        const cur = new Set(locs.map(l => l.key));
        [clouds, wind].forEach(m => Object.keys(m).forEach(k => { if (!cur.has(k)) delete m[k]; }));

        state.meteo = { kp, clouds, wind, fetched: new Date().toISOString() };
        save();
        ...
        const hayDatos = kp.length
          || Object.keys(clouds).some(k => clouds[k].length)
          || Object.keys(wind).some(k => wind[k].length);
```
→
```js
        const clouds = Object.assign({}, (state.meteo && state.meteo.clouds) || {});
        const wind = Object.assign({}, (state.meteo && state.meteo.wind) || {});
        const precip = Object.assign({}, (state.meteo && state.meteo.precip) || {});
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
          if (Array.isArray(H.precipitation)) {
            precip[locs[i].key] = H.time
              .map((t, j) => ({ t: t + 'Z', mm: H.precipitation[j] }))
              .filter(x => typeof x.mm === 'number' && inTrip(x.t));
          }
        });
        // Poda las claves de ubicaciones que ya no están en el viaje ...
        const cur = new Set(locs.map(l => l.key));
        [clouds, wind, precip].forEach(m => Object.keys(m).forEach(k => { if (!cur.has(k)) delete m[k]; }));

        state.meteo = { kp, clouds, wind, precip, fetched: new Date().toISOString() };
        save();
        ...
        const hayDatos = kp.length
          || Object.keys(clouds).some(k => clouds[k].length)
          || Object.keys(wind).some(k => wind[k].length)
          || Object.keys(precip).some(k => precip[k].length);
```
*(La segunda parte del `hayDatos`/`if (hayDatos)` no cambia salvo la línea añadida.)*

- [ ] **Step 3: `outdoorFor(day)`**

En `app.js`, justo **después** de `function windFor(day) { … }` (antes de `function dayBlock`):
```js
  // Condiciones para planes al aire libre ese día (nubes + ráfaga + lluvia de las
  // horas de día). Devuelve null si no hay dato; nivel 'bueno' no se pinta.
  function outdoorFor(day) {
    const M = state.meteo || {};
    const loc = locForDate(day.date);
    if (isIceCenter(loc)) return null;
    const near = map => {
      const keys = Object.keys(map || {});
      if (!keys.length) return null;
      let best = null, bestD = Infinity;
      keys.forEach(k => {
        const [la, lo] = k.split(',').map(Number);
        const d = haversine({ lat: la, lng: lo }, loc);
        if (d < bestD) { bestD = d; best = k; }
      });
      return bestD > 40 ? null : best;
    };
    const kc = near(M.clouds), kw = near(M.wind), kp = near(M.precip);
    const ini = Date.parse(day.date + 'T09:00:00Z');
    const fin = Date.parse(day.date + 'T19:00:00Z');
    const inWin = t => { const ms = Date.parse(t); return ms >= ini && ms <= fin; };

    let cSum = 0, cN = 0;
    (kc && M.clouds[kc] || []).forEach(x => { if (inWin(x.t) && typeof x.pct === 'number') { cSum += x.pct; cN++; } });
    let maxGust = null;
    (kw && M.wind[kw] || []).forEach(x => { if (inWin(x.t) && typeof x.gust === 'number' && (maxGust == null || x.gust > maxGust)) maxGust = x.gust; });
    let pSum = 0, pN = 0, hoursRain = 0;
    (kp && M.precip[kp] || []).forEach(x => { if (inWin(x.t) && typeof x.mm === 'number') { pSum += x.mm; pN++; if (x.mm >= 0.2) hoursRain++; } });
    if (!cN && maxGust == null && !pN) return null;

    const avgCloud = cN ? cSum / cN : null;
    const score = (avgCloud == null ? 0 : avgCloud / 100)
      + (maxGust == null ? 0 : maxGust >= 70 ? 2 : maxGust >= 50 ? 1 : 0)
      + Math.min(pSum, 6) / 2
      + (hoursRain >= 4 ? 1 : 0);
    const level = score < 1.4 ? 'bueno' : score < 3.0 ? 'regular' : 'malo';

    const fac = [];
    if (avgCloud != null && avgCloud >= 60) fac.push(`nubes ${Math.round(avgCloud)}%`);
    if (maxGust != null && maxGust >= 50) fac.push(`rachas ${Math.round(maxGust)}`);
    if (pSum >= 1) fac.push(`${pSum.toFixed(pSum < 10 ? 1 : 0)} mm`);
    const cola = fac.length ? ': ' + fac.join(' · ') : '';
    let txt = level === 'malo'
      ? 'día de plan B' + cola + ' — alternativas de interior en Ideas'
      : 'día irregular' + cola;

    const stale = !!(state.meteo && state.meteo.fetched) && (Date.now() - Date.parse(state.meteo.fetched)) > 18 * 3600e3;
    if (stale) txt += ` (hace ${Math.round((Date.now() - Date.parse(state.meteo.fetched)) / 3600e3)} h)`;
    return { level, txt, stale, score };
  }
```

- [ ] **Step 4: Línea `.day-out` en `dayBlock`**

En `app.js`, en `dayBlock`, tras el bloque `if (plan.veredicto) { … }` de B1 y **antes** del `const km = day.km || 0;` de D2:
```js
    const od = outdoorFor(day);
    if (od && od.level !== 'bueno') {
      const po = el('p', 'day-out day-out--' + od.level);
      po.innerHTML = `${od.level === 'malo' ? '🌧️' : '⛅'} ${esc(od.txt)}`;
      wrap.appendChild(po);
    }

    const km = day.km || 0;
```

- [ ] **Step 5: `outdoorRankBlock(it)` + llamada en `renderItinerario`**

En `app.js`, justo **después** de `function itinFuelBlock(it) { … }`:
```js
  function outdoorRankBlock(it) {
    const box = el('section', 'itin-outlook');
    const rated = it.days
      .map(d => ({ d, o: outdoorFor(d) }))
      .filter(x => x.o);
    if (rated.length < 2) { box.hidden = true; return box; }
    rated.sort((a, b) => a.o.score - b.o.score);
    const tag = x => `Día ${x.d.idx} (${fmtFecha(x.d.date)})`;
    const mejores = rated.slice(0, Math.min(3, rated.length - 1)).map(tag);
    const peores = rated.slice(-Math.min(2, rated.length - mejores.length)).reverse().map(tag);
    box.innerHTML =
      `<p>Días con mejor pinta para exteriores: <b>${esc(mejores.join(' · '))}</b>` +
      ` · peores: ${esc(peores.join(' · '))}.</p>` +
      `<p class="itin-outlook__nudge">Si puedes mover una excursión al aire libre (Círculo Dorado, una cascada, una salida movible), llévala a un día verde.</p>`;
    return box;
  }
```
En `renderItinerario`, tras `body.appendChild(itinFuelBlock(it));`:
```js
    body.appendChild(itinFuelBlock(it));
    body.appendChild(outdoorRankBlock(it));

    const chips = el('div', 'chips chips--itin');
```

- [ ] **Step 6: Estilos**

En `style.css`, junto a `.day-wind` (A3):
```css
/* Día bueno/malo para exteriores (A5) */
.day-out { font-size: var(--step--1); margin: var(--space-4) 0 0; }
.day-out--regular { color: var(--c-text-2); }
.day-out--malo { color: var(--c-warning); }
.itin-outlook {
  background: var(--c-surface);
  border: 1px solid var(--c-border-soft);
  border-radius: var(--radius-m);
  padding: var(--space-12);
  margin-bottom: var(--space-16);
  font-size: var(--step--1);
}
.itin-outlook[hidden] { display: none; }
.itin-outlook p { margin: 0; }
.itin-outlook__nudge { color: var(--c-text-2); margin-top: var(--space-6) !important; }
```

- [ ] **Step 7: Release `shell-v22`**

- `index.html`: `style.css?v=21` → `?v=22`; `app.js?v=21` → `?v=22`.
- `sw.js`: `const SHELL_CACHE = 'shell-v21';` → `'shell-v22'`; `'./style.css?v=21'` → `'./style.css?v=22'`; `'./app.js?v=21'` → `'./app.js?v=22'`.

- [ ] **Step 8: Verificar**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
Navegador limpio (Unregister SW + borrar Cache Storage + `localStorage.clear()`), **Itinerario**:
1. La petición a Open-Meteo lleva `precipitation`; `state.meteo.precip` es objeto (arrays o vacíos si el viaje está lejos).
2. Inyectar datos y re-pintar (bounce por manifest.json → index.html, `fetched` fresco para que `refreshMeteo` no pise):
   ```js
   const s = JSON.parse(localStorage.getItem('islandia_trip_v1'));
   const k = Object.keys(s.meteo.wind)[0] || '64.14,-21.94';
   const mk = (arr, d, h, v, key) => arr.push({ t: d+'T'+('0'+h).slice(-2)+':00:00Z', [key]: v });
   ['clouds','wind','precip'].forEach(m => s.meteo[m] = { [k]: [] });
   [10,12,14,16].forEach(h => { mk(s.meteo.clouds[k], '2026-10-10', h, 20, 'pct'); mk(s.meteo.wind[k], '2026-10-10', h, 25, 'gust'); mk(s.meteo.precip[k], '2026-10-10', h, 0, 'mm'); });
   [10,12,14,16].forEach(h => { mk(s.meteo.clouds[k], '2026-10-11', h, 85, 'pct'); mk(s.meteo.wind[k], '2026-10-11', h, 55, 'gust'); mk(s.meteo.precip[k], '2026-10-11', h, 0.3, 'mm'); });
   [10,12,14,16].forEach(h => { mk(s.meteo.clouds[k], '2026-10-12', h, 95, 'pct'); mk(s.meteo.wind[k], '2026-10-12', h, 75, 'gust'); mk(s.meteo.precip[k], '2026-10-12', h, 2.5, 'mm'); });
   s.meteo.fetched = new Date().toISOString();
   localStorage.setItem('islandia_trip_v1', JSON.stringify(s));
   ```
   Expected (si la clave `k` está a ≤ 40 km de la pernocta de esos días; si no, usar la clave que toque):
   - Día 10 → **sin** `.day-out` (`bueno`).
   - Día 11 → `⛅ día irregular: nubes 85% · rachas 55` en gris.
   - Día 12 → `🌧️ día de plan B: nubes 95% · rachas 75 · 30,0 mm — alternativas de interior en Ideas` en ámbar. *(30 mm = 4 horas × 2,5 + acumulado; el número exacto según las horas inyectadas.)*
   - Cabecera del Itinerario: `.itin-outlook` con «Días con mejor pinta para exteriores: Día N (…) · peores: Día M (…).» y el nudge.
3. Ráfaga < 45 y sin lluvia y pocas nubes → `bueno` → sin línea.
4. Offline + `localStorage.clear()` + recargar → sin `.day-out`, `.itin-outlook` oculto; B1/D2/A3 intactos; consola limpia.
5. `caches.keys()` → `shell-v22` con **28** entradas; sin `shell-v21`; `tiles-v2` intacta.
6. `?v=22` en el `<link>` y el `<script>`.

- [ ] **Step 9: Commit y push**

```powershell
git add app.js index.html sw.js style.css
git commit -m "Clima A5: dias buenos/malos para exteriores (nubes+viento+lluvia) y nudge de prioridad" -q
git push origin main
```

---

### Task 2: `PLAN_B` + `renderPlanB(body)` en Ideas + README

**Files:**
- Modify: `app.js` (`PLAN_B` junto a `CARRETERAS` ~línea 2244; `renderPlanB` junto a `renderCarreteras` ~línea 2312; llamada en `renderReco` ~línea 2378), `README.md`
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: `el`, `esc`. Clases CSS existentes.
- Produces: `PLAN_B` (objeto), `renderPlanB(body)` → void.

- [ ] **Step 1: Constante `PLAN_B`**

En `app.js`, tras el cierre de la constante `CARRETERAS` (`};`) y antes de `function renderEmergencias`:
```js
  /* Planes de interior para días de lluvia o viento, por zona (Clima A5). */
  const PLAN_B = {
    intro: 'Si el parte pinta feo, cambia exteriores por interior sin salir de la zona donde duermes ese día.',
    zonas: [
      { z: 'Reikiavik y alrededores', items: ['Piscinas geotermales al aire libre pero con jacuzzis calientes: Laugardalslaug, Sundhöllin, Vesturbæjarlaug', 'Museo Nacional y Perlan (exposición del glaciar y cúpula)', 'Sky Lagoon o los baños de Hvammsvík si quieres spa', 'Cafés y librerías del centro: Reykjavík Roasters, Kaffibrennslan'] },
      { z: 'Sur (Selfoss–Vík)', items: ['Piscina de Selfoss y la nueva Sundhöll; piscina de Hveragerði', 'LAVA Centre (Hvolsvöllur): volcanes y terremotos, muy interactivo', 'Museo de Skógar (folclore) junto a la cascada', 'Piscina geotermal de Seljavallalaug si no hay viento (semi-cubierta por la montaña)'] },
      { z: 'Sureste (Höfn)', items: ['Piscina de Höfn (Sundlaug Hafnar), climatizada con toboganes', 'Museo Gamlabúð (centro de visitantes del Vatnajökull)', 'Café Nýhöfn / Pakkhús para langostino sin prisa'] },
      { z: 'Este (Egilsstaðir)', items: ['Vök Baths: pozas termales flotantes en el lago (spa con conexión)', 'Piscina de Egilsstaðir', 'Museo del Este (Minjasafn Austurlands) y la cervecería local'] },
      { z: 'Norte (Mývatn–Akureyri)', items: ['Mývatn Nature Baths (la "Laguna Azul del norte", menos gente)', 'Piscina de Akureyri, de las mejores del país', 'Museo de la Aviación y Jardín Botánico (invernadero) en Akureyri', 'GeoSea: baños de agua de mar geotermal en Húsavík con vistas al fiordo'] },
      { z: 'Oeste (Borgarnes–Snæfellsnes)', items: ['Settlement Centre de Borgarnes (sagas, audioguía en español)', 'Piscinas de Borgarnes y de Stykkishólmur', 'Krauma: baños termales junto a Deildartunguhver, el manantial más caudaloso de Europa'] }
    ]
  };
```

- [ ] **Step 2: `renderPlanB(body)`**

En `app.js`, tras el cierre de `function renderCarreteras(body) { … }` y antes de `const RECO_CAT_ICO = …`:
```js
  function renderPlanB(body) {
    const sec = el('section', 'reco-cat');
    sec.style.setProperty('--rc', '210');
    sec.innerHTML =
      `<div class="reco-cat__head">` +
      `<span class="reco-cat__badge">🌧️</span>` +
      `<h3>Plan B para días de lluvia o viento</h3>` +
      `</div>` +
      `<p class="emerg-intro">${esc(PLAN_B.intro)}</p>` +
      `<div class="reco-cat__list">` +
      PLAN_B.zonas.map(g => `<div class="reco-card"><b>${esc(g.z)}.</b> ${esc(g.items.join(' · '))}</div>`).join('') +
      `</div>`;
    body.appendChild(sec);
  }
```

- [ ] **Step 3: Llamar `renderPlanB` en `renderReco()`**

```js
    renderCarreteras(body);
    renderEmergencias(body);
```
→
```js
    renderCarreteras(body);
    renderPlanB(body);
    renderEmergencias(body);
```

- [ ] **Step 4: README**

En `README.md`, añadir (p. ej. tras la frase de carreteras): "El Itinerario marca los días que pintan **mejor o peor para exteriores** (nubes, viento y lluvia de Open-Meteo) y Ideas trae **planes de interior por zona** para los días malos."

- [ ] **Step 5: Verificar**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio, **Ideas** (`#reco`):
1. Tras «Carreteras: antes de conducir» aparece **«🌧️ Plan B para días de lluvia o viento»**: intro + **6 cards**, una por zona, con la zona en negrita y los planes separados por ` · `.
2. Después va «📞 Teléfonos importantes en Islandia».
3. `[...document.querySelectorAll('#reco-body .reco-cat h3')].map(h=>h.textContent)` → incluye «Plan B para días de lluvia o viento» entre «Carreteras: antes de conducir» y «Teléfonos importantes en Islandia».
4. Mismo aspecto que los bloques de arriba; ningún `<b>` literal visible; caracteres islandeses (Hveragerði, Seljavallalaug, Mývatn, Stykkishólmur, Deildartunguhver) bien.
5. Recorrer las 5 pantallas → consola sin errores.

- [ ] **Step 6: Commit y push**

```powershell
git add app.js README.md
git commit -m "Clima A5: bloque 'Plan B para dias malos' por zona en Ideas" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2.1 marca de exteriores por día (bueno no se pinta) | Task 1 Steps 3-4 |
| §2.2 nudge de prioridad en la cabecera | Task 1 Step 5 |
| §2.3 plan B de interior por zona en Ideas | Task 2 Steps 1-3 |
| §3 no-objetivos (no reordena solo, sin pronóstico propio, no toca B1/D2/A3, sin API nueva) | `.day-out`/`.itin-outlook` aparte; solo `,precipitation` añadido |
| §4 datos (`precip` en `blankMeteo`/`refreshMeteo`, recorte, poda, `hayDatos`) | Task 1 Steps 1-2 |
| §5 `outdoorFor` (ventana 09-19, clave ≤40 km, score, niveles, factores, `stale` sin atenuar) | Task 1 Step 3 (código = spec) |
| §6 `outdoorRankBlock` (< 2 días → hidden; top-3/bottom-2 por score) | Task 1 Step 5 |
| §7 render `.day-out` (tras B1, antes de D2, solo regular/malo) | Task 1 Step 4 |
| §8 `PLAN_B` + `renderPlanB` (6 zonas, gemela de `renderCarreteras`, entre Carreteras y Teléfonos) | Task 2 Steps 1-3 |
| §9 estilos | Task 1 Step 6 |
| §10 integración + release `?v=22`/`shell-v22`/precache 28 | Task 1 Steps 2,5,7; Task 2 Steps 1-3 |
| §11 casos borde (lejano/offline/sin fechas, `isIceCenter`, >40 km, `mm` null, 2 días exactos, bueno no pinta, hidden re-render) | Guards en `outdoorFor`/`outdoorRankBlock`; `hayDatos` con `precip`; guard de foco de A3 ya está |
| §12 pruebas 1-6 | Task 1 Step 8; Task 2 Step 5 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". `outdoorFor`, `outdoorRankBlock`, `renderPlanB` y las constantes van completos. Verificación con `Run:`/`Expected:` concretos (query string, forma de `state.meteo`, textos por nivel, recuento de caché, orden de `<h3>`).

**3. Consistencia de tipos y nombres**

- `blankMeteo()` → `{kp, clouds, wind, precip, fetched}` — Task 1 Step 1; `load` ya lo cubre por `Object.assign`. `refreshMeteo` escribe `state.meteo = {kp, clouds, wind, precip, fetched}` (Task 1 Step 2) — 5 claves, consistente.
- `state.meteo.precip` = `{'<lat>,<lng>': [{t,mm}]}` — escrito solo por `refreshMeteo`; leído solo por `outdoorFor` (Task 1 Step 3) vía `M.precip[kp]`. Clave = `locs[i].key` = `lat.toFixed(2)+','+lng.toFixed(2)` (de `meteoLocs`); `outdoorFor` re-parsea con `k.split(',').map(Number)` — igual que `windFor`/`auroraFor`.
- `outdoorFor(day)` → `null | {level, txt, stale, score}` — Task 1 Step 3; `dayBlock` usa `level`/`txt` (Step 4), `outdoorRankBlock` usa `score` (Step 5). `day` = objeto de `buildItinerary().days` (`{date, idx, items, km}`), el mismo que `dayBlock`/`windFor` reciben.
- `outdoorRankBlock(it)` — Task 1 Step 5; llamada en `renderItinerario` con `it` = retorno de `buildItinerary()` (`{days, unassigned, count}`). Devuelve siempre un `<section>` (oculto si < 2), como `itinFuelBlock`.
- `fmtFecha` — helper existente; `outdoorRankBlock` lo usa para el tag de día.
- `isIceCenter`, `haversine`, `locForDate` — existentes (A2/A3); `outdoorFor` los usa igual que `windFor`.
- `PLAN_B` = `{intro:str, zonas:[{z:str, items:[str]}]}` — Task 2 Step 1; leído solo por `renderPlanB` (Step 2): `.intro`, `.zonas.map(g => g.z, g.items)`.
- `renderPlanB(body)` — Task 2 Step 2 (tras `renderCarreteras`); llamada en `renderReco` (Step 3) entre `renderCarreteras` y `renderEmergencias`. Firma idéntica a `renderCarreteras`.
- Clases CSS: `.day-out`, `.day-out--regular`, `.day-out--malo`, `.itin-outlook`, `.itin-outlook__nudge` — Task 1 Step 6 las define; Task 1 Steps 4-5 las aplican. `.reco-cat*`/`.reco-card`/`.emerg-intro` (bloque de Ideas) ya existen. `--c-surface`, `--c-border-soft`, `--radius-m`, `--c-warning`, `--c-text-2` ya en `:root`.
- `shell-v22` / `?v=22` — Task 1 Step 7; verificado Step 8 y Task 2 Step 5. Precache 28 = las 28 de A4 con `style.css`/`app.js` a `?v=22`. Sin assets nuevos.

Sin inconsistencias.
