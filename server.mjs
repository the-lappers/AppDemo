// Tiny static server for the demo. No dependencies.
//   npm start            → http://localhost:4173
//   PORT=5000 npm start  → another port
// It serves the demo files and one generated script, /env.js, that exposes ONLY the public map keys
// (MAP_BLOCK_KEY for Mapbox, LONGDO_MAP_KEY for Longdo) read from the process environment or from .env. Nothing else from .env is ever sent,
// and only the public/ folder is served (never .env, tests, node_modules or this file).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, 'public');            // only this folder is ever served
const port = Number(process.env.PORT) || 4173;

function readDotEnv() {
  try {
    const out = {};
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch { return {}; }
}
const envKey = (name) => (process.env[name] ?? readDotEnv()[name] ?? '').trim();
const mapKey = () => envKey('MAP_BLOCK_KEY');

/* Places from a data file (data/places.json, or PLACES_FILE). Served as /places.js; the pages use them instead of the bundled places.
   Accepts an array or {places:[...]}, and common field names. Bad records are skipped with a warning. */
const TYPES = ['cafe', 'food', 'art', 'shrine', 'temple', 'market'];
const ICON = { cafe: 'coffee', food: 'food', art: 'palette', shrine: 'shrine', temple: 'shrine', market: 'market' };
const TONE = { cafe: 'ink', food: 'red', art: 'slate', shrine: 'gold', temple: 'gold', market: 'gold' };
const TAGS = ['calm', 'oldtown', 'street', 'art', 'river', 'lively'];
const AREAS = ['songwat', 'yaowarat', 'talatnoi'];
const pick = (o, ...k) => { for (const x of k) if (o[x] != null && o[x] !== '') return o[x]; };
const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function normalizePlace(r, i) {
  const en = String(pick(r, 'en', 'name_en', 'nameEn', 'name') ?? '').trim();
  const th = String(pick(r, 'th', 'name_th', 'nameTh') ?? en).trim();
  const lat = Number(pick(r, 'lat', 'latitude')), lng = Number(pick(r, 'lng', 'lon', 'long', 'longitude'));
  if (!en || !isFinite(lat) || !isFinite(lng)) throw new Error('needs a name, lat and lng');
  const rawType = String(pick(r, 'type', 'category') ?? '').toLowerCase();
  const type = TYPES.includes(rawType) ? rawType : /cafe|coffee/.test(rawType) ? 'cafe' : /gallery|art|museum/.test(rawType) ? 'art' : /shrine/.test(rawType) ? 'shrine' : /temple|wat/.test(rawType) ? 'temple' : /market/.test(rawType) ? 'market' : 'food';
  const area = AREAS.includes(r.area) ? r.area : 'yaowarat';
  const t = r.tags && typeof r.tags === 'object' ? r.tags : {};
  const tags = Object.fromEntries(TAGS.map((k) => [k, clamp(Math.round(Number(t[k] ?? 3)) || 0, 0, 5)]));
  const price = pick(r, 'price', 'price_level'); 
  return { id: String(pick(r, 'id', 'slug', 'place_id') ?? (slug(en) || 'place-' + i)), osm: String(pick(r, 'osm') ?? ''), en, th, area, type,
    cat: String(pick(r, 'cat', 'category') ?? type), icon: r.icon || ICON[type], tone: r.tone || TONE[type], lat, lng,
    h: String(pick(r, 'h', 'opening_hours', 'hours') ?? ''), dur: clamp(Math.round(Number(pick(r, 'dur', 'duration')) || 45), 10, 240), tags,
    ...(price != null && isFinite(Number(price)) ? { price: clamp(Math.round(Number(price)), 0, 3) } : {}) };
}
function loadPlaces() {
  const file = path.resolve(root, process.env.PLACES_FILE || 'data/places.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') console.warn(`places: cannot read ${file}: ${e.message}`); return null; }
  const list = Array.isArray(raw) ? raw : Array.isArray(raw && raw.places) ? raw.places : [];
  const out = [], seen = new Set();
  list.forEach((r, i) => {
    try { const p = normalizePlace(r || {}, i); if (seen.has(p.id)) throw new Error('duplicate id ' + p.id); seen.add(p.id); out.push(p); }
    catch (e) { console.warn(`places: record ${i} skipped (${e.message})`); }
  });
  return out.length ? out : null;
}
let placesCache = { at: 0, list: null };
const placesNow = () => { const f = path.resolve(root, process.env.PLACES_FILE || 'data/places.json'); let m = 0; try { m = fs.statSync(f).mtimeMs; } catch {} if (m !== placesCache.at) placesCache = { at: m, list: loadPlaces() }; return placesCache.list; };

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf' };
const blocked = /(^|\/)(\.|node_modules|tests|test-results|server\.mjs|package(-lock)?\.json|playwright\.config)/;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/env.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(`window.DAYOFF_ENV=${JSON.stringify({ MAP_BLOCK_KEY: mapKey(), LONGDO_MAP_KEY: envKey('LONGDO_MAP_KEY') })};`);
  }
  if (rel === '/places.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(`window.DAYOFF_PLACES=${JSON.stringify(placesNow())};`);
  }
  if (rel === '/') rel = '/day-off-home.html';
  const file = path.join(pub, rel);
  if (!file.startsWith(pub + path.sep) || blocked.test(rel.slice(1))) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => {
  { const n = placesNow(); console.log(n ? `Places: ${n.length} from data/places.json` : 'Places: bundled OpenStreetMap places (no data/places.json)'); }
  console.log(`Day-Off chat:    http://localhost:${port}/day-off-chat.html  (map token ${mapKey() ? 'found' : 'NOT found: using free tiles'})`);
  console.log(`Day-Off home:    http://localhost:${port}/  (new main page: day-off-home.html)`);
  console.log(`Day-Off classic: http://localhost:${port}/day-off-demo.html  (old main page)`);
  console.log(`Compare all versions: http://localhost:${port}/versions.html`);
});
