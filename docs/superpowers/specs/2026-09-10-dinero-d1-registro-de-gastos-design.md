# Dinero · D1 — Registro de gastos — Diseño

Fecha: 2026-09-10
Estado: aprobado el diseño; pendiente de plan de implementación
Ámbito: arquitectónico (nueva colección de datos + tipo de cambio + CRUD en "Datos")

## 1. Contexto

Sub-proyecto **"Dinero"**, descompuesto en 3 piezas:

| Pieza | Qué es | Depende de |
|---|---|---|
| **D1 · Registro de gastos** | CRUD de gastos en ISK y €, con tipo de cambio del día cacheado + override manual | — |
| D2 · Estimador de combustible por ruta | `km del viaje × L/100km × precio/L`; consume los km por carretera de B1 | B1 |
| D3 · Bónus/Krónan + trucos de país caro | Horarios y consejos curados, por zona o en Ideas | — |

**Este spec cubre solo D1.**

Estado de la app: PWA vanilla, sin build, sin framework, sin framework de test.
Modo offline con service worker (`shell-v15`). 5 pestañas: Datos, Itinerario,
Mapas, Ideas, Clima. La pantalla **Datos** muestra grupos de datos del viaje
(vuelos, coche, alojamientos, excursiones, "Dónde comer", "Qué ver"). El
mecanismo genérico ya existente:

- `state.<colección>` = array de objetos con `id`.
- `SCHEMAS.<kind>` = `{ sing, icon, fields: [{ k, l, t, req, ... }] }` describe
  el formulario; `openSheet(kind, id?)` lo pinta en el bottom-sheet y el handler
  `on('#sheet-form', 'submit', …)` construye el objeto y hace `save()`.
- `COL_OF` / `KIND_OF` mapean kind↔colección. `EDITABLE_COLS` marca qué grupos
  permiten añadir/editar/eliminar (hoy: `comidas`, `lugares`, `recomendaciones`).
- `renderDatos()` recorre una lista de `[colección, etiqueta, funcSummary]` y
  llama a `groupEl(col, label, summarize)`.
- `blankState()` y `load()` enumeran las colecciones explícitamente.
- `Intl.NumberFormat` está disponible; `hoyYMD()`, `fmtFecha()`, `esc()`,
  `el(tag, cls)`, `toast()` son helpers existentes.

## 2. Objetivo y no-objetivos

### Objetivo

Un grupo **"Gastos"** al final de la pantalla **Datos**, con CRUD completo
(a diferencia del resto de Datos, que es de solo lectura):

- Registrar gastos: fecha, concepto, categoría, moneda (ISK o €), importe,
  notas. Cada gasto se muestra en su moneda y convertido a la otra.
- Un **resumen** en la cabecera del grupo: total en € y en ISK, desglose por
  categoría, y la **línea de tipo de cambio** editable.
- **Tipo de cambio ISK↔€**: se pide a frankfurter.dev (tipos del BCE, gratis,
  sin clave) al arrancar con conexión, se cachea en `state.fx` con fecha, y se
  puede sobrescribir a mano. Sin conexión: última tasa guardada, o un valor
  aproximado de fábrica.

### No-objetivos

- Sin pestaña nueva (va dentro de "Datos").
- Moneda propia fija en **EUR** (no configurable).
- Sin librería nueva: solo una petición HTTP a un servicio público.
- No se cruza con el itinerario (nada de "gasto por día" en la pantalla
  Itinerario) ni con B1/B2.
- Sin reparto entre viajeros ("por persona").
- No se precachea la respuesta de frankfurter (es runtime).
- Sin gráficas; el desglose por categoría es una lista.

## 3. Decisiones (con alternativas descartadas)

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Tipo de cambio | **API (frankfurter.dev) cacheada + override manual** | Solo manual; aproximado de fábrica + override |
| Dónde vive | **Grupo "Gastos" dentro de "Datos"** (con CRUD) | 6ª pestaña "Dinero"; sub-vista en "Ideas" |
| Moneda propia | **EUR fija** | Configurable |
| Dirección de la tasa | **`rate` = ISK por 1 €** (frankfurter devuelve `rates.ISK` con `from=EUR`) | € por ISK |

## 4. Modelo de datos y carga

### `state.gastos` — array de:

```
{
  id: string,
  fecha: 'YYYY-MM-DD',
  concepto: string,
  categoria: string,   // una de CATS
  moneda: 'ISK' | 'EUR',
  importe: string,     // el handler genérico guarda strings; se hace +importe al leer
  notas: string
}
```

`CATS = ['Comida/super', 'Restaurante', 'Combustible', 'Compras', 'Actividad',
'Transporte', 'Alojamiento', 'Otros']`.

### `state.fx` — objeto único:

```
{ rate: number,               // ISK por 1 €
  date: 'YYYY-MM-DD' | null,   // fecha del tipo (de frankfurter o del override)
  source: 'api' | 'manual' | 'default' }
```

`blankFx() = { rate: 150, date: null, source: 'default' }`.

### `blankState()`

Añadir `gastos: []` y `fx: blankFx()`.

### `load()`

Añadir al objeto que se devuelve:
```
gastos: p.gastos || [],
fx: Object.assign(blankFx(), p.fx || {})
```

`save()` no cambia (serializa `state` entero).

## 5. Tipo de cambio

### `refreshFx()`

Se llama **una vez** al arrancar, justo tras `renderAll()` en el `try` de
inicio.

```
function refreshFx() {
  if (!navigator.onLine) return;
  if (state.fx.date === hoyYMD()) return;   // ya está fresco (o lo fijó el usuario hoy)
  fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=ISK')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(j => {
      const isk = j && j.rates && j.rates.ISK;
      if (typeof isk === 'number' && isk > 0) {
        state.fx = { rate: isk, date: j.date || hoyYMD(), source: 'api' };
        save();
        renderDatos();
      }
    })
    .catch(() => {});   // offline / CORS / servidor: se mantiene lo cacheado
}
```

Nota: `state.fx.date === hoyYMD()` cubre el caso de un override manual de hoy —
no se pisa hasta el día siguiente.

### Override manual

En la línea FX del resumen (Sección 6), la tasa es un `<input type="number"
step="0.1" min="0">`. En `change`:
```
const v = +input.value;
if (v > 0) { state.fx = { rate: v, date: hoyYMD(), source: 'manual' }; save(); renderDatos(); }
```

### Conversión

```
const RATE = () => (state.fx.rate > 0 ? state.fx.rate : 150);
const toEUR = (imp, mon) => (mon === 'EUR' ? +imp : +imp / RATE());
const toISK = (imp, mon) => (mon === 'ISK' ? +imp : +imp * RATE());
```

### Formato

```
const fmtEUR = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtISK = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' ISK';
```

## 6. UI del grupo "Gastos"

### Esquema del formulario — `SCHEMAS.gasto`

```js
gasto: {
  sing: 'gasto', icon: '💶',
  fields: [
    { k: 'fecha', l: 'Fecha', t: 'date', req: true },
    { k: 'concepto', l: 'Concepto', t: 'text', req: true, ph: 'Cena en Vík' },
    { k: 'categoria', l: 'Categoría', t: 'select', opts: CATS, def: 'Comida/super' },
    { k: 'moneda', l: 'Moneda', t: 'select', opts: ['ISK', 'EUR'], def: 'ISK' },
    { k: 'importe', l: 'Importe', t: 'number', req: true, min: 0 },
    { k: 'notas', l: 'Notas', t: 'textarea' }
  ]
}
```

El handler genérico de `#sheet-form` construye y valida el objeto igual que para
`comida`/`lugar`.

### Bloque de resumen — `gastoResumen()`

Devuelve un nodo que se antepone al cuerpo del grupo (`bodyWrap.prepend(...)` en
`groupEl`, con un `if (col === 'gastos')`). Contenido:

1. **Totales**: `Total ≈ {fmtEUR(totEUR)} · {fmtISK(totISK)}` donde
   `totEUR = Σ toEUR(+g.importe, g.moneda)`, `totISK = Σ toISK(...)`.
2. **Por categoría**: una línea por categoría con gasto > 0, ordenadas por
   importe descendente: `{categoria} — {fmtEUR(sumaEUR)}`.
3. **Línea FX**: `1 € = <input> ISK · {etiqueta}` donde `<input>` lleva
   `value = state.fx.rate` (a 1 decimal) y `etiqueta` es:
   - `source === 'api'` → `BCE {fmtFecha(state.fx.date)}`
   - `source === 'manual'` → `manual`
   - `source === 'default'` → `aprox.`

### Fila de gasto — `gastoSummary(g)`

Devuelve HTML (como `comidaSummary`):

```
<div class="item__title">${esc(g.concepto || 'Gasto')}</div>
<div class="item__meta">
  ${fmtFecha(g.fecha)} · <span class="chip chip--cat">${esc(g.categoria || 'Otros')}</span>
</div>
<div class="item__meta gasto-amt">
  <b>${g.moneda === 'ISK' ? fmtISK(+g.importe) : fmtEUR(+g.importe)}</b>
  <span class="muted">≈ ${g.moneda === 'ISK' ? fmtEUR(toEUR(+g.importe, 'ISK')) : fmtISK(toISK(+g.importe, 'EUR'))}</span>
</div>
${g.notas ? `<div class="item__meta">${escLines(g.notas)}</div>` : ''}
```

Orden en el grupo: por `fecha` **descendente** (más reciente arriba).
`itemSorter(col)` gana una rama para `gastos` que devuelve
`(a, b) => (b.fecha || '').localeCompare(a.fecha || '')`.

## 7. Integración

- `COL_OF`: `gasto: 'gastos'`. `KIND_OF`: `gastos: 'gasto'`.
- `EDITABLE_COLS`: añadir `'gastos'`.
- `renderDatos()`: añadir `['gastos', 'Gastos', gastoSummary]` al final de la
  lista de grupos.
- `groupEl()`: `if (col === 'gastos') bodyWrap.prepend(gastoResumen());` antes de
  la lista (y volver a pintar el resumen es parte del re-render normal).
- Inicio (`try` de arranque): añadir `refreshFx();` tras `renderAll()`.
- `itemSorter()`: entrada para `gastos` (fecha descendente).
- `style.css`: `.gasto-resumen` (bloque con separador), `.gasto-resumen__tot`
  (total, `--font-display`), `.gasto-cat` (línea por categoría), `.fx-line`
  (atenuada, con `input` estrecho), `.gasto-amt` (fila de importe), `.chip--cat`
  (si `.chip` no basta). Reutiliza tokens.
- `README.md`: en la descripción, "…y un **registro de gastos** en ISK y € con
  el tipo de cambio del día".
- **Release**: `?v=15 → ?v=16` en `index.html` (css+js) y en `SHELL_ASSETS` de
  `sw.js`, a la vez. `sw.js` `SHELL_CACHE` `shell-v15 → shell-v16`.
  `TILE_CACHE` (`tiles-v2`) sin cambios. Sin assets nuevos que precachear
  (frankfurter es runtime, no se precachea); precache sigue en **28**.

## 8. Errores y casos límite

- **`state.fx.rate` corrupto (0, negativo, NaN)** → `RATE()` cae a 150.
- **Primera carga sin conexión y sin `fx` guardado** → `blankFx()`
  (`source: 'default'`); la línea FX muestra "aprox.".
- **`fetch` de frankfurter falla** (offline, CORS, servidor caído) → `catch`
  silencioso; se mantiene la tasa cacheada; sin `toast`, sin error en consola
  visible al usuario.
- **`importe` no numérico** (no debería con `t: 'number'` + `req`) → `+g.importe`
  da `NaN`; `toEUR`/`toISK` lo propagan; los totales usan `n || 0` en `fmtEUR`/
  `fmtISK`, así que suman como 0. La fila mostraría `NaN` — mitigación: `gastoSummary`
  usa `(+g.importe || 0)`.
- **Sin gastos** → la lista muestra "Aún no has añadido nada aquí." (comportamiento
  de `groupEl` para colecciones editables vacías); el resumen muestra
  `Total ≈ 0,00 € · 0 ISK` y ninguna línea de categoría.
- **`frankfurter.dev` cross-origin**: el service worker no intercepta cross-origin
  que no sea tile (pasa a red). frankfurter envía `Access-Control-Allow-Origin: *`.
  (Se usa `api.frankfurter.dev/v1`, el host canónico actual del proyecto; el
  antiguo `api.frankfurter.app` resultó irresoluble desde el entorno de pruebas.
  Misma respuesta: `{ amount, base, date, rates: { ISK } }`.)
- **Cambiar la tasa manual y luego recargar con conexión el mismo día**:
  `state.fx.date === hoyYMD()` → `refreshFx` no la pisa. Al día siguiente sí.
- **Almacenamiento lleno** al guardar → `save()` ya hace `toast('No se pudo
  guardar…')`.
- **DST / husos**: `fecha` es una cadena `YYYY-MM-DD`; `fmtFecha` la formatea
  igual que el resto de la app. La tasa no tiene hora.

## 9. Pruebas y verificación

Sin framework de test → checklist manual, `python -m http.server`:

1. **Grupo "Gastos"** aparece al final de la pantalla Datos, con "+ Añadir
   gasto"; editar y eliminar por fila (como "Dónde comer").
2. **Añadir un gasto en ISK** (p. ej. 3 450 ISK, "Cena en Vík", Restaurante) →
   la fila muestra `3.450 ISK` en negrita y `≈ 23,03 €` atenuado (con la tasa
   por defecto 150); el total del resumen sube.
3. **Añadir un gasto en EUR** → la fila muestra `€` en negrita y `≈ ISK`
   atenuado.
4. **Totales**: con 3-4 gastos mezclados, `Total ≈ X € · Y ISK` cuadra con la
   suma a mano en las dos monedas; el desglose por categoría suma el total.
5. **FX online**: con conexión, borrar `state.fx` en consola
   (`state.fx = { rate: 150, date: null, source: 'default' }; refreshFx()` — o
   recargar), y comprobar que la línea pasa a `BCE {fecha}` con una tasa
   ~140-160 y que los totales se recalculan.
6. **FX manual**: cambiar el `<input>` de la tasa a, p. ej., 145 → los importes
   convertidos y los totales cambian al instante; la línea pasa a `· manual`.
   Recargar con conexión el mismo día → la tasa manual se mantiene.
7. **Offline** (DevTools > Network > Offline, recargar) → el grupo funciona
   (CRUD y conversión con la última tasa); consola sin errores; ninguna petición
   pendiente a frankfurter bloquea nada.
8. **Ciclo `shell-v15 → shell-v16`**: publicar el bump, reabrir → recarga una
   vez; `shell-v16` con 28 entradas; `shell-v15` borrada; `tiles-v2` intacta.
9. **Consola sin errores** en Datos, Itinerario, Mapas, Ideas, Clima.
10. **Persistencia**: recargar (online, misma sesión) → los gastos siguen ahí y
    la tasa cacheada también.
