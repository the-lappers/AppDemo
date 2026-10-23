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
  if (rel === '/') rel = '/day-off-demo.html';
  const file = path.join(pub, rel);
  if (!file.startsWith(pub + path.sep) || blocked.test(rel.slice(1))) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`Day-Off chat:    http://localhost:${port}/day-off-chat.html  (map token ${mapKey() ? 'found' : 'NOT found: using free tiles'})`);
  console.log(`Day-Off classic: http://localhost:${port}/day-off-demo.html  (main page, also opens at /)`);
  console.log(`Compare all versions: http://localhost:${port}/versions.html`);
});
