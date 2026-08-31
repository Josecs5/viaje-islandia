# Viaje a Islandia — Planificador

PWA (sin modo offline) para planificar un viaje por carretera por Islandia:
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
| `manifest.json` | Manifiesto PWA |
| `icons/` | Iconos 192 / 512 / maskable + apple-touch-icon + SVG |
| `tokens.css` | Sistema de diseño portable (no lo usa la app; solo referencia) |

Solo HTML, CSS y JavaScript. Sin frameworks. Sin service worker.
Leaflet se carga por CDN.

## Aviso

App personal sin ánimo de lucro. No está afiliada a ninguna aerolínea,
empresa de alquiler, alojamiento ni operador turístico. Los tiempos de
trayecto son estimaciones en línea recta, no rutas reales.
