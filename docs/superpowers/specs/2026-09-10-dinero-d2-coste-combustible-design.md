# Dinero · D2 — Estimador de coste de combustible por ruta

Fecha: 2026-09-10 · Estado: aprobado (modo autónomo, sin gate) · Ships: `shell-v17`

## 1. Contexto

La app ya calcula, para cada día del itinerario, los km por carretera de cada
tramo: `dayPlan(day)` devuelve `legs: [{km, min}]` (y `drivingMin`). El
comentario en el código dice literalmente que `legs` "queda para B2/B3". D1
añadió `state.fx` (ISK↔€) y los helpers `toEUR` / `fmtEUR` / `fmtISK`.

## 2. Objetivo

Estimar, a partir de esos km, **cuántos litros y cuánto dinero** de combustible
consume cada día y el viaje entero, con un consumo y un precio del litro que el
usuario ajusta una vez. Poder registrar el gasto estimado con un botón (usa D1).

## 3. No-objetivos

- Precio de combustible en tiempo real: **no hay API fiable para Islandia**.
  Precio manual con un valor por defecto realista.
- Gasolineras en ruta, autonomía, desvíos: eran otra pieza del sub-proyecto B.
- Desglose por tramo en la UI: solo **por día** y **total**.
- Tocar `driveByRoad` / `dayPlan` más allá de leer lo que ya devuelven.
- Repartir por persona. Histórico de precios.

## 4. Decisiones

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Fuente de km | `dayPlan(day).legs`, `Σ leg.km` | recomputar rutas; usar `drivingMin`×velocidad |
| Parámetros | `state.combustible = { consumo, precioL, tipo }` — L/100 km, **ISK por litro**, `'Gasolina'\|'Diésel'` | campos en el `coche` (es seed de solo lectura); constantes fijas |
| Defaults | `consumo: 7`, `precioL: 309`, `tipo: 'Diésel'` (Dacia Duster diésel, media real con viento/frío/grava en Islandia; diésel ≈ 305-315 ISK/L a finales de 2025) | — |
| `tipo` | solo etiqueta; **no** afecta al cálculo (el precio es por litro) | que cambie el `precioL` por defecto |
| Dónde se edita | bloque plegable al principio de la pantalla **Itinerario** | pantalla de ajustes nueva; dentro de "Datos" |
| Dónde se ve | línea nueva en cada `dayBlock` (junto a la de B1) + **total del viaje** en el bloque de cabecera | solo total; modal |
| Moneda | `precioL` en ISK; el coste se muestra en **ISK y ≈ €** con la tasa de D1 (`toEUR`) | pedir el precio en € |
| Registrar gasto | botón "Añadir como gasto" en el total → `openSheet('gasto', null, preset)` con concepto/categoría/moneda/importe precargados | crear el gasto sin diálogo |

## 5. Modelo de datos

```js
const blankFuel = () => ({ consumo: 7, precioL: 309, tipo: 'Diésel' });
```

- `blankState()` gana `combustible: blankFuel()`.
- `load()`: `combustible: Object.assign(blankFuel(), p.combustible || {})`.
- `seedState()` lo hereda de `blankState()` (sin cambios).
- Los valores se guardan como **números** (los inputs hacen `+`); si algún valor
  llega corrupto, los getters caen al default.

## 6. Cálculo

```js
const FUEL = () => state.combustible || blankFuel();
const litros100 = () => { const c = +FUEL().consumo; return c > 0 ? c : 7; };
const precioLitro = () => { const p = +FUEL().precioL; return p > 0 ? p : 309; };

// km -> { litros, isk, eur }
function fuelEst(km) {
  const litros = (+km || 0) * litros100() / 100;
  const isk = litros * precioLitro();
  return { litros, isk, eur: toEUR(isk, 'ISK') };
}

// km por día: buildItinerary() ya lo devuelve en d.km (mismo driveByRoad /
// MIN_LEG_KM que dayPlan().legs), así que se usa d.km directamente y no se
// recomputa dayPlan en el total.
```

Formato:
- litros (línea diaria): `n.toLocaleString('es-ES', { maximumFractionDigits: n < 10 ? 1 : 0 })` + ` L`
  (1 decimal por debajo de 10 L para que los traslados cortos no salgan como «~0 L»; entero a partir de ahí).
- ISK: `fmtISK` (de D1) · € : `fmtEUR` (de D1)

## 7. UI

### 7.1 Línea por día (`dayBlock`, tras la línea `.day-plan` de B1)

Solo si `day.km >= 1`:

```
⛽ ~28 L · 8.700 ISK · ≈ 58 €
```

`<p class="day-fuel">⛽ ~<span>{litros} L</span> · {fmtISK(isk)} <span class="muted">· ≈ {fmtEUR(eur)}</span></p>`
(el `~` porque es estimación; litros con 1 decimal por debajo de 10 L, entero a partir de ahí).

### 7.2 Bloque de cabecera (`renderItinerario`, al principio de `#itin-body`, antes de `.chips--itin`)

Solo si hay fechas y al menos un día con km:

```
Combustible del viaje ≈  38.500 ISK · 257 €           [ Añadir como gasto ]
⛽ 7 L/100 km · 309 ISK/L · Diésel                     [▸ ajustar]
   └─ (plegado) consumo [7]  precio/L [309] ISK  tipo [Diésel ▾]
```

- `<section class="itin-fuel">`
  - `<p class="itin-fuel__tot">Combustible del viaje ≈ <b>{fmtISK(totalISK)}</b> · {fmtEUR(totalEUR)}</p>`
  - botón `.btn .btn--ghost .btn--sm` "Añadir como gasto" → `openSheet('gasto', null, { fecha: hoyYMD(), concepto: 'Combustible (estimado)', categoria: 'Combustible', moneda: 'ISK', importe: String(Math.round(totalISK)) })`
  - `<details class="itin-fuel__cfg">` con `<summary>⛽ {consumo} L/100 km · {precioL} ISK/L · {tipo}</summary>` y dentro 3 campos:
    - `number` consumo (`step="0.1" min="0"`, `inputmode="decimal"`)
    - `number` precioL (`step="1" min="0"`, `inputmode="numeric"`)
    - `select` tipo (`Gasolina` / `Diésel`)
  - cada campo (`consumo` máx. 50, `precioL` máx. 5000): al `change`, si el valor
    es válido (`> 0` y `<= max` para los números) →
    `state.combustible = Object.assign(blankFuel(), state.combustible, { [k]: v }); save(); renderItinerario();`
    y se restaura el foco en el mismo campo. Si el número es inválido (vacío /
    `<= 0` / por encima del máx.), restaurar el valor mostrado y no guardar.
  - el `<details>` recuerda si está desplegado (`itinFuelOpen`), porque cada
    `renderItinerario()` recrea el bloque entero.
- El total se calcula en `renderItinerario` iterando `it.days`:
  `it.days.reduce((s, d) => s + fuelEst(d.km).isk, 0)` — `d.km` ya lo da
  `buildItinerary()`.

### 7.3 `openSheet` — parámetro `preset`

`openSheet(kind, id, preset)` — 3er parámetro opcional. En el bucle de campos:

```js
sch.fields.forEach(f => {
  form.appendChild(fieldRow(f, data ? data[f.k] : (preset ? preset[f.k] : null)));
});
```

`editing = { kind, id: id || null }` sin cambios → al enviar, `id` nulo crea un
elemento nuevo con `uid()`. Ningún llamador actual pasa 3er argumento, así que es
retrocompatible.

## 8. Estilos (`style.css`)

Clases nuevas, todas con tokens ya existentes, sin pisar selectores previos:

- `.itin-fuel` — `background: var(--c-surface)`, `border: 1px solid var(--c-border-soft)`,
  `border-radius: var(--radius-m)`, `padding: var(--space-12)`, `margin-bottom: var(--space-16)`.
- `.itin-fuel__tot` — `font-family: var(--font-display)`, `font-size: var(--step-1)`,
  `display: flex`, `justify-content: space-between`, `align-items: baseline`, `gap: var(--space-12)`, `flex-wrap: wrap`.
- `.itin-fuel__cfg` — `margin-top: var(--space-8)`, `font-size: var(--step--1)`, `color: var(--c-text-2)`.
- `.itin-fuel__cfg summary` — `cursor: pointer`.
- `.itin-fuel__cfg .field` — `display: flex`, `gap: var(--space-8)`, `align-items: baseline`, `margin-top: var(--space-8)`.
- `.itin-fuel__cfg input` — `width: 5.5em`; `.itin-fuel__cfg select` — `width: auto`.
- `.day-fuel` — `font-size: var(--step--1)`, `color: var(--c-text-2)`, `margin: var(--space-4) 0 0`.

## 9. Integración y release

- `blankState` / `load` / helpers cerca de los de D1 (tras `blankFx`/`refreshFx`).
- `dayBlock`: añadir `.day-fuel` tras el bloque `if (plan.veredicto) { … }`
  (fuera de ese `if`: el combustible se muestra aunque el día no tenga veredicto,
  p. ej. día de vuelo con traslado — mientras `day.km >= 1`).
- `renderItinerario`: construir `.itin-fuel` y anteponerlo a `body` antes de `.chips--itin`.
- `openSheet`: 3er parámetro `preset`.
- `style.css`: bloque nuevo.
- `README.md`: una frase.
- Release: `?v=16 → ?v=17` en `index.html` (css + js) y en `SHELL_ASSETS` de
  `sw.js`; `sw.js` `shell-v16 → shell-v17`. `tiles-v2` sin cambios. Precache
  sigue en **28** entradas (no hay assets nuevos).

## 10. Casos borde

- **Sin días con km** (solo vuelos, o sin coordenadas): no se pinta `.itin-fuel`
  ni ninguna `.day-fuel`. El total sería 0.
- **`consumo` o `precioL` = 0 / vacío / no numérico**: getters caen a 7 / 309;
  el `change` inválido no se guarda y restaura el input.
- **Sin fechas de viaje**: `renderItinerario` ya sale antes con su `notice`; no
  se llega a `.itin-fuel`.
- **Tasa €**: si `state.fx.rate` no es `> 0`, `toEUR` usa 150 (comportamiento D1).
- **Día sin tramos**: `d.km` = 0 → sin línea.
- **`preset` con `openSheet`**: si el usuario cambia los valores en el sheet
  antes de guardar, manda lo que escribe (el `preset` solo rellena el valor
  inicial).
- **Coste del total**: usa `d.km` de `buildItinerary()`, así que no recomputa
  `dayPlan` (ni `SunCalc`) por día. `dayBlock` sigue llamando a `dayPlan(day)`
  una vez para su veredicto (B1) y lee `day.km` para el combustible.

## 11. Pruebas manuales

1. Con el itinerario de 9 días: cada día con trayectos muestra `⛽ ~N L · … ISK · ≈ … €`; los días de solo-vuelo o sin coords, no.
2. El total de `.itin-fuel` = suma de los ISK de las líneas diarias (± redondeo).
3. Cambiar `consumo` a 10 → todas las cifras suben ~43 %; a `0` → se ignora y el input vuelve a `7`.
4. Cambiar `precioL` a 350 → cifras ISK suben, € también (vía tasa D1).
5. Cambiar `tipo` a Gasolina → solo cambia la etiqueta del `<summary>`, no las cifras.
6. "Añadir como gasto" → abre el sheet de gasto con Combustible / ISK / importe = total redondeado / fecha hoy; al guardar aparece en "Gastos" (D1) y en su resumen.
7. Recargar → `state.combustible` persiste; `openSheet` normal (sin preset) sigue funcionando en todas las secciones.
8. `shell-v17` con 28 entradas; `shell-v16` eliminado; `tiles-v2` intacta; consola limpia en las 5 pantallas.
