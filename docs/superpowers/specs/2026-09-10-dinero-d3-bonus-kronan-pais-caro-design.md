# Dinero · D3 — Bónus / Krónan y trucos de país caro

Fecha: 2026-09-10 · Estado: aprobado (modo autónomo, sin gate) · Ships: `shell-v18`

## 1. Contexto

La pantalla **Ideas** (`renderReco`) ya mezcla contenido semilla de referencia con
las recomendaciones del usuario: `RECOS` (bloques `{ico,tint,cat,items:[str]}` →
`.reco-cat` / `.reco-card`) y `EMERGENCIAS` (estructura más rica → `renderEmergencias(body)`
al final). D1 y D2 cubrieron el registro y la estimación de gasto; falta la parte
de **contexto de país caro**: dónde y cuándo comprar comida barata, y cómo no
dejarse el presupuesto en tonterías.

## 2. Objetivo

Añadir a **Ideas**, con el mismo estilo que ya existe, dos bloques de referencia:

1. **Supermercados baratos (Bónus / Krónan)**: qué son, en qué se diferencian,
   horarios orientativos con el aviso de que varían por tienda, y en qué paradas
   de la ruta hay.
2. **Trucos para un país caro**: lista de tácticas concretas de ahorro (alcohol,
   cocina, gasolina, tax-free, piscinas, propinas, roaming, parking…).

## 3. No-objetivos

- **Sin horarios en tiempo real** ni scraping de bonus.is / kronan.is: son datos
  que cambian; se dan rangos orientativos y se remite a la web oficial.
- **Sin mapa de supermercados** ni coordenadas (eso sería otra pieza). Solo se
  nombran los pueblos de la ruta.
- **Sin estado nuevo, sin CRUD, sin API.** Contenido 100 % semilla, estático.
- **Sin CSS nuevo**: se reutilizan `.reco-cat` / `.reco-cat__head` /
  `.reco-cat__badge` / `.reco-cat__list` / `.reco-card` tal cual.
- No repetir lo que ya dice `RECOS` «Consejos prácticos» (agua del grifo,
  Vínbúðin, pago con tarjeta): D3 aporta el ángulo dinero + supermercado.

## 4. Diseño

### 4.1 Datos (constantes nuevas en `app.js`, junto a `EMERGENCIAS`)

```js
const MERCADOS = {
  intro: 'Bónus (cerdito rosa) y Krónan son las dos cadenas baratas; …',
  bonus:  { horario: 'Orientativo: Lun–Jue 11:00–18:30 · Vie 10:00–19:30 · Sáb 10:00–18:00 · Dom 12:00–18:00. Las tiendas de Reikiavik y Selfoss abren más; muchas de pueblo cierran a las 18:00. Confírmalo en bonus.is.' },
  kronan: { horario: 'Orientativo: casi todas 10:00–20:00 (algunas de Reikiavik 09:00–21:00). Suele abrir más tarde que Bónus. Confírmalo en kronan.is.' },
  enRuta: [
    'Reikiavik y alrededores: varias de las dos cadenas (haz la compra grande aquí, días 1 y 8-9).',
    'Sur (días 2-3): Bónus y Krónan en Selfoss; Krónan en Vík; súper pequeño en Kirkjubæjarklaustur.',
    'Sureste (día 4): Bónus y Nettó en Höfn.',
    'Este (día 4-5): Bónus y Krónan en Egilsstaðir — última compra grande antes del norte.',
    'Norte (días 5-6): Bónus, Krónan y Nettó en Akureyri; en Mývatn solo una tienda pequeña y cara (Samkaup en Reykjahlíð).',
    'Oeste (día 7): Bónus y Nettó en Borgarnes de vuelta a Reikiavik.'
  ],
  cierre: 'Regla general: el súper cierra pronto y más pronto aún en pueblo y domingos. Compra por la mañana o a mediodía, nunca cuentes con reponer de noche. Fuera de horario solo quedan las tiendas de gasolinera (N1, Olís), el triple de caras.'
};

const AHORRO = [
  { ico: '🛒', tint: '75', cat: 'Trucos para un país caro', items: [
    'Alcohol: compra en el Duty Free de Keflavík nada más aterrizar (hay límite de importación, ~1 L de licor + 0,75 L de vino + 3 L de cerveza, o combinaciones). Fuera de ahí, solo en Vínbúðin (estatal, caro, cierra ~18:00 y no abre domingos). En el bar se paga por copa.',
    'Cocina: reserva alojamientos con cocina y desayuna del súper, no del hotel (un desayuno de hotel ronda 2.500–3.500 ISK/persona).',
    'Comida caliente barata: pylsa (perrito, ~500 ISK) en cualquier gasolinera o en Bæjarins Beztu (Reikiavik); sopa de cordero con pan y relleno gratis; comida para llevar del mostrador caliente de Krónan/Bónus grandes; panaderías (kleinur, snúður).',
    'Gasolina: instala la app de N1, Olís, ÓB u Orkan para el descuento por litro; la de Costco (Reikiavik) suele ser la más barata. Paga siempre con tarjeta con PIN (muchas son automáticas y sin personal).',
    'Tax-free: en compras de más de 6.000 ISK en una misma tienda, pide el formulario allí mismo; sello y reembolso en el aeropuerto (mostrador/kiosco antes de facturar).',
    'Piscinas municipales (~1.000–1.300 ISK) con jacuzzis geotermales en casi todos los pueblos: la alternativa local y barata a los spa de pago.',
    'Propinas: no se dejan, el servicio va incluido en el precio. Redondear es opcional y raro.',
    'Datos móviles: una eSIM o SIM local (Nova, Síminn) suele salir mejor que el roaming; hay wifi en casi todos los alojamientos y gasolineras.',
    'Aparcamiento en Reikiavik: zonas de pago P1–P4 entre semana (app «Parka» o «EasyPark»); gratis por la noche y, según la zona, los domingos. Fuera del centro es gratis.',
    'Free walking tours por Reikiavik (CityWalk): sin precio fijo, propina voluntaria al final.'
  ]}
];
```

*(El texto exacto se ajusta al escribir el plan; lo anterior es el contenido
aprobado, con cifras redondeadas y siempre remitiendo a la fuente oficial.)*

### 4.2 Render (`renderMercados(body)` en `app.js`, junto a `renderEmergencias`)

- Una `<section class="reco-cat">` con badge `🛒` y `<h3>Supermercados baratos: Bónus y Krónan</h3>`:
  - `<p class="emerg-intro">` con `MERCADOS.intro`.
  - `.reco-cat__list` con `.reco-card` para: **Bónus — horario**, **Krónan — horario**,
    cada línea de `MERCADOS.enRuta`, y **`MERCADOS.cierre`** (destacado como último card).
  - Cada card: `<b>Etiqueta.</b> texto` con `esc()` en las partes variables.
- Bloque de ahorro: reutiliza el mismo bucle que `RECOS` (`AHORRO` tiene la misma
  forma `{ico,tint,cat,items}`), una `.reco-cat` con badge `🛒`.

### 4.3 Integración

- En `renderReco()`, tras `body.appendChild(mine);` y **antes** de
  `renderEmergencias(body);`, llamar `renderMercados(body);`.
- Orden final de Ideas: RECOS semilla → «Tus recomendaciones» (CRUD) →
  **Supermercados** → **Trucos de país caro** → Teléfonos importantes.
- `README.md`: una frase.
- Release: `?v=17 → ?v=18` en `index.html` (css + js) y `SHELL_ASSETS` de `sw.js`;
  `sw.js` `shell-v17 → shell-v18`. `tiles-v2` sin cambios. Precache **28** (sin
  assets nuevos).

## 5. Casos borde

- **`esc()` en todo el texto variable** aunque sea semilla (coherencia con el
  resto de `renderReco`/`renderEmergencias`).
- Sin dependencia de `state`: `renderMercados` solo lee constantes; funciona igual
  con estado vacío o corrupto.
- Sin enlaces `href` (los nombres de dominio bonus.is/kronan.is van como texto,
  no como `<a>`), así que no hay superficie de `target=_blank` ni de URL.

## 6. Pruebas manuales

1. Ideas → tras «Tus recomendaciones» aparecen «Supermercados baratos: Bónus y Krónan» y «Trucos para un país caro», y después «Teléfonos importantes».
2. El bloque de supermercados muestra: intro, card de horario de Bónus, card de Krónan, 6 cards de «en ruta» y el card de «cierra pronto».
3. El bloque de ahorro muestra los 10 trucos como `.reco-card`.
4. Ningún estilo roto: mismos márgenes/tarjetas que los bloques `RECOS` de arriba.
5. Consola limpia; el resto de Ideas (RECOS, CRUD de recomendaciones, teléfonos con `tel:`) sigue igual.
6. `shell-v18` con 28 entradas; `shell-v17` eliminado; `tiles-v2` intacta.
7. `node --check app.js` OK.
