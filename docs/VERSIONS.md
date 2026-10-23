# Day-Off: demo versions

Two versions already existed. All five proposals below are now built as working demos (`day-off-swipe.html`, `day-off-mixer.html`, `day-off-line.html`, `day-off-room.html`, `day-off-gonow.html`). Open `versions.html` for the side-by-side comparison with screenshots, flows, pros and cons.

| # | Version | Status | One line |
|---|---------|--------|----------|
| A | Classic | built (`day-off-demo.html`) | Tabs (Vibe / Places / My day) with a map beside the list |
| B | Chat | built (`day-off-chat.html`) | Ask in words or voice, answers come as cards in a conversation |
| 1 | Swipe deck | built | Swipe places right or left, the day builds itself |
| 2 | Mood mixer | built | Move a few sliders or tap mood tiles, no typing |
| 3 | Day line (was Time canvas) | built | Drag blocks on a clock-shaped day, the app fills the gaps |
| 4 | Friends room | built | Plan together in a shared room, vote, merge tastes |
| 5 | Go now | built | A one-card-at-a-time live companion for the day itself |

All five reuse the same data, scoring, opening-hours and route planner, so each is mainly a new front end.

---

## 1. Swipe deck

**Idea.** Most users are lazy and like quick, playful choices. Show one place at a time as a big photo card. Swipe right to keep, left to skip. After about 8 swipes the app builds the day from the keeps.

**Features**
- One full-screen card: photo, name, 2 vibe bars, price, open or closed, walking minutes from the last keep.
- Swipe right keep, left skip, up "save for later", with button alternatives for each (no gesture-only actions).
- Undo the last swipe.
- A progress strip: "4 kept, need 3 to 6".
- "Build my day" runs the planner, then a short result screen with the route on a map.
- Re-plan: swipe again on a "suggest next" deck that skips types you already have.
- Skipped places feed back into the vibe ranking.

**User flow**
1. Open app, pick how long (half day, full day) and a start time.
2. Deck starts, ordered by best vibe match for the default mood.
3. Swipe 6 to 10 cards.
4. Tap "Build my day".
5. See route on a map with times; reorder, change stay time, or "swipe again" for a different stop.
6. Mid-trip: Done / Skip, then a fresh mini deck of 3 next stops.

**Pros**
- Fastest path to a plan, almost no reading or typing.
- Familiar to Gen Z, feels like a game, good for a live demo.
- Teaches the ranking: every swipe is a vibe signal.

**Cons**
- Hides the "why this place" evidence, which is the product's core claim, unless a tap flips the card.
- Swiping is hard to test and can fire by accident, so it needs buttons and undo.
- With 10 places in the pilot zone the deck ends fast.

**Effort:** medium.

---

## 2. Mood mixer

**Idea.** Atmosphere is searchable, but people struggle to describe a vibe in words. Let them mix it: a few sliders and picture tiles, with the map and results changing live.

**Features**
- 4 sliders: quiet to lively, old to new, cheap to treat, near to far.
- Mood tiles with a photo and a Thai/English label (old shophouse, riverside, street eats, art corner). Tap to add or remove.
- Live result count and map pins update as you drag.
- A "mix" saved as a shareable chip row (for example `calm + old + cheap`).
- Time budget and open-now toggle.
- Result list below, with "why this match" showing which slider drove it.

**User flow**
1. Open app, see sliders and tiles over the map.
2. Drag sliders or tap tiles; the pin cloud shrinks to what fits.
3. Tap a pin or list card to add it.
4. Tap "Plan my day", get the route.
5. Edit the mix later and the day re-plans.

**Pros**
- Answers the main UX problem directly: describing a vibe is hard.
- Shows the scoring model working, so it is strong for a capstone presentation.
- Works with no typing and no language barrier.

**Cons**
- More controls on screen; risk of feeling like a filter panel, not a trip app.
- Sliders are fiddly on a phone and need large hit areas.
- Needs the scores to be believable, since the demo ones are estimates.

**Effort:** medium.

---

## 3. Time canvas

**Idea.** A day is a time problem: opening hours, walking time, when the sun is hot. Make the day a vertical clock (08:00 to 22:00) where places are blocks and the app warns before something breaks.

**Features**
- Vertical timeline with draggable blocks; length equals stay time.
- Walking gaps drawn between blocks with minutes.
- Colour-free warnings: a stop closes before you finish, or runs past the day end, with the exact reason.
- Empty gaps show "Fits here" suggestions (a cafe at 14:00, a snack at 16:30).
- "Hot hours" band (11:00 to 15:00) nudging indoor or shaded stops.
- Map in a pull-up sheet, synced to the selected block.
- Running late: shift everything by 15 / 30 / 60 minutes and see what breaks.

**User flow**
1. Choose a start and end time.
2. Add a first place from search or a suggestion.
3. Drag it to a time; gaps show suggestions.
4. Tap a suggestion to fill a gap.
5. The planner shows conflicts; fix by moving or swapping.
6. On the day, "I'm late" shifts the rest.

**Pros**
- Strongest use of the opening-hours and walking-time logic, which is the real feasibility promise.
- Gives power users control; very clear about why a plan breaks.
- Close to the Wanderlog reference.

**Cons**
- More work for the user, the opposite of the lazy-user brief.
- Dragging on a small screen is hard; needs a keyboard and tap alternative.
- Weak for first-time users with no idea what to put first.

**Effort:** high.

---

## 4. Friends room

**Idea.** Gen Z plans outings in LINE groups. Make a trip a shared room: each friend sets a mood and votes, and the app merges them into one plan.

**Features**
- Create a room, get a link to paste into LINE.
- Each member picks a mood (a quick mixer or 3 tiles) and a budget.
- Shared shortlist with thumbs up or down per place and a live vote tally.
- "Merge tastes" explains the compromise: "3 of 4 like calm, 2 want cheap".
- One plan, one route, and a "who is where" strip (sample data in the demo).
- Split-the-bill estimate from price bands.
- Group re-plan when two people want to skip a stop.

**User flow**
1. Host creates a room and shares the link.
2. Friends open it, pick name and mood (no account).
3. Everyone swipes or votes on the shortlist.
4. Host taps "Plan from votes".
5. Room shows the plan; anyone can propose a change, others approve.
6. On the day, one tap marks a stop done for everyone.

**Pros**
- Matches how the target group already plans; strong story and differentiator.
- Reuses the shared-trip and group re-plan features from the capstone docs.
- Reduces the "where shall we go?" chat loop.

**Cons**
- A real room needs a backend; the demo can only fake friends with sample data.
- Hard to show well in a solo presentation.
- More privacy questions (names, locations).

**Effort:** high for real use, medium as a faked demo.

---

## 5. Go now

**Idea.** On the day itself, people do not want a planner, they want to know what is next. Show one card: the next stop, how far, how long you have, and one button for what happened.

**Features**
- Big "next stop" card: name, walking minutes, open until, a Go button that opens the map route.
- Countdown to "leave by" time for the stop after.
- Three buttons only: Done, Skip, Running late.
- Auto re-plan when a place is closed or you are late, with a plain one-line reason.
- "Hungry / hot / tired" quick buttons that swap the next stop for a fitting type.
- A thin day progress bar; tap it for the full plan.
- Works offline from the saved plan.

**User flow**
1. Open the app with a saved plan, or build one in 3 taps.
2. See the next-stop card, tap Go and walk.
3. At the stop, set a stay time (default 45 minutes).
4. Tap Done; the card changes to the next stop.
5. If late or tired, tap that button and the plan adjusts.
6. At the end, a recap with the walked distance and a share image.

**Pros**
- Simplest screen of all; ideal for one hand, bright sun, low battery.
- Shows the re-plan feature at its most useful moment.
- Good second half of a demo after a planning version.

**Cons**
- Not a discovery tool; useless without a plan.
- Real value needs live location and a background connection, which a static demo cannot show.
- The demo needs a faked clock and a faked position.

**Effort:** low to medium.

---

## How they compare

| | Typing needed | Speed to first plan | Shows the vibe scoring | Shows the opening-hours logic | Works as a solo demo | Effort |
|---|---|---|---|---|---|---|
| A Classic | some | medium | yes | yes | yes | done |
| B Chat | some or voice | fast | yes | yes | yes | done |
| 1 Swipe deck | none | fastest | partly | yes | yes | medium |
| 2 Mood mixer | none | fast | best | partly | yes | medium |
| 3 Time canvas | none | slow | no | best | yes | high |
| 4 Friends room | none | medium | partly | yes | weak | high |
| 5 Go now | none | n/a | no | yes | yes | low |

## Suggestion

Build **2 Mood mixer** (best proof of the core idea) and **5 Go now** (lowest effort, strongest re-plan story). Together with the chat they cover planning by talking, planning by mixing, and living the day. Build **1 Swipe deck** next if you want a fun, fast front door. Keep **3** and **4** as future work in the report.

Same constraints as the others: Thai and English, light and dark, no green, 44px touch targets, keyboard alternatives for every gesture, honest labels for demo data.
