/* Viaje a Islandia — Planificador
 * HTML + CSS + JS puro. Sin service worker. Datos en localStorage.
 */
'use strict';
(function () {

  /* ==========================================================
     Utilidades
     ========================================================== */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad2 = n => String(n).padStart(2, '0');
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIA_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = String(s).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const ymd = dt => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;

  function fmtFecha(s, long) {
    const dt = parseDate(s);
    if (!dt) return '';
    const mes = (long ? MES_L : MES_C)[dt.getMonth()];
    return `${dt.getDate()} ${mes}${long ? ' ' + dt.getFullYear() : ''}`;
  }
  const fmtDiaSemana = s => { const dt = parseDate(s); return dt ? DIA_L[dt.getDay()] : ''; };

  function dtParts(s) {
    if (!s) return { date: '', time: '' };
    const [d, t] = String(s).split('T');
    return { date: d || '', time: (t || '').slice(0, 5) };
  }
  const toMin = t => {
    const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
    return m ? (+m[1]) * 60 + (+m[2]) : 0;
  };
  const firstTime = s => {
    const m = String(s || '').match(/(\d{1,2}):(\d{2})/);
    return m ? `${pad2(+m[1])}:${m[2]}` : '';
  };

  function eachDay(a, b) {
    const out = [];
    const start = parseDate(a), end = parseDate(b);
    if (!start || !end || end < start) return out;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(ymd(new Date(d)));
    return out;
  }

  function haversine(a, b) {
    const R = 6371, toR = x => x * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const driveEst = km => Math.round(km / 65 * 60) + 5; // minutos (aprox. carretera islandesa)
  const MIN_LEG_KM = 1; // por debajo de esto no se muestra trayecto (mismo sitio / a pie)

  function fmtDur(min) {
    min = Math.round(min);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  /* ==========================================================
     Estado
     ========================================================== */
  const STORE_KEY = 'islandia_trip_v1';

  const blankState = () => ({
    meta: { titulo: 'Viaje a Islandia', fechaInicio: '', fechaFin: '' },
    vuelos: [], coches: [], alojamientos: [], excursiones: [], comidas: [], lugares: []
  });

  // Vuelo de ida real (TAP, vía Lisboa) precargado en el primer arranque.
  const IDA_SEED = {
    id: 'seed-ida',
    tipo: 'Ida',
    reserva: '',
    notas: '',
    tramos: [
      {
        aerolinea: 'TAP Air Portugal', numero: 'TP 1011', clase: 'Turista', operadoPor: '',
        origen: 'MAD', origenNombre: 'Madrid Adolfo Suárez Barajas', origenTerminal: '2',
        destino: 'LIS', destinoNombre: 'Lisboa Humberto Delgado — Portela', destinoTerminal: '1',
        salida: '2026-10-08T11:05', llegada: '2026-10-08T11:30', duracion: '1h 25m'
      },
      {
        aerolinea: 'TAP Air Portugal', numero: 'TP 5618', clase: 'Turista', operadoPor: 'Icelandair',
        origen: 'LIS', origenNombre: 'Lisboa Humberto Delgado — Portela', origenTerminal: '1',
        destino: 'KEF', destinoNombre: 'Reikiavik Keflavík', destinoTerminal: '',
        salida: '2026-10-08T15:00', llegada: '2026-10-08T18:25', duracion: '4h 25m'
      }
    ]
  };

  // Vuelo de vuelta real (British Airways, vía Londres).
  const VUELTA_SEED = {
    id: 'seed-vuelta',
    tipo: 'Vuelta',
    reserva: '',
    notas: 'Viaje total 10 h 05 min (1 escala en Londres). Equipaje por persona: 1 accesorio personal + 1 maleta de mano (25×45×56 cm) + 1 facturada (máx. 23 kg). Aeropuerto y horas de la conexión por confirmar.',
    tramos: [
      {
        aerolinea: 'British Airways', numero: 'BA801', clase: 'Turista', operadoPor: '',
        origen: 'KEF', origenNombre: 'Reikiavik Keflavík', origenTerminal: '',
        destino: 'LHR', destinoNombre: 'Londres Heathrow', destinoTerminal: '',
        salida: '2026-10-16T10:30', llegada: '', duracion: ''
      },
      {
        aerolinea: 'British Airways', numero: 'BA3270', clase: 'Turista', operadoPor: 'BA CityFlyer',
        origen: 'LHR', origenNombre: 'Londres Heathrow', origenTerminal: '',
        destino: 'MAD', destinoNombre: 'Madrid Adolfo Suárez Barajas', destinoTerminal: '',
        salida: '', llegada: '2026-10-16T22:35', duracion: ''
      }
    ]
  };

  // Alojamientos reservados (8 noches). Coordenadas geocodificadas; Gerði es aproximada.
  const ALOJ_SEED = [
    { id: 'seed-a1', nombre: '100 Iceland Hotel', checkin: '2026-10-08', checkout: '2026-10-09', zona: 'Reikiavik',
      loc: { texto: 'Laugavegur 100, 101 Reikiavik', lat: 64.14317, lng: -21.91687 },
      reserva: '', notas: 'Check-in desde 15:00 · check-out hasta 11:00. 2 adultos, 1 habitación.' },
    { id: 'seed-a2', nombre: 'Vík Cottages', checkin: '2026-10-09', checkout: '2026-10-10', zona: 'Vík í Mýrdal',
      loc: { texto: 'Klettsvegur 3, 870 Vík í Mýrdal', lat: 63.41958, lng: -18.99941 },
      reserva: '', notas: 'Check-in desde 16:00 · check-out hasta 11:00.' },
    { id: 'seed-a3', nombre: 'Gerdi Guesthouse', checkin: '2026-10-10', checkout: '2026-10-11', zona: 'Suðursveit (Jökulsárlón)',
      loc: { texto: 'Gerði, 781 Suðursveit (cerca de Jökulsárlón)', lat: 64.0353, lng: -15.8862 },
      reserva: '', notas: 'Check-in 16:00–21:00 · check-out 07:30–11:00. Concretar hora con el anfitrión. Coordenada aproximada.' },
    { id: 'seed-a4', nombre: 'Hótel Eyvindará', checkin: '2026-10-11', checkout: '2026-10-12', zona: 'Egilsstaðir',
      loc: { texto: 'Eyvindará 2, 700 Egilsstaðir', lat: 65.27595, lng: -14.3788 },
      reserva: '', notas: 'Check-in 16:00–20:00 · check-out 07:00–11:00.' },
    { id: 'seed-a5', nombre: 'Fosshotel Húsavík', checkin: '2026-10-12', checkout: '2026-10-13', zona: 'Húsavík',
      loc: { texto: 'Ketilsbraut 22, 640 Húsavík', lat: 66.04595, lng: -17.33886 },
      reserva: '', notas: 'Check-in 15:00–00:00 · check-out hasta 12:00.' },
    { id: 'seed-a6', nombre: 'Torg Guesthouse', checkin: '2026-10-13', checkout: '2026-10-14', zona: 'Akureyri',
      loc: { texto: 'Brekkugata 1b, 600 Akureyri', lat: 65.6824, lng: -18.09193 },
      reserva: '', notas: 'Check-in 15:00–00:00 · check-out hasta 11:00. Concretar hora con el anfitrión.' },
    { id: 'seed-a7', nombre: 'Travel Inn', checkin: '2026-10-14', checkout: '2026-10-15', zona: 'Reikiavik',
      loc: { texto: 'Sóleyjargata 31, 101 Reikiavik', lat: 64.13938, lng: -21.93638 },
      reserva: '', notas: 'Check-in desde 14:00 · check-out hasta 10:00. Concretar hora con el anfitrión.' },
    { id: 'seed-a8', nombre: 'A. Bernhard Guest House', checkin: '2026-10-15', checkout: '2026-10-16', zona: 'Keflavík',
      loc: { texto: 'Vallargata 6, 230 Keflavík', lat: 64.00343, lng: -22.55746 },
      reserva: '', notas: 'Check-in 15:00–23:00 · check-out hasta 11:00. Concretar hora con el anfitrión.' }
  ];

  // Excursiones contratadas.
  const EXC_SEED = [
    {
      id: 'seed-e1',
      nombre: 'Jökulsárlón: La excursión original por las cuevas de hielo de Vatnajökull',
      fecha: '2026-10-11',
      hora: '08:30',
      duracion: '180',
      encuentro: { texto: 'Jökulsárlón, Laguna Glaciar', lat: 64.0784, lng: -16.2306 },
      proveedor: '',
      reserva: '',
      notas: 'Llegar antes de las 8:15 para conservar la plaza. Sé puntual. Duración 3 h. 2 adultos. Idioma: inglés.'
    },
    {
      id: 'seed-e2',
      nombre: 'Húsavík: tour de avistamiento de ballenas de gestión familiar',
      fecha: '2026-10-13',
      hora: '09:00',
      duracion: '180',
      encuentro: { texto: 'Hafnarstétt 23, 640 Húsavík (la casa más amarilla del puerto, junto a «Fish and Chips»)', lat: 66.04575, lng: -17.34427 },
      proveedor: '',
      reserva: '',
      notas: 'Registrarse en la oficina al menos 30 min antes de la salida (llegar antes de las 8:30). Los 15 min previos: charla de seguridad + trajes de neopreno. Ropa de abrigo, gorro, guantes y calzado cerrado. 2 adultos. Idioma: inglés. Depende de la meteorología y el estado del mar; si se cancela por seguridad, reembolso completo. Avistamientos no garantizados (los delfines cuentan).'
    },
    {
      id: 'seed-e3',
      nombre: 'Laguna Azul (Blue Lagoon) — Admisión Comfort',
      fecha: '2026-10-15',
      hora: '18:00',
      duracion: '150',
      encuentro: { texto: 'Blue Lagoon, Norðurljósavegur 9, 240 Grindavík (de camino entre Reikiavik y Keflavík)', lat: 63.8804, lng: -22.4495 },
      proveedor: 'Blue Lagoon Iceland',
      reserva: '',
      notas: [
        '2 personas · Franja de entrada 18:00 (llegar a esa hora, no antes).',
        '',
        'La Admisión Comfort incluye: entrada a la laguna + 1 mascarilla de sílice + uso de toalla + 1 bebida a elegir (en el bar dentro del agua). El albornoz y la 2ª mascarilla NO están incluidos (eso es Premium).',
        '',
        'Cómo llegar (está junto a Grindavík, entre Reikiavik y Keflavík):',
        '· En coche desde Reikiavik: ~50 min / 47 km (carretera 41 y luego 43). Desde el aeropuerto de Keflavík: ~25 min / 23 km (carretera 43). Aparcamiento gratuito.',
        '· En bus: traslados de Reykjavik Excursions / Destination Blue Lagoon desde la terminal BSÍ (Reikiavik) y desde el aeropuerto de Keflavík, con parada en la laguna.',
        '',
        'Consejos: lleva bañador; ducha obligatoria sin bañador antes de entrar. Ponte mucho acondicionador en el pelo y recógelo (el agua de sílice lo reseca). Quítate las joyas de plata (se ennegrecen). La pulsera electrónica abre la taquilla y sirve para pagar la bebida. Estancia libre hasta el cierre (2–3 h habitual).'
      ].join('\n')
    }
  ];

  // Coche de alquiler.
  const COCHE_SEED = [{
    id: 'seed-coche-1',
    empresa: 'Lava Car Rental',
    modelo: 'Dacia Duster (Older Model)',
    reserva: '',
    recogidaLugar: { texto: 'Aeropuerto de Keflavík (KEF)', lat: 63.985, lng: -22.6056 },
    recogida: '2026-10-08T19:30',
    devolucionLugar: { texto: 'Aeropuerto de Keflavík (KEF)', lat: 63.985, lng: -22.6056 },
    devolucion: '2026-10-16T07:30',
    precio: '',
    franquicia: '',
    telefono: '(+354) 519 4141',
    notas: [
      'Vehículo: Dacia Duster (Older Model) · 8 días.',
      'Seguros incluidos: daños por colisión con franquicia reducida (SCDW), protección antirrobo (TP) y protección contra grava (GP).',
      'Pago íntegro a la llegada (nada por adelantado).',
      'Lava Car Rental · Flugvellir 23, 230 Keflavík · info@lavacarrental.is · (+354) 519 4141.'
    ].join('\n')
  }];

  function seedState() {
    const s = blankState();
    s.meta.fechaInicio = '2026-10-08';
    s.meta.fechaFin = '2026-10-16';
    s.vuelos.push(JSON.parse(JSON.stringify(IDA_SEED)));
    s.vuelos.push(JSON.parse(JSON.stringify(VUELTA_SEED)));
    s.coches = JSON.parse(JSON.stringify(COCHE_SEED));
    s.alojamientos = JSON.parse(JSON.stringify(ALOJ_SEED));
    s.excursiones = JSON.parse(JSON.stringify(EXC_SEED));
    return s;
  }

  // Compatibilidad: vuelos antiguos de un solo tramo -> estructura con tramos[].
  function migrateVuelo(v) {
    if (v && Array.isArray(v.tramos)) return v;
    v = v || {};
    return {
      id: v.id || uid(),
      tipo: v.tipo || 'Ida',
      reserva: v.reserva || '',
      notas: v.notas || '',
      tramos: [{
        aerolinea: v.aerolinea || '', numero: v.numero || '', clase: '', operadoPor: '',
        origen: v.origen || '', origenNombre: '', origenTerminal: '',
        destino: v.destino || '', destinoNombre: '', destinoTerminal: '',
        salida: v.salida || '', llegada: v.llegada || '', duracion: ''
      }]
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return seedState();
      const p = JSON.parse(raw);
      const b = blankState();
      return {
        meta: Object.assign(b.meta, p.meta || {}),
        vuelos: (p.vuelos || []).map(migrateVuelo),
        coches: p.coches || [],
        alojamientos: p.alojamientos || [],
        excursiones: p.excursiones || [],
        comidas: p.comidas || [],
        lugares: p.lugares || []
      };
    } catch (e) {
      console.warn('Estado ilegible, se reinicia.', e);
      return blankState();
    }
  }

  let state = load();
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
      } catch (e) {
        toast('No se pudo guardar (almacenamiento lleno).');
      }
    }, 150);
  }

  const COL_OF  = { vuelo: 'vuelos', coche: 'coches', alojamiento: 'alojamientos', excursion: 'excursiones', comida: 'comidas', lugar: 'lugares' };
  const KIND_OF = { vuelos: 'vuelo', coches: 'coche', alojamientos: 'alojamiento', excursiones: 'excursion', comidas: 'comida', lugares: 'lugar' };

  /* ==========================================================
     Lugares conocidos de Islandia (autocompletado + coordenadas)
     ========================================================== */
  const GAZ = [
    { n: 'Aeropuerto de Keflavík (KEF)', lat: 63.985, lng: -22.6056, min: 0 },
    { n: 'Reikiavik centro', lat: 64.1466, lng: -21.9426, min: 120 },
    { n: 'Hallgrímskirkja', lat: 64.1417, lng: -21.9266, min: 45 },
    { n: 'Laguna Azul (Blue Lagoon)', lat: 63.8804, lng: -22.4495, min: 180 },
    { n: 'Sky Lagoon', lat: 64.1099, lng: -21.9296, min: 150 },
    { n: 'Parque Nacional Þingvellir', lat: 64.2559, lng: -21.13, min: 120 },
    { n: 'Geysir / Strokkur', lat: 64.3104, lng: -20.3024, min: 60 },
    { n: 'Cascada Gullfoss', lat: 64.3271, lng: -20.1199, min: 60 },
    { n: 'Cráter Kerið', lat: 64.0411, lng: -20.885, min: 40 },
    { n: 'Cascada Seljalandsfoss', lat: 63.6156, lng: -19.9887, min: 45 },
    { n: 'Cascada Skógafoss', lat: 63.5321, lng: -19.5114, min: 45 },
    { n: 'Playa de Reynisfjara', lat: 63.4033, lng: -19.0448, min: 60 },
    { n: 'Vík í Mýrdal', lat: 63.4186, lng: -19.006, min: 60 },
    { n: 'Cañón Fjaðrárgljúfur', lat: 63.7714, lng: -18.1723, min: 60 },
    { n: 'Laguna glaciar Jökulsárlón', lat: 64.0784, lng: -16.2306, min: 90 },
    { n: 'Playa de los Diamantes', lat: 64.0428, lng: -16.1793, min: 45 },
    { n: 'Skaftafell (Vatnajökull)', lat: 64.0163, lng: -16.9666, min: 180 },
    { n: 'Höfn', lat: 64.2539, lng: -15.2082, min: 60 },
    { n: 'Þórsmörk', lat: 63.6833, lng: -19.5, min: 240 },
    { n: 'Landmannalaugar', lat: 63.99, lng: -19.06, min: 240 },
    { n: 'Cascada Dettifoss', lat: 65.8148, lng: -16.3846, min: 60 },
    { n: 'Lago Mývatn', lat: 65.6039, lng: -16.9963, min: 120 },
    { n: 'Cascada Goðafoss', lat: 65.6828, lng: -17.5503, min: 45 },
    { n: 'Akureyri', lat: 65.6835, lng: -18.1002, min: 120 },
    { n: 'Kirkjufell (Snæfellsnes)', lat: 64.942, lng: -23.306, min: 60 },
    { n: 'Arnarstapi', lat: 64.769, lng: -23.622, min: 60 },
    { n: 'Cascada Hraunfossar', lat: 64.7028, lng: -20.9769, min: 40 },
    { n: 'Cráter Grábrók', lat: 64.771, lng: -21.533, min: 30 }
  ];
  const GAZ_BY_NAME = k => GAZ.find(g => g.n.toLowerCase() === String(k).trim().toLowerCase());

  /* ==========================================================
     Esquemas de formulario
     ========================================================== */
  const TIPOS_COMIDA = ['Cafetería', 'Desayuno', 'Brunch', 'Almuerzo', 'Cena', 'Café / postre', 'Alta cocina', 'Casual / rápido', 'Supermercado'];

  const SCHEMAS = {
    // Los vuelos usan un formulario propio (openFlightSheet) que admite escalas.
    vuelo: { sing: 'vuelo', icon: '✈️', fields: [] },
    coche: {
      sing: 'coche de alquiler', icon: '🚗',
      fields: [
        { k: 'empresa', l: 'Empresa', t: 'text', req: true, ph: 'Lava Car Rental' },
        { k: 'modelo', l: 'Modelo', t: 'text', ph: 'Dacia Duster' },
        { k: 'reserva', l: 'Nº de reserva', t: 'text', mono: true },
        { k: 'recogidaLugar', l: 'Lugar de recogida', t: 'loc', req: true },
        { k: 'recogida', l: 'Recogida (fecha y hora)', t: 'datetime-local', req: true },
        { k: 'devolucionLugar', l: 'Lugar de devolución', t: 'loc' },
        { k: 'devolucion', l: 'Devolución (fecha y hora)', t: 'datetime-local' },
        { k: 'precio', l: 'Precio total', t: 'text', ph: 'p. ej. 75 000 ISK' },
        { k: 'franquicia', l: 'Franquicia / depósito', t: 'text', ph: 'p. ej. 250 000 ISK' },
        { k: 'telefono', l: 'Teléfono', t: 'text' },
        { k: 'notas', l: 'Notas', t: 'textarea' }
      ]
    },
    alojamiento: {
      sing: 'alojamiento', icon: '🛏️',
      fields: [
        { k: 'nombre', l: 'Nombre', t: 'text', req: true, ph: 'Hotel Reykjavík Centrum' },
        { k: 'loc', l: 'Dirección / ubicación', t: 'loc', req: true },
        { k: 'checkin', l: 'Entrada (check-in)', t: 'date', req: true },
        { k: 'checkout', l: 'Salida (check-out)', t: 'date', req: true },
        { k: 'zona', l: 'Zona', t: 'text', ph: 'Sur de Islandia' },
        { k: 'reserva', l: 'Localizador / reserva', t: 'text', mono: true },
        { k: 'notas', l: 'Notas', t: 'textarea' }
      ]
    },
    excursion: {
      sing: 'excursión', icon: '🥾',
      fields: [
        { k: 'nombre', l: 'Nombre', t: 'text', req: true, ph: 'Avistamiento de auroras' },
        { k: 'fecha', l: 'Fecha', t: 'date', req: true },
        { k: 'hora', l: 'Hora', t: 'time' },
        { k: 'duracion', l: 'Duración (minutos)', t: 'number', ph: '180', min: 0 },
        { k: 'encuentro', l: 'Punto de encuentro', t: 'loc' },
        { k: 'proveedor', l: 'Proveedor / empresa', t: 'text' },
        { k: 'reserva', l: 'Localizador / reserva', t: 'text', mono: true },
        { k: 'notas', l: 'Notas', t: 'textarea' }
      ]
    },
    comida: {
      sing: 'sitio para comer', icon: '🍴',
      fields: [
        { k: 'nombre', l: 'Nombre', t: 'text', req: true, ph: 'Dill Restaurant' },
        { k: 'tipo', l: 'Tipo de comida', t: 'select', opts: TIPOS_COMIDA },
        { k: 'loc', l: 'Ubicación', t: 'loc' },
        { k: 'fecha', l: 'Día (opcional)', t: 'date' },
        { k: 'horario', l: 'Horario aproximado', t: 'text', ph: '12:00–14:00' },
        { k: 'notas', l: 'Notas', t: 'textarea' }
      ]
    },
    lugar: {
      sing: 'lugar', icon: '📍',
      fields: [
        { k: 'nombre', l: 'Nombre', t: 'text', req: true, ph: 'Cascada Gullfoss', gaz: true },
        { k: 'loc', l: 'Ubicación', t: 'loc' },
        { k: 'fecha', l: 'Día (opcional)', t: 'date' },
        { k: 'visita', l: 'Tiempo estimado de visita (min)', t: 'number', ph: '60', min: 0 },
        { k: 'prioridad', l: 'Prioridad', t: 'select', opts: ['Alta', 'Media', 'Baja'], def: 'Media' },
        { k: 'notas', l: 'Notas', t: 'textarea' }
      ]
    }
  };

  /* ==========================================================
     Geocodificación (Nominatim / OpenStreetMap)
     ========================================================== */
  async function geocode(q) {
    const hit = GAZ_BY_NAME(q);
    if (hit) return { lat: hit.lat, lng: hit.lng, label: hit.n };
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=is&q=' + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('geocode ' + r.status);
    const j = await r.json();
    if (!j.length) return null;
    return {
      lat: +(+j[0].lat).toFixed(5),
      lng: +(+j[0].lon).toFixed(5),
      label: String(j[0].display_name || '').split(',')[0]
    };
  }

  /* ==========================================================
     Formulario dinámico
     ========================================================== */
  let editing = null; // { kind, id }

  function fieldRow(f, val) {
    // Los campos de ubicación llevan un <details>, que no debe ir dentro de
    // un <label> (el clic se redirigiría al primer input y no abriría el detalle).
    const wrap = el(f.t === 'loc' ? 'div' : 'label', 'field');
    const span = el('span');
    span.textContent = f.l + (f.req ? ' *' : '');
    wrap.appendChild(span);

    if (f.t === 'loc') {
      wrap.appendChild(locControl(f, val || {}));
      return wrap;
    }

    let input;
    if (f.t === 'textarea') {
      input = el('textarea');
    } else if (f.t === 'select') {
      input = el('select');
      if (!f.req) { const o = el('option'); o.value = ''; o.textContent = '—'; input.appendChild(o); }
      (f.opts || []).forEach(op => { const o = el('option'); o.value = op; o.textContent = op; input.appendChild(o); });
    } else {
      input = el('input');
      input.type = f.t;
      if (f.min != null) input.min = f.min;
    }
    input.name = f.k;
    if (f.ph) input.placeholder = f.ph;
    if (f.req) input.required = true;
    if (f.mono) input.classList.add('mono');
    if (f.gaz) input.setAttribute('list', 'gaz-list');

    if (val != null && val !== '') input.value = val;
    else if (f.def) input.value = f.def;

    wrap.appendChild(input);
    return wrap;
  }

  function locControl(f, val) {
    const box = el('div', 'loc');
    box.dataset.loc = f.k;

    const row = el('div', 'loc__row');
    const txt = el('input');
    txt.type = 'text';
    txt.className = 'loc__text';
    txt.placeholder = 'Nombre o dirección en Islandia';
    txt.value = val.texto || '';
    txt.setAttribute('list', 'gaz-list');

    const btn = el('button', 'btn btn--ghost btn--sm loc__btn');
    btn.type = 'button';
    btn.textContent = 'Buscar';
    row.append(txt, btn);

    const status = el('p', 'loc__status');

    const adv = el('details', 'loc__adv');
    const sum = el('summary');
    sum.textContent = 'Coordenadas (avanzado)';
    const latI = el('input');
    latI.type = 'number'; latI.step = 'any'; latI.placeholder = 'Latitud'; latI.className = 'loc__lat';
    if (val.lat != null) latI.value = val.lat;
    const lngI = el('input');
    lngI.type = 'number'; lngI.step = 'any'; lngI.placeholder = 'Longitud'; lngI.className = 'loc__lng';
    if (val.lng != null) lngI.value = val.lng;
    adv.append(sum, latI, lngI);

    box.append(row, status, adv);

    const paint = () => {
      const la = parseFloat(latI.value), lo = parseFloat(lngI.value);
      if (isFinite(la) && isFinite(lo)) {
        status.textContent = `📍 ${la.toFixed(4)}, ${lo.toFixed(4)}`;
        status.classList.add('is-set');
      } else {
        status.textContent = 'Sin coordenadas: no aparecerá en el mapa ni en los cálculos de trayecto.';
        status.classList.remove('is-set');
      }
    };
    latI.addEventListener('input', paint);
    lngI.addEventListener('input', paint);

    txt.addEventListener('change', () => {
      const hit = GAZ_BY_NAME(txt.value);
      if (hit) { latI.value = hit.lat; lngI.value = hit.lng; paint(); }
    });

    btn.addEventListener('click', async () => {
      const q = txt.value.trim();
      if (!q) { txt.focus(); return; }
      btn.disabled = true;
      btn.textContent = 'Buscando…';
      try {
        const res = await geocode(q);
        if (res) {
          latI.value = res.lat;
          lngI.value = res.lng;
          if (res.label && !txt.value.trim()) txt.value = res.label;
          paint();
        } else {
          toast('No se encontró esa ubicación.');
        }
      } catch (e) {
        toast('Búsqueda no disponible ahora. Prueba con coordenadas.');
        adv.open = true;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Buscar';
      }
    });

    paint();
    return box;
  }

  function readLoc(box) {
    const o = { texto: box.querySelector('.loc__text').value.trim() };
    const la = parseFloat(box.querySelector('.loc__lat').value);
    const lo = parseFloat(box.querySelector('.loc__lng').value);
    if (isFinite(la) && isFinite(lo)) { o.lat = la; o.lng = lo; }
    return o;
  }

  /* ---------- Formulario de vuelos (con escalas) ---------- */
  function labeledField(labelText, control, req) {
    const w = el('label', 'field');
    const s = el('span');
    s.textContent = labelText + (req ? ' *' : '');
    w.append(s, control);
    return w;
  }
  function mkInput(name, type, value, opts) {
    opts = opts || {};
    const i = el('input');
    i.type = type;
    i.name = name;
    if (value != null && value !== '') i.value = value;
    if (opts.ph) i.placeholder = opts.ph;
    if (opts.mono) i.classList.add('mono');
    return i;
  }
  const textField = (name, label, value, opts) =>
    labeledField(label, mkInput(name, 'text', value, opts), opts && opts.req);
  function textareaField(name, label, value) {
    const t = el('textarea');
    t.name = name;
    if (value) t.value = value;
    return labeledField(label, t);
  }
  function selectField(name, label, options, value, req) {
    const sel = el('select');
    sel.name = name;
    options.forEach(o => { const op = el('option'); op.value = o; op.textContent = o; sel.appendChild(op); });
    if (value) sel.value = value;
    return labeledField(label, sel, req);
  }

  function tramoCard(n, t) {
    t = t || {};
    const c = el('div', 'tramo');

    const head = el('div', 'tramo__head');
    const title = el('span');
    title.textContent = 'Tramo ' + n;
    const rm = el('button', 'icon-btn icon-btn--danger');
    rm.type = 'button';
    rm.setAttribute('aria-label', 'Eliminar tramo');
    rm.textContent = '🗑';
    rm.addEventListener('click', () => {
      const wrap = c.parentElement;
      if (wrap.querySelectorAll('.tramo').length <= 1) { toast('Un vuelo necesita al menos un tramo.'); return; }
      c.remove();
      Array.from(wrap.querySelectorAll('.tramo')).forEach((card, i) => {
        card.querySelector('.tramo__head span').textContent = 'Tramo ' + (i + 1);
      });
    });
    head.append(title, rm);
    c.appendChild(head);

    c.appendChild(textField('aerolinea', 'Aerolínea', t.aerolinea, { ph: 'TAP Air Portugal' }));
    const g1 = el('div', 'field-2');
    g1.append(
      textField('numero', 'Nº de vuelo', t.numero, { mono: true, ph: 'TP 1011' }),
      textField('clase', 'Clase', t.clase, { ph: 'Turista' })
    );
    c.appendChild(g1);
    c.appendChild(textField('operadoPor', 'Operado por', t.operadoPor, { ph: 'Icelandair' }));

    const g2 = el('div', 'field-2');
    g2.append(
      textField('origen', 'Origen (código)', t.origen, { ph: 'MAD', mono: true }),
      textField('origenTerminal', 'Terminal', t.origenTerminal, { ph: '2' })
    );
    c.appendChild(g2);
    c.appendChild(textField('origenNombre', 'Aeropuerto de origen', t.origenNombre, { ph: 'Madrid Adolfo Suárez Barajas' }));

    const g3 = el('div', 'field-2');
    g3.append(
      textField('destino', 'Destino (código)', t.destino, { ph: 'LIS', mono: true }),
      textField('destinoTerminal', 'Terminal', t.destinoTerminal, { ph: '1' })
    );
    c.appendChild(g3);
    c.appendChild(textField('destinoNombre', 'Aeropuerto de destino', t.destinoNombre, { ph: 'Lisboa Humberto Delgado' }));

    c.appendChild(labeledField('Salida (fecha y hora)', mkInput('salida', 'datetime-local', t.salida), n === 1));
    c.appendChild(labeledField('Llegada (fecha y hora)', mkInput('llegada', 'datetime-local', t.llegada)));
    c.appendChild(textField('duracion', 'Duración del tramo', t.duracion, { ph: '1h 25m' }));
    return c;
  }

  function openFlightSheet(id) {
    const data = id ? state.vuelos.find(x => x.id === id) : null;
    editing = { kind: 'vuelo', id: id || null };
    $('#sheet-title').textContent = (id ? 'Editar ' : 'Añadir ') + 'vuelo';

    const form = $('#sheet-form');
    form.innerHTML = '';
    form.appendChild(selectField('tipo', 'Tipo', ['Ida', 'Vuelta'], data ? data.tipo : 'Ida', true));
    form.appendChild(textField('reserva', 'Localizador / reserva', data ? data.reserva : '', { mono: true }));

    const tramosWrap = el('div', 'tramos');
    form.appendChild(tramosWrap);

    const addBtn = el('button', 'btn btn--ghost btn--block');
    addBtn.type = 'button';
    addBtn.textContent = '+ Añadir escala / tramo';
    addBtn.addEventListener('click', () => {
      tramosWrap.appendChild(tramoCard(tramosWrap.querySelectorAll('.tramo').length + 1, {}));
    });
    form.appendChild(addBtn);

    form.appendChild(textareaField('notas', 'Notas', data ? data.notas : ''));

    const tramos = (data && data.tramos && data.tramos.length) ? data.tramos : [{}];
    tramos.forEach((t, i) => tramosWrap.appendChild(tramoCard(i + 1, t)));

    showSheet();
  }

  function submitFlight(id, form) {
    const val = n => { const x = form.querySelector(`[name="${n}"]`); return x ? x.value.trim() : ''; };
    const tramos = Array.from(form.querySelectorAll('.tramo')).map(card => {
      const g = n => { const x = card.querySelector(`[name="${n}"]`); return x ? x.value.trim() : ''; };
      return {
        aerolinea: g('aerolinea'), numero: g('numero'), clase: g('clase'), operadoPor: g('operadoPor'),
        origen: g('origen').toUpperCase(), origenNombre: g('origenNombre'), origenTerminal: g('origenTerminal'),
        destino: g('destino').toUpperCase(), destinoNombre: g('destinoNombre'), destinoTerminal: g('destinoTerminal'),
        salida: g('salida'), llegada: g('llegada'), duracion: g('duracion')
      };
    }).filter(t => t.aerolinea || t.numero || t.origen || t.destino || t.salida);

    if (!tramos.length) { toast('Añade al menos un tramo con datos.'); return; }
    if (!tramos[0].salida) { toast('El primer tramo necesita fecha y hora de salida.'); return; }

    const obj = { id: id || uid(), tipo: val('tipo') || 'Ida', reserva: val('reserva'), notas: val('notas'), tramos };
    if (id) {
      const i = state.vuelos.findIndex(x => x.id === id);
      state.vuelos[i] = obj;
    } else {
      state.vuelos.push(obj);
    }
    save();
    hideSheet();
    renderAll();
    toast(id ? 'Vuelo actualizado.' : 'Vuelo añadido.');
  }

  function openSheet(kind, id) {
    if (kind === 'vuelo') return openFlightSheet(id);
    const sch = SCHEMAS[kind];
    const col = state[COL_OF[kind]];
    const data = id ? col.find(x => x.id === id) : null;
    editing = { kind, id: id || null };

    $('#sheet-title').textContent = (id ? 'Editar ' : 'Añadir ') + sch.sing;
    const form = $('#sheet-form');
    form.innerHTML = '';
    sch.fields.forEach(f => {
      form.appendChild(fieldRow(f, data ? data[f.k] : null));
    });

    // Autocompletar coords + tiempo de visita desde la lista de lugares conocidos
    const gazF = sch.fields.find(f => f.gaz);
    if (gazF) {
      const nombre = form.querySelector(`[name="${gazF.k}"]`);
      nombre.addEventListener('change', () => {
        const hit = GAZ_BY_NAME(nombre.value);
        if (!hit) return;
        const lb = form.querySelector('[data-loc]');
        if (lb) {
          lb.querySelector('.loc__lat').value = hit.lat;
          lb.querySelector('.loc__lng').value = hit.lng;
          lb.querySelector('.loc__lat').dispatchEvent(new Event('input'));
          if (!lb.querySelector('.loc__text').value.trim()) lb.querySelector('.loc__text').value = hit.n;
        }
        const vis = form.querySelector('[name="visita"]');
        if (vis && !vis.value && hit.min) vis.value = hit.min;
      });
    }

    showSheet();
  }

  $('#sheet-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!editing) return;
    const { kind, id } = editing;
    const form = e.currentTarget;

    if (kind === 'vuelo') { submitFlight(id, form); return; }

    const sch = SCHEMAS[kind];

    // Validación mínima
    for (const f of sch.fields) {
      if (!f.req) continue;
      if (f.t === 'loc') {
        const t = form.querySelector(`[data-loc="${f.k}"] .loc__text`).value.trim();
        if (!t) { toast(`Falta: ${f.l}`); return; }
      } else {
        const inp = form.querySelector(`[name="${f.k}"]`);
        if (inp && !inp.value.trim()) { toast(`Falta: ${f.l}`); inp.focus(); return; }
      }
    }

    const base = id ? state[COL_OF[kind]].find(x => x.id === id) : { id: uid() };
    const obj = Object.assign({}, base);
    sch.fields.forEach(f => {
      if (f.t === 'loc') {
        obj[f.k] = readLoc(form.querySelector(`[data-loc="${f.k}"]`));
      } else {
        const inp = form.querySelector(`[name="${f.k}"]`);
        obj[f.k] = inp ? inp.value.trim() : '';
      }
    });

    if (kind === 'alojamiento' && obj.checkin && obj.checkout && obj.checkout < obj.checkin) {
      toast('El check-out no puede ser anterior al check-in.');
      return;
    }

    const collection = state[COL_OF[kind]];
    if (id) {
      const i = collection.findIndex(x => x.id === id);
      collection[i] = obj;
    } else {
      collection.push(obj);
    }
    save();
    hideSheet();
    renderAll();
    toast(id ? 'Cambios guardados.' : cap(sch.sing) + ' añadido.');
  });

  async function removeItem(kind, id) {
    const ok = await confirmAsk('¿Eliminar este elemento? No se puede deshacer.');
    if (!ok) return;
    const col = state[COL_OF[kind]];
    const i = col.findIndex(x => x.id === id);
    if (i > -1) {
      col.splice(i, 1);
      save();
      renderAll();
      toast('Elemento eliminado.');
    }
  }

  /* ==========================================================
     Pantalla: DATOS
     ========================================================== */
  function renderDatos() {
    const body = $('#datos-body');
    body.innerHTML = '';
    body.appendChild(metaCard());

    [
      ['vuelos', 'Vuelos', vueloSummary],
      ['coches', 'Coche de alquiler', cocheSummary],
      ['alojamientos', 'Alojamientos', alojSummary],
      ['excursiones', 'Excursiones', excSummary],
      ['comidas', 'Dónde comer', comidaSummary],
      ['lugares', 'Qué ver', lugarSummary]
    ].forEach(([col, label, sum]) => body.appendChild(groupEl(col, label, sum)));
  }

  // Los datos del viaje (fechas, vuelos, coche, alojamientos, excursiones) son de
  // solo lectura. Solo "Dónde comer" y "Qué ver" admiten añadir / editar / eliminar.
  const EDITABLE_COLS = ['comidas', 'lugares'];
  const isSeed = it => String(it && it.id || '').startsWith('seed-');

  function metaCard() {
    const c = el('div', 'card meta-card meta-card--ro');
    const m = state.meta;
    const rango = (m.fechaInicio && m.fechaFin)
      ? `${fmtFecha(m.fechaInicio, true)} – ${fmtFecha(m.fechaFin, true)}`
      : 'Sin fechas';
    c.innerHTML =
      `<div class="ro-line"><span class="ro-k">Viaje</span><span class="ro-v">${esc(m.titulo || 'Viaje a Islandia')}</span></div>` +
      `<div class="ro-line"><span class="ro-k">Fechas</span><span class="ro-v">${esc(rango)}</span></div>`;
    return c;
  }

  function groupEl(col, label, summarize) {
    const items = state[col];
    const kind = KIND_OF[col];
    const g = el('div', 'group');

    const openKey = 'open_' + col;
    const isOpen = localStorage.getItem(openKey) !== '0';

    const head = el('button', 'group__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(isOpen));
    head.innerHTML =
      `<span class="group__label">${SCHEMAS[kind].icon} ${esc(label)}</span>` +
      `<span class="group__right"><span class="count">${items.length}</span><span class="chev">⌄</span></span>`;

    const bodyWrap = el('div', 'group__body');
    bodyWrap.hidden = !isOpen;

    const editable = EDITABLE_COLS.includes(col);

    const list = el('div', 'list');
    if (!items.length) {
      const e = el('div', 'empty');
      e.textContent = editable ? 'Aún no has añadido nada aquí.' : 'Sin elementos.';
      list.appendChild(e);
    } else {
      items.slice().sort(itemSorter(col)).forEach(it => list.appendChild(itemCard(kind, it, summarize(it))));
    }

    bodyWrap.appendChild(list);

    if (editable) {
      const add = el('button', 'btn btn--ghost btn--block');
      add.type = 'button';
      add.textContent = '+ Añadir ' + SCHEMAS[kind].sing;
      add.addEventListener('click', () => openSheet(kind));
      bodyWrap.appendChild(add);
    }

    head.addEventListener('click', () => {
      const willOpen = bodyWrap.hidden;
      bodyWrap.hidden = !willOpen;
      head.setAttribute('aria-expanded', String(willOpen));
      localStorage.setItem(openKey, willOpen ? '1' : '0');
    });

    g.append(head, bodyWrap);
    return g;
  }

  function itemCard(kind, it, summaryHtml) {
    const c = el('div', 'card item');
    const main = el('div', 'item__main');
    main.innerHTML = summaryHtml;
    c.appendChild(main);

    // Solo se pueden editar/eliminar los elementos añadidos por el usuario
    // en "Dónde comer" y "Qué ver"; el resto es de solo lectura.
    const canEdit = (kind === 'comida' || kind === 'lugar') && !isSeed(it);
    if (canEdit) {
      const acts = el('div', 'item__acts');
      const edit = el('button', 'icon-btn');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Editar');
      edit.textContent = '✎';
      edit.addEventListener('click', () => openSheet(kind, it.id));

      const del = el('button', 'icon-btn icon-btn--danger');
      del.type = 'button';
      del.setAttribute('aria-label', 'Eliminar');
      del.textContent = '🗑';
      del.addEventListener('click', () => removeItem(kind, it.id));

      acts.append(edit, del);
      c.appendChild(acts);
    }
    return c;
  }

  // Minutos de escala entre dos horas locales del mismo aeropuerto (sin desfase horario).
  function layoverMin(llegada, salida) {
    if (!llegada || !salida) return null;
    const a = new Date(llegada), b = new Date(salida);
    if (isNaN(a) || isNaN(b)) return null;
    const m = Math.round((b - a) / 60000);
    return m > 0 ? m : null;
  }

  function itemSorter(col) {
    const key = {
      vuelos: x => (x.tramos && x.tramos[0] && x.tramos[0].salida) || '',
      coches: x => x.recogida || '',
      alojamientos: x => x.checkin || '',
      excursiones: x => (x.fecha || '') + ' ' + (x.hora || ''),
      comidas: x => (x.fecha || '~') + (x.nombre || ''),
      lugares: x => (x.fecha || '~') + (x.nombre || '')
    }[col];
    return (a, b) => {
      const ka = key(a), kb = key(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    };
  }

  function locLine(loc) {
    if (!loc) return '';
    const bits = [];
    if (loc.texto) bits.push(esc(loc.texto));
    if (loc.lat != null) bits.push('<span class="pin">📍</span>');
    return bits.join(' ');
  }
  function vueloEscalas(tr) {
    // [{cod, min}] para cada escala intermedia
    return tr.slice(0, -1).map((t, i) => ({ cod: t.destino || '', min: layoverMin(t.llegada, tr[i + 1].salida) }));
  }
  const escLines = s => esc(s).split('\n').join('<br>');

  function vueloSummary(v) {
    const tr = v.tramos || [];
    const a = tr[0] || {}, z = tr[tr.length - 1] || {};
    const s = dtParts(a.salida), e = dtParts(z.llegada);
    let html =
      `<div class="item__title">${esc(v.tipo || 'Vuelo')} · <span class="mono">${esc(a.origen || '')}</span> → <span class="mono">${esc(z.destino || '')}</span></div>` +
      `<div class="item__meta">${s.date ? fmtFecha(s.date, true) : '—'} · sale ${s.time || '—'} · llega ${e.time || '—'}${e.date && e.date !== s.date ? ' (' + fmtFecha(e.date) + ')' : ''}</div>`;
    tr.forEach((t, i) => {
      const ts = dtParts(t.salida), ta = dtParts(t.llegada);
      html += `<div class="item__leg"><span class="mono">${esc(t.numero || '')}</span> ${esc(t.aerolinea || '')}${t.operadoPor ? ' · op. ' + esc(t.operadoPor) : ''}<br>` +
        `${esc(t.origen || '')}${t.origenTerminal ? ' T' + esc(t.origenTerminal) : ''} ${ts.time || ''} → ${esc(t.destino || '')}${t.destinoTerminal ? ' T' + esc(t.destinoTerminal) : ''} ${ta.time || ''}` +
        `${t.clase ? ' · ' + esc(t.clase) : ''}${t.duracion ? ' · ' + esc(t.duracion) : ''}</div>`;
      if (i < tr.length - 1) {
        const lay = layoverMin(t.llegada, tr[i + 1].salida);
        html += `<div class="item__lay">↕ escala en ${esc(t.destino || '')}${lay ? ' · ' + fmtDur(lay) : ''}</div>`;
      }
    });
    if (v.reserva) html += `<div class="item__meta">Reserva: ${esc(v.reserva)}</div>`;
    if (v.notas) html += `<div class="item__meta">${escLines(v.notas)}</div>`;
    return html;
  }

  function alojSummary(a) {
    const noches = Math.max(0, eachDay(a.checkin, a.checkout).length - 1);
    return `<div class="item__title">${esc(a.nombre || 'Alojamiento')}</div>
      <div class="item__meta">${a.checkin ? fmtFecha(a.checkin, true) : '—'} → ${a.checkout ? fmtFecha(a.checkout, true) : '—'}${noches ? ' · ' + noches + ' noche' + (noches !== 1 ? 's' : '') : ''}</div>
      <div class="item__meta">${locLine(a.loc)}${a.zona ? ' · ' + esc(a.zona) : ''}</div>
      ${a.notas ? `<div class="item__meta">${escLines(a.notas)}</div>` : ''}
      ${a.reserva ? `<div class="item__meta">Reserva: ${esc(a.reserva)}</div>` : ''}`;
  }

  function cocheSummary(v) {
    const r = dtParts(v.recogida), d = dtParts(v.devolucion);
    return `<div class="item__title">${esc(v.empresa || 'Coche')}${v.modelo ? ' · ' + esc(v.modelo) : ''}</div>
      <div class="item__meta">Recogida: ${r.date ? fmtFecha(r.date, true) : '—'} ${r.time || ''}${v.recogidaLugar && v.recogidaLugar.texto ? '<br>' + esc(v.recogidaLugar.texto) : ''}</div>
      <div class="item__meta">Devolución: ${d.date ? fmtFecha(d.date, true) : '—'} ${d.time || ''}${v.devolucionLugar && v.devolucionLugar.texto ? '<br>' + esc(v.devolucionLugar.texto) : ''}</div>
      ${v.notas ? `<div class="item__meta">${escLines(v.notas)}</div>` : ''}
      ${v.telefono ? `<div class="item__meta">Tel.: ${esc(v.telefono)}</div>` : ''}
      ${(v.reserva || v.precio) ? `<div class="item__meta">${[v.reserva ? 'Reserva: ' + esc(v.reserva) : '', v.precio ? esc(v.precio) : ''].filter(Boolean).join(' · ')}</div>` : ''}`;
  }
  function excSummary(e) {
    return `<div class="item__title">${esc(e.nombre || 'Excursión')}</div>
      <div class="item__meta">${e.fecha ? fmtFecha(e.fecha) : '—'} ${e.hora || ''} ${e.duracion ? '· ' + fmtDur(+e.duracion) : ''}</div>
      <div class="item__meta">${e.encuentro && e.encuentro.texto ? 'Encuentro: ' + locLine(e.encuentro) : ''}</div>`;
  }
  function comidaSummary(c) {
    return `<div class="item__title">${esc(c.nombre || '')}</div>
      <div class="item__meta">${esc(c.tipo || '')} ${c.horario ? '· ' + esc(c.horario) : ''}</div>
      <div class="item__meta">${locLine(c.loc)} ${c.fecha ? '· ' + fmtFecha(c.fecha) : ''}</div>`;
  }
  function lugarSummary(l) {
    const p = (l.prioridad || 'Media');
    return `<div class="item__title">${esc(l.nombre || '')} <span class="prio prio--${p.toLowerCase()}">${esc(p)}</span></div>
      <div class="item__meta">${locLine(l.loc)}</div>
      <div class="item__meta">${l.visita ? fmtDur(+l.visita) + ' de visita' : ''} ${l.fecha ? '· ' + fmtFecha(l.fecha) : ''}</div>`;
  }

  /* ==========================================================
     Motor de itinerario
     ========================================================== */
  function buildItinerary() {
    const { meta } = state;
    const days = eachDay(meta.fechaInicio, meta.fechaFin);
    const byDay = new Map(days.map(d => [d, []]));
    const unassigned = [];
    const inRange = d => byDay.has(d);
    const push = (d, item) => byDay.get(d).push(item);

    // Vuelos (con escalas)
    state.vuelos.forEach(v => {
      const tr = v.tramos || [];
      const a = tr[0] || {}, z = tr[tr.length - 1] || {};
      const p = dtParts(a.salida);
      const arr = dtParts(z.llegada);
      const escTxt = vueloEscalas(tr)
        .map(x => x.cod + (x.min ? ' ' + fmtDur(x.min) : ''))
        .filter(Boolean);
      const subBits = [];
      if (p.time) subBits.push('Sale ' + p.time + (a.origen ? ' ' + a.origen : ''));
      if (arr.time) subBits.push('llega ' + arr.time + (z.destino ? ' ' + z.destino : '') + (arr.date && arr.date !== p.date ? ' (' + fmtFecha(arr.date) + ')' : ''));
      if (escTxt.length) subBits.push('escala ' + escTxt.join(', '));
      const item = {
        t: 'vuelo',
        hora: p.time,
        sortT: p.time ? toMin(p.time) : 0,
        titulo: `${v.tipo || 'Vuelo'} · ${a.origen || ''} → ${z.destino || ''}`.trim(),
        sub: subBits.join(' · '),
        loc: null,
        tag: 'Vuelo'
      };
      if (p.date && inRange(p.date)) push(p.date, item);
      else unassigned.push(Object.assign({ nota: p.date ? 'fecha fuera del rango' : 'sin fecha' }, item));
    });

    // Coche de alquiler (recogida + devolución)
    state.coches.forEach(v => {
      const rp = dtParts(v.recogida);
      const dp = dtParts(v.devolucion);
      const rLoc = v.recogidaLugar && v.recogidaLugar.lat != null ? v.recogidaLugar : null;
      const dLoc = (v.devolucionLugar && v.devolucionLugar.lat != null) ? v.devolucionLugar : rLoc;
      if (rp.date && inRange(rp.date)) {
        push(rp.date, {
          t: 'coche', hora: rp.time, sortT: rp.time ? toMin(rp.time) : 720,
          titulo: `Recogida del coche${v.empresa ? ' · ' + v.empresa : ''}`,
          sub: [v.modelo, v.recogidaLugar && v.recogidaLugar.texto, v.reserva].filter(Boolean).join(' · '),
          notas: v.notas || '', loc: rLoc, tag: 'Coche'
        });
      }
      if (dp.date && inRange(dp.date)) {
        push(dp.date, {
          t: 'coche', hora: dp.time, sortT: dp.time ? toMin(dp.time) : 600,
          titulo: `Devolución del coche${v.empresa ? ' · ' + v.empresa : ''}`,
          sub: [v.devolucionLugar && v.devolucionLugar.texto || (v.recogidaLugar && v.recogidaLugar.texto), v.reserva].filter(Boolean).join(' · '),
          loc: dLoc, tag: 'Coche'
        });
      }
    });

    // Alojamientos
    state.alojamientos.forEach(a => {
      const loc = a.loc && a.loc.lat != null ? a.loc : (a.loc || null);
      if (a.checkin && inRange(a.checkin)) {
        push(a.checkin, { t: 'checkin', hora: '', sortT: 1400, titulo: `Check-in · ${a.nombre || 'Alojamiento'}`, sub: a.loc && a.loc.texto || '', notas: a.notas || '', loc, tag: 'Alojamiento' });
      }
      if (a.checkout && inRange(a.checkout)) {
        push(a.checkout, { t: 'checkout', hora: '', sortT: 10, titulo: `Check-out · ${a.nombre || 'Alojamiento'}`, sub: a.loc && a.loc.texto || '', loc, tag: 'Alojamiento' });
      }
      eachDay(a.checkin, a.checkout).slice(0, -1).forEach(d => {
        if (inRange(d)) push(d, { t: 'noche', hora: '', sortT: 1460, titulo: `Noche en ${a.nombre || 'alojamiento'}`, sub: a.loc && a.loc.texto || '', loc, tag: 'Alojamiento', quiet: true });
      });
    });

    // Excursiones
    state.excursiones.forEach(e => {
      const item = {
        t: 'excursion',
        hora: e.hora || '',
        sortT: e.hora ? toMin(e.hora) : 540,
        titulo: e.nombre || 'Excursión',
        sub: [
          e.duracion ? fmtDur(+e.duracion) : '',
          e.encuentro && e.encuentro.texto ? 'Encuentro: ' + e.encuentro.texto : ''
        ].filter(Boolean).join(' · '),
        notas: e.notas || '',
        loc: e.encuentro && e.encuentro.lat != null ? e.encuentro : null,
        tag: 'Excursión'
      };
      if (e.fecha && inRange(e.fecha)) push(e.fecha, item);
      else unassigned.push(Object.assign({ nota: e.fecha ? 'fecha fuera del rango' : 'sin fecha' }, item));
    });

    // Comidas
    state.comidas.forEach(c => {
      const ht = firstTime(c.horario);
      const item = {
        t: 'comida',
        hora: ht,
        sortT: ht ? toMin(ht) : 780,
        titulo: c.nombre || 'Comida',
        sub: [c.tipo, c.horario].filter(Boolean).join(' · '),
        loc: c.loc && c.loc.lat != null ? c.loc : null,
        tag: 'Comida'
      };
      if (c.fecha && inRange(c.fecha)) push(c.fecha, item);
      else unassigned.push(Object.assign({ nota: 'sin fecha' }, item));
    });

    // Lugares
    state.lugares.forEach(l => {
      const item = {
        t: 'lugar',
        hora: '',
        sortT: 660,
        titulo: l.nombre || 'Lugar',
        sub: [
          l.prioridad ? 'Prioridad ' + l.prioridad : '',
          l.visita ? fmtDur(+l.visita) + ' de visita' : ''
        ].filter(Boolean).join(' · '),
        loc: l.loc && l.loc.lat != null ? l.loc : null,
        tag: 'Lugar'
      };
      if (l.fecha && inRange(l.fecha)) push(l.fecha, item);
      else unassigned.push(Object.assign({ nota: 'sin fecha' }, item));
    });

    const outDays = days.map((d, i) => {
      const items = byDay.get(d).slice().sort((a, b) => a.sortT - b.sortT);
      let km = 0, prev = null;
      items.forEach(it => {
        if (it.loc && it.loc.lat != null) {
          if (prev) {
            const d = haversine(prev, it.loc);
            if (d >= MIN_LEG_KM) km += d;
          }
          prev = it.loc;
        }
      });
      return { date: d, idx: i + 1, items, km };
    });

    return { days: outDays, unassigned, count: days.length };
  }

  /* ==========================================================
     Fotos de las zonas (Wikimedia Commons)
     ========================================================== */
  const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const fotoURL = (file, w) =>
    'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=' + w;

  // Orden = prioridad: primero los hitos/excursiones, luego pueblos y zonas.
  const FOTOS = [
    { k: ['cuevas de hielo', 'cueva de hielo', 'vatnajokull'], f: 'Ice Cave Explorer - Iceland.jpg', c: 'Cuevas de hielo del Vatnajökull' },
    { k: ['laguna azul', 'blue lagoon'], f: 'Blue Lagoon with Þorbjörn, Iceland, 20230430 1626 3692.jpg', c: 'Laguna Azul' },
    { k: ['jokulsarlon', 'sudursveit', 'laguna glaciar'], f: 'Jökulsárlón glacier lagoon, Iceland, 20240718 1620 2403.jpg', c: 'Laguna glaciar de Jökulsárlón' },
    { k: ['gullfoss'], f: 'Gullfoss, an iconic waterfall of Iceland.jpg', c: 'Cascada de Gullfoss' },
    { k: ['reynisfjara', 'reynisdrangar', 'vik i myrdal', 'myrdal'], f: 'Reynisfjara and Reynisdrangar, Iceland.jpg', c: 'Playa de Reynisfjara (Vík)' },
    { k: ['skogafoss'], f: 'Skógafoss July 2014.JPG', c: 'Cascada de Skógafoss' },
    { k: ['seljalandsfoss'], f: 'Seljalandsfoss - panoramio (7).jpg', c: 'Cascada de Seljalandsfoss' },
    { k: ['godafoss'], f: 'Goðafoss July 2014.JPG', c: 'Cascada de Goðafoss' },
    { k: ['myvatn'], f: 'Myvatn Iceland 01.jpg', c: 'Lago Mývatn' },
    { k: ['seydisfjordur', 'egilsstadir', 'eyvindara'], f: 'Seyðisfjörður Sept 2019 1.jpg', c: 'Seyðisfjörður (junto a Egilsstaðir)' },
    { k: ['husavik', 'ballenas', 'avistamiento'], f: 'Husavik Iceland 2005 1.JPG', c: 'Húsavík' },
    { k: ['akureyri', 'brekkugata'], f: 'Overlooking Eyjafjörður from Hamrar (close).jpeg', c: 'Akureyri y el fiordo Eyjafjörður' },
    { k: ['reikiavik', 'reykjavik', 'hallgrim', 'laugavegur', 'soleyjargata'], f: 'Hallgrímskirkja.jpeg', c: 'Reikiavik' },
    { k: ['keflavik', 'reykjanes', 'grindavik', 'bernhard', 'vallargata'], f: 'Reykjanesviti, Reykjanes, Iceland, 20230430 1330 3606.jpg', c: 'Península de Reykjanes (Keflavík)' }
  ];

  function fotosDelDia(day) {
    let blob = day.items.map(i => `${i.titulo} ${i.tag} ${i.sub} ${i.loc && i.loc.texto || ''}`).join(' ');
    state.alojamientos.forEach(a => {
      if (a.zona && eachDay(a.checkin, a.checkout).indexOf(day.date) > -1) blob += ' ' + a.zona;
    });
    blob = normTxt(blob);
    const out = [];
    for (const e of FOTOS) {
      if (out.length >= 2) break;
      if (out.some(o => o.f === e.f)) continue;
      if (e.k.some(k => blob.indexOf(normTxt(k)) > -1)) out.push(e);
    }
    return out;
  }

  /* ==========================================================
     Pantalla: ITINERARIO
     ========================================================== */
  let selectedItinDay = 'all';

  function itinChip(key, label) {
    const b = el('button', 'chip');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(selectedItinDay === key));
    b.addEventListener('click', () => {
      if (selectedItinDay === key) return;
      selectedItinDay = key;
      renderItinerario();
    });
    return b;
  }

  function renderItinerario() {
    const body = $('#itin-body');
    const sub = $('#itin-sub');
    body.innerHTML = '';

    if (!state.meta.fechaInicio || !state.meta.fechaFin) {
      sub.textContent = '';
      body.appendChild(notice('Añade las fechas de inicio y fin en «Datos del viaje» para generar el itinerario por días.'));
      return;
    }

    const it = buildItinerary();
    sub.textContent = `${fmtFecha(state.meta.fechaInicio, true)} – ${fmtFecha(state.meta.fechaFin, true)} · ${it.count} día${it.count !== 1 ? 's' : ''}`;

    if (selectedItinDay !== 'all' && !it.days.some(d => d.date === selectedItinDay)) selectedItinDay = 'all';

    const chips = el('div', 'chips chips--itin');
    chips.appendChild(itinChip('all', 'Todos'));
    it.days.forEach(d => chips.appendChild(itinChip(d.date, 'Día ' + d.idx)));
    body.appendChild(chips);

    const dias = selectedItinDay === 'all' ? it.days : it.days.filter(d => d.date === selectedItinDay);
    dias.forEach(day => body.appendChild(dayBlock(day)));

    if (selectedItinDay === 'all' && it.unassigned.length) body.appendChild(unassignedBlock(it.unassigned));
  }

  function dayBlock(day) {
    const wrap = el('section', 'day');
    const head = el('div', 'day__head');
    head.innerHTML =
      `<h3 class="day__date">${cap(fmtDiaSemana(day.date))}, ${fmtFecha(day.date)}</h3>` +
      `<span class="day__idx">Día ${day.idx}</span>`;
    wrap.appendChild(head);

    const fotos = fotosDelDia(day);
    if (fotos.length) {
      const strip = el('div', 'day__fotos' + (fotos.length === 2 ? ' is-2' : ''));
      fotos.forEach(ph => {
        const fig = el('figure', 'day__foto');
        const img = el('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.alt = ph.c;
        img.src = fotoURL(ph.f, 800);
        img.addEventListener('error', () => {
          fig.remove();
          if (!strip.children.length) strip.remove();
          else strip.classList.remove('is-2');
        });
        const cap = el('figcaption');
        cap.textContent = ph.c;
        fig.append(img, cap);
        strip.appendChild(fig);
      });
      wrap.appendChild(strip);
    }

    if (!day.items.length) {
      wrap.appendChild(notice('Día libre — sin actividades planificadas.'));
      return wrap;
    }

    const tl = el('div', 'timeline');
    let prevLoc = null;
    day.items.forEach(it => {
      if (it.loc && it.loc.lat != null && prevLoc) {
        const km = haversine(prevLoc, it.loc);
        if (km >= MIN_LEG_KM) tl.appendChild(legRow(km));
      }
      if (it.loc && it.loc.lat != null) prevLoc = it.loc;
      tl.appendChild(slotRow(it));
    });
    wrap.appendChild(tl);

    const pts = day.items.filter(i => i.loc && i.loc.lat != null).map(i => i.loc);
    if (pts.length) {
      const row = el('div', 'day__actions');
      const g = mapsLink('g', pts); g.textContent = 'Google Maps';
      const a = mapsLink('a', pts); a.textContent = 'Apple Maps';
      const w = mapsLink('w', pts); w.textContent = 'Waze';
      row.append(g, a, w);
      wrap.appendChild(row);
    }
    return wrap;
  }

  function slotRow(it) {
    const r = el('div', 'slot slot--' + it.t + (it.quiet ? ' slot--quiet' : ''));
    const time = el('div', 'slot__time');
    time.textContent = it.hora || '';
    const body = el('div', 'slot__body');
    body.innerHTML =
      `<div class="slot__tag">${esc(it.tag)}${it.nota ? ' · ' + esc(it.nota) : ''}</div>` +
      `<div class="slot__title">${esc(it.titulo)}</div>` +
      (it.sub ? `<div class="slot__sub">${esc(it.sub)}</div>` : '') +
      (it.notas ? `<details class="slot__notes"><summary>Info importante</summary><p>${esc(it.notas)}</p></details>` : '');
    if (it.loc && it.loc.lat != null) {
      const nav = el('div', 'slot__nav');
      const g = mapsLink('g', [it.loc]); g.className = 'slot__go'; g.textContent = 'Google Maps ›';
      const a = mapsLink('a', [it.loc]); a.className = 'slot__go'; a.textContent = 'Apple Maps ›';
      const w = mapsLink('w', [it.loc]); w.className = 'slot__go'; w.textContent = 'Waze ›';
      nav.append(g, a, w);
      body.appendChild(nav);
    }
    r.append(time, body);
    return r;
  }

  function legRow(km) {
    const r = el('div', 'leg');
    r.innerHTML = `<span class="leg__ico">🚗</span><span>≈ ${fmtDur(driveEst(km))} · ${km.toFixed(km < 10 ? 1 : 0)} km en coche</span>`;
    return r;
  }

  function unassignedBlock(items) {
    const w = el('section', 'day');
    w.innerHTML =
      `<div class="day__head"><h3 class="day__date">Por planificar</h3><span class="day__idx">${items.length}</span></div>`;
    w.appendChild(notice('Sin día asignado. Edita cada elemento y ponle una fecha dentro del viaje para colocarlo en el itinerario.'));
    const tl = el('div', 'timeline');
    items.forEach(it => tl.appendChild(slotRow(Object.assign({}, it, { hora: '' }))));
    w.appendChild(tl);
    return w;
  }

  function notice(txt) {
    const d = el('div', 'notice');
    d.textContent = txt;
    return d;
  }

  /* ==========================================================
     Enlaces a Google Maps / Apple Maps / Waze
     provider: 'g' = Google · 'a' = Apple · 'w' = Waze
     ========================================================== */
  function mapsLink(provider, pts) {
    const a = el('a', 'btn btn--ghost btn--sm');
    a.target = '_blank';
    a.rel = 'noopener';
    const P = (pts || []).filter(p => p && p.lat != null);

    if (provider === 'w') {
      // Waze no admite rutas con varias paradas: navega al destino final.
      const d = P[P.length - 1] || P[0];
      a.href = d ? `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes` : '#';
      return a;
    }

    if (provider === 'g') {
      if (P.length <= 1) {
        const p = P[0];
        a.href = p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : '#';
      } else {
        const o = P[0], d = P[P.length - 1];
        const w = P.slice(1, -1).slice(0, 9).map(p => `${p.lat},${p.lng}`).join('|');
        a.href = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}` +
          (w ? `&waypoints=${encodeURIComponent(w)}` : '');
      }
    } else {
      if (P.length <= 1) {
        const p = P[0];
        a.href = p ? `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${encodeURIComponent('Punto')}` : '#';
      } else {
        const o = P[0], d = P[P.length - 1];
        a.href = `https://maps.apple.com/?dirflg=d&saddr=${o.lat},${o.lng}&daddr=${d.lat},${d.lng}`;
      }
    }
    return a;
  }

  /* ==========================================================
     Pantalla: MAPAS
     ========================================================== */
  let map = null, dayLayer = null, mapData = null, selectedDay = 'all';
  let mapDirty = true, tileFallback = false;

  // Límites aproximados de Islandia (con un pequeño margen).
  const ISLANDIA_BOUNDS = [[62.9, -25.8], [67.6, -12.3]];

  function ensureMap() {
    if (map || typeof L === 'undefined') return;
    const elMap = document.getElementById('map');
    // No inicializar Leaflet en un contenedor oculto (tamaño 0): el mapa
    // quedaría roto. Se crea la primera vez que la pestaña es visible.
    if (!elMap || !elMap.clientHeight) return;

    map = L.map('map', {
      zoomControl: true,
      minZoom: 5,
      maxZoom: 17,
      maxBounds: ISLANDIA_BOUNDS,
      maxBoundsViscosity: 1,      // no deja arrastrar fuera de Islandia
      worldCopyJump: false
    }).fitBounds(ISLANDIA_BOUNDS);

    const carto = L.tileLayer('https://{s}.basemap.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    });
    let errs = 0;
    carto.on('tileerror', () => {
      if (tileFallback || ++errs < 5) return;
      tileFallback = true;
      map.removeLayer(carto);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);
    });
    carto.addTo(map);
    dayLayer = L.layerGroup().addTo(map);
  }

  function renderMapas() {
    const chips = $('#map-days');
    const mapEl = $('#map');
    chips.innerHTML = '';
    $('#map-actions').innerHTML = '';
    $('#map-legend').innerHTML = '';

    if (!state.meta.fechaInicio || !state.meta.fechaFin) {
      mapEl.style.display = 'none';
      chips.appendChild(notice('Añade las fechas del viaje para ver los mapas por día.'));
      mapData = null;
      return;
    }
    mapEl.style.display = '';
    mapData = buildItinerary();

    chips.appendChild(chipBtn('all', 'Todo el viaje', false));
    mapData.days.forEach(d => {
      const has = d.items.some(i => i.loc && i.loc.lat != null);
      chips.appendChild(chipBtn(d.date, 'Día ' + d.idx, !has));
    });

    if (selectedDay !== 'all' && !mapData.days.some(d => d.date === selectedDay)) selectedDay = 'all';

    mapDirty = true;
    refreshMap();
  }

  // Crea/redimensiona/redibuja el mapa. Seguro llamar en cualquier momento:
  // si la pestaña está oculta no hace nada y se completa al mostrarla.
  function refreshMap() {
    const elMap = document.getElementById('map');
    if (!elMap || !elMap.clientHeight || !mapData) return;
    if (typeof L === 'undefined') {
      elMap.innerHTML = '<p class="map-err">No se pudo cargar el mapa (Leaflet). Revisa la conexión y recarga la página.</p>';
      return;
    }
    ensureMap();
    if (!map) return;
    map.invalidateSize();
    if (mapDirty) { drawSelection(); mapDirty = false; }
  }

  function chipBtn(key, label, disabled) {
    const b = el('button', 'chip');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(selectedDay === key));
    if (disabled) { b.disabled = true; b.title = 'Sin ubicaciones con coordenadas'; }
    b.addEventListener('click', () => {
      selectedDay = key;
      $$('#map-days .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
      mapDirty = true;
      refreshMap();
    });
    return b;
  }

  function accentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#3fe0a5';
  }

  function drawSelection() {
    if (!map || !mapData) return;
    dayLayer.clearLayers();
    const actions = $('#map-actions');
    const legend = $('#map-legend');
    actions.innerHTML = '';
    legend.innerHTML = '';

    let pts = [];
    if (selectedDay === 'all') {
      mapData.days.forEach(d => d.items.forEach(i => {
        if (i.loc && i.loc.lat != null) pts.push(Object.assign({}, i, { badge: d.idx }));
      }));
    } else {
      const d = mapData.days.find(x => x.date === selectedDay);
      if (d) d.items.forEach((i, k) => {
        if (i.loc && i.loc.lat != null) pts.push(Object.assign({}, i, { badge: pts.length + 1 }));
      });
    }

    if (!pts.length) {
      legend.innerHTML = '<li class="legend__empty">No hay ubicaciones con coordenadas en esta selección. Añade coordenadas al editar cada elemento.</li>';
      map.setView([64.9, -18.9], 6);
      return;
    }

    const latlngs = [];
    pts.forEach(p => {
      const mk = L.marker([p.loc.lat, p.loc.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="num-marker">${p.badge}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      });
      mk.bindPopup(
        `<b>${esc(p.titulo)}</b>` +
        (p.hora ? `<br>${p.hora}` : '') +
        (p.loc.texto ? `<br><span class="pop-sub">${esc(p.loc.texto)}</span>` : '')
      );
      dayLayer.addLayer(mk);
      latlngs.push([p.loc.lat, p.loc.lng]);
    });

    if (selectedDay !== 'all' && latlngs.length > 1) {
      dayLayer.addLayer(L.polyline(latlngs, { color: accentColor(), weight: 3, opacity: 0.85, dashArray: '2 7' }));
    }
    map.fitBounds(latlngs, { padding: [42, 42], maxZoom: selectedDay === 'all' ? 9 : 12 });

    const locs = pts.map(p => p.loc);
    const g = mapsLink('g', locs);
    g.classList.remove('btn--sm');
    g.textContent = selectedDay === 'all' ? 'Google Maps (viaje)' : 'Google Maps';
    const a = mapsLink('a', locs);
    a.classList.remove('btn--sm');
    a.textContent = 'Apple Maps';
    const w = mapsLink('w', locs);
    w.classList.remove('btn--sm');
    w.textContent = 'Waze';
    actions.append(g, a, w);

    pts.forEach(p => {
      const li = el('li', 'legend__item');
      li.innerHTML =
        `<span class="legend__n">${p.badge}</span>` +
        `<span>${esc(p.titulo)}</span>` +
        `<span class="legend__t">${p.hora || ''}</span>`;
      li.addEventListener('click', () => map.setView([p.loc.lat, p.loc.lng], 12));
      legend.appendChild(li);
    });
  }

  /* ==========================================================
     Pantalla: RESUMEN
     ========================================================== */
  function renderResumen() {
    const pre = $('#resumen-text');
    pre.textContent = buildText();

    const hasDates = state.meta.fechaInicio && state.meta.fechaFin;
    const it = hasDates ? buildItinerary() : null;
    const km = it ? it.days.reduce((s, d) => s + d.km, 0) : 0;
    const nights = state.alojamientos.reduce(
      (s, a) => s + Math.max(0, eachDay(a.checkin, a.checkout).length - 1), 0
    );

    const stats = $('#resumen-stats');
    stats.innerHTML = '';
    [
      [it ? it.count : '—', 'días'],
      [state.vuelos.length, 'vuelos'],
      [nights, 'noches'],
      [state.excursiones.length, 'excursiones'],
      [state.lugares.length, 'lugares'],
      [km ? Math.round(km) + ' km' : '—', 'trayecto est.']
    ].forEach(([b, l]) => {
      const s = el('div', 'stat');
      s.innerHTML = `<b>${esc(String(b))}</b><span>${esc(l)}</span>`;
      stats.appendChild(s);
    });
  }

  function buildText() {
    const m = state.meta;
    const L = [];
    L.push((m.titulo || 'Viaje a Islandia').toUpperCase());

    if (m.fechaInicio && m.fechaFin) {
      const it = buildItinerary();
      L.push(`${fmtFecha(m.fechaInicio, true)} – ${fmtFecha(m.fechaFin, true)} · ${it.count} días`);
      L.push('');
      it.days.forEach(d => {
        L.push(`── DÍA ${d.idx} · ${cap(fmtDiaSemana(d.date))} ${fmtFecha(d.date)} ──`);
        if (!d.items.length) L.push('   (día libre)');
        let prev = null;
        d.items.forEach(i => {
          if (i.loc && i.loc.lat != null && prev) {
            const km = haversine(prev, i.loc);
            if (km >= MIN_LEG_KM) L.push(`          ↳ ≈ ${fmtDur(driveEst(km))} · ${km.toFixed(0)} km`);
          }
          if (i.loc && i.loc.lat != null) prev = i.loc;
          const h = (i.hora || '').padEnd(5, ' ');
          L.push(`   ${i.hora ? h : '     '}  ${i.titulo}${i.sub ? '  — ' + i.sub : ''}`);
        });
        L.push('');
      });
      if (it.unassigned.length) {
        L.push('── POR PLANIFICAR ──');
        it.unassigned.forEach(i => L.push(`   • ${i.titulo}${i.sub ? '  — ' + i.sub : ''}`));
        L.push('');
      }
    } else {
      L.push('(Añade las fechas del viaje para generar el itinerario por días.)');
      L.push('');
    }

    const block = (title, arr, fn) => {
      if (!arr.length) return;
      L.push(title);
      arr.forEach(fn);
      L.push('');
    };

    block('VUELOS', state.vuelos.slice().sort(itemSorter('vuelos')), v => {
      const tr = v.tramos || [];
      const a0 = tr[0] || {}, zN = tr[tr.length - 1] || {};
      L.push(`   ${v.tipo || ''}: ${a0.origen || ''} → ${zN.destino || ''}${v.reserva ? `  ·  Reserva: ${v.reserva}` : ''}`);
      tr.forEach((t, i) => {
        const s = dtParts(t.salida), a = dtParts(t.llegada);
        L.push(`     ${t.aerolinea || ''} ${t.numero || ''}${t.operadoPor ? ` (op. ${t.operadoPor})` : ''}${t.clase ? ` · ${t.clase}` : ''}`);
        L.push(`       ${t.origen || ''}${t.origenTerminal ? ` T${t.origenTerminal}` : ''} ${s.date ? fmtFecha(s.date) : ''} ${s.time || ''}  →  ${t.destino || ''}${t.destinoTerminal ? ` T${t.destinoTerminal}` : ''} ${a.date ? fmtFecha(a.date) : ''} ${a.time || ''}${t.duracion ? `  (${t.duracion})` : ''}`);
        if (i < tr.length - 1) {
          const lay = layoverMin(t.llegada, tr[i + 1].salida);
          L.push(`       -- escala${lay ? ' ' + fmtDur(lay) : ''} en ${t.destino || ''} --`);
        }
      });
    });

    block('COCHE DE ALQUILER', state.coches.slice().sort(itemSorter('coches')), v => {
      const r = dtParts(v.recogida), d = dtParts(v.devolucion);
      L.push(`   ${v.empresa || ''}${v.modelo ? ' — ' + v.modelo : ''}${v.reserva ? `  ·  Reserva: ${v.reserva}` : ''}`);
      L.push(`     Recogida:  ${r.date ? fmtFecha(r.date) : '—'} ${r.time || ''}${v.recogidaLugar && v.recogidaLugar.texto ? ' · ' + v.recogidaLugar.texto : ''}`);
      L.push(`     Devolución: ${d.date ? fmtFecha(d.date) : '—'} ${d.time || ''}${v.devolucionLugar && v.devolucionLugar.texto ? ' · ' + v.devolucionLugar.texto : ''}`);
      if (v.precio) L.push(`     Precio: ${v.precio}`);
      if (v.franquicia) L.push(`     Franquicia: ${v.franquicia}`);
      if (v.telefono) L.push(`     Tel.: ${v.telefono}`);
      if (v.notas) L.push(`     ${v.notas}`);
    });

    block('ALOJAMIENTOS', state.alojamientos.slice().sort(itemSorter('alojamientos')), a => {
      L.push(`   ${a.nombre || ''} — ${a.loc && a.loc.texto || ''}`);
      L.push(`     ${a.checkin ? fmtFecha(a.checkin) : '—'} → ${a.checkout ? fmtFecha(a.checkout) : '—'}${a.reserva ? `  ·  Reserva: ${a.reserva}` : ''}`);
      if (a.notas) L.push(`     ${a.notas}`);
    });

    block('EXCURSIONES', state.excursiones.slice().sort(itemSorter('excursiones')), e => {
      L.push(`   ${e.nombre || ''} — ${e.fecha ? fmtFecha(e.fecha) : 'sin fecha'} ${e.hora || ''}${e.duracion ? ` (${fmtDur(+e.duracion)})` : ''}`);
      if (e.encuentro && e.encuentro.texto) L.push(`     Encuentro: ${e.encuentro.texto}`);
      if (e.reserva) L.push(`     Reserva: ${e.reserva}`);
      if (e.notas) L.push(`     ${e.notas}`);
    });

    block('DÓNDE COMER', state.comidas.slice().sort(itemSorter('comidas')), c => {
      L.push(`   ${c.nombre || ''}${c.tipo ? ` (${c.tipo})` : ''} — ${c.loc && c.loc.texto || ''}${c.horario ? `  ·  ${c.horario}` : ''}${c.fecha ? `  ·  ${fmtFecha(c.fecha)}` : ''}`);
    });

    block('QUÉ VER', state.lugares.slice().sort((a, b) => (a.prioridad || '') < (b.prioridad || '') ? -1 : 1), l => {
      L.push(`   ${l.nombre || ''} [${l.prioridad || 'Media'}]${l.visita ? ` — ${fmtDur(+l.visita)}` : ''}${l.fecha ? `  ·  ${fmtFecha(l.fecha)}` : ''}`);
      if (l.loc && l.loc.texto) L.push(`     ${l.loc.texto}`);
    });

    L.push('— Generado con el planificador de viaje a Islandia —');
    return L.join('\n');
  }

  $('#btn-copiar').addEventListener('click', async () => {
    const text = $('#resumen-text').textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('Itinerario copiado.');
    } catch (e) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents($('#resumen-text'));
      sel.removeAllRanges();
      sel.addRange(range);
      try {
        document.execCommand('copy');
        toast('Itinerario copiado.');
      } catch (_) {
        toast('No se pudo copiar automáticamente.');
      }
      sel.removeAllRanges();
    }
  });

  $('#btn-compartir').addEventListener('click', async () => {
    const text = $('#resumen-text').textContent;
    if (navigator.share) {
      try {
        await navigator.share({ title: state.meta.titulo || 'Viaje a Islandia', text });
      } catch (e) { /* cancelado */ }
    } else {
      toast('Compartir no está disponible en este navegador.');
    }
  });

  $('#btn-descargar').addEventListener('click', () => {
    const blob = new Blob([$('#resumen-text').textContent], { type: 'text/plain;charset=utf-8' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.meta.titulo || 'viaje-islandia').replace(/[^\w\-]+/g, '_').toLowerCase() + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ==========================================================
     Ruta Google Maps
     ========================================================== */
  const RUTA_URL = 'https://maps.app.goo.gl/co4RMxLFR9xbP5eX7';
  $('#ruta-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(RUTA_URL);
      toast('Enlace copiado.');
    } catch (e) {
      toast('No se pudo copiar automáticamente.');
    }
  });

  /* ==========================================================
     Navegación por pestañas
     ========================================================== */
  const SCREENS = ['datos', 'itinerario', 'mapas', 'resumen', 'ruta'];

  function showScreen(name) {
    if (!SCREENS.includes(name)) name = 'datos';
    SCREENS.forEach(s => {
      $('#screen-' + s).hidden = (s !== name);
      const tab = $(`.tab[data-tab="${s}"]`);
      if (tab) tab.setAttribute('aria-current', s === name ? 'page' : 'false');
    });
    if (name === 'mapas') {
      // La sección ya es visible: inicializa/redibuja tras el reflujo.
      // Doble pasada (60 ms y 300 ms) para que Leaflet mida bien el contenedor.
      renderMapas();
      setTimeout(refreshMap, 60);
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    }
    window.scrollTo(0, 0);
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  }

  $$('.tab').forEach(t => t.addEventListener('click', () => showScreen(t.dataset.tab)));
  window.addEventListener('hashchange', () => showScreen(location.hash.slice(1)));

  /* ==========================================================
     Bottom sheet
     ========================================================== */
  function showSheet() {
    const s = $('#sheet');
    s.hidden = false;
    s.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => {
      s.classList.add('is-open');
      const f = s.querySelector('input, select, textarea, button');
      if (f) f.focus();
    });
  }
  function hideSheet() {
    const s = $('#sheet');
    s.classList.remove('is-open');
    s.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { s.hidden = true; $('#sheet-form').innerHTML = ''; }, 220);
    editing = null;
  }
  $$('#sheet [data-close]').forEach(b => b.addEventListener('click', hideSheet));

  /* ==========================================================
     Diálogo de confirmación
     ========================================================== */
  let confirmResolve = null;
  function confirmAsk(msg) {
    return new Promise(resolve => {
      confirmResolve = value => {
        $('#confirm').hidden = true;
        if ($('#sheet').hidden) document.body.classList.remove('no-scroll');
        confirmResolve = null;
        resolve(value);
      };
      $('#confirm-msg').textContent = msg;
      $('#confirm').hidden = false;
      document.body.classList.add('no-scroll');
      requestAnimationFrame(() => $('#confirm [data-ok]').focus());
    });
  }
  $$('#confirm [data-cancel]').forEach(b => b.addEventListener('click', () => confirmResolve && confirmResolve(false)));
  $('#confirm [data-ok]').addEventListener('click', () => confirmResolve && confirmResolve(true));

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) hideSheet();
    else if (!$('#confirm').hidden && confirmResolve) confirmResolve(false);
  });

  /* ==========================================================
     Toast
     ========================================================== */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('is-on');
      setTimeout(() => { t.hidden = true; }, 220);
    }, 2600);
  }

  /* ==========================================================
     Cuenta atrás hasta la salida del avión
     ========================================================== */
  function firstDeparture() {
    let best = null;
    state.vuelos.forEach(v => (v.tramos || []).forEach(t => {
      if (t.salida && (!best || t.salida < best)) best = t.salida;
    }));
    return best; // 'YYYY-MM-DDTHH:MM' o null
  }

  function countdownStr(depStr) {
    if (!depStr) return '';
    const dep = new Date(depStr).getTime();
    if (isNaN(dep)) return '';
    const ms = dep - Date.now();
    if (ms <= 0) return '¡Buen viaje!';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d >= 2) return d + ' días';
    if (d === 1) return '1 día ' + h + ' h';
    if (h >= 1) return h + ' h ' + m + ' min';
    return m + ' min';
  }

  function updateCountdown() {
    const box = $('#appbar-count');
    if (!box) return;
    const s = countdownStr(firstDeparture());
    if (!s) { box.hidden = true; return; }
    box.textContent = s === '¡Buen viaje!' ? '✈️ ¡Buen viaje!' : '✈️ ' + s;
    const dp = dtParts(firstDeparture());
    box.title = dp.date ? `Salida del vuelo: ${fmtFecha(dp.date, true)}, ${dp.time}` : 'Cuenta atrás para el viaje';
    box.hidden = false;
  }

  /* ==========================================================
     Arranque
     ========================================================== */
  function paintAppbar() {
    $('#appbar-title').textContent = state.meta.titulo || 'Viaje a Islandia';
    const m = state.meta;
    $('#appbar-sub').textContent = (m.fechaInicio && m.fechaFin)
      ? `${fmtFecha(m.fechaInicio)} – ${fmtFecha(m.fechaFin, true)}`
      : 'Sin fechas · añádelas en Datos';
    updateCountdown();
  }
  setInterval(updateCountdown, 60000);

  function renderAll() {
    paintAppbar();
    renderDatos();
    renderItinerario();
    renderMapas();
    renderResumen();
  }

  function initGazList() {
    const dl = $('#gaz-list');
    GAZ.forEach(g => { const o = el('option'); o.value = g.n; dl.appendChild(o); });
  }

  initGazList();
  renderAll();
  showScreen(location.hash.slice(1) || 'datos');

})();
