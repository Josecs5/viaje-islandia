# Plan — Navegación: chips de filtro en Datos, Ideas y Clima

Spec: `docs/superpowers/specs/2026-09-11-navegacion-chips-datos-ideas-clima-design.md`

Tres tasks independientes, mismo patrón que `selectedItinDay`/`itinChip` de
Itinerario en cada uno.

## Task 1: Datos

**Files:** `app.js` (nueva `let selectedDatosTopic`, `datosChip()`,
`renderDatos()` reescrito).

- [ ] Junto a `let selectedItinDay = 'all';`, añadir:
  ```js
  let selectedDatosTopic = 'all';
  ```
- [ ] Junto a `groupEl`, nueva función:
  ```js
  function datosChip(key, label) {
    const b = el('button', 'chip');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(selectedDatosTopic === key));
    b.addEventListener('click', () => {
      if (selectedDatosTopic === key) return;
      selectedDatosTopic = key;
      renderDatos();
    });
    return b;
  }
  ```
- [ ] Reescribir `renderDatos()`:
  ```js
  function renderDatos() {
    const body = $('#datos-body');
    body.innerHTML = '';

    const groups = [
      ['vuelos', 'Vuelos', vueloSummary],
      ['coches', 'Coche de alquiler', cocheSummary],
      ['alojamientos', 'Alojamientos', alojSummary],
      ['excursiones', 'Excursiones', excSummary],
      ['comidas', 'Dónde comer', comidaSummary],
      ['lugares', 'Qué ver', lugarSummary],
      ['gastos', 'Gastos', gastoSummary]
    ];

    const chips = el('div', 'chips chips--itin');
    chips.appendChild(datosChip('all', 'Todo'));
    groups.forEach(([col, label]) => chips.appendChild(datosChip(col, SCHEMAS[KIND_OF[col]].icon + ' ' + label)));
    chips.appendChild(datosChip('equipaje', '🎒 Equipaje'));
    body.appendChild(chips);

    body.appendChild(metaCard());

    groups.forEach(([col, label, sum]) => {
      if (selectedDatosTopic === 'all' || selectedDatosTopic === col) body.appendChild(groupEl(col, label, sum));
    });
    if (selectedDatosTopic === 'all' || selectedDatosTopic === 'equipaje') body.appendChild(equipajeBlock());
  }
  ```
- [ ] Verificar: `node --check app.js`; navegador — 9 chips (Todo + 7 grupos
  + Equipaje); pulsar «Gastos» → solo se ve metaCard + el grupo Gastos;
  pulsar «Todo» → vuelven todos; el estado abierto/cerrado de cada grupo
  (persistido en `localStorage` por `openKey`) no se ve afectado por el
  filtro. Barrido de 5 pantallas sin errores.
- [ ] Commit + push.

## Task 2: Ideas

**Files:** `app.js` (nueva `IDEAS_TOPICS`/`HEAD_TO_IDEAS_TOPIC`,
`selectedRecoTopic`, `recoChip()`, `renderReco()` con post-proceso).

- [ ] Junto a `GASINFO`/`PISCINAS`/`TEMPORADA` (constantes de contenido de
  Ideas), nueva constante:
  ```js
  const IDEAS_TOPICS = [
    { key: 'experiencias', label: '🌌 Experiencias', heads: ['Experiencias que no te puedes perder'] },
    { key: 'paradas', label: '📸 Paradas', heads: ['Paradas y desvíos que merecen la pena'] },
    { key: 'probar', label: '🍽️ Para probar', heads: ['Para probar'] },
    { key: 'consejos', label: '🧭 Consejos', heads: ['Consejos prácticos'] },
    { key: 'tuyas', label: '✍️ Tuyas', heads: ['Tus recomendaciones'] },
    { key: 'super', label: '🛒 Supermercados', heads: ['Supermercados baratos: Bónus y Krónan'] },
    { key: 'trucos', label: '🛒 Trucos', heads: ['Trucos para un país caro'] },
    { key: 'carreteras', label: '🛣️ Carreteras', heads: ['Carreteras: antes de conducir'] },
    { key: 'gasolineras', label: '⛽ Gasolineras', heads: ['Gasolineras y autonomía'] },
    { key: 'piscinas', label: '🛁 Piscinas', heads: ['Piscinas y pozas termales'] },
    { key: 'temporada', label: '🍂 Temporada', heads: ['Calendario de temporada: octubre'] },
    { key: 'planb', label: '🌧️ Plan B', heads: ['Plan B para días de lluvia o viento'] },
    { key: 'telefonos', label: '📞 Teléfonos', heads: ['Teléfonos importantes en Islandia', 'Emergencias', 'Salud', 'Carretera y conducción', 'Policía y consulado'] }
  ];
  const HEAD_TO_IDEAS_TOPIC = {};
  IDEAS_TOPICS.forEach(t => t.heads.forEach(h => { HEAD_TO_IDEAS_TOPIC[h] = t.key; }));
  ```
- [ ] Junto a `selectedItinDay`:
  ```js
  let selectedRecoTopic = 'all';
  ```
- [ ] Junto a `itinChip`, nueva función `recoChip(key, label)` (mismo cuerpo
  que `datosChip` pero con `selectedRecoTopic`/`renderReco`).
- [ ] En `renderReco()`, tras `body.innerHTML = '';`, insertar la fila de
  chips (antes de todo lo demás):
  ```js
  const chips = el('div', 'chips chips--itin');
  chips.appendChild(recoChip('all', 'Todo'));
  IDEAS_TOPICS.forEach(t => chips.appendChild(recoChip(t.key, t.label)));
  body.appendChild(chips);
  ```
  Y al final de la función (tras la última llamada `renderEmergencias(body)`),
  el post-proceso de filtrado:
  ```js
  [...body.querySelectorAll('.reco-cat')].forEach(sec => {
    const h3 = sec.querySelector('h3');
    const key = h3 && HEAD_TO_IDEAS_TOPIC[h3.textContent];
    sec.hidden = selectedRecoTopic !== 'all' && selectedRecoTopic !== key;
  });
  ```
- [ ] Verificar: `node --check app.js`; navegador — 14 chips (Todo + 13);
  pulsar «Teléfonos» → se ven la intro + Emergencias + Salud + Carretera y
  conducción + Policía y consulado, nada más; pulsar «Piscinas» → solo el
  bloque de piscinas (buscador incluido, sigue funcionando); pulsar «Todo»
  → vuelve todo. Ningún `<h3>` de Ideas queda sin tópico asignado (si
  aparece `key === undefined` para algún encabezado, revisar la tabla).
  Barrido de 5 pantallas sin errores.
- [ ] Commit + push.

## Task 3: Clima

**Files:** `app.js` (nueva `let selectedClimaDay`, `climaChip()`,
`renderClima()` reescrito).

- [ ] Junto a `selectedItinDay`:
  ```js
  let selectedClimaDay = 'all';
  ```
- [ ] Junto a `itinChip`, nueva función `climaChip(key, label)` (mismo
  cuerpo, con `selectedClimaDay`/`renderClima`).
- [ ] Reescribir `renderClima()`:
  ```js
  function renderClima() {
    const body = $('#clima-body');
    if (!body) return;
    body.innerHTML = '';

    if (!state.meta.fechaInicio || !state.meta.fechaFin) {
      body.appendChild(notice('Añade las fechas de inicio y fin en «Datos del viaje» para ver la luz y la luna de cada día.'));
      return;
    }
    if (typeof SunCalc === 'undefined') {
      body.appendChild(notice('No se pudo cargar el cálculo de sol y luna. Recarga la app.'));
      return;
    }

    const dates = eachDay(state.meta.fechaInicio, state.meta.fechaFin);
    if (selectedClimaDay !== 'all' && dates.indexOf(selectedClimaDay) === -1) selectedClimaDay = 'all';

    const chips = el('div', 'chips chips--itin');
    chips.appendChild(climaChip('all', 'Todos'));
    dates.forEach((d, i) => chips.appendChild(climaChip(d, 'Día ' + (i + 1))));
    body.appendChild(chips);

    const show = selectedClimaDay === 'all' ? dates : dates.filter(d => d === selectedClimaDay);
    show.forEach(d => body.appendChild(climaCard(sky(d))));
    // El scroll a la tarjeta de hoy lo hace showScreen('clima') (solo aplica
    // con el filtro en "Todos" — si ya hay un único día visible no hace falta).
  }
  ```
- [ ] Verificar: `node --check app.js`; navegador — chips «Todos» + «Día 1»…
  «Día 9»; pulsar «Día 3» → solo esa tarjeta; pulsar «Todos» → las 9
  vuelven y el scroll-a-hoy sigue funcionando al entrar en la pestaña.
  Barrido de 5 pantallas sin errores.
- [ ] Commit + push.

## Self-Review

- Mismo patrón ya verificado en producción (Itinerario/Mapas) replicado
  tres veces — bajo riesgo de introducir un patrón nuevo y no probado.
- Ideas: único punto no trivial es la tabla `HEAD_TO_IDEAS_TOPIC`; se
  verifica en Step de Task 2 que ningún `<h3>` quede sin tópico.
- Sin cambios de `state`, sin cambio de release.
