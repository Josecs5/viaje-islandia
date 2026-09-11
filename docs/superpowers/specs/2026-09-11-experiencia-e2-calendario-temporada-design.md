# Experiencia · E2 — Calendario de temporada

Fecha: 2026-09-11 · Estado: aprobado (modo autónomo, sin gate)

## 1. Contexto

El viaje es fijo: 8–16 oct 2026. Varias features ya cubren temporada de forma
*condicional/por-día* (A2 auroras, A4 F-roads cerradas, A5 clima). Falta un
bloque de referencia que responda, de un vistazo, "¿qué tiene sentido hacer
en estas fechas y qué no, aunque el tiempo acompañe?" — cosas que no dependen
del parte meteorológico sino del calendario anual: fauna, apertura de cuevas
de hielo, rutas de senderismo de montaña, ferris.

## 2. Objetivo

Bloque «Calendario de temporada: octubre» en Ideas, junto a los demás
bloques de referencia. Contenido = hechos **estructurales de la época del
año** (no repite lo que ya avisan A2/A4/A5 día a día):

- **Frailecillos (puffins)**: se han ido — temporada mayo-agosto, en octubre
  no hay.
- **Avistamiento de ballenas**: activo todo el año desde Reikiavik; otoño es
  buena época, menos turistas que en verano.
- **Cuevas de hielo azules**: NO empiezan hasta noviembre (dependen de que
  el hielo se estabilice); si algo se anuncia en octubre, es cueva de lava,
  no de hielo glaciar.
- **Rutas de montaña / refugios de tierras altas** (Laugavegur, Fimmvörðuháls,
  Landmannalaugar): cierran a mediados de septiembre; en octubre ya no hay
  buses de tierras altas ni refugios con servicio.
- **F-roads**: referencia cruzada breve a A4 (ya cubierto en detalle ahí, no
  repetir la lista completa).
- **Auroras**: referencia cruzada breve a la pestaña Clima (A2), sin repetir
  el mecanismo de predicción.
- **Ferri a Vestmannaeyjar (Islas Westman)**: sigue en marcha pero con
  horario reducido de temporada baja — confirmar el mismo día si hay viento
  fuerte, cancela con facilidad.
- **Horas de luz**: referencia cruzada a A1 (Clima), sin repetir cifras
  (varían día a día dentro del propio viaje).

## 3. No-objetivos

- Sin fechas de festivales/eventos puntuales de 2026 (no verificables de
  forma fiable, y cambian de año en año) — solo temporadas estructurales
  estables (fauna, apertura de cuevas de hielo, cierre de tierras altas).
- Sin repetir contenido ya cubierto en detalle por A2/A4/A5 — solo
  referencia cruzada de una frase cuando aplica.
- Sin `state` nuevo, sin interacción — bloque estático, mismo patrón que
  Carreteras/Gasolineras (no como Piscinas, que sí lleva buscador; aquí no
  hace falta por ser una lista corta).
- Sin cambio de release (sin assets nuevos).

## 4. Datos y render

`const TEMPORADA = { intro: str, items: [str] }` — mismo patrón exacto que
`CARRETERAS`/`GASINFO` (array de bullets en prosa, sin campos estructurados,
porque no hay necesidad de buscador/filtrado aquí).

`renderTemporada(body)` — mismo patrón que `renderGasolineras`/
`renderCarreteras`. Badge: 🍂. Se coloca junto a los otros bloques de
referencia, después de «Piscinas y pozas termales» y antes de «Plan B para
días de lluvia o viento» (Plan B ya asume que sabes qué actividades de
temporada están disponibles, así que este bloque informativo va justo antes).

```js
    renderPiscinas(body);
    renderTemporada(body);
    renderPlanB(body);
```

## 5. Verificación

1. `node --check app.js`.
2. Navegador, Ideas: «Calendario de temporada: octubre» entre Piscinas y
   Plan B; intro + 8 cards; sin HTML literal, caracteres bien.
3. Barrido de las 5 pantallas → consola sin errores de la app.

## 6. Riesgo

Contenido estático puro, sin lógica nueva. Autorrevisión inline, sin
subagente — mismo criterio que Carreteras/Gasolineras/B3.
