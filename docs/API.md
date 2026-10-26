# Backend contract (proposal)

The front end is static and needs no backend today. This file says what it would need, so the backend can be built against it and the pages connected afterwards. It is a proposal: change anything that does not fit, then tell the front end.

## What lives in the browser now, and what a backend would replace

| Today (browser only) | Where | Backend replacement |
| --- | --- | --- |
| Trips: current, past, shared | `localStorage` keys `dayoff-trips`, `dayoff-current` | Trips API below |
| Share code `DO1-…` (the trip is inside the code) | `day-off-trips.html` | Short share links, so a trip can update after sharing |
| Friends, votes (sample data) | `day-off-room.html`, share sheet | Group trips |
| Places, hours, vibe scores (OpenStreetMap plus demo scores) | `public/shared/core.js` | Places API |
| Preferences: theme, language | `localStorage` | Optional, only with accounts |

The planner (ordering stops, walking time, "fits here", "I'm late") runs in the browser and should stay there. The backend stores and shares; it does not need to plan.

## Conventions

- JSON over HTTPS, base path `/api/v1`. Times are minutes from midnight (`600` = 10:00), as the front end already uses.
- Place ids are the existing string ids from `core.js` (for example `soheng`).
- Errors: `{ "error": "short_code", "message": "plain sentence" }` with a normal HTTP status.
- CORS: allow the front end's origin. If the front end and the API share one origin (a reverse proxy), no CORS is needed.
- Auth: none for the demo. If accounts are added later, use a bearer token and keep the same paths.

## Trips

A trip is what the front end saves today:

```json
{
  "id": "t_8fK2",
  "name": "Slow Sunday",
  "stops": ["soheng", "eiahsae", "gulongbao"],
  "startMin": 600,
  "endMin": 1080,
  "status": "current",
  "createdAt": "2026-10-21T09:00:00Z",
  "updatedAt": "2026-10-21T09:30:00Z"
}
```

`status` is `current` or `past`. There is at most one `current` trip per user.

| Method and path | Purpose |
| --- | --- |
| `GET /trips` | List trips (`?status=current|past|shared`) |
| `POST /trips` | Create a trip |
| `GET /trips/{id}` | One trip |
| `PATCH /trips/{id}` | Rename, change stops or times, finish (`status: "past"`) |
| `DELETE /trips/{id}` | Delete (the page offers Undo, so a soft delete for a short time is welcome) |
| `POST /trips/{id}/share` | Returns `{ "code": "k7Qm-2xPz", "url": "…" }` |
| `POST /trips/join` | Body `{ "code": "…" }`; adds a read-only copy to Shared with me |

The existing `?join=CODE` link on the Trips page would call `POST /trips/join`.

## Places (only if the team wants them served instead of bundled)

| Method and path | Purpose |
| --- | --- |
| `GET /places` | All places in the area, with hours, price band, tags |
| `GET /places/{id}` | One place |

A place keeps the shape used in `core.js`: `id, osm, en, th, area, type, cat, lat, lng, h` (OSM opening hours string), `dur` (default minutes), `tags` (vibe scores 0 to 5). Vibe scores are demo estimates today; if the backend produces real ones, the pages' "estimate" wording should change.

## How the front end would connect (front end side)

1. A small adapter file, `public/shared/api.js`, with the same functions the pages call now (`listTrips`, `saveTrip`, `deleteTrip`, `shareTrip`, `joinTrip`). It uses the API when a base URL is set and falls back to `localStorage` when it is not, so the demo keeps working with no backend.
2. The base URL is public, not a secret. Adding it to `/env.js` is a small change to `server.mjs`; that file currently exposes only the two map keys on purpose, so it is a decision to make together.
3. The Trips and Home pages are changed to call the adapter instead of `localStorage` directly.

## Vibe search (exists now, in `server.mjs`)

With `SEARCH_API_URL` set (the dayoff-search service), `/places.js` serves that service's venues (`GET /venues`, converted to the place shape above plus `src: "search"`, per-day `h` like `{"mon": [["08:00","18:00"]]}`, `reviews`, `priceEst`) and `window.DAYOFF_AREA` (`id`, `start`, `startName`, `vibes`). `POST /api/search {query, top_k?, lat?, lng?}` forwards to the service's `POST /search` with `time: "any"` and the area's start point; the response is the service's, unchanged. Errors: 503 `search_off`, 502 `search_down` / `search_failed`, 400 `bad_json`, 413 `too_big`.

## Public transport (exists now, in `server.mjs`)

`GET /api/transit?from=lat,lng&to=lat,lng&lang=en|th` returns a Longdo walk + rapid transit + ferry route, normalised:

```json
{ "s": 2212, "m": 4252, "steps": [
  { "kind": "walk", "turn": 1, "name": "Song Wat Rd.", "m": 202, "s": 202, "coords": [[13.7346, 100.5112], ...] },
  { "kind": "rail", "line": "Blue Bang Wa", "from": "MRT Hua Lamphong", "to": "MRT Sanam Chai", "m": 2824, "s": 851, "wait": 480, "coords": [...] }
] }
```

`s` is seconds (a ride's `s` includes `wait`), `m` metres, `coords` `[lat, lng]`. `kind` is `walk`, `rail`, `ferry`, `bus` or `train`; `turn` is Longdo's TurnCode (0 left, 1 right, 2 slight left, 3 slight right, 4 unknown, 5 straight). Errors: 400 `bad_point` (outside Thailand or malformed), 503 `transit_off` (no `LONGDO_KEY`), 429 `busy` (rate cap), 502 `longdo_failed`. A backend that replaces `server.mjs` should keep this path and shape.

## Questions for the backend

- Language and database? (Only matters for the Docker setup: a second service in `docker-compose.yml`.)
- Accounts, or anonymous trips with a device id?
- Should share links expire? Can a shared trip be edited by the people it is shared with?
