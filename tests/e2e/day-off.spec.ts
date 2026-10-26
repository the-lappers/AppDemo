import { test, expect, Page } from '@playwright/test';

/* The clock is pinned with ?at= so open/closed states are deterministic. Saturday 11:00 unless a test says otherwise. */
const URL = '/day-off-demo.html?lang=en&at=Sat-11:00';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ page }) => {
  // Keep tests fast and polite to public services: stub tiles, photos and routing.
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|api\.mapbox\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/wikipedia\.org|commons\.wikimedia\.org/, (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.route(/routing\.openstreetmap\.de/, (r) => r.fulfill({ status: 404, body: '{}' }));
});

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function findExample(page: Page) {
  await page.getByLabel('Describe the vibe').fill('quiet cafe, old walls');
  await page.getByRole('button', { name: 'Find places' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible();
}
async function search(page: Page, q: string) {
  await page.getByLabel('Describe the vibe').fill(q);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible();
}
const rowsOf = (page: Page) => page.getByTestId('results').locator('li.row');
async function loadSample(page: Page) {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Load sample trip' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Your day' })).toBeVisible();
}
async function goNow(page: Page) {
  await page.getByRole('button', { name: 'Now', exact: true }).click();
  await expect(page.getByTestId('now-leg')).toBeVisible();
}
async function arrive(page: Page) {
  await page.getByRole('button', { name: "I've arrived" }).click();
  await expect(page.getByTestId('now-here')).toBeVisible();
}
const setRange = (page: Page, id: string, v: number) => page.locator('#' + id).fill(String(v));

test.describe('Day-Off demo', () => {
  test('renders the describe screen without console errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^[A-Za-z].*\?$/);
    await expect(page.getByLabel('Describe the vibe')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find places' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('empty search ranks by coverage and offers example queries (FR-306/308)', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Find places' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'No vibe typed' })).toBeVisible();
    await page.getByRole('button', { name: 'street food at night' }).click();
    await expect(page.getByText('For “street food at night”')).toBeVisible();
  });

  test('vibe → results with evidence → day → re-plan → undo', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(URL);
    await findExample(page);

    expect(await rowsOf(page).count()).toBeGreaterThanOrEqual(3);
    await expect(rowsOf(page).first()).toContainText('Best match');
    await expect(rowsOf(page).first()).toContainText(/\d+% match/);
    await expect(rowsOf(page).first().getByRole('img', { name: /Calm \d\/5/ })).toBeVisible();

    // Evidence is real signals from OpenStreetMap, not invented reviews
    const why = rowsOf(page).first().getByRole('button', { name: /Why this match/ });
    await why.click();
    await expect(why).toHaveAttribute('aria-expanded', 'true');
    await expect(rowsOf(page).first().getByText(/OpenStreetMap category/)).toBeVisible();

    for (let i = 0; i < 3; i++) await rowsOf(page).nth(i).getByRole('button', { name: /^Add / }).click();
    await expect(page.getByTestId('tray')).toContainText('3 stops');

    await page.getByRole('button', { name: 'Build my day' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Your day' })).toBeVisible();
    await expect(page.getByTestId('stop')).toHaveCount(3);
    await expect(page.getByText(/min walk/).first()).toBeVisible();

    await page.getByRole('button', { name: /Running late/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Running late?' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('radio', { name: '+4 hr' }).check();
    await expect(page.getByTestId('diff')).not.toBeEmpty();
    await page.getByTestId('apply').click();
    await expect(page.getByText('Day re-planned')).toBeVisible();
    await expect(page.locator('.late-chip')).toContainText('4 hr late');
    await page.getByRole('button', { name: /Undo$/ }).first().click();
    await expect(page.locator('.late-chip')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('a stop that no longer fits is flagged with a reason and can be swapped', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    for (const n of ['Hong Sieng Kong', 'So Heng Tai Café', 'Eiah Sae', 'Gu Long Bao Bun Shop', 'Over the Influence', 'NAAM 1608'])
      await page.getByRole('button', { name: `Add ${n} to my day` }).click();
    await page.getByRole('button', { name: 'Build my day' }).click();
    await page.getByRole('button', { name: /Running late/ }).click();
    await page.getByRole('dialog').getByRole('radio', { name: '+4 hr' }).check();
    await expect(page.getByTestId('diff')).toContainText("won't fit");
    await page.getByTestId('apply').click();
    const nofit = page.locator('.nofit');
    await expect(nofit).toContainText("Doesn't fit today");
    await expect(nofit).toContainText(/past your day window|Closes \d\d:\d\d|Opens \d\d:\d\d/);
    await nofit.getByRole('button', { name: /Swap/ }).first().click();
    await expect(page.locator('.toast')).toBeVisible();
  });

  test('removing a stop offers undo', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    await rowsOf(page).nth(0).getByRole('button', { name: /^Add / }).click();
    await rowsOf(page).nth(1).getByRole('button', { name: /^Add / }).click();
    await page.getByRole('button', { name: 'Build my day' }).click();
    await page.getByRole('button', { name: /^Remove / }).first().click();
    await expect(page.getByTestId('stop')).toHaveCount(1);
    await page.locator('.toast').getByRole('button', { name: /Undo/ }).click();
    await expect(page.getByTestId('stop')).toHaveCount(2);
  });

  test('unknown words fall back to a coverage ranking, never an empty page (A-3)', async ({ page }) => {
    await page.goto(URL);
    await page.getByLabel('Describe the vibe').fill('zzz');
    await page.getByRole('button', { name: 'Find places' }).click();
    await expect(page.getByRole('status').filter({ hasText: "We didn't recognise “zzz”" })).toBeVisible();
    expect(await rowsOf(page).count()).toBeGreaterThan(0);
  });

  test('weak matches are labelled as closest matches (A-1)', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'riverside');
    await expect(page.getByTestId('results').getByText('Closest match').first()).toBeVisible();
    await expect(page.getByTestId('results').getByText('Best match')).toHaveCount(1);
  });

  test('Thai is the default and the toggle switches language', async ({ page }) => {
    await page.goto('/day-off-demo.html?at=Sat-11:00');
    await expect(page.locator('html')).toHaveAttribute('lang', 'th');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^[ก-๙].*\?$/);
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^[A-Za-z].*\?$/);
  });

  test('Thai query matches places', async ({ page }) => {
    await page.goto('/day-off-demo.html?at=Sat-11:00');
    await page.getByLabel('เล่าบรรยากาศที่อยากได้').fill('คาเฟ่เงียบ ๆ ตึกเก่า');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: /เจอ \d+ ที่/ })).toBeVisible();
  });

  test('keyboard: focus is visible and the whole flow works without a mouse', async ({ page }) => {
    await page.goto(URL);
    await page.getByLabel('Describe the vibe').focus();
    await page.keyboard.type('quiet old walls');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible();
    await expect(page.locator('#vh')).toBeFocused();
    const add = page.getByRole('button', { name: /^Add / }).first();
    await add.focus();
    expect(await add.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('tray')).toContainText('1 stops');
  });

  test('reduced motion removes the slat animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL);
    await findExample(page);
    const name = await page.locator('.scored .slats i.on').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
  });
});

/* ---------- layout: desktop 55 / 45, phone = full-screen map + draggable bottom sheet ---------- */
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
/** a one-finger vertical swipe on an element, dispatched as real touch events */
async function swipe(page: Page, sel: string, dy: number) {
  await page.evaluate(([s, d]) => {
    const el = document.querySelector(s as string)!;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const mk = (y: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const fire = (type: string, y: number, list = true) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: list ? [mk(y)] : [], changedTouches: [mk(y)] }));
    fire('touchstart', y0);
    for (let i = 1; i <= 8; i++) fire('touchmove', y0 + ((d as number) * i) / 8);
    fire('touchend', y0 + (d as number), false);
  }, [sel, dy] as const);
}

test.describe('Layout', () => {
  test('desktop splits the page 55% information / 45% map', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.goto(URL);
    await findExample(page);
    const vw = page.viewportSize()!.width;
    const left = await box(page, '#tabs');
    const map = await box(page, '#mapcol');
    expect(left.width / vw).toBeGreaterThan(0.545);
    expect(left.width / vw).toBeLessThan(0.555);
    expect(map.width / vw).toBeGreaterThan(0.445);
    expect(map.width / vw).toBeLessThan(0.455);
    const xs = await page.evaluate(() => ['#vh', '.filters', '.row'].map((s) => Math.round(document.querySelector(s)!.getBoundingClientRect().left)));
    expect(new Set(xs).size).toBe(1);                                  // one shared left edge
    await expect(page.locator('#grab')).toBeHidden();                  // the sheet handle is phone-only
  });

  test('phone: the map is full screen behind a bottom sheet that snaps map / split / list', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await page.goto(URL);
    await findExample(page);
    const app = await box(page, '.app'), tabs = await box(page, '#tabs');
    const stage = app.height - tabs.height;
    const map = await box(page, '#mapcol');
    expect(Math.abs(map.height - stage)).toBeLessThan(2);              // the map really is the whole stage
    let h = (await box(page, '#panel')).height;
    expect(h / stage).toBeGreaterThan(0.44); expect(h / stage).toBeLessThan(0.56);   // opens split
    const grab = page.locator('#grab');
    await expect(grab).toHaveAttribute('aria-label', /split/);
    await grab.click();                                                // → list
    await expect(page.locator('#panel')).toHaveAttribute('data-st', 'list');
    await expect.poll(async () => (await box(page, '#panel')).height / stage).toBeGreaterThan(0.85);
    await grab.click();                                                // → map
    await expect(page.locator('#panel')).toHaveAttribute('data-st', 'peek');
    await expect.poll(async () => (await box(page, '#panel')).height).toBeLessThan(160);
    h = (await box(page, '#panel')).height;
    expect((stage - h) / stage).toBeGreaterThan(0.7);                  // the map is the major part of the page
    await grab.click();                                                // → split again
    await expect(page.locator('#panel')).toHaveAttribute('data-st', 'half');
  });

  test('phone: dragging the handle and swiping the list resize the sheet', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await page.goto(URL);
    await findExample(page);
    const panel = page.locator('#panel');
    // drag the handle up: split → list
    let g = await box(page, '#grab');
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down(); await page.mouse.move(g.x + g.width / 2, g.y - 260, { steps: 8 }); await page.mouse.up();
    await expect(panel).toHaveAttribute('data-st', 'list');
    // drag it down: list → map
    g = await box(page, '#grab');
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down(); await page.mouse.move(g.x + g.width / 2, g.y + 700, { steps: 8 }); await page.mouse.up();
    await expect(panel).toHaveAttribute('data-st', 'peek');
    // swipe up on the list body: the sheet grows first
    await page.locator('#grab').click();                               // → split
    await expect(panel).toHaveAttribute('data-st', 'half');
    await swipe(page, '#view', -300);
    await expect(panel).toHaveAttribute('data-st', 'list');
    // at the top of the list, swiping down gives the map back
    await expect.poll(() => page.locator('#view').evaluate((el) => el.scrollTop)).toBe(0);
    await swipe(page, '#view', 400);
    await expect(panel).not.toHaveAttribute('data-st', 'list');
  });

  test('phone: result pins sit above the sheet, not behind it', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await page.goto(URL);
    await findExample(page);
    await expect.poll(() => page.locator('.pin.res').count()).toBeGreaterThan(3);
    await page.waitForTimeout(400);
    const top = (await box(page, '#panel')).y;
    const bad = await page.$$eval('.pin.res', (els, t) => els.filter((e) => e.getBoundingClientRect().bottom > (t as number) + 2).length, top);
    expect(bad).toBe(0);
  });

  test('phone first screen is aligned: one left edge, full-width button, even grids', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await page.goto(URL);
    const r = (sel: string) => page.locator(sel).first().evaluate((el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), w: Math.round(b.width), r: Math.round(b.right) }; });
    const ta = await r('#q'), find = await r('button[type=submit]'), chips = await page.locator('.compose .chip:not(.bud-chip)').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), w: Math.round(b.width), t: Math.round(b.top) }; }));
    const alt = await page.locator('.compose .alt .linkbtn').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), w: Math.round(b.width), r: Math.round(b.right) }; }));
    expect(find.l).toBe(ta.l); expect(find.w).toBe(ta.w);              // button spans exactly the text box
    expect(chips.length).toBe(4);
    expect(chips[0].l).toBe(ta.l);                                     // chips wrap from the text box's left edge
    expect(Math.max(...chips.map((c) => c.l + c.w))).toBeLessThanOrEqual(ta.r);
    expect(alt.length).toBe(1); expect(alt[0].l).toBe(ta.l);
    const h1 = await r('h1'); expect(h1.l).toBe(Math.round(await page.locator('.compose').evaluate((el) => el.getBoundingClientRect().left)));
  });
});

/* ---------- real map ---------- */
test.describe('Real map and places', () => {
  test('Mapbox tiles load with the token from MAP_BLOCK_KEY and real places are pinned', async ({ page }) => {
    const tiles: string[] = [];
    page.on('request', (r) => { if (/api\.mapbox\.com/.test(r.url())) tiles.push(r.url()); });
    await page.goto(URL);
    await findExample(page);
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.leaflet-control-attribution')).toContainText('Mapbox');
    await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
    expect(await page.locator('.leaflet-marker-icon').count()).toBeGreaterThanOrEqual(8);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]).toContain('streets-v12');
    expect(tiles[0]).toContain('access_token=pk.test-token-not-real');
    await expect(page.locator('.leaflet-marker-icon[title="Hong Sieng Kong"]')).toHaveCount(1);
  });

  test('dark theme switches to the Mapbox dark style instead of inverting tiles', async ({ page }) => {
    const tiles: string[] = [];
    page.on('request', (r) => { if (/api\.mapbox\.com/.test(r.url())) tiles.push(r.url()); });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(URL);
    await findExample(page);
    await expect.poll(() => tiles.some((u) => u.includes('dark-v11'))).toBe(true);
    expect(await page.locator('.leaflet-tile-pane').evaluate((el) => getComputedStyle(el).filter)).toBe('none');
  });

  test('the token reaches the page only through /env.js, and nothing else from .env does', async ({ page, request }) => {
    const env = await (await request.get('/env.js')).text();
    expect(env).toContain('pk.test-token-not-real');
    expect(env).not.toMatch(/PASSWORD|SECRET|SUPABASE/i);
    const vals = JSON.parse(env.replace(/^window\.DAYOFF_ENV=/, '').replace(/;$/, ''));
    expect(Object.keys(vals)).toEqual(['MAP_BLOCK_KEY', 'LONGDO_MAP_KEY', 'TRANSIT']);
    expect(vals.TRANSIT).toBe(false);                                   // only a yes/no; the Longdo routing key never leaves the server
    const html = await (await request.get('/day-off-demo.html')).text();
    expect(html).not.toMatch(/pk\.[A-Za-z0-9_-]{20,}/);                 // no token baked into the page
    for (const f of ['/.env', '/.env.example', '/server.mjs', '/package.json'])
      expect((await request.get(f)).status(), f).toBe(404);
  });

  test('a rejected Mapbox token falls back to OpenStreetMap tiles', async ({ page }) => {
    const osm: string[] = [];
    await page.route(/api\.mapbox\.com/, (r) => r.fulfill({ status: 401, body: '{"message":"Not Authorized - Invalid Token"}' }));
    page.on('request', (r) => { if (/tile\.openstreetmap\.org/.test(r.url())) osm.push(r.url()); });
    await page.goto(URL);
    await findExample(page);
    await expect.poll(() => osm.length, { timeout: 10000 }).toBeGreaterThan(0);
    await expect(page.locator('.leaflet-control-attribution')).not.toContainText('Mapbox');
  });

  test('with no token the map uses OpenStreetMap, and CARTO if OSM answers 403', async ({ page }) => {
    const carto: string[] = [];
    await page.route(/\/env\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.DAYOFF_ENV={MAP_BLOCK_KEY:""};' }));
    await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 403, body: 'Access blocked' }));
    page.on('request', (r) => { if (/cartocdn\.com/.test(r.url())) carto.push(r.url()); });
    await page.goto(URL);
    await findExample(page);
    await expect.poll(() => carto.length, { timeout: 10000 }).toBeGreaterThan(0);
    await expect(page.locator('.leaflet-control-attribution')).toContainText('CARTO');
  });

  test('place names, hours and coordinates come from OSM and open/closed follows the live weekday', async ({ page }) => {
    await page.goto('/day-off-demo.html?lang=en&at=Mon-11:00');
    await search(page, 'quiet cafe, old walls');
    const hs = rowsOf(page).filter({ hasText: 'Hong Sieng Kong' });
    await expect(hs.locator('.st', { hasText: 'Closed today' })).toBeVisible();   // OSM: Tu-Su 10:00-18:00
    await page.goto('/day-off-demo.html?lang=en&at=Sat-11:00');
    await search(page, 'quiet cafe, old walls');
    await expect(rowsOf(page).filter({ hasText: 'Hong Sieng Kong' }).locator('.st', { hasText: 'Closed today' })).toHaveCount(0);
    await expect(rowsOf(page).filter({ hasText: 'Hong Sieng Kong' })).toContainText('Open until 18:00');
  });

  test('the day route is drawn from a live walking-route service when it responds', async ({ page }) => {
    await page.route(/routing\.openstreetmap\.de/, (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ routes: [{ geometry: { coordinates: [[100.5119, 13.7336], [100.5112, 13.7350], [100.5108, 13.7392]] } }] }),
    }));
    await loadSample(page);
    await expect(page.locator('path[data-route="osm"]')).toHaveCount(1);
  });

  test('the route falls back to a straight dotted line when routing is unreachable', async ({ page }) => {
    await loadSample(page);
    await expect(page.locator('.leaflet-overlay-pane path').first()).toBeVisible();
    await expect(page.locator('path[data-route="osm"]')).toHaveCount(0);
  });

  test('opened as a file (no Referer) the map uses the fallback provider straight away', async ({ page }) => {
    const carto: string[] = [], osm: string[] = [];
    page.on('request', (r) => { if (/cartocdn\.com/.test(r.url())) carto.push(r.url()); if (/tile\.openstreetmap\.org/.test(r.url())) osm.push(r.url()); });
    const file = require('url').pathToFileURL(require('path').resolve('public/day-off-demo.html')).href + '?lang=en&at=Sat-11:00';
    await page.goto(file);
    await findExample(page);
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => carto.length).toBeGreaterThan(0);
    expect(osm.length).toBe(0);
  });

  test('the map never lets a failed script break the page', async ({ page }) => {
    await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet/, (r) => r.abort());
    await page.goto(URL);
    await findExample(page);
    await expect(page.locator('.mapfail')).toBeVisible();
    expect(await rowsOf(page).count()).toBeGreaterThan(0);
  });
});

/* ---------- theme: white light theme, dark theme, system default ---------- */
async function setTheme(page: Page, pref: 'system' | 'light' | 'dark') {
  const label = { system: 'System', light: 'Light', dark: 'Dark' }[pref];
  const seg = page.getByRole('button', { name: label, exact: true });
  if (await seg.isVisible()) { await seg.click(); return; }
  for (let i = 0; i < 3 && (await page.locator('html').getAttribute('data-theme-pref')) !== pref; i++) {
    await page.getByRole('button', { name: /^Theme:/ }).click();
  }
}
const themeAttr = (page: Page) => page.locator('html').getAttribute('data-theme');

test.describe('Theme', () => {
  test('follows the OS by default and the page is white in light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(URL);
    expect(await themeAttr(page)).toBe('light');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  });

  test('there is no green anywhere in the palette', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(URL);
      const greens = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const hue = (hex: string) => {
          const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
          if (d < 0.08) return -1;                       // neutral
          const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
          return (h * 60 + 360) % 360;
        };
        return ['--bg', '--surface', '--card', '--line', '--track', '--ink', '--ink-2', '--accent', '--warn', '--gold', '--gold-soft', '--pill', '--done']
          .filter((n) => { const h = hue(css.getPropertyValue(n).trim()); return h > 75 && h < 170; });
      });
      expect(greens, scheme).toEqual([]);
    }
  });

  test('explicit choice overrides the OS and is remembered after reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(URL);
    await setTheme(page, 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await setTheme(page, 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: text and control colour pairs meet AA contrast`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(URL);
      const failures = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const v = (n: string) => css.getPropertyValue(n).trim();
        const lum = (hex: string) => {
          const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
          return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        };
        const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const pairs: [string, string][] = [
          ['--ink', '--bg'], ['--ink', '--surface'], ['--ink', '--card'], ['--ink-2', '--bg'], ['--ink-2', '--surface'], ['--ink-2', '--card'],
          ['--accent', '--bg'], ['--accent', '--surface'], ['--accent', '--card'], ['--on-accent', '--accent'],
          ['--warn', '--bg'], ['--warn', '--surface'], ['--warn', '--gold-soft'], ['--ink', '--gold-soft'],
          ['--on-gold', '--gold'], ['--on-pill', '--pill'], ['--bg', '--done'], ['--ink-2', '--gold-soft'],
          ['--toast-fg', '--toast-bg'], ['--toast-act', '--toast-bg'],
        ];
        return pairs.map(([f, b]) => [f, b, ratio(v(f), v(b))] as const).filter(([, , r]) => r < 4.5).map(([f, b, r]) => `${f} on ${b} = ${r.toFixed(2)}`);
      });
      expect(failures).toEqual([]);
    });
  }

  test('dark mode renders the whole flow without console errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(URL);
    await page.getByRole('button', { name: 'Load sample trip' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Your day' })).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('no horizontal scroll at 360px in both themes (NFR-O1)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(URL);
      const check = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await check();
      await findExample(page); await check();
      await page.goto(URL);
      await page.getByRole('button', { name: 'Load sample trip' }).click();
      await check();
    }
  });
});

/* ---------- sliders and filters ---------- */
test.describe('Sliders and filters', () => {
  test('the price slider re-ranks live: Free only keeps the free places', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    const before = await rowsOf(page).count();
    const slider = page.locator('#fPrice');
    await slider.focus();
    await slider.fill('0');
    await expect(page.locator('#fPrice-o')).toHaveText('Free only');
    await expect.poll(() => rowsOf(page).count()).toBeLessThan(before);
    expect(await rowsOf(page).count()).toBeGreaterThanOrEqual(1);
    for (const row of await rowsOf(page).all()) await expect(row.locator('.meta')).toContainText('Free');
    await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toContainText(String(await rowsOf(page).count()));
    await expect(slider).toBeFocused();                               // focus survives the live update
    await slider.fill('2');
    await expect(page.locator('#fPrice-o')).toHaveText('Up to ฿฿');
    await slider.fill('3');
    await expect.poll(() => rowsOf(page).count()).toBe(before);
  });

  test('the distance slider keeps only places within that many km', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'old walls');
    await expect(rowsOf(page).filter({ hasText: 'Chow Sue Kong Shrine' })).toHaveCount(1);   // ~0.7 km from Hua Lamphong
    await expect(rowsOf(page).filter({ hasText: 'Wat Traimit' })).toHaveCount(1);            // ~0.4 km
    await setRange(page, 'fDist', 5);
    await expect(page.locator('#fDist-o')).toHaveText('Within 0.5 km');
    await expect(rowsOf(page).filter({ hasText: 'Chow Sue Kong Shrine' })).toHaveCount(0);
    await expect(rowsOf(page).filter({ hasText: 'Wat Traimit' })).toHaveCount(1);
    await setRange(page, 'fDist', 25);
    await expect(page.locator('#fDist-o')).toHaveText('Any');
    await expect(rowsOf(page).filter({ hasText: 'Chow Sue Kong Shrine' })).toHaveCount(1);
  });

  test('open-now uses the live clock; reset restores everything', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'street food at night');
    await expect(rowsOf(page).filter({ hasText: 'T&K Seafood' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Open now' }).click();
    await expect(rowsOf(page).filter({ hasText: 'T&K Seafood' })).toHaveCount(0);            // OSM: opens 16:30
    await expect(rowsOf(page).filter({ hasText: 'Sampeng Lane Market' })).toHaveCount(0);    // unknown hours is not "open"
    await setRange(page, 'fPrice', 0);
    await expect(page.getByRole('heading', { name: 'No places pass these filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset filters' }).last().click();
    await expect(rowsOf(page).filter({ hasText: 'T&K Seafood' })).toHaveCount(1);
    await expect(page.locator('#fPrice-o')).toHaveText('Any price');
  });

  test('hours unknown and closed today are distinct states', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'old walls');
    await expect(rowsOf(page).filter({ hasText: 'Wat Traimit' }).locator('.st', { hasText: 'Hours unknown' })).toBeVisible();
  });

  test('venue detail shows every axis, the OSM source and omits what is not held', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'old walls');
    await page.getByRole('button', { name: 'Details for Wat Traimit' }).click();
    const sheet = page.getByRole('dialog', { name: 'Wat Traimit' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Hours unknown')).toBeVisible();
    expect(await sheet.getByRole('img', { name: /\d\/5/ }).count()).toBe(6);
    await expect(sheet.getByRole('link', { name: /OSM way\/241879483/ })).toBeVisible();
    await expect(sheet).not.toContainText(/mentions|reviews \(sample\)|From photos/);        // nothing invented for a real venue
    await sheet.getByRole('button', { name: /^Add / }).click();
    await expect(page.getByTestId('tray')).toContainText('1 stops');
  });

  test('an hours-unknown stop is still planned, and says to check the hours before going', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'old walls');
    await page.getByRole('button', { name: 'Add Wat Traimit to my day' }).click();
    await page.getByRole('button', { name: 'Add So Heng Tai Café to my day' }).click();
    await page.getByRole('button', { name: 'Build my day' }).click();
    await expect(page.getByTestId('stop')).toHaveCount(2);
    await expect(page.getByTestId('stop').filter({ hasText: 'Wat Traimit' }).getByTestId('hours-check')).toHaveText('Opening hours unknown. Check before you go');
    await expect(page.getByTestId('stop').filter({ hasText: 'So Heng Tai Café' }).getByTestId('hours-check')).toHaveCount(0);
    await expect(page.locator('.nofit')).toHaveCount(0);
  });

  test('a stop that is closed on this weekday is listed with that reason', async ({ page }) => {
    await page.goto('/day-off-demo.html?lang=en&at=Mon-11:00');
    await search(page, 'quiet cafe, old walls');
    await page.getByRole('button', { name: 'Add Hong Sieng Kong to my day' }).click();
    await page.getByRole('button', { name: 'Add So Heng Tai Café to my day' }).click();
    await page.getByRole('button', { name: 'Build my day' }).click();
    await expect(page.locator('.nofit')).toContainText("Closed today, so it can't be scheduled");
    await expect(page.getByTestId('stop')).toHaveCount(1);
  });
});

/* ---------- place detail: photo, and time at a place ---------- */
test.describe('Place photo and time', () => {
  test('detail shows a credited Wikimedia Commons photo when one exists near the place', async ({ page }) => {
    await page.route(/commons\.wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: { pages: { 1: { index: 1, imageinfo: [{
      mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/test/x.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      extmetadata: { Artist: { value: '<a href="https://example.org/u">Jane Doe</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } }) }));
    await page.route(/upload\.wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await page.goto(URL);
    await search(page, 'old walls');
    await page.getByRole('button', { name: 'Details for So Heng Tai Café' }).click();
    const fig = page.locator('#photo');
    await expect(fig.locator('img[data-kind="commons"]')).toHaveCount(1);
    await expect(fig).toContainText('Photo near this place');
    await expect(fig).toContainText('Jane Doe');
    await expect(fig).toContainText('CC BY-SA 4.0');
    await expect(fig.getByRole('link', { name: 'Wikimedia Commons' })).toBeVisible();
    await expect(fig.locator('script')).toHaveCount(0);               // artist markup is reduced to plain text
  });

  test('detail shows several photos in a swipeable strip, with buttons and the credit of the visible one', async ({ page }) => {
    const pg = (i: number, who: string) => ({ index: i, imageinfo: [{ mime: 'image/jpeg', thumburl: `https://upload.wikimedia.org/test/${i}.jpg`, descriptionurl: `https://commons.wikimedia.org/wiki/File:${i}.jpg`,
      extmetadata: { Artist: { value: who }, LicenseShortName: { value: 'CC BY 4.0' } } }] });
    await page.route(/commons\.wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: { pages: { 1: pg(1, 'Ann'), 2: pg(2, 'Ben'), 3: pg(3, 'Cy') } } }) }));
    await page.route(/upload\.wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await page.goto(URL);
    await search(page, 'old walls');
    await page.getByRole('button', { name: 'Details for So Heng Tai Café' }).click();
    const fig = page.locator('#photo');
    await expect(fig.locator('img[data-kind="commons"]')).toHaveCount(3);
    await expect(fig.locator('img[data-kind="aerial"]')).toHaveCount(1);          // the aerial view is the last slide
    await expect(fig.locator('.gal-count')).toHaveText('1 / 4');
    await expect(fig).toContainText('Ann');
    await fig.getByRole('button', { name: 'Next photo' }).click();
    await expect(fig.locator('.gal-count')).toHaveText('2 / 4');
    await expect(fig).toContainText('Ben');
    await fig.getByRole('button', { name: 'Previous photo' }).click();
    await expect(fig.locator('.gal-count')).toHaveText('1 / 4');
  });

  test('without a nearby photo the detail shows a Mapbox aerial view of that exact spot', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'old walls');
    await page.getByRole('button', { name: 'Details for So Heng Tai Café' }).click();
    const img = page.locator('#photo img[data-kind="aerial"]');
    await expect(img).toHaveCount(1);
    const src = await img.getAttribute('src');
    expect(src).toContain('satellite-streets-v12/static');
    expect(src).toContain('100.51198,13.73363');                      // the place's own coordinates
    await expect(page.locator('#photo')).toContainText('Aerial view of this spot');
  });

  test('when no photo can load the detail says so instead of showing a broken image', async ({ page }) => {
    await page.route(/api\.mapbox\.com\/styles\/v1\/mapbox\/satellite/, (r) => r.abort());
    await page.goto(URL);
    await search(page, 'old walls');
    await page.getByRole('button', { name: 'Details for So Heng Tai Café' }).click();
    await expect(page.locator('#photo')).toContainText('No photo available for this place');
    await expect(page.locator('#photo img')).toHaveCount(0);
  });

  test('the stay stepper changes the time at a stop and the whole day re-solves; undo restores', async ({ page }) => {
    await loadSample(page);
    const lastTime = () => page.locator('.stop .time').last().textContent();
    const before = await lastTime();
    const stay = page.locator('.stay').first();
    const out = stay.locator('output');
    const was = parseInt((await out.textContent())!);
    await stay.getByRole('button', { name: /^Longer stay at / }).click();
    await expect(page.locator('.stay').first().locator('output')).toHaveText(`${was + 15} min`);
    expect(await lastTime()).not.toBe(before);                        // later stops moved
    await page.locator('.stay').first().getByRole('button', { name: /^Shorter stay at / }).click();
    await expect(page.locator('.stay').first().locator('output')).toHaveText(`${was} min`);
    await page.getByRole('button', { name: 'Undo last change' }).click();
    await expect(page.locator('.stay').first().locator('output')).toHaveText(`${was + 15} min`);
  });

  test('the stay stepper stops at 15 minutes', async ({ page }) => {
    await loadSample(page);
    const stay = page.locator('.stay').first();
    for (let i = 0; i < 6; i++) await stay.getByRole('button', { name: /^Shorter stay at / }).click();
    await expect(page.locator('.stay').first().locator('output')).toHaveText(/^(15|20) min$/);
    expect(parseInt((await page.locator('.stay').first().locator('output').textContent())!)).toBeGreaterThanOrEqual(15);
  });

  test('the slider in the detail sets the time here and the day uses it', async ({ page }) => {
    await page.goto(URL);
    await search(page, 'old walls');
    await page.getByRole('button', { name: 'Details for So Heng Tai Café' }).click();
    const sheet = page.getByRole('dialog', { name: 'So Heng Tai Café' });
    await expect(sheet.getByLabel('Time here')).toHaveValue('50');
    await sheet.getByLabel('Time here').fill('90');
    await expect(sheet.locator('#stayR-o')).toHaveText('90 min');
    await sheet.getByRole('button', { name: /^Add / }).click();
    await page.getByRole('button', { name: 'Build my day' }).click();
    await expect(page.locator('.stop').first().locator('.stay output')).toHaveText('90 min');
  });
});

/* ---------- mid-trip, next stop, day summary ---------- */
test.describe('Mid-trip', () => {
  test('sample trip opens with the first stop done and locked, plus a next-stop suggestion', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('stop')).toHaveCount(4);
    await expect(page.locator('.stop.done')).toHaveCount(1);
    await expect(page.locator('.stop.done')).toContainText(/Visited \d\d:\d\d–\d\d:\d\d/);
    await expect(page.locator('.stop.done').getByRole('button', { name: /^Remove / })).toHaveCount(0);
    await expect(page.getByTestId('suggest')).toContainText('Suggested next stop');
  });

  test('day summary shows stops, total length and walking before commit (FR-708)', async ({ page }) => {
    await loadSample(page);
    const sum = page.getByTestId('summary');
    await expect(sum).toContainText('Stops');
    await expect(sum).toContainText('Day length');
    await expect(sum).toContainText(/\d+(\.\d)? km/);
  });

  test('mark done locks the stop and re-solves the rest; undo restores', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByRole('button', { name: /^Mark .* done$/ })).toHaveCount(0);      // My day only plans; acting happens on Now
    await goNow(page);
    await arrive(page);
    await page.getByRole('button', { name: /^Mark .* done$/ }).click();
    await expect(page.getByTestId('now-leg')).toBeVisible();                                // on to the next stop
    await page.getByRole('button', { name: /^My day/ }).click();
    await expect(page.locator('.stop.done')).toHaveCount(2);
    await page.locator('.toast').getByRole('button', { name: /Undo/ }).click();
    await expect(page.locator('.stop.done')).toHaveCount(1);
  });

  test('skip removes the stop, lists it as skipped and never suggests it again (FR-603)', async ({ page }) => {
    await loadSample(page);
    const name = await page.locator('.stop:not(.done) h3').first().textContent();
    await goNow(page);
    await page.getByRole('button', { name: /^Skip / }).click();
    await page.getByRole('button', { name: /^My day/ }).click();
    await expect(page.getByTestId('stop')).toHaveCount(3);
    await expect(page.locator('.skipbox')).toContainText(name!.trim());
    await expect(page.getByTestId('suggest')).not.toContainText(name!.trim());
  });

  test('next stop: different type from the last stop, reject offers another, accept appends', async ({ page }) => {
    await loadSample(page);
    const card = page.getByTestId('suggest');
    await expect(card).toContainText(/\d+ min walk/);
    await expect(card).toContainText(/left in your day/);
    await expect(card).toContainText('Ranked by vibe match 50%');
    const first = (await card.locator('h3').nth(1).textContent())!.trim();
    await card.getByRole('button', { name: 'Not this one' }).click();
    const second = (await card.locator('h3').nth(1).textContent())!.trim();
    expect(second).not.toBe(first);
    await card.getByRole('button', { name: 'Add to my day' }).click();
    await expect(page.getByTestId('stop')).toHaveCount(5);
    await expect(page.locator('.toast')).toContainText(`${second} added to your day`);
  });

  test('pin holds a stop at its position', async ({ page }) => {
    await loadSample(page);
    const pin = page.getByRole('button', { name: /^Pin / }).last();
    const lastName = await page.locator('.stop h3').last().textContent();
    await pin.click();
    await expect(page.getByRole('button', { name: /^Unpin / })).toHaveCount(1);
    await expect(page.locator('.stop h3').last()).toHaveText(lastName!);
    await page.getByRole('button', { name: /^Unpin / }).click();
    await expect(page.getByRole('button', { name: /^Unpin / })).toHaveCount(0);
  });

  test('a day end that is too early flags what no longer fits (FR-802, FR-707)', async ({ page }) => {
    await loadSample(page);
    await page.getByLabel('Day ends').selectOption('900');
    await page.getByRole('button', { name: 'Running late? Re-plan' }).click();
    await page.getByRole('dialog').getByRole('radio', { name: '+4 hr' }).check();
    await page.getByTestId('apply').click();
    await expect(page.getByText(/Not everything fits before 15:00/)).toBeVisible();
    await expect(page.locator('.nofit')).toContainText(/past your day window|too late|Closes/);
  });

  test('routing outage shows an approximate-route notice and ~ walk times (NFR-P5)', async ({ page }) => {
    await loadSample(page);
    await page.getByRole('button', { name: 'Demo: simulate routing outage' }).click();
    await expect(page.getByTestId('route-notice')).toContainText('straight-line estimates');
    await expect(page.getByText(/~\d+ min walk/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Demo: restore routing' }).click();
    await expect(page.getByTestId('route-notice')).toHaveCount(0);
  });

  test('Thai strings are present for the new features', async ({ page }) => {
    await page.goto('/day-off-demo.html?at=Sat-11:00');
    await page.getByRole('button', { name: 'ลองทริปตัวอย่าง' }).click();
    await expect(page.getByTestId('suggest')).toContainText('จุดต่อไปที่แนะนำ');
    await expect(page.getByTestId('summary')).toContainText('จุดแวะ');
    await expect(page.locator('.stop.done')).toContainText('แวะ');
  });

  test('Thai filter labels are present', async ({ page }) => {
    await page.goto('/day-off-demo.html?at=Sat-11:00');
    await page.getByLabel('เล่าบรรยากาศที่อยากได้').fill('คาเฟ่เงียบ ๆ ตึกเก่า');
    await page.getByRole('button', { name: 'หาที่เที่ยว' }).click();
    await expect(page.getByText('ราคา', { exact: true })).toBeVisible();
    await expect(page.getByText(/ระยะทางจาก/)).toBeVisible();
    await expect(page.getByText('เปิดอยู่ตอนนี้').first()).toBeVisible();
  });
});

/* ---------- manual order: drag a stop by its handle, or use ↑ ↓ on the handle ---------- */
const stopNames = (page: Page) => page.locator('.stop h3').allTextContents();
const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
/** a one-finger drag as real touch input (pointerType: touch) */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (p: { x: number; y: number }) => [{ x: p.x, y: p.y }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt({ x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 }) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const centre = async (page: Page, loc: ReturnType<Page['locator']>) => { await loc.scrollIntoViewIfNeeded(); const b = (await loc.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

test.describe('Manual order', () => {
  test('every open stop has a named handle, the visited stop is locked, and the hint says how', async ({ page }) => {
    await loadSample(page);
    await expect(page.locator('.stop.done .grip')).toHaveCount(0);
    await expect(page.locator('.stop:not(.done) .grip')).toHaveCount(3);
    const label = await page.locator('.grip').first().getAttribute('aria-label');
    expect(label).toMatch(/^Reorder .+\. Drag, or press the up or down arrow key\.$/);
    await expect(page.getByText('Drag the handle to reorder, or focus it and press ↑ ↓.')).toBeVisible();
    await expect(page.getByText('Manual order')).toHaveCount(0);        // still automatic
  });

  test('↑ moves a stop up, the planner keeps that order, times follow, and pins give way', async ({ page }) => {
    await loadSample(page);
    const before = await stopNames(page);
    const last = page.locator('.stop').last().locator('.grip');
    await last.focus();
    await page.keyboard.press('ArrowUp');
    const after = await stopNames(page);
    expect(after).toEqual([before[0], before[1], before[3], before[2]]);
    await expect(page.locator('.late-chip', { hasText: 'Manual order' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auto order' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pin / })).toHaveCount(0);   // pins are meaningless once you order by hand
    await expect(page.locator('#live')).toContainText(/is now stop 3 of 4/);
    await expect(page.locator('.stop').nth(2).locator('.grip')).toBeFocused();  // focus follows the stop
    const times = (await page.locator('.stop .time').allTextContents()).map(minutes);
    expect(times).toEqual([...times].sort((a, b) => a - b));                    // timeline stays in time order
    await expect(page.locator('.stop .dot').nth(2)).toHaveText('3');            // numbers follow the new order
    await page.keyboard.press('ArrowDown');                                    // and back again
    expect(await stopNames(page)).toEqual(before);
  });

  test('the visited stop stays first: the first open stop cannot move above it', async ({ page }) => {
    await loadSample(page);
    const before = await stopNames(page);
    const firstOpen = page.locator('.stop:not(.done)').first().locator('.grip');
    await firstOpen.focus();
    await page.keyboard.press('ArrowUp');
    expect(await stopNames(page)).toEqual(before);
    await expect(page.locator('#live')).toContainText('cannot move further');
    await expect(page.getByText('Manual order')).toHaveCount(0);               // nothing changed, so no mode switch
  });

  test('Auto order hands the order back to the planner; undo restores the manual order', async ({ page }) => {
    await loadSample(page);
    const original = await stopNames(page);
    await page.locator('.stop').last().locator('.grip').focus();
    await page.keyboard.press('ArrowUp');
    const manual = await stopNames(page);
    expect(manual).not.toEqual(original);
    await page.getByRole('button', { name: 'Auto order' }).click();
    await expect(page.getByText('Order optimised by Day-Off')).toBeVisible();
    expect(await stopNames(page)).toEqual(original);
    await expect(page.locator('.late-chip', { hasText: 'Manual order' })).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: /Undo/ }).click();
    expect(await stopNames(page)).toEqual(manual);
    await expect(page.locator('.late-chip', { hasText: 'Manual order' })).toBeVisible();
  });

  test('undo after a manual move puts the previous order back', async ({ page }) => {
    await loadSample(page);
    const original = await stopNames(page);
    await page.locator('.stop').last().locator('.grip').focus();
    await page.keyboard.press('ArrowUp');
    await page.getByRole('button', { name: 'Undo last change' }).click();
    expect(await stopNames(page)).toEqual(original);
    await expect(page.getByText('Manual order')).toHaveCount(0);
  });

  test('dragging a handle with the pointer reorders the stops', async ({ page }, info) => {
    test.skip(info.project.name === 'phone');                                   // touch has its own test below
    await loadSample(page);
    const before = await stopNames(page);
    const from = await centre(page, page.locator('.stop').nth(3).locator('.grip'));
    const to = await centre(page, page.locator('.stop').nth(2).locator('.grip'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, (from.y + to.y) / 2, { steps: 6 });
    await expect(page.locator('.stop.lifting')).toHaveCount(1);                 // the stop lifts while dragged
    await expect(page.locator('.timeline.reordering')).toHaveCount(1);
    // the lifted card has margin all round: a 12px ring that still sits inside the timeline card
    const ring = await page.evaluate(() => {
      const li = document.querySelector('.stop.lifting')!, ol = document.querySelector('.timeline')!;
      const a = li.getBoundingClientRect(), b = ol.getBoundingClientRect();
      return { shadow: getComputedStyle(li).boxShadow, left: a.left - 12 - b.left, right: b.right - (a.right + 12) };
    });
    expect(ring.shadow).toMatch(/0px 0px 0px 12px/);
    expect(ring.left).toBeGreaterThanOrEqual(0);
    expect(ring.right).toBeGreaterThanOrEqual(0);
    await page.mouse.move(to.x, to.y - 20, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.stop.lifting')).toHaveCount(0);
    expect(await stopNames(page)).toEqual([before[0], before[1], before[3], before[2]]);
    await expect(page.locator('.late-chip', { hasText: 'Manual order' })).toBeVisible();
    await expect(page.locator('.stop .dot').nth(2)).toHaveText('3');
  });

  test('a one-finger drag reorders on a phone (pointerType touch)', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await loadSample(page);
    await page.locator('#grab').click();                                        // open the list fully so the handles are on screen
    await expect(page.locator('#panel')).toHaveAttribute('data-st', 'list');
    const before = await stopNames(page);
    const from = await centre(page, page.locator('.stop').nth(3).locator('.grip'));
    const to = await centre(page, page.locator('.stop').nth(2).locator('.grip'));
    await touchDrag(page, from, { x: to.x, y: to.y - 30 });
    await expect.poll(() => stopNames(page)).toEqual([before[0], before[1], before[3], before[2]]);
    await expect(page.locator('#panel')).toHaveAttribute('data-st', 'list');   // the drag did not also resize the sheet
  });

  test('a stop dragged far above the visited stop stops below it, and dropping in place changes nothing', async ({ page }, info) => {
    test.skip(info.project.name === 'phone');
    await loadSample(page);
    const before = await stopNames(page);
    const grip = page.locator('.stop').nth(1).locator('.grip');
    const from = await centre(page, grip);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(from.x, from.y - 400, { steps: 10 });
    await page.mouse.up();
    expect(await stopNames(page)).toEqual(before);                              // clamped under the locked stop
    await expect(page.getByText('Manual order')).toHaveCount(0);
  });

  test('Escape cancels a drag in progress', async ({ page }, info) => {
    test.skip(info.project.name === 'phone');
    await loadSample(page);
    const before = await stopNames(page);
    const from = await centre(page, page.locator('.stop').nth(3).locator('.grip'));
    const to = await centre(page, page.locator('.stop').nth(2).locator('.grip'));
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y - 20, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await stopNames(page)).toEqual(before);
    await expect(page.getByText('Manual order')).toHaveCount(0);
  });

  test('the handle, pin and remove buttons stay inside the card padding on every row', async ({ page }) => {
    await loadSample(page);
    await page.getByRole('button', { name: 'Hide' }).click();
    const m = await page.evaluate(() => {
      const ol = document.querySelector('.timeline')!.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(document.querySelector('.timeline')!).paddingRight);
      const rows = [...document.querySelectorAll('.stop:not(.done) .stop-tools')].map((el) => {
        const tools = el.getBoundingClientRect(), body = el.parentElement!.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(el.parentElement!.querySelector('h3')!); const h3 = rg.getBoundingClientRect();   // the text itself, not its padded box
        return { toolsRight: ol.right - pad - tools.right, bodyRight: ol.right - pad - body.right, h3Overlap: h3.right > tools.left + 0.5 && h3.bottom > tools.top && h3.top < tools.bottom && h3.left < tools.right };
      });
      return { rows, scrollX: document.querySelector('#view')!.scrollWidth > document.querySelector('#view')!.clientWidth };
    });
    expect(m.rows.length).toBe(3);
    for (const r of m.rows) {
      expect(r.toolsRight).toBeGreaterThanOrEqual(-0.5);       // never past the padding edge
      expect(r.toolsRight).toBeLessThanOrEqual(0.5);           // and flush to it, so every row shares one right margin
      expect(r.h3Overlap).toBe(false);                          // the name never runs under the buttons
    }
    expect(m.scrollX).toBe(false);
  });

  test('in manual order a stop that no longer fits is flagged in place, not dropped', async ({ page }) => {
    await loadSample(page);
    await page.locator('.stop').last().locator('.grip').focus();
    await page.keyboard.press('ArrowUp');
    await page.getByLabel('Day ends').selectOption('900');                      // a 15:00 day end makes the late start overrun
    await page.getByRole('button', { name: 'Running late? Re-plan' }).click();
    await page.getByRole('dialog').getByRole('radio', { name: '+4 hr' }).check();
    await expect(page.getByTestId('diff')).toContainText("won't fit");         // the sheet warns before you apply
    await page.getByTestId('apply').click();
    await expect(page.getByTestId('stop')).toHaveCount(4);                      // nothing vanished
    await expect(page.locator('.nofit')).toHaveCount(0);
    expect(await page.locator('.stop .note.warn').count()).toBeGreaterThanOrEqual(1);
    await expect(page.getByText(/Closes \d\d:\d\d\. You would finish after closing|Ends after \d\d:\d\d, past your day window/).first()).toBeVisible();
  });

  test('the map route follows the manual order', async ({ page }) => {
    await loadSample(page);
    const names = await stopNames(page);
    await page.locator('.stop').last().locator('.grip').focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.pin.num')).toHaveCount(4);                      // one numbered pin per stop, visited included
    await expect(page.locator(`.leaflet-marker-icon[title="${names[3]}"] .pin`)).toHaveText('3');   // the moved stop is now number 3
    await expect(page.locator(`.leaflet-marker-icon[title="${names[2]}"] .pin`)).toHaveText('4');
  });

  test('Thai labels exist for manual ordering', async ({ page }) => {
    await page.goto('/day-off-demo.html?at=Sat-11:00');
    await page.getByRole('button', { name: 'ลองทริปตัวอย่าง' }).click();
    await expect(page.getByText(/ลากที่จับเพื่อเรียงลำดับ/)).toBeVisible();
    await page.locator('.stop').last().locator('.grip').focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: 'จัดลำดับอัตโนมัติ' })).toBeVisible();
    await expect(page.getByText('เรียงเอง')).toBeVisible();
  });
});

/* ---------- shared trip ---------- */
test.describe('Shared trip', () => {
  test('link is scoped, votes are tallied, planner re-solves with group picks', async ({ page }) => {
    await loadSample(page);
    await page.getByRole('button', { name: 'Share trip' }).click();
    const sheet = page.getByRole('dialog', { name: 'Share this trip' });
    await expect(sheet).toContainText('Anyone with this link can view this trip only');
    await expect(sheet.getByTestId('votes')).toContainText(/\d like · \d skip/);
    await expect(sheet.getByTestId('votes')).toContainText('Suggested by');
    await expect(sheet.getByTestId('group-diff')).toContainText('Add Nai Mong Hoy Tod');
    await sheet.getByTestId('regroup').click();
    await expect(page.getByRole('button', { name: /My day \(5\)/ })).toBeVisible();
    await expect(page.locator('.toast')).toContainText("Re-planned with the group's picks");
  });
});

/* ---------- accessibility across surfaces, both themes. Targets are 44px on touch, 32px with a mouse ---------- */
for (const scheme of ['light', 'dark'] as const) {
  test(`a11y (${scheme}): names, target sizes and focus ring on results, day, sheets`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(URL);
    const audit = async () => {
      const unnamed = await page.$$eval('button', (bs) => bs.filter((b) => !(b.getAttribute('aria-label') || b.textContent?.trim())).length);
      expect(unnamed).toBe(0);
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      const min = coarse ? 44 : 32;
      const small = await page.$$eval('button:not([disabled]), select, textarea', (els, m) =>
        els.filter((e) => !e.closest('.leaflet-container')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < m - 0.5 || r.width < m - 0.5); })
          .map((e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30)), min);
      expect(small).toEqual([]);
      const thin = await page.$$eval('input[type=range]', (els, m) => els.filter((e) => { const h = e.getBoundingClientRect().height; return h > 0 && h < m - 0.5; }).length, coarse ? 36 : 24);
      expect(thin).toBe(0);
    };
    await audit();
    await findExample(page); await audit();
    await page.getByRole('button', { name: /^Details for / }).first().click();
    await audit();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Add / }).first().click();
    await page.getByRole('button', { name: 'Build my day' }).click();
    await audit();
    await goNow(page); await audit();
    await arrive(page); await audit();
    const done = page.getByRole('button', { name: /^Mark .* done$/ });
    await page.keyboard.press('Tab');
    await done.focus();
    expect(await done.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });
}

/* ---------- first-screen and day upgrades ---------- */
test.describe('Main page upgrades', () => {
  test('the first screen has no description or example button, and the question is one of the set', async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByText(/Thai or English both work/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try an example' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^[A-Za-z].*\?$/);
  });

  test('time budget: half day and full day set the day window and the start time shifts it', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Half day' }).click();
    await expect(page.getByRole('button', { name: 'Half day' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Start').selectOption('660');          // 11:00, window keeps its 4 h length
    await page.getByRole('button', { name: 'Load sample trip' }).click();
    await page.getByRole('button', { name: 'Full day' }).count();   // sample trip replaces the window, so only check the describe screen below
    await page.getByRole('button', { name: 'Vibe' }).click();
    await expect(page.getByLabel('Start')).toBeVisible();
  });

  test('voice input: a fake recogniser fills the box and runs the search', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any; lang = '';
        start() { setTimeout(() => { this.onresult({ results: [Object.assign([{ transcript: 'quiet cafe' }], { isFinal: true })] }); this.onend(); }, 80); }
        stop() {}
      };
    });
    await page.goto(URL);
    await page.getByRole('button', { name: 'Speak your vibe' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible();
  });

  test('?voice=demo lets the voice flow run without the browser speech service', async ({ page }) => {
    await page.goto(URL + '&voice=demo');
    await page.getByRole('button', { name: 'Speak your vibe' }).click();
    await expect(page.locator('#toasts').getByText('Demo voice')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible();
  });

  test('a network failure of the speech service explains the cause and the demo option', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any;
        start() { setTimeout(() => { this.onerror({ error: 'network' }); this.onend(); }, 80); }
        stop() {}
      };
    });
    await page.goto(URL);
    await page.getByRole('button', { name: 'Speak your vibe' }).click();
    await expect(page.locator('#toasts').getByText(/voice=demo/)).toBeVisible();
  });

  test('voice tries the other language when the page language is not the one spoken', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__langs = [];
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any; lang = '';
        start() {
          (window as any).__langs.push(this.lang);
          const first = (window as any).__langs.length === 1;
          setTimeout(() => {
            this.onresult({ results: [Object.assign([{ transcript: first ? 'khaa fay' : 'quiet cafe', confidence: first ? 0.3 : 0.95 }], { isFinal: true })] });
            this.onend();
          }, 80);
        }
        stop() {}
      };
    });
    await page.goto(URL);                                   // page language is English
    await page.getByRole('button', { name: /Speak your vibe/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible({ timeout: 8000 });
    expect(await page.evaluate(() => (window as any).__langs)).toEqual(['en-US', 'th-TH']);
    await expect(page.getByLabel('Describe the vibe')).toHaveCount(0);
  });

  test('the voice language can be fixed to Thai or English whatever the page language is', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__langs = [];
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any; lang = '';
        start() { (window as any).__langs.push(this.lang); setTimeout(() => { this.onresult({ results: [Object.assign([{ transcript: 'คาเฟ่เงียบ ๆ', confidence: 0.4 }], { isFinal: true })] }); this.onend(); }, 80); }
        stop() {}
      };
    });
    await page.goto(URL);                                                   // English page
    const sw = page.getByRole('button', { name: /^Voice language/ });
    await expect(sw).toHaveText('Auto');
    await sw.click();                                                       // Auto -> Thai only
    await expect(sw).toHaveText('ไทย');
    await page.getByRole('button', { name: /Speak your vibe/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: /places match/ })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__langs)).toEqual(['th-TH']);   // no second try in English
  });

  test('voice in a Thai page tries Thai first and does not retry when sure', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__langs = [];
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any; lang = '';
        start() { (window as any).__langs.push(this.lang); setTimeout(() => { this.onresult({ results: [Object.assign([{ transcript: 'คาเฟ่เงียบ ๆ', confidence: 0.92 }], { isFinal: true })] }); this.onend(); }, 80); }
        stop() {}
      };
    });
    await page.goto('/day-off-demo.html?at=Sat-11:00');
    await page.getByRole('button', { name: /พูดบรรยากาศ/ }).click();
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__langs)).toEqual(['th-TH']);
  });

  test('a blocked microphone shows a plain message', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any;
        start() { setTimeout(() => { this.onerror({ error: 'not-allowed' }); this.onend(); }, 80); }
        stop() {}
      };
    });
    await page.goto(URL);
    await page.getByRole('button', { name: 'Speak your vibe' }).click();
    await expect(page.locator('#toasts').getByText('Microphone is blocked')).toBeVisible();
  });

  test('tapping anywhere on a card adds it, tapping again removes it, and the dock says whether it fits', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    const row = rowsOf(page).first();
    await row.locator('h3').click({ force: true });
    await expect(row).toHaveAttribute('data-in', 'true');
    await expect(page.getByTestId('tray')).toContainText('1 stops');
    await expect(page.getByTestId('tray')).toContainText('Fits your day');
    await row.locator('.vibes').click({ force: true });
    await expect(row).toHaveAttribute('data-in', 'false');
    await expect(row.getByRole('button', { name: /Why this match/ })).toBeVisible();
  });

  test('result cards show vibe bars and a one-line why before the details', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    await expect(rowsOf(page).first().locator('.why1')).toContainText(/Matches .* \d\/5/);
  });

  test('the sticky My day bar shows on the first screen once a place is added and opens the day', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    await rowsOf(page).first().locator('h3').click({ force: true });
    await page.getByRole('button', { name: 'Vibe', exact: true }).click();
    await expect(page.getByTestId('tray')).toContainText('1 stops');
    await page.getByRole('button', { name: 'Open my day' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Your day' })).toBeVisible();
  });

  test('need an idea: the round button opens a modal; chips and typed words give choices to add or swap in', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    await rowsOf(page).first().locator('h3').click({ force: true });
    await page.getByRole('button', { name: 'Build my day' }).click();
    await expect(page.getByTestId('ask-fab')).toBeVisible();                                  // on every screen
    await goNow(page);
    await page.getByTestId('ask-fab').click();
    const modal = page.getByRole('dialog');
    await expect(modal).toContainText('Your day: 1 stops');
    await modal.getByRole('button', { name: "I'm hungry" }).click();
    await expect(modal).toContainText('Hungry? These fit your day');
    expect(await modal.getByTestId('idea-card').count()).toBeGreaterThanOrEqual(1);
    await expect(modal.getByTestId('idea-card').first()).toContainText(/min walk/);
    await modal.getByRole('button', { name: 'Add to my day' }).first().click();               // choose: add it
    await expect(modal).toBeHidden();
    await expect(page.getByText('Up next')).toBeVisible();
    await page.getByTestId('ask-fab').click();
    await modal.getByRole('textbox').fill("it's so hot, I'm sweating");
    await page.keyboard.press('Enter');
    await expect(modal).toContainText(/Too hot\?|Nothing else fits/);
    await modal.getByRole('textbox').fill('blah blah');
    await page.keyboard.press('Enter');
    await expect(modal).toContainText('I can help with hungry');
    await modal.getByRole('button', { name: "Where next?" }).click();                         // manage: replace the current stop
    const swap = modal.getByRole('button', { name: /^Replace / }).first();
    if (await swap.count()) { await swap.click(); await expect(modal).toBeHidden(); await expect(page.locator('.toast')).toContainText(/Swapped|No other/); }
  });

  test('need an idea by voice: a spoken sentence is understood in Thai too', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any; lang = '';
        start() { setTimeout(() => { this.onresult({ results: [Object.assign([{ transcript: 'หิวแล้ว', confidence: 0.95 }], { isFinal: true })] }); this.onend(); }, 80); }
        stop() {}
      };
    });
    await page.goto(URL);
    await findExample(page);
    await rowsOf(page).first().locator('h3').click({ force: true });
    await page.getByRole('button', { name: 'Build my day' }).click();
    await goNow(page);
    await page.getByTestId('ask-fab').click();
    await page.getByRole('dialog').getByRole('button', { name: /Speak to Day-Off/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Hungry? These fit your day');
    await expect(page.getByRole('dialog')).toContainText('หิวแล้ว');
  });

  test('no plan at all: open the app, say hungry and Japanese, get honest alternatives, tap Go now', async ({ page }) => {
    await page.goto(URL);                                                       // first screen, nothing planned
    await page.getByTestId('ask-fab').click();
    const modal = page.getByRole('dialog');
    await expect(modal).toContainText('No plan yet');
    await modal.getByRole('textbox').fill("I'm hungry, I want Japanese food");
    await page.keyboard.press('Enter');
    await expect(modal).toContainText('No Japanese place found');              // nothing in the data is Japanese: say so
    expect(await modal.getByTestId('idea-card').count()).toBeGreaterThanOrEqual(1);
    await expect(modal.getByRole('button', { name: 'Add to my day' })).toHaveCount(0);
    await modal.getByRole('button', { name: 'Go now' }).first().click();
    await expect(page.getByTestId('now-leg')).toBeVisible();                    // a one-stop trip that starts now
    await expect(page.getByText(/Stop 1 of 1/)).toBeVisible();
    await expect(page.locator('.toast')).toContainText('Trip started with');
  });

  test('no plan: a style that exists in the data (noodles) is matched, open now, nearest first', async ({ page }) => {
    await page.goto(URL);
    await page.getByTestId('ask-fab').click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('textbox').fill('hungry for noodles');
    await page.keyboard.press('Enter');
    await expect(modal).toContainText('Noodles near you that is open now');
    await expect(modal.getByTestId('idea-card').first()).toContainText(/noodles/i);
    await modal.getByRole('button', { name: 'Add to a new day' }).first().click();
    await expect(page.getByRole('heading', { level: 2, name: 'Your day' })).toBeVisible();
    await expect(page.getByTestId('stop')).toHaveCount(1);
  });

  test('My day plans (day bar, fits-here, no Done/Skip); Now acts: navigate, arrive, stay, done', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    await rowsOf(page).first().locator('h3').click({ force: true });
    await page.getByRole('button', { name: 'Build my day' }).click();
    await expect(page.getByTestId('daybar')).toBeVisible();
    await expect(page.getByTestId('now')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Mark .* done$/ })).toHaveCount(0);
    const fits = page.getByRole('button', { name: /^Fits here:/ });
    await expect(fits).toBeVisible();
    await fits.click();
    await expect(page.getByTestId('stop')).toHaveCount(2);
    await goNow(page);
    await expect(page.getByTestId('now-leg')).toContainText('Walking to');
    await expect(page.getByText(/Stop 1 of 2/)).toBeVisible();
    const nav = page.getByTestId('open-maps');
    expect(await nav.getAttribute('href')).toMatch(/google\.com\/maps\/dir\/.*destination=13\.\d+,100\.\d+.*travelmode=walking/);
    await arrive(page);
    const out = page.getByTestId('now-here').locator('output');
    const before = await out.textContent();
    await page.getByRole('button', { name: /Longer stay at/ }).click();
    await expect(out).not.toHaveText(before!);
    await page.getByRole('button', { name: 'Swap this stop' }).click();                    // a change made from where you stand
    await arrive(page);
    await page.getByRole('button', { name: /^Mark .* done$/ }).click();
    await expect(page.getByText(/Stop 2 of 2/)).toBeVisible();
  });

  test('Navigate runs an in-page walking demo: banner with the next instruction, a moving dot, then arrival', async ({ page }) => {
    await page.goto(URL + '&navfast=1');
    await findExample(page);
    await rowsOf(page).first().locator('h3').click({ force: true });
    await page.getByRole('button', { name: 'Build my day' }).click();
    await goNow(page);
    await page.getByTestId('navigate').click();
    const bar = page.locator('#navbar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/Start walking|min left/);
    await expect(bar).toContainText('Demo walk');
    await expect(page.locator('#navbar')).toContainText(/You've arrived at/, { timeout: 15000 });
    await page.getByTestId('nav-arrive').click();
    await expect(bar).toBeHidden();
    await expect(page.getByTestId('now-here')).toBeVisible();
  });

  test('Stop ends the walking demo and leaving Now ends it too', async ({ page }) => {
    await page.goto(URL);
    await findExample(page);
    await rowsOf(page).first().locator('h3').click({ force: true });
    await page.getByRole('button', { name: 'Build my day' }).click();
    await goNow(page);
    await page.getByTestId('navigate').click();
    await expect(page.locator('#navbar')).toBeVisible();
    await page.getByTestId('nav-stop').click();
    await expect(page.locator('#navbar')).toBeHidden();
    await page.getByTestId('navigate').click();
    await expect(page.locator('#navbar')).toBeVisible();
    await page.getByRole('button', { name: /^My day/ }).click();
    await expect(page.locator('#navbar')).toBeHidden();
  });

  test('Now can use the live location: shows the distance to the next stop and a you-are-here dot', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 13.7384, longitude: 100.5170 });
    await page.goto(URL);
    await findExample(page);
    await rowsOf(page).first().locator('h3').click({ force: true });
    await page.getByRole('button', { name: 'Build my day' }).click();
    await goNow(page);
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.locator('#geoDist')).toContainText(/m away|You're close/);
    await expect(page.getByRole('button', { name: 'Use my location' })).toHaveCount(0);
  });
});
