# Conducción · B2 — Gasolineras en ruta y aviso de autonomía

Fecha: 2026-09-10 · Estado: aprobado (modo autónomo, sin gate) · Ships: `shell-v24`

## 1. Contexto

B1 ya calcula km y tiempo reales por día (`dayPlan`, `driveByRoad`) y el semáforo
«¿día viable?». D2 añadió `state.combustible = {consumo, precioL, tipo}` y el panel
de ajustes en la cabecera del Itinerario (`itinFuelBlock`). En Islandia hay tramos
largos sin gasolinera (Kirkjubæjarklaustur→Höfn, Höfn→Egilsstaðir por la costa,
Egilsstaðir→Mývatn) y muchas estaciones son automáticas.

## 2. Objetivo

1. **Por día en el Itinerario**: las gasolineras fiables que quedan en la ruta de
   ese día, en orden, y el **tramo más largo sin ninguna** (km). La línea se
   destaca en ámbar si ese tramo se acerca a la autonomía cómoda del coche.
2. **Autonomía cómoda** editable: nueva capacidad de depósito en el panel de D2,
   y el número `~{km}` mostrado ahí.
3. **Bloque de referencia en Ideas**: los tramos largos conocidos y cómo
   funcionan las estaciones (automáticas, dónde repostar sí o sí).

## 3. No-objetivos

- Sin API ni datos en vivo de precios/estado de surtidores.
- Sin ruteo real: se aproxima con las paradas del día (mismas que usa B1) y una
  lista curada de estaciones con coordenadas.
- No tocar B1 (`dayPlan`) ni las líneas de D2/A3/A5 — línea `.day-fuelstops` aparte.
- No repetir el consejo de pago con tarjeta/PIN (ya en Ideas «país caro» D3).

## 4. Datos

### 4.1 `state.combustible.deposito`

- `blankFuel()` gana `deposito: 50` (litros; Dacia Duster ≈ 50 L). `load()` ya hace
  `Object.assign(blankFuel(), p.combustible || {})` → cubre la clave nueva.
- Getter: `depositoL() = (+FUEL().deposito > 0 ? +FUEL().deposito : 50)`.
- `autonomiaKm() = Math.round(depositoL() * 0.8 / litros100() * 100)` (reserva 20 %).

### 4.2 `GASOLINERAS` (constante, ~30 entradas)

`[{ n:'N1 Vík', lat, lng }]` — estaciones **fiables** (N1, Olís, ÓB, Orkan, Costco)
en/junto a la Ruta 1 y los desvíos del viaje: zona Keflavík/Reikiavik, Selfoss,
Hveragerði, Hvolsvöllur, Vík, Kirkjubæjarklaustur, Höfn, Djúpivogur, Breiðdalsvík,
Egilsstaðir, Reyðarfjörður, Mývatn/Reykjahlíð, Akureyri, Varmahlíð, Blönduós,
Staðarskáli, Borgarnes, Búðardalur, Þingvellir/Laugarvatn (Círculo Dorado). Coords
aproximadas del pueblo/estación, 4-5 decimales.

## 5. `fuelStopsFor(day)` — nuevo, junto a `windFor`

`day` = objeto de `buildItinerary().days`.

1. `pts` = `day.items` con `loc.lat != null`, ordenados por `sortT`; se les añade
   al final `locForDate(day.date)` (la pernocta). Si `pts.length < 2` → `return null`.
2. `cerca(P)` = `GASOLINERAS.some(g => haversine(g, P) <= 12)` (km).
3. Recorrer `pts` en orden: `gap = 0`; para cada `i>0`,
   `gap += driveByRoad(pts[i-1], pts[i]).km`; si `cerca(pts[i])` →
   `maxGap = Math.max(maxGap, gap); gap = 0`. Al final `maxGap = Math.max(maxGap, gap)`.
   (Se asume salir con el depósito lleno: el `gap` arranca en 0.)
4. `nombres` = nombres de `GASOLINERAS` a ≤ 12 km de **algún** `pt`, deduplicados,
   en el orden en que aparecen a lo largo de `pts`.
5. `aut = autonomiaKm()`. `level`: `maxGap >= aut` → `fuerte`;
   `maxGap >= aut * 0.75` → `aviso`; si no → `null` (sin destacar).
6. Si `nombres.length === 0 && maxGap < 60` → `return null` (día corto sin nada que decir).
7. `stale` no aplica (no depende del parte).
8. Return `{ nombres, maxGap: Math.round(maxGap), aut, level }`.

## 6. Render — `dayBlock`

Tras la línea `.day-fuel` (D2) y **antes** de `.day-wind` (A3), si
`fuelStopsFor(day)` no es `null` y `day.km >= 40`:

```js
const fs = fuelStopsFor(day);
if (fs && day.km >= 40) {
  const p = el('p', 'day-fuelstops' + (fs.level ? ' day-fuelstops--' + fs.level : ''));
  const lista = fs.nombres.length ? fs.nombres.join(' · ') : 'ninguna fiable en ruta';
  const gap = fs.maxGap >= 60 ? ` · tramo más largo sin repostar: ~${fs.maxGap} km` : '';
  p.innerHTML = `⛽ gasolineras hoy: ${esc(lista)}${esc(gap)}`;
  wrap.appendChild(p);
}
```

## 7. Panel de D2 (`itinFuelBlock`) — depósito + autonomía

- Generalizar `mkNum` para aceptar un getter de valor (o añadir un `case`):
  añadir un campo **Depósito** `number step="1" min="0" max="200"` →
  `state.combustible = Object.assign(blankFuel(), state.combustible, { deposito: v })`.
- En el `<summary>` o una línea bajo él: `· autonomía ~${autonomiaKm()} km`.

## 8. Bloque de Ideas — `renderGasolineras(body)`

Constante `GASINFO = { intro, tramos:[str], nota }` (forma tipo `MERCADOS`).
`renderGasolineras(body)` gemela de `renderCarreteras`: `<section class="reco-cat">`
badge `⛽`, `<h3>Gasolineras y autonomía</h3>`, intro, una `.reco-card` por tramo
largo conocido, y un card final con la nota (estaciones automáticas → tarjeta con
PIN; en el este/norte no bajes de medio depósito; el interior/F-roads no tienen).

Llamada en `renderReco()`: tras `renderCarreteras(body)` y antes de
`renderPlanB(body)` (grupo de conducción junto al de carreteras).

## 9. Estilos (`style.css`)

```css
.day-fuelstops { font-size: var(--step--1); color: var(--c-text-2); margin: var(--space-4) 0 0; }
.day-fuelstops--aviso { color: var(--c-warning); }
.day-fuelstops--fuerte { color: var(--c-danger); font-weight: 600; }
```
El bloque de Ideas reutiliza `.reco-cat*`.

## 10. Integración y release

- `blankFuel()` += `deposito: 50`; getters `depositoL` / `autonomiaKm` junto a
  `litros100`/`precioLitro` (D2).
- `GASOLINERAS` + `fuelStopsFor(day)` nuevos; línea `.day-fuelstops` en `dayBlock`.
- `itinFuelBlock`: campo Depósito + lectura de autonomía.
- `GASINFO` + `renderGasolineras(body)`; llamada en `renderReco`.
- `style.css`: `.day-fuelstops*`.
- `README.md`: una frase.
- Release: `?v=23 → ?v=24` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`;
  `sw.js` `shell-v23 → shell-v24`. `tiles-v2` sin cambios. Precache **28**.

## 11. Casos borde

- **Día sin paradas con coords** (`pts.length < 2`): `fuelStopsFor` → `null`, sin línea.
- **Día corto** (`day.km < 40`): no se pinta aunque `fuelStopsFor` devuelva algo.
- **`deposito`/`consumo` corruptos**: getters caen a 50 / 7.
- **Ninguna gasolinera cerca de la ruta** y `maxGap >= 60`: `nombres` vacío →
  «ninguna fiable en ruta» + el tramo; si además `maxGap < 60` → `null`.
- **`locForDate` = `ICE_CENTER`**: se añade igual como último `pt`; `cerca` casi
  seguro `false`, sube el `maxGap` — aceptable (día sin alojamiento, aviso extra).
- Sin `state` / offline: todo es cálculo local sobre constantes + `state.combustible`;
  funciona igual.

## 12. Pruebas manuales

1. Itinerario, vista «Todos»: los días con conducción (`km ≥ 40`) muestran
   `⛽ gasolineras hoy: N1 Höfn · Olís Djúpivogur · … · tramo más largo sin repostar: ~NN km`.
2. Panel de combustible (D2): campo **Depósito** editable; el `<summary>` o una
   línea muestra `· autonomía ~NNN km`. Bajar `deposito` a 20 o subir `consumo` a
   12 → la autonomía baja y algún día `.day-fuelstops` pasa a ámbar/rojo.
3. Ideas → tras «Carreteras» aparece «⛽ Gasolineras y autonomía» con los tramos
   largos y la nota; antes de «Plan B».
4. `node --check app.js` OK; consola limpia en las 5 pantallas.
5. `caches.keys()` → `shell-v24` con **28** entradas; sin `shell-v23`; `tiles-v2` intacta.
