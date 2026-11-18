// Tiny static server for the demo. No dependencies.
//   npm start            → http://localhost:4173
//   PORT=5000 npm start  → another port
// It serves the demo files and one generated script, /env.js, that exposes ONLY the public map keys
// (MAP_BLOCK_KEY for Mapbox, LONGDO_MAP_KEY for Longdo) read from the process environment or from .env. Nothing else from .env is ever sent,
// and only the public/ folder is served (never .env, tests, node_modules or this file).
// /api/transit asks Longdo for public transport routes with LONGDO_KEY, which never leaves the server (see transitRoute below).
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
const AREAS = ['songwat', 'yaowarat', 'talatnoi', 'rattanakosin', 'samyan'];
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

/* Public transport routes from Longdo (walking + BTS/MRT/ARL + ferry), served as /api/transit?from=lat,lng&to=lat,lng&lang=en.
   The key (LONGDO_KEY) stays on the server; /env.js only says TRANSIT: true or false. Longdo keys are locked to a domain through
   the Referer (LONGDO_REFERER, default http://localhost). Answers are kept in memory for a few hours so redrawing a page does not
   spend Longdo's quota; nothing is written to disk. Calls are capped per minute and per day (free plan: 60 a minute, 5,000 a day). */
const LONGDO_TRANSIT = 'https://api.longdo.com/RouteServiceTransit/geojson/route';
const TRANSIT_TYPE = 1 | 8 | 64;              // Longdo TransitRouteType: walking, ferry, rapid transit (buses are left out)
const RIDE = { 11: 'ferry', 12: 'bus', 13: 'rail', 14: 'train' };   // Longdo TransitTurnCode
const transitKey = () => envKey('LONGDO_KEY');
const transitCache = new Map(), TRANSIT_TTL = 6 * 3600e3, TRANSIT_FAIL_TTL = 60e3, TRANSIT_MAX = 500;
const PER_MIN = 40, PER_DAY = Number(envKey('LONGDO_DAILY_MAX')) || 2000;
let recent = [], today = { day: '', n: 0 };
function allowUpstream() {
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  recent = recent.filter((t) => now - t < 60e3);
  if (today.day !== day) today = { day, n: 0 };
  if (recent.length >= PER_MIN || today.n >= PER_DAY) return false;
  recent.push(now); today.n++; return true;
}
/* Longdo GeoJSON -> {s, m, steps}: walk steps {kind:'walk', turn, name, m, s, coords} and rides {kind, line, from, to, m, s, wait, coords}.
   A ride is boarding station (distance 0, interval = wait), the line itself, then the alighting station. coords are [lat, lng]. */
function normalizeTransit(fc) {
  const steps = []; let ride = null;
  const close = () => { if (ride) { ride.line = ride.line.replace(/\s*\([^)]*\)\s*$/, ''); steps.push(ride); ride = null; } };
  for (const f of (fc && fc.features) || []) {
    const p = f.properties || {}, g = f.geometry || {};
    const co = (g.type === 'MultiLineString' ? (g.coordinates || []).flat() : g.coordinates || []).map(([x, y]) => [y, x]);
    const m = Math.round(Number(p.distance) || 0), s = Math.round(Number(p.interval) || 0), name = String(p.name || '');
    const kind = RIDE[p.turn];
    if (kind) {
      if (!ride) ride = { kind, line: '', from: m ? '' : name, to: '', m: 0, s: 0, wait: m ? 0 : s, coords: [] };
      if (m) { ride.line ||= name; ride.m += m; } else if (ride.from !== name || ride.line) ride.to = name;
      ride.s += s; ride.coords.push(...co);
      if (!m && ride.to) close();
    } else {
      close();
      if (p.turn === 9) continue;               // arrive
      steps.push({ kind: 'walk', turn: Number(p.turn), name, m, s, coords: co });
    }
  }
  close();
  return { s: steps.reduce((a, x) => a + x.s, 0), m: steps.reduce((a, x) => a + x.m, 0), steps };
}
async function fetchTransit(a, b, lang) {
  const q = new URLSearchParams({ flat: a[0], flon: a[1], tlat: b[0], tlon: b[1], mode: 'a', type: TRANSIT_TYPE, locale: lang, key: transitKey() });
  const r = await fetch(`${LONGDO_TRANSIT}?${q}`, { headers: { Referer: envKey('LONGDO_REFERER') || 'http://localhost' }, signal: AbortSignal.timeout(8000) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { throw new Error(`Longdo answered ${r.status}: ${text.slice(0, 80)}`); }   // a bad key comes back as 200 + "throw '...Key Error'"
  if (!r.ok || !Array.isArray(body.features)) throw new Error(`Longdo answered ${r.status} without a route`);
  return normalizeTransit(body);
}
const sendJSON = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
async function transitRoute(url, res) {
  const pt = (v) => { const m = String(v || '').match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/); const p = m && [Number(m[1]), Number(m[2])];
    return p && p[0] >= 5 && p[0] <= 21 && p[1] >= 97 && p[1] <= 106 ? p.map((x) => Math.round(x * 1e5) / 1e5) : null; };   // Thailand only
  const a = pt(url.searchParams.get('from')), b = pt(url.searchParams.get('to')), lang = url.searchParams.get('lang') === 'en' ? 'en' : 'th';
  if (!a || !b) return sendJSON(res, 400, { error: 'bad_point', message: 'from and to must be lat,lng inside Thailand.' });
  if (!transitKey()) return sendJSON(res, 503, { error: 'transit_off', message: 'No LONGDO_KEY on the server, so there is no public transport routing.' });
  const k = `${a}>${b}|${lang}`, hit = transitCache.get(k);
  if (hit && hit.until > Date.now()) { const v = await hit.v; return v.ok ? sendJSON(res, 200, v.route) : sendJSON(res, 502, v.err); }
  if (!allowUpstream()) return sendJSON(res, 429, { error: 'busy', message: 'Too many public transport requests right now. Try again in a minute.' });
  const v = fetchTransit(a, b, lang).then((route) => ({ ok: true, route }), (e) => {
    console.warn(`transit: ${e.message}`);
    return { ok: false, err: { error: 'longdo_failed', message: 'Longdo did not return a route.' } };
  });
  if (transitCache.size >= TRANSIT_MAX) transitCache.delete(transitCache.keys().next().value);
  const entry = { v, until: Date.now() + TRANSIT_TTL }; transitCache.set(k, entry);
  const out = await v;
  if (!out.ok) entry.until = Date.now() + TRANSIT_FAIL_TTL;
  return out.ok ? sendJSON(res, 200, out.route) : sendJSON(res, 502, out.err);
}

/* Vibe search from the dayoff-search service (SEARCH_API_URL, e.g. http://127.0.0.1:8000). When it answers, the demo moves to
   that service's area: /places.js serves its venues as the places (so the planner, map and chat all use them) together with
   window.DAYOFF_AREA (start point, area name, vibe vocabulary), and /api/search forwards each query. Without it, nothing changes. */
const searchUrl = () => envKey('SEARCH_API_URL').replace(/\/+$/, '');
const SEARCH_AREAS = {   // start = where a day begins and distances are measured from (OpenStreetMap node in startOsm)
  ratchayothin: { id: 'ratchayothin', start: { lat: 13.82975, lng: 100.56972 }, startOsm: 'node/6681609029',
                  startName: { en: 'BTS Ratchayothin', th: 'BTS รัชโยธิน' } },
};
const searchArea = () => SEARCH_AREAS[envKey('SEARCH_AREA') || 'ratchayothin'] || SEARCH_AREAS.ratchayothin;
const S_TYPE = { cafe: 'cafe', dessert: 'cafe', restaurant: 'food', bar: 'food' }, S_DUR = { cafe: 50, food: 45 };
function searchPlace(v) {
  const type = S_TYPE[v.category] || 'food';
  return { id: String(v.venue_id), src: 'search', en: v.name, th: v.name, area: searchArea().id, type, cat: v.category,
    icon: ICON[type], tone: TONE[type], lat: v.lat, lng: v.lng,
    h: v.opening_hours && Object.keys(v.opening_hours).length ? v.opening_hours : null,   // {"mon": [["08:00","18:00"]], ...}
    dur: S_DUR[type], tags: Object.fromEntries(TAGS.map((k) => [k, 0])),                    // the demo's own vibe axes do not apply
    price: v.price_level == null ? (type === 'cafe' ? 2 : 1) : clamp(v.price_level, 0, 3), priceEst: v.price_level == null,
    reviews: !!v.enriched };
}
let searchCache = { at: 0, data: null, pending: null };
function searchData() {   // venues + vocabulary; refreshed every 5 min, retried every 15 s while the service is down
  if (!searchUrl()) return Promise.resolve(null);
  if (Date.now() - searchCache.at < (searchCache.data ? 300e3 : 15e3)) return Promise.resolve(searchCache.data);
  searchCache.pending ||= (async () => {
    try {
      const get = async (p) => { const r = await fetch(searchUrl() + p, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) throw new Error(`${p} answered ${r.status}`); return r.json(); };
      const [v, voc] = await Promise.all([get('/venues'), get('/vocabulary')]);
      const places = (v.venues || []).filter((x) => x && x.venue_id && isFinite(x.lat) && isFinite(x.lng)).map(searchPlace);
      if (!places.length) throw new Error('no venues');
      const vibes = (voc.vibes || []).map((t) => ({ id: t.id, en: t.label_en, th: t.label_th }));
      if (!searchCache.data) console.log(`Search: ${places.length} places from ${searchUrl()}`);
      searchCache.data = { places, area: { ...searchArea(), search: true, vibes } };
    } catch (e) {   // keep the last good list: a running page must not lose its places
      console.warn(`search: ${searchUrl()} not usable (${e.message})${searchCache.data ? '; keeping the last place list' : "; using the demo's own places"}`);
    }
    searchCache.at = Date.now(); searchCache.pending = null;
    return searchCache.data;
  })();
  return searchCache.pending;
}
async function searchProxy(req, res) {
  if (!searchUrl()) return sendJSON(res, 503, { error: 'search_off', message: 'No SEARCH_API_URL on the server, so there is no vibe search.' });
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method', message: 'Use POST.' });
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 4096) return sendJSON(res, 413, { error: 'too_big', message: 'Request too large.' }); }
  let q; try { q = JSON.parse(body || '{}'); } catch { return sendJSON(res, 400, { error: 'bad_json', message: 'Body must be JSON.' }); }
  const a = searchArea(), here = Number.isFinite(q.lat) && Number.isFinite(q.lng);
  const payload = { query: String(q.query ?? '').slice(0, 300), time: 'any',   // the page applies its own clock and "open now" filter
    top_k: clamp(Math.round(Number(q.top_k) || 20), 1, 50), lat: here ? q.lat : a.start.lat, lng: here ? q.lng : a.start.lng };
  try {
    const r = await fetch(searchUrl() + '/search', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });   // an LLM parse can take a few seconds
    if (!r.ok) { console.warn(`search: /search answered ${r.status}`); return sendJSON(res, 502, { error: 'search_failed', message: `The search service answered ${r.status}.` }); }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(await r.text());
  } catch (e) {
    console.warn(`search: ${e.message}`);
    return sendJSON(res, 502, { error: 'search_down', message: 'The search service is not answering.' });
  }
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf' };
const blocked = /(^|\/)(\.|node_modules|tests|test-results|server\.mjs|package(-lock)?\.json|playwright\.config)/;

export function handler(req, res) {
  let url, rel;
  try { url = new URL(req.url, 'http://x'); rel = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }   // e.g. "//" or a stray "%": answer, do not crash the server
  if (rel === '/env.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(`window.DAYOFF_ENV=${JSON.stringify({ MAP_BLOCK_KEY: mapKey(), LONGDO_MAP_KEY: envKey('LONGDO_MAP_KEY'), TRANSIT: !!transitKey() })};`);
  }
  if (rel === '/api/transit') return transitRoute(url, res).catch((e) => { console.warn(`transit: ${e.message}`); if (!res.headersSent) sendJSON(res, 500, { error: 'server', message: 'Transit lookup failed.' }); });
  if (rel === '/places.js') return searchData().then((s) => {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(s ? `window.DAYOFF_PLACES=${JSON.stringify(s.places)};window.DAYOFF_AREA=${JSON.stringify(s.area)};`
              : `window.DAYOFF_PLACES=${JSON.stringify(placesNow())};`);
  });
  if (rel === '/api/search') return searchProxy(req, res).catch((e) => { console.warn(`search: ${e.message}`); if (!res.headersSent) sendJSON(res, 500, { error: 'server', message: 'Search failed.' }); });
  if (rel === '/') rel = '/day-off-redesign2.html';
  const file = path.join(pub, rel);
  if (!file.startsWith(pub + path.sep) || blocked.test(rel.slice(1))) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

// Run as a standalone server only when started directly (npm start / Docker); Vercel imports `handler` instead.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) http.createServer(handler).listen(port, () => {
  if (searchUrl()) searchData().then((s) => { if (!s) console.log(`Search: ${searchUrl()} not answering yet; the demo uses its own places until it does`); });
  else { const n = placesNow(); console.log(n ? `Places: ${n.length} from ${process.env.PLACES_FILE || 'data/places.json'}` : 'Places: bundled OpenStreetMap places (no data/places.json)'); }
  console.log(`Day-Off chat:    http://localhost:${port}/day-off-chat.html  (map token ${mapKey() ? 'found' : 'NOT found: using free tiles'})`);
  console.log(`Day-Off home:    http://localhost:${port}/  (new main page: day-off-home.html; public transport ${transitKey() ? 'from Longdo' : 'estimated: no LONGDO_KEY'})`);
  console.log(`Day-Off classic: http://localhost:${port}/day-off-demo.html  (old main page)`);
  console.log(`Compare all versions: http://localhost:${port}/versions.html`);
});
