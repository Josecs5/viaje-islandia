# Dinero · D1 — Registro de gastos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un grupo "Gastos" con CRUD completo dentro de la pantalla "Datos": registrar gastos en ISK o €, verlos convertidos con un tipo de cambio del día (frankfurter.app, cacheado, con override manual), y un resumen con totales en las dos monedas y desglose por categoría.

**Architecture:** Todo en `app.js` (más CSS/README/release). Se añade `state.gastos` (array) y `state.fx` (`{rate, date, source}`) al modelo, un `refreshFx()` que pide el tipo ISK↔€ a frankfurter.app al arrancar con conexión, y helpers de conversión/formato. El grupo "Gastos" reutiliza la maquinaria genérica de "Datos" (`SCHEMAS`, `openSheet`, `groupEl`, el handler de `#sheet-form`, `removeItem`): basta con dar de alta el `kind` `gasto` y marcarlo editable. `gastoResumen()` antepone al cuerpo del grupo el bloque de totales + línea de tipo de cambio editable. Release nuevo del service worker (`shell-v16`).

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. `fetch` a `https://api.frankfurter.app` (tipos del BCE, gratis, sin clave, CORS `*`). `Intl.NumberFormat`. Service worker existente. Verificación manual con DevTools servida por `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-dinero-d1-registro-de-gastos-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva** (solo una petición HTTP). Estilo del repo: IIFE, `'use strict'`, comentarios y copy en español.
- Sin pestaña nueva: el grupo "Gastos" va **al final de la pantalla "Datos"**. Moneda propia fija en **EUR**.
- No se cruza con el itinerario ni con B1/B2. Sin reparto por persona. Sin gráficas. **La respuesta de frankfurter NO se precachea** (es runtime).
- `state.gastos` = array de `{ id, fecha:'YYYY-MM-DD', concepto:string, categoria:string, moneda:'ISK'|'EUR', importe:string, notas:string }` (el handler genérico guarda todos los valores como strings; se hace `+g.importe` al leer).
- `CATS = ['Comida/super', 'Restaurante', 'Combustible', 'Compras', 'Actividad', 'Transporte', 'Alojamiento', 'Otros']`.
- `state.fx = { rate:number /* ISK por 1 € */, date:'YYYY-MM-DD'|null, source:'api'|'manual'|'default' }`. `blankFx() = { rate: 150, date: null, source: 'default' }`.
- `refreshFx()` — una vez al arrancar, tras `renderAll()` en el `try` de inicio. Salta si `!navigator.onLine` o `state.fx.date === hoyYMD()`. `fetch('https://api.frankfurter.app/latest?from=EUR&to=ISK')` → si `j.rates.ISK` es número `> 0`: `state.fx = { rate: j.rates.ISK, date: j.date || hoyYMD(), source: 'api' }`, `save()`, `renderDatos()`. `catch` **silencioso** (sin `toast`, sin `console.error`).
- Override manual: la tasa de la línea FX es un `<input type="number" step="0.1" min="0">`; en `change`, si `+input.value > 0` → `state.fx = { rate: +input.value, date: hoyYMD(), source: 'manual' }`, `save()`, `renderDatos()`.
- `RATE()` = `state.fx.rate > 0 ? state.fx.rate : 150`.
- `toEUR(imp, mon)` = `mon === 'EUR' ? +imp : +imp / RATE()`. `toISK(imp, mon)` = `mon === 'ISK' ? +imp : +imp * RATE()`.
- `fmtEUR(n)` = `new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)`.
- `fmtISK(n)` = `new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' ISK'`.
- Etiqueta de la línea FX: `source === 'api'` → `BCE {fmtFecha(state.fx.date)}`; `'manual'` → `manual`; `'default'` → `aprox.`.
- Orden del grupo `gastos`: `itemSorter` devuelve `(a, b) => (b.fecha || '').localeCompare(a.fecha || '')` (más reciente arriba).
- Release: `?v=15 → ?v=16` en `index.html` (css+js) y en `SHELL_ASSETS` de `sw.js`, a la vez. `sw.js` `SHELL_CACHE` `shell-v15 → shell-v16`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache sigue en **28** entradas.
- Commits: uno por tarea, mensaje en español, sin líneas de atribución. `git push origin main` tras cada commit.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `blankFx` + `gastos`/`fx` en `blankState`/`load`; `refreshFx` + helpers de conversión/formato + llamada en el `try`; `CATS` + `SCHEMAS.gasto`; `COL_OF`/`KIND_OF`/`EDITABLE_COLS`/`itemCard`/`itemSorter` para `gasto`; `gastoSummary` + `gastoResumen` + `groupEl` prepend + entrada en `renderDatos`. |
| `index.html` | Modificar | `?v=15 → ?v=16` en `style.css` y `app.js`. |
| `sw.js` | Modificar | `shell-v15 → shell-v16`; `?v=16` en `SHELL_ASSETS`. |
| `style.css` | Modificar | `.gasto-resumen`, `.gasto-resumen__tot`, `.gasto-cat`, `.fx-line` (+ su `input`), `.gasto-amt`, `.chip--cat`. |
| `README.md` | Modificar | Nota del registro de gastos en la descripción. |

Orden: **1** (modelo + tipo de cambio + release) → **2** (esquema + grupo editable + filas) → **3** (bloque de resumen + CSS + README).

---

### Task 1: Modelo de datos, tipo de cambio y release `shell-v16`

**Files:**
- Modify: `app.js` (`blankState` ~línea 147; `load` ~línea 346; bloque de helpers nuevo; el `try` de inicio ~línea 2524), `index.html` (líneas de `style.css` y `app.js`), `sw.js` (`SHELL_CACHE`, `SHELL_ASSETS`)
- Test: verificación manual por consola de DevTools

**Interfaces:**
- Consumes: `hoyYMD()`, `save()`, `renderDatos()` (existentes).
- Produces (todas en el IIFE de `app.js`):
  - `blankFx()` → `{ rate: 150, date: null, source: 'default' }`.
  - `state.gastos` (array) y `state.fx` (`{rate, date, source}`) presentes tras `load()`.
  - `RATE()` → number. `toEUR(imp, mon)` / `toISK(imp, mon)` → number. `fmtEUR(n)` / `fmtISK(n)` → string.
  - `refreshFx()` → void (async por dentro).
  - `sw.js` sirviendo `SHELL_CACHE = 'shell-v16'`.

- [ ] **Step 1: `blankFx`, `gastos` y `fx` en `blankState`**

En `app.js`, sustituir:
```js
  const blankState = () => ({
    meta: { titulo: 'Viaje a Islandia', fechaInicio: '', fechaFin: '' },
    vuelos: [], coches: [], alojamientos: [], excursiones: [], comidas: [], lugares: [], recomendaciones: []
  });
```
por:
```js
  const blankFx = () => ({ rate: 150, date: null, source: 'default' });

  const blankState = () => ({
    meta: { titulo: 'Viaje a Islandia', fechaInicio: '', fechaFin: '' },
    vuelos: [], coches: [], alojamientos: [], excursiones: [], comidas: [], lugares: [], recomendaciones: [],
    gastos: [], fx: blankFx()
  });
```

- [ ] **Step 2: `gastos` y `fx` en `load()`**

En `app.js`, en `load()`, el objeto que se devuelve:
```js
      return {
        meta: Object.assign(b.meta, p.meta || {}),
        vuelos: (p.vuelos || []).map(migrateVuelo),
        coches: p.coches || [],
        alojamientos: p.alojamientos || [],
        excursiones: p.excursiones || [],
        comidas: p.comidas || [],
        lugares: p.lugares || [],
        recomendaciones: p.recomendaciones || []
      };
```
→ añadir dos entradas al final:
```js
      return {
        meta: Object.assign(b.meta, p.meta || {}),
        vuelos: (p.vuelos || []).map(migrateVuelo),
        coches: p.coches || [],
        alojamientos: p.alojamientos || [],
        excursiones: p.excursiones || [],
        comidas: p.comidas || [],
        lugares: p.lugares || [],
        recomendaciones: p.recomendaciones || [],
        gastos: p.gastos || [],
        fx: Object.assign(blankFx(), p.fx || {})
      };
```

- [ ] **Step 3: Helpers de tipo de cambio y formato**

En `app.js`, justo después de `const blankFx = …` / `blankState` (antes de los `_SEED`), añadir:
```js
  /* ==========================================================
     Dinero · D1 — Tipo de cambio ISK↔€ y formato
     ========================================================== */
  const RATE  = () => (state.fx && state.fx.rate > 0 ? state.fx.rate : 150);
  const toEUR = (imp, mon) => (mon === 'EUR' ? +imp : +imp / RATE());
  const toISK = (imp, mon) => (mon === 'ISK' ? +imp : +imp * RATE());
  const fmtEUR = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const fmtISK = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' ISK';

  // Tipo del día del BCE (frankfurter.app), cacheado en state.fx. Una vez al
  // arrancar; si no hay conexión o ya es de hoy, no hace nada. Fallo silencioso.
  function refreshFx() {
    if (!navigator.onLine) return;
    if (state.fx && state.fx.date === hoyYMD()) return;
    fetch('https://api.frankfurter.app/latest?from=EUR&to=ISK')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => {
        const isk = j && j.rates && j.rates.ISK;
        if (typeof isk === 'number' && isk > 0) {
          state.fx = { rate: isk, date: j.date || hoyYMD(), source: 'api' };
          save();
          renderDatos();
        }
      })
      .catch(() => {});
  }
```
*(Si `hoyYMD` no está definido todavía en ese punto del archivo por orden de declaración: `hoyYMD` es una `const` arrow — comprobar que su declaración precede a este bloque; si no, mover este bloque justo detrás de la de `hoyYMD`. `save`, `renderDatos`, `state` son funciones/`let` del IIFE, accesibles por hoisting/closure en tiempo de ejecución.)*

- [ ] **Step 4: Llamar a `refreshFx()` al arrancar**

En `app.js`, en el `try` de inicio:
```js
  try {
    initGazList();
    renderAll();
    showScreen(location.hash.slice(1) || 'datos');
  } catch (err) {
```
→
```js
  try {
    initGazList();
    renderAll();
    showScreen(location.hash.slice(1) || 'datos');
    refreshFx();
  } catch (err) {
```

- [ ] **Step 5: Subir la versión de release**

- `index.html`: `style.css?v=15` → `?v=16`; `app.js?v=15` → `?v=16`.
- `sw.js`: `const SHELL_CACHE = 'shell-v15';` → `'shell-v16'`; en `SHELL_ASSETS`, `'./style.css?v=15'` → `'./style.css?v=16'` y `'./app.js?v=15'` → `'./app.js?v=16'`.

- [ ] **Step 6: Verificar el modelo y el tipo de cambio**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
En un navegador limpio (DevTools > Application > Service Workers > Unregister; borrar Cache Storage; `localStorage.clear()`), abrir `http://localhost:8000/` y recargar. En DevTools > Console:
```js
// exponer el estado temporalmente NO hace falta: state está en el IIFE, pero
// se puede ver el efecto de refreshFx por el fetch en la pestaña Network.
```
Expected:
- DevTools > Network: hay una petición a `api.frankfurter.app/latest?from=EUR&to=ISK` con **200** y respuesta `{ "amount":1, "base":"EUR", "date":"…", "rates":{ "ISK": <~140-160> } }`.
- DevTools > Application > Local Storage → `islandia_trip_v1` → el JSON contiene `"gastos":[]` y `"fx":{"rate":<~140-160>,"date":"…","source":"api"}`.
- DevTools > Application > Cache Storage: `shell-v16` con **28 entradas** (`./style.css?v=16`, `./app.js?v=16` incluidas). `shell-v15` desaparece. `tiles-v2` intacta.
- Consola sin errores.

- [ ] **Step 7: Verificar el degradado sin conexión**

DevTools > Network > **Offline**. `localStorage.clear()` en consola, recargar.
Expected:
- No hay petición a frankfurter (o falla y se traga sin ruido).
- `islandia_trip_v1` → `"fx":{"rate":150,"date":null,"source":"default"}`.
- Consola sin errores, sin `toast`.

- [ ] **Step 8: Verificar el ciclo de actualización desde `shell-v15`**

Con una pestaña ya controlada por `shell-v15` (si no: `git stash` de `sw.js`+`index.html`, cargar, `git stash pop`), reabrir la app.
Expected: se recarga una vez; tras recargar, `shell-v16` (28 entradas), sin `shell-v15`, `tiles-v2` intacta.

- [ ] **Step 9: Commit y push**

```powershell
git add app.js index.html sw.js
git commit -m "Dinero D1: modelo de gastos, tipo de cambio y release shell-v16" -q
git push origin main
```

---

### Task 2: Esquema `gasto`, grupo editable y filas

**Files:**
- Modify: `app.js` (`SCHEMAS` ~línea 424; `COL_OF`/`KIND_OF` ~línea 381-382; `EDITABLE_COLS` ~línea 921; `itemCard` ~línea 994; `itemSorter` ~línea 1024; `renderDatos` ~línea 909; bloque de `*Summary` ~línea 1130)
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: de la Task 1 — `toEUR`, `toISK`, `fmtEUR`, `fmtISK`. Existentes: `SCHEMAS`, `openSheet(kind, id?)`, el handler `on('#sheet-form','submit',…)`, `groupEl(col, label, summarize)`, `removeItem(kind, id)`, `itemCard(kind, it, html)`, `esc`, `escLines`, `fmtFecha`.
- Produces:
  - `CATS` (array de 8 strings).
  - `SCHEMAS.gasto` = `{ sing:'gasto', icon:'💶', fields:[…] }`.
  - `COL_OF.gasto = 'gastos'`, `KIND_OF.gastos = 'gasto'`, `'gastos'` en `EDITABLE_COLS`.
  - `itemCard` muestra editar/eliminar para `kind === 'gasto'`.
  - `itemSorter('gastos')` → comparador por `fecha` descendente.
  - `gastoSummary(g)` → string HTML.
  - `renderDatos` pinta el grupo `['gastos', 'Gastos', gastoSummary]`.

- [ ] **Step 1: `CATS` y `SCHEMAS.gasto`**

En `app.js`, justo antes de `const SCHEMAS = {`, añadir:
```js
  const CATS = ['Comida/super', 'Restaurante', 'Combustible', 'Compras', 'Actividad', 'Transporte', 'Alojamiento', 'Otros'];
```
Y dentro de `SCHEMAS`, tras la entrada `recomendacion:` (o en cualquier posición del objeto), añadir:
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
    },
```

- [ ] **Step 2: Mapas `COL_OF` / `KIND_OF` y `EDITABLE_COLS`**

En `app.js`:
```js
  const COL_OF  = { vuelo: 'vuelos', coche: 'coches', alojamiento: 'alojamientos', excursion: 'excursiones', comida: 'comidas', lugar: 'lugares', recomendacion: 'recomendaciones' };
  const KIND_OF = { vuelos: 'vuelo', coches: 'coche', alojamientos: 'alojamiento', excursiones: 'excursion', comidas: 'comida', lugares: 'lugar', recomendaciones: 'recomendacion' };
```
→ añadir `gasto`/`gastos` a cada uno:
```js
  const COL_OF  = { vuelo: 'vuelos', coche: 'coches', alojamiento: 'alojamientos', excursion: 'excursiones', comida: 'comidas', lugar: 'lugares', recomendacion: 'recomendaciones', gasto: 'gastos' };
  const KIND_OF = { vuelos: 'vuelo', coches: 'coche', alojamientos: 'alojamiento', excursiones: 'excursion', comidas: 'comida', lugares: 'lugar', recomendaciones: 'recomendacion', gastos: 'gasto' };
```
Y:
```js
  const EDITABLE_COLS = ['comidas', 'lugares', 'recomendaciones'];
```
→
```js
  const EDITABLE_COLS = ['comidas', 'lugares', 'recomendaciones', 'gastos'];
```

- [ ] **Step 3: `itemCard` — editar/eliminar para `gasto`**

En `app.js`, en `itemCard`:
```js
    const canEdit = (kind === 'comida' || kind === 'lugar' || kind === 'recomendacion') && !isSeed(it);
```
→
```js
    const canEdit = (kind === 'comida' || kind === 'lugar' || kind === 'recomendacion' || kind === 'gasto') && !isSeed(it);
```

- [ ] **Step 4: `itemSorter` — rama para `gastos`**

En `app.js`, en `itemSorter`:
```js
  function itemSorter(col) {
    const key = {
```
→ insertar la rama de `gastos` al principio de la función:
```js
  function itemSorter(col) {
    if (col === 'gastos') return (a, b) => (b.fecha || '').localeCompare(a.fecha || '');
    const key = {
```

- [ ] **Step 5: `gastoSummary(g)`**

En `app.js`, junto a `comidaSummary` / `lugarSummary`, añadir:
```js
  function gastoSummary(g) {
    const imp = +g.importe || 0;
    const propia = g.moneda === 'ISK' ? fmtISK(imp) : fmtEUR(imp);
    const otra = g.moneda === 'ISK' ? fmtEUR(toEUR(imp, 'ISK')) : fmtISK(toISK(imp, 'EUR'));
    return `<div class="item__title">${esc(g.concepto || 'Gasto')}</div>
      <div class="item__meta">${g.fecha ? fmtFecha(g.fecha) : '—'} · <span class="chip chip--cat">${esc(g.categoria || 'Otros')}</span></div>
      <div class="item__meta gasto-amt"><b>${propia}</b> <span class="muted">≈ ${otra}</span></div>
      ${g.notas ? `<div class="item__meta">${escLines(g.notas)}</div>` : ''}`;
  }
```

- [ ] **Step 6: `renderDatos` — pintar el grupo "Gastos"**

En `app.js`, en `renderDatos`:
```js
    [
      ['vuelos', 'Vuelos', vueloSummary],
      ['coches', 'Coche de alquiler', cocheSummary],
      ['alojamientos', 'Alojamientos', alojSummary],
      ['excursiones', 'Excursiones', excSummary],
      ['comidas', 'Dónde comer', comidaSummary],
      ['lugares', 'Qué ver', lugarSummary]
    ].forEach(([col, label, sum]) => body.appendChild(groupEl(col, label, sum)));
```
→ añadir la fila de gastos al final del array:
```js
    [
      ['vuelos', 'Vuelos', vueloSummary],
      ['coches', 'Coche de alquiler', cocheSummary],
      ['alojamientos', 'Alojamientos', alojSummary],
      ['excursiones', 'Excursiones', excSummary],
      ['comidas', 'Dónde comer', comidaSummary],
      ['lugares', 'Qué ver', lugarSummary],
      ['gastos', 'Gastos', gastoSummary]
    ].forEach(([col, label, sum]) => body.appendChild(groupEl(col, label, sum)));
```

- [ ] **Step 7: Verificar el grupo y el CRUD**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio (Unregister + clear cachés + `localStorage.clear()`), pestaña **Datos**, bajar hasta el final.
Expected:
1. Aparece un grupo **"💶 Gastos"** con contador `0` y "Aún no has añadido nada aquí." y un botón "+ Añadir gasto".
2. "+ Añadir gasto" abre el bottom-sheet con: Fecha, Concepto, Categoría (8 opciones), Moneda (ISK/EUR), Importe, Notas.
3. Guardar un gasto (p. ej. Fecha 2026-10-12, Concepto "Cena en Vík", Categoría "Restaurante", Moneda ISK, Importe 3450) → aparece una fila:
   `Cena en Vík` / `12 oct · [Restaurante]` / **`3.450 ISK`** `≈ 23,03 €` (tasa por defecto 150). El contador pasa a `1`.
4. Añadir otro en EUR (Importe 15, Moneda EUR) → fila con **`15,00 €`** `≈ 2.250 ISK`.
5. La fila más reciente (por `fecha`) va arriba.
6. El icono ✎ edita (reabre el sheet con los valores) y el 🗑 elimina (con confirmación).
7. Recargar (online) → los gastos persisten.
8. Consola sin errores.

- [ ] **Step 8: Commit y push**

```powershell
git add app.js
git commit -m "Dinero D1: esquema gasto, grupo editable y filas con doble moneda" -q
git push origin main
```

---

### Task 3: Bloque de resumen (totales, categorías, línea FX) + CSS + README

**Files:**
- Modify: `app.js` (`groupEl` ~línea 951; bloque de funciones nuevo antes de `groupEl` o junto a `gastoSummary`), `style.css`, `README.md`
- Test: verificación manual en navegador (checklist del spec §9)

**Interfaces:**
- Consumes: de la Task 1 — `RATE`, `toEUR`, `toISK`, `fmtEUR`, `fmtISK`, `blankFx`, `refreshFx`. De la Task 2 — `CATS`, `state.gastos`. Existentes: `el(tag, cls)`, `esc`, `fmtFecha`, `hoyYMD`, `save`, `renderDatos`, `state.fx`.
- Produces: `gastoResumen()` → nodo DOM. `groupEl` lo antepone al cuerpo cuando `col === 'gastos'`.

- [ ] **Step 1: `gastoResumen()`**

En `app.js`, justo antes de `function groupEl(` (o tras `gastoSummary`), añadir:
```js
  function gastoResumen() {
    const box = el('div', 'gasto-resumen');

    // Totales
    let totEUR = 0, totISK = 0;
    const porCat = {};
    state.gastos.forEach(g => {
      const imp = +g.importe || 0;
      const e = toEUR(imp, g.moneda), i = toISK(imp, g.moneda);
      totEUR += e; totISK += i;
      porCat[g.categoria || 'Otros'] = (porCat[g.categoria || 'Otros'] || 0) + e;
    });

    const tot = el('p', 'gasto-resumen__tot');
    tot.innerHTML = `Total ≈ <b>${fmtEUR(totEUR)}</b> · ${fmtISK(totISK)}`;
    box.appendChild(tot);

    // Por categoría (solo > 0, de mayor a menor)
    Object.keys(porCat)
      .filter(k => porCat[k] > 0.005)
      .sort((a, b) => porCat[b] - porCat[a])
      .forEach(k => {
        const row = el('p', 'gasto-cat');
        row.innerHTML = `<span>${esc(k)}</span><span>${fmtEUR(porCat[k])}</span>`;
        box.appendChild(row);
      });

    // Línea de tipo de cambio
    const fx = state.fx || blankFx();
    const etiqueta = fx.source === 'api' ? 'BCE ' + fmtFecha(fx.date)
      : fx.source === 'manual' ? 'manual' : 'aprox.';
    const line = el('p', 'fx-line');
    line.innerHTML = `1 € = <input type="number" step="0.1" min="0" class="fx-line__rate" value="${(+fx.rate || 150).toFixed(1)}"> ISK <span class="muted">· ${esc(etiqueta)}</span>`;
    line.querySelector('.fx-line__rate').addEventListener('change', ev => {
      const v = +ev.target.value;
      if (v > 0) {
        state.fx = { rate: v, date: hoyYMD(), source: 'manual' };
        save();
        renderDatos();
      }
    });
    box.appendChild(line);

    return box;
  }
```

- [ ] **Step 2: Antepon el resumen en `groupEl`**

En `app.js`, en `groupEl`, tras crear `bodyWrap` y antes de `const list = el('div', 'list');`:
```js
    const bodyWrap = el('div', 'group__body');
    bodyWrap.hidden = !isOpen;

    const editable = EDITABLE_COLS.includes(col);
```
→
```js
    const bodyWrap = el('div', 'group__body');
    bodyWrap.hidden = !isOpen;

    if (col === 'gastos') bodyWrap.appendChild(gastoResumen());

    const editable = EDITABLE_COLS.includes(col);
```

- [ ] **Step 3: Estilos**

En `style.css`, junto a las reglas de `.group` / `.item`, añadir:
```css
.gasto-resumen {
  padding: var(--space-12) var(--space-12) var(--space-16);
  border-bottom: 1px solid var(--c-border-soft);
  margin-bottom: var(--space-8);
}
.gasto-resumen__tot {
  font-family: var(--font-display);
  font-size: var(--step-1);
  margin: 0 0 var(--space-8);
}
.gasto-cat {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  font-size: var(--step--1);
  color: var(--c-text-2);
  margin: 2px 0;
}
.fx-line {
  margin: var(--space-12) 0 0;
  font-size: var(--step--1);
  color: var(--c-text-2);
}
.fx-line__rate {
  width: 5.5em;
  font: inherit;
  color: var(--c-text-1);
  background: var(--c-surface, var(--c-bg-1));
  border: 1px solid var(--c-border);
  border-radius: var(--radius-s, 6px);
  padding: 2px 6px;
}
.gasto-amt { display: flex; gap: var(--space-8); align-items: baseline; }
.chip--cat {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--c-border-soft);
  font-size: var(--step--1);
}
```
*(Si algún token — `--c-surface`, `--radius-s` — no existe, usar el fallback ya escrito o el que use el resto de `style.css` para inputs; comprobar con `Select-String -Path style.css -Pattern "--c-surface|--radius-s|input.*border"`.)*

- [ ] **Step 4: README**

En `README.md`, en el párrafo de descripción (donde enumera lo que gestiona la app), añadir "…y un **registro de gastos** en ISK y € con el tipo de cambio del día." (o una frase equivalente integrada en la lista existente).

- [ ] **Step 5: Verificar el resumen (checklist del spec §9)**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio, **Datos** → grupo "Gastos":

1. Con 3-4 gastos mezclados (ISK y EUR, varias categorías), la cabecera del cuerpo muestra:
   `Total ≈ X,XX € · Y ISK`, una línea por categoría con gasto (`Restaurante — 12,34 €`) ordenadas de mayor a menor, y `1 € = [150,0] ISK · …`.
2. Sumar a mano los importes convertidos → cuadra con `Total` en las dos monedas. La suma de las líneas de categoría = total en €.
3. **FX online**: con conexión, en consola `state.fx = { rate: 150, date: null, source: 'default' }; refreshFx();` (o recargar) → la línea pasa a `· BCE {fecha}` con tasa ~140-160 y los totales/filas se recalculan.
4. **FX manual**: cambiar el `<input>` a `145` y salir del campo → todas las conversiones y los totales cambian; la línea pasa a `· manual`. Recargar con conexión el mismo día → sigue `145` (no la pisa `refreshFx`).
5. **Offline** (Network > Offline, recargar): el grupo funciona con la última tasa; sin errores; nada bloqueado esperando a frankfurter.
6. **Sin gastos**: `Total ≈ 0,00 € · 0 ISK`, sin líneas de categoría.
7. Recorrer Datos, Itinerario, Mapas, Ideas, Clima → consola sin errores.
8. `shell-v16` con 28 entradas; `tiles-v2` intacta.

- [ ] **Step 6: Commit y push**

```powershell
git add app.js style.css README.md
git commit -m "Dinero D1: resumen de gastos (totales, categorias, tipo de cambio editable)" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2 objetivo: grupo "Gastos" con CRUD en Datos | Task 2 (`SCHEMAS.gasto`, `EDITABLE_COLS`, `itemCard`, `renderDatos`) |
| §2 objetivo: resumen (total €/ISK, por categoría, línea FX editable) | Task 3 (`gastoResumen`) |
| §2 objetivo: tipo de cambio de frankfurter cacheado + manual | Task 1 (`refreshFx`, `state.fx`) + Task 3 (input manual) |
| §2 no-objetivos (sin pestaña, EUR fija, sin librería, no cruza itinerario/B1, sin por-persona, sin gráficas, no precachear frankfurter) | Respetado en Tasks 1-3; el grupo va en Datos; `fetch` directo; `renderDatos` solo lista categorías |
| §3 decisiones (API cacheada+manual; grupo en Datos; EUR; `rate` = ISK por €) | Global Constraints + Task 1 |
| §4 `state.gastos` shape + `CATS` | Task 1 Step 1-2 (colección) + Task 2 Step 1 (`CATS`, `SCHEMAS`) |
| §4 `state.fx` shape + `blankFx` | Task 1 Step 1-2 |
| §4 `blankState`/`load` | Task 1 Steps 1-2 |
| §5 `refreshFx` (guardas, fetch, éxito, catch silencioso) | Task 1 Step 3 |
| §5 override manual (input, change → source manual) | Task 3 Step 1 |
| §5 `RATE`/`toEUR`/`toISK`/`fmtEUR`/`fmtISK` | Task 1 Step 3 (valores = spec verbatim) |
| §6 `SCHEMAS.gasto` fields | Task 2 Step 1 |
| §6 `gastoResumen` (totales, por categoría desc, línea FX + etiqueta por source) | Task 3 Step 1 |
| §6 `gastoSummary` (título, meta con fecha+chip, importe doble, notas) | Task 2 Step 5 |
| §6 orden por fecha descendente | Task 2 Step 4 (`itemSorter` rama `gastos`) |
| §7 integración (COL_OF/KIND_OF/EDITABLE_COLS/renderDatos/groupEl prepend/itemSorter/refreshFx en init/CSS/README/release) | Tasks 1, 2, 3 |
| §7 release `?v=16` + `shell-v16` + precache 28 | Task 1 Steps 5-6-8 |
| §8 errores (rate corrupto → 150; primera carga offline → default; fetch falla → catch; importe no numérico → 0; sin gastos → 0; CORS ok; manual no pisado el mismo día; storage lleno → toast existente; DST) | Task 1 Step 3 (`RATE`, catch) + Task 2 Step 5 (`+g.importe || 0`) + Task 3 Step 1 (`porCat` filtro, `blankFx` fallback) + verificaciones Task 1 Step 7, Task 3 Steps 3-6 |
| §9 pruebas 1-10 | Task 1 Steps 6-8, Task 2 Step 7, Task 3 Step 5 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". Cada paso de código lleva el código real. Las verificaciones llevan `Run:` y `Expected:` con valores concretos (importes, recuentos de caché, forma del JSON de `localStorage`, rangos de tasa). Dos notas condicionales (Task 1 Step 3 sobre el orden de `hoyYMD`; Task 3 Step 3 sobre tokens CSS que puedan faltar) dan la acción concreta (`Select-String` / mover el bloque), no dejan nada abierto.

**3. Consistencia de tipos y nombres**

- `blankFx()` → `{ rate: 150, date: null, source: 'default' }` — Task 1 Step 1; usado en `load` (Step 2), `gastoResumen` (Task 3 Step 1 fallback).
- `state.fx` = `{ rate, date, source }` — mismo shape en Task 1 (`refreshFx`) y Task 3 (`gastoResumen`, input handler).
- `RATE`, `toEUR`, `toISK`, `fmtEUR`, `fmtISK` — definidos en Task 1 Step 3; usados en `gastoSummary` (Task 2 Step 5) y `gastoResumen` (Task 3 Step 1). Firmas idénticas.
- `refreshFx` — Task 1 Step 3; llamado en el `try` (Task 1 Step 4).
- `CATS` — Task 2 Step 1; usado en `SCHEMAS.gasto.opts` (Task 2 Step 1). (No se vuelve a usar en `gastoResumen`; las categorías del resumen salen de `state.gastos`.)
- `SCHEMAS.gasto` con `sing: 'gasto'`, `icon: '💶'` — Task 2 Step 1; `groupEl` lee `SCHEMAS[KIND_OF['gastos']].icon` = `SCHEMAS.gasto.icon` para la cabecera del grupo, y `SCHEMAS.gasto.sing` para el botón "+ Añadir gasto". `KIND_OF.gastos = 'gasto'` (Task 2 Step 2) lo hace resolver.
- `COL_OF.gasto = 'gastos'` — el handler de `#sheet-form` y `removeItem` usan `state[COL_OF[kind]]` → `state.gastos`. `state.gastos` existe desde Task 1.
- `gastoSummary` / `gastoResumen` — Task 2 Step 5 / Task 3 Step 1; `renderDatos` referencia `gastoSummary` (Task 2 Step 6); `groupEl` referencia `gastoResumen` (Task 3 Step 2). Ambas definidas antes de su uso en el orden del archivo (funciones `function`, hoisted dentro del IIFE).
- `itemSorter('gastos')` — Task 2 Step 4; `groupEl` llama `items.slice().sort(itemSorter(col))` con `col === 'gastos'`.
- `itemCard` `canEdit` incluye `kind === 'gasto'` (Task 2 Step 3); `groupEl` llama `itemCard(kind, it, summarize(it))` con `kind = KIND_OF['gastos'] = 'gasto'`.
- `shell-v16` / `?v=16` — Task 1 Step 5; verificado Steps 6-8. Precache: 28 = 27 previas (offline + SunCalc) intactas + `style.css?v=16` y `app.js?v=16` que sustituyen a las `?v=15` (no suman). Sin assets nuevos.
- Clases CSS: `.gasto-resumen` / `.gasto-resumen__tot` / `.gasto-cat` / `.fx-line` / `.fx-line__rate` / `.gasto-amt` / `.chip--cat` — Task 3 Step 3 las define; Task 2 Step 5 (`gasto-amt`, `chip--cat`) y Task 3 Step 1 (las demás) las usan. `chip` base ya existe en el repo.

Sin inconsistencias.
