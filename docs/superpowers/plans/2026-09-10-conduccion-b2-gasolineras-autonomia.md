# Conducción · B2 — Gasolineras y autonomía — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Por día en el Itinerario, las gasolineras fiables en la ruta de ese día y el tramo más largo sin ninguna (ámbar/rojo si se acerca a la autonomía); depósito editable + autonomía cómoda en el panel de D2; y un bloque «Gasolineras y autonomía» en Ideas con los tramos largos conocidos.

**Architecture:** Todo en `app.js` + CSS/README/release. `state.combustible` gana `deposito`; getters `depositoL()`/`autonomiaKm()` junto a los de D2. `GASOLINERAS` (lista curada con coords) + `fuelStopsFor(day)` que recorre las paradas del día (`driveByRoad` de B1) y busca estaciones a ≤ 12 km. Línea `.day-fuelstops` en `dayBlock`. `itinFuelBlock` gana un campo Depósito y muestra la autonomía. `GASINFO` + `renderGasolineras(body)` es un bloque de contenido en Ideas gemelo de `renderCarreteras`. Release `shell-v24`.

**Tech Stack:** HTML + CSS + JS vanilla, sin build/framework/tests. Cálculo local (sin API). Verificación manual con DevTools + `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-conduccion-b2-gasolineras-autonomia-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva**, sin `fetch`. IIFE, `'use strict'`, copy/comentarios en español.
- `blankFuel()` → `{ consumo: 7, precioL: 309, tipo: 'Diésel', deposito: 50 }`. `load()` ya hace `Object.assign(blankFuel(), p.combustible || {})` → cubre `deposito`.
- `depositoL()` = `(+FUEL().deposito > 0 ? +FUEL().deposito : 50)`. `autonomiaKm()` = `Math.round(depositoL() * 0.8 / litros100() * 100)`.
- `GASOLINERAS` = array de `{ n:string, lat:number, lng:number }` (~30, estaciones fiables N1/Olís/ÓB/Orkan/Costco en/junto a la Ruta 1 y los desvíos del viaje; coords aproximadas 4-5 decimales).
- `fuelStopsFor(day)` → `null` | `{ nombres:[str], maxGap:number, aut:number, level:'aviso'|'fuerte'|null }`:
  - `pts` = `day.items` con `loc.lat != null` ordenados por `sortT`, más `locForDate(day.date)` al final. Si `< 2` → `null`.
  - `cerca(P)` = `GASOLINERAS.some(g => haversine(g, P) <= 12)`.
  - recorrer `pts`: `gap=0`; para `i>0`, `gap += driveByRoad(pts[i-1], pts[i]).km`; si `cerca(pts[i])` → `maxGap = Math.max(maxGap, gap); gap = 0`. Al final `maxGap = Math.max(maxGap, gap)`.
  - `nombres` = nombres de `GASOLINERAS` a ≤ 12 km de algún `pt`, deduplicados, en orden de aparición a lo largo de `pts`.
  - `aut = autonomiaKm()`; `level`: `maxGap >= aut` → `'fuerte'`; `>= aut*0.75` → `'aviso'`; si no → `null`.
  - si `nombres.length === 0 && maxGap < 60` → `null`.
  - return `{ nombres, maxGap: Math.round(maxGap), aut, level }`.
- `dayBlock`: tras `.day-fuel` (D2) y **antes** de `.day-wind` (A3), si `fuelStopsFor(day)` no es `null` **y** `day.km >= 40`: `<p class="day-fuelstops[ day-fuelstops--{level}]">⛽ gasolineras hoy: {nombres.join(' · ') || 'ninguna fiable en ruta'}[ · tramo más largo sin repostar: ~{maxGap} km si maxGap>=60]</p>` con `esc()` en las partes variables.
- `itinFuelBlock`: generalizar `mkNum` con un 6º parámetro `get` (getter del valor). Los 3 campos: `consumo` (`litros100`), `precioL` (`precioLitro`), **`deposito`** (`depositoL`, `step="1" min="0" max="200"`, unidad `L`). El `change` de `deposito`: `state.combustible = Object.assign(blankFuel(), state.combustible, { deposito: v })`. Añadir bajo el `<summary>` una línea `Autonomía cómoda ~{autonomiaKm()} km` (o incluirlo en el texto del `<summary>`).
- `GASINFO` = `{ intro:str, tramos:[str], nota:str }`. `renderGasolineras(body)` gemela de `renderCarreteras`: `<section class="reco-cat">` badge `⛽`, `<h3>Gasolineras y autonomía</h3>`, `<p class="emerg-intro">{esc(intro)}</p>`, una `.reco-card` por `tramos[]` (`esc`), y un card final con `{esc(nota)}`. Llamada en `renderReco()` **tras** `renderCarreteras(body)` y **antes** de `renderPlanB(body)`.
- `esc()` en todo el texto variable. `<b>`/scaffold literales.
- CSS: `.day-fuelstops`, `.day-fuelstops--aviso` (`--c-warning`), `.day-fuelstops--fuerte` (`--c-danger` + 600). Bloque de Ideas reutiliza `.reco-cat*`.
- Release: `?v=23 → ?v=24` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`; `sw.js` `SHELL_CACHE` `shell-v23 → shell-v24`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache **28**.
- Commits: uno por tarea, español, sin atribución. **Usar la tool de edición para `index.html`/`sw.js` — nunca `Set-Content` de PowerShell (corrompe UTF-8 + BOM).** `git push origin main` tras cada commit.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `deposito` en `blankFuel`; `depositoL`/`autonomiaKm`; `GASOLINERAS`; `fuelStopsFor(day)`; línea `.day-fuelstops` en `dayBlock`; campo Depósito + autonomía en `itinFuelBlock` (`mkNum` con getter); `GASINFO` + `renderGasolineras(body)` + llamada en `renderReco`. |
| `index.html` | Modificar | `?v=23 → ?v=24`. |
| `sw.js` | Modificar | `shell-v23 → shell-v24`; `?v=24` en `SHELL_ASSETS`. |
| `style.css` | Modificar | `.day-fuelstops`, `.day-fuelstops--aviso`, `.day-fuelstops--fuerte`. |
| `README.md` | Modificar | Una frase. |

Orden: **1** (estado + `GASOLINERAS` + `fuelStopsFor` + línea + panel + CSS + release) → **2** (`GASINFO` + `renderGasolineras` + README).

---

### Task 1: `deposito`, `GASOLINERAS`, `fuelStopsFor`, línea por día, panel de autonomía, CSS y release `shell-v24`

**Files:**
- Modify: `app.js` (`blankFuel` ~línea 148; getters D2 ~línea 188-190; `windFor`/`dayBlock` zona ~línea 1685-1870; `itinFuelBlock` ~línea 1652-1671), `index.html`, `sw.js`, `style.css`
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: `FUEL`/`litros100` (D2), `haversine`/`driveByRoad`/`locForDate` (B1), `el`, `esc`, `buildItinerary().days`.
- Produces: `state.combustible.deposito`; `depositoL()`, `autonomiaKm()`; `GASOLINERAS`; `fuelStopsFor(day)` → `null | {nombres, maxGap, aut, level}`.

- [ ] **Step 1: `deposito` en `blankFuel` + getters**

```js
  const blankFuel = () => ({ consumo: 7, precioL: 309, tipo: 'Diésel' });
```
→
```js
  const blankFuel = () => ({ consumo: 7, precioL: 309, tipo: 'Diésel', deposito: 50 });
```
En el bloque de helpers de D2 (junto a `litros100`/`precioLitro`):
```js
  const litros100  = () => { const c = +FUEL().consumo; return c > 0 ? c : 7; };
  const precioLitro = () => { const p = +FUEL().precioL; return p > 0 ? p : 309; };
```
→ añadir:
```js
  const litros100  = () => { const c = +FUEL().consumo; return c > 0 ? c : 7; };
  const precioLitro = () => { const p = +FUEL().precioL; return p > 0 ? p : 309; };
  const depositoL  = () => { const d = +FUEL().deposito; return d > 0 ? d : 50; };
  const autonomiaKm = () => Math.round(depositoL() * 0.8 / litros100() * 100);   // reserva 20 %
```

- [ ] **Step 2: `GASOLINERAS`**

En `app.js`, justo antes de `function windFor(day) {` (o junto a los otros datos de conducción):
```js
  // Gasolineras fiables (N1 / Olís / ÓB / Orkan / Costco) en o junto a la ruta del
  // viaje. Coords aproximadas del pueblo/estación. Para el aviso de autonomía B2.
  const GASOLINERAS = [
    { n: 'Costco (Reikiavik)', lat: 64.0870, lng: -21.9260 },
    { n: 'N1 Reikiavik (varias)', lat: 64.1370, lng: -21.8950 },
    { n: 'Orkan Keflavík', lat: 64.0100, lng: -22.5650 },
    { n: 'N1 Selfoss', lat: 63.9330, lng: -21.0000 },
    { n: 'Orkan Hveragerði', lat: 64.0000, lng: -21.1900 },
    { n: 'N1 Hvolsvöllur', lat: 63.7500, lng: -20.2200 },
    { n: 'N1 Vík', lat: 63.4200, lng: -19.0100 },
    { n: 'N1 Kirkjubæjarklaustur', lat: 63.7900, lng: -18.0600 },
    { n: 'N1 Höfn', lat: 64.2530, lng: -15.2110 },
    { n: 'Olís Djúpivogur', lat: 64.6650, lng: -14.2830 },
    { n: 'N1 Breiðdalsvík', lat: 64.7920, lng: -14.0100 },
    { n: 'N1 Egilsstaðir', lat: 65.2660, lng: -14.3940 },
    { n: 'Orkan Reyðarfjörður', lat: 65.0330, lng: -14.2200 },
    { n: 'Olís Reykjahlíð (Mývatn)', lat: 65.6420, lng: -16.9130 },
    { n: 'N1 Akureyri', lat: 65.6840, lng: -18.0900 },
    { n: 'N1 Varmahlíð', lat: 65.5340, lng: -19.4300 },
    { n: 'N1 Blönduós', lat: 65.6580, lng: -20.2880 },
    { n: 'Staðarskáli (Brú)', lat: 65.1850, lng: -21.0900 },
    { n: 'N1 Borgarnes', lat: 64.5390, lng: -21.9200 },
    { n: 'Olís Búðardalur', lat: 65.1120, lng: -21.7550 },
    { n: 'N1 Laugarvatn', lat: 64.2130, lng: -20.7300 },
    { n: 'ÓB Flúðir', lat: 64.1330, lng: -20.3130 },
    { n: 'Orkan Þorlákshöfn', lat: 63.8580, lng: -21.3830 },
    { n: 'N1 Grindavík', lat: 63.8420, lng: -22.4340 }
  ];
```

- [ ] **Step 3: `fuelStopsFor(day)`**

**Corrección de diseño respecto a la primera versión de este plan**: comprobar solo
si una gasolinera está «cerca de un waypoint» (parada del día) deja fuera las
que están **de camino entre dos paradas** pero no son ellas mismas un item del
itinerario — p. ej. Vík o Kirkjubæjarklaustur, que se cruzan en la Ruta 1 pero
no siempre tienen una excursión/comida asociada ese día. Eso producía falsos
«ninguna fiable en ruta» en días que sí pasan por un pueblo con gasolinera.
Primer fix: comprobar cada **tramo** (par de puntos consecutivos) contra un
test de desvío — la gasolinera «está en» ese tramo si ir a por ella no añade
más de ~24 km de ida y vuelta sobre la línea recta. Además, el primer punto
de la ruta del día es **dónde dormiste anoche** (`locForDate` del día
anterior), no solo los items de hoy — así el tramo de salida también se
comprueba.

**Segunda corrección (tras revisión final con subagente opus, ver ledger)**:
el primer fix de arriba se implementó y se envió (`a24a0eb`), pero tenía dos
fallos reales, confirmados con un harness numérico standalone que replica
`haversine`/`driveByRoad`/`GASOLINERAS`/`fuelStopsFor` fuera del navegador:

1. **`maxGap` nunca medía el hueco real**: el bucle solo acumulaba `legKm` en
   `maxGap` cuando el tramo **entero** no tenía ninguna gasolinera cerca; si
   una gasolinera caía cerca de un extremo del tramo pero el resto del tramo
   (p. ej. 190 de 200 km) estaba vacío, ese tramo contaba como "cubierto" y
   aportaba **0** a `maxGap`. Verificado: en 8 días representativos del
   itinerario real, `maxGap` daba **0** en absolutamente todos — el aviso de
   tramo largo (objetivo §2.1 del spec) era código muerto.
2. **Semilla "ayer" con `ICE_CENTER`**: en el primer día del viaje (o
   cualquier día sin pernocta real la noche anterior), `locForDate("ayer")`
   cae al *fallback* `ICE_CENTER` (centro geográfico de Islandia) y
   `fuelStopsFor` lo aceptaba como punto de ruta real (`ayer.lat != null` es
   cierto también para `ICE_CENTER`), inventando un tramo de cientos de km
   con gasolineras de sitios que no tienen nada que ver con la ruta real de
   ese día — cobertura falsa o hueco falso, según el caso. `isIceCenter` ya
   existe en el archivo (usado por `windFor`/`meteoLocs` con el mismo
   propósito) y no se estaba reutilizando aquí.
3. (Relacionado con 1) El test de desvío `haversine(A,g)+haversine(g,B)-
   haversine(A,B) <= 24` admite un desvío perpendicular que **crece con la
   longitud del tramo** (≈ `sqrt(12·L)`): a 200 km de tramo, una gasolinera a
   50 km en línea recta de la carretera ya cuenta como "en ruta" — en la
   práctica islandesa eso puede ser un rodeo real de 100+ km por carretera.
   Compone el fallo 1.
4. El orden de `nombres` era el de aparición en el array `GASOLINERAS`
   dentro de cada tramo, no el orden real a lo largo de la ruta — el mismo
   trayecto en los dos sentidos (A→B y B→A) devolvía la lista idéntica.

**Fix aplicado** (sustituye por completo el `onLeg` de desvío-por-exceso):
para cada tramo se proyecta cada gasolinera sobre el segmento A→B usando una
aproximación plana en km (válida a la escala de Islandia — factor de
longitud/latitud, sin geometría esférica completa), se mide la distancia
perpendicular real (no el exceso de ida-y-vuelta) contra un umbral **fijo**
de 15 km, y se anota el punto de corte en **km acumulados de ruta** (no de
tramo). Al final se ordenan todos los cortes por km y el hueco más largo se
mide entre paradas consecutivas a lo largo de **toda** la ruta del día, no
tramo a tramo — así una gasolinera al principio de un tramo largo ya no
"tapa" el resto del tramo. El orden de `nombres` sale de los cortes ya
ordenados por km, así que refleja el orden real de la ruta. La semilla
"ayer"/"hoy" descarta explícitamente `ICE_CENTER`. De paso se añadieron 3
gasolineras de Snæfellsnes (Ólafsvík, Grundarfjörður, Stykkishólmur) que
faltaban en `GASOLINERAS` — hueco de datos real detectado en la misma
revisión, sin relación con la lógica pero barato de cerrar.

Verificado con el harness standalone contra los 8 días de antes: los tramos
que el spec §1 usa como motivación (Klaustur→Höfn, Höfn→Egilsstaðir,
Egilsstaðir→Mývatn) pasan de `maxGap=0` a `202`/`164`/`192` km; el día 1 sin
semilla `ICE_CENTER` da un hueco realista (~38 km) en vez de un hueco/cobertura
inventados; el mismo tramo en los dos sentidos da listas en orden opuesto
coherente; bajando depósito/consumo a valores pequeños el nivel `aviso`/
`fuerte` sí se dispara (antes nunca lo hacía, con ningún valor). Repetido en
el navegador contra el itinerario real de 9 días: las líneas `.day-fuelstops`
ahora muestran `tramo más largo sin repostar: ~NN km` en 6 de los 8 días con
`km>=40` (antes, en ninguno); con depósito 15 L, 4 días pasan a `--fuerte`
correctamente y 0 con depósito 50 L (por defecto) — sin falsos positivos.

En `app.js`, junto a `windFor` (antes o después):
```js
  // Gasolineras fiables en la ruta del día + tramo más largo sin ninguna. El
  // primer punto de la ruta es dónde dormiste anoche (locForDate del día
  // anterior, salvo que caiga en el fallback ICE_CENTER — día sin pernocta
  // real, no se usa como punto de ruta) para comprobar también el tramo de
  // salida. day.items ya viene ordenado por sortT (buildItinerary), así que
  // pts refleja el orden real de visita. Una gasolinera "está en" un tramo
  // A→B si su desvío perpendicular a la línea recta A→B (aproximación plana
  // en km, válida a la escala de Islandia) es ≤ UMBRAL_KM; se proyecta sobre
  // el tramo para saber a qué km de ruta cae, y el hueco más largo se mide
  // entre paradas consecutivas a lo largo de TODA la ruta (no tramo a tramo,
  // para que una gasolinera cerca del principio de un tramo no "tape" un
  // hueco largo al final del mismo tramo).
  function fuelStopsFor(day) {
    const pts = [];
    const hoyDt = parseDate(day.date);
    if (hoyDt) {
      const ayerDt = new Date(hoyDt); ayerDt.setDate(ayerDt.getDate() - 1);
      const ayer = locForDate(ymd(ayerDt));
      if (ayer && ayer.lat != null && !isIceCenter(ayer)) pts.push(ayer);
    }
    day.items.forEach(x => { if (x.loc && x.loc.lat != null) pts.push(x.loc); });
    const fin = locForDate(day.date);
    if (fin && fin.lat != null && !isIceCenter(fin)) pts.push(fin);
    if (pts.length < 2) return null;

    const UMBRAL_KM = 15;   // desvío perpendicular admitido a la ruta
    const cuts = [];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const A = pts[i - 1], B = pts[i];
      const legKm = driveByRoad(A, B).km;
      const latRef = (A.lat + B.lat) / 2;
      const kmLat = 110.574, kmLng = 111.320 * Math.cos(latRef * Math.PI / 180);
      const toXY = p => ({ x: p.lng * kmLng, y: p.lat * kmLat });
      const a = toXY(A), b = toXY(B);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      GASOLINERAS.forEach(g => {
        const p = toXY(g);
        let t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const dist = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
        if (dist <= UMBRAL_KM) cuts.push({ km: acc + legKm * t, n: g.n });
      });
      acc += legKm;
    }
    cuts.sort((x, y) => x.km - y.km);
    const nombres = [];
    cuts.forEach(c => { if (nombres.indexOf(c.n) === -1) nombres.push(c.n); });
    let maxGap = 0, prev = 0;
    cuts.forEach(c => { maxGap = Math.max(maxGap, c.km - prev); prev = c.km; });
    maxGap = Math.max(maxGap, acc - prev);

    if (!nombres.length && maxGap < 60) return null;
    const aut = autonomiaKm();
    const level = maxGap >= aut ? 'fuerte' : maxGap >= aut * 0.75 ? 'aviso' : null;
    return { nombres, maxGap: Math.round(maxGap), aut, level };
  }
```
*(`parseDate`/`ymd` son los helpers de fecha local del propio archivo —
`parseDate` da un `Date` a mediodía local, igual que usa `eachDay`; se
reutiliza el mismo patrón para "ayer" en vez de aritmética en `Date.parse`.
`isIceCenter` ya existe en el archivo, se reutiliza tal cual.)*

**Nota sobre §5 del spec (accumulate + `cerca` 12 km) y §11**: ambos textos
describen el algoritmo original, ya superado dos veces (primero por el fix
de tramo/desvío, ahora por el de proyección/cross-track). Este Step 3 es la
versión autoritativa; el spec queda como registro histórico del objetivo,
no del algoritmo exacto.

- [ ] **Step 4: Línea `.day-fuelstops` en `dayBlock`**

En `app.js`, en `dayBlock`, **entre** el bloque `.day-fuel` (D2) y el bloque `.day-wind` (A3):
```js
      pf.innerHTML = `⛽ ~<span>${litTxt} L</span> · ${fmtISK(fe.isk)} <span class="muted">· ≈ ${fmtEUR(fe.eur)}</span>`;
      wrap.appendChild(pf);
    }

    const w = windFor(day);
```
→
```js
      pf.innerHTML = `⛽ ~<span>${litTxt} L</span> · ${fmtISK(fe.isk)} <span class="muted">· ≈ ${fmtEUR(fe.eur)}</span>`;
      wrap.appendChild(pf);
    }

    const fs = (day.km || 0) >= 40 ? fuelStopsFor(day) : null;
    if (fs) {
      const pfs = el('p', 'day-fuelstops' + (fs.level ? ' day-fuelstops--' + fs.level : ''));
      const lista = fs.nombres.length ? fs.nombres.join(' · ') : 'ninguna fiable en ruta';
      const gap = fs.maxGap >= 60 ? ' · tramo más largo sin repostar: ~' + fs.maxGap + ' km' : '';
      pfs.innerHTML = `⛽ gasolineras hoy: ${esc(lista + gap)}`;
      wrap.appendChild(pfs);
    }

    const w = windFor(day);
```

- [ ] **Step 5: Campo Depósito + autonomía en `itinFuelBlock`**

En `app.js`, `itinFuelBlock`, generalizar `mkNum` para tomar un getter:
```js
    const mkNum = (k, label, unit, step, max) => {
      const wrap = el('label', 'field');
      wrap.innerHTML = `<span>${label}</span>`;
      const inp = el('input');
      inp.type = 'number'; inp.step = step; inp.min = '0'; inp.max = String(max);
      inp.inputMode = step === '1' ? 'numeric' : 'decimal';
      inp.dataset.fuel = k;
      inp.value = String(k === 'consumo' ? litros100() : precioLitro());
      ...
    };
    cfg.appendChild(mkNum('consumo', 'Consumo', 'L/100 km', '0.1', 50));
    cfg.appendChild(mkNum('precioL', 'Precio', 'ISK/L', '1', 5000));
```
→
```js
    const mkNum = (k, label, unit, step, max, get) => {
      const wrap = el('label', 'field');
      wrap.innerHTML = `<span>${label}</span>`;
      const inp = el('input');
      inp.type = 'number'; inp.step = step; inp.min = '0'; inp.max = String(max);
      inp.inputMode = step === '1' ? 'numeric' : 'decimal';
      inp.dataset.fuel = k;
      inp.value = String(get());
      ...
    };
    cfg.appendChild(mkNum('consumo', 'Consumo', 'L/100 km', '0.1', 50, litros100));
    cfg.appendChild(mkNum('precioL', 'Precio', 'ISK/L', '1', 5000, precioLitro));
    cfg.appendChild(mkNum('deposito', 'Depósito', 'L', '1', 200, depositoL));
```
Y una línea con la autonomía tras los campos (antes de `box.appendChild(cfg)`):
```js
    const aut = el('p', 'field');
    aut.style.marginTop = 'var(--space-8)';
    aut.innerHTML = `<span>Autonomía cómoda</span> <span class="field__unit">~${autonomiaKm()} km</span>`;
    cfg.appendChild(aut);
```
*(El `change` genérico de `mkNum` ya hace `state.combustible = Object.assign(blankFuel(), state.combustible, { [k]: v })`, así que `deposito` se guarda sin código extra. `commit(k)` re-pinta y el `<details>` se mantiene abierto por `itinFuelOpen`.)*

- [ ] **Step 6: Estilos**

En `style.css`, junto a `.day-wind` (A3):
```css
/* Gasolineras en ruta del día (B2) */
.day-fuelstops { font-size: var(--step--1); color: var(--c-text-2); margin: var(--space-4) 0 0; }
.day-fuelstops--aviso { color: var(--c-warning); }
.day-fuelstops--fuerte { color: var(--c-danger); font-weight: 600; }
```

- [ ] **Step 7: Release `shell-v24`**

- `index.html` (con la tool Edit): `style.css?v=23` → `?v=24`; `app.js?v=23` → `?v=24`.
- `sw.js` (con la tool Edit): `const SHELL_CACHE = 'shell-v23';` → `'shell-v24'`; `'./style.css?v=23'` → `'./style.css?v=24'`; `'./app.js?v=23'` → `'./app.js?v=24'`.

- [ ] **Step 8: Verificar**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
Navegador limpio (Unregister SW + borrar Cache Storage + `localStorage.clear()`), **Itinerario** vista «Todos»:
1. Cada día con `km >= 40` muestra `⛽ gasolineras hoy: N1 … · Olís … · … · tramo más largo sin repostar: ~NN km` bajo la línea de combustible D2.
2. Panel de combustible (`<details>` en la cabecera): campo **Depósito** editable (por defecto 50 L) y línea `Autonomía cómoda ~NNN km` (≈ 571 con 50 L / 7 L/100).
3. Bajar Depósito a 15 (o subir Consumo a 12) → la autonomía baja; algún día `.day-fuelstops` pasa a ámbar (`--aviso`) o rojo (`--fuerte`).
4. `document.querySelectorAll('.day-fuelstops').length` > 0; ningún `<b>`/HTML literal visible; caracteres islandeses (Kirkjubæjarklaustur, Reykjahlíð, Djúpivogur) bien.
5. `caches.keys()` → `["shell-v24"]`; `(await (await caches.open('shell-v24')).keys()).length` → **28**; sin `shell-v23`.
6. `?v=24` en `<link>` y `<script>`. Consola sin errores en las 5 pantallas.

- [ ] **Step 9: Commit y push**

```powershell
git add app.js index.html sw.js style.css
git commit -m "Conduccion B2: gasolineras en ruta y tramo mas largo sin repostar por dia + deposito/autonomia en el panel" -q
git push origin main
```

---

### Task 2: `GASINFO` + `renderGasolineras(body)` en Ideas + README

**Files:**
- Modify: `app.js` (`GASINFO` junto a `CARRETERAS`; `renderGasolineras` junto a `renderCarreteras`; llamada en `renderReco`), `README.md`
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: `el`, `esc`.
- Produces: `GASINFO` (objeto), `renderGasolineras(body)` → void.

- [ ] **Step 1: `GASINFO`**

En `app.js`, tras el cierre de `const CARRETERAS = { … };` y antes de `const PLAN_B`:
```js
  /* Gasolineras y autonomía (Conducción B2). Los tramos largos conocidos de la ruta. */
  const GASINFO = {
    intro: 'En Islandia las estaciones fiables son N1, Olís, ÓB y Orkan (y Costco en Reikiavik). Muchas son automáticas 24 h: hace falta tarjeta con chip y PIN. En el este y el norte, no bajes de medio depósito.',
    tramos: [
      'Kirkjubæjarklaustur → Höfn (~200 km): entre ambos no hay nada. Reposta en Kirkjubæjarklaustur antes de salir hacia el este.',
      'Höfn → Egilsstaðir por la costa (Ruta 1, ~250 km): estaciones en Djúpivogur y Breiðdalsvík; por el atajo de la Öxi (939) no hay ninguna.',
      'Egilsstaðir → Mývatn (~165 km por la Ruta 1): nada en medio; el páramo de Möðrudalur no cuenta. Sal lleno de Egilsstaðir.',
      'Mývatn → Akureyri (~100 km): solo la de Reykjahlíð (Mývatn) y ya las de Akureyri.',
      'Círculo Dorado: Laugarvatn, Flúðir y Selfoss; Þingvellir y Geysir no tienen.',
      'Interior y F-roads (Kjölur, Sprengisandur, Landmannalaugar): sin gasolineras. En octubre están cerradas de todas formas.'
    ],
    nota: 'Regla práctica para este viaje (Duster, ~50 L): con el depósito lleno tienes de sobra para cualquier etapa de la Ruta 1. El riesgo real es olvidarse de repostar en el pueblo y darse cuenta a mitad del páramo.'
  };
```

- [ ] **Step 2: `renderGasolineras(body)`**

En `app.js`, tras el cierre de `function renderCarreteras(body) { … }`:
```js
  function renderGasolineras(body) {
    const sec = el('section', 'reco-cat');
    sec.style.setProperty('--rc', '200');
    sec.innerHTML =
      `<div class="reco-cat__head">` +
      `<span class="reco-cat__badge">⛽</span>` +
      `<h3>Gasolineras y autonomía</h3>` +
      `</div>` +
      `<p class="emerg-intro">${esc(GASINFO.intro)}</p>` +
      `<div class="reco-cat__list">` +
      GASINFO.tramos.map(t => `<div class="reco-card">${esc(t)}</div>`).join('') +
      `<div class="reco-card">${esc(GASINFO.nota)}</div>` +
      `</div>`;
    body.appendChild(sec);
  }
```

- [ ] **Step 3: Llamar `renderGasolineras` en `renderReco()`**

```js
    renderCarreteras(body);
    renderPlanB(body);
```
→
```js
    renderCarreteras(body);
    renderGasolineras(body);
    renderPlanB(body);
```

- [ ] **Step 4: README**

En `README.md`, añadir una frase (p. ej. tras la de carreteras): "El Itinerario lista las **gasolineras fiables** de cada día y el tramo más largo sin ninguna, y el panel de combustible calcula la **autonomía cómoda** según depósito y consumo."

- [ ] **Step 5: Verificar**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio, **Ideas** (`#reco`):
1. Tras «Carreteras: antes de conducir» aparece **«⛽ Gasolineras y autonomía»**: intro + **6 cards** de tramos + 1 card de nota; antes de «Plan B para días de lluvia o viento».
2. `[...document.querySelectorAll('#reco-body .reco-cat h3')].map(h=>h.textContent)` → incluye «Gasolineras y autonomía» entre «Carreteras: antes de conducir» y «Plan B para días de lluvia o viento».
3. Mismo aspecto que los bloques de arriba; caracteres islandeses (Kirkjubæjarklaustur, Möðrudalur, Reykjahlíð, Landmannalaugar) bien; nada de HTML literal.
4. Recorrer las 5 pantallas → consola sin errores.

- [ ] **Step 6: Commit y push**

```powershell
git add app.js README.md
git commit -m "Conduccion B2: bloque 'Gasolineras y autonomia' con los tramos largos en Ideas" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2.1 gasolineras por día + tramo más largo (ámbar/rojo según autonomía) | Task 1 Steps 3-4 |
| §2.2 depósito editable + autonomía en el panel | Task 1 Steps 1, 5 |
| §2.3 bloque de referencia en Ideas | Task 2 Steps 1-3 |
| §3 no-objetivos (sin API/datos en vivo, sin ruteo real, no toca B1/D2/A3/A5, no repite pago) | Cálculo local sobre `day.items` + `GASOLINERAS`; línea `.day-fuelstops` aparte |
| §4.1 `deposito` + getters | Task 1 Step 1 |
| §4.2 `GASOLINERAS` | Task 1 Step 2 |
| §5 `fuelStopsFor` (pts, cerca 12 km, gap/maxGap, nombres, level, null-cases) | Task 1 Step 3 (código = spec) |
| §6 render `.day-fuelstops` (tras `.day-fuel`, antes `.day-wind`, `km>=40`) | Task 1 Step 4 |
| §7 panel: campo Depósito + autonomía (`mkNum` con getter) | Task 1 Step 5 |
| §8 `GASINFO` + `renderGasolineras` (entre Carreteras y Plan B) | Task 2 Steps 1-3 |
| §9 estilos | Task 1 Step 6 |
| §10 integración + release `?v=24`/`shell-v24`/precache 28 | Task 1 Steps 7-8, Task 2 |
| §11 casos borde (pts<2, día corto, valores corruptos, sin estaciones, ICE_CENTER, offline) | Guards en `fuelStopsFor`; `day.km>=40`; getters con default |
| §12 pruebas 1-5 | Task 1 Step 8, Task 2 Step 5 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". `GASOLINERAS`, `fuelStopsFor`, `GASINFO`, `renderGasolineras` completos en sus Steps. Verificaciones con `Run:`/`Expected:` concretos (texto de la línea, valor de autonomía ≈ 571, recuento de caché, orden de `<h3>`).

**3. Consistencia de tipos y nombres**

- `blankFuel()` → `{consumo, precioL, tipo, deposito}` — Task 1 Step 1; `load` ya lo cubre por `Object.assign`; `mkNum('deposito', …)` escribe `Object.assign(blankFuel(), state.combustible, {deposito:v})` (Task 1 Step 5).
- `depositoL()` / `autonomiaKm()` → number — Task 1 Step 1; usados en `fuelStopsFor` (Step 3), `mkNum` getter y la línea de autonomía (Step 5).
- `GASOLINERAS` = `[{n,lat,lng}]` — Task 1 Step 2; leído por `fuelStopsFor` (`haversine(g, P)`, `g.n`).
- `fuelStopsFor(day)` → `null | {nombres:[str], maxGap:number, aut:number, level:'aviso'|'fuerte'|null}` — Task 1 Step 3; consumido en `dayBlock` (Step 4): `fs.level`, `fs.nombres`, `fs.maxGap`. `day` = objeto de `buildItinerary().days` (`{date, idx, items, km}`), el mismo que recibe `dayBlock`/`windFor`/`outdoorFor`. `day.items[].sortT` existe (lo usa `buildItinerary` para ordenar).
- `driveByRoad(a,b)` → `{km,min}` (B1); `haversine(a,b)` → km (B1). `fuelStopsFor` usa `.km` y el número.
- `locForDate(day.date)` → `{lat,lng,label}` (A1); `fuelStopsFor` lo añade como `pt` final (comprueba `.lat != null`).
- `mkNum(k, label, unit, step, max, get)` — 6º parámetro nuevo; las 3 llamadas pasan `litros100`/`precioLitro`/`depositoL`. Ningún otro sitio llama `mkNum`.
- Clases CSS: `.day-fuelstops`, `.day-fuelstops--aviso`, `.day-fuelstops--fuerte` — Task 1 Step 6 las define; Task 1 Step 4 las aplica. `--c-warning`/`--c-danger` ya en `:root` (los usan `.day-wind--*`).
- `GASINFO` = `{intro:str, tramos:[str], nota:str}` — Task 2 Step 1; leído solo por `renderGasolineras` (Step 2).
- `renderGasolineras(body)` — Task 2 Step 2 (tras `renderCarreteras`); llamada en `renderReco` (Step 3) entre `renderCarreteras` y `renderPlanB`. Firma idéntica a `renderCarreteras`. `--rc: 200` — coincide con `renderPlanB` (`210`)/`renderCarreteras` (`256`); no colisiona visualmente de forma problemática (tinte del borde izquierdo).
- `shell-v24` / `?v=24` — Task 1 Step 7; verificado Step 8. Precache 28 = las 28 de v23 con `style.css`/`app.js` a `?v=24`. Sin assets nuevos.

Sin inconsistencias.
