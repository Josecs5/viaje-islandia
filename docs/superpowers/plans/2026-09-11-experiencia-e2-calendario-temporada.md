# Plan — Experiencia E2: calendario de temporada

Spec: `docs/superpowers/specs/2026-09-11-experiencia-e2-calendario-temporada-design.md`

## Task único: `TEMPORADA` + `renderTemporada(body)`

**Files:** Modify `app.js` (dataset junto a `PLAN_B` o `PISCINAS`; render
junto a `renderPiscinas`; llamada en `renderReco`), `README.md`.

- [ ] **Step 1**: En `app.js`, tras `PISCINAS` y antes de `PLAN_B`:
  ```js
  /* Calendario de temporada: qué tiene sentido en estas fechas (Experiencia E2). */
  const TEMPORADA = {
    intro: 'El viaje es del 8 al 16 de octubre. Esto es lo que cambia por calendario, más allá del parte meteorológico de cada día.',
    items: [
      'Frailecillos (puffins): se han ido. Su temporada es de mayo a agosto; en octubre no vas a ver ninguno, da igual el acantilado.',
      'Avistamiento de ballenas: activo todo el año desde Reikiavik. Otoño es buena época y hay menos turistas que en verano.',
      'Cuevas de hielo azules: NO empiezan hasta noviembre — dependen de que el hielo se estabilice. Si algo se anuncia en octubre es una cueva de lava, no de hielo glaciar.',
      'Rutas de montaña y refugios de tierras altas (Laugavegur, Fimmvörðuháls, Landmannalaugar): cierran a mediados de septiembre. En octubre ya no hay buses de tierras altas ni refugios con servicio.',
      'F-roads: cerradas de mediados de octubre a mediados de junio (detalle completo en «Carreteras: antes de conducir»).',
      'Auroras: la temporada de oscuridad ya ha empezado (ver la pestaña Clima para la previsión de cada noche del viaje).',
      'Ferri a Vestmannaeyjar (Islas Westman): sigue en marcha pero con horario reducido de temporada baja; confirma el mismo día si hay viento fuerte, cancela con facilidad.',
      'Horas de luz: bajan día a día durante el viaje (ver la pestaña Clima para la cifra exacta de cada jornada).'
    ]
  };
  ```

- [ ] **Step 2**: `renderTemporada(body)`, tras `renderPiscinas`:
  ```js
  function renderTemporada(body) {
    const sec = el('section', 'reco-cat');
    sec.style.setProperty('--rc', '30');
    sec.innerHTML =
      `<div class="reco-cat__head">` +
      `<span class="reco-cat__badge">🍂</span>` +
      `<h3>Calendario de temporada: octubre</h3>` +
      `</div>` +
      `<p class="emerg-intro">${esc(TEMPORADA.intro)}</p>` +
      `<div class="reco-cat__list">` +
      TEMPORADA.items.map(t => `<div class="reco-card">${esc(t)}</div>`).join('') +
      `</div>`;
    body.appendChild(sec);
  }
  ```
  (`--rc: 30` no colisiona con los tints ya usados: 145/178/200/210/256.)

- [ ] **Step 3**: Llamar en `renderReco()`:
  ```js
      renderPiscinas(body);
      renderTemporada(body);
      renderPlanB(body);
  ```

- [ ] **Step 4**: README — añadir frase junto a la de Piscinas: "Un
  **calendario de temporada** resume qué actividades tienen sentido (o no)
  en esas fechas, más allá del tiempo del día a día."

- [ ] **Step 5**: Verificar (`node --check app.js`; navegador con SW/caché
  limpios): bloque «Calendario de temporada: octubre» entre Piscinas y Plan
  B; intro + 8 cards; sin HTML literal; barrido de 5 pantallas sin errores.

- [ ] **Step 6**: Commit + push. Sin release nuevo.

## Self-Review

- Cobertura: backlog E2 tal cual estaba planteado (qué está disponible/
  cerrado en las fechas del viaje).
- Sin duplicar A2 (auroras)/A4 (F-roads)/A5 (luz) — solo una frase de
  referencia cruzada por cada uno, el resto es contenido nuevo (fauna,
  cuevas de hielo, tierras altas, ferri).
- Sin fechas de eventos puntuales de 2026 no verificables — solo hechos
  estructurales estables de la época del año.
- Mismo tipo `{intro:str, items:[str]}` y mismo patrón de render que
  `CARRETERAS`/`GASINFO` — sin inconsistencias de firma.
- Riesgo mínimo (contenido estático, sin lógica ni estado nuevo):
  autorrevisión inline, sin subagente.
