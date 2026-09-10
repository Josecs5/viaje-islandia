# Conducción · B1 — Tiempos reales y "¿día viable?" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la estimación de trayectos en línea recta del itinerario por un tiempo por carretera con factor de rodeo por región (offline), y añadir un semáforo verde/ámbar/rojo por día calculado con una simulación de horario (anclas, hora de salida, hora de fin, luz de A1, horas al volante).

**Architecture:** Todo en `app.js`. `driveByRoad(a, b)` multiplica la distancia `haversine` por un factor según la zona (tabla de cajas lat/lng) y la divide por una velocidad media; sustituye a `driveEst`. `dayPlan(day)` es una función pura que consume la salida de `buildItinerary()`, recorre los elementos del día en orden intercalando tramos, ancla los eventos con hora fija y devuelve el veredicto. `dayBlock()` (en `renderItinerario`) pinta un badge en la cabecera del día y una línea de resumen. Release nuevo del service worker (`shell-v15`).

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. SunCalc 1.9.0 (ya vendorizado, se le añaden 2 campos). Verificación manual con DevTools servida por `python -m http.server`, cotejo de tiempos contra Google Maps.

**Spec:** `docs/superpowers/specs/2026-09-10-conduccion-b1-tiempos-y-viabilidad-design.md`

## Global Constraints

- Vanilla JS, sin build, sin dependencias nuevas, sin archivos nuevos (`ZONAS` es un `const` en `app.js`). Estilo del repo: IIFE, `'use strict'`, comentarios y copy en español.
- Ninguna API externa. Todo cálculo local; funciona offline.
- B1 **solo diagnostica**: no reordena el itinerario ni sugiere cambios.
- Sin precisión al minuto: el objetivo es distinguir "día de 3 h" de "día de 7 h" y avisar de días inviables.
- No se toca geocodificación, Mapas, ni Clima salvo añadir `civilDawn` / `civilDusk` a `sky()`.
- `driveByRoad(a, b)` → `{ km, min }`. `km` = `haversine(a,b) * factor(zona)` (km "de ruta"); se muestra como "km en coche". Sustituye a `driveEst(km)`, que **se elimina**.
- `ZONAS` (primera coincidencia gana; decide el punto medio del tramo):
  | zona | lat | lng | factor |
  |---|---|---|---|
  | Suroeste / Reykjavík / Reykjanes | 63.80–64.30 | −22.70…−21.30 | 1.18 |
  | Costa sur (Selfoss→Höfn) | 63.30–64.30 | −21.30…−15.00 | 1.12 |
  | Fiordos del este (Höfn→Egilsstaðir) | 64.20–65.40 | −15.30…−13.40 | 1.50 |
  | Norte (Mývatn→Akureyri→Blönduós) | 65.20–66.20 | −19.50…−14.90 | 1.20 |
  | Oeste / pasos (Blönduós→Borgarnes) | 64.60–65.60 | −22.00…−19.30 | 1.25 |
  | *(fuera de todo)* | — | — | 1.35 |
- Constantes: `AVG_KMH = 75`, `PARK_MIN = 4`, `SALIDA_FLOOR_MIN = 450` (07:30), `MARGEN_ATARDECER_MIN = 30`, `MARGEN_ANCLA_MIN = 10`, `VOLANTE_LARGO_H = 4`, `VOLANTE_MAX_H = 6`, `COMIDA_MIN = 50`, `EXCURSION_MIN = 120`, `LUGAR_MIN = 45`.
- `dayPlan(day)` → `{ drivingMin, legs, salirA, endTime, missedAnchor, luz, volante, veredicto }`. Función pura.
  - `luz` ∈ `'ok' | 'justo' | 'pasa' | null`; `volante` ∈ `'ok' | 'largo' | 'excesivo'`; `veredicto` ∈ `'verde' | 'ambar' | 'rojo' | null`.
  - `veredicto` = peor de los dos vía `rank = { ok:0, justo:1, largo:1, pasa:2, excesivo:2 }` → `['verde','ambar','rojo'][max]`.
  - Día con vuelo y `drivingMin < 30` → `veredicto = null`. Sin `sky` y `volante === 'ok'` → `veredicto = null`.
- Badge solo si `veredicto !== null`. Prioridad de etiqueta en rojo: `missedAnchor` > volante excesivo > luz pasa. Verde = solo el punto, con `title="Día holgado"`.
- Línea `.day-plan` solo si `veredicto !== null`; trozos por ` · `: `Sal sobre las HH:MM` (omitir si `salirA` es > 2 h anterior a `inicio`), `fin ~HH:MM`, `{fmtDur(drivingMin)} al volante` (omitir si `drivingMin === 0`).
- Release: `?v=14 → ?v=15` en `index.html` (css+js) y en `SHELL_ASSETS`; `sw.js` `SHELL_CACHE` `shell-v14 → shell-v15`; `TILE_CACHE` (`tiles-v2`) sin cambios; precache sigue en **28** entradas (sin assets nuevos).
- Horas mostradas `HH:MM` locales del navegador (spec A1 §7).
- Commits: uno por tarea, mensaje en español, sin líneas de atribución. `git push origin main` tras cada commit.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `ZONAS` + `zoneFor` + `driveByRoad` (sustituyen a `driveEst`); `costMin` en los items de `buildItinerary`; `civilDawn`/`civilDusk` en `sky()`; `dayPlan` + helpers; badge y línea de resumen en `dayBlock`. |
| `style.css` | Modificar | `.day-verdict`, `.day-plan`; `--c-warn` / `--c-danger` en `:root` si faltan. |
| `sw.js` | Modificar | `shell-v14 → shell-v15`; `?v=15` en `SHELL_ASSETS`. |
| `index.html` | Modificar | `?v=14 → ?v=15` en `style.css` y `app.js`. |
| `README.md` | Modificar | Nota de tiempos por carretera + viabilidad del día; actualizar el aviso legal. |

Orden: **1** (driveByRoad + release, entregable: los tramos del itinerario muestran tiempos por carretera) → **2** (`dayPlan`, probable por consola) → **3** (badge + línea + CSS + README).

---

### Task 1: `driveByRoad` con factor regional, sustituir `driveEst`, release `shell-v15`

**Files:**
- Modify: `app.js` (zona de utilidades ~línea 73; `legRow` ~1527; `dayBlock` ~1482; `buildItinerary` ~1246-1251), `index.html` (líneas de `style.css` y `app.js`), `sw.js` (`SHELL_CACHE`, `SHELL_ASSETS`)
- Test: verificación manual en navegador + cotejo contra Google Maps

**Interfaces:**
- Consumes: `haversine(a, b)` (helper existente), `fmtDur(min)`.
- Produces:
  - `zoneFor({lat, lng})` → `{ name: string, factor: number }`.
  - `driveByRoad(a, b)` → `{ km: number, min: number }` (`a`, `b` = `{lat, lng}`).
  - `legRow(a, b)` → nodo DOM (firma cambiada de `legRow(km)`).
  - `buildItinerary()` devuelve días con `day.km` acumulado con km de ruta (no en línea recta).
  - `driveEst` deja de existir.

- [ ] **Step 1: Añadir `ZONAS`, `zoneFor` y `driveByRoad` junto a `driveEst`**

En `app.js`, sustituir la línea:
```js
  const driveEst = km => Math.round(km / 65 * 60) + 5; // minutos (aprox. carretera islandesa)
```
por:
```js
  // Tiempo de conducción estimado por carretera: distancia en línea recta ×
  // factor de rodeo según la zona ÷ velocidad media. Offline, sin API.
  const AVG_KMH = 75;   // límite de 90 en abierto, menos pueblos, curvas y meteo
  const PARK_MIN = 4;   // aparcar y arrancar

  const ZONAS = [
    { name: 'suroeste',   lat: [63.80, 64.30], lng: [-22.70, -21.30], factor: 1.18 },
    { name: 'costa sur',  lat: [63.30, 64.30], lng: [-21.30, -15.00], factor: 1.12 },
    { name: 'fiordos E',  lat: [64.20, 65.40], lng: [-15.30, -13.40], factor: 1.50 },
    { name: 'norte',      lat: [65.20, 66.20], lng: [-19.50, -14.90], factor: 1.20 },
    { name: 'oeste',      lat: [64.60, 65.60], lng: [-22.00, -19.30], factor: 1.25 }
  ];
  const ZONA_DEFAULT = { name: 'otro', factor: 1.35 };

  function zoneFor(p) {
    for (const z of ZONAS) {
      if (p.lat >= z.lat[0] && p.lat <= z.lat[1] && p.lng >= z.lng[0] && p.lng <= z.lng[1]) return z;
    }
    return ZONA_DEFAULT;
  }

  function driveByRoad(a, b) {
    const kmRecta = haversine(a, b);
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const kmRuta = kmRecta * zoneFor(mid).factor;
    const min = Math.round(kmRuta / AVG_KMH * 60) + PARK_MIN;
    return { km: kmRuta, min };
  }
```

- [ ] **Step 2: Cambiar `legRow` para que reciba los dos extremos**

En `app.js`, sustituir:
```js
  function legRow(km) {
    const r = el('div', 'leg');
    r.innerHTML = `<span class="leg__ico">🚗</span><span>≈ ${fmtDur(driveEst(km))} · ${km.toFixed(km < 10 ? 1 : 0)} km en coche</span>`;
    return r;
  }
```
por:
```js
  function legRow(a, b) {
    const { km, min } = driveByRoad(a, b);
    const r = el('div', 'leg');
    r.innerHTML = `<span class="leg__ico">🚗</span><span>≈ ${fmtDur(min)} · ${km.toFixed(km < 10 ? 1 : 0)} km en coche</span>`;
    return r;
  }
```

- [ ] **Step 3: Actualizar la llamada a `legRow` en `dayBlock`**

En `app.js`, en `dayBlock`, el bloque:
```js
    day.items.forEach(it => {
      if (it.loc && it.loc.lat != null && prevLoc) {
        const km = haversine(prevLoc, it.loc);
        if (km >= MIN_LEG_KM) tl.appendChild(legRow(km));
      }
      if (it.loc && it.loc.lat != null) prevLoc = it.loc;
      tl.appendChild(slotRow(it));
    });
```
→
```js
    day.items.forEach(it => {
      if (it.loc && it.loc.lat != null && prevLoc) {
        if (haversine(prevLoc, it.loc) >= MIN_LEG_KM) tl.appendChild(legRow(prevLoc, it.loc));
      }
      if (it.loc && it.loc.lat != null) prevLoc = it.loc;
      tl.appendChild(slotRow(it));
    });
```

- [ ] **Step 4: Acumular km de ruta en `buildItinerary`**

En `app.js`, en `buildItinerary`, el bloque de acumulación por día:
```js
      let km = 0, prev = null;
      items.forEach(it => {
        if (it.loc && it.loc.lat != null) {
          if (prev) {
            const d = haversine(prev, it.loc);
            if (d >= MIN_LEG_KM) km += d;
          }
          prev = it.loc;
        }
      });
```
→
```js
      let km = 0, prev = null;
      items.forEach(it => {
        if (it.loc && it.loc.lat != null) {
          if (prev && haversine(prev, it.loc) >= MIN_LEG_KM) km += driveByRoad(prev, it.loc).km;
          prev = it.loc;
        }
      });
```

- [ ] **Step 5: Subir la versión de release**

- `index.html`: `style.css?v=14` → `?v=15`; `app.js?v=14` → `?v=15`.
- `sw.js`: `const SHELL_CACHE = 'shell-v14';` → `'shell-v15'`; en `SHELL_ASSETS`, `'./style.css?v=14'` → `'./style.css?v=15'` y `'./app.js?v=14'` → `'./app.js?v=15'`.

- [ ] **Step 6: Verificar tiempos por carretera y el release**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
En un navegador limpio (DevTools > Application > Service Workers > Unregister; borrar Cache Storage), abrir `http://localhost:8000/`, ir a **Itinerario**.
Expected:
- Los tramos de coche (`🚗 ≈ …`) muestran tiempos **más largos** que antes (factor > 1 y velocidad 75 < 65×… — comparar mentalmente: antes `km/65*60+5`, ahora `km×factor/75*60+4`).
- DevTools > Console del navegador, pegar y cotejar contra Google Maps (coche, sin tráfico):
  ```js
  // helper de cotejo: distancia recta entre dos puntos del gazetteer
  ```
  Concretamente, comprobar en el itinerario sembrado que:
  - Reikiavik → Vík (~180 km carretera): el tramo mostrado ≈ 2 h 20 – 2 h 50.
  - Vík → Jökulsárlón (~190 km): ≈ 2 h 20 – 2 h 50.
  - Jökulsárlón → Egilsstaðir (~265 km): ≈ 3 h 15 – 4 h.
  - Akureyri → Reikiavik (~390 km): ≈ 4 h 45 – 5 h 45.
  Si algún tramo se desvía > ~20 % de Google Maps de forma sistemática, ajustar el `factor` de esa `ZONAS` y repetir.
- DevTools > Application > Cache Storage: `shell-v15` con **28 entradas** (`./style.css?v=15`, `./app.js?v=15` incluidas). `shell-v14` desaparece. `tiles-v2` intacta.
- Consola sin errores; `grep`/búsqueda de `driveEst` en `app.js` → 0 resultados.

- [ ] **Step 7: Verificar el ciclo de actualización desde `shell-v14`**

Con una pestaña ya cargada y controlada por `shell-v14` (si no: `git stash` de `sw.js`+`index.html`, cargar, `git stash pop`), reabrir la app.
Expected: se recarga una vez; tras recargar, `shell-v15` (28 entradas), sin `shell-v14`, `tiles-v2` intacta.

- [ ] **Step 8: Commit y push**

```powershell
git add app.js index.html sw.js
git commit -m "Conduccion B1: driveByRoad con factor regional; release shell-v15" -q
git push origin main
```

---

### Task 2: `dayPlan(day)` — datos, simulación de horario y veredicto

**Files:**
- Modify: `app.js` (`buildItinerary` — los ~7 sitios de `push`; `sky()` ~línea 2229; bloque nuevo de funciones antes de `renderClima`/`renderAll`)
- Test: verificación manual por consola de DevTools

**Interfaces:**
- Consumes: de la Task 1 — `driveByRoad(a, b)` → `{km, min}`. Helpers existentes: `parseDate(ymd)` (→ `Date` a mediodía local), `haversine`, `isDate` (de A1), `firstTime`, `dtParts`, `state`.
- Produces (todas en el IIFE de `app.js`):
  - Cada item de `buildItinerary()` lleva `costMin: number` (minutos de "estancia" en ese elemento).
  - `sky(dateStr)` devuelve además `civilDawn: Date|null` y `civilDusk: Date|null`.
  - `anchorTime(it, dateStr)` → `Date | null`.
  - `dayPlan(day)` → `{ drivingMin:number, legs:Array<{km,min}>, salirA:Date|null, endTime:Date|null, missedAnchor:string|null, luz:'ok'|'justo'|'pasa'|null, volante:'ok'|'largo'|'excesivo', veredicto:'verde'|'ambar'|'rojo'|null }`.

- [ ] **Step 1: Constantes de umbral**

En `app.js`, junto a `AVG_KMH`/`PARK_MIN` de la Task 1, añadir:
```js
  const SALIDA_FLOOR_MIN = 7 * 60 + 30;   // no se empieza a conducir antes de las 07:30
  const MARGEN_ATARDECER_MIN = 30;        // colchón antes del atardecer para "ok"
  const MARGEN_ANCLA_MIN = 10;            // holgura para llegar a una hora de encuentro
  const VOLANTE_LARGO_H = 4;
  const VOLANTE_MAX_H = 6;
  const COMIDA_MIN = 50;
  const EXCURSION_MIN = 120;              // duración por defecto si la excursión no la trae
  const LUGAR_MIN = 45;                   // tiempo de visita por defecto
```

- [ ] **Step 2: Añadir `costMin` a los items de `buildItinerary`**

En `app.js`, en `buildItinerary`, añadir la propiedad `costMin` a cada objeto que se hace `push` al día. Los valores:

| `push` de | `costMin` |
|---|---|
| vuelo (`t: 'vuelo'`) | `0` |
| coche recogida / devolución (`t: 'coche'`) | `0` |
| alojamiento check-in (`t: 'checkin'`) | `0` |
| alojamiento check-out (`t: 'checkout'`) | `0` |
| alojamiento noche (`t: 'noche'`) | `0` |
| excursión (`t: 'excursion'`) | `e.duracion ? +e.duracion : EXCURSION_MIN` |
| comida (`t: 'comida'`) | `COMIDA_MIN` |
| lugar (`t: 'lugar'`) | `l.visita ? +l.visita : LUGAR_MIN` |

Ejemplo, el `push` de excursión pasa de:
```js
      const item = {
        t: 'excursion',
        hora: e.hora || '',
        sortT: e.hora ? toMin(e.hora) : 540,
        titulo: e.nombre || 'Excursión',
        sub: [ ... ].filter(Boolean).join(' · '),
        notas: e.notas || '',
        loc: e.encuentro && e.encuentro.lat != null ? e.encuentro : null,
        tag: 'Excursión'
      };
```
a lo mismo con `costMin: e.duracion ? +e.duracion : EXCURSION_MIN,` añadido. Igual para lugar (`costMin: l.visita ? +l.visita : LUGAR_MIN`), comida (`costMin: COMIDA_MIN`) y los demás (`costMin: 0`). Para los objetos `unassigned` (`Object.assign({...}, item)`) no hace falta tocar nada (heredan `costMin` del `item`).

- [ ] **Step 3: Ampliar `sky()` con los crepúsculos civiles**

En `app.js`, en `sky(dateStr)`, en el objeto que se devuelve, añadir tras `goldenPM`:
```js
      civilDawn: isDate(t.dawn) ? t.dawn : null,
      civilDusk: isDate(t.dusk) ? t.dusk : null,
```
(`t` es el `SunCalc.getTimes(noon, loc.lat, loc.lng)` que ya se calcula en `sky`.)

- [ ] **Step 4: Escribir `anchorTime` y `dayPlan`**

En `app.js`, antes de `function renderClima()` (o justo tras el bloque de Clima), añadir:

```js
  /* ==========================================================
     Conducción · B1 — Tiempos reales y viabilidad del día
     ========================================================== */

  // Hora de reloj (Date en dateStr) de un elemento que ancla el horario, o null.
  function anchorTime(it, dateStr) {
    if (!['excursion', 'vuelo', 'coche'].includes(it.t)) return null;
    const m = String(it.hora || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const d = parseDate(dateStr);
    d.setHours(+m[1], +m[2], 0, 0);
    return d;
  }

  function itemCost(it) {
    return Number.isFinite(+it.costMin) ? +it.costMin : 0;
  }

  function dayPlan(day) {
    const sk = (typeof SunCalc !== 'undefined' && state.meta.fechaInicio) ? sky(day.date) : null;

    const floor = parseDate(day.date);
    floor.setHours(0, 0, 0, 0);
    floor.setMinutes(SALIDA_FLOOR_MIN);
    const inicio = (sk && isDate(sk.civilDawn) && sk.civilDawn > floor) ? sk.civilDawn : floor;

    let reloj = inicio.getTime();
    let prev = null, drivingMin = 0;
    const legs = [];
    let firstAnchor = null, tHastaAncla = 0, missedAnchor = null;

    for (const it of day.items) {
      if (it.loc && it.loc.lat != null && prev && haversine(prev, it.loc) >= MIN_LEG_KM) {
        const leg = driveByRoad(prev, it.loc);
        drivingMin += leg.min;
        reloj += leg.min * 60000;
        legs.push(leg);
      }
      const a = anchorTime(it, day.date);
      if (a) {
        if (!firstAnchor) { firstAnchor = a; tHastaAncla = reloj - inicio.getTime(); }
        if (reloj > a.getTime() + MARGEN_ANCLA_MIN * 60000) missedAnchor = missedAnchor || (it.titulo || 'un evento');
        reloj = Math.max(reloj, a.getTime());
      }
      reloj += itemCost(it) * 60000;
      if (it.loc && it.loc.lat != null) prev = it.loc;
    }

    const endTime = new Date(reloj);
    const salirA = firstAnchor ? new Date(firstAnchor.getTime() - tHastaAncla) : null;

    let luz = null;
    if (sk && isDate(sk.sunset)) {
      if (missedAnchor) luz = 'pasa';
      else if (endTime.getTime() <= sk.sunset.getTime() - MARGEN_ATARDECER_MIN * 60000) luz = 'ok';
      else if (isDate(sk.civilDusk) && endTime.getTime() <= sk.civilDusk.getTime()) luz = 'justo';
      else luz = 'pasa';
    }

    const h = drivingMin / 60;
    const volante = h <= VOLANTE_LARGO_H ? 'ok' : h <= VOLANTE_MAX_H ? 'largo' : 'excesivo';

    const rank = { ok: 0, justo: 1, largo: 1, pasa: 2, excesivo: 2 };
    let veredicto = ['verde', 'ambar', 'rojo'][Math.max(rank[luz || 'ok'], rank[volante])];

    if (day.items.some(x => x.t === 'vuelo') && drivingMin < 30) veredicto = null;
    if (!sk && volante === 'ok') veredicto = null;

    return { drivingMin, legs, salirA, endTime, missedAnchor, luz, volante, veredicto };
  }
```

- [ ] **Step 5: Verificar `dayPlan` por consola**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Abrir la app; el bloque está en el IIFE, así que exponer temporalmente para probar: al final del `try` de arranque (junto a `renderAll()`), añadir de forma **temporal**:
```js
    window.__bi = buildItinerary; window.__dayPlan = dayPlan; window.__sky = sky;
```
Recargar (con Unregister + clear de cachés). En DevTools > Console:
```js
const it = window.__bi();
it.days.map(d => {
  const p = window.__dayPlan(d);
  return {
    dia: d.idx, fecha: d.date,
    conduccion_min: p.drivingMin,
    salirA: p.salirA && p.salirA.toTimeString().slice(0,5),
    fin: p.endTime && p.endTime.toTimeString().slice(0,5),
    luz: p.luz, volante: p.volante, veredicto: p.veredicto, noLlega: p.missedAnchor
  };
});
```
Expected (viaje sembrado 8–16 oct):
- 9 filas, ninguna lanza excepción.
- El día de la excursión de cuevas de hielo (11 oct, encuentro 08:30 en Jökulsárlón, con la noche del 10→11 en Gerdi Guesthouse a ~10 min) → `noLlega` es `null` (se llega) y `salirA` ≈ 08:0x–08:2x.
- Los días 1 y 9 (vuelos) → `veredicto: null`.
- Al menos un día de traslado largo (p. ej. 10→11 Jökulsárlón→zona de Egilsstaðir, o el día con Jökulsárlón→Egilsstaðir) con `conduccion_min` alto → `volante` `'largo'` o `'excesivo'`.
- `it.days[0].km` ahora es km de ruta (mayor que la suma de líneas rectas de antes).
- `window.__sky('2026-10-11').civilDawn` y `.civilDusk` son `Date` válidos.

- [ ] **Step 6: Quitar la instrumentación temporal**

Borrar la línea `window.__bi = …; window.__dayPlan = …; window.__sky = …;`. Confirmar:
```powershell
Select-String -Path app.js -Pattern "__bi|__dayPlan|__sky"
```
Expected: sin resultados.

- [ ] **Step 7: Commit y push**

```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
git add app.js
git commit -m "Conduccion B1: dayPlan con simulacion de horario y veredicto" -q
git push origin main
```

---

### Task 3: Integración en el Itinerario — badge, línea de resumen, CSS y README

**Files:**
- Modify: `app.js` (`dayBlock` ~1436-1444), `style.css`, `README.md`
- Test: verificación manual en navegador (checklist del spec §9)

**Interfaces:**
- Consumes: de la Task 2 — `dayPlan(day)` y su objeto de salida. Helpers existentes: `el(tag, cls)`, `esc(s)`, `fmtDur(min)`, `pad2(n)`.
- Produces: `dayBlock` pinta `<span class="day-verdict day-verdict--{verde|ambar|rojo}">` en `day__head` y `<p class="day-plan">` bajo la cabecera. Nuevas clases CSS.

- [ ] **Step 1: Helper de formato de hora y de etiqueta del badge**

En `app.js`, justo tras `dayPlan` (Task 2), añadir:
```js
  const hhmmT = d => (isDate(d) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '');

  function verdictLabel(p) {
    if (p.veredicto === 'rojo') {
      if (p.missedAnchor) return 'No llegas a: ' + p.missedAnchor;
      if (p.volante === 'excesivo') return fmtDur(p.drivingMin) + ' al volante';
      if (p.luz === 'pasa') return 'Terminas de noche';
      return '';
    }
    if (p.veredicto === 'ambar') {
      if (p.luz === 'justo') return 'Justo de luz';
      if (p.volante === 'largo') return fmtDur(p.drivingMin) + ' al volante';
      return '';
    }
    return ''; // verde: solo el punto
  }
```

- [ ] **Step 2: Pintar el badge y la línea de resumen en `dayBlock`**

En `app.js`, en `dayBlock`, sustituir:
```js
    const head = el('div', 'day__head');
    head.innerHTML =
      `<h3 class="day__date">${cap(fmtDiaSemana(day.date))}, ${fmtFecha(day.date)}</h3>` +
      `<span class="day__idx">${esHoy ? '<b class="day__now">EN CURSO</b> · ' : ''}Día ${day.idx}</span>`;
    wrap.appendChild(head);
```
por:
```js
    const plan = dayPlan(day);

    const head = el('div', 'day__head');
    const badge = plan.veredicto
      ? `<span class="day-verdict day-verdict--${plan.veredicto}"${plan.veredicto === 'verde' ? ' title="Día holgado"' : ''}>${esc(verdictLabel(plan))}</span>`
      : '';
    head.innerHTML =
      `<h3 class="day__date">${cap(fmtDiaSemana(day.date))}, ${fmtFecha(day.date)}</h3>` +
      `<span class="day__idx">${esHoy ? '<b class="day__now">EN CURSO</b> · ' : ''}Día ${day.idx}${badge ? ' · ' + badge : ''}</span>`;
    wrap.appendChild(head);

    if (plan.veredicto) {
      const bits = [];
      // Suelo de salida (07:30) en ms; se omite un "Sal sobre las…" absurdo
      // (más de 2 h antes) — en ese caso la etiqueta del badge ya dice "no llegas".
      const floorMs = parseDate(day.date).setHours(0, 0, 0, 0) + SALIDA_FLOOR_MIN * 60000;
      if (plan.salirA && plan.salirA.getTime() >= floorMs - 2 * 3600000) {
        bits.push('Sal sobre las <span class="mono">' + hhmmT(plan.salirA) + '</span>');
      }
      if (isDate(plan.endTime)) bits.push('fin ~<span class="mono">' + hhmmT(plan.endTime) + '</span>');
      if (plan.drivingMin > 0) bits.push(fmtDur(plan.drivingMin) + ' al volante');
      if (bits.length) {
        const p = el('p', 'day-plan');
        p.innerHTML = bits.join(' · ');
        wrap.appendChild(p);
      }
    }
```
Nota: `parseDate(day.date).setHours(0,0,0,0)` devuelve el timestamp de medianoche local del día (el `setHours` de `Date` devuelve el ms resultante), así que `floorMs` es medianoche + 07:30.

- [ ] **Step 3: Estilos**

En `style.css`, comprobar si existen los tokens de color de aviso y peligro:
```powershell
Select-String -Path style.css -Pattern "--c-warn|--c-danger|--c-error|btn--danger"
```
- Si `--c-danger` (o equivalente) no existe en `:root`, añadir en el bloque `:root` (junto a `--c-accent`):
  ```css
  --c-warn:   oklch(0.80 0.13 75);
  --c-danger: oklch(0.63 0.20 25);
  ```
  (Si `.btn--danger` ya usa un color propio, reutilizar ese valor para `--c-danger` en vez del de arriba.)

Añadir, en la sección del itinerario (junto a `.day__head` / `.day`):
```css
.day-verdict {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}
.day-verdict::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex: 0 0 auto;
}
.day-verdict--verde { color: var(--c-accent); }
.day-verdict--ambar { color: var(--c-warn); }
.day-verdict--rojo  { color: var(--c-danger); }
.day-plan {
  margin: 4px 0 0;
  color: var(--c-text-2);
  font-size: var(--step--1);
}
.day-plan .mono { font-family: var(--font-mono); }
```

- [ ] **Step 4: README**

En `README.md`:
- En el párrafo de descripción (donde habla del itinerario diario), añadir: "El itinerario estima los tiempos de trayecto por carretera (factor de rodeo por región, sin conexión) y marca la **viabilidad de cada día** — horas de luz y horas al volante — con la hora recomendada de salida."
- El aviso legal, sustituir:
  `Los tiempos de trayecto son estimaciones en línea recta, no rutas reales.`
  por:
  `Los tiempos de trayecto son estimaciones por carretera con un factor de rodeo aproximado, no rutas calculadas.`

- [ ] **Step 5: Verificar la sección (checklist del spec §9)**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio (Unregister + clear cachés), **Itinerario**:

1. Los 9 días muestran, en la cabecera, `Día N` y (si el veredicto no es `null`) un punto de color; ámbar/rojo llevan texto.
2. Días con excursión anclada muestran bajo la cabecera `Sal sobre las HH:MM · fin ~HH:MM · X h Y min al volante`.
3. Día 11 oct (cuevas de hielo): no dice "No llegas a: …"; muestra "Sal sobre las 08:0x".
4. Días sin excursión: la línea no muestra "Sal sobre las …".
5. Un día cargado en octubre → veredicto ámbar/rojo por luz; `fin ~HH:MM` coherente con el atardecer que muestra la sección **Clima** de ese día.
6. Un día de traslado largo → etiqueta de horas al volante; si supera 6 h, rojo.
7. Días 1 y 9 (vuelos): sin badge ni línea de resumen.
8. Sin fechas (consola: `state.meta.fechaInicio=''; renderAll()` — o comprobar el comportamiento en un navegador con ese estado): Itinerario muestra su aviso de siempre; sin badges; sin errores.
9. DevTools > Network > Offline, recargar → Itinerario con badges y tiempos igual (todo local). Consola limpia.
10. Recorrer Datos, Itinerario, Mapas, Ideas, Clima → consola sin errores en ninguna.

- [ ] **Step 6: Commit y push**

```powershell
git add app.js style.css README.md
git commit -m "Conduccion B1: badge de viabilidad y resumen en el Itinerario" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2 objetivo 1: tiempos por carretera con factor regional | Task 1 (`ZONAS`, `driveByRoad`, `legRow`, `buildItinerary` km) |
| §2 objetivo 2: semáforo con simulación de horario | Task 2 (`dayPlan`) + Task 3 (badge/línea) |
| §2 no-objetivos (sin API, sin archivos nuevos, solo diagnostica, sin precisión al minuto, no toca Mapas/Clima salvo 2 campos) | Respetado; `ZONAS` es `const`; `sky()` solo gana `civilDawn`/`civilDusk` |
| §3 decisiones (ambos criterios, simulación, factor offline, `dayPlan` aparte) | Task 2 (`dayPlan` puro, consume `buildItinerary`; `veredicto` = peor de luz/volante) |
| §4 archivos y release | Tasks 1 (release), 2, 3 |
| §4 constantes | Task 1 Step 1 + Task 2 Step 1 (todos los valores del spec, verbatim) |
| §5 `ZONAS` tabla + `zoneFor` + `driveByRoad` fórmula | Task 1 Step 1 |
| §5 sustitución de `driveEst` (legRow, buildItinerary, eliminar) | Task 1 Steps 2-4 + Step 6 (grep 0) |
| §6 `itemCost` (excursión `duracion`, lugar `visita`, comida 50, resto 0) | Task 2 Step 2 (`costMin` en `buildItinerary`) + `itemCost(it) = it.costMin` |
| §6 `anchorTime` (excursión/vuelo/coche con hora) | Task 2 Step 4 |
| §6 simulación (inicio, reloj, legs, anclas, missedAnchor, salirA, endTime) | Task 2 Step 4 |
| §6 veredictos (luz ok/justo/pasa, volante ok/largo/excesivo, peor de dos, día de vuelo, sin sky) | Task 2 Step 4 |
| §7 badge (etiquetas por caso, prioridad, verde solo punto) | Task 3 Steps 1-2 (`verdictLabel`) |
| §7 línea de resumen (solo si veredicto, omitir salirA lejano, omitir volante 0) | Task 3 Step 2 |
| §7 CSS `.day-verdict` / `.day-plan` / `--c-warn` / `--c-danger` | Task 3 Step 3 |
| §8 errores (día sin coords, sin fechas, sin SunCalc, ancla imposible, varias anclas, día de vuelo, tramo corto, coords basura, DST, fmtDur 0) | Task 2 Step 4 (guardas) + Task 3 Step 5 (verificación 7, 8, 9) |
| §9 pruebas 1-11 | Task 1 Step 6-7, Task 2 Step 5, Task 3 Step 5 |
| §10 README | Task 3 Step 4 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". Cada paso de código lleva el código real. Las verificaciones llevan `Run:` y `Expected:` con valores concretos (rangos de minutos por tramo, recuentos de caché, filas de consola esperadas). La única "nota de implementación" (Task 3 Step 2, cálculo legible de `inicio` para el guard de `salirA`) da la fórmula exacta a usar (`floorMs - 2*3600000`), no deja nada abierto.

**3. Consistencia de tipos y nombres**

- `driveByRoad(a, b)` → `{ km, min }` — definida en Task 1 Step 1; usada en Task 1 (legRow, buildItinerary) y Task 2 (`dayPlan`).
- `zoneFor(p)` → `{ name, factor }` — Task 1 Step 1; usada solo dentro de `driveByRoad`.
- `legRow(a, b)` — firma cambiada en Task 1 Step 2; único call site actualizado en Task 1 Step 3.
- `costMin` — añadido en `buildItinerary` (Task 2 Step 2); leído por `itemCost(it)` (Task 2 Step 4).
- `sky(dateStr)` gana `civilDawn` / `civilDusk` (Task 2 Step 3); leídos en `dayPlan` (Task 2 Step 4).
- `dayPlan(day)` → objeto con `drivingMin, legs, salirA, endTime, missedAnchor, luz, volante, veredicto` — Task 2 Step 4; consumido en Task 3 (`verdictLabel`, badge, línea).
- `verdictLabel(p)` / `hhmmT(d)` — Task 3 Step 1; usados en Task 3 Step 2.
- Constantes (`AVG_KMH`, `PARK_MIN`, `SALIDA_FLOOR_MIN`, `MARGEN_ATARDECER_MIN`, `MARGEN_ANCLA_MIN`, `VOLANTE_LARGO_H`, `VOLANTE_MAX_H`, `COMIDA_MIN`, `EXCURSION_MIN`, `LUGAR_MIN`) — todas en Task 1 Step 1 / Task 2 Step 1; nombres idénticos allí y en `dayPlan`.
- `shell-v15` / `?v=15` — Task 1 Step 5; verificado Task 1 Step 6-7.
- `MIN_LEG_KM`, `haversine`, `parseDate`, `isDate`, `fmtDur`, `pad2`, `el`, `esc`, `state` — helpers existentes, usados con su firma actual.

Sin inconsistencias.
