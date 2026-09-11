# Plan — Experiencia E3: lista de equipaje

Spec: `docs/superpowers/specs/2026-09-11-experiencia-e3-lista-equipaje-design.md`

## Task único: `state.equipaje` + `EQUIPAJE_SEED` + `equipajeBlock()`

**Files:** Modify `app.js` (`blankState`, `seedState`, `load`, nueva
constante y función), `style.css`, `README.md`.

- [ ] **Step 1**: `blankState()` gana `equipaje: []`.

- [ ] **Step 2**: `EQUIPAJE_SEED`, junto a `COCHE_SEED`:
  ```js
  const EQUIPAJE_SEED = [
    { id: 'seed-eq-1',  texto: 'Capa base térmica (arriba y abajo)', cat: 'Ropa', packed: false },
    { id: 'seed-eq-2',  texto: 'Forro polar o jersey de abrigo', cat: 'Ropa', packed: false },
    { id: 'seed-eq-3',  texto: 'Chaqueta impermeable y cortavientos', cat: 'Ropa', packed: false },
    { id: 'seed-eq-4',  texto: 'Pantalón impermeable o cortavientos', cat: 'Ropa', packed: false },
    { id: 'seed-eq-5',  texto: 'Gorro que tape las orejas', cat: 'Ropa', packed: false },
    { id: 'seed-eq-6',  texto: 'Guantes (mejor táctiles, para el móvil)', cat: 'Ropa', packed: false },
    { id: 'seed-eq-7',  texto: 'Bufanda o braga de cuello', cat: 'Ropa', packed: false },
    { id: 'seed-eq-8',  texto: 'Calcetines de senderismo (varios pares)', cat: 'Ropa', packed: false },
    { id: 'seed-eq-9',  texto: 'Ropa interior para varios días', cat: 'Ropa', packed: false },
    { id: 'seed-eq-10', texto: 'Bañador (piscinas y lagunas geotermales)', cat: 'Ropa', packed: false },
    { id: 'seed-eq-11', texto: 'Botas de senderismo impermeables, ya rodadas', cat: 'Calzado', packed: false },
    { id: 'seed-eq-12', texto: 'Calzado cómodo de repuesto para el coche/ciudad', cat: 'Calzado', packed: false },
    { id: 'seed-eq-13', texto: 'Chanclas o sandalias para las duchas de las piscinas', cat: 'Calzado', packed: false },
    { id: 'seed-eq-14', texto: 'Gafas de sol', cat: 'Accesorios de frío', packed: false },
    { id: 'seed-eq-15', texto: 'Crema hidratante y protector labial (el viento reseca)', cat: 'Accesorios de frío', packed: false },
    { id: 'seed-eq-16', texto: 'Toalla de secado rápido para piscinas/lagunas', cat: 'Accesorios de frío', packed: false },
    { id: 'seed-eq-17', texto: 'DNI o pasaporte', cat: 'Documentos y dinero', packed: false },
    { id: 'seed-eq-18', texto: 'Carné de conducir', cat: 'Documentos y dinero', packed: false },
    { id: 'seed-eq-19', texto: 'Reservas descargadas (vuelos, coche, alojamientos) por si falla la conexión', cat: 'Documentos y dinero', packed: false },
    { id: 'seed-eq-20', texto: 'Tarjeta con chip y PIN (imprescindible en gasolineras automáticas)', cat: 'Documentos y dinero', packed: false },
    { id: 'seed-eq-21', texto: 'Seguro de viaje', cat: 'Documentos y dinero', packed: false },
    { id: 'seed-eq-22', texto: 'Cargador y cable de móvil', cat: 'Electrónica', packed: false },
    { id: 'seed-eq-23', texto: 'Batería externa', cat: 'Electrónica', packed: false },
    { id: 'seed-eq-24', texto: 'Frontal o linterna pequeña (anochece pronto en octubre)', cat: 'Electrónica', packed: false },
    { id: 'seed-eq-25', texto: 'Analgésicos y botiquín personal básico', cat: 'Botiquín y aseo', packed: false },
    { id: 'seed-eq-26', texto: 'Bolsas de plástico para ropa mojada', cat: 'Botiquín y aseo', packed: false },
    { id: 'seed-eq-27', texto: 'Snacks y agua para tramos largos sin gasolinera', cat: 'Coche y carretera', packed: false },
    { id: 'seed-eq-28', texto: 'Cargador de coche / adaptador de mechero', cat: 'Coche y carretera', packed: false }
  ];
  ```
  (Sin adaptador de enchufe: Islandia usa el mismo tipo que España — no hace
  falta ítem para eso, y no se incluye para no dar un consejo incorrecto por
  omisión en otro idioma de origen.)

- [ ] **Step 3**: `seedState()` — añadir tras `s.excursiones = ...`:
  ```js
  s.equipaje = JSON.parse(JSON.stringify(EQUIPAJE_SEED));
  ```

- [ ] **Step 4**: `load()` — en el objeto devuelto cuando `raw` existe,
  añadir:
  ```js
  equipaje: p.equipaje !== undefined ? p.equipaje : JSON.parse(JSON.stringify(EQUIPAJE_SEED)),
  ```
  (Ver spec §4 para la razón de `!== undefined` en vez de `|| []`.)

- [ ] **Step 5**: `equipajeBlock()`, junto a `groupEl`/`metaCard`:
  ```js
  function equipajeBlock() {
    const g = el('div', 'group');
    const openKey = 'open_equipaje';
    const isOpen = localStorage.getItem(openKey) !== '0';
    const total = state.equipaje.length;
    const packed = state.equipaje.filter(x => x.packed).length;

    const head = el('button', 'group__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(isOpen));
    head.innerHTML =
      `<span class="group__label">🎒 Equipaje</span>` +
      `<span class="group__right"><span class="count">${packed}/${total}</span><span class="chev">⌄</span></span>`;

    const bodyWrap = el('div', 'group__body');
    bodyWrap.hidden = !isOpen;

    if (!total) {
      const e = el('div', 'empty');
      e.textContent = 'Sin elementos.';
      bodyWrap.appendChild(e);
    } else {
      const cats = [];
      const byCat = {};
      state.equipaje.forEach(it => {
        if (!byCat[it.cat]) { byCat[it.cat] = []; cats.push(it.cat); }
        byCat[it.cat].push(it);
      });
      cats.forEach(cat => {
        const catEl = el('p', 'equipaje-cat');
        catEl.textContent = cat;
        bodyWrap.appendChild(catEl);
        const list = el('div', 'equipaje-list');
        byCat[cat].forEach(it => {
          const row = el('label', 'equipaje-row' + (it.packed ? ' equipaje-row--done' : ''));
          row.innerHTML =
            `<input type="checkbox"${it.packed ? ' checked' : ''}>` +
            `<span>${esc(it.texto)}</span>`;
          row.querySelector('input').addEventListener('change', () => {
            it.packed = !it.packed;
            save();
            renderDatos();
          });
          const del = el('button', 'icon-btn icon-btn--danger equipaje-row__del');
          del.type = 'button';
          del.setAttribute('aria-label', 'Eliminar');
          del.textContent = '🗑';
          del.addEventListener('click', async ev => {
            ev.preventDefault();
            const ok = await confirmAsk('¿Eliminar «' + it.texto + '» de la lista?');
            if (!ok) return;
            const i = state.equipaje.findIndex(x => x.id === it.id);
            if (i > -1) { state.equipaje.splice(i, 1); save(); renderDatos(); }
          });
          row.appendChild(del);
          list.appendChild(row);
        });
        bodyWrap.appendChild(list);
      });
    }

    const addRow = el('form', 'equipaje-add');
    addRow.innerHTML = `<input type="text" placeholder="Añadir a la lista…" maxlength="60"><button type="submit" class="btn btn--ghost">+ Añadir</button>`;
    addRow.addEventListener('submit', e => {
      e.preventDefault();
      const input = addRow.querySelector('input');
      const texto = input.value.trim();
      if (!texto) return;
      state.equipaje.push({ id: uid(), texto, cat: 'Otros', packed: false });
      save();
      renderDatos();
    });
    bodyWrap.appendChild(addRow);

    head.addEventListener('click', () => {
      const willOpen = bodyWrap.hidden;
      bodyWrap.hidden = !willOpen;
      head.setAttribute('aria-expanded', String(willOpen));
      localStorage.setItem(openKey, willOpen ? '1' : '0');
    });

    g.append(head, bodyWrap);
    return g;
  }
  ```

- [ ] **Step 6**: `renderDatos()` — tras el `.forEach` que añade los grupos
  existentes:
  ```js
      body.appendChild(equipajeBlock());
  ```

- [ ] **Step 7**: CSS en `style.css`, junto a `.group__body`/`.list`:
  ```css
  .equipaje-cat {
    margin: var(--space-12) 0 var(--space-4);
    font-size: var(--step--1);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .02em;
    color: var(--c-text-2);
  }
  .equipaje-list { display: flex; flex-direction: column; gap: var(--space-4); }
  .equipaje-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-8) 0;
    cursor: pointer;
  }
  .equipaje-row input[type="checkbox"] { flex-shrink: 0; width: 1.15em; height: 1.15em; }
  .equipaje-row span { flex: 1; font-size: var(--step-0); }
  .equipaje-row--done span { color: var(--c-text-2); text-decoration: line-through; }
  .equipaje-row__del { margin-left: auto; flex-shrink: 0; }
  .equipaje-add { display: flex; gap: var(--space-8); margin-top: var(--space-12); }
  .equipaje-add input { flex: 1; }
  ```

- [ ] **Step 8**: README — añadir frase: "Datos incluye una **lista de
  equipaje** curada para el viaje, con checklist, ítems propios y borrado."

- [ ] **Step 9**: Verificar (`node --check app.js`; navegador con SW/caché
  limpios — **sin** limpiar `localStorage` para probar la migración de un
  usuario ya existente, y una vez limpiando `localStorage` para probar el
  camino 100 % nuevo):
  1. Datos → bloque «🎒 Equipaje», contador `0/28` (localStorage limpio) o
     `0/28` también si el usuario ya existente no tenía el campo (migración
     via `load()`).
  2. Marcar 3 → `3/28`; desmarcar 1 → `2/28`; texto tachado en los marcados.
  3. Añadir un ítem → aparece bajo «Otros», contador `2/29`.
  4. Eliminar un ítem → confirmación, luego desaparece y baja el contador.
  5. Recargar sin limpiar `localStorage` → el estado persiste.
  6. Barrido de las 5 pantallas → consola sin errores.

- [ ] **Step 10**: Commit + push. Sin release nuevo.

## Self-Review

- Cobertura: checklist curada + marcar/añadir/eliminar — cubre el punto E3
  del backlog.
- Sin placeholders/TBD; `EQUIPAJE_SEED` completo, 28 ítems, 6 categorías.
- Tipo `{id,texto,cat,packed}` consistente entre semilla, `load()` y
  `equipajeBlock()`.
- Decisión de semilla (`!== undefined` en vez de `|| []`) documentada y
  justificada en la spec — única lógica no trivial del task.
- `equipajeBlock()` sigue el patrón visual de `groupEl` (mismas clases
  `.group*`) pero con su propio contenido — no reutiliza `SCHEMAS`/
  `openSheet` porque no aplica (checklist, no ficha con formulario).
- Riesgo bajo: autorrevisión inline, sin subagente.
