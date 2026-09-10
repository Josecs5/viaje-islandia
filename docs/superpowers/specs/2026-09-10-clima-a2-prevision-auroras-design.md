# Clima · A2 — Previsión de auroras

Fecha: 2026-09-10 · Estado: aprobado (modo autónomo, sin gate) · Ships: `shell-v19`

## 1. Contexto

Clima A1 ya pinta una tarjeta por día del viaje (`renderClima` → `climaCard(sky(d))`)
con sol, hora dorada, ventana de oscuridad y luna, todo calculado en local con
SunCalc. `sky(dateStr)` usa `locForDate(dateStr)` = alojamiento donde se duerme
esa noche (o el anterior, o el centro de Islandia). D1 dejó el patrón de
integración con API: `fetch` cuando hay conexión, cachear en `state`, degradar
sin ruido, y el SW deja pasar el cross-origin no-tile.

## 2. Objetivo

Añadir a cada tarjeta de Clima una línea de **previsión de auroras** para esa
noche: **índice Kp máximo** de la noche y **nubosidad media** en la ventana de
oscuridad, en la ubicación donde se duerme. **Aviso destacado** cuando coincidan
Kp decente y cielo despejado.

## 3. No-objetivos

- No mapa de auroras, no óvalo auroral, no histórico, no notificaciones push.
- No sustituye a vedur.is (pestaña «Aurora»); es orientativo y así se dice.
- No tocar el cálculo de A1 salvo **exponer `loc {lat,lng}`** en el retorno de `sky()`.
- No previsión propia de Kp: se usa la de NOAA tal cual (solo llega a ~3 días).
- A3 (viento) reutilizará la misma llamada a Open-Meteo, pero se implementa aparte.

## 4. Fuentes de datos (gratis, sin clave, CORS `*` — verificado)

- **Kp**: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json`
  → array de objetos `{ time_tag: '<ISO naïve UTC>', kp: <number>, observed: 'observed'|'predicted', noaa_scale }`,
  bloques de 3 h, ~4 días de histórico + **~3 días de previsión**. Fuera de esa
  ventana (p. ej. planificando en septiembre un viaje de octubre) no hay dato → la
  tarjeta lo dice.
- **Nubes**: `https://api.open-meteo.com/v1/forecast` con
  `latitude=<a,b,…>&longitude=<a,b,…>&hourly=cloud_cover&forecast_days=16&timezone=UTC`.
  Multi-coordenada → **una sola petición** con las coordenadas únicas de los
  alojamientos del viaje; devuelve un **array** de resultados, `hourly.time[]` +
  `hourly.cloud_cover[]` (ISO naïve UTC, hasta ~16 días).

El SW no intercepta cross-origin no-tile (cae al final del handler `fetch` sin
`respondWith`), así que ambas peticiones van directas a red y no se precachean.

## 5. Modelo de datos

```js
const blankAurora = () => ({ kp: [], clouds: {}, fetched: null });
// kp:     [{ t: '<ISO UTC>', kp: <number>, pred: <bool> }]  (ordenado por t)
// clouds: { '<lat>,<lng>': [{ t: '<ISO UTC>', pct: <number> }] }  (clave = loc.lat.toFixed(2)+','+loc.lng.toFixed(2))
// fetched: '<ISO>' del último fetch con éxito, o null
```

- `blankState()` += `aurora: blankAurora()`.
- `load()`: `aurora: Object.assign(blankAurora(), p.aurora || {})`.
- `seedState()` lo hereda de `blankState()`.

## 6. `refreshAurora()`

Llamada: en el `try` de init (junto a `refreshFx()`) y en `showScreen('clima')`.

```
if (!navigator.onLine) return;
if (state.aurora.fetched && Date.now() - Date.parse(state.aurora.fetched) < 2 * 3600e3) return;
if (!state.meta.fechaInicio || !state.meta.fechaFin) return;

locs = únicas de eachDay(inicio, fin).map(locForDate), redondeadas a 2 decimales
Promise.all([
  fetch(NOAA).then(r => r.ok ? r.json() : Promise.reject()),
  fetch(OPENMETEO con las locs).then(r => r.ok ? r.json() : Promise.reject())
])
  .then(([kpRaw, omRaw]) => {
    kp = kpRaw.filter(x => x && x.time_tag && typeof x.kp === 'number')
             .map(x => ({ t: x.time_tag + 'Z', kp: x.kp, pred: x.observed !== 'observed' }));
    clouds = {}; (Array.isArray(omRaw) ? omRaw : [omRaw]).forEach((res, i) => {
      const key = locs[i].key;
      const H = res.hourly;
      clouds[key] = H.time.map((t, j) => ({ t: t + 'Z', pct: H.cloud_cover[j] }));
    });
    state.aurora = { kp, clouds, fetched: new Date().toISOString() };
    save(); renderClima();
  })
  .catch(() => {});   // silencia SOLO red/HTTP/parseo; si renderClima peta, que se vea
```

- `.catch(() => null)` va **antes** del `.then` de éxito (lección de D1 F2): un
  fallo de red/HTTP/parseo → se ignora en silencio; una excepción de
  `renderClima()` sale a consola.
- `2 h` de frescura evita reconsultar en cada `renderAll`/apertura de Clima.
- Sin `toast` ni `console.error` en el fallo (offline se degrada solo).
- Al normalizar, **se recortan `kp` y `clouds` a la ventana del viaje**
  (`fechaInicio − 12 h … fechaFin + 36 h`): no guardar 16 días de datos horarios
  por ubicación ni re-parsearlos en cada render.
- El guard de la respuesta de Open-Meteo comprueba `Array.isArray(hourly.time)`
  **y** `Array.isArray(hourly.cloud_cover)`; una ubicación sin nubes no impide
  guardar el resto ni avanzar `fetched` (si no, se re-consultaría en bucle).
- `clouds` se construye sobre lo ya cacheado (`Object.assign({}, prev, nuevo)`):
  si Open-Meteo no devuelve una ubicación, no se pierde su serie anterior.

## 7. Cálculo por noche — `auroraFor(s)`

`s` = objeto de `sky()`, que ahora incluye `s.loc = { lat, lng }` y ya trae
`s.darkWindow` (`{start:Date,end:Date}` o `null`) y `s.sunset`.

1. **Ventana de la noche**: si `s.darkWindow` → `[start, end]`. Si no (sin noche
   civil) → `[sunset+1h, next 02:00 UTC]` como aproximación; si tampoco hay
   `sunset` → sin ventana, `level:null`, `txt:'—'`.
2. **`maxKp`**: máximo `kp.kp` de las entradas cuyo `t` cae dentro de la ventana
   (± 90 min de margen). Si ninguna entrada del array cae en la ventana → `kp` de
   esa noche = `null` (fuera de previsión).
3. **`cloudPct`**: media de `pct` de `clouds[keyMásCercana]` cuyas horas caen en la
   ventana. `keyMásCercana` = la clave de `clouds` con menor distancia a `s.loc`
   (haversine sobre las lat/lng de la clave). Si esa distancia es **> 40 km** (p. ej.
   un alojamiento añadido tras el último fetch) → `null` (no mentir con nubes de
   otra ubicación). Si no hay datos → `null`.
4. **`level`** — **solo hay veredicto si hay Kp** (las nubes solas no indican
   auroras):
   - `null` si `maxKp == null` (sin previsión de Kp esta noche, aunque haya nubes).
   - `'alta'`  si `maxKp >= 3 && cloudPct != null && cloudPct <= 35 && s.darkWindow`.
   - `'media'` si `(maxKp >= 3 && (cloudPct == null || cloudPct <= 65)) || maxKp >= 5`.
   - `'baja'`  en otro caso con `maxKp != null`.
   (Islandia está a latitud magnética muy alta: con cielo despejado se ven auroras
   ya con Kp 2–3; el limitante real son las nubes.)
5. **`txt`** (el código comprueba `!A.fetched` **antes** que `lejano`: sin conexión
   es el dato más accionable):
   - sin Kp y sin nubes, sin fetch → `'sin datos — mira vedur.is (Aurora)'`.
   - sin Kp y sin nubes, con fetch y noche > 3 días desde hoy → `'previsión disponible ~3 días antes'`.
   - sin Kp y sin nubes, con fetch y noche cercana → `'sin datos esta noche'`.
   - con Kp pero sin nubes → `Kp {maxKp}` + palabra.
   - con nubes pero sin Kp → `nubes {cloudPct}% · Kp sin previsión` (line atenuada: sin veredicto).
   - completo → `Kp {maxKp1dec} · nubes {cloudPct}%` + palabra (`floja`/`posible`/`buena`).
6. **Antigüedad**: si `state.aurora.fetched` tiene > 18 h → `stale=true`: añadir
   ` (hace {h} h)` al texto y **atenuar la línea con prioridad sobre el nivel**
   (una previsión «buena» rancia no debe salir en acento).

`maxKp` se muestra con 1 decimal si no es entero (`5` / `4.3`).

## 8. Render (`climaCard`)

Tras la línea de la luna (o de `moon.inDarkWindow`), añadir:

```js
const a = auroraFor(s);
const p = skyLine('🌌', `auroras: ${esc(a.txt)}`);
if (a.stale || !a.level) p.querySelector('span:last-child').classList.add('is-dim');
else if (a.level === 'alta') { p.classList.add('sky-line--alert'); c.classList.add('sky-card--aurora'); }
else if (a.level === 'media') p.classList.add('sky-line--warm');
c.appendChild(p);
```

`stale` va **primero** (rancio siempre atenuado, sin importar el nivel). Las
clases `--alert`/`--warm` y `is-dim` son mutuamente excluyentes, así que no hay
choque de especificidad.

## 9. Estilos (`style.css`)

3 niveles de énfasis aditivos sobre el color base de `.sky-line` (`--c-text`):

- `.sky-line--alert span:last-child { color: var(--c-accent); font-weight: 600; }`
- `.sky-line--warm span:last-child { color: var(--c-text); font-weight: 600; }`  *(negrita, sin bajar el color)*
- `.sky-card--aurora { border-color: color-mix(in oklab, var(--c-accent) 55%, var(--c-border-soft)); }`
- `.sky-line .is-dim { color: var(--c-text-2); }` — **ya existe** en `style.css`.

Reutiliza `.sky-line`, `.sky-ic`, `.card`, `.sky-card`, tokens existentes.

## 10. Integración y release

- `sky()` return += `loc: { lat: loc.lat, lng: loc.lng }`.
- `blankState`/`load` += `aurora`.
- `refreshAurora` + helpers cerca de `refreshFx` (D1).
- `climaCard` += línea de auroras.
- `renderClima`: sin cambios de estructura (el fetch lo dispara `refreshAurora`
  desde init y `showScreen('clima')`; al resolver hace `renderClima()`).
- `showScreen`: en la rama `name === 'clima'`, llamar `refreshAurora()`.
- Init `try`: `refreshAurora()` tras `refreshFx()`.
- `style.css`: bloque nuevo pequeño.
- `README.md`: una frase.
- Release: `?v=18 → ?v=19` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`;
  `sw.js` `shell-v18 → shell-v19`. `tiles-v2` sin cambios. Precache **28**.

## 11. Casos borde

- **Sin fechas de viaje**: `refreshAurora` sale sin hacer nada; `renderClima` ya
  muestra su `notice`.
- **Offline en el primer arranque**: `state.aurora` vacío → cada tarjeta muestra
  `'sin datos — mira vedur.is (Aurora)'`, atenuado. Sin errores.
- **Viaje a > 3 días vista** (planificación): NOAA no cubre esas noches → `maxKp
  == null` → texto `'previsión disponible ~3 días antes'`; las nubes de Open-Meteo
  sí pueden aparecer hasta 16 días, así que se puede mostrar `nubes X%` solo.
- **`clouds` vacío o clave no encontrada**: `cloudPct = null`, no rompe.
- **`kp` con `kp` no numérico**: filtrado en el `map` de `refreshAurora`.
- **Fetch de una de las dos APIs falla**: `Promise.all` rechaza → `.catch` → no se
  toca `state.aurora`; se sigue mostrando lo cacheado (o «sin datos»).
- **`sky().darkWindow` null en verano**: la ventana se aproxima; en octubre
  (el viaje) siempre hay noche oscura, así que es el camino normal.
- **`fetched` viejo (> 18 h)**: se muestra igualmente con « (hace N h)» y atenuado.
- **DST/husos**: todo se compara en UTC (Islandia es UTC+0 todo el año); NOAA y
  Open-Meteo se piden/interpretan en UTC.

## 12. Pruebas manuales

1. Con conexión, abrir Clima: en unos segundos cada tarjeta gana una línea `🌌 auroras: …`.
2. DevTools → Network: una petición a `services.swpc.noaa.gov/...k-index-forecast.json` (200) y una a `api.open-meteo.com/v1/forecast?...` (200, respuesta array).
3. `localStorage` → `islandia_trip_v1` → `aurora` tiene `kp` (array), `clouds` (objeto con 1+ claves «lat,lng») y `fetched` (ISO).
4. Días del viaje a > 3 días de hoy: la línea dice «previsión disponible ~3 días antes» o solo «nubes X%». Días dentro de la ventana: «Kp N · nubes M% · palabra».
5. Forzar `state.aurora` con `kp` alto y `clouds` bajo para una noche (consola) y `renderClima()` → esa tarjeta muestra la línea en color de acento y el borde realzado (`sky-card--aurora`).
6. Network offline + `localStorage.clear()` + recargar: cada tarjeta muestra «sin datos — mira vedur.is (Aurora)» atenuado; consola sin errores; el resto de Clima (sol/luna) intacto.
7. Segundo `showScreen('clima')` en < 2 h: no hay segunda petición (guard de frescura).
8. `caches.keys()` → `shell-v19` con 28 entradas; `shell-v18` no está; `tiles-v2` intacta.
9. `node --check app.js` y `node --check sw.js` OK. Consola limpia en las 5 pantallas.
