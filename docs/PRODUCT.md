# Product: Day-Off

Day-Off: Vibe-Grounded One-Day Trip Planning for Bangkok Neighbourhoods (เดย์ออฟ).
Capstone project. This folder holds the UX/UI demo only, with mock data.

## Register
Product / Operate. The visitor completes a task: describe a vibe, pick places, get a feasible one-day walking route.

## Users
Bangkok Gen Z, 18-27, planning a single day out. Phone first, one-handed, often outdoors in bright light. Thai by default, English supported.

## Job of the product
Atmosphere is searchable (per-place vibe scores with evidence) and a day is one object (3-6 stops optimised together for opening hours and walking time, re-plannable).

## Pilot zone
Yaowarat / Song Wat / Talat Noi. All place names, scores and quotes in the demo are sample data, not real venues.

## Tone
Clear, plain, friendly. Sentence case. Controls name their action. No marketing voice.

## Visual world: Wanderlog-style, no green
Reference: `docs/resource/wanderlog.png`. White page, `#F4F5F7` content surface, white cards, black/navy pills for secondary actions, one lantern-red accent (`#C93520`) for primary actions and stop numbers, gold only as a fill for "Best match". Mitr for headlines, IBM Plex Sans Thai for body (15px base). Green is not used anywhere (a test enforces it).
Layout: information column is 55% of the page width, real map is 45%. On phones the map fills the screen and the list is a bottom sheet that snaps to Map / Split / List (drag the handle, swipe the list, or tap the handle). Controls are 36px with a mouse and 44px on touch. Spacing scale 4/8/12/16/24/32.
Two themes, both driven by tokens on `:root` / `:root[data-theme="dark"]`; Light / Dark / System, saved in `localStorage` (`dayoff-theme`).

## Data honesty
Place names, coordinates and opening hours are real, copied from OpenStreetMap (element ids are in the file). Map tiles are OpenStreetMap; the walking route line comes from OSM routing when reachable. Vibe scores are demo estimates and are labelled as such. No review quotes or mention counts are shown for real venues. Price bands (Free / ฿ / ฿฿ / ฿฿฿) are category-level estimates and are labelled as such, because OpenStreetMap carries no prices. Open/closed uses the live Bangkok time (`?at=Sat-11:00` pins it for tests).

## Features shown (from `docs/resource/` capstone docs)
Vibe search with empty-query examples, fallback ranking and open-now / distance / price filters; venue detail with per-axis scores, mention count, recency, stale flag and hours-unknown state; day route with total length and walking distance, day-end window, constraint-specific "doesn't fit" reasons and an approximate-route notice; mid-trip done / skip / pin with visited stops locked on re-solve; next-stop suggestion (reject, accept, different type from last stop); shared trip with sample friend votes and a re-plan from group picks. "Load sample trip" jumps to a mid-trip state.

## Reference
Wanderlog-style day timeline with walking connectors and a map beside the list.

## Assumptions (no interview was possible; inferred from the brief)
- Single self-contained HTML file, no build step.
- Mobile-first, two-pane from 900px.
- Scoring, evidence, routing, friend votes and the demo clock (11:00) are mocked in the page; the real system reads a precomputed store.

## Filters and place detail
Filters are two live sliders (price, distance from Hua Lamphong MRT) plus "Open now". The place detail shows a photo (credited Wikimedia Commons photo near the place, else Wikipedia, else a Mapbox aerial view of the exact spot) and lets you set the time spent at the place (15-180 min); the same time can be nudged in 15-minute steps on each stop of the day.

## Chat version (`day-off-chat.html`)
Requested by the instructor: most users are lazy, so the same product runs as a conversation like Claude or LINE. `day-off-demo.html` is kept unchanged as the classic version; both are served by `server.mjs`. Same data, planner, map, themes and languages; no green.
- Chat is the main screen: one greeting, four starter chips (Chill cafe, Cheap street food, Open right now, Plan my whole day) and a "Load sample trip" link. After the first message a row of quick replies sits above the composer (Cheaper, Closer, Open now, Show filters, Plan my day, Where should I go next?, I'm 1 hour late, Share my trip).
- Replies are not a real AI: free text and chips go through regex intents (Thai and English) over the same scoring, filter and planner code. The greeting says so. Place cards, day card and suggestion card appear inside the chat.
- Map: phone shows a collapsible strip on top (full screen / hide / show); desktop keeps chat 55% | map 45%. Tapping a card photo pans the map; tapping a pin opens the place detail.
- "Your day" is one pinned bar above the composer; it opens the full timeline (reorder, stay stepper, done / skip / pin, Running late, Share, suggestions) as a panel over the chat column only, so the route stays visible on the map.
- Filters are a message with the two live sliders; dragging re-ranks the latest results message in place. Chips like Cheaper / Closer / Open now start a new results message.
- Entry: the classic page is the main one (`/` opens it). A round red chat button floats at the bottom right and opens the chat (on phones only on the first screen and when the sheet is lowered to the map, so it never covers the list); the chat header has an icon back to the classic page. Language and `?at=` carry across.
- Voice: a mic button in the composer (browser speech recognition, Thai or English to match the page language, hidden where unsupported). The recognised words are sent like typed text. The browser may send audio to its own speech service.
- Map switch: when both `MAP_BLOCK_KEY` and `LONGDO_MAP_KEY` exist, a Mapbox | Longdo toggle sits on the map; the choice is saved (`dayoff-map`).
- Tests: `tests/e2e/day-off-chat.spec.ts`.

## Experimental versions (`versions.html` compares them)
Five more complete UX/UI concepts, each its own page with its own flow and look, on the same places, hours and planner (shared code in `shared/`). They exist so the team can try them, weigh pros and cons, and bring the best parts into the main (classic) version. Full write-up with flows, pros and cons: `versions.html` and `VERSIONS.md`.
- `day-off-swipe.html` Swipe deck: swipe places, taste weights update, day builds from the keeps.
- `day-off-mixer.html` Mood mixer: draggable six-axis vibe radar, live list and map.
- `day-off-line.html` Day line: the day as a transit line with a time ruler and a fits-here picker.
- `day-off-room.html` Friends room: shared board, votes, plan from votes, fairness and cost (friends are sample data).
- `day-off-gonow.html` Go now: one next step, a leave-in countdown, hungry / hot / tired swaps.
The classic page (`/`) and the chat link to the hub with an icon in the header; every page has a version menu. These pages do not follow the classic palette: each has its own identity, still with no green. Tests: `tests/e2e/day-off-versions.spec.ts`.

## Manual order
Each open stop in the day view has a drag handle (mouse or touch) and a keyboard alternative (focus the handle, press up / down). A manual move switches the day to "Manual order": the planner keeps that order, flags a stop that no longer fits in place (closes before you finish, or past the day end) instead of dropping it, and hides pins. Visited stops stay locked on top. "Auto order" gives the order back to the optimiser, and undo restores either state.

## Main page upgrades (classic)
Taken from the experimental versions after the comparison (`versions.html`):
- First screen: a random question types in word by word (5 per language, new one each page load, plays once, instant with reduced motion); no description line, no "Try an example"; small vibe chips; a mic in the vibe box (browser speech recognition, hidden where unsupported, auto-searches); time budget (Half day / Full day and a start time) that sets the day window.
- Results: the whole card is the add / remove button (a check marks selected cards, ring around the card); vibe bars and a one-line "matches ..." come first, details second; "Why this match" and "Details" stay separate buttons.
- Sticky bottom bar: stop count, walking, "Fits your day" or "N may not fit"; also on the first screen once a place is added, with "Open my day".
- Day: a "Now" card (next stop, leave-in countdown, Done / Skip / I'm late), a proportional day bar (stops, walking, free time) with a "Fits here" suggestion that adds the best stop for the free time, and a bolder transit-style rail on the timeline. When the Now card shows, Done / Skip live there instead of inside the timeline.
- Tests: `tests/e2e/day-off.spec.ts` ("Main page upgrades").

## My day vs Now (classic)
Two separate screens. **My day** plans: start / end time, reorder, stay stepper, pin, remove, share, day bar, "Fits here", "Go to Now". It has no Done / Skip buttons. **Now** (fourth tab, enabled once the day has a stop) is for when you are out: progress strip; a walking card (next stop, walk minutes, leave-in countdown, distance from live location, Navigate, I've arrived, optional "Use my location"); after arriving a stay card (±15 min, Done next stop, Skip); "Change the plan from here" (Swap this stop, I'm late, Skip); Up next. A round button at the bottom centre opens the "Need an idea?" modal (hungry / hot / tired / where next, by voice, text or quick buttons): it lists up to 3 fitting places, each with Add to my day or Replace the current stop, plus More ideas and I'm late. Navigate opens walking directions in Google Maps (Apple Maps on iOS); the page map draws the current leg and a you-are-here dot. Live location is opt-in (browser permission) and the page works without it.
- Navigate (on the Now walking card) runs an in-page walking demo: a banner over the map with the next instruction ("In 85 m · Turn left"), distance and minutes left, a dot that walks the real OSM foot route (sped up about 25 times and labelled so), then "You've arrived" with an I've arrived button. Stop or leaving Now ends it. "Open in Maps" opens real walking directions in the maps app. `?navfast=1` makes the demo finish quickly (used by tests).
- Public transport (with `LONGDO_KEY` on the server): one Transit button replaces the BTS and MRT estimates. It shows Longdo's live door-to-door route (walk, BTS/MRT/ARL, ferry; station names, waiting time, the line on the map) and the Navigate demo follows it. "…" while Longdo answers; when Longdo finds only walking the button is off and says walking is better; when Longdo fails it falls back to the estimate and says so. The key never reaches the browser (`/api/transit` in `server.mjs`).
- Vibe search (with `SEARCH_API_URL`, the dayoff-search service): the demo switches to that service's area and places (Ratchayothin, start BTS Ratchayothin). Chat, mic and Places show the service's ranking; cards say what reviews say about the searched vibes and how many reviews, never the demo's estimate bars. Hours and price come from the service; too few reviews is said. If the service stops answering, places are listed nearest first and the page says so.
- No plan yet: the round ask button is on every screen. With an empty day it starts from now and from your location (or Hua Lamphong MRT), only offers places open now, nearest first, and each result has "Go now" (a one-stop trip on the Now screen) and "Add to a new day". Food styles (Japanese, Thai, noodles, seafood, dumplings, dessert, coffee) are matched on the OpenStreetMap category text and name; if nothing matches it says so and shows the nearest alternatives.

## Home version (day-off-home.html)
Merges the overlapping screens. Two tabs: **Home** (old Now + My day: where you are, the Now card, then the day timeline) and **Places** (browse, pick). The chat page is the only way to create or rework a plan: "Plan my day" / "Edit with chat" open it in a layer (`day-off-chat.html?embed=1`, optional `tray/start/end`) and it posts the plan back (`Use this plan`, `Pick places myself`, close). Places has one dock button, "Done, back to Home". No corner buttons or round ask button; "The round mic at bottom centre (Home only) records, then opens Places with the matches first.
- Home keeps a bottom day bar (stops, free time, "Fits here") fixed to the screen at all times. A header button opens **My trips** (`day-off-trips.html`): current trip (Continue, Finish and save, Share), past trips (Reuse as a new trip, Share, Rename, Delete with undo, two labelled samples) and shared trips. A share code ("DO1-…") carries the whole trip, so Join works with no server; `?join=CODE` joins on load. Trips are saved only in the browser (`dayoff-trips`, `dayoff-current`). `versions-compare.html` compares the old main page against Home and Trips; the old `versions.html` is unchanged.
