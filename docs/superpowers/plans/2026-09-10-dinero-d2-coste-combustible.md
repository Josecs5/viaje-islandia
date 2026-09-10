# Dinero · D2 — Estimador de coste de combustible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estimar litros y coste (ISK y ≈ €) de combustible por día del itinerario y para el viaje entero, a partir de los km que `dayPlan` ya calcula, con consumo y precio/litro ajustables; con un botón para registrar el gasto estimado (D1).

**Architecture:** Todo en `app.js` + CSS/README/release. Nuevo `state.combustible = {consumo, precioL, tipo}` (L/100 km, ISK/litro, etiqueta). Helpers `fuelEst(km)` y `dayKm(plan)` junto a los de D1. `dayBlock` gana una línea `.day-fuel`; `renderItinerario` antepone un bloque `.itin-fuel` con el total, un `<details>` para ajustar los 3 valores y un botón "Añadir como gasto". `openSheet` gana un 3er parámetro opcional `preset` para precargar un alta. Release `shell-v17`.

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. Reutiliza `toEUR`/`fmtEUR`/`fmtISK` de D1 y `dayPlan`/`buildItinerary` de B1. Verificación manual con DevTools servida por `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-dinero-d2-coste-combustible-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva**. Estilo del repo: IIFE, `'use strict'`, comentarios y copy en español.
- `state.combustible = { consumo:<L/100km>, precioL:<ISK por litro>, tipo:'Gasolina'|'Diésel' }`. `blankFuel() = { consumo: 7, precioL: 309, tipo: 'Diésel' }`.
- `blankState()` += `combustible: blankFuel()`. `load()` += `combustible: Object.assign(blankFuel(), p.combustible || {})`. `seedState()` lo hereda sin tocar nada.
- Getters con defensa: `litros100() = (+state.combustible.consumo > 0 ? +state.combustible.consumo : 7)`; `precioLitro() = (+state.combustible.precioL > 0 ? +state.combustible.precioL : 309)`.
- `fuelEst(km)` → `{ litros:(+km||0)*litros100()/100, isk: litros*precioLitro(), eur: toEUR(isk,'ISK') }`.
- `dayKm(plan)` → `plan.legs.reduce((s,l)=>s+(+l.km||0),0)`.
- `tipo` **no** afecta al cálculo (solo etiqueta). El precio siempre es por litro.
- Línea `.day-fuel` en `dayBlock` **solo si `dayKm(plan) >= 1`**, y **fuera** del `if (plan.veredicto)` (se muestra aunque el día no tenga veredicto).
- Bloque `.itin-fuel` en `renderItinerario` **solo si** hay fechas (ya garantizado por el `return` previo) y `totalISK > 0`; va **antes** de `.chips--itin` en `#itin-body`.
- Al cambiar cualquier campo de ajuste: si el valor es válido (`> 0` para números; cualquiera para el select) → `state.combustible = { ...blankFuel(), ...state.combustible, [k]: v }; save(); renderItinerario();`. Si un número es inválido (vacío / `<= 0`) → restaurar el valor mostrado, no guardar.
- Botón "Añadir como gasto" → `openSheet('gasto', null, { fecha: hoyYMD(), concepto: 'Combustible (estimado)', categoria: 'Combustible', moneda: 'ISK', importe: String(Math.round(totalISK)) })`.
- `openSheet(kind, id, preset)`: 3er parámetro opcional; en el bucle de campos `fieldRow(f, data ? data[f.k] : (preset ? preset[f.k] : null))`. `editing = { kind, id: id || null }` sin cambios. Retrocompatible (ningún llamador pasa 3 args hoy).
- Release: `?v=16 → ?v=17` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`, a la vez. `sw.js` `SHELL_CACHE` `shell-v16 → shell-v17`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache sigue en **28** entradas.
- Commits: uno por tarea, mensaje en español, sin líneas de atribución. `git push origin main` tras cada commit.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `blankFuel` + `combustible` en `blankState`/`load`; getters + `fuelEst` + `dayKm`; `openSheet` 3er parámetro `preset`; línea `.day-fuel` en `dayBlock`; bloque `.itin-fuel` en `renderItinerario`. |
| `index.html` | Modificar | `?v=16 → ?v=17` en `style.css` y `app.js`. |
| `sw.js` | Modificar | `shell-v16 → shell-v17`; `?v=17` en `SHELL_ASSETS`. |
| `style.css` | Modificar | `.itin-fuel`, `.itin-fuel__tot`, `.itin-fuel__cfg` (+ `summary`, `.field`, `input`, `select`), `.day-fuel`. |
| `README.md` | Modificar | Una frase sobre la estimación de combustible. |

Orden: **1** (modelo + helpers + `preset` + release) → **2** (línea por día + bloque de cabecera + CSS + README).

---

### Task 1: Modelo `combustible`, helpers de estimación, `preset` en `openSheet` y release `shell-v17`

**Files:**
- Modify: `app.js` (`blankFx`/`blankState` ~línea 147-153; `load` ~línea 383-394; bloque de helpers de D1 ~línea 155-180; `openSheet` ~línea 847-859), `index.html` (líneas css/js), `sw.js` (`SHELL_CACHE`, `SHELL_ASSETS`)
- Test: verificación manual por consola de DevTools

**Interfaces:**
- Consumes: `toEUR` (D1), `state`, `hoyYMD`.
- Produces:
  - `blankFuel()` → `{ consumo: 7, precioL: 309, tipo: 'Diésel' }`.
  - `state.combustible` presente tras `load()`.
  - `litros100()` / `precioLitro()` → number `> 0`.
  - `fuelEst(km)` → `{ litros:number, isk:number, eur:number }`.
  - `dayKm(plan)` → number.
  - `openSheet(kind, id, preset?)` — con `preset` opcional que precarga los valores iniciales de un alta.

- [ ] **Step 1: `blankFuel` y `combustible` en `blankState`**

En `app.js`, tras `const blankFx = …` y antes de `const blankState = …`:
```js
  const blankFuel = () => ({ consumo: 7, precioL: 309, tipo: 'Diésel' });
```
Y en `blankState`:
```js
  const blankState = () => ({
    meta: { titulo: 'Viaje a Islandia', fechaInicio: '', fechaFin: '' },
    vuelos: [], coches: [], alojamientos: [], excursiones: [], comidas: [], lugares: [], recomendaciones: [],
    gastos: [], fx: blankFx()
  });
```
→ añadir `combustible`:
```js
  const blankState = () => ({
    meta: { titulo: 'Viaje a Islandia', fechaInicio: '', fechaFin: '' },
    vuelos: [], coches: [], alojamientos: [], excursiones: [], comidas: [], lugares: [], recomendaciones: [],
    gastos: [], fx: blankFx(), combustible: blankFuel()
  });
```

- [ ] **Step 2: `combustible` en `load()`**

En `app.js`, en `load()`, el objeto que se devuelve termina en:
```js
        gastos: p.gastos || [],
        fx: Object.assign(blankFx(), p.fx || {})
      };
```
→
```js
        gastos: p.gastos || [],
        fx: Object.assign(blankFx(), p.fx || {}),
        combustible: Object.assign(blankFuel(), p.combustible || {})
      };
```

- [ ] **Step 3: getters + `fuelEst` + `dayKm`**

En `app.js`, justo después del bloque `refreshFx` de D1 (tras su `}` de cierre, antes del comentario `// Vuelo de ida real …`):
```js
  /* ==========================================================
     Dinero · D2 — Estimación de combustible por ruta
     ========================================================== */
  const FUEL = () => state.combustible || blankFuel();
  const litros100  = () => { const c = +FUEL().consumo; return c > 0 ? c : 7; };
  const precioLitro = () => { const p = +FUEL().precioL; return p > 0 ? p : 309; };

  // km recorridos -> { litros, isk, eur }. Estimación: consumo medio × precio/L.
  function fuelEst(km) {
    const litros = (+km || 0) * litros100() / 100;
    const isk = litros * precioLitro();
    return { litros, isk, eur: toEUR(isk, 'ISK') };
  }
  // suma de km de los tramos de un día ya planificado por dayPlan()
  const dayKm = plan => plan.legs.reduce((s, l) => s + (+l.km || 0), 0);
```
*(`toEUR` es de D1 y está definida más arriba en el mismo IIFE; `blankFuel` también. `state` se resuelve en tiempo de ejecución, igual que en `refreshFx`.)*

- [ ] **Step 4: `preset` en `openSheet`**

En `app.js`, `openSheet`:
```js
  function openSheet(kind, id) {
    if (kind === 'vuelo') return openFlightSheet(id);
    const sch = SCHEMAS[kind];
    const col = state[COL_OF[kind]];
    const data = id ? col.find(x => x.id === id) : null;
    editing = { kind, id: id || null };

    $('#sheet-title').textContent = (id ? 'Editar ' : 'Añadir ') + sch.sing;
    const form = $('#sheet-form');
    form.innerHTML = '';
    sch.fields.forEach(f => {
      form.appendChild(fieldRow(f, data ? data[f.k] : null));
    });
```
→
```js
  function openSheet(kind, id, preset) {
    if (kind === 'vuelo') return openFlightSheet(id);
    const sch = SCHEMAS[kind];
    const col = state[COL_OF[kind]];
    const data = id ? col.find(x => x.id === id) : null;
    editing = { kind, id: id || null };

    $('#sheet-title').textContent = (id ? 'Editar ' : 'Añadir ') + sch.sing;
    const form = $('#sheet-form');
    form.innerHTML = '';
    sch.fields.forEach(f => {
      form.appendChild(fieldRow(f, data ? data[f.k] : (preset ? preset[f.k] : null)));
    });
```
*(El resto de `openSheet` no cambia. `fieldRow(f, val)` ya trata `val == null` → usa `f.def`; un `preset[f.k]` string se pone tal cual.)*

- [ ] **Step 5: Subir la versión de release**

- `index.html`: `style.css?v=16` → `?v=17`; `app.js?v=16` → `?v=17`.
- `sw.js`: `const SHELL_CACHE = 'shell-v16';` → `'shell-v17'`; en `SHELL_ASSETS`, `'./style.css?v=16'` → `'./style.css?v=17'` y `'./app.js?v=16'` → `'./app.js?v=17'`.

- [ ] **Step 6: Verificar modelo, helpers y `preset`**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
Navegador limpio (Unregister SW + borrar Cache Storage + `localStorage.clear()`), abrir `http://localhost:8000/`. En consola:
```js
JSON.parse(localStorage.getItem('islandia_trip_v1')).combustible
```
Expected: `{ consumo: 7, precioL: 309, tipo: "Diésel" }` (tras el primer `save()`; si aún no se ha guardado, forzar un cambio o recargar).
- `caches.keys()` → `["shell-v17"]`, y `(await (await caches.open('shell-v17')).keys()).length` → **28**.
- `document.querySelector('script[src*="app.js"]').src` termina en `app.js?v=17`.
- Consola sin errores.

- [ ] **Step 7: Verificar migración desde datos sin `combustible`**

En consola:
```js
const s = JSON.parse(localStorage.getItem('islandia_trip_v1')); delete s.combustible;
localStorage.setItem('islandia_trip_v1', JSON.stringify(s)); location.reload();
```
Tras recargar: `JSON.parse(localStorage.getItem('islandia_trip_v1')).combustible` → `{ consumo: 7, precioL: 309, tipo: "Diésel" }` (rellenado por `load()` en el próximo `save()`), y ningún error en consola.

- [ ] **Step 8: Commit y push**

```powershell
git add app.js index.html sw.js
git commit -m "Dinero D2: modelo de combustible, helpers de estimacion, preset en openSheet y release shell-v17" -q
git push origin main
```

---

### Task 2: Línea de combustible por día, bloque de cabecera del itinerario, CSS y README

**Files:**
- Modify: `app.js` (`dayBlock` ~línea 1587-1616; `renderItinerario` ~línea 1554-1585), `style.css`, `README.md`
- Test: verificación manual en navegador (checklist del spec §11)

**Interfaces:**
- Consumes: de la Task 1 — `fuelEst`, `dayKm`, `litros100`, `precioLitro`, `FUEL`, `blankFuel`, `openSheet(…, preset)`. Existentes: `dayPlan` (B1), `buildItinerary`, `el`, `esc`, `fmtISK`/`fmtEUR` (D1), `hoyYMD`, `save`, `renderItinerario`.
- Produces: `.day-fuel` en cada `dayBlock` con km; `.itin-fuel` (total + ajustes + botón) al principio de `#itin-body`.

- [ ] **Step 1: Línea `.day-fuel` en `dayBlock`**

En `app.js`, en `dayBlock`, el bloque actual termina así:
```js
    if (plan.veredicto) {
      const label = verdictLabel(plan);
      const bits = [];
      ...
      const p = el('p', 'day-plan');
      p.innerHTML = verdict + (bits.length ? ' ' + bits.join(' · ') : '');
      wrap.appendChild(p);
    }

    const fotos = fotosDelDia(day);
```
→ insertar el cálculo de combustible **entre** el cierre del `if (plan.veredicto)` y `const fotos = …`:
```js
    if (plan.veredicto) {
      ...
      wrap.appendChild(p);
    }

    const km = dayKm(plan);
    if (km >= 1) {
      const fe = fuelEst(km);
      const pf = el('p', 'day-fuel');
      pf.innerHTML = `⛽ ~<span>${fe.litros.toLocaleString('es-ES', { maximumFractionDigits: 0 })} L</span> · ${fmtISK(fe.isk)} <span class="muted">· ≈ ${fmtEUR(fe.eur)}</span>`;
      wrap.appendChild(pf);
    }

    const fotos = fotosDelDia(day);
```

- [ ] **Step 2: Bloque `.itin-fuel` en `renderItinerario`**

En `app.js`, en `renderItinerario`, justo antes de:
```js
    const chips = el('div', 'chips chips--itin');
    chips.appendChild(itinChip('all', 'Todos'));
```
insertar:
```js
    body.appendChild(itinFuelBlock(it));

    const chips = el('div', 'chips chips--itin');
```
Y añadir la función `itinFuelBlock` (por ejemplo justo después de `renderItinerario`):
```js
  function itinFuelBlock(it) {
    const totalISK = it.days.reduce((s, d) => s + fuelEst(dayKm(dayPlan(d))).isk, 0);
    const box = el('section', 'itin-fuel');
    if (!(totalISK > 0)) { box.hidden = true; return box; }

    const totalEUR = toEUR(totalISK, 'ISK');
    const tot = el('p', 'itin-fuel__tot');
    tot.innerHTML = `<span>Combustible del viaje ≈ <b>${fmtISK(totalISK)}</b> · ${fmtEUR(totalEUR)}</span>`;
    const add = el('button', 'btn btn--ghost btn--sm');
    add.type = 'button';
    add.textContent = 'Añadir como gasto';
    add.addEventListener('click', () => openSheet('gasto', null, {
      fecha: hoyYMD(),
      concepto: 'Combustible (estimado)',
      categoria: 'Combustible',
      moneda: 'ISK',
      importe: String(Math.round(totalISK))
    }));
    tot.appendChild(add);
    box.appendChild(tot);

    const f = FUEL();
    const cfg = el('details', 'itin-fuel__cfg');
    const sum = el('summary');
    sum.textContent = `⛽ ${litros100()} L/100 km · ${precioLitro()} ISK/L · ${f.tipo || 'Diésel'}`;
    cfg.appendChild(sum);

    const mkNum = (k, label, unit, step) => {
      const wrap = el('label', 'field');
      wrap.innerHTML = `<span>${label}</span>`;
      const inp = el('input');
      inp.type = 'number'; inp.step = step; inp.min = '0';
      inp.inputMode = step === '1' ? 'numeric' : 'decimal';
      inp.value = String(k === 'consumo' ? litros100() : precioLitro());
      const shown = inp.value;
      inp.addEventListener('change', () => {
        const v = +inp.value;
        if (v > 0) { state.combustible = Object.assign(blankFuel(), state.combustible, { [k]: v }); save(); renderItinerario(); }
        else { inp.value = shown; }
      });
      wrap.appendChild(inp);
      if (unit) { const u = el('span', 'muted'); u.textContent = unit; wrap.appendChild(u); }
      return wrap;
    };
    cfg.appendChild(mkNum('consumo', 'Consumo', 'L/100 km', '0.1'));
    cfg.appendChild(mkNum('precioL', 'Precio', 'ISK/L', '1'));

    const tw = el('label', 'field');
    tw.innerHTML = `<span>Tipo</span>`;
    const sel = el('select');
    ['Gasolina', 'Diésel'].forEach(op => { const o = el('option'); o.value = op; o.textContent = op; sel.appendChild(o); });
    sel.value = f.tipo === 'Gasolina' ? 'Gasolina' : 'Diésel';
    sel.addEventListener('change', () => { state.combustible = Object.assign(blankFuel(), state.combustible, { tipo: sel.value }); save(); renderItinerario(); });
    tw.appendChild(sel);
    cfg.appendChild(tw);

    box.appendChild(cfg);
    return box;
  }
```
*(`box.hidden = true` cuando no hay km: se añade igualmente pero no se ve — `[hidden]` está cubierto por el reset global. Alternativa equivalente: no llamar a `appendChild` si `totalISK` no es `> 0`; se elige devolver siempre un nodo para que `renderItinerario` no tenga que comprobar `null`.)*

- [ ] **Step 3: Estilos**

En `style.css`, junto a las reglas de `.day` / itinerario, añadir:
```css
.itin-fuel {
  background: var(--c-surface);
  border: 1px solid var(--c-border-soft);
  border-radius: var(--radius-m);
  padding: var(--space-12);
  margin-bottom: var(--space-16);
}
.itin-fuel[hidden] { display: none; }
.itin-fuel__tot {
  font-family: var(--font-display);
  font-size: var(--step-1);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-12);
  flex-wrap: wrap;
  margin: 0;
}
.itin-fuel__cfg {
  margin-top: var(--space-8);
  font-size: var(--step--1);
  color: var(--c-text-2);
}
.itin-fuel__cfg summary { cursor: pointer; }
.itin-fuel__cfg .field {
  display: flex;
  gap: var(--space-8);
  align-items: baseline;
  margin-top: var(--space-8);
}
.itin-fuel__cfg .field input {
  width: 5.5em;
  font: inherit;
  color: var(--c-text-1);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-s);
  padding: 2px 6px;
}
.itin-fuel__cfg .field select {
  width: auto;
  font: inherit;
  color: var(--c-text-1);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-s);
  padding: 2px 6px;
}
.day-fuel {
  font-size: var(--step--1);
  color: var(--c-text-2);
  margin: var(--space-4) 0 0;
}
```

- [ ] **Step 4: README**

En `README.md`, en el párrafo de descripción, añadir una frase, p. ej. tras la del itinerario: "Estima también el **coste de combustible** de cada día y del viaje (consumo y precio del litro ajustables) y permite anotarlo como gasto."

- [ ] **Step 5: Verificar (checklist del spec §11)**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
python -m http.server 8000
```
Navegador limpio, pantalla **Itinerario**, vista "Todos":
1. Al principio aparece "Combustible del viaje ≈ … ISK · … €" y el `<details>` "⛽ 7 L/100 km · 309 ISK/L · Diésel".
2. Cada día con trayectos muestra `⛽ ~N L · … ISK · ≈ … €` bajo la línea de B1; los días de solo-vuelo o sin coordenadas, no.
3. La suma de los ISK de las líneas diarias ≈ el total de la cabecera (± redondeo).
4. Abrir el `<details>`, cambiar Consumo a `10` → todas las cifras suben ~43 %; ponerlo a `0` o vacío → vuelve a `7` y no se guarda.
5. Cambiar Precio a `350` → suben ISK y € (usa la tasa de D1).
6. Cambiar Tipo a `Gasolina` → solo cambia el texto del `<summary>`.
7. "Añadir como gasto" → abre el sheet de gasto con Fecha=hoy, Concepto="Combustible (estimado)", Categoría=Combustible, Moneda=ISK, Importe=total redondeado. Guardar → aparece en "Gastos" y en su resumen (D1).
8. Ir a "Datos" y usar "+ Añadir gasto"/"Añadir comida" normal → el sheet sigue funcionando sin preset.
9. Recargar → `state.combustible` persiste con lo ajustado.
10. `caches.keys()` → `["shell-v17"]` con 28 entradas; `shell-v16` no está; `tiles-v2` intacta. Consola limpia en las 5 pantallas.

- [ ] **Step 6: Commit y push**

```powershell
git add app.js style.css README.md
git commit -m "Dinero D2: linea de combustible por dia y total del viaje en el itinerario" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §2 objetivo: litros + coste por día y total | Task 2 Steps 1-2 |
| §2 objetivo: consumo/precio ajustables | Task 2 Step 2 (`<details>` con 3 campos) |
| §2 objetivo: registrar como gasto | Task 2 Step 2 (botón → `openSheet('gasto', null, preset)`) + Task 1 Step 4 (`preset`) |
| §3 no-objetivos (sin API de precios, sin gasolineras, sin por-tramo en UI, no tocar dayPlan, sin por-persona) | Respetado: precio manual; solo día + total; `dayPlan` solo se lee |
| §4 decisiones (km de `legs`; `state.combustible`; defaults 7/309/Diésel; `tipo` solo etiqueta; editar en Itinerario; ISK + ≈€) | Global Constraints + Tasks 1-2 |
| §5 modelo (`blankFuel`, `blankState`, `load`, `seedState`) | Task 1 Steps 1-2 |
| §6 cálculo (`FUEL`, `litros100`, `precioLitro`, `fuelEst`, `dayKm`) | Task 1 Step 3 (código verbatim del spec) |
| §7.1 línea por día (solo `dayKm >= 1`, fuera del `if veredicto`) | Task 2 Step 1 |
| §7.2 bloque cabecera (total, botón, `<details>` con 3 campos, restauración de inválidos) | Task 2 Step 2 |
| §7.3 `openSheet(kind, id, preset)` | Task 1 Step 4 |
| §8 estilos | Task 2 Step 3 |
| §9 integración + release `?v=17` / `shell-v17` / precache 28 | Task 1 Step 5, Task 2 Steps 1-2 |
| §10 casos borde (sin km, valores 0, sin fechas, tasa €, `legs` vacío, preset editable, `dayPlan` doble) | Getters con default; `if (km >= 1)`; `box.hidden`; `renderItinerario` sale antes sin fechas; Task 2 Step 5 pruebas |
| §11 pruebas 1-8 | Task 1 Steps 6-7, Task 2 Step 5 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". Cada paso de código lleva el código real (incluida `itinFuelBlock` completa). Verificaciones con `Run:` y `Expected:` concretos (forma de `state.combustible`, recuento de caché, cambios porcentuales de las cifras). Dos notas entre paréntesis aclaran decisiones (`box.hidden` vs no-append; `toEUR`/`blankFuel` en scope) — no dejan nada abierto.

**3. Consistencia de tipos y nombres**

- `blankFuel()` → `{ consumo: 7, precioL: 309, tipo: 'Diésel' }` — Task 1 Step 1; usado en `load` (Step 2), getters (Step 3), `itinFuelBlock` `Object.assign(blankFuel(), state.combustible, {…})` (Task 2 Step 2).
- `state.combustible` — creado en Task 1; leído por `FUEL()` (Task 1 Step 3) y escrito por los `change` de `itinFuelBlock` (Task 2 Step 2), siempre objeto completo de 3 claves vía `Object.assign(blankFuel(), state.combustible, {[k]:v})`.
- `litros100()` / `precioLitro()` → number `> 0` — Task 1 Step 3; usados en `fuelEst` y en el `<summary>`/`value` de los inputs (Task 2 Step 2).
- `fuelEst(km)` → `{litros, isk, eur}` — Task 1 Step 3; consumido en `dayBlock` (`fe.litros`, `fe.isk`, `fe.eur`, Task 2 Step 1) y en el total (`.isk`, Task 2 Step 2). Claves idénticas.
- `dayKm(plan)` → number — Task 1 Step 3; `plan` es el retorno de `dayPlan(day)` que trae `legs: [{km,min}]` (B1). Usado en `dayBlock` (Task 2 Step 1) y en el total con `dayPlan(d)` (Task 2 Step 2).
- `openSheet(kind, id, preset)` — Task 1 Step 4; el único llamador con 3 args es el botón de `itinFuelBlock` (Task 2 Step 2). `preset` keys (`fecha`, `concepto`, `categoria`, `moneda`, `importe`) coinciden con `SCHEMAS.gasto.fields[].k` de D1.
- `fmtISK` / `fmtEUR` / `toEUR` — de D1, definidas antes en el IIFE; usadas en `dayBlock`, `itinFuelBlock`. Firmas sin cambios.
- `itinFuelBlock(it)` — definida en Task 2 Step 2 (tras `renderItinerario`); llamada en `renderItinerario` (misma tarea). `it` = retorno de `buildItinerary()` con `it.days`.
- Clases CSS: `.itin-fuel`, `.itin-fuel__tot`, `.itin-fuel__cfg` (+ `summary`/`.field`/`input`/`select`), `.day-fuel` — Task 2 Step 3 las define; Task 2 Steps 1-2 las usan. `.field`, `.btn`, `.btn--ghost`, `.btn--sm`, `.muted` ya existen en el repo.
- `shell-v17` / `?v=17` — Task 1 Step 5; verificado Steps 6-8 y Task 2 Step 5. Precache 28 = las mismas 28 de D1 con `style.css`/`app.js` a `?v=17` (sustituyen, no suman). Sin assets nuevos.

Sin inconsistencias.
