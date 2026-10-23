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

Never commit `.env`. It is already in `.gitignore`, and the server only serves the `public/` folder. The only values sent to the browser are those two public keys, through `/env.js`. Restrict the Mapbox token to your site URLs in the Mapbox dashboard.

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
- BTS and MRT times, stops and station positions are demo estimates, not timetables.
- Walking routes come from the public OSM routing service. If it is down, the pages fall back to straight-line estimates and say so.

More on the design decisions: `docs/PRODUCT.md`.
