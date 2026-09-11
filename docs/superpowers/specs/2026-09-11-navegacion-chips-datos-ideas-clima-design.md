# Navegación — chips de filtro en Datos, Ideas y Clima

Fecha: 2026-09-11 · Estado: aprobado (tras 2 preguntas al usuario, ver abajo)

## 1. Contexto

Itinerario ya tiene una fila de chips arriba (`selectedItinDay`, `itinChip`,
`.chips.chips--itin`) para filtrar por día — «Todos» o «Día N», y solo se
pintan las tarjetas del día elegido (`it.days.filter(...)`, no un simple
`hidden`). El usuario pidió lo mismo para **Datos**, **Ideas** y **Clima**,
pero con "los distintos tópicos de esa sección" en vez de días — salvo en
Clima, donde aclaró explícitamente que los botones sí deben ser los días
(Clima ya está organizado por día, igual que Itinerario).

**Decisiones tomadas via pregunta al usuario:**
1. Comportamiento al pulsar un chip: **filtrar** (mostrar solo esa sección,
   ocultar el resto — como ya hace Itinerario/Mapas), no un simple
   scroll-to-índice.
2. Clima: los chips son **los días** (no una reorganización por tema tipo
   "Auroras"/"Viento" que mezclaría datos de los 9 días) — Clima se queda
   con su estructura de tarjeta-por-día, solo gana el filtro.

## 2. Objetivo

Replicar el patrón exacto de Itinerario (filtrar la lista de origen antes
de pintar, no `hidden` después) en las tres pantallas:

### 2.1 Datos
Chips: `Todo` + una por cada grupo ya existente (✈️ Vuelos, 🚗 Coche de
alquiler, 🛏️ Alojamientos, 🥾 Excursiones, 🍴 Dónde comer, 📍 Qué ver, 💶
Gastos) + 🎒 Equipaje (el bloque custom de E3). La tarjeta de cabecera
(`metaCard`, título y fechas del viaje) se queda siempre visible, igual que
`itinFuelBlock`/`outdoorRankBlock` en Itinerario se quedan siempre visibles
pase lo que pase con el filtro de día.

### 2.2 Ideas
Ideas tiene ~17 encabezados `<h3>` hoy (Experiencias, Paradas, Para probar,
Consejos, Tus recomendaciones, Supermercados, Trucos, Carreteras,
Gasolineras, Piscinas, Temporada, Plan B, Teléfonos, Emergencias, Salud,
Carretera y conducción, Policía y consulado). Filtrar 1:1 por cada uno daría
demasiados chips y dejaría un chip («Teléfonos importantes en Islandia»)
sin contenido propio (es solo la intro; los números están en las 4
secciones siguientes). Se agrupan en **13 tópicos** con sentido propio;
el único agrupamiento real es "Teléfonos" (junta la intro + las 4
categorías de `EMERGENCIAS`) — todo lo demás es 1:1 con su encabezado
actual:

| Tópico (chip) | Encabezados que cubre |
|---|---|
| 🌌 Experiencias | Experiencias que no te puedes perder |
| 📸 Paradas | Paradas y desvíos que merecen la pena |
| 🍽️ Para probar | Para probar |
| 🧭 Consejos | Consejos prácticos |
| ✍️ Tuyas | Tus recomendaciones |
| 🛒 Supermercados | Supermercados baratos: Bónus y Krónan |
| 🛒 Trucos | Trucos para un país caro |
| 🛣️ Carreteras | Carreteras: antes de conducir |
| ⛽ Gasolineras | Gasolineras y autonomía |
| 🛁 Piscinas | Piscinas y pozas termales |
| 🍂 Temporada | Calendario de temporada: octubre |
| 🌧️ Plan B | Plan B para días de lluvia o viento |
| 📞 Teléfonos | Teléfonos importantes en Islandia, Emergencias, Salud, Carretera y conducción, Policía y consulado |

Implementación sin tocar ninguna de las funciones `renderX(body)`
existentes: tras construir todo el contenido como hoy, un post-proceso lee
el `<h3>` de cada `.reco-cat` y decide si se pinta según el tópico
seleccionado — mismo resultado visual que "filtrar antes de construir",
pero sin reescribir 8 funciones de render distintas.

### 2.3 Clima
Chips: `Todos` + `Día N` por cada día del viaje (mismo texto que usa
Itinerario, mismo `N` = 1-based, aunque Clima no tiene `idx` de
`buildItinerary()` — se numera por posición en `eachDay()`). Filtrado real
(no `hidden`): solo se llama a `climaCard(sky(d))` para los días a mostrar.

**Decisión de diseño — sin auto-selección de "hoy" por defecto**: a
diferencia de Itinerario/Mapas (que seleccionan automáticamente el día de
hoy la primera vez si el viaje está en curso), Clima empieza en «Todos» por
defecto. Razón: el usuario no pidió cambiar la vista por defecto, solo
añadir navegación; y un vistazo a varios días de meteo/auroras/viento a la
vez es un caso de uso habitual al planificar (compararlos), que se perdería
si por defecto solo se viera un día. El scroll-a-hoy que ya existe
(`climaScrolled`/`showScreen('clima')`) sigue funcionando igual cuando el
filtro está en «Todos».

## 3. No-objetivos

- No se toca Itinerario (ya tiene su propio filtro, sirve de referencia).
- No se toca Mapas (ya tiene el suyo).
- Sin persistir el filtro entre sesiones — mismo criterio que
  `selectedItinDay`/`selectedDay` (variable de módulo, se resetea a "Todo"
  en cada recarga real de página).
- Sin cambio de release (sin assets nuevos, `.chips`/`.chip` ya existen en
  `style.css`, se reutilizan tal cual — fila horizontal con scroll, no hace
  falta wrap para los 14 chips de Ideas).

## 4. Riesgo

Bajo — mismo patrón ya probado en Itinerario/Mapas, solo se replica.
Autorrevisión inline, sin subagente.
