# Dinero · D3 — Bónus / Krónan y trucos de país caro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a la pantalla **Ideas** dos bloques de referencia estáticos —supermercados baratos (Bónus/Krónan) con horarios orientativos y dónde hay en ruta, y una lista de trucos de ahorro para país caro— con el mismo estilo que los bloques ya existentes.

**Architecture:** Solo `app.js` + release + README. Dos constantes nuevas (`MERCADOS`, `AHORRO`) junto a `EMERGENCIAS`, y una función `renderMercados(body)` gemela de `renderEmergencias(body)` que reutiliza las clases CSS ya existentes (`.reco-cat*`, `.reco-card`, `.emerg-intro`). Se enchufa en `renderReco()` entre «Tus recomendaciones» y los teléfonos. Sin estado, sin CRUD, sin API, sin CSS nuevo. Release `shell-v18`.

**Tech Stack:** HTML + CSS + JavaScript vanilla, sin build, sin framework, sin framework de test. Verificación manual con DevTools servida por `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-10-dinero-d3-bonus-kronan-pais-caro-design.md`

## Global Constraints

- Vanilla JS, sin build, **sin librería nueva**. Estilo del repo: IIFE, `'use strict'`, comentarios y copy en español.
- **Sin estado nuevo** (`state` no se toca), sin CRUD, sin `fetch`. Contenido 100 % semilla.
- **Sin CSS nuevo**: reutilizar `.reco-cat`, `.reco-cat__head`, `.reco-cat__badge`, `.reco-cat__list`, `.reco-card`, `.emerg-intro` tal cual (ya en `style.css`).
- `esc()` en **todo** el texto variable que entre en `innerHTML`, aunque sea semilla (coherencia con `renderReco`/`renderEmergencias`).
- Sin enlaces `<a>`: los dominios (`bonus.is`, `kronan.is`) van como texto plano.
- Orden en Ideas tras el cambio: bloques `RECOS` → «Tus recomendaciones» (CRUD) → **Supermercados** → **Trucos de país caro** → «Teléfonos importantes».
- No repetir consejos que ya están en `RECOS` «Consejos prácticos» (agua del grifo, Vínbúðin genérico, pago con tarjeta): D3 aporta el ángulo dinero + supermercado.
- Release: `?v=17 → ?v=18` en `index.html` (css + js) y `SHELL_ASSETS` de `sw.js`, a la vez. `sw.js` `SHELL_CACHE` `shell-v17 → shell-v18`. `TILE_CACHE` (`tiles-v2`) sin cambios. Precache sigue en **28** entradas.
- Commit único, mensaje en español, sin líneas de atribución. `git push origin main` después.

---

## Estructura de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `app.js` | Modificar | `MERCADOS` + `AHORRO` (constantes, junto a `EMERGENCIAS` ~línea 2108); `renderMercados(body)` (junto a `renderEmergencias` ~línea 2144); llamada en `renderReco()` (~línea 2237). |
| `index.html` | Modificar | `?v=17 → ?v=18` en `style.css` y `app.js`. |
| `sw.js` | Modificar | `shell-v17 → shell-v18`; `?v=18` en `SHELL_ASSETS`. |
| `README.md` | Modificar | Una frase. |

---

### Task 1: Bloques de supermercados y ahorro en Ideas + release `shell-v18`

**Files:**
- Modify: `app.js` (constantes tras `EMERGENCIAS` ~línea 2142; `renderMercados` tras `renderEmergencias` ~línea 2175; llamada en `renderReco` ~línea 2237), `index.html`, `sw.js`, `README.md`
- Test: verificación manual en navegador

**Interfaces:**
- Consumes: `el`, `esc` (existentes). Clases CSS existentes.
- Produces: `MERCADOS` (objeto), `AHORRO` (array con forma `{ico,tint,cat,items:[str]}`), `renderMercados(body)` → void (añade `<section>`s a `body`).

- [ ] **Step 1: Constantes `MERCADOS` y `AHORRO`**

En `app.js`, justo **después** del cierre del array `EMERGENCIAS` (`];`, ~línea 2142) y **antes** de `function renderEmergencias(body) {`:
```js
  /* Supermercados baratos y ahorro en un país caro (Dinero D3). Datos
     orientativos: los horarios cambian por tienda, se remite a la web oficial. */
  const MERCADOS = {
    intro: 'Bónus (el cerdito rosa) y Krónan son las dos cadenas baratas; el resto —Nettó, Samkaup, Kjörbúðin y sobre todo las tiendas de gasolinera— son más caras. Haz la compra grande en ciudad y lleva víveres para los tramos sin nada.',
    bonus: 'Orientativo: Lun–Jue 11:00–18:30 · Vie 10:00–19:30 · Sáb 10:00–18:00 · Dom 12:00–18:00. Las tiendas de Reikiavik y Selfoss abren más; muchas de pueblo cierran a las 18:00. Confírmalo en bonus.is.',
    kronan: 'Orientativo: casi todas 10:00–20:00 (alguna de Reikiavik 09:00–21:00). Suele abrir más tarde que Bónus y algún domingo más. Confírmalo en kronan.is.',
    enRuta: [
      'Reikiavik y alrededores: varias de las dos cadenas — haz aquí la compra grande (días 1 y 8-9).',
      'Sur (días 2-3): Bónus y Krónan en Selfoss; Krónan en Vík; en Kirkjubæjarklaustur solo una tienda pequeña.',
      'Sureste (día 4): Bónus y Nettó en Höfn.',
      'Este (días 4-5): Bónus y Krónan en Egilsstaðir — última compra grande antes del norte.',
      'Norte (días 5-6): Bónus, Krónan y Nettó en Akureyri; en Mývatn solo la tienda pequeña y cara de Reykjahlíð (Samkaup).',
      'Oeste (día 7): Bónus y Nettó en Borgarnes, de vuelta a Reikiavik.'
    ],
    cierre: 'Regla general: el súper cierra pronto, y más pronto aún en pueblo y en domingo. Compra por la mañana o a mediodía; no cuentes con reponer de noche. Fuera de horario solo quedan las tiendas de gasolinera (N1, Olís), bastante más caras.'
  };

  const AHORRO = [
    {
      ico: '🛒', tint: '75', cat: 'Trucos para un país caro',
      items: [
        'Alcohol: compra en el Duty Free de Keflavík nada más aterrizar (hay límite de importación: ~1 L de licor + 0,75 L de vino + 3 L de cerveza, o combinaciones equivalentes). Fuera de ahí, solo en Vínbúðin (estatal, caro, cierra sobre las 18:00 y no abre domingos). En el bar se paga por copa.',
        'Cocina: reserva alojamientos con cocina y desayuna del súper; un desayuno de hotel ronda 2.500–3.500 ISK por persona.',
        'Comida caliente barata: pylsa (perrito, ~500 ISK) en cualquier gasolinera o en Bæjarins Beztu; sopa de cordero con pan y, a menudo, relleno gratis; mostrador caliente de los Krónan/Bónus grandes; panaderías (kleinur, snúður).',
        'Gasolina: instala la app de N1, Olís, ÓB u Orkan para el descuento por litro; la de Costco (Reikiavik) suele ser la más barata. Paga siempre con tarjeta con PIN: muchas son automáticas y sin personal.',
        'Tax-free: en compras de más de 6.000 ISK en una misma tienda, pide allí el formulario; sello y reembolso en el aeropuerto, antes de facturar.',
        'Piscinas municipales (~1.000–1.300 ISK) con jacuzzis geotermales en casi todos los pueblos: la alternativa local y barata a los spa de pago.',
        'Propinas: no se dejan, el servicio va incluido. Redondear es opcional y poco habitual.',
        'Datos móviles: una eSIM o una SIM local (Nova, Síminn) suele salir mejor que el roaming; hay wifi en casi todos los alojamientos y gasolineras.',
        'Aparcamiento en Reikiavik: zonas de pago P1–P4 entre semana (app «Parka» o «EasyPark»); gratis de noche y, según la zona, los domingos. Fuera del centro, gratis.',
        'Free walking tour por Reikiavik (p. ej. CityWalk): sin precio fijo, propina voluntaria al final.'
      ]
    }
  ];
```

- [ ] **Step 2: `renderMercados(body)`**

En `app.js`, justo **después** del cierre de `function renderEmergencias(body) { … }` (`}`, ~línea 2175) y antes de `const RECO_CAT_ICO = …`:
```js
  function renderMercados(body) {
    const sup = el('section', 'reco-cat');
    sup.style.setProperty('--rc', '145');
    const cards = [
      `<b>Bónus.</b> ${esc(MERCADOS.bonus)}`,
      `<b>Krónan.</b> ${esc(MERCADOS.kronan)}`,
      ...MERCADOS.enRuta.map(t => esc(t)),
      `<b>Cierra pronto.</b> ${esc(MERCADOS.cierre)}`
    ];
    sup.innerHTML =
      `<div class="reco-cat__head">` +
      `<span class="reco-cat__badge">🛒</span>` +
      `<h3>Supermercados baratos: Bónus y Krónan</h3>` +
      `</div>` +
      `<p class="emerg-intro">${esc(MERCADOS.intro)}</p>` +
      `<div class="reco-cat__list">` +
      cards.map(c => `<div class="reco-card">${c}</div>`).join('') +
      `</div>`;
    body.appendChild(sup);

    AHORRO.forEach(g => {
      const sec = el('section', 'reco-cat');
      if (g.tint) sec.style.setProperty('--rc', g.tint);
      sec.innerHTML =
        `<div class="reco-cat__head">` +
        `<span class="reco-cat__badge">${esc(g.ico || '•')}</span>` +
        `<h3>${esc(g.cat)}</h3>` +
        `</div>` +
        `<div class="reco-cat__list">` +
        g.items.map(t => `<div class="reco-card">${esc(t)}</div>`).join('') +
        `</div>`;
      body.appendChild(sec);
    });
  }
```
*(Nota: los card de «en ruta» pasan `esc(t)` completo, sin `<b>`, porque no llevan etiqueta; los de Bónus/Krónan/Cierre sí, y el `<b>…</b>` es literal estático — solo se interpola `esc()` sobre la parte de datos.)*

- [ ] **Step 3: Llamar `renderMercados` en `renderReco()`**

En `app.js`, `renderReco()`, el final actual:
```js
    body.appendChild(mine);

    renderEmergencias(body);
  }
```
→
```js
    body.appendChild(mine);

    renderMercados(body);
    renderEmergencias(body);
  }
```

- [ ] **Step 4: Subir la versión de release**

- `index.html`: `style.css?v=17` → `?v=18`; `app.js?v=17` → `?v=18`.
- `sw.js`: `const SHELL_CACHE = 'shell-v17';` → `'shell-v18'`; en `SHELL_ASSETS`, `'./style.css?v=17'` → `'./style.css?v=18'` y `'./app.js?v=17'` → `'./app.js?v=18'`.

- [ ] **Step 5: README**

En `README.md`, en el párrafo de descripción, añadir una frase, p. ej. al final del bloque de gastos: "Y una guía rápida de **supermercados baratos (Bónus/Krónan)** y trucos para un país caro."

- [ ] **Step 6: Verificar**

Run:
```powershell
& "C:\Program Files\nodejs\node.exe" --check app.js
& "C:\Program Files\nodejs\node.exe" --check sw.js
python -m http.server 8000
```
Navegador limpio (Unregister SW + borrar Cache Storage + `localStorage.clear()`), pantalla **Ideas** (`#reco`), bajar hasta el final:
1. Tras «Tus recomendaciones» y su botón «+ Añadir recomendación» aparece una sección **«🛒 Supermercados baratos: Bónus y Krónan»**: párrafo intro, y en la lista un card para Bónus, uno para Krónan, 6 cards de «en ruta» y un card «Cierra pronto».
2. Después, sección **«🛒 Trucos para un país caro»** con 10 cards.
3. Después, **«📞 Teléfonos importantes en Islandia»** (sin cambios).
4. Los nuevos bloques tienen exactamente el mismo aspecto (márgenes, borde, tarjetas) que los bloques `RECOS` de la parte superior. Nada de HTML sin escapar (los `«»`, tildes y `–` se ven bien; no hay etiquetas literales visibles).
5. En consola: `document.querySelectorAll('#reco-body .reco-cat').length` → **8** (4 RECOS + «Tus recomendaciones» + 2 nuevos + … en realidad: 4 + 1 + 1 supermercados + 1 ahorro + 1 lead teléfonos + 4 emergencias). Comprobar en su lugar que existen los `<h3>` «Supermercados baratos: Bónus y Krónan» y «Trucos para un país caro».
6. `caches.keys()` → `["shell-v18", …]`; `(await (await caches.open('shell-v18')).keys()).length` → **28**; `shell-v17` no está.
7. `document.querySelector('script[src*="app.js"]').src` termina en `app.js?v=18`.
8. Recorrer Datos, Itinerario, Mapas, Ideas, Clima → consola sin errores.

- [ ] **Step 7: Commit y push**

```powershell
git add app.js index.html sw.js README.md
git commit -m "Dinero D3: supermercados Bonus/Kronan y trucos de pais caro en Ideas" -q
git push origin main
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Paso |
|---|---|
| §2 objetivo: bloque de supermercados (qué son, diferencia, horarios orientativos con aviso, en ruta) | Task 1 Steps 1-2 (`MERCADOS`, `renderMercados`) |
| §2 objetivo: bloque de trucos de ahorro | Task 1 Steps 1-2 (`AHORRO`) |
| §3 no-objetivos (sin horarios en tiempo real, sin mapa/coords, sin estado/CRUD/API, sin CSS nuevo, no repetir RECOS) | Contenido estático; reutiliza clases; `renderMercados` no toca `state` |
| §4.1 datos | Task 1 Step 1 |
| §4.2 render (section reco-cat, badge 🛒, emerg-intro, cards con `<b>etiqueta</b>` + `esc`) | Task 1 Step 2 |
| §4.3 integración (llamada entre `mine` y `renderEmergencias`; orden; README; release) | Task 1 Steps 3-5 |
| §5 casos borde (`esc` en todo; sin `state`; sin `<a>`) | Task 1 Step 2 (`esc()` en cada interpolación variable; sin `href`) |
| §6 pruebas 1-7 | Task 1 Step 6 |

Sin huecos.

**2. Escaneo de placeholders**

Sin "TBD"/"TODO". El contenido literal de `MERCADOS`/`AHORRO` está completo en el Step 1. `renderMercados` está entero en el Step 2. Verificación con `Run:`/`Expected:` concretos (recuento de caché, sufijo del script, presencia de los `<h3>`).

**3. Consistencia de tipos y nombres**

- `MERCADOS` = objeto `{intro, bonus, kronan, enRuta:[str], cierre}` — Step 1; leído solo por `renderMercados` (Step 2): `MERCADOS.bonus`, `.kronan`, `.enRuta.map`, `.cierre`, `.intro`. Claves coinciden.
- `AHORRO` = array de `{ico, tint, cat, items:[str]}` — **misma forma que `RECOS`** — Step 1; iterado por `renderMercados` (Step 2) con el mismo patrón `sec.innerHTML` que `renderReco` usa para `RECOS` (líneas 2196-2205 del original).
- `renderMercados(body)` — definida en Step 2 (tras `renderEmergencias`); llamada en `renderReco()` (Step 3) con el mismo `body` que `renderEmergencias`. Firma idéntica a `renderEmergencias(body)`.
- Clases CSS: `.reco-cat`, `.reco-cat__head`, `.reco-cat__badge`, `.reco-cat__list`, `.reco-card`, `.emerg-intro` — todas ya existen (usadas por `renderReco`/`renderEmergencias`). `--rc` custom property: ya la usan esas funciones (`sec.style.setProperty('--rc', g.tint)`).
- `shell-v18` / `?v=18` — Step 4; verificado Step 6. Precache 28 = las 28 de D2 con `style.css`/`app.js` a `?v=18` (sustituyen, no suman). Sin assets nuevos.
- `esc` / `el` — helpers del IIFE, ya usados en todo `renderReco`. Sin cambio de firma.

Sin inconsistencias.
