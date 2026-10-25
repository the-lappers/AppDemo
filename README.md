# Day-Off

A one-day Bangkok trip planner demo for Yaowarat, Song Wat and Talat Noi. It is built for Gen Z travellers (18 to 27), works in Thai and English, and has Light, Dark and System themes. This is a UX/UI capstone prototype: static HTML pages and a tiny Node server, no database, no build step.

The place data comes from OpenStreetMap. Vibe scores, price bands and friends are demo data, and the pages say so.

## Run it

Pick one way.

**With Node (needs Node 20 or newer)**

```
make start
```

Then open http://localhost:4173. No `npm install` is needed to run the demo. Without `make`: `node server.mjs`.

**With Docker**

```
make docker-up      # http://localhost:4173
make docker-down    # stop it
```

Run `make` on its own to list every command. Use `PORT=5000 make start` for another port.

## Map keys (optional)

The demo works without keys, using free map tiles. To use Mapbox or Longdo maps:

1. `make env` creates a `.env` file from `.env.example`.
2. Open `.env` and paste your keys: `MAP_BLOCK_KEY` (a public Mapbox token starting with `pk.`) and `LONGDO_MAP_KEY`.

## Live public transport (optional)

Add `LONGDO_KEY` to `.env` (a Longdo Map key, from map.longdo.com) and restart. The home page's Navigate card then shows one **Transit** button instead of the BTS and MRT estimates. It asks Longdo for a real door-to-door route: walking plus BTS, MRT, Airport Rail Link and ferry, with station names, waiting time and the route on the map. Longdo chooses the lines itself, which is why BTS and MRT become one button.

- The key stays on the server. The page calls `/api/transit` on our own server, and `/env.js` only says `TRANSIT: true`.
- Nothing is stored on disk. Answers are kept in memory for 6 hours, so redrawing the page does not spend your quota. The server also stops at 40 Longdo calls a minute and 2,000 a day (`LONGDO_DAILY_MAX`); Longdo's free plan allows 60 and 5,000.
- Longdo keys are locked to a domain through the Referer header. The server sends `http://localhost`; set `LONGDO_REFERER` if your key is registered for another domain.
- Without a key, or when Longdo does not answer, the page falls back to the old BTS/MRT estimates and says so.

Never commit `.env`. It is already in `.gitignore`, and the server only serves the `public/` folder. The only values sent to the browser are those two public keys, through `/env.js`. Restrict the Mapbox token to your site URLs in the Mapbox dashboard.

## Vibe search (optional)

The real search lives in the `dayoff-search` repo, next to this one. When it is running, the demo uses it:

```
# in ../dayoff-search (see its README; needs local/ data and config/local_ratchayothin.yaml)
.venv/bin/python -m dayoff.api --config config/local_ratchayothin.yaml      # http://127.0.0.1:8000
# here: put SEARCH_API_URL=http://127.0.0.1:8000 in .env, then
make start
```

- The demo moves to the search service's area (Ratchayothin): its venues become the places on the map, in the planner and in the chat, and a day starts at BTS Ratchayothin.
- Typed searches (chat), the mic and Places use the service: results are its ranking, and each card says what reviews say ("Reviews call it bright, leafy", review counts in Why this match and Details). Without a vibe in the query, the nearest places come first.
- Opening hours and price come from the service (Google Maps); places with too few reviews say so.
- The browser only talks to this server (`/api/search`), which forwards to `SEARCH_API_URL`. If the service is not running, the demo uses its own Chinatown places; if it stops later, the page says so and lists places nearest first.
- The Ratchayothin data is a local-only Google Maps scrape: never publish it or screenshots of it.

## Your own place data

Drop a `data/places.json` next to the example file and restart. The pages use it instead of the bundled places, with no code change. See `data/README.md` for the fields (common names like `name_en`, `latitude`, `opening_hours` are accepted). With no file, the bundled OpenStreetMap places are used. In Docker, `./data` is mounted into the container.

## Pages

| Page | What it is |
| --- | --- |
| `/` or `/day-off-home.html` | New main page (the default): Now and My day merged, chat is the only planner, Places is a modal, bottom day bar, travel modes |
| `/day-off-trips.html` | My trips: current, past, share and join |
| `/versions-compare.html` | Before and after the flow redesign |
| `/day-off-demo.html` | Old main page, before the redesign |
| `/day-off-chat.html` | Chat version |
| `/day-off-swipe.html`, `-mixer`, `-line`, `-room`, `-gonow` | Five experimental concepts |
| `/versions.html` | Compare all eight versions |

Add `?lang=en` for English and `&at=Sat-11:00` to pin the clock to Saturday 11:00, so open and closed states are predictable. Add `&voice=demo` to try the microphone flow without a real speech service.

## Tests

```
make test-install   # once: installs Playwright and its Chromium browser
make test
```

The tests start their own server on port 4174 with fake keys, and stub map tiles, photos and routing, so they never spend a real key and do not need the internet.

## Folder layout

```
public/            everything the browser loads (the only folder the server serves)
  day-off-*.html     the pages
  shared/            shared CSS, JS, icons and preview images
server.mjs         the static server (also writes /env.js)
tests/e2e/         Playwright tests
data/              place data (places.json) and the format
docs/              PRODUCT.md (decisions), VERSIONS.md, research files
scripts/           helper scripts used by the Makefile
Makefile  Dockerfile  docker-compose.yml  .env.example
```

## Known limits

- Not tested on a physical phone or with a real microphone.
- Trips are stored only in the browser (`localStorage`). A share code carries the whole trip, so joining needs no server.
- The embedded chat inside Home is a page inside a page, so language and theme do not sync back.
- Without `LONGDO_KEY`, BTS and MRT times, stops and station positions are demo estimates, not timetables. With it, Transit is live from Longdo (home page only; the other pages still use the estimates).
- Walking routes come from the public OSM routing service. If it is down, the pages fall back to straight-line estimates and say so.

More on the design decisions: `docs/PRODUCT.md`.
