# Itinerario — Vista "Hoy"

Fecha: 2026-09-11 · Estado: aprobado (brainstorming en chat, 2 preguntas al usuario)

## 1. Contexto

Para saber "qué toca hoy" hay que mirar Itinerario (plan del día), Clima
(auroras de esta noche) y a veces Mapas por separado. No hay un flujo
existente que reutilizar tal cual — a diferencia de Equipaje/Antes de
viajar, que clonaban un patrón ya construido — así que esto se trató como
arquitectónico: dos preguntas al usuario decidieron la ubicación y el
comportamiento fuera de fechas antes de diseñar el resto.

**Decisiones ya tomadas (brainstorming en chat):**
1. La tarjeta vive arriba de **Itinerario** (antes del panel de
   combustible), no como pestaña nueva ni sustituyendo "Datos".
2. Si hoy no cae dentro del viaje, la tarjeta **no se muestra** — nada de
   cuenta atrás ni estado alternativo.

## 2. Objetivo

Una tarjeta condensada, lo primero que se ve al entrar en Itinerario
durante el viaje, con:
1. Fecha de hoy + número de día (p. ej. "sábado, 10 de octubre (Día 3)").
2. El mismo veredicto/badge de viabilidad que ya usa la tarjeta de cada
   día (B1: `dayPlan`), origen→destino aproximado y km.
3. Hora de salida recomendada + horas al volante, si aplica.
4. Aviso de viento (A3), solo si `windFor` devuelve algo (ya solo ocurre
   con ráfagas ≥ 45 km/h).
5. Aviso de exteriores (A5), solo si el día pinta mal (`outdoorFor`, mismo
   criterio `level !== 'bueno'` que ya usa `dayBlock`).
6. Previsión de auroras de esta noche (A2) — la única pieza que hoy no
   existe fuera de la pestaña Clima. Se muestra siempre que la función
   devuelva texto, incluido "sin datos" (informa igual que decir nada).

Deliberadamente **no** se repiten gasolineras ni coste de combustible: ya
están en la tarjeta del propio día de hoy, un scroll más abajo en la misma
pantalla.

## 3. No-objetivos

- Sin pestaña nueva, sin cambiar la pantalla con la que abre la app.
- Sin cuenta atrás antes del viaje ni estado "ya de vuelta" — fuera del
  rango de fechas, la tarjeta simplemente no aparece.
- Sin `state` nuevo, sin cambio de release (sin assets nuevos).
- No sustituye ni modifica la tarjeta de día normal que ya pinta
  `dayBlock` para hoy — la tarjeta "Hoy" es un añadido antes, el día
  sigue apareciendo también en su sitio en la lista de abajo (con o sin
  filtro de chip de día).

## 4. Diseño técnico

`hoyBlock(it)`, llamada como lo primero en `renderItinerario()` (antes de
`itinFuelBlock(it)`), reutilizando el mismo `it` ya calculado por
`buildItinerary()` en esa misma función — no se recomputa nada.

```js
function hoyBlock(it) {
  const hoy = diaHoyYMD();      // null si hoy no está en el viaje
  if (!hoy) return null;
  const day = it.days.find(d => d.date === hoy);
  if (!day) return null;

  const plan = dayPlan(day);
  const w = windFor(day);
  const od = outdoorFor(day);
  const aur = auroraFor(sky(hoy));

  const box = el('section', 'hoy-card');
  const head = el('p', 'hoy-card__head');
  head.innerHTML = `📍 <b>Hoy</b> · ${esc(cap(fmtDiaSemana(hoy)))}, ${esc(fmtFecha(hoy))} (Día ${day.idx})`;
  box.appendChild(head);

  if (plan.veredicto) {
    const label = verdictLabel(plan);
    const bits = [];
    if (plan.salirMin != null && plan.salirMin >= plan.inicioMin - 120) {
      bits.push('Sal sobre las <span class="mono">' + hhmmFromMin(plan.salirMin) + '</span>');
    }
    if (plan.drivingMin > 0 && plan.volante === 'ok') bits.push(fmtDur(plan.drivingMin) + ' al volante');
    const kmTxt = day.km >= 1 ? ' · ' + Math.round(day.km) + ' km' : '';
    const p = el('p', 'hoy-card__plan');
    p.innerHTML = `<span class="day-verdict day-verdict--${plan.veredicto}">${esc(label)}</span>${kmTxt}` +
      (bits.length ? '<br>' + bits.join(' · ') : '');
    box.appendChild(p);
  }

  if (w) {
    const pw = el('p', 'hoy-card__wind' + (w.level === 'fuerte' ? ' hoy-card__wind--fuerte' : ''));
    pw.innerHTML = `💨 ${esc(w.txt)}`;
    box.appendChild(pw);
  }
  if (od && od.level !== 'bueno') {
    const po = el('p', 'hoy-card__out');
    po.innerHTML = `${od.level === 'malo' ? '🌧️' : '⛅'} ${esc(od.txt)}`;
    box.appendChild(po);
  }
  const pa = el('p', 'hoy-card__aurora');
  pa.innerHTML = `🌌 ${esc(aur.txt)}`;
  box.appendChild(pa);

  return box;
}
```

En `renderItinerario()`, justo tras construir `it` y antes de
`body.appendChild(itinFuelBlock(it));`:
```js
const hb = hoyBlock(it);
if (hb) body.appendChild(hb);
```

`hoyBlock` devuelve `null` cuando no hay "hoy" que mostrar (mismo patrón
ya usado en `dayBlock`/`recsBlock`, que también devuelven algo condicional
comprobado con `if` antes de `appendChild`), así que fuera del rango de
fechas del viaje no se añade ningún nodo — Itinerario queda exactamente
igual que antes de este cambio.

Reutiliza sin cambios: `diaHoyYMD`, `dayPlan`, `verdictLabel`, `windFor`,
`outdoorFor`, `auroraFor`, `sky`, `hhmmFromMin`, `fmtDur`, `fmtDiaSemana`,
`fmtFecha`, `cap`, `esc`, `el`. Ninguna de estas funciones se modifica.

## 5. CSS

Nueva clase `.hoy-card` (tarjeta destacada, borde de acento para
diferenciarla visualmente de las tarjetas de día normales) y
`.hoy-card__*` para cada línea, reutilizando `.day-verdict--*` ya existente
para el badge de viabilidad.

## 6. Verificación

1. `node --check app.js`.
2. Navegador, con la fecha del sistema dentro del rango del viaje (o
   simulando `diaHoyYMD()`): la tarjeta aparece arriba de todo en
   Itinerario, antes del panel de combustible.
3. Contenido de la tarjeta coincide con el de la tarjeta de día normal
   para esa misma fecha (mismo veredicto, mismo viento, mismo exteriores).
4. Auroras: aparece la misma previsión que en la tarjeta correspondiente
   de Clima para esa noche.
5. Con la fecha del sistema fuera del rango del viaje: la tarjeta no
   aparece, Itinerario se ve igual que antes de este cambio.
6. Día de hoy sin actividades (`día libre`): la tarjeta se pinta sin la
   línea de plan/veredicto, el resto (viento/exteriores/auroras) sigue
   apareciendo si hay dato.
7. Barrido de las 5 pantallas → consola sin errores.

## 7. Riesgo

Bajo: reutiliza funciones ya verificadas extensamente esta sesión
(`dayPlan` en B1, `windFor` en A3, `outdoorFor` en A5, `auroraFor` en A2),
sin lógica nueva más allá de ensamblar sus resultados en una tarjeta.
Autorrevisión inline, sin subagente.
