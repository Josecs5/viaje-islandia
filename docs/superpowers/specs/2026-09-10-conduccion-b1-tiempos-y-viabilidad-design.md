# Conducción · B1 — Tiempos reales y "¿día viable?" — Diseño

Fecha: 2026-09-10
Estado: aprobado el diseño; pendiente de plan de implementación
Ámbito: arquitectónico (nueva función de cálculo + integración en el motor de itinerario)

## 1. Contexto

Sub-proyecto **"Conducción y logística"**, descompuesto en 3 piezas:

| Pieza | Qué es | Depende de |
|---|---|---|
| **B1 · Tiempos reales + "¿día viable?"** | Tiempos de conducción por carretera (no en línea recta) + semáforo verde/ámbar/rojo por día | A1 (`sky()`) |
| B2 · Gasolineras + autonomía | Lista curada de estaciones + buscador de huecos largos | — |
| B3 · Avisos de carretera | Puentes de un carril, radares, grava, túnel de Hvalfjörður (ya sin peaje), parkings de pago | — |

**Este spec cubre solo B1.**

Estado de la app: PWA vanilla, sin build, sin framework, sin framework de test.
Modo offline con service worker (`shell-v14`). Secciones: Datos, Itinerario,
Mapas, Ideas, Clima. El itinerario lo genera `buildItinerary()`, que reparte
vuelos/coche/alojamientos/excursiones/comidas/lugares por día y hoy estima los
trayectos con `driveEst(km) = round(km/65*60) + 5` sobre distancia **en línea
recta** (`haversine`). `renderItinerario()` → `dayBlock(day)` pinta cada día;
dentro, un bucle llama a `legRow(km)` entre elementos consecutivos con
coordenadas (si `km >= MIN_LEG_KM`, que vale 1). La sección **Clima** (A1)
expone `sky(dateStr)` con salida/puesta de sol, hora dorada, ventana de
oscuridad y luna, calculado con SunCalc.

## 2. Objetivo y no-objetivos

### Objetivo

1. **Tiempos de conducción realistas**: sustituir la estimación en línea recta
   por un tiempo por carretera con un **factor de rodeo por región** (offline,
   sin API). Se muestra en los tramos del itinerario y en el total del día.
2. **Semáforo "¿día viable?"** por día en el itinerario: verde / ámbar / rojo,
   calculado con una **simulación de horario** que:
   - recorre los elementos del día en orden, intercala los tramos de conducción,
     ancla los eventos con hora fija (excursiones, vuelos) y calcula la **hora de
     fin estimada** y la **hora a la que salir** por la mañana;
   - marca rojo si no se llega a un evento anclado, si se termina de noche, o si
     hay demasiadas horas al volante; ámbar en los casos límite.

### No-objetivos

- Sin API de routing (OSRM, Google, etc.). Todo local, funciona offline.
- Sin archivos de datos nuevos (la tabla de zonas es un `const` en `app.js`).
- No se reordena el itinerario ni se sugieren cambios (eso sería B... A5 / otra
  pieza). B1 solo diagnostica.
- Sin precisión al minuto: el objetivo es distinguir "día de 3 h" de "día de
  7 h" y avisar de días inviables, no dar una ETA exacta.
- No se toca la geocodificación, ni Mapas, ni la sección Clima salvo añadir 2
  campos a `sky()`.

## 3. Decisiones (con alternativas descartadas)

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Qué comprueba el semáforo | **Ambos**: horas de luz **y** horas al volante; el veredicto es el peor de los dos | Solo luz; solo volante |
| Cómo se decide si "cabe" | **Simulación de horario** (anclas + hora de salida + hora de fin) | Suma de totales (no detecta problemas de encaje) |
| Tiempos de conducción | **Factor regional offline** (`distancia_recta × factor(zona) ÷ velocidad`) | OSRM online cacheado; precálculo en JSON; híbrido |
| Integración con `buildItinerary()` | **Función aparte `dayPlan(day)`** que consume la salida de `buildItinerary()` | Ampliar `buildItinerary()` en el sitio |

## 4. Archivos, estructura y release

### `app.js` (todo el trabajo va aquí; sin archivos nuevos)

- `ZONAS` — `const` con cajas lat/lng y su factor (Sección 5).
- `driveByRoad(a, b)` → `{ km, min }` — tiempo por carretera (Sección 5).
  Sustituye a `driveEst(km)`.
- Constantes de umbral (Sección 5 y 6): `AVG_KMH = 75`, `PARK_MIN = 4`,
  `SALIDA_FLOOR_MIN = 7 * 60 + 30` (minutos desde medianoche = 07:30),
  `MARGEN_ATARDECER_MIN = 30`, `MARGEN_ANCLA_MIN = 10`, `VOLANTE_LARGO_H = 4`,
  `VOLANTE_MAX_H = 6`, `COMIDA_MIN = 50`, `EXCURSION_MIN = 120`, `LUGAR_MIN = 45`.
- Ampliar `sky(dateStr)` (de A1): añadir `civilDawn` y `civilDusk`
  (`SunCalc.getTimes().dawn` / `.dusk`, con la guarda `isDate`).
- `dayPlan(day)` — función pura (Sección 6). Devuelve
  `{ drivingMin, legs, salirA, endTime, missedAnchor, luz, volante, veredicto }`.
- `dayBlock(day)` (dentro de `renderItinerario`): badge de veredicto en la
  cabecera, línea de resumen, y `legRow` pasa a `(a, b)` con `driveByRoad`
  (Sección 7).

### `style.css`

- `.day-verdict` (punto + etiqueta pequeña; verde `--c-accent`, ámbar y rojo:
  añadir `--c-warn` y `--c-danger` a `:root` si no existen — comprobar; la app
  ya tiene un color de peligro para `.btn--danger`).
- `.day-plan` (línea de resumen, atenuada, horas en `--font-mono`).

### `README.md`

- Nota: el itinerario estima ahora tiempos por carretera (factor por región,
  offline) y marca la viabilidad de cada día (luz + horas al volante).

### Release

- `?v=14 → ?v=15` en `index.html` (`style.css` y `app.js`) y en `SHELL_ASSETS`
  de `sw.js`, a la vez.
- `sw.js`: `SHELL_CACHE` `shell-v14 → shell-v15`. `TILE_CACHE` (`tiles-v2`) sin
  cambios. No hay assets nuevos que precachear; el recuento sigue en 28.

## 5. `driveByRoad(a, b)` — tiempo por carretera con factor regional

### `ZONAS`

Cajas lat/lng, **primera coincidencia gana**; decide el punto medio del tramo.

| Zona | lat | lng | factor |
|---|---|---|---|
| Suroeste / Reykjavík / Reykjanes | 63.80 – 64.30 | −22.70 – −21.30 | 1.18 |
| Costa sur (Selfoss→Höfn) | 63.30 – 64.30 | −21.30 – −15.00 | 1.12 |
| Fiordos del este (Höfn→Egilsstaðir) | 64.20 – 65.40 | −15.30 – −13.40 | 1.50 |
| Norte (Mývatn→Akureyri→Blönduós) | 65.20 – 66.20 | −19.50 – −14.90 | 1.20 |
| Oeste / pasos (Blönduós→Borgarnes) | 64.60 – 65.60 | −22.00 – −19.30 | 1.25 |
| *(fuera de todo)* | — | — | 1.35 |

`zoneFor({lat, lng})` recorre `ZONAS` en orden y devuelve `{ name, factor }` de
la primera cuya caja contiene el punto; si ninguna, `{ name: 'otro', factor: 1.35 }`.

### Cálculo

```
kmRecta = haversine(a, b)                       // helper existente
mid     = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
factor  = zoneFor(mid).factor
kmRuta  = kmRecta * factor
min     = Math.round(kmRuta / AVG_KMH * 60) + PARK_MIN
return { km: kmRuta, min }
```

`AVG_KMH = 75` (límite de 90 en abierto, menos pueblos, curvas, meteo y paradas
para fotos). `PARK_MIN = 4` (aparcar, arrancar).

### Sustitución de `driveEst`

- `legRow(km)` → `legRow(a, b)`: llama a `driveByRoad(a, b)` y muestra
  `≈ {fmtDur(min)} · {km redondeado} km en coche`.
- En `buildItinerary()`, el acumulador `day.km` (hoy `+= haversine(prev, it.loc)`
  para tramos `>= MIN_LEG_KM`) pasa a `+= driveByRoad(prev, it.loc).km`, para
  que el "≈ N km" del día sea coherente con los tramos.
- `driveEst` se elimina.

### Calibración

Los factores son un `const`. En la verificación (Sección 9) se cotejan 5 tramos
del viaje sembrado contra Google Maps y se ajustan si hay desvío sistemático
> ~20 %.

## 6. `dayPlan(day)` — simulación de horario y veredicto

Función pura. Entrada: un día de `buildItinerary()` — `{ date, idx, items, km }`,
con `items` ya ordenados por `sortT`.

### Preparación

```
const sk = (typeof SunCalc !== 'undefined' && state.meta.fechaInicio)
  ? sky(day.date) : null;
```

### Coste de tiempo por elemento — `itemCost(it)`

| `it.t` | coste (min) |
|---|---|
| `excursion` | `+it.duracion` si es un número, si no `EXCURSION_MIN` (120) |
| `lugar` | `+it.visita` si es un número, si no `LUGAR_MIN` (45) |
| `comida` | `COMIDA_MIN` (50) |
| `checkin`, `checkout`, `noche`, `coche`, `vuelo` | 0 |

### Anclas — `anchorTime(it)` → `Date` en `day.date`, o `null`

- `excursion` con `it.hora` (`HH:MM`) → esa hora del día.
- `vuelo` con hora de salida (`dtParts(a.salida).time` del primer tramo) → esa hora.
- `coche` con `it.hora` → esa hora. (En la estructura del itinerario los ítems de
  coche llevan `hora` = `dtParts(recogida/devolucion).time`.)
- Las comidas **no** anclan.

### Simulación

```
// floor = SALIDA_FLOOR_MIN convertido a Date en day.date (parseDate(day.date) + minutos)
inicio = (sk && isDate(sk.civilDawn) && sk.civilDawn > floor) ? sk.civilDawn : floor
reloj = inicio.getTime()   // se trabaja en ms; se envuelve en Date al final
prev = null                 // última ubicación con coords
drivingMin = 0 ; legs = []
firstAnchor = null ; tHastaAncla = 0
missedAnchor = null

for (const it of day.items) {
  if (it.loc && it.loc.lat != null && prev) {
    const leg = driveByRoad(prev, it.loc);
    if (leg.km >= MIN_LEG_KM) { drivingMin += leg.min; reloj += leg.min * 60000; legs.push(leg); }
  }
  const a = anchorTime(it);
  if (a) {
    if (!firstAnchor) { firstAnchor = a; tHastaAncla = reloj - inicio; }
    if (reloj > a.getTime() + MARGEN_ANCLA_MIN * 60000) missedAnchor = missedAnchor || etiqueta(it);
    reloj = Math.max(reloj, a.getTime());
  }
  reloj += itemCost(it) * 60000;
  if (it.loc && it.loc.lat != null) prev = it.loc;
}

endTime = new Date(reloj);
salirA  = firstAnchor ? new Date(firstAnchor.getTime() - tHastaAncla) : null;
```

`tHastaAncla` se guarda como `reloj - inicio.getTime()` (ms) en el momento de
tocar la primera ancla, **antes** del `reloj = Math.max(reloj, a)`.
`etiqueta(it)` = título corto del elemento (excursión: `it.nombre`; vuelo:
`"vuelo {origen}→{destino}"`).

Día de vuelo: no se refina `inicio` con la hora de llegada — un día con vuelo y
`drivingMin < 30` acaba con `veredicto = null` (ver más abajo), así que la
imprecisión de `inicio` en ese caso no se muestra.

### Veredictos

```
// luz
let luz = null;
if (sk && isDate(sk.sunset)) {
  if (missedAnchor) luz = 'pasa';
  else if (endTime <= sk.sunset - MARGEN_ATARDECER_MIN*60000) luz = 'ok';
  else if (isDate(sk.civilDusk) && endTime <= sk.civilDusk)   luz = 'justo';
  else luz = 'pasa';
}

// volante
const h = drivingMin / 60;
const volante = h <= VOLANTE_LARGO_H ? 'ok' : h <= VOLANTE_MAX_H ? 'largo' : 'excesivo';

// veredicto = peor de los dos
const rank = { ok: 0, justo: 1, largo: 1, pasa: 2, excesivo: 2 };
const worst = Math.max(rank[luz ?? 'ok'], rank[volante]);
let veredicto = ['verde', 'ambar', 'rojo'][worst];

// día de vuelo poco relevante para conducción
const esDiaVuelo = day.items.some(x => x.t === 'vuelo');
if (esDiaVuelo && drivingMin < 30) veredicto = null;
// nada que decir si no hay luz y el volante está OK
if (!sk && volante === 'ok') veredicto = null;
```

### Devuelve

```
{ drivingMin, legs, salirA, endTime, missedAnchor, luz, volante, veredicto }
```

## 7. Integración en el Itinerario

`dayBlock(day)` llama a `const plan = dayPlan(day)` una vez.

### Badge en la cabecera (`day__head`)

`<span class="day-verdict day-verdict--{verde|ambar|rojo}">● {etiqueta}</span>`,
solo si `plan.veredicto` no es `null`. Etiqueta:

| Caso | Texto |
|---|---|
| rojo + `missedAnchor` | `No llegas a: {missedAnchor}` |
| rojo + `volante === 'excesivo'` | `{fmtDur(drivingMin)} al volante` |
| rojo + `luz === 'pasa'` | `Terminas de noche` |
| ámbar + `luz === 'justo'` | `Justo de luz` |
| ámbar + `volante === 'largo'` | `{fmtDur(drivingMin)} al volante` |
| verde | *(sin texto; solo el punto, con `title="Día holgado"`)* |

(Si un rojo cumple varias condiciones, prioridad: `missedAnchor` > volante
excesivo > luz pasa.)

### Línea de resumen (`<p class="day-plan">`, bajo la cabecera)

Solo si `plan.veredicto !== null` (los días de vuelo y los días sin nada
relevante no la muestran). Trozos unidos por ` · `, se pinta solo si hay al
menos uno:
- `plan.salirA` → `Sal sobre las {hhmm(salirA)}` (omitir si `salirA` es más de
  2 h anterior a `inicio` — entonces la etiqueta del badge ya dice "no llegas").
- `plan.endTime` → `fin ~{hhmm(endTime)}`
- `plan.drivingMin > 0` → `{fmtDur(drivingMin)} al volante`

### Tramos

El bucle de `dayBlock` que hoy llama a `legRow(km)` con `haversine` pasa a
`legRow(prevLoc, it.loc)`; `legRow` usa `driveByRoad`.

### `style.css`

```css
.day-verdict {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--step--1); font-weight: 500;
}
.day-verdict::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.day-verdict--verde { color: var(--c-accent); }
.day-verdict--ambar { color: var(--c-warn); }
.day-verdict--rojo  { color: var(--c-danger); }
.day-plan { color: var(--c-text-2); font-size: var(--step--1); margin: 2px 0 0; }
.day-plan .mono { font-family: var(--font-mono); }
```
Si `--c-warn` / `--c-danger` no existen en `:root`, añadirlos (ámbar ~`oklch(0.80 0.13 75)`,
rojo ~ el que usa `.btn--danger`).

## 8. Errores y casos límite

- **Día sin elementos con coords** → `drivingMin = 0`, sin tramos, `salirA = null`.
  Veredicto suele ser `null` (o verde). Se pinta bien.
- **Sin fechas de viaje** → `renderItinerario` ya muestra su aviso y no construye
  días; `dayPlan` no se llama.
- **SunCalc no cargó** → `sk = null`; solo veredicto de volante; sin fallo.
- **Ancla imposible** → `missedAnchor` con el nombre del evento; veredicto rojo.
  Si `salirA` sale absurdamente temprano, se omite la hora en la línea de
  resumen (la del badge ya lo dice).
- **Varias anclas** → la simulación respeta cada una en orden; la primera que no
  se alcanza gana la etiqueta.
- **Día de vuelo** (día 1 llegada 18:25 KEF, día 9 salida ~10:30): el vuelo es un
  ancla, coste 0. Si el día tiene vuelo y `drivingMin < 30` → `veredicto = null`
  (no se juzga). No se refina `inicio` con la hora de llegada — como el veredicto
  se anula, la `endTime`/`salirA` de ese día no se muestran de todos modos.
- **Excursión sin `hora`** → no ancla, solo cuenta como coste.
- **Tramo < `MIN_LEG_KM`** → se ignora en `dayPlan` (coherente con `legRow`).
- **Coordenadas fuera de Islandia / basura** → `zoneFor` cae al factor 1.35; da
  un número, no rompe.
- **DST / zona horaria** → como en A1 (spec A1 §7): todo `Date` local del
  navegador, horas mostradas `HH:MM` del dispositivo (que estará en hora de
  Islandia durante el viaje).
- **`fmtDur` con 0** → devuelve `"0 min"`; no se muestra el trozo si
  `drivingMin === 0`.

## 9. Pruebas y verificación

Sin framework de test → checklist manual, `python -m http.server`, viaje
sembrado (8–16 oct 2026):

1. **Tiempos por carretera**: cotejar contra Google Maps —
   Reikiavik→Vík (~180 km), Vík→Jökulsárlón (~190 km),
   Jökulsárlón→Egilsstaðir (~265 km), Egilsstaðir→Húsavík (~190 km),
   Akureyri→Reikiavik (~390 km). `driveByRoad` dentro de ~±20 %. Ajustar
   factores de `ZONAS` si hay desvío sistemático.
2. **Badge**: los 9 días muestran un punto de color; ámbar/rojo llevan etiqueta;
   ninguno lanza error en consola.
3. **Simulación**: el día de la excursión de cuevas de hielo (11 oct, encuentro
   08:30 en Jökulsárlón, noche anterior en Gerði a ~10 min) **no** debe salir
   "no llegas"; la línea de resumen muestra `Sal sobre las ~08:0x`.
4. **"Salir a"**: solo aparece en días con ancla; días sin excursión no lo
   muestran.
5. **Luz**: un día cargado en octubre → "justo" o "rojo" por luz; contrastar
   `fin ~HH:MM` con el atardecer que muestra la sección Clima de ese día.
6. **Volante**: Jökulsárlón→Egilsstaðir (~250 km reales, ~3–3,5 h) más las
   paradas → etiqueta de horas al volante; un día > 6 h → rojo.
7. **Día de vuelo** (1 y 9): badge ausente (`veredicto === null`).
8. **Sin fechas**: `renderItinerario` muestra su aviso; sin badges, sin errores.
9. **Offline** (`shell-v15`): itinerario con badges y tiempos igual (todo
   cálculo local). Consola limpia.
10. **Ciclo `shell-v14 → shell-v15`**: recarga una vez, `shell-v14` borrada,
    `tiles-v2` intacta, precache 28 entradas.
11. **Consola sin errores** en Datos, Itinerario, Mapas, Ideas, Clima.

## 10. Impacto en el README

- Sección de estructura / descripción: el itinerario estima tiempos por
  carretera (factor por región, offline) y marca la viabilidad de cada día
  (horas de luz + horas al volante), con la hora recomendada de salida.
- La línea del aviso legal ("Los tiempos de trayecto son estimaciones en línea
  recta") se actualiza: ahora son estimaciones por carretera con un factor de
  rodeo, no rutas calculadas.
