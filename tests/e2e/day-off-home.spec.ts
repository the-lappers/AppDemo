import { test, expect, Page } from '@playwright/test';

const URL = '/day-off-home.html?lang=en&at=Sat-11:00';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|api\.mapbox\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/wikipedia\.org|commons\.wikimedia\.org/, (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.route(/routing\.openstreetmap\.de/, (r) => r.fulfill({ status: 404, body: '{}' }));
});

const planner = (page: Page) => page.frameLocator('#plannerFrame');
async function planSample(page: Page) {
  await page.goto(URL);
  await page.getByTestId('plan-day').click();
  await planner(page).getByRole('button', { name: 'Load sample trip' }).click();
  await planner(page).getByTestId('use-plan').click();
}

test.describe('Home mic', () => {
  test('the round mic starts recording, then goes to Places with matches first', async ({ page }) => {
    await page.goto(URL + '&voice=demo');
    await page.getByTestId('home-mic').click();
    await expect(page.locator('#picker')).toBeVisible({ timeout: 10000 });      // Places is a modal now
    await expect(page.getByTestId('results').locator('li.row').first()).toBeVisible();
  });
  test('the mic is the bottom-centre round button on Home only', async ({ page }) => {
    await page.goto(URL);
    const b = (await page.getByTestId('home-mic').boundingBox())!, vp = page.viewportSize()!;
    expect(Math.abs(b.x + b.width / 2 - vp.width / 2)).toBeLessThan(3);
    expect(b.width).toBe(56);
    await page.getByTestId('browse-places').click();
    await expect(page.locator('#picker')).toBeVisible();
  });
});

test.describe('Home (merged Now + My day, chat is the only planner)', () => {
  test('opens on Home: where you are, one plan button, two tabs, no stray corner buttons', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await expect(page.getByTestId('home-loc')).toContainText('You are here');
    await expect(page.locator('#tabs')).toBeHidden();                           // no top nav bar
    await expect(page.getByTestId('browse-places')).toBeVisible();
    await expect(page.getByTestId('plan-day')).toBeVisible();
    await expect(page.locator('.fabs')).toHaveCount(0);
    await expect(page.getByTestId('home-mic')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Plan my day opens the chat; Use this plan lands back on Home with Now card and the day', async ({ page }) => {
    await planSample(page);
    await expect(page.locator('#planner')).toBeHidden();
    await expect(page.getByTestId('now-leg')).toBeVisible();
    await expect(page.getByTestId('timeline')).toBeVisible();
    await expect(page.getByTestId('stop')).toHaveCount(4);
    await expect(page.getByTestId('edit-plan')).toBeVisible();
  });

  test('Chat about the trip button opens the planner with the stops; Add places opens the modal and closing returns', async ({ page }) => {
    await planSample(page);
    await page.getByTestId('chat-trip').click();
    await expect(planner(page).getByTestId('daybar')).toBeVisible();
    await planner(page).getByTestId('embed-close').click();
    await page.getByTestId('browse-places').click();
    await page.getByTestId('results').locator('li.row').nth(5).locator('h3').click({ force: true });
    await expect(page.getByTestId('tray')).toContainText(/[35] stops/);
    await page.getByTestId('done-home').click();
    await expect(page.locator('#picker')).toBeHidden();
    await expect(page.getByTestId('timeline')).toBeVisible();
  });

  test('Edit with chat reopens the planner with the current stops', async ({ page }) => {
    await planSample(page);
    await page.getByTestId('edit-plan').click();
    await expect(planner(page).getByTestId('daybar')).toBeVisible();
    await planner(page).getByTestId('embed-close').click();
    await expect(page.locator('#planner')).toBeHidden();
    await expect(page.getByTestId('stop')).toHaveCount(4);
  });

  test('Pick places myself goes to Places, Done brings the pick back to Home', async ({ page }) => {
    await page.goto(URL);
    await page.getByTestId('plan-day').click();
    await planner(page).getByTestId('pick-self').click();
    await expect(page.locator('#planner')).toBeHidden();
    await expect(page.locator('#picker')).toBeVisible();
    await page.getByTestId('results').locator('li.row').first().locator('h3').click({ force: true });
    await page.getByTestId('done-home').click();
    await expect(page.getByTestId('now-leg')).toBeVisible();
    await expect(page.getByTestId('stop')).toHaveCount(1);
  });

  test('Navigate demo and Places browse work from Home', async ({ page }) => {
    await page.goto(URL + '&navfast=1');
    await planSample(page);
    await page.getByTestId('navigate').click();
    await expect(page.locator('#navbar')).toBeVisible();
    await page.getByTestId('nav-stop').click();
    await page.getByTestId('browse-places').click();
    await expect(page.getByTestId('results').locator('li.row').first()).toBeVisible();
    await page.getByTestId('pick-close').click();
    await expect(page.locator('#picker')).toBeHidden();
  });
});

test.describe('Travel modes', () => {
  test('Navigate offers walk, car, BTS and MRT with times; each mode runs its own demo', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL + '&navfast=1&tray=soheng,eiahsae,gulongbao&start=600&end=1080');
    for (const m of ['walk', 'car', 'bts', 'mrt']) await expect(page.getByTestId('mode-' + m)).toBeVisible();
    await expect(page.getByTestId('mode-walk')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('mode-car').click();
    await expect(page.getByTestId('mode-car')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('route-line')).toContainText('by car');
    await page.getByTestId('navigate').click();
    await expect(page.locator('#navbar')).toBeVisible();
    await expect(page.locator('#navbar')).toHaveAttribute('aria-label', 'Driving navigation');
    await page.getByTestId('nav-stop').click();
    await expect(page.getByTestId('mode-mrt')).toBeDisabled();   // Hua Lamphong is the closest MRT to both ends
    await page.getByTestId('mode-bts').click();
    await expect(page.getByTestId('route-line')).toContainText('BTS');
    await page.getByTestId('navigate').click();
    await expect(page.locator('#navbar')).toHaveAttribute('aria-label', 'BTS navigation');
    await expect(page.locator('#navTxt')).toContainText(/BTS|walk|Continue|Turn|Start/i);
    await page.getByTestId('nav-stop').click();
    await expect(page.getByTestId('open-maps')).toHaveAttribute('href', /travelmode=transit|dirflg=r/);
    expect(errors).toEqual([]);
  });
});

/* Live public transport: the server asks Longdo (/api/transit) when it has LONGDO_KEY. Here env.js and the answer are faked,
   so no key is spent; the real server runs without a key (see playwright.config.ts). */
const TRANSIT_ENV = 'window.DAYOFF_ENV={"MAP_BLOCK_KEY":"","LONGDO_MAP_KEY":"","TRANSIT":true};';
const RIDE_ROUTE = { s: 1500, m: 3900, steps: [
  { kind: 'walk', turn: 4, name: 'Rama IV Rd.', m: 300, s: 300, coords: [[13.7384, 100.517], [13.7381, 100.5174]] },
  { kind: 'rail', line: 'Blue Lak Song', from: 'MRT Hua Lamphong', to: 'MRT Sanam Chai', m: 3000, s: 780, wait: 300, coords: [[13.7381, 100.5174], [13.7432, 100.5098], [13.7437, 100.493]] },
  { kind: 'walk', turn: 0, name: 'Sanamchai Rd.', m: 600, s: 420, coords: [[13.7437, 100.493], [13.7352, 100.5116]] },
] };
async function fakeTransit(page: Page, answer: (url: URL) => { status: number; body: unknown }) {
  await page.route('**/env.js', (r) => r.fulfill({ contentType: 'text/javascript', body: TRANSIT_ENV }));
  await page.route('**/api/transit?**', (r) => { const a = answer(new globalThis.URL(r.request().url())); r.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) }); });
}
const TRIP = URL + '&tray=soheng,eiahsae,gulongbao&start=600&end=1080';

test.describe('Public transport from Longdo', () => {
  test('one Transit button replaces BTS and MRT; it shows the live route, draws it and navigates it', async ({ page }) => {
    const errors: string[] = [], asked: URL[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await fakeTransit(page, (u) => { asked.push(u); return { status: 200, body: RIDE_ROUTE }; });
    await page.goto(TRIP);
    await expect(page.getByTestId('mode-transit')).toContainText('25 min');
    await expect(page.getByTestId('mode-bts')).toHaveCount(0);
    await expect(page.getByTestId('mode-mrt')).toHaveCount(0);
    expect(asked[0].searchParams.get('lang')).toBe('en');
    expect(asked[0].searchParams.get('from')).toMatch(/^13\.\d+,100\.\d+$/);
    await page.getByTestId('mode-transit').click();
    await expect(page.getByTestId('route-line')).toContainText('walk 5 min · MRT Hua Lamphong → MRT Sanam Chai · walk 7 min');
    await expect(page.getByTestId('route-line')).toContainText('live from Longdo');
    await expect(page.locator('path[data-route="longdo"]')).toHaveCount(3);
    await page.getByTestId('navigate').click();
    await expect(page.locator('#navbar')).toHaveAttribute('aria-label', 'Public transport navigation');
    await expect(page.locator('#navDemo')).toContainText('live from Longdo');
    await expect(page.locator('#navTxt')).toContainText('Ride Blue Lak Song from MRT Hua Lamphong to MRT Sanam Chai');
    await expect(page.locator('#navTxt')).toContainText('Get off at MRT Sanam Chai');
    await page.getByTestId('nav-stop').click();
    expect(asked.length).toBe(1);                  // one leg, asked once, then reused for the map and Navigate
    expect(errors).toEqual([]);
  });

  test('Thai asks Longdo in Thai', async ({ page }) => {
    const langs: string[] = [];
    await fakeTransit(page, (u) => { langs.push(u.searchParams.get('lang')!); return { status: 200, body: RIDE_ROUTE }; });
    await page.goto(TRIP.replace('lang=en', 'lang=th'));
    await expect(page.getByTestId('mode-transit')).toContainText('25 นาที');
    expect(langs).toEqual(['th']);
  });

  test('when Longdo finds only walking, Transit is off and says walking is better', async ({ page }) => {
    await fakeTransit(page, () => ({ status: 200, body: { s: 900, m: 800, steps: [RIDE_ROUTE.steps[0]] } }));
    await page.goto(TRIP);
    await expect(page.getByTestId('mode-transit')).toBeDisabled();
    await expect(page.getByTestId('mode-transit')).toHaveAttribute('aria-label', 'Public transport, n/a');
  });

  test('when Longdo fails, Transit falls back to the BTS/MRT estimate and says so', async ({ page }) => {
    await fakeTransit(page, () => ({ status: 502, body: { error: 'longdo_failed', message: 'Longdo did not return a route.' } }));
    await page.goto(TRIP);
    await expect(page.getByTestId('mode-transit')).toBeEnabled();
    await expect(page.getByTestId('mode-transit')).toContainText(/\d+ min/);
    await page.getByTestId('mode-transit').click();
    await expect(page.getByTestId('route-line')).toContainText('BTS');
    await expect(page.getByTestId('route-line')).toContainText('Longdo did not answer, so this is an estimate.');
    await page.getByTestId('navigate').click();
    await expect(page.locator('#navDemo')).toContainText('estimates');
  });

  test('while Longdo is answering, Transit shows that it is checking', async ({ page }) => {
    let release!: () => void; const wait = new Promise<void>((r) => (release = r));
    await page.route('**/env.js', (r) => r.fulfill({ contentType: 'text/javascript', body: TRANSIT_ENV }));
    await page.route('**/api/transit?**', async (r) => { await wait; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RIDE_ROUTE) }); });
    await page.goto(TRIP);
    await expect(page.getByTestId('mode-transit')).toHaveAttribute('aria-label', 'Public transport, checking');
    await page.getByTestId('mode-transit').click();
    await expect(page.getByTestId('route-line')).toContainText('Checking live public transport');
    release();
    await expect(page.getByTestId('mode-transit')).toContainText('25 min');
  });
});

test.describe('Transit endpoint', () => {
  test('without LONGDO_KEY it answers 503, and it checks the points first', async ({ request }) => {
    const off = await request.get('/api/transit?from=13.7384,100.517&to=13.7352,100.5116&lang=en');
    expect(off.status()).toBe(503);
    expect((await off.json()).error).toBe('transit_off');
    for (const q of ['', '?from=13.7,100.5', '?from=1,2&to=3,4', '?from=13.7,100.5&to=abc'])
      expect((await request.get('/api/transit' + q)).status(), q).toBe(400);
  });
  test('malformed paths get 400 and the server keeps running', async ({ request, baseURL }) => {
    const http = await import('node:http');
    const { port } = new globalThis.URL(baseURL!);
    for (const path of ['//', '/%', '/%E0%A4%A'])
      expect(await new Promise((ok) => http.get({ host: 'localhost', port, path }, (r) => { r.resume(); ok(r.statusCode); })), path).toBe(400);
    expect((await request.get('/env.js')).status()).toBe(200);
  });
});

test.describe('Opening hours unknown', () => {
  test('a place with unknown hours alone still makes a day, with a check-the-hours note', async ({ page }) => {
    await page.goto(URL + '&tray=mangkon');
    await expect(page.getByTestId('stop')).toHaveCount(1);
    await expect(page.getByTestId('hours-check')).toContainText('Check before you go');
    await expect(page.getByText('Day complete')).toHaveCount(0);
    await expect(page.getByTestId('navigate')).toBeVisible();
  });
  test('in Thai too', async ({ page }) => {
    await page.goto(URL.replace('lang=en', 'lang=th') + '&tray=traimit,soheng');
    await expect(page.getByTestId('stop')).toHaveCount(2);
    await expect(page.getByTestId('hours-check')).toHaveText('ไม่ทราบเวลาเปิด เช็กก่อนไป');
  });
});

test.describe('Travel modes per leg', () => {
  test('after a stop is done, the mode times measure from that stop, not from the start', async ({ page }) => {
    await page.goto(URL + '&tray=fishball,traimit,walkst&start=840&end=1260');
    await page.locator('.nowpage [data-act=arrive]').first().click();
    await page.locator('.nowpage [data-act=done]').first().click();
    await expect(page.locator('.nowpage h3').first()).toHaveText('Wat Traimit');
    const want = await page.evaluate(() => [walkMin(P.fishball, P.traimit), walkMin(ME, P.traimit)]);
    expect(want[0]).not.toBe(want[1]);
    await expect(page.getByTestId('mode-walk')).toContainText(`${want[0]} min`);
  });
});
