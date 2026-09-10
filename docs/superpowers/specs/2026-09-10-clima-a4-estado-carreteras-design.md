# Clima · A4 — Estado de carreteras (road.is / safetravel.is)

Fecha: 2026-09-10 · Estado: aprobado (modo autónomo, sin gate) · Ships: `shell-v21`

## 1. Contexto

El usuario pidió «Estado de carreteras de road.is / safetravel.is, incl. estado
de F-roads y vados». La app es **offline-first y 100 % cliente**. Se probaron los
endpoints de Vegagerðin / umferdin.is / safetravel.is desde el navegador: todos
dan `Failed to fetch` (sin CORS para origen web). No hay una API pública apta
para un PWA cliente.

## 2. Objetivo

Dar en **Ideas** el contexto que la app sí puede ofrecer sin conexión —cómo se
lee el estado de carreteras de Islandia, qué está cerrado en octubre (F-roads),
y los peligros típicos de la Ruta 1 (puentes de un carril, cambios de rasante
ciegos, grava, ovejas, tramos que se cierran con viento/nieve)— **más enlaces
directos** a las fuentes en vivo (umferdin.is, safetravel.is, vedur.is) para
consultar de un toque antes de conducir cada día.

## 3. No-objetivos

- **Sin estado en tiempo real**: no hay API con CORS; no se hace scraping.
- Sin estado nuevo, sin CRUD, sin `fetch`, sin CSS nuevo (reutiliza `.reco-cat*` /
  `.reco-card` como D3, y `<a>` como `recoSummary`/`renderEmergencias`).
- No repetir el teléfono 1777 (ya está en «Teléfonos importantes» → Carretera).
- No tocar el Itinerario ni B1/A3.

## 4. Contenido (constante `CARRETERAS` en `app.js`, junto a `MERCADOS`)

```js
const CARRETERAS = {
  intro: 'Antes de conducir cada mañana, mira umferdin.is (estado y cierres) y safetravel.is (avisos). Con viento fuerte o nieve, la situación cambia en horas.',
  codigos: 'Colores en umferdin.is: verde = despejado · amarillo = precaución (nieve/hielo aislado) · naranja/rojo = difícil o solo con 4x4 y experiencia · «Ófært» / negro = intransitable, cerrado.',
  froads: 'F-roads (carreteras de montaña, prefijo «F» y algunas 3xx): **cerradas de mediados de octubre a mediados de junio**. En este viaje (octubre) NO intentes ninguna: multa alta, sin cobertura de seguro y sin rescate rápido. Los vados (vað) son solo de F-roads y solo en verano.',
  items: [
    'Puentes de un solo carril («Einbreið brú»): el vehículo más cercano al puente pasa primero; el otro espera en el ensanche.',
    'Cambios de rasante ciegos («Blindhæð») y curvas ciegas («Blindbeygja»): ve por tu carril y levanta el pie, puede venir alguien de frente.',
    'La Ruta 1 tiene tramos de grava sin avisar («Malbik endar» = acaba el asfalto): reduce, la grava suelta hace patinar y salta a los bajos.',
    'Ovejas sueltas hasta noviembre: si hay una a un lado, la otra cría suele cruzar de golpe. Frena, no esquives bruscamente.',
    'Túnel de Hvalfjörður (norte de Reikiavik): gratis desde 2018, ya no hay peaje. El de Vaðlaheiði (cerca de Akureyri) sí se paga online en veggjald.is en 24 h.',
    'Tramos que se cierran primero con temporal: Öxi (939), Möðrudalur y Mývatn–Egilsstaðir (norte-este), Holtavörðuheiði (oeste), Hellisheiði y Þrengsli (saliendo de Reikiavik al sur). Si uno está en rojo, casi siempre hay un desvío por la costa más largo.',
    'Faros SIEMPRE encendidos (obligatorio 24 h todo el año). Cinturón todos. Nada de móvil en la mano.'
  ],
  links: [
    { l: 'umferdin.is — estado y cierres', u: 'https://umferdin.is/en/' },
    { l: 'safetravel.is — avisos de viaje', u: 'https://safetravel.is/' },
    { l: 'vedur.is — tiempo y viento', u: 'https://en.vedur.is/' },
    { l: 'road.is — Vegagerðin (obras)', u: 'https://www.road.is/travel-info/road-conditions-and-weather/' }
  ]
};
```

*(Texto exacto se afina al escribir el plan; lo anterior es el contenido aprobado.)*

## 5. Render — `renderCarreteras(body)` en `app.js` (junto a `renderMercados`)

- Una `<section class="reco-cat">` con badge `🛣️` y `<h3>Carreteras: antes de conducir</h3>`:
  - `<p class="emerg-intro">` con `CARRETERAS.intro`.
  - `.reco-cat__list` con `.reco-card` para: **`codigos`** (`<b>Códigos de color.</b> …`),
    **`froads`** (`<b>F-roads y vados.</b> …`, con `<b>` interno para «cerradas…»),
    y cada línea de `CARRETERAS.items`.
  - Una `.reco-card` final con los enlaces: `CARRETERAS.links.map(x =>
    <a class="reco-link" href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.l)} ›</a>)`
    separados por ` · ` o cada uno en su línea.
- `esc()` en **todo** el texto variable. El `<b>…</b>` estático literal (no interpolado).
- El `**…**` de los textos de `CARRETERAS` NO es markdown: se reemplaza a mano por
  `<b>…</b>` en `renderCarreteras` (una función `bold(s)` que parte por `**` y
  envuelve los tramos impares), o se escribe el `<b>` directamente en el string y
  se documenta que ese campo lleva markup seguro. **Decisión**: escribir `<b>` en
  el string y aplicar `esc` solo a las partes que de verdad varían — igual que
  `renderMercados` hace `\`<b>Bónus.</b> ${esc(MERCADOS.bonus)}\``. Reescribir los
  strings de `CARRETERAS` sin `**`, con la etiqueta como prefijo separado.

  Es decir, la estructura real de datos es como `MERCADOS`: `{ intro, codigos,
  froads, items:[], links:[] }` donde `codigos`/`froads` son **solo el cuerpo**
  (sin la etiqueta en negrita), y `renderCarreteras` compone
  `\`<b>Códigos de color.</b> ${esc(CARRETERAS.codigos)}\``, etc.

## 6. Integración

- En `renderReco()`, tras `renderMercados(body);` y antes de `renderEmergencias(body);`,
  llamar `renderCarreteras(body);`.
- Orden final de Ideas: RECOS → «Tus recomendaciones» → Supermercados (D3) →
  Trucos de país caro (D3) → **Carreteras (A4)** → Teléfonos importantes.
- `README.md`: una frase.
- Release: `?v=20 → ?v=21` en `index.html` (css+js) y `SHELL_ASSETS` de `sw.js`;
  `sw.js` `shell-v20 → shell-v21`. `tiles-v2` sin cambios. Precache **28**.

## 7. Casos borde

- Sin dependencia de `state`: `renderCarreteras` solo lee la constante.
- Enlaces `target="_blank" rel="noopener"` (igual que `recoSummary`). Son sitios
  públicos del gobierno islandés; no se envía ningún dato.
- Sin conexión: los enlaces no abrirán, pero el contenido (que es lo que aporta
  offline) se ve igual.

## 8. Pruebas manuales

1. Ideas → tras «Trucos para un país caro» aparece «🛣️ Carreteras: antes de conducir», y después «Teléfonos importantes».
2. Muestra: intro, card de códigos de color, card de F-roads/vados (con «cerradas de mediados de octubre…» en negrita), 7 cards de peligros, y un card con 4 enlaces.
3. Los enlaces abren umferdin.is / safetravel.is / vedur.is / road.is en pestaña nueva.
4. Mismo estilo que los bloques de arriba; nada de HTML sin escapar visible; caracteres islandeses (Öxi, Möðrudalur, Vaðlaheiði) bien.
5. `node --check app.js` OK; consola limpia en las 5 pantallas.
6. `caches.keys()` → `shell-v21` con **28** entradas; `shell-v20` no está; `tiles-v2` intacta.
