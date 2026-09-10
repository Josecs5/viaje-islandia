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
2. Ventana **de día**: `day.date` `09:00`–`19:00` UTC (octubre en Islandia).
3. Clave más cercana (≤ 40 km) en `clouds` / `wind` / `precip` (la misma para las
   tres, por `haversine` a `loc`); si `> 40 km` o sin ninguna serie → `return null`.
4. Sobre la ventana: `avgCloud` (media `%`), `maxGust` (máx km/h), `sumPrecip`
   (suma mm), `hoursRain` (nº de horas con `mm >= 0.2`).
5. Si las tres series no tienen ninguna entrada en la ventana → `return null`.
6. **Puntuación** (cuanto más alto, peor):
   `score = (avgCloud/100)*1 + (maxGust>=70?2:maxGust>=50?1:0) + Math.min(sumPrecip,6)/2 + (hoursRain>=4?1:0)`
7. Nivel:
   - `score < 1.4` → `bueno`
   - `score < 3.0` → `regular`
   - resto → `malo`
8. `txt`:
   - `regular` → `día irregular: ` + los factores presentes (`nubes 80%`, `rachas 60`, `2 mm`)
   - `malo` → `día de plan B` + factores + ` — alternativas de interior en Ideas`
9. `stale` (>18 h) → sufijo ` (hace {h} h)`; **no** atenúa (`malo` es señal útil).
10. Return `{ level:'bueno'|'regular'|'malo', txt, stale }`.

## 6. Cabecera del Itinerario — nudge

En `renderItinerario`, tras `itinFuelBlock(it)` y antes de `.chips--itin`,
`body.appendChild(outdoorRankBlock(it))`:

- `outdoorRankBlock(it)` calcula `outdoorFor` de cada día; si **menos de 2 días**
  tienen dato → devuelve un `<section hidden>` (nada que rankear).
- Si hay ≥ 2: `<section class="itin-outlook">` con:
  `Días con mejor pinta para exteriores: {mejores} · peores: {peores}. Si puedes
  mover una excursión al aire libre, hazla a un día verde.`
  donde `mejores` = los 2-3 de menor score, `peores` = los 1-2 de mayor score
  (por «Día N», con la fecha corta entre paréntesis).

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
