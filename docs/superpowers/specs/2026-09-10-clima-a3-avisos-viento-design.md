# Clima · A3 — Avisos de viento

Fecha: 2026-09-10 · Estado: aprobado (modo autónomo, sin gate) · Ships: `shell-v20`

## 1. Contexto

A2 añadió `refreshAurora()`, que hace **una** petición a Open-Meteo por las
ubicaciones de pernocta del viaje (`hourly=cloud_cover`, 16 días, UTC) y la cachea
en `state.aurora = {kp, clouds, fetched}`. El viento en Islandia es el factor de
riesgo nº 1 en coche de alquiler (puertas arrancadas por ráfagas = daño no
cubierto), en puentes y altos expuestos, y para tiendas de campaña / F-roads.
Open-Meteo ya da `wind_speed_10m` y `wind_gusts_10m` (km/h) en la misma petición.

## 2. Objetivo

Una línea de **aviso de viento por día en el Itinerario** (junto a la de
viabilidad de B1 y la de combustible de D2): velocidad y ráfaga máximas previstas
para las horas de conducción de ese día en la zona, con consejo específico de
Islandia según la intensidad.

## 3. No-objetivos

- Sin pronóstico propio: Open-Meteo tal cual (~16 días; hoy, con el viaje a
  semanas, no habrá dato → sin línea, se activa al acercarse el viaje).
- **No** modificar el veredicto de B1 (`dayPlan`): línea `.day-wind` aparte.
- Sin mapa de viento, sin dirección detallada (solo velocidad + ráfaga).
- Sin alertas push.
- No repetir el consejo genérico de viento que ya está en Ideas «Consejos
  prácticos»; aquí es el dato por día + la acción concreta.

## 4. Fuente de datos

**Misma petición de A2**, ampliada:
`hourly=cloud_cover,wind_speed_10m,wind_gusts_10m` + `&wind_speed_unit=kmh`.
Verificado: `wind_speed_10m` / `wind_gusts_10m` en `km/h`, mismo `hourly.time`.

## 5. Modelo de datos — renombrado `aurora` → `meteo`

`state.aurora` pasa a `state.meteo` (ya no es solo auroras):

```js
const blankMeteo = () => ({ kp: [], clouds: {}, wind: {}, fetched: null });
// wind: { '<lat>,<lng>': [{ t:'<ISO UTC>', spd:<km/h>, gust:<km/h> }] }
```

- `blankState()` → `meteo: blankMeteo()` (en vez de `aurora: blankAurora()`).
- `load()`: `meteo: Object.assign(blankMeteo(), p.meteo || p.aurora || {})`
  (arrastra el `aurora` antiguo si existe en localStorage).
- Renombres mecánicos: `blankAurora→blankMeteo`, `refreshAurora→refreshMeteo`,
  `auroraLocs→meteoLocs`, `auroraFetching→meteoFetching`, `state.aurora→state.meteo`.
  **Se conservan**: `auroraFor` (es específico de auroras), la clase CSS
  `sky-card--aurora`, `sky-line--alert/--warm`, el texto de UI «auroras:», la
  sección/comentarios «A2».
- El recorte a ventana de viaje (`fechaInicio−12h … fechaFin+36h`) y el guard
  `Array.isArray(...)` de A2 se aplican también a `wind`.

## 6. `refreshMeteo()` — cambios

- URL Open-Meteo: `hourly=cloud_cover,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&forecast_days=16&timezone=UTC`.
- En el `.then`, además de `clouds`, construir `wind`:
  ```js
  wind[locs[i].key] = H.time
    .map((t, j) => ({ t: t + 'Z', spd: H.wind_speed_10m[j], gust: H.wind_gusts_10m[j] }))
    .filter(x => typeof x.gust === 'number' && inTrip(x.t));
  ```
  Guard: exigir `Array.isArray(H.wind_speed_10m) && Array.isArray(H.wind_gusts_10m)`
  además de `H.time` y `H.cloud_cover`.
- `state.meteo = { kp, clouds, wind, fetched: ... }`. `wind` parte de lo cacheado
  igual que `clouds` (`Object.assign({}, prev.wind, nuevo)`).
- El resto (guards de frescura 2 h, `meteoFetching`, `.catch(()=>null)` antes del
  éxito, `save()` + `renderClima()`) **sin cambios**. Además `renderItinerario()`
  al resolver (la línea de viento vive en el Itinerario) — llamar a los dos.
- Llamada: ya se dispara en init y en `showScreen('clima')`; **añadir**
  `showScreen('itinerario')` → `refreshMeteo()` (para que el viento se cargue al
  entrar en Itinerario aunque no se haya abierto Clima).

## 7. `windFor(day)` — nuevo, junto a `dayBlock`

`day` = objeto de `buildItinerary().days` (`{date, idx, items, km}`).

1. `loc = locForDate(day.date)` (proxy: la meteo de la pernocta ≈ la de la zona
   ese día; el viento exacto de la ruta varía, pero da la foto regional).
2. Ventana: `day.date` `08:00`–`21:00` UTC (horas de conducción con luz en octubre).
3. `key` de `state.meteo.wind` más cercana a `loc` (haversine); si `> 40 km` → sin dato.
4. `maxGust` / `maxSpd` = máximos de `gust` / `spd` de esa clave dentro de la ventana.
   Si no hay entradas → `return null`.
5. `stale` = `state.meteo.fetched` con > 18 h.
6. Nivel por `maxGust` (km/h):
   | ráfaga | nivel | copy |
   |---|---|---|
   | < 45 | — (`return null`, no se pinta) | |
   | 45–64 | `info` | `viento {spd} km/h, rachas {gust}` |
   | 65–89 | `aviso` | `rachas {gust} km/h — abre las puertas del coche agarrándolas con fuerza` |
   | ≥ 90 | `fuerte` | `rachas {gust} km/h — puertas con las dos manos; ojo en puentes, altos y tramos de grava; mal día para tienda de campaña o F-roads` |
7. `txt` con sufijo ` (hace {h} h)` si `stale`.
8. Return `{ txt, level:'info'|'aviso'|'fuerte', stale }`.

Números: `spd`/`gust` redondeados a entero (`Math.round`).

## 8. Render — `dayBlock`

Tras la línea `.day-fuel` (D2) y antes de `const fotos = …`:

```js
const w = windFor(day);
if (w) {
  const pw = el('p', 'day-wind');
  if (w.level === 'aviso') pw.classList.add('day-wind--aviso');
  else if (w.level === 'fuerte') pw.classList.add('day-wind--fuerte');
  if (w.stale || w.level === 'info') pw.classList.add('is-dim');
  pw.innerHTML = `💨 ${esc(w.txt)}`;
  wrap.appendChild(pw);
}
```

## 9. Estilos (`style.css`)

Junto a `.day-fuel`:
```css
.day-wind { font-size: var(--step--1); color: var(--c-text-2); margin: var(--space-4) 0 0; }
.day-wind.is-dim { color: var(--c-text-2); }
.day-wind--aviso { color: var(--c-warn, oklch(0.82 0.13 75)); }
.day-wind--fuerte { color: var(--c-accent); font-weight: 600; }
```
*(Comprobar si existe un token de aviso/ámbar en `:root` — `--c-warn`, `--c-amber`,
o el color que use `.day-verdict--ambar`; usar ese en vez del literal.)*

## 10. Integración y release

- `blankMeteo`, `state.meteo` en `blankState`/`load`; renombres §5.
- `refreshMeteo` (ex-`refreshAurora`) amplía la URL y construye `wind`; llama
  `renderClima()` **y** `renderItinerario()` al resolver.
- `showScreen`: `refreshMeteo()` también en `name === 'itinerario'`.
- `windFor(day)` nuevo; línea `.day-wind` en `dayBlock`.
- `style.css`: bloque `.day-wind*`.
- `README.md`: una frase.
- Release: `?v=19 → ?v=20` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`;
  `sw.js` `shell-v19 → shell-v20`. `tiles-v2` sin cambios. Precache **28**.

## 11. Casos borde

- **Sin fechas de viaje / offline / viaje lejano**: `refreshMeteo` no hace nada o
  las series quedan vacías tras el recorte → `windFor` devuelve `null` → sin línea.
  Ningún error.
- **`locForDate` cae a `ICE_CENTER`**: la clave más cercana puede quedar a > 40 km
  → sin dato → sin línea. Aceptable (mejor que un viento genérico del centro).
- **`gust` `null`** (hora sin dato): filtrado por `typeof x.gust === 'number'`.
- **Migración**: localStorage con `aurora` pero sin `meteo` → `load()` lo copia a
  `meteo`; el `wind` queda `{}` hasta el próximo `refreshMeteo` (que ocurre al
  entrar en Clima o Itinerario con conexión).
- **`renderItinerario` llamado desde `refreshMeteo` con el Itinerario oculto**:
  `renderItinerario` reconstruye `#itin-body` aunque esté `hidden`; sin efectos.
  (Mismo patrón que `renderClima` en A2.)
- **Día sin `items` con coords**: `locForDate` sigue devolviendo la pernocta →
  puede haber línea de viento aunque no haya `.day-fuel` (no se conduce pero
  interesa saber si hace viento para pasear / montar tienda). Aceptable.
- **DST/husos**: todo en UTC (Islandia UTC+0 todo el año).

## 12. Pruebas manuales

1. Con conexión, abrir Itinerario: la petición a Open-Meteo lleva ahora
   `wind_speed_10m,wind_gusts_10m`; `state.meteo.wind` es un objeto con claves
   «lat,lng» y arrays `{t,spd,gust}` (o vacíos si el viaje está lejos).
2. `state.aurora` ya no existe; `state.meteo` sí, con `kp`/`clouds`/`wind`/`fetched`.
   Clima (auroras A2) sigue funcionando igual.
3. Inyectar en consola `state.meteo.wind['<clave>']` con ráfagas 70 y 95 para dos
   días dentro del viaje y `renderItinerario()` → un día muestra
   `💨 rachas 70 km/h — abre las puertas…` en ámbar, otro
   `💨 rachas 95 km/h — puertas con las dos manos…` en acento y negrita.
4. Ráfaga < 45 → sin línea.
5. Offline + `localStorage.clear()` + recargar Itinerario → sin línea de viento,
   sin errores; B1 y D2 intactos.
6. `caches.keys()` → `shell-v20` con **28** entradas; `shell-v19` no está; `tiles-v2` intacta.
7. `node --check app.js` y `node --check sw.js` OK; consola limpia en las 5 pantallas.
