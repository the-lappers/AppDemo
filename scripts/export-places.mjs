// Writes data/places.example.json from the bundled places: the exact shape the pages use, as a template for new data.
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync('public/shared/core.js', 'utf8');
const a = src.indexOf('const PLACES_BUNDLED = ['), b = src.indexOf('\n];', a);
const list = vm.runInNewContext(src.slice(a + 'const PLACES_BUNDLED = '.length, b + 3).replace(/;\s*$/, ''));
const price = vm.runInNewContext('(' + src.match(/const PRICE=(\{[^}]*\})/)[1] + ')');
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/places.example.json', JSON.stringify(list.map((p) => ({ ...p, price: price[p.id] })), null, 2) + '\n');
console.log(`Wrote data/places.example.json (${list.length} places)`);
