# Clima · A1 — Luz y luna — Diseño

Fecha: 2026-09-10
Estado: aprobado el diseño; pendiente de plan de implementación
Ámbito: arquitectónico (sección nueva + reestructura de navegación)

## 1. Contexto

Sub-proyecto **"Naturaleza y clima reactivo"**, descompuesto en 5 piezas
independientes (cada una con su ciclo spec → plan → implementación):

| Pieza | Qué es | Depende de |
|---|---|---|
| **A1 · Luz y luna** | Horas de luz, hora dorada, ventana de oscuridad, fase y salida/puesta de luna, por día | — |
| A2 · Meteo por día | Temperatura, lluvia, viento; avisos de viento | — |
| A3 · Auroras | Probabilidad + alerta por noche (KP + nubosidad + oscuridad/luna) | A1, A2 |
| A4 · Carreteras | Estado road.is / safetravel, F-roads, vados | — |
| A5 · Días malos | Reordenar días sugerido + plan B de interior | A2 |

**Este spec cubre solo A1.** Las demás piezas se diseñan después.

Estado actual de la app: PWA vanilla (HTML/CSS/JS, sin build, sin framework),
datos en `localStorage`, modo offline con service worker (`shell-v13`), 5
pestañas: Datos, Itinerario, Mapas, Ideas, Ruta. El Itinerario renderiza cada
día con `dayBlock(day)` y ya cuelga bloques enriquecidos por día (fotos de zona,
recomendaciones). Los alojamientos tienen `loc: {lat, lng}` y `zona`.

## 2. Objetivo y no-objetivos

### Objetivo

Una sección nueva, **"Clima"**, que para cada día del viaje muestre luz y luna
calculadas localmente (sin API, funciona offline):

- Salida y puesta de sol, duración del día, y diferencia de luz respecto al día
  anterior.
- Ventana de hora dorada de mañana y de tarde.
- Ventana de oscuridad astronómica de esa noche (dato que A3 necesitará).
- Fase de luna e iluminación, salida y puesta de luna, y si la luna está sobre
  el horizonte durante la ventana de oscuridad.

La sección ocupa el 5º hueco de pestañas, que hoy es "Ruta". El contenido de
"Ruta" (tarjeta para abrir el recorrido completo en Google Maps) se mueve
dentro de "Mapas".

### No-objetivos

- Ninguna API externa. Todo es cálculo (lat/lng/fecha).
- Sin almacenamiento: se recalcula en cada render.
- No se toca el motor de itinerario ni `buildItinerary()`.
- No hay tarjeta "hoy/esta noche" separada arriba de la lista (llegará con A3,
  como go/no-go de auroras).
- Sin hora azul ni desglose de los tres crepúsculos (se descartó por YAGNI en
  brainstorming).
- No se conserva compatibilidad del deep-link `#ruta` (cae en "Datos").

## 3. Decisiones (con alternativas descartadas)

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Dónde vive A1 | Sección/pestaña nueva | Línea desplegable en cabeceras del Itinerario; ambas |
| 5º hueco de pestañas | "Ruta" se elimina como pestaña; su tarjeta va a "Mapas" (abajo, bloque propio con separador) | Tarjeta solo al elegir "Todo el viaje"; tarjeta reducida a un botón junto a Google/Apple/Waze |
| Nombre de la pestaña | **"Clima"** | "Cielo" (cojea con carreteras); "Natura" (vago) |
| Ubicación por día | Alojamiento donde se duerme esa noche; fallback: noche anterior → centro de Islandia | Centro de gravedad de los sitios del día; punto fijo para todo el viaje |
| Detalle por día | Sol + delta + hora dorada AM/PM + ventana de oscuridad + salida/puesta de luna + "luna en ventana oscura" | Mínimo (solo sol + fase); máximo (+ hora azul + 3 crepúsculos) |
| Cálculo astronómico | Vendorizar **SunCalc** (~7 KB, MIT, autor de Leaflet) | Fórmulas a mano (la salida/puesta de luna es frágil de escribir); SunCalc solo para el sol + luna a mano |

## 4. Navegación, archivos y release

### Nuevos

- `vendor/suncalc/suncalc.js` — SunCalc **1.9.0**, sin modificar.
- `<section id="screen-clima" data-screen="clima" hidden>` en `index.html`, con
  `screen-head` + `#clima-body`.

### Modificados

- `index.html`:
  - 5ª pestaña: `data-tab="ruta"` → `data-tab="clima"`; etiqueta "Ruta" → "Clima";
    icono SVG nuevo (sol + luna, en línea como los demás).
  - Eliminar `<section id="screen-ruta">`. Su `.ruta-card` (SVG decorativo,
    título, subtítulo, `#ruta-open`, `#ruta-copy`, `#ruta-url`) se mueve
    **verbatim** dentro de `#screen-mapas`, tras `#map-legend`, envuelta en
    `<div class="map-route"><h3>Recorrido completo en Google Maps</h3> … </div>`.
  - Añadir `<script src="vendor/suncalc/suncalc.js" defer></script>` antes de
    `app.js`.
  - `?v=13` → `?v=14` en `style.css` y `app.js`.
- `sw.js`: `shell-v13` → `shell-v14`; en `SHELL_ASSETS` añadir
  `./vendor/suncalc/suncalc.js` y actualizar `./style.css?v=14` /
  `./app.js?v=14`. `tiles-v2` sin cambios.
- `app.js`:
  - `grep` de `ruta` → cualquier referencia de pantalla (`showScreen`, lista de
    pantallas válidas, hash) pasa a `clima`. Los handlers `#ruta-open` /
    `#ruta-copy` se enlazan por id y no cambian.
  - Nuevo `renderClima()` + helpers de astronomía (`locForDate`, `sky(date,
    loc)`, formato). Se engancha en `renderAll()` y en el flujo de mostrar
    pantalla.
  - Auto-abrir "hoy": si el viaje está en curso, al pintar la sección se hace
    scroll a la tarjeta de hoy (mismo patrón `*Init` que Itinerario/Mapas).
- `style.css`: `.map-route` (separación con `border-top`), estilos de las
  tarjetas de `#screen-clima` y de las líneas sol/luna. `.ruta-card` sin
  cambios. Sube el `?v`.
- `README.md`: fila nueva en la tabla de estructura; nota de que "Ruta" ahora
  vive en "Mapas".

## 5. Modelo de datos por día (sin almacenamiento)

Todo se recalcula en cada `renderClima()`. Función pura de `state.meta`
(fechas) + `state.alojamientos`. Nada en `localStorage`.

### `locForDate(ymd)` → `{ lat, lng, label }`

1. Alojamiento cuya estancia cubre esa noche (`checkin <= ymd < checkout`); si
   tiene `loc.lat`/`loc.lng`, se usa, con `label` = nombre del alojamiento.
2. Si no, retroceder noche a noche hasta el alojamiento anterior con
   coordenadas.
3. Si sigue sin haber ninguno: `{ lat: 64.9, lng: -18.6, label: 'centro de
   Islandia' }`.

El último día (check-out sin nuevo check-in) cae en el paso 2.

### `sky(date, loc)` → objeto del día

`date` se fija a mediodía local (`new Date(y, m-1, d, 12, 0, 0)`) para evitar
bordes de zona horaria. Usa SunCalc:

- `SunCalc.getTimes(date, loc.lat, loc.lng)` → `sunrise`, `sunset`,
  `goldenHourEnd` (fin de la dorada de mañana), `goldenHour` (inicio de la
  dorada de tarde), `night` (inicio de la noche astronómica de hoy).
- `SunCalc.getTimes(date + 1 día, …)` → `nightEnd` de mañana.
- `SunCalc.getTimes(date − 1 día, …)` → duración del día de ayer, para el delta.
- `SunCalc.getMoonIllumination(date)` → `fraction` (0–1), `phase` (0–1).
- `SunCalc.getMoonTimes(date, loc.lat, loc.lng)` → `rise`, `set` (cualquiera
  puede ser `undefined`), `alwaysUp`, `alwaysDown`.
- `SunCalc.getMoonPosition(t, loc.lat, loc.lng).altitude` en el inicio, el
  punto medio y el fin de la ventana de oscuridad → `moon.inDarkWindow`.

Objeto resultante:

```
{
  date,                       // 'YYYY-MM-DD'
  locLabel,                   // de locForDate
  sunrise, sunset,            // Date | null si no hay (no pasa en octubre)
  dayLengthMin,               // entero
  deltaVsPrevMin,             // entero con signo (negativo = menos luz que el día natural anterior; se calcula también para el primer día del viaje comparando con la víspera)
  goldenAM: { start, end },   // Date; { sunrise, goldenHourEnd }
  goldenPM: { start, end },   // Date; { goldenHour, sunset }
  darkWindow: { start, end } | null,   // { night(hoy), nightEnd(mañana) }
  moon: {
    phaseName,                // ver tabla de fases
    illumPct,                 // Math.round(fraction * 100)
    rise: Date | null,
    set: Date | null,
    alwaysUp, alwaysDown,     // bool
    inDarkWindow: 'sí' | 'a medias' | 'no' | null   // null si darkWindow es null
  }
}
```

### Nombre de fase (a partir de `phase` de SunCalc, 0 = nueva, 0.5 = llena)

| Rango de `phase` | Nombre |
|---|---|
| `< 0.02` o `>= 0.98` | Luna nueva |
| `0.02 – 0.24` | Creciente |
| `0.24 – 0.26` | Cuarto creciente |
| `0.26 – 0.48` | Gibosa creciente |
| `0.48 – 0.52` | Luna llena |
| `0.52 – 0.74` | Gibosa menguante |
| `0.74 – 0.76` | Cuarto menguante |
| `0.76 – 0.98` | Menguante |

### `inDarkWindow`

Con `darkWindow = { start, end }`: `alt(t) = SunCalc.getMoonPosition(t,
loc.lat, loc.lng).altitude`. Se evalúa en `start`, `(start+end)/2` y `end`.

- las tres `> 0` → `'sí'`
- una o dos `> 0` → `'a medias'`
- ninguna `> 0` → `'no'`

## 6. UI de la sección "Clima"

`#screen-clima`:

- Cabecera: `<h2>Clima</h2>` +
  `<p class="muted">Luz y luna de cada día. Meteo, auroras y carreteras llegarán aquí.</p>`
- Sin `state.meta.fechaInicio` / `fechaFin` → aviso "Añade las fechas de inicio
  y fin en «Datos del viaje»…" (reutiliza `notice(...)`, igual que Itinerario).
- Si `typeof SunCalc === 'undefined'` → aviso corto ("No se pudo cargar el
  cálculo de sol y luna. Recarga la app.") y no se pinta la lista.
- `#clima-body`: una tarjeta `.card` por día, los N días del viaje en orden.

### Tarjeta de día

```
Jueves, 9 oct · Vík Cottages
☀️  08:14 – 18:31   ·   10 h 17 min   ·   −4 min
📸  dorada  08:14–08:53   ·   17:52–18:31
🌑  oscuridad  20:11 – 06:44
🌔  Gibosa creciente 68%   ·   sale 15:40   ·   se pone 01:10
      en la ventana oscura: a medias
```

- **Cabecera**: `cap(fmtDiaSemana(date))`, `fmtFecha(date)` y `locLabel`
  separados por `·`. Reutiliza el patrón de `day__head`.
- **Sol**: `HH:MM – HH:MM` · `fmtDur(dayLengthMin)` · delta con signo
  (`+N min` / `−N min`; clase verde si `> 0`, atenuada si `<= 0`). Se muestra
  también en el primer día (comparado con la víspera).
- **Hora dorada**: `dorada HH:MM–HH:MM · HH:MM–HH:MM`.
- **Oscuridad**: `oscuridad HH:MM – HH:MM`. Si `darkWindow` es `null`, se omite
  la línea entera.
- **Luna**: `<fase> <pct>%` · `sale HH:MM` · `se pone HH:MM`.
  - Si `rise` es `null` → se omite "sale …"; igual con `set`.
  - Si `alwaysUp` → "sobre el horizonte toda la noche" en vez de sale/se pone.
  - Si `alwaysDown` → "no sale".
  - Segunda línea, atenuada: `en la ventana oscura: <inDarkWindow>`. Se omite si
    `inDarkWindow` es `null`.
- **Hoy**: si `date === hoyYMD()` y está dentro del rango, la tarjeta lleva
  clase de resaltado (reutiliza `day--hoy`) y, la primera vez que se pinta la
  sección con el viaje en curso, se hace `scrollIntoView` a esa tarjeta.

### Formato de horas

Helper local `hhmm(date)` → `HH:MM` con `pad2`, hora local del navegador
(coherente con el resto de la app; ver §7 sobre DST). `null`/`Invalid Date` →
`—`.

## 7. Errores y casos límite

- **Sin fechas de viaje** → aviso, no se calcula nada.
- **SunCalc no cargó** → aviso corto; el resto de la app sigue. `suncalc.js` es
  local, `defer`, y va en el precache: en la práctica solo con caché a medias.
- **Día sin ubicación resoluble** → centro de Islandia, `label` lo refleja.
- **`getMoonTimes` sin `rise` o sin `set`** (normal, desfase ~50 min/día) → se
  omite ese trozo; `alwaysUp` / `alwaysDown` → texto especial.
- **`night` / `nightEnd` `Invalid Date`** — en octubre a 64–66°N siempre hay
  noche astronómica, pero si sale inválido → `darkWindow = null`, se omite la
  línea de oscuridad y `moon.inDarkWindow = null`.
- **La ventana de oscuridad cruza medianoche** (siempre): `start` es de la noche
  del día, `end` de la madrugada siguiente; se muestran solo las horas, se
  entiende por contexto.
- **DST**: Islandia no cambia la hora; España sí. Todos los cálculos usan `Date`
  local del navegador y se formatean `HH:MM`, coherente con el resto de la app.
  Las horas mostradas son las del dispositivo de quien mira (que estará en la
  hora de Islandia durante el viaje).
- **Deep-link `#ruta`** ya no resuelve → la validación existente
  (`location.hash.slice(1) || 'datos'` + comprobación de pantalla válida) cae en
  "Datos".
- **Rendimiento**: O(días) · 4 llamadas SunCalc por día; para 9 días es trivial
  y no se cachea.

## 8. Pruebas y verificación

Sin framework de test → checklist manual en navegador, servido por
`python -m http.server`.

1. **Pestaña**: la 5ª dice "Clima", icono sol+luna, abre `#screen-clima`;
   "Ruta" ya no existe como pestaña.
2. **Ruta reubicada**: en "Mapas", tras la leyenda, "Recorrido completo en
   Google Maps" con la tarjeta; "Abrir en Google Maps" abre
   `https://maps.app.goo.gl/co4RMxLFR9xbP5eX7`; "Copiar enlace" copia; el SVG
   decorativo se ve.
3. **Cálculo**: con el viaje sembrado (8–16 oct 2026), la sección lista 9 días.
   Cotejar 2–3 días contra timeanddate.com (Reikiavik, Vík, Akureyri): salida y
   puesta de sol dentro de ±2 min; duración del día coherente; fase e
   iluminación de luna correctas.
4. **Delta**: negativo y ~4–6 min/día en octubre; el primer día lo muestra
   comparado con la víspera.
5. **Ubicación por día**: día 2 usa "Vík Cottages", día 5 "Fosshotel Húsavík",
   día 8 (check-out en Keflavík, vuelo) usa la ubicación de la noche anterior.
6. **Luna sin salida o sin puesta**: localizar un día donde `getMoonTimes` no dé
   una de las dos y confirmar que la línea se adapta.
7. **Hoy**: con fechas de un viaje en curso (o simulando la fecha del sistema
   dentro del rango), la tarjeta de hoy se resalta y la sección hace scroll
   hasta ella.
8. **Sin fechas**: borrar fechas en Datos → la sección muestra el aviso.
9. **Offline**: SW activo (`shell-v14`), DevTools > Offline, recargar → "Clima"
   funciona igual (todo cálculo local; `suncalc.js` en el precache).
10. **Deep-link viejo**: abrir con `#ruta` en la URL → cae en "Datos" sin
    romper.
11. **Ciclo de actualización** `shell-v13` → `shell-v14` (con `suncalc.js` en el
    precache): recarga una vez, `shell-v13` se borra, `tiles-v2` intacta.

## 9. Impacto en el README

- Tabla de estructura: fila `vendor/` menciona también SunCalc; fila nueva o
  nota sobre la sección "Clima".
- Nota: "Ruta" dejó de ser pestaña; el enlace de Google Maps está ahora al final
  de "Mapas".
