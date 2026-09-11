# Plan — Conducción B3: radares y parkings de pago

Spec: `docs/superpowers/specs/2026-09-11-conduccion-b3-radares-parkings-design.md`

## Task único: dos items nuevos en `CARRETERAS.items`

**Files:** Modify `app.js` (`CARRETERAS.items`, junto a `renderCarreteras` ya
existente — sin tocar el render).

- [ ] **Step 1**: En `app.js`, añadir al final del array `CARRETERAS.items`
  (tras "Faros encendidos siempre..."):
  ```js
  'Radares: velocidad media en algunos túneles (incluido Vaðlaheiði) y radares fijos en tramos rectos de la Ruta 1; también controles móviles de policía. Límites: 90 km/h asfalto, 80 km/h grava, 50 km/h en núcleos urbanos — se aplican con poco margen.',
  'Parkings de pago: cráteres y cascadas muy visitadas (Kerið, Seljalandsfoss, Skógafoss) y el centro de Reikiavik cobran aparcamiento — con app (Parka, EasyPark), máquina o QR en el propio parking. Llévalo en cuenta al planear paradas cortas.'
  ```
- [ ] **Step 2**: `node --check app.js`.
- [ ] **Step 3**: Verificar en navegador (SW/caché limpios): Ideas →
  «Carreteras: antes de conducir» muestra los dos cards nuevos tras los
  existentes y antes de los enlaces; sin HTML literal; barrido de 5 pantallas
  sin errores de consola de la app.
- [ ] **Step 4**: Commit + push. Sin release nuevo (contenido estático dentro
  de un bloque ya precacheado, sin assets nuevos).

## Self-Review

- Cobertura: bullet 3 del usuario ("radares... parkings de pago") — cubierto
  al 100 % junto con lo que A4 ya resolvía (puentes, grava, túnel).
- Sin placeholders, sin TBD.
- `CARRETERAS.items` ya es `[string]` consumido por `renderCarreteras` vía
  `.map(t => esc(t))` — mismo tipo, ningún cambio de firma.
- Sin cambios de estado/release: riesgo mínimo, autorrevisión suficiente (no
  se dispara subagente).
