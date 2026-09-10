# Clima · A5 — Días buenos / malos y plan B de interior

Fecha: 2026-09-10 · Estado: aprobado (modo autónomo, sin gate) · Ships: `shell-v22`

## 1. Contexto

El usuario pidió «Reordenación sugerida de días según el parte + plan B de
interior (piscinas, museos, cafés) para días malos». La app ya trae de Open-Meteo
`cloud_cover` y `wind_gusts_10m` por ubicación de pernocta (`state.meteo`), y ya
pinta líneas por día en el Itinerario (B1 viabilidad, D2 combustible, A3 viento).
Con un itinerario de hoteles y excursiones ya reservados, **reordenar de verdad
casi nunca es posible**: lo útil es señalar qué días pintan bien/mal para
exteriores y, en los malos, dar alternativas de interior.

## 2. Objetivo

1. **Marca de exteriores por día** en el Itinerario: combina nubes + ráfaga +
   lluvia de las horas de día → `bueno` / `regular` / `malo`. Solo se pinta si es
   `regular` o `malo` (un buen día no necesita línea).
2. **Nudge de prioridad** en la cabecera del Itinerario: dentro de la previsión,
   qué días son los mejores y los peores para planes al aire libre — «si puedes
   mover una excursión movible, llévala a un día verde».
3. **Plan B de interior por zona** como bloque de contenido en Ideas (piscinas
   geotermales, museos, termales, cafés), al que apunta la línea de un día `malo`.

## 3. No-objetivos

- No reordenar el itinerario automáticamente (hoteles/excursiones reservados).
- No pronóstico propio; Open-Meteo tal cual (~16 días; hoy, viaje lejano → sin
  líneas hasta ~2 semanas antes).
- No tocar B1 (`dayPlan`), ni las líneas de D2/A3.
- No API nueva: se añade `precipitation` a la petición de Open-Meteo que ya se hace.

## 4. Datos

- Petición Open-Meteo (en `refreshMeteo`): `hourly` gana `,precipitation`.
  `state.meteo.precip = { '<lat>,<lng>': [{ t:'<ISO UTC>', mm:<number> }] }`,
  poblado y recortado a la ventana del viaje igual que `clouds`/`wind`, con guard
  `Array.isArray(H.precipitation)`, y podado a las claves de `locs`.
- `blankMeteo()` gana `precip: {}`. `load()` ya hace
  `Object.assign(blankMeteo(), p.meteo || p.aurora || {})` → cubre el campo nuevo.

## 5. `outdoorFor(day)` — nuevo, junto a `windFor`

`day` = objeto de `buildItinerary().days`.

1. `loc = locForDate(day.date)`; si `isIceCenter(loc)` → `return null`.
2. Ventana **de día**: `day.date` `09:00`–`19:00` UTC (octubre en Islandia). Nota:
   Open-Meteo da `precipitation` como suma de la hora anterior, así que para la
   lluvia la ventana efectiva es ~08:00–19:00; irrelevante para el nivel.
3. **Una sola clave** (la más cercana entre la unión de las claves de `clouds` /
   `wind` / `precip`, por `haversine` a `loc`); si `> 40 km` o no hay ninguna clave
   → `return null`. Las tres métricas se leen de esa misma clave (spec previa pedía
   "la misma para las tres"; ahora se garantiza de verdad).
4. Sobre la ventana: `avgCloud` (media `%`), `maxGust` (máx km/h), `sumPrecip`
   (suma mm), `hoursRain` (nº de horas con `mm >= 0.5`).
5. Si las tres series no tienen ninguna entrada en la ventana → `return null`.
   (Una serie ausente cuenta 0; p. ej. justo tras subir a v22, `precip:{}` durante
   las 2 h del guard de frescura → el día no puede salir `malo`, solo `regular` —
   transitorio y conservador: sin dato de lluvia no se grita "plan B".)
6. **Puntuación** (cuanto más alto, peor) — la lluvia y el viento son la señal;
   en Islandia un cielo gris es lo normal, así que las nubes solo suman con techo total:
   `score = (avgCloud>=85 ? 0.5 : 0) + (maxGust>=75?2:maxGust>=55?1:0) + Math.min(sumPrecip,8)/2.5 + (hoursRain>=4?0.8:hoursRain>=2?0.4:0)`
7. Nivel:
   - `score < 1.2` → `bueno`
   - `score < 2.6` → `regular`
   - resto → `malo`
8. `txt`:
   - `bueno` → `''` (no se pinta).
   - `regular` → `día irregular: ` + los factores presentes (`nubes 80%`, `rachas 60`, `2 mm`).
   - `malo` → `día de plan B` + factores + ` — alternativas de interior en Ideas`.
   - `mm` con coma decimal (`toLocaleString('es-ES')`), como el resto de la app.
9. `stale` (>18 h) → sufijo ` (hace {h} h)` si hay `txt`; **no** atenúa (`malo` es señal útil).
10. Return `{ level:'bueno'|'regular'|'malo', txt, stale, score }`. Memoizado por
    `(fecha + fetched)` dentro de un mismo `renderItinerario` (se llama 2× por día).

## 6. Cabecera del Itinerario — nudge

En `renderItinerario`, tras `itinFuelBlock(it)` y antes de `.chips--itin`,
`body.appendChild(outdoorRankBlock(it))`:

- `outdoorRankBlock(it)` calcula `outdoorFor` de cada día y parte en `flojos`
  (`level != 'bueno'`, ordenados peor→mejor) y `buenos` (ordenados mejor→peor).
- Si **no hay días flojos** o **no hay días buenos** → `<section hidden>` (no hay
  nada que mover, o no hay a dónde). Esto evita nombrar «peores» días que en
  realidad son buenos y para los que `dayBlock` no pinta línea (contradicción).
- Si hay de ambos: `<section class="itin-outlook">` con
  `Días flojos para exteriores: {peores 1-2} · mejor pinta: {mejores 1-3}. Si
  puedes mover una salida al aire libre, llévala a un día verde.`
  (cada día como «Día N (fecha corta)»).

## 7. Render — `dayBlock`

Tras la línea `.day-plan` de B1 (dentro/fuera de su `if` da igual; va **antes**
de la de combustible D2) y solo si `outdoorFor(day)` devuelve nivel
`regular`/`malo`:
```js
const od = outdoorFor(day);
if (od && od.level !== 'bueno') {
  const po = el('p', 'day-out day-out--' + od.level);
  po.innerHTML = `${od.level === 'malo' ? '🌧️' : '⛅'} ${esc(od.txt)}`;
  wrap.appendChild(po);
}
```

## 8. Plan B de interior — bloque en Ideas

`PLAN_B` (constante, junto a `CARRETERAS`): `{ intro, zonas: [{ z, items:[str] }] }`
con zonas **Reikiavik y alrededores**, **Sur (Selfoss–Vík)**, **Sureste (Höfn)**,
**Este (Egilsstaðir)**, **Norte (Mývatn–Akureyri)**, **Oeste (Borgarnes–Snæfellsnes)**.
Cada zona: 2-4 planes de interior/termales (piscina geotermal municipal, laguna,
museo, piscina cubierta, café/panadería con encanto).

`renderPlanB(body)` gemela de `renderCarreteras`: `<section class="reco-cat">`
badge `🌧️`, `<h3>Plan B para días de lluvia o viento</h3>`, intro, y una
`.reco-card` por zona: `<b>{z}.</b> {items.join(' · ')}` con `esc()`.

Llamada en `renderReco()`: tras `renderCarreteras(body)` y antes de
`renderEmergencias(body)`.

## 9. Estilos (`style.css`)

Junto a `.day-wind`:
```css
.day-out { font-size: var(--step--1); margin: var(--space-4) 0 0; }
.day-out--regular { color: var(--c-text-2); }
.day-out--malo { color: var(--c-warning); }
```
Reutiliza `.reco-cat*` para el bloque de Ideas (sin CSS nuevo ahí).

## 10. Integración y release

- `blankMeteo()` += `precip: {}`.
- `refreshMeteo`: `hourly` += `,precipitation`; construir `precip` (guard,
  recorte a viaje, poda a `locs`) junto a `clouds`/`wind`; incluir `precip` en
  el chequeo `hayDatos`.
- `outdoorFor(day)` + `outdoorRankBlock(it)` nuevos; línea `.day-out` en `dayBlock`;
  `outdoorRankBlock` en `renderItinerario`.
- `PLAN_B` + `renderPlanB(body)`; llamada en `renderReco`.
- `style.css`: bloque `.day-out*` (+ `.itin-outlook` reutiliza `.itin-fuel`
  visualmente o define 3 líneas mínimas).
- `README.md`: una frase.
- Release: `?v=21 → ?v=22` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`;
  `sw.js` `shell-v21 → shell-v22`. `tiles-v2` sin cambios. Precache **28**.

## 11. Casos borde

- Viaje lejano / offline / sin fechas → `state.meteo.precip` vacío → `outdoorFor`
  y `outdoorRankBlock` devuelven `null` / `<section hidden>`. Sin líneas, sin error.
- `isIceCenter` → `outdoorFor` null (igual que `windFor`).
- Clave a > 40 km → null.
- `precip` con `mm` null → filtrado por `typeof x.mm === 'number'`.
- `outdoorRankBlock` con exactamente 2 días de dato → 1 mejor, 1 peor; con muchos
  → top-3 / bottom-2.
- La línea `.day-out` de un día `bueno` **no se pinta** (menos ruido).
- `renderItinerario` llamado desde `refreshMeteo` con el Itinerario oculto → OK
  (mismo patrón que A3; y ya está el guard de foco de A3).

## 12. Pruebas manuales

1. Petición Open-Meteo lleva ahora `precipitation`; `state.meteo.precip` es objeto con arrays `{t,mm}` (o vacíos si el viaje está lejos).
2. Inyectar en consola `clouds`/`wind`/`precip` para 3 días (uno despejado y calmado, uno con nubes+rachas 55, uno con lluvia 8 mm + rachas 75) y `renderItinerario()`:
   - día 1 (bueno) → **sin** línea `.day-out`.
   - día 2 → `⛅ día irregular: nubes 85% · rachas 55` en gris.
   - día 3 → `🌧️ día de plan B: lluvia 8 mm · rachas 75 — alternativas de interior en Ideas` en ámbar.
   - Cabecera del Itinerario: «Días con mejor pinta para exteriores: Día 1 (10 oct) · peores: Día 3 (12 oct). Si puedes mover…».
3. Ideas → tras «Carreteras» aparece «🌧️ Plan B para días de lluvia o viento» con una card por zona (6), y después «Teléfonos importantes».
4. Offline + `localStorage.clear()` + recargar Itinerario → sin línea `.day-out`, sin cabecera de outlook; B1/D2/A3 intactos; consola limpia.
5. `caches.keys()` → `shell-v22` con **28** entradas; sin `shell-v21`; `tiles-v2` intacta.
6. `node --check app.js` y `node --check sw.js` OK; consola limpia en las 5 pantallas.
