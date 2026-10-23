import { test, expect } from '@playwright/test';

// The pages use places from /places.js (the server fills it from data/places.json) and fall back to the bundled ones.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const mk = (id: string, en: string, type: string, lat: number, lng: number) => ({ id, osm: '', en, th: en, area: 'yaowarat', type, cat: type, icon: type === 'cafe' ? 'coffee' : type === 'shrine' ? 'shrine' : 'food', tone: 'ink', lat, lng, h: 'Mo-Su 08:00-22:00', dur: 40, tags: { calm: 3, oldtown: 3, street: 3, art: 3, river: 3, lively: 3 }, price: 1 });
const CUSTOM = [mk('c1', 'Friend Cafe One', 'cafe', 13.741, 100.51), mk('c2', 'Friend Noodle Two', 'food', 13.7425, 100.508), mk('c3', 'Friend Shrine Three', 'shrine', 13.739, 100.512)];

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|api\.mapbox\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/wikipedia\.org|commons\.wikimedia\.org|routing\.openstreetmap\.de/, (r) => r.fulfill({ status: 404, body: '{}' }));
});

test('without a data file the bundled places are used', async ({ page }) => {
  await page.goto('/day-off-demo.html?lang=en&at=Sat-11:00');
  expect(await page.evaluate(() => (window as any).DAYOFF_PLACES)).toBeNull();
  expect(await page.evaluate(() => PLACES.length)).toBe(15);
});

for (const file of ['day-off-demo', 'day-off-home', 'day-off-chat', 'day-off-swipe', 'day-off-mixer', 'day-off-line', 'day-off-room', 'day-off-gonow', 'day-off-trips']) {
  test(`${file} runs on the friend's data with no errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/places.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.DAYOFF_PLACES=${JSON.stringify(CUSTOM)};` }));
    await page.goto(`/${file}.html?lang=en&at=Sat-11:00`);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => PLACES.map((p: any) => p.id))).toEqual(['c1', 'c2', 'c3']);
    expect(errors).toEqual([]);
  });
}

test('Places lists the friend\'s places', async ({ page }) => {
  await page.route('**/places.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.DAYOFF_PLACES=${JSON.stringify(CUSTOM)};` }));
  await page.goto('/day-off-home.html?lang=en&at=Sat-11:00');
  await page.getByTestId('browse-places').click();
  await expect(page.getByTestId('results').locator('li.row').first()).toBeVisible();
  await expect(page.getByTestId('results')).toContainText('Friend');
});
