# Experiencia · E4 — Diario de viaje

Fecha: 2026-09-11 · Estado: aprobado (modo autónomo, sin gate)

## 1. Contexto

Último punto del backlog de Experiencia (E1 piscinas, E2 temporada, E3
equipaje, ya cerrados). El usuario, al preguntársele explícitamente cómo
guardar las fotos, eligió **texto por ahora, fotos más adelante como mejora
aparte** — evita el riesgo de que unas pocas fotos en base64 llenen la cuota
de `localStorage` (~5-10 MB) que comparte con TODO el estado de la app
(vuelos, alojamientos, gastos...) y rompan el guardado de golpe. Guardar
fotos de verdad requeriría IndexedDB, que es un cambio de almacenamiento
nuevo en esta app (hoy todo vive en un único blob de `localStorage`) — se
deja fuera de este alcance, a valorar en un futuro E4-bis si se quiere.

## 2. Objetivo

Una entrada de texto libre por día del viaje, integrada en cada tarjeta de
día de **Itinerario** (no una pantalla nueva ni una pestaña nueva — el
diario tiene sentido justo donde ya se ve el plan de ese día).

- Un `<textarea>` al final de cada tarjeta de día (tras las fotos y, si el
  día tiene actividades, tras el resto del contenido del día — la última
  pieza, a modo de cierre/reflexión).
- Autoguardado según se escribe (sin botón «Guardar»), igual que el resto
  de campos sueltos de la app (p. ej. el tipo de cambio de D1).
- Funciona también en días sin actividades planificadas («Día libre»), de
  hecho es donde más sentido tiene escribir un diario.

## 3. No-objetivos

- **Sin fotos** (ver §1 — decisión explícita del usuario, alcance para
  después).
- Sin editor de texto enriquecido — texto plano.
- Sin exportar/compartir el diario — ya existe "exportar resumen" en Mapas
  para el itinerario en sí; el diario no se añade ahí en este alcance.
- Sin cambio de release (sin assets nuevos).

## 4. Datos y foco

`state.diario = { 'YYYY-MM-DD': 'texto libre' }` — objeto plano, clave =
`day.date` (ya único por `buildItinerario()`). `blankState()` gana
`diario: {}`; `load()`: `diario: p.diario || {}` (sin regla especial de
semilla, a diferencia de `equipaje` — un diario vacío por defecto es
correcto, no hace falta contenido curado).

**Por qué no hace falta ningún mecanismo de foco tipo `commit()`/D2**: el
textarea del diario no re-renderiza nada al escribir — su handler `input`
solo actualiza `state.diario[date]` y llama a `save()` (debounced), sin
llamar a `renderItinerario()`. Nada más en la tarjeta del día depende de ese
texto, así que no hay ninguna razón para re-pintar tras cada pulsación (a
diferencia de la autonomía de D2, que sí necesita recalcularse y
re-mostrarse). El único riesgo de foco viene de fuera: el refresco de meteo
en segundo plano llama a `renderItinerario()` periódicamente, pero ya existe
un guard en ese punto (`app.js` ~3475: si el foco está dentro de
`#itin-body`, se salta el re-render) — como el textarea vive dentro de
`#itin-body`, queda cubierto sin cambios adicionales.

## 5. Render — `diarioBlock(day)`, en `dayBlock`

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

Se llama justo antes de cada `return wrap;` de `dayBlock` (los dos caminos:
día sin actividades y día con actividades), para que quede siempre como
última pieza de la tarjeta.

## 6. CSS

`.day-diario` (margen superior), `.day-diario__label` (etiqueta pequeña,
mismo estilo que `.equipaje-cat`), `.day-diario__text` hereda el `textarea`
base ya existente (min-height 76px, resize vertical) — sin estilos nuevos
más allá del wrapper.

## 7. Verificación

1. `node --check app.js`.
2. Navegador, Itinerario: cada tarjeta de día (con y sin actividades)
   termina con «📝 Diario del día» + textarea vacío.
3. Escribir en el de un día → sin recargar, cambiar a otra pantalla y
   volver a Itinerario → el texto sigue ahí.
4. Recargar la página (navegación real) → el texto persiste
   (`state.diario` en `localStorage`).
5. Borrar todo el texto de una entrada → la clave desaparece de
   `state.diario` (no queda `''` colgando).
6. Mientras se escribe, forzar un `renderItinerario()` externo (simulado) →
   el textarea no pierde el foco ni el texto no guardado se sobreescribe
   (cubierto por el guard de foco ya existente).
7. Barrido de las 5 pantallas → consola sin errores.

## 8. Riesgo

Bajo: un objeto plano nuevo en `state`, sin CRUD complejo, sin re-render en
cada tecla. El único punto a verificar con cuidado es que el guard de foco
existente (pensado originalmente para el panel de combustible D2) cubre
también este textarea — verificado en §7.6. Autorrevisión inline, sin
subagente.
