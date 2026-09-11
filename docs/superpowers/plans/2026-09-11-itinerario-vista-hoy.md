# Itinerario Vista "Hoy" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una tarjeta condensada al principio de la pantalla Itinerario que resuma el día en curso (plan/viabilidad, viento, exteriores, auroras de esta noche) cuando la fecha de hoy cae dentro del viaje.

**Architecture:** Una única función nueva, `hoyBlock(it)`, llamada al principio de `renderItinerario()`. No añade estado ni lógica de cálculo nueva — ensambla en una tarjeta los resultados de funciones ya existentes y verificadas esta sesión (`dayPlan`, `windFor`, `outdoorFor`, `auroraFor`).

**Tech Stack:** JS vanilla (IIFE, sin build ni framework), CSS plano. Sin framework de tests en este proyecto — verificación vía `node --check app.js` (sintaxis) y comprobación manual en navegador con las herramientas de automatización de Chrome, siguiendo la misma convención que el resto de planes de esta sesión.

**Spec:** `docs/superpowers/specs/2026-09-11-itinerario-vista-hoy-design.md`

## Global Constraints

- Sin `state` nuevo, sin cambio de release (`shell-v24`/`?v=24` no cambian — no hay assets nuevos).
- No modificar `dayPlan`, `windFor`, `outdoorFor`, `auroraFor`, `sky`, `diaHoyYMD`, `verdictLabel` — solo se consumen tal cual.
- Fuera del rango de fechas del viaje, `hoyBlock` devuelve `null` y no se añade ningún nodo (Itinerario debe verse exactamente igual que antes de este cambio).
- Usar la tool de edición (Edit), nunca PowerShell `Set-Content`, para `app.js`/`style.css` (riesgo de corrupción UTF-8/BOM, lección de sesiones anteriores).
- Antes de cada comprobación en navegador: limpiar Service Worker + Cache Storage (no `localStorage`, salvo que la tarea diga lo contrario) y hacer doble navegación `manifest.json` → `index.html` para evitar servir JS cacheado.

---

### Task 1: `hoyBlock(it)` + integración en `renderItinerario`

**Files:**
- Modify: `app.js` — nueva función `hoyBlock(it)` (junto a `itinFuelBlock`, que está justo antes de `renderItinerario` en el archivo); una línea nueva dentro de `renderItinerario()`.
- Modify: `style.css` — nuevas clases `.hoy-card` y `.hoy-card__*`.
- Test: verificación manual en navegador (sin framework de tests en este proyecto).

**Interfaces:**
- Consumes: `diaHoyYMD()` → `string|null` (fecha YMD de hoy si está en el viaje). `it.days` → `[{date, idx, items, km}]` (de `buildItinerary()`). `dayPlan(day)` → `{veredicto, salirMin, inicioMin, drivingMin, volante, endMin}`. `verdictLabel(plan)` → `string`. `windFor(day)` → `{txt, level}|null`. `outdoorFor(day)` → `{txt, level}|null`. `auroraFor(sky(dateStr))` → `{txt, level, stale}`. `sky(dateStr)` → objeto usado por `auroraFor`/`climaCard`. `hhmmFromMin(min)` → `"HH:MM"`. `fmtDur(min)` → texto de duración. `fmtDiaSemana(dateStr)`/`fmtFecha(dateStr)` → texto de fecha. `cap(str)`/`esc(str)`/`el(tag, cls)` → helpers ya usados en todo el archivo.
- Produces: `hoyBlock(it)` → `HTMLElement|null`, consumido solo dentro de `renderItinerario()`.

- [ ] **Step 1: Localizar el punto de inserción exacto**

Ejecuta:
```bash
grep -n "function itinFuelBlock\|function renderItinerario" app.js
```
Confirma que `itinFuelBlock` está definida inmediatamente antes de
`renderItinerario`, y localiza dentro de `renderItinerario` la línea
`body.appendChild(itinFuelBlock(it));` (es la primera línea que añade
contenido al `body` tras calcular `it` y el `sub.textContent`).

- [ ] **Step 2: Escribir `hoyBlock(it)`**

Con la tool Edit, en `app.js`, inserta esta función **inmediatamente antes**
de `function itinFuelBlock(it) {`:

```js
  // Tarjeta condensada del día en curso, arriba de todo en Itinerario.
  // No calcula nada nuevo: ensambla dayPlan/windFor/outdoorFor/auroraFor,
  // ya verificados en B1/A3/A5/A2. null si hoy no cae dentro del viaje.
  function hoyBlock(it) {
    const hoy = diaHoyYMD();
    if (!hoy) return null;
    const day = it.days.find(d => d.date === hoy);
    if (!day) return null;

    const plan = dayPlan(day);
    const w = windFor(day);
    const od = outdoorFor(day);
    const aur = auroraFor(sky(hoy));

    const box = el('section', 'hoy-card');
    const head = el('p', 'hoy-card__head');
    head.innerHTML = `📍 <b>Hoy</b> · ${esc(cap(fmtDiaSemana(hoy)))}, ${esc(fmtFecha(hoy))} (Día ${day.idx})`;
    box.appendChild(head);

    if (plan.veredicto) {
      const label = verdictLabel(plan);
      const bits = [];
      if (plan.salirMin != null && plan.salirMin >= plan.inicioMin - 120) {
        bits.push('Sal sobre las <span class="mono">' + hhmmFromMin(plan.salirMin) + '</span>');
      }
      if (plan.drivingMin > 0 && plan.volante === 'ok') bits.push(fmtDur(plan.drivingMin) + ' al volante');
      const kmTxt = day.km >= 1 ? ' · ' + Math.round(day.km) + ' km' : '';
      const p = el('p', 'hoy-card__plan');
      p.innerHTML = `<span class="day-verdict day-verdict--${plan.veredicto}">${esc(label)}</span>${kmTxt}` +
        (bits.length ? '<br>' + bits.join(' · ') : '');
      box.appendChild(p);
    }

    if (w) {
      const pw = el('p', 'hoy-card__wind' + (w.level === 'fuerte' ? ' hoy-card__wind--fuerte' : ''));
      pw.innerHTML = `💨 ${esc(w.txt)}`;
      box.appendChild(pw);
    }
    if (od && od.level !== 'bueno') {
      const po = el('p', 'hoy-card__out');
      po.innerHTML = `${od.level === 'malo' ? '🌧️' : '⛅'} ${esc(od.txt)}`;
      box.appendChild(po);
    }
    const pa = el('p', 'hoy-card__aurora');
    pa.innerHTML = `🌌 ${esc(aur.txt)}`;
    box.appendChild(pa);

    return box;
  }

```

- [ ] **Step 3: Llamar `hoyBlock(it)` en `renderItinerario()`**

Con la tool Edit, en `app.js`, justo **antes** de
`body.appendChild(itinFuelBlock(it));` dentro de `renderItinerario()`,
inserta:
```js
    const hb = hoyBlock(it);
    if (hb) body.appendChild(hb);
```

- [ ] **Step 4: Comprobar sintaxis**

Run: `node --check app.js`
Expected: sin salida (sale limpio), sin excepción.

- [ ] **Step 5: CSS de la tarjeta**

Con la tool Edit, en `style.css`, busca la regla `.itin-fuel, .itin-outlook {`
(cabecera de la sección Itinerario) y añade **antes** de ella:
```css
.hoy-card {
  background: var(--c-accent-soft);
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, transparent);
  border-radius: var(--radius-m);
  padding: var(--space-12);
  margin-bottom: var(--space-16);
}
.hoy-card__head {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 600;
  margin: 0 0 var(--space-8);
}
.hoy-card__plan,
.hoy-card__wind,
.hoy-card__out,
.hoy-card__aurora {
  font-size: var(--step-0);
  margin: var(--space-4) 0 0;
  line-height: 1.5;
}
.hoy-card__wind--fuerte { color: var(--c-danger); font-weight: 600; }
```

- [ ] **Step 6: Levantar el servidor local (si no está ya corriendo)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/index.html`
Expected: `200`. Si no, arrancar en background:
```bash
cd /ruta/al/repo && nohup python -m http.server 8000 > /tmp/server.log 2>&1 &
```

- [ ] **Step 7: Verificar en navegador — hoy fuera del viaje (comportamiento real actual)**

Con las tools de automatización de Chrome (`javascript_tool`,
`navigate`), sobre el estado ya sembrado (localStorage con
`fechaInicio: '2026-10-08'`, `fechaFin: '2026-10-16'`, sin tocar):

1. Limpiar Service Worker + Cache Storage (NO `localStorage`):
   ```js
   const regs = await navigator.serviceWorker.getRegistrations();
   await Promise.all(regs.map(r => r.unregister()));
   const keys = await caches.keys();
   await Promise.all(keys.map(k => caches.delete(k)));
   ```
2. Navegar a `http://localhost:8000/manifest.json`, luego a
   `http://localhost:8000/index.html#itinerario` (doble navegación para
   evitar JS cacheado).
3. Ejecutar:
   ```js
   document.querySelector('[data-tab="itinerario"]').click();
   await new Promise(r=>setTimeout(r,400));
   JSON.stringify({ hoyCardPresent: !!document.querySelector('.hoy-card') });
   ```
   Expected: `hoyCardPresent: false` (la fecha real del sistema no cae en
   el viaje 8–16 oct 2026 — confirma que `hoyBlock` no añade nada cuando
   no hay "hoy", sin tocar `app.js` ni `localStorage`).

- [ ] **Step 8: Verificar el contenido de la tarjeta desplazando las fechas del viaje**

En vez de mockear `Date` (afecta a un closure privado del IIFE, no
accesible desde fuera) o parchear `app.js` en disco (más riesgo, hay que
acordarse de revertir), se desplazan temporalmente `fechaInicio`/
`fechaFin` en `localStorage` para que la fecha **real** del sistema quede
dentro del rango del "viaje" — así se ejercita el código de verdad, sin
mocks, y se revierte solo tocando datos, nunca el código fuente.

1. Leer el estado actual y guardar las fechas originales, luego
   desplazar el rango para incluir hoy (con margen de varios días a cada
   lado para poder ver un día con actividades):
   ```js
   const raw = JSON.parse(localStorage.getItem('islandia_trip_v1'));
   const origInicio = raw.meta.fechaInicio, origFin = raw.meta.fechaFin;
   const hoy = new Date();
   const ymd = d => d.toISOString().slice(0, 10);
   const ini = new Date(hoy); ini.setDate(ini.getDate() - 2);
   const fin = new Date(hoy); fin.setDate(fin.getDate() + 6);
   raw.meta.fechaInicio = ymd(ini);
   raw.meta.fechaFin = ymd(fin);
   localStorage.setItem('islandia_trip_v1', JSON.stringify(raw));
   JSON.stringify({ origInicio, origFin, nuevoInicio: raw.meta.fechaInicio, nuevoFin: raw.meta.fechaFin });
   ```
   Guarda `origInicio`/`origFin` del resultado — hacen falta en el Step 8.4
   para revertir.
2. Navegar a `http://localhost:8000/manifest.json` y de vuelta a
   `http://localhost:8000/index.html#itinerario` (recarga real, sin la
   cual `state` en memoria no relee `localStorage`).
3. Ejecutar:
   ```js
   document.querySelector('[data-tab="itinerario"]').click();
   await new Promise(r=>setTimeout(r,400));
   const card = document.querySelector('.hoy-card');
   const head = card?.querySelector('.hoy-card__head')?.textContent;
   const plan = card?.querySelector('.hoy-card__plan')?.textContent;
   const aurora = card?.querySelector('.hoy-card__aurora')?.textContent;
   JSON.stringify({ present: !!card, head, plan, aurora });
   ```
   Expected: `present: true`; `head` contiene la fecha de hoy correcta y
   un número de día coherente con el desplazamiento; `aurora` no vacío
   (aunque sea "sin datos" si no hay fetch de meteo reciente para estas
   fechas desplazadas — el itinerario semilla no tiene alojamientos en
   estas fechas concretas, así que `plan`/`wind`/`outdoor` pueden salir
   vacíos o mínimos; lo que importa verificar aquí es que la tarjeta se
   **construye sin errores** con la fecha real de hoy dentro de rango, no
   el contenido exacto de cada línea — eso ya se cubre por reutilizar
   funciones ya probadas en B1/A2/A3/A5).
4. **Revertir** las fechas a las originales (dato, no código):
   ```js
   const raw2 = JSON.parse(localStorage.getItem('islandia_trip_v1'));
   raw2.meta.fechaInicio = origInicio;   // valor guardado en el Step 8.1
   raw2.meta.fechaFin = origFin;
   localStorage.setItem('islandia_trip_v1', JSON.stringify(raw2));
   ```
   Navegar de nuevo `manifest.json` → `index.html#itinerario` y confirmar
   que `state.meta.fechaInicio/fechaFin` vuelven a ser `2026-10-08`/
   `2026-10-16` (leer `JSON.parse(localStorage.getItem('islandia_trip_v1')).meta`).

- [ ] **Step 9: Barrido de las 5 pantallas**

Con SW/caché ya limpios de un paso anterior:
```js
for (const sc of ['datos','itinerario','mapas','reco','clima']) {
  document.querySelector(`[data-tab="${sc}"]`).click();
  await new Promise(r=>setTimeout(r,400));
}
```
Luego `read_console_messages` con patrón `app\.js|Uncaught|SyntaxError|ReferenceError`,
`onlyErrors: true`. Expected: sin resultados.

- [ ] **Step 10: Comprobar que no cambian los assets precacheados**

```js
const shell = (await caches.keys()).find(k=>k.startsWith('shell-'));
const cc = await caches.open(shell); const ks = await cc.keys();
JSON.stringify({shell, entries: ks.length});
```
Expected: `{"shell":"shell-v24","entries":28}` — sin cambios (no hay
assets nuevos en este task).

- [ ] **Step 11: Commit y push**

```bash
git add app.js style.css
git commit -m "Itinerario: tarjeta Hoy con plan del dia, viento, exteriores y auroras"
git push origin main
```

- [ ] **Step 12: README**

Con Edit, en `README.md`, añade una frase (junto a la del diario de viaje):
"Itinerario muestra una tarjeta **Hoy** con el resumen del día en curso —
plan y viabilidad, viento, exteriores y previsión de auroras de esta
noche — cuando la fecha actual cae dentro del viaje." Luego:
```bash
git add README.md
git commit -m "README: documentar la tarjeta Hoy de Itinerario"
git push origin main
```

## Self-Review

**1. Cobertura del spec:**

| Sección del spec | Task |
|---|---|
| §2.1-2.3 fecha/día + veredicto/km + hora salida | Task 1 Step 2 (`head`, `p.hoy-card__plan`) |
| §2.4 aviso de viento condicional | Task 1 Step 2 (`if (w)`) |
| §2.5 aviso de exteriores condicional | Task 1 Step 2 (`if (od && od.level !== 'bueno')`) |
| §2.6 auroras de esta noche, siempre que haya texto | Task 1 Step 2 (`pa` sin condición) |
| §3 no-objetivos (sin pestaña nueva, sin `state`, sin cuenta atrás) | Task 1 Step 3 (una línea en `renderItinerario`, sin `state` tocado) |
| §4 diseño técnico (`hoyBlock` devuelve `null`, se llama antes de `itinFuelBlock`) | Task 1 Steps 2-3, código = spec |
| §5 CSS | Task 1 Step 5 |
| §6 verificación (1-7) | Task 1 Steps 4, 7-10 |

Sin huecos.

**2. Escaneo de placeholders:** sin "TBD"/"TODO". El código de `hoyBlock`
está completo y es idéntico al del spec (ya autorrevisado ahí). El Step 8
(verificación con fecha simulada) es más largo de lo habitual porque no
hay forma limpia de mockear `Date` dentro de un IIFE sin tocar el archivo;
se documenta el procedimiento exacto (parche temporal + revertir) en vez
de dejarlo como "simular la fecha" sin más.

**3. Consistencia de tipos/nombres:** `hoyBlock(it)` recibe el mismo `it`
que ya construye `renderItinerario()` (no se recalcula `buildItinerary()`
una segunda vez). Todos los campos leídos de `day` (`date`, `idx`, `km`,
`items` indirectamente vía `dayPlan`) coinciden con la forma que devuelve
`buildItinerary()` (ya usada por `dayBlock`/`itinFuelBlock` en el mismo
archivo). `plan.veredicto/salirMin/inicioMin/drivingMin/volante` coinciden
exactamente con los campos que ya lee `dayBlock` de `dayPlan(day)`. `w`/`od`
coinciden con `windFor`/`outdoorFor` tal como los consume `dayBlock`.
`aur.txt` coincide con lo que usa `climaCard` de `auroraFor`.

Sin inconsistencias.
