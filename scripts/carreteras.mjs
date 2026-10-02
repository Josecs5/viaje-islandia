// Estado de carreteras para la app (Ideas → «Ruta del día»).
// Vegagerðin publica datos abiertos en vivo pero sin CORS, así que el navegador
// no puede leerlos. Este script (lo corre la GitHub Action carreteras.yml cada
// 2 h) junta las estaciones meteorológicas de carretera —que traen coordenadas—
// con el estado del tramo al que pertenece cada una, y escribe un JSON compacto
// que la app lee desde raw.githubusercontent.com (rama «datos», con CORS).
//
// Uso: node scripts/carreteras.mjs <salida.json>
import { writeFileSync } from 'node:fs';

const API = 'https://gagnaveita.vegagerdin.is/api/';

async function get(name) {
  const r = await fetch(API + name, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j) || !j.length) throw new Error(`${name}: respuesta vacía`);
  return j;
}

// "2.10.2026 14:50:00" (hora de Islandia = UTC) → ISO
function isoDags(s) {
  const m = String(s || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{2}):(\d{2})/);
  if (!m) return null;
  const p = n => String(n).padStart(2, '0');
  return `${m[3]}-${p(m[2])}-${p(m[1])}T${m[4]}:${m[5]}:00Z`;
}
const r1 = x => (typeof x === 'number' && isFinite(x) ? Math.round(x * 10) / 10 : null);

const [faerd, vedur] = await Promise.all([get('faerd2017_1'), get('vedur2014_1')]);

const tramos = {};
faerd.forEach(b => {
  tramos[b.IdButur] = {
    n: b.FulltNafnButs || b.StuttNafnButs || '',
    c: b.AstandYfirbord || '',
    is: b.AstandLysing || '',
    en: b.AstandLysingEn || '',
    t: b.DagsSkrad || null
  };
});

const usados = new Set();
const estaciones = vedur
  .filter(s => typeof s.Breidd === 'number' && typeof s.Lengd === 'number')
  .map(s => {
    const ids = [s.IdButur1, s.IdButur2].filter(id => id != null && tramos[id]);
    ids.forEach(id => usados.add(id));
    return {
      n: s.Nafn,
      lat: Math.round(s.Breidd * 1e5) / 1e5,
      lng: Math.round(s.Lengd * 1e5) / 1e5,
      h: s.Haed != null ? Math.round(s.Haed) : null,
      t: isoDags(s.Dags),
      w: r1(s.Vindhradi),     // m/s
      g: r1(s.Vindhvida),     // m/s
      dir: (s.VindattAscEng || '').trim() || null,
      ta: r1(s.Hiti),         // °C aire
      tr: r1(s.Veghiti),      // °C asfalto
      b: ids.map(String)
    };
  });

const out = {
  fetched: new Date().toISOString(),
  fuente: 'Vegagerðin (gagnaveita.vegagerdin.is)',
  estaciones,
  tramos: Object.fromEntries([...usados].map(id => [String(id), tramos[id]]))
};

const file = process.argv[2] || 'carreteras.json';
writeFileSync(file, JSON.stringify(out));
console.log(`${estaciones.length} estaciones, ${usados.size} tramos → ${file}`);
