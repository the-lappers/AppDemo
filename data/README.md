# Place data

Put your own places in `data/places.json` and restart the server (`make start`). The pages use them instead of the bundled OpenStreetMap places. Delete the file to go back to the bundled places. Check the startup line: `Places: 12 from data/places.json`.

`data/places.example.json` is the exact shape the pages use (run `make places-template` to rebuild it).

## Format

An array of places, or `{ "places": [ ... ] }`.

| Field | Needed | Notes |
| --- | --- | --- |
| `en` (or `name_en`, `name`) | yes | English name |
| `th` (or `name_th`) | no | Thai name, defaults to the English one |
| `lat`, `lng` (or `latitude`, `longitude`, `lon`) | yes | Decimal degrees |
| `id` | no | Unique and stable (used in saved trips and share codes). Made from the name if missing |
| `type` (or `category`) | no | `cafe`, `food`, `art`, `shrine`, `temple` or `market`. Free text such as "coffee shop" is matched. Default `food` |
| `area` | no | `songwat`, `yaowarat` or `talatnoi`. Default `yaowarat` |
| `h` (or `opening_hours`, `hours`) | no | OpenStreetMap opening-hours text, for example `Mo-Su 09:00-18:00` or `Tu-Su 10:00-18:00`. Empty means "hours unknown" |
| `dur` | no | Minutes people usually stay. Default 45 |
| `price` | no | 0 free, 1 street or market, 2 cafe, 3 sit-down. Default 1 |
| `tags` | no | Vibe scores 0 to 5 for `calm`, `oldtown`, `street`, `art`, `river`, `lively`. Missing scores become 3 |
| `osm`, `cat`, `icon`, `tone` | no | Source id, category text and icon/colour. Filled in from `type` when missing |

Records without a name or coordinates, and repeated ids, are skipped with a warning in the server log.

Vibe scores are shown as estimates. If your data has real scores or reviews, tell the front end so the wording can change.

Other file or location: `PLACES_FILE=path/to/file.json make start`.
