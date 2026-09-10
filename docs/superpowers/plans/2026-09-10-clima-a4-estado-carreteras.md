# Clima · A4 — Estado de carreteras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Un bloque de referencia «Carreteras» en Ideas —cómo leer el estado de carreteras de Islandia, F-roads cerradas en octubre, peligros típicos de la Ruta 1— con enlaces directos a umferdin.is / safetravel.is / vedur.is / road.is.

**Architecture:** Solo `app.js` + release + README. Una constante `CARRETERAS` (misma forma de datos que `MERCADOS`: cuerpos sin la etiqueta en negrita) y `renderCarreteras(body)` gemela de `renderMercados`, reutilizando `.reco-cat*` / `.reco-card` / `.reco-link` / `<a target=_blank rel=noopener>`. Se enchufa en `renderReco()` entre `renderMercados` y `renderEmergencias`. Sin estado, sin fetch (los endpoints de carreteras no tienen CORS), sin CSS nuevo. Release `shell-v21`.

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. Verificación manual con DevTools servida por `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-clima-a4-estado-carreteras-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva**, sin `fetch`. IIFE, `'use strict'`, copy/comentarios en español.
- **Sin estado nuevo** (`state` intacto), sin CRUD. Contenido 100 % semilla.
- **Sin CSS nuevo**: reutilizar `.reco-cat`, `.reco-cat__head`, `.reco-cat__badge`, `.reco-cat__list`, `.reco-card`, `.emerg-intro`, `.reco-link` (ya en `style.css`).
- `esc()` en **todo** el texto variable que entre en `innerHTML`. Los `<b>…</b>` de etiqueta y el scaffold son literales estáticos, no interpolados.
- `CARRETERAS = { intro, codigos, froads, items:[str], links:[{l,u}] }` — `codigos`/`froads` son **solo el cuerpo** (sin la etiqueta en negrita); `renderCarreteras` compone `` `<b>Códigos de color.</b> ${esc(CARRETERAS.codigos)}` `` etc. (igual que `renderMercados` con Bónus/Krónan). Ningún string lleva `**markdown**`.
- Enlaces: `` `<a class="reco-link" href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.l)} ›</a>` `` unidos por ` · `.
- Orden en Ideas tras el cambio: RECOS → «Tus recomendaciones» → Supermercados (D3) → Trucos de país caro (D3) → **Carreteras (A4)** → «Teléfonos importantes».
- No repetir el teléfono 1777 (ya en Emergencias → Carretera).
- Release: `?v=20 → ?v=21` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`; `sw.js` `SHELL_CACHE` `shell-v20 → shell-v21`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache **28**.
- Commit único, español, sin atribución. `git push origin main` después.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `CARRETERAS` (constante, junto a `AHORRO` ~línea 2244); `renderCarreteras(body)` (junto a `renderMercados` ~línea 2311); llamada en `renderReco()` ~línea 2375. |
| `index.html` | Modificar | `?v=20 → ?v=21` en `style.css` y `app.js`. |
| `sw.js` | Modificar | `shell-v20 → shell-v21`; `?v=21` en `SHELL_ASSETS`. |
| `README.md` | Modificar | Una frase. |

---

### Task 1: Bloque «Carreteras» en Ideas + release `shell-v21`

**Files:**
- Modify: `app.js` (constante tras `AHORRO` ~línea 2244; `renderCarreteras` tras `renderMercados` ~línea 2311; llamada en `renderReco` ~línea 2375), `index.html`, `sw.js`, `README.md`
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: `el`, `esc` (existentes). Clases CSS existentes.
- Produces: `CARRETERAS` (objeto), `renderCarreteras(body)` → void.

- [ ] **Step 1: Constante `CARRETERAS`**

En `app.js`, **después** del cierre del array `AHORRO` (`];`) y **antes** de `function renderEmergencias(body) {`:
```js
  /* Estado de carreteras (Clima A4). Sin API con CORS → contexto offline +
     enlaces a las fuentes en vivo. F-roads cerradas en octubre (el viaje). */
  const CARRETERAS = {
    intro: 'Antes de conducir cada mañana, mira umferdin.is (estado y cierres) y safetravel.is (avisos). Con viento fuerte o nieve la situación cambia en horas.',
    codigos: 'En umferdin.is: verde = despejado · amarillo = precaución (nieve o hielo aislado) · naranja/rojo = difícil, solo con 4x4 y experiencia · «Ófært» / negro = intransitable, cerrado.',
    froads: 'Las carreteras de montaña (prefijo «F», y algunas 3xx) están cerradas de mediados de octubre a mediados de junio. En este viaje NO intentes ninguna: multa alta, el seguro no cubre y el rescate tarda. Los vados («vað») son solo de F-roads y solo en verano.',
    items: [
      'Puentes de un solo carril («Einbreið brú»): pasa primero el vehículo más cercano al puente; el otro espera en el ensanche.',
      'Cambios de rasante y curvas ciegos («Blindhæð», «Blindbeygja»): ve pegado a tu carril y levanta el pie, puede venir alguien de frente por el centro.',
      'La Ruta 1 tiene tramos de grava sin apenas aviso («Malbik endar» = acaba el asfalto): frena antes, la grava suelta patina y salta a los bajos.',
      'Ovejas sueltas hasta noviembre: si ves una a un lado, la cría suele cruzar de golpe. Frena recto, no esquives bruscamente.',
      'Túnel de Hvalfjörður (norte de Reikiavik): gratis desde 2018. El de Vaðlaheiði (junto a Akureyri) se paga online en veggjald.is dentro de 24 h.',
      'Tramos que se cierran primero con temporal: Öxi (939), Möðrudalur y Mývatn–Egilsstaðir, Holtavörðuheiði (oeste), Hellisheiði y Þrengsli (salida sur de Reikiavik). Si uno está en rojo suele haber un desvío por la costa más largo.',
      'Faros encendidos siempre (obligatorio 24 h todo el año), cinturón todos, nada de móvil en la mano.'
    ],
    links: [
      { l: 'umferdin.is — estado y cierres', u: 'https://umferdin.is/en/' },
      { l: 'safetravel.is — avisos', u: 'https://safetravel.is/' },
      { l: 'vedur.is — tiempo y viento', u: 'https://en.vedur.is/' },
      { l: 'road.is — obras (Vegagerðin)', u: 'https://www.road.is/travel-info/road-conditions-and-weather/' }
    ]
  };
```

- [ ] **Step 2: `renderCarreteras(body)`**

En `app.js`, **después** del cierre de `function renderMercados(body) { … }` (`}`) y antes de `const RECO_CAT_ICO = …`:
```js
  function renderCarreteras(body) {
    const sec = el('section', 'reco-cat');
    sec.style.setProperty('--rc', '256');
    const cards = [
      `<b>Códigos de color.</b> ${esc(CARRETERAS.codigos)}`,
      `<b>F-roads y vados.</b> ${esc(CARRETERAS.froads)}`,
      ...CARRETERAS.items.map(t => esc(t)),
      CARRETERAS.links.map(x => `<a class="reco-link" href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.l)} ›</a>`).join(' · ')
    ];
    sec.innerHTML =
      `<div class="reco-cat__head">` +
      `<span class="reco-cat__badge">🛣️</span>` +
      `<h3>Carreteras: antes de conducir</h3>` +
      `</div>` +
      `<p class="emerg-intro">${esc(CARRETERAS.intro)}</p>` +
      `<div class="reco-cat__list">` +
      cards.map(c => `<div class="reco-card">${c}</div>`).join('') +
      `</div>`;
    body.appendChild(sec);
  }
```

- [ ] **Step 3: Llamar `renderCarreteras` en `renderReco()`**

En `app.js`, `renderReco()`:
```js
    renderMercados(body);
    renderEmergencias(body);
```
→
```js
    renderMercados(body);
    renderCarreteras(body);
    renderEmergencias(body);
```

- [ ] **Step 4: Release `shell-v21`**

- `index.html`: `style.css?v=20` → `?v=21`; `app.js?v=20` → `?v=21`.
- `sw.js`: `const SHELL_CACHE = 'shell-v20';` → `'shell-v21'`; `'./style.css?v=20'` → `'./style.css?v=21'`; `'./app.js?v=20'` → `'./app.js?v=21'`.

- [ ] **Step 5: README**

En `README.md`, añadir una frase (p. ej. tras la de supermercados): "Y una guía de **carreteras** (códigos de estado, F-roads cerradas en octubre, puentes de un carril, tramos que se cierran con temporal) con enlaces a umferdin.is y safetravel.is."

- [ ] **Step 6: Verificar**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
Navegador limpio (Unregister SW + borrar Cache Storage + `localStorage.clear()`), pantalla **Ideas** (`#reco`), bajar hasta el final:
1. Tras «Trucos para un país caro» aparece **«🛣️ Carreteras: antes de conducir»**: párrafo intro, card de «Códigos de color», card de «F-roads y vados», 7 cards de peligros, y un card con 4 enlaces (`umferdin.is`, `safetravel.is`, `vedur.is`, `road.is`).
2. Después va **«📞 Teléfonos importantes en Islandia»** (sin cambios).
3. En consola: `[...document.querySelectorAll('#reco-body .reco-cat h3')].map(h=>h.textContent)` → incluye «Carreteras: antes de conducir» **entre** «Trucos para un país caro» y «Teléfonos importantes en Islandia».
4. Un enlace del card abre `umferdin.is` en pestaña nueva (`target=_blank`).
5. Mismo aspecto que los bloques de arriba; ningún `<b>` ni `<a>` literal visible como texto; caracteres islandeses (Öxi, Möðrudalur, Vaðlaheiði, Þrengsli) bien.
6. `caches.keys()` → `["shell-v21"]`; `(await (await caches.open('shell-v21')).keys()).length` → **28**; sin `shell-v20`.
7. `document.querySelector('link[rel=stylesheet]')` y el `<script>` de `app.js` con `?v=21`.
8. Recorrer las 5 pantallas → consola sin errores.

- [ ] **Step 7: Commit y push**

```powershell
git add app.js index.html sw.js README.md
git commit -m "Clima A4: bloque de carreteras (estado, F-roads, peligros) con enlaces en Ideas" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Paso |
|---|---|
| §2 objetivo: contexto de carreteras + enlaces en vivo, en Ideas | Task 1 Steps 1-2 |
| §3 no-objetivos (sin API/CORS, sin estado/CRUD/fetch/CSS, no repetir 1777, no toca Itinerario) | Contenido estático; reutiliza clases; enlaces son `<a>` a sitios públicos |
| §4 datos (`CARRETERAS` shape como `MERCADOS`: cuerpos sin etiqueta) | Task 1 Step 1 |
| §5 render (section reco-cat, badge 🛣️, emerg-intro, cards con `<b>etiqueta</b>` + `esc`, card de enlaces) | Task 1 Step 2 |
| §6 integración (llamada entre `renderMercados` y `renderEmergencias`; orden; README; release) | Task 1 Steps 3-5 |
| §7 casos borde (`esc` en todo; sin `state`; `target=_blank rel=noopener`) | Task 1 Step 2 |
| §8 pruebas 1-6 | Task 1 Step 6 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". `CARRETERAS` y `renderCarreteras` completos en sus Steps. Verificación con `Run:`/`Expected:` concretos (orden de `<h3>`, recuento de caché, `target=_blank`).

**3. Consistencia de tipos y nombres**

- `CARRETERAS` = `{ intro:str, codigos:str, froads:str, items:[str], links:[{l:str,u:str}] }` — Task 1 Step 1; leído solo por `renderCarreteras` (Step 2): `.intro`, `.codigos`, `.froads`, `.items.map`, `.links.map(x => x.u, x.l)`. Claves coinciden.
- `renderCarreteras(body)` — Step 2 (tras `renderMercados`); llamada en `renderReco()` (Step 3) con el mismo `body` que `renderMercados`/`renderEmergencias`. Firma idéntica.
- Patrón `sec.innerHTML = …` idéntico al de `renderMercados` (Step 2 del plan de D3): `.reco-cat__head` + badge + `<h3>` + `.emerg-intro` + `.reco-cat__list` con `.reco-card`s. `esc()` en cada parte variable; `<b>`/`<a>` estáticos.
- `.reco-link` — clase ya usada por `recoSummary` con exactamente `<a class="reco-link" href=… target="_blank" rel="noopener">…›</a>`; A4 la reutiliza igual.
- Clases CSS: todas ya existen (`renderReco`/`renderEmergencias`/`recoSummary`). `--rc` custom property: ya la usan esas funciones.
- `shell-v21` / `?v=21` — Task 1 Step 4; verificado Step 6. Precache 28 = las 28 de A3 con `style.css`/`app.js` a `?v=21` (sustituyen). Sin assets nuevos.
- `esc` / `el` — helpers del IIFE, ya usados en `renderReco`. Sin cambio de firma.

Sin inconsistencias.
