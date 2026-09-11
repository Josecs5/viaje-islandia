# Experiencia · E1 — Piscinas y pozas termales

Fecha: 2026-09-11 · Estado: aprobado (modo autónomo, sin gate)

## 1. Contexto

A5 (Clima) ya menciona piscinas sueltas dentro de `PLAN_B.zonas` como planes de
interior para días malos, en prosa por zona. Falta un bloque dedicado en Ideas
con **más detalle por sitio** (precio orientativo, tipo, qué lo hace especial)
y, a diferencia de los bloques estáticos anteriores (Carreteras, Gasolineras),
con un **buscador** para filtrar por nombre/zona/tipo, más una explicación de
las **normas de ducha/etiqueta** (obligatorias en todas las piscinas
islandesas, se aplican sanciones sociales si no se respetan).

## 2. Objetivo

Nuevo bloque «Piscinas y pozas termales» en Ideas, entre «Gasolineras y
autonomía» (B2) y «Plan B para días de lluvia o viento» (A5) — encaja bien ahí
porque el Plan B ya remite a piscinas por zona y este bloque da el detalle.

1. **Intro de etiqueta**: ducha obligatoria sin bañador antes de entrar (hay
   duchas separadas por sexo, es la norma más chocante para turistas), no
   entrar con zapatos a la zona de duchas/piscina, algunos sitios tienen
   personal que lo comprueba.
2. **Lista curada** de piscinas/pozas de este itinerario (una por cada pueblo
   ya usado en B2/A4: Reikiavik, Selfoss/Hveragerði, Vík,
   Kirkjubæjarklaustur, Höfn, Egilsstaðir, Mývatn, Akureyri, Varmahlíð/
   Blönduós, Borgarnes/Snæfellsnes), cada una con: nombre, zona, tipo
   (piscina municipal / laguna geotermal / poza natural), nota corta (precio
   orientativo en ISK, qué la hace especial o alguna condición práctica).
3. **Buscador**: campo de texto que filtra la lista en vivo por nombre, zona,
   tipo o nota (substring, case/acento-insensible). Sin re-renderizar todo el
   bloque en cada tecla — solo oculta/muestra cards ya construidas, para no
   arriesgar perder el foco del campo (mismo riesgo que ya se dio en D2 y se
   evita aquí por diseño, no por el mecanismo `commit()` de itinFuelBlock que
   no aplica a un simple filtro).

## 3. No-objetivos

- Sin geolocalización, sin enlaces a reservas (Sky Lagoon/Krauma se pueden
  llenar y conviene reservar, pero eso es un enlace externo opcional, no un
  flujo de reserva).
- Sin integrar con el itinerario (no comprueba qué día pasas por cada zona;
  es una guía de referencia igual que Carreteras/Gasolineras, consultada
  manualmente).
- Sin `state` nuevo, sin persistencia — el buscador es solo estado de UI
  efímero (valor del `<input>`), se resetea si se re-renderiza Ideas.
- Sin cambio de release: no hay assets nuevos, así que no hace falta bump de
  `shell-vN`/`?v=`.

## 4. Datos

`const PISCINAS = { intro: str, items: [{ n, zona, tipo, nota }] }`

Zonas = mismos nombres cortos que ya usa `PLAN_B.zonas[].z` (Reikiavik y
alrededores, Sur, Sureste, Este, Norte, Oeste) para que el vocabulario sea
consistente en toda la app.

~16 entradas, cubriendo los pueblos de la ruta. Ejemplos de forma (no
exhaustivo, se completa en el plan/implementación):
```js
{ n: 'Laugardalslaug', zona: 'Reikiavik y alrededores', tipo: 'Piscina municipal', nota: '~1.400 ISK. La más grande de Reikiavik: toboganes, jacuzzis a distintas temperaturas, sauna.' },
{ n: 'Sky Lagoon', zona: 'Reikiavik y alrededores', tipo: 'Laguna geotermal', nota: '~12.000 ISK. Infinity pool con vistas al mar; conviene reservar con antelación online.' },
{ n: 'Reykjadalur', zona: 'Sur (Selfoss–Vík)', tipo: 'Poza natural', nota: 'Gratis. Caminata de ~45 min desde Hveragerði hasta un río templado; sin duchas ni vestuario, llévate lo puesto.' }
```

## 5. Render — `renderPiscinas(body)`, junto a `renderGasolineras`

Estructura similar a los bloques existentes (`reco-cat`, `reco-cat__head`,
`reco-cat__badge`, `<h3>`) pero con:
- Un `<input type="text" class="piscinas-search" placeholder="Buscar por nombre, zona o tipo…">`
  antes de la lista.
- Cada card lleva `data-search="nombre zona tipo nota"` (todo en minúsculas,
  sin acentos vía una función `norm(s)` reutilizable — normaliza con
  `.normalize('NFD').replace(/[̀-ͯ]/g,'')` para que "reikiavik"
  encuentre "Reikiavik" y "reykjavik" indistintamente).
- Un listener `input` en el campo: por cada card, `card.hidden =
  !card.dataset.search.includes(norm(valor))`. Si no hay ninguna visible,
  mostrar un `<p class="reco-empty">` de "sin resultados" (toggle de un nodo
  ya presente, no recreado).

Badge: 🛁. Llamada en `renderReco()`:
```js
    renderGasolineras(body);
    renderPiscinas(body);
    renderPlanB(body);
```

## 6. CSS

Reutiliza `.reco-card`/`.reco-cat` existentes. Nuevo: `.piscinas-search`
(input full-width, mismo estilo que los `<input>` de formularios ya
existentes en `style.css` — reutilizar la clase de campo si existe una
genérica, si no un estilo mínimo coherente) y `.reco-empty` (ya existe, se
reutiliza).

## 7. Verificación

1. `node --check app.js`.
2. Navegador, Ideas: bloque «Piscinas y pozas termales» aparece entre
   Gasolineras y Plan B; ~16 cards + intro.
3. Escribir "sur" en el buscador → solo quedan visibles las de zona "Sur";
   borrar → todas vuelven; escribir algo sin resultados ("xyz") → aparece
   "sin resultados", sin cards.
4. Escribir con/sin acento ("reykjavik" y "reikiavik") → mismo resultado.
5. El campo no pierde el foco mientras se escribe (es un filtro in-place, no
   hay re-render).
6. Barrido de las 5 pantallas → consola sin errores.

## 8. Riesgo

Lógica nueva pero acotada (normalización de texto + filtro por substring, sin
tocar `state` ni otros módulos). Revisión final: autorrevisión inline
(mismo criterio que B2 Task 2/D3/B3) — el único riesgo real es la
normalización de acentos, fácil de verificar a mano.
