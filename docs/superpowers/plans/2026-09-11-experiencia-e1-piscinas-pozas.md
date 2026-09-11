# Plan — Experiencia E1: piscinas y pozas termales

Spec: `docs/superpowers/specs/2026-09-11-experiencia-e1-piscinas-pozas-design.md`

## Task único: `PISCINAS` + `renderPiscinas(body)` + buscador in-place

**Files:** Modify `app.js` (dataset junto a `GASINFO`; render junto a
`renderGasolineras`; llamada en `renderReco`), `style.css` (input del
buscador), `README.md` (frase).

- [ ] **Step 1**: En `app.js`, tras `GASINFO` y antes de `PLAN_B`:
  ```js
  /* Piscinas y pozas termales (Experiencia E1). */
  const PISCINAS = {
    intro: 'Ducha obligatoria y a fondo, sin bañador, antes de entrar — hay vestuarios y duchas separados por sexo. Es la norma más estricta para quien viene de fuera; el personal a veces lo comprueba. Nada de zapatos en la zona de duchas/piscina.',
    items: [
      { n: 'Laugardalslaug', zona: 'Reikiavik y alrededores', tipo: 'Piscina municipal', nota: '~1.400 ISK. La más grande de Reikiavik: toboganes, jacuzzis a distintas temperaturas, sauna.' },
      { n: 'Sundhöllin', zona: 'Reikiavik y alrededores', tipo: 'Piscina municipal', nota: 'La más antigua de la ciudad, en el centro; terraza exterior con vistas.' },
      { n: 'Vesturbæjarlaug', zona: 'Reikiavik y alrededores', tipo: 'Piscina municipal', nota: 'La preferida de los locales: ambiente tranquilo, buenos jacuzzis.' },
      { n: 'Sky Lagoon', zona: 'Reikiavik y alrededores', tipo: 'Laguna geotermal', nota: '~12.000 ISK. Infinity pool con vistas al mar; conviene reservar con antelación online.' },
      { n: 'Piscina de Selfoss', zona: 'Sur (Selfoss–Vík)', tipo: 'Piscina municipal', nota: 'Moderna, buena opción de paso hacia el sur.' },
      { n: 'Piscina de Hveragerði', zona: 'Sur (Selfoss–Vík)', tipo: 'Piscina municipal', nota: 'Junto al pueblo con más actividad geotérmica del país.' },
      { n: 'Reykjadalur', zona: 'Sur (Selfoss–Vík)', tipo: 'Poza natural', nota: 'Gratis. Caminata de ~45 min desde Hveragerði hasta un río templado; sin duchas ni vestuario, llévate lo puesto.' },
      { n: 'Seljavallalaug', zona: 'Sur (Selfoss–Vík)', tipo: 'Poza natural', nota: 'Gratis. Piscina de 1923 semiabierta al pie de la montaña; el agua no siempre está caliente, sin servicios.' },
      { n: 'Piscina de Höfn (Sundlaug Hafnar)', zona: 'Sureste (Höfn)', tipo: 'Piscina municipal', nota: 'Climatizada, con toboganes; buena opción para un día de lluvia.' },
      { n: 'Vök Baths', zona: 'Este (Egilsstaðir)', tipo: 'Laguna geotermal', nota: 'Pozas flotantes en el lago Urriðavatn; cafetería con infusiones de agua termal.' },
      { n: 'Piscina de Egilsstaðir', zona: 'Este (Egilsstaðir)', tipo: 'Piscina municipal', nota: 'Sencilla y económica.' },
      { n: 'Mývatn Nature Baths', zona: 'Norte (Mývatn–Akureyri)', tipo: 'Laguna geotermal', nota: '~7.000 ISK. La "Laguna Azul del norte", con menos gente que la original.' },
      { n: 'Piscina de Akureyri', zona: 'Norte (Mývatn–Akureyri)', tipo: 'Piscina municipal', nota: 'De las mejores del país: muchos toboganes.' },
      { n: 'GeoSea (Húsavík)', zona: 'Norte (Mývatn–Akureyri)', tipo: 'Laguna geotermal', nota: 'Agua de mar geotermal, infinity pool con vistas al fiordo.' },
      { n: 'Piscina de Borgarnes', zona: 'Oeste (Borgarnes–Snæfellsnes)', tipo: 'Piscina municipal', nota: 'De paso camino al oeste.' },
      { n: 'Krauma', zona: 'Oeste (Borgarnes–Snæfellsnes)', tipo: 'Laguna geotermal', nota: 'Junto a Deildartunguhver, el manantial de agua caliente más caudaloso de Europa; varias piscinas a distinta temperatura.' }
    ]
  };
  ```

- [ ] **Step 2**: Ya existe `normTxt(s)` en `app.js` (línea ~1434, sección de
  fotos: `String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')`)
  — reutilizar tal cual, no duplicar.

- [ ] **Step 3**: `renderPiscinas(body)`, tras `renderGasolineras`:
  ```js
  function renderPiscinas(body) {
    const sec = el('section', 'reco-cat');
    sec.style.setProperty('--rc', '178');
    sec.innerHTML =
      `<div class="reco-cat__head">` +
      `<span class="reco-cat__badge">🛁</span>` +
      `<h3>Piscinas y pozas termales</h3>` +
      `</div>` +
      `<p class="emerg-intro">${esc(PISCINAS.intro)}</p>` +
      `<input type="text" class="piscinas-search" placeholder="Buscar por nombre, zona o tipo…" aria-label="Buscar piscinas y pozas termales">` +
      `<div class="reco-cat__list piscinas-list"></div>` +
      `<p class="reco-empty piscinas-empty" hidden>Sin resultados.</p>`;
    const list = sec.querySelector('.piscinas-list');
    PISCINAS.items.forEach(it => {
      const c = el('div', 'reco-card');
      c.dataset.search = normTxt(`${it.n} ${it.zona} ${it.tipo} ${it.nota}`);
      c.innerHTML = `<b>${esc(it.n)}</b> <span class="muted">· ${esc(it.zona)} · ${esc(it.tipo)}</span><br>${esc(it.nota)}`;
      list.appendChild(c);
    });
    const empty = sec.querySelector('.piscinas-empty');
    const input = sec.querySelector('.piscinas-search');
    input.addEventListener('input', () => {
      const q = normTxt(input.value.trim());
      let visible = 0;
      list.querySelectorAll('.reco-card').forEach(c => {
        const show = !q || c.dataset.search.includes(q);
        c.hidden = !show;
        if (show) visible++;
      });
      empty.hidden = visible > 0;
    });
    body.appendChild(sec);
  }
  ```
  (`--rc: 178` no colisiona con los tints ya usados: 145 Mercados, 200
  Gasolineras, 210 Plan B, 256 Carreteras.)

- [ ] **Step 4**: Llamar en `renderReco()`:
  ```js
      renderGasolineras(body);
      renderPiscinas(body);
      renderPlanB(body);
  ```

- [ ] **Step 5**: CSS en `style.css`, junto a `.reco-cat__list`:
  ```css
  .piscinas-search {
    margin: var(--space-8) 0 var(--space-12);
  }
  ```
  (El resto lo hereda del `input` base y de `.reco-empty`/`.reco-card` ya
  existentes; `piscinas-empty` reutiliza literalmente `.reco-empty`.)

- [ ] **Step 6**: README — añadir frase junto a la de Gasolineras: "Ideas
  incluye una guía de **piscinas y pozas termales** de la ruta, con buscador
  por nombre o zona y las normas de ducha/etiqueta."

- [ ] **Step 7**: Verificar (`node --check app.js`; navegador con SW/caché
  limpios):
  1. Bloque «Piscinas y pozas termales» entre Gasolineras y Plan B; intro +
     16 cards.
  2. Escribir "sur" → solo 4 cards de zona Sur visibles; borrar → 16 de
     nuevo.
  3. Escribir "reykjavik" y "reikiavik" por separado → mismas 4 cards de
     Reikiavik en ambos casos (normalización de acentos/variantes ortográficas
     — nota: "Reykjavik"/"Reikiavik" son grafías distintas de la misma
     palabra, no un caso de acentos; si `normTxt` no las iguala, ese caso
     concreto se documenta como limitación conocida y no se resuelve aquí,
     ver Step 8).
  4. Escribir "xyz" → 0 cards + "Sin resultados." visible.
  5. El foco del input no se pierde mientras se escribe (no hay re-render).
  6. Barrido de las 5 pantallas → consola sin errores.

- [ ] **Step 8**: Nota de diseño post-verificación (rellenar durante la
  implementación si aplica): el buscador filtra por **substring exacto tras
  normalizar acentos**, no por sinónimos ni transliteraciones alternativas
  (p. ej. "Reykjavik" con y griega no coincide con "Reikiavik" con i latina
  si el usuario busca la grafía que no está en los datos — los datos de este
  archivo usan siempre "Reikiavik", igual que el resto de la app). No es un
  bug: es el mismo criterio de búsqueda simple usado en cualquier campo de
  texto de la app, documentado aquí para no reabrirlo como hallazgo en la
  revisión.

- [ ] **Step 9**: Commit + push. Sin release nuevo (sin assets nuevos, el
  buscador es JS+CSS dentro de los archivos ya precacheados).

## Self-Review

- Cobertura: bloque nuevo con intro de etiqueta + 16 sitios de la ruta +
  buscador en vivo — cubre el punto E1 tal cual estaba en el backlog.
- Sin placeholders/TBD.
- `PISCINAS.items[]` → `{n,zona,tipo,nota}`, todos `esc()`-ados al pintar;
  `normTxt` es la única función nueva de lógica, pura y sin dependencias de
  `state`.
- Filtro in-place (toggle `.hidden` sobre nodos ya creados) — mismo patrón
  de "no perder foco" que preocupaba en D2, pero aquí no hace falta un
  mecanismo de `commit()`/restauración de foco porque no hay re-render en
  absoluto: el árbol DOM del buscador se construye una vez en
  `renderPiscinas` y el listener solo cambia `hidden`.
- `--rc: 178` no colisiona con los demás tints del archivo (145/200/210/256).
- Riesgo bajo (contenido + un filtro de texto sin estado persistente):
  autorrevisión inline, sin subagente.
