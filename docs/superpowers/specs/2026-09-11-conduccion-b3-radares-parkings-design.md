# Conducción · B3 — Radares y parkings de pago

Fecha: 2026-09-11 · Estado: aprobado (modo autónomo, sin gate)

## 1. Contexto

El 3er bullet del usuario para sub-proyecto B pedía: "Avisos de puentes de un
solo carril, radares, tramos de grava, túnel de peaje de Hvalfjörður, parkings
de pago". A4 ya cubre puentes de un carril, tramos de grava y el túnel de
Hvalfjörður (gratis desde 2018) dentro del bloque `CARRETERAS` en Ideas.
Quedan dos puntos sueltos: **radares** y **parkings de pago**.

## 2. Objetivo

Añadir dos items informativos al bloque `CARRETERAS` ya existente en Ideas
(`renderCarreteras`, entre «Carreteras: antes de conducir»), sin crear un
bloque nuevo:

1. **Radares**: dónde son más habituales (cámaras fijas de velocidad media en
   túneles, radares fijos en la Ruta 1, controles móviles de policía) y el
   límite práctico a respetar (90 asfalto / 80 grava / 50 núcleos urbanos).
2. **Parkings de pago**: los principales puntos del viaje con parking de pago
   (cráteres/cascadas turísticas concretas, centro de Reikiavik) y cómo se
   paga (app tipo Parka/EasyPark, máquina o QR in situ) — sin repetir el
   consejo de tarjeta/PIN que ya está en D3.

## 3. No-objetivos

- Sin mapa ni lista de coordenadas de radares (no hay fuente fiable/estable
  para geolocalizarlos con precisión; es contenido informativo, no un feature
  interactivo como B2).
- Sin lista exhaustiva de cada parking de pago del país — solo los que
  afectan a este itinerario/tipo de ruta (Círculo Dorado, cascadas del sur,
  Reikiavik).
- No toca `state`, no añade getters, no cambia el release (`shell-v24` se
  mantiene — sin assets nuevos).

## 4. Cambios

En `app.js`, dentro de `CARRETERAS.items` (el array de bullets que ya
renderiza `renderCarreteras`), añadir dos entradas nuevas al final:

```js
'Radares: velocidad media en algunos túneles (incluido Vaðlaheiði) y radares fijos en tramos rectos de la Ruta 1; también controles móviles de policía. Límites: 90 km/h asfalto, 80 km/h grava, 50 km/h en núcleos urbanos — se aplican con poco margen.',
'Parkings de pago: cráteres y cascadas muy visitadas (Kerið, Seljalandsfoss, Skógafoss) y el centro de Reikiavik cobran aparcamiento — con app (Parka, EasyPark), máquina o QR en el propio parking. Llévalo en cuenta al planear paradas cortas.'
```

Sin cambios de render (`renderCarreteras` ya mapea `CARRETERAS.items` a
cards), sin cambios de CSS, sin cambios de estado, sin release nuevo.

## 5. Verificación

1. `node --check app.js`.
2. Navegador, Ideas → «Carreteras: antes de conducir»: aparecen los dos
   nuevos cards de "Radares" y "Parkings de pago" tras los ya existentes y
   antes de los enlaces; caracteres bien, sin HTML literal.
3. Barrido de las 5 pantallas → consola sin errores de la app.

## 6. Riesgo

Contenido estático puro (ningún cambio de lógica/estado/getters). Revisión
final: autorrevisión inline, sin subagente — mismo criterio que D3 y B2
Task 2.
