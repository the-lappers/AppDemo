// Creates .env from .env.example if it does not exist yet. Never overwrites an existing .env.
import fs from 'node:fs';
if (fs.existsSync('.env')) {
  console.log('.env already exists, leaving it alone.');
} else {
  fs.copyFileSync('.env.example', '.env');
  console.log('Created .env. Open it and paste your map keys (the demo also works without them, on free map tiles).');
}
