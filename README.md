# Viaje a Islandia — Planificador

PWA con modo offline para planificar un viaje por carretera por Islandia:
vuelos con escalas, coche de alquiler, alojamientos, excursiones, sitios para
comer y lugares que ver. Genera un **itinerario diario** automático con horas y
tiempos de trayecto estimados, muestra el **recorrido de cada día en un mapa**
(Leaflet + OpenStreetMap) y permite **exportar el resumen** como texto.

Todo se guarda en `localStorage` del navegador: los datos no salen del dispositivo.

## Uso

Abre `index.html` servido por HTTP(S) (no vale `file://`):

```bash
python -m http.server 8000
# luego abre http://localhost:8000
```

Para instalarla como app en el iPhone: ábrela en Safari → Compartir →
**Añadir a pantalla de inicio**. Se abre en modo standalone.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura y meta tags PWA/iOS |
| `style.css` | Tema oscuro, tokens OKLCH, responsive (autónomo) |
| `app.js` | Lógica: CRUD, motor de itinerario, mapas, exportación |
| `sw.js` | Service worker: precache del shell y caché de tiles |
| `vendor/` | Leaflet 1.9.4 y fuentes web servidos desde el repo |
| `manifest.json` | Manifiesto PWA |
| `icons/` | Iconos 192 / 512 / maskable + apple-touch-icon + SVG |
| `tokens.css` | Sistema de diseño portable (no lo usa la app; solo referencia) |

Solo HTML, CSS y JavaScript. Sin frameworks. Service worker para uso sin
conexión; Leaflet y las fuentes van incluidos en el repo.

El shell (HTML/CSS/JS, Leaflet, fuentes) se guarda en la primera visita con
conexión, así que la app arranca sin cobertura. Los tiles del mapa se guardan
solo de los días que abras en **Mapas** con conexión: antes de viajar, **desde
el propio móvil** (los tiles de una pantalla retina no son los mismos que los de
un portátil), abre la app con wifi y pasa por el mapa de cada día.

La app se actualiza sola: al detectar una versión nueva se recarga cuando no
hay ningún formulario abierto. Si la tienes abierta en varias pestañas, se
recarga la activa; las demás se actualizan al navegar. Si algo se queda raro,
cierra la app del todo y vuelve a abrirla, o borra los datos del sitio en el
navegador (se borran caché y datos).

## Aviso

App personal sin ánimo de lucro. No está afiliada a ninguna aerolínea,
empresa de alquiler, alojamiento ni operador turístico. Los tiempos de
trayecto son estimaciones en línea recta, no rutas reales.
