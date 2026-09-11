# Plan — Experiencia E4: diario de viaje (solo texto)

Spec: `docs/superpowers/specs/2026-09-11-experiencia-e4-diario-viaje-design.md`

## Task único: `state.diario` + `diarioBlock(day)` en `dayBlock`

**Files:** Modify `app.js` (`blankState`, `load`, nueva función, dos puntos
de `dayBlock`), `style.css`, `README.md`.

- [ ] **Step 1**: `blankState()` gana `diario: {}`.

- [ ] **Step 2**: `load()` — en el objeto devuelto cuando `raw` existe:
  ```js
  diario: p.diario || {}
  ```
  (Sin regla especial de semilla — un diario vacío es correcto por
  defecto, a diferencia de `equipaje`; ver spec §4.)

- [ ] **Step 3**: `diarioBlock(day)`, junto a `dayBlock`:
  ```js
  function diarioBlock(day) {
    const wrap = el('div', 'day-diario');
    const label = el('p', 'day-diario__label');
    label.textContent = '📝 Diario del día';
    const ta = el('textarea', 'day-diario__text');
    ta.placeholder = 'Escribe algo sobre este día…';
    ta.value = state.diario[day.date] || '';
    ta.rows = 3;
    ta.addEventListener('input', () => {
      const v = ta.value;
      if (v) state.diario[day.date] = v; else delete state.diario[day.date];
      save();
    });
    wrap.append(label, ta);
    return wrap;
  }
  ```

- [ ] **Step 4**: En `dayBlock`, añadir `wrap.appendChild(diarioBlock(day));`
  justo antes de **cada** `return wrap;` (el camino de "día sin
  actividades" y el camino normal), para que el diario quede siempre como
  última pieza de la tarjeta.

- [ ] **Step 5**: CSS en `style.css`:
  ```css
  .day-diario { margin-top: var(--space-12); }
  .day-diario__label {
    margin: 0 0 var(--space-4);
    font-size: var(--step--1);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .02em;
    color: var(--c-text-2);
  }
  ```

- [ ] **Step 6**: README — añadir frase: "Cada día del Itinerario tiene un
  campo de **diario de viaje** para anotar cómo fue esa jornada."

- [ ] **Step 7**: Verificar (`node --check app.js`; navegador con SW/caché
  limpios, **sin** limpiar `localStorage`):
  1. Cada tarjeta de día en Itinerario termina con «📝 Diario del día» +
     textarea (también en días sin actividades, si los hay).
  2. Escribir texto en un día → cambiar de pantalla y volver → el texto
     sigue.
  3. Recargar (navegación real) → persiste en `localStorage` bajo
     `state.diario`.
  4. Vaciar el texto de una entrada → la clave desaparece de
     `state.diario` (comprobar con `JSON.parse(localStorage...)`).
  5. Mientras el textarea tiene el foco, disparar `renderItinerario()`
     manualmente desde consola (simulando el refresco de meteo en segundo
     plano) → el texto no escrito aún no se pierde ni el foco salta (el
     guard existente en el punto de refresco de meteo lo cubre; esta prueba
     verifica que el propio `diarioBlock` no rompe nada si igualmente se
     re-renderiza).
  6. Barrido de las 5 pantallas → consola sin errores.

- [ ] **Step 8**: Commit + push. Sin release nuevo.

## Self-Review

- Cobertura: diario de texto por día, alcance acordado explícitamente con
  el usuario (sin fotos).
- Sin placeholders/TBD.
- `state.diario` es un objeto plano `{fecha: texto}`, sin ids ni colección
  — consistente con lo simple que necesita ser (no hay CRUD de entradas
  múltiples por día, una por día es el diseño).
- Sin re-render en cada tecla → sin riesgo de foco; el guard de meteo ya
  existente cubre el único caso de re-render externo mientras se escribe.
- Riesgo bajo: autorrevisión inline, sin subagente.
