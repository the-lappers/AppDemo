import { test, expect, Page } from '@playwright/test';

/* Vibe search through the dayoff-search service. The test server runs without SEARCH_API_URL (playwright.config.ts), so
   /places.js and /api/search are faked here: five places near BTS Ratchayothin and one search answer. No real data is used. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const week = (o: string, c: string, skip: string[] = []) =>
  Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter((d) => !skip.includes(d)).map((d) => [d, [[o, c]]]));
const place = (id: string, en: string, type: string, lat: number, lng: number, h: unknown, extra = {}) => ({
  id, src: 'search', en, th: en, area: 'ratchayothin', type, cat: type === 'cafe' ? 'cafe' : 'restaurant',
  icon: type === 'cafe' ? 'coffee' : 'food', tone: type === 'cafe' ? 'ink' : 'red', lat, lng, h, dur: type === 'cafe' ? 50 : 45,
  tags: { calm: 0, oldtown: 0, street: 0, art: 0, river: 0, lively: 0 }, price: 2, priceEst: true, reviews: true, ...extra });
const PLACES = [
  place('v-bright', 'Bright Room Cafe', 'cafe', 13.8302, 100.5701, week('08:00', '20:00')),
  place('v-leafy', 'Leafy Corner', 'cafe', 13.8311, 100.5689, week('09:00', '18:00', ['sat'])),     // closed on Saturdays
  place('v-noodle', 'Noodle House', 'food', 13.8289, 100.5712, week('10:00', '21:00')),
  place('v-late', 'Late Kitchen', 'food', 13.8279, 100.5695, week('17:00', '01:00')),
  place('v-quiet', 'Quiet Cup', 'cafe', 13.8320, 100.5720, null, { reviews: false }),
];
const AREA = { id: 'ratchayothin', search: true, start: { lat: 13.82975, lng: 100.56972 }, startOsm: 'node/6681609029',
  startName: { en: 'BTS Ratchayothin', th: 'BTS รัชโยธิน' },
  vibes: [{ id: 'bright', en: 'bright', th: 'สว่าง' }, { id: 'green', en: 'leafy', th: 'ต้นไม้เยอะ' }, { id: 'cozy', en: 'cozy', th: 'อบอุ่น' }] };
const hit = (id: string, score: number, matched: string[], mentions: Record<string, number>) => ({
  venue_id: id, name: id, category: 'cafe', lat: 0, lng: 0, opening_hours: null, price_level: null, score, components: {},
  open_status: 'open', distance_km: 0.2, display: {},
  atmosphere_evidence: Object.fromEntries(Object.entries(mentions).map(([k, n]) => [k, { review_mentions: n, has_evidence: n > 0 }])),
  vibe_match: { status: matched.length === 2 ? 'all' : matched.length ? 'some' : 'none', matched, not_matched: ['bright', 'green'].filter((x) => !matched.includes(x)) },
  amenity_evidence: {}, amenity_match: null });
const ANSWER = { notice: null, time_context: null, query: 'q', scope: 'all', degraded: false, degraded_reason: null, atmosphere_coverage: {},
  parsed: { atmosphere_weights: { bright: 1, green: 1 }, amenity_weights: {}, amenity_targets: {}, display_fields: [],
            hard_constraints: { radius_km: null, categories: ['cafe'], required_amenities: {} } },
  results: [hit('v-bright', 0.71, ['bright', 'green'], { bright: 7, green: 3 }), hit('v-leafy', 0.55, ['green'], { bright: 0, green: 4 }),
            hit('v-quiet', 0.3, [], { bright: 0, green: 0 })] };

async function searchWorld(page: Page, answer: (body: any) => { status: number; body: unknown } = () => ({ status: 200, body: ANSWER })) {
  const asked: any[] = [];
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|api\.mapbox\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/wikipedia\.org|commons\.wikimedia\.org|routing\.openstreetmap\.de/, (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.route('**/places.js', (r) => r.fulfill({ contentType: 'text/javascript',
    body: `window.DAYOFF_PLACES=${JSON.stringify(PLACES)};window.DAYOFF_AREA=${JSON.stringify(AREA)};` }));
  await page.route('**/api/search', (r) => { const b = JSON.parse(r.request().postData() || '{}'); asked.push(b); const a = answer(b);
    r.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) }); });
  return asked;
}
const HOME = '/day-off-home.html?lang=en&at=Sat-11:00&voice=demo';
const CHAT = '/day-off-chat.html?lang=en&at=Sat-11:00';
async function say(page: Page, text: string) { await page.locator('#msg').fill(text); await page.keyboard.press('Enter'); }

test.describe('Vibe search service on Home', () => {
  test('the mic search shows the service ranking with what reviews say, in the service area', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    const asked = await searchWorld(page);
    await page.goto(HOME);
    await expect(page.getByTestId('home-loc')).toContainText('Ratchayothin');
    await page.getByTestId('home-mic').click();
    const rows = page.getByTestId('results').locator('li.row');
    await expect(rows.first()).toContainText('Bright Room Cafe');
    await expect(rows.first()).toContainText('Reviews call it bright, leafy');
    await expect(rows.first()).toContainText('71% match');
    await expect(rows.nth(1)).toContainText('Leafy Corner');
    await expect(rows.nth(1)).toContainText('Closed today');                 // per-day hours: no Saturday
    await expect(rows.nth(2)).toContainText('Too few reviews to judge its vibe');
    await expect(page.locator('.matched .pill')).toHaveText(['bright', 'leafy']);
    expect(asked[0].lat).toBeCloseTo(13.82975, 4);                          // searched from the area's start point
    await rows.first().locator('[data-act=why]').click();
    await expect(rows.first().locator('.more')).toContainText('bright: 7 reviews · leafy: 3 reviews');
    await expect(rows.first().locator('.more')).toContainText('from BTS Ratchayothin');
    await rows.first().locator('[data-act=detail]').click();
    await expect(page.locator('#sheet')).toContainText('What reviews say about the searched vibes');
    await expect(page.locator('#sheet')).toContainText('Google Maps');
    await expect(page.locator('#sheet')).not.toContainText('OSM');
    expect(errors).toEqual([]);
  });

  test('a searched place can be planned: the Now card starts from the area start point', async ({ page }) => {
    await searchWorld(page);
    await page.goto(HOME);
    await page.getByTestId('home-mic').click();
    await page.getByTestId('results').locator('li.row').first().locator('h3').click({ force: true });
    await page.getByTestId('pick-close').click();
    await expect(page.locator('.nowpage h3').first()).toHaveText('Bright Room Cafe');
    await expect(page.locator('.nowpage')).toContainText('from BTS Ratchayothin');
    await expect(page.locator('.nowpage')).toContainText('Open until 20:00');
  });

  test('when the service does not answer, places are listed nearest first and the page says so', async ({ page }) => {
    await searchWorld(page, () => ({ status: 502, body: { error: 'search_down' } }));
    await page.goto(HOME);
    await page.getByTestId('home-mic').click();
    await expect(page.locator('#note')).toContainText("The search service isn't answering");
    await expect(page.getByTestId('results').locator('li.row').first()).toContainText('Bright Room Cafe');   // 60 m from the station
  });
});

test.describe('Vibe search service in the chat', () => {
  test('a typed vibe is answered from the service, and a whole day is planned from that ranking', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    const asked = await searchWorld(page);
    await page.goto(CHAT);
    await say(page, 'bright cafe with plants');
    const cards = page.getByTestId('pcard');
    await expect(cards.first()).toContainText('Bright Room Cafe');
    await expect(cards.first()).toContainText('Reviews call it bright, leafy');
    expect(asked[0].query).toBe('bright cafe with plants');
    await say(page, 'plan my whole day');
    const day = page.getByTestId('miniday').last();
    await expect(day).toContainText('Bright Room Cafe');
    await expect(day).not.toContainText('Leafy Corner');                   // closed on Saturday, so not planned
    expect(errors).toEqual([]);
  });

  test('Thai search keeps Thai vibe names', async ({ page }) => {
    await searchWorld(page);
    await page.goto(CHAT.replace('lang=en', 'lang=th'));
    await say(page, 'คาเฟ่สว่าง ต้นไม้เยอะ');
    await expect(page.getByTestId('pcard').first()).toContainText('รีวิวบอกว่าสว่าง, ต้นไม้เยอะ');
  });

  test('the sample day uses service places open every day', async ({ page }) => {
    await searchWorld(page);
    await page.goto(CHAT);
    await say(page, 'sample');
    const day = page.getByTestId('miniday').last();
    await expect(day).toContainText('Bright Room Cafe');
    await expect(day).toContainText('Noodle House');
    await expect(day).not.toContainText('Leafy Corner');
  });
});

test.describe('Search service endpoints', () => {
  test('without SEARCH_API_URL: /api/search answers 503 and /places.js has no search area', async ({ request }) => {
    const r = await request.post('/api/search', { data: { query: 'cafe' } });
    expect(r.status()).toBe(503);
    expect((await r.json()).error).toBe('search_off');
    expect(await (await request.get('/places.js')).text()).not.toContain('DAYOFF_AREA');
  });
});
