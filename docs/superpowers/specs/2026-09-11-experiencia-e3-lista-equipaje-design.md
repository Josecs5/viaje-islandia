# Experiencia · E3 — Lista de equipaje

Fecha: 2026-09-11 · Estado: aprobado (modo autónomo, sin gate)

## 1. Contexto

Primer feature de Experiencia con **estado persistente propio** (E1/E2 eran
contenido de referencia sin `state`). El objetivo es una checklist de
equipaje: una lista curada para este viaje concreto (Islandia, octubre,
coche de alquiler) que el usuario pueda marcar como empacado, añadir sus
propios ítems y borrar los que no le hagan falta.

## 2. Objetivo

Nuevo bloque **«🎒 Equipaje»** en la pantalla **Datos** (no en Ideas: es
trabajo personal del usuario — como Gastos —, no contenido de referencia
como Carreteras/Gasolineras/Piscinas/Temporada), con el mismo estilo visual
colapsable (`.group`/`.group__head`/`.group__body`) que el resto de grupos
de Datos, pero con su propio render (no encaja en el sistema genérico
`SCHEMAS`/`openSheet`, pensado para fichas con formulario, no para un
checklist de tap-to-marcar).

1. **Lista curada de ~28 ítems** agrupados por categoría (ropa, calzado,
   accesorios de frío, documentos y dinero, electrónica, botiquín y aseo,
   coche y carretera), específica de un viaje en coche por Islandia en
   octubre — no una lista de equipaje genérica.
2. **Marcar/desmarcar** cada ítem como empacado (checkbox), con contador
   «empacados/total» en la cabecera del grupo.
3. **Añadir** ítems propios (categoría «Otros»).
4. **Eliminar** cualquier ítem (curado o propio), con confirmación.

## 3. No-objetivos

- Sin categorías editables por el usuario ni reordenar — la categoría de un
  ítem añadido a mano es siempre «Otros».
- Sin sincronizar con el número de personas del viaje ni con la maleta de
  cada uno — es una lista única y compartida, igual de simple que el resto
  del `state` de este proyecto (pensado para un usuario, no multi-perfil).
- Sin repetir consejos ya dados en otros bloques (tarjeta con PIN ya en D3 y
  GASINFO; solo se lista como *ítem a llevar*, sin repetir la explicación).
- Sin cambio de release (sin assets nuevos).

## 4. Datos — decisión de diseño sobre la semilla

`state.equipaje = [{ id, texto, cat, packed }]`. `blankState()` gana
`equipaje: []`.

**Regla de semilla, distinta a la de `gastos`/`comidas` (que nacen vacíos a
propósito)**: como esta es una función nueva que se añade a una app que
**ya tiene usuarios con datos reales guardados** (localStorage con vuelos/
alojamientos ya configurados), hace falta rellenar la lista curada una sola
vez también para esos usuarios existentes, no solo para un `localStorage`
totalmente vacío. Se distingue "el campo nunca ha existido" (`p.equipaje ===
undefined` → sembrar `EQUIPAJE_SEED`) de "el usuario ya lo tiene y lo ha
vaciado a propósito" (`p.equipaje` es `[]` pero **existe** → respetarlo tal
cual). Con `p.equipaje || []` (el patrón de `gastos`) esta distinción se
pierde y un usuario real nunca vería la lista curada por defecto — regresión
de valor real, así que se justifica la excepción.

`seedState()` (usuario 100% nuevo, sin `localStorage` en absoluto) también
debe fijar `s.equipaje = EQUIPAJE_SEED` explícitamente, porque ese camino de
`load()` no pasa por la comprobación de `p.equipaje` (no hay `p`).

`EQUIPAJE_SEED` (ids `seed-eq-N`, aunque el prefijo `seed-` no se usa aquí
para ocultar edición como en otras colecciones — todo ítem de equipaje es
editable/borrable por igual): ~28 entradas repartidas en las categorías de
§2.1.

## 5. Render — `equipajeBlock()`, llamado en `renderDatos()`

Reutiliza las clases `.group`/`.group__head`/`.group__body`/`.count`/`.chev`
ya existentes (mismo aspecto que los demás grupos de Datos) con contenido
propio: ítems agrupados por categoría (`<p class="equipaje-cat">` +
`<div class="equipaje-list">` de filas `<label class="equipaje-row">`
checkbox + texto + botón eliminar), y un `<form class="equipaje-add">` al
final (input + botón «+ Añadir»).

- Marcar/desmarcar: `it.packed = !it.packed; save(); renderDatos();` — sin
  necesidad de preservar foco (no hay campo de texto implicado, es un tap).
- Eliminar: confirmación vía `confirmAsk()` (mismo patrón que `removeItem`),
  luego `splice` + `save()` + `renderDatos()`.
- Añadir: `submit` del formulario (no por tecla, así que no hay riesgo de
  perder foco en cada pulsación); ítem nuevo con `cat:'Otros'`.
- Solo `renderDatos()`, no `renderAll()` — equipaje no afecta a Itinerario/
  Mapas/Ideas/Clima, así que no hace falta re-renderizar toda la app en
  cada tap (mismo criterio que el panel de combustible de D2, que solo
  re-renderiza Itinerario).

## 6. CSS

Nuevo: `.equipaje-cat` (encabezado de categoría, pequeño y en mayúsculas
suaves), `.equipaje-list` (columna), `.equipaje-row` (fila: checkbox +
texto + botón eliminar; `--done` atenúa y tacha el texto), `.equipaje-add`
(fila input + botón). Reutiliza `.icon-btn`/`.icon-btn--danger`/`.btn--ghost`
ya existentes para los botones.

## 7. Verificación

1. `node --check app.js`.
2. Navegador, Datos: bloque «🎒 Equipaje» tras los grupos existentes;
   contador «0/28» al principio (con localStorage limpio, primera carga).
3. Marcar 3 ítems → contador «3/28», texto tachado/atenuado en esos 3;
   desmarcar uno → «2/28».
4. Añadir «Repelente de mosquitos» → aparece bajo «Otros», contador pasa a
   «2/29».
5. Eliminar un ítem → pide confirmación; al confirmar, desaparece y el
   contador baja.
6. Recargar la página (con SW/caché limpios pero **sin** limpiar
   localStorage) → el estado marcado/añadido/eliminado persiste.
7. Simular un usuario "ya existente" (localStorage con `equipaje` ausente
   del todo, resto de campos presentes) → tras cargar, `state.equipaje`
   queda con los 28 ítems sembrados, no vacío.
8. Barrido de las 5 pantallas → consola sin errores.

## 8. Riesgo

Estado nuevo + CRUD simple (sin campos estructurados, sin sheet). La única
lógica no trivial es la regla de semilla del §4 (documentada explícitamente
como excepción al patrón `gastos`/`comidas`, con la razón). Autorrevisión
inline — no hay heurística geométrica ni cálculo numérico como en B2, así
que no amerita subagente.
