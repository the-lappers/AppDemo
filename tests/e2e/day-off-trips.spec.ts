import { test, expect } from '@playwright/test';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const HOME = '/day-off-home.html?lang=en&at=Sat-11:00';
const TRIPS = '/day-off-trips.html?lang=en&at=Sat-11:00';

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|api\.mapbox\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/wikipedia\.org|commons\.wikimedia\.org/, (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.route(/routing\.openstreetmap\.de/, (r) => r.fulfill({ status: 404, body: '{}' }));
});

test.describe('Home: bottom day bar and link to trips', () => {
  test('the day bar is fixed to the bottom and stays visible when the sheet is scrolled', async ({ page }) => {
    await page.goto(HOME + '&tray=soheng,eiahsae,gulongbao,yoofish&start=600&end=1080');
    const bar = page.locator('#daybarFix');
    await expect(bar).toBeVisible();
    await expect(bar.getByTestId('daybar')).toBeVisible();
    const vp = page.viewportSize()!;
    const box = (await bar.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(vp.height);
    await page.locator('#view').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(bar).toBeVisible();
    expect(await page.locator('#daybarFix .daybar').count()).toBe(1);
    expect(await page.locator('#view .daybar').count()).toBe(0); // not repeated inside the sheet
  });
  test('no bottom bar without a plan; the header links to My trips', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator('#daybarFix')).toBeHidden();
    await page.getByTestId('to-trips').click();
    await expect(page).toHaveURL(/day-off-trips\.html\?lang=en/);
  });
  test('a plan opened with ?tray= shows up and is remembered for the Trips page', async ({ page }) => {
    await page.goto(HOME + '&tray=soheng,eiahsae&start=600&end=1080');
    await expect(page.getByTestId('stop')).toHaveCount(2);
    await page.goto(TRIPS);
    await expect(page.getByTestId('trip-cur')).toContainText('2 stops');
  });
});

test.describe('Trips page', () => {
  test('shows current, past and shared sections; samples are labelled; no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(TRIPS);
    await expect(page.getByTestId('no-current')).toBeVisible();
    await expect(page.getByTestId('trip-past')).toHaveCount(2);
    await expect(page.getByText('Sample').first()).toBeVisible();
    await expect(page.getByTestId('back-home')).toHaveAttribute('href', /day-off-home\.html/);
    expect(errors).toEqual([]);
  });
  test('reuse opens Home with the trip', async ({ page }) => {
    await page.goto(TRIPS);
    await page.getByTestId('reuse').first().click();
    await expect(page).toHaveURL(/day-off-home\.html.*tray=/);
    await expect(page.getByTestId('stop')).toHaveCount(4);
  });
  test('finish saves the current trip into past trips', async ({ page }) => {
    await page.goto(HOME + '&tray=soheng,eiahsae,gulongbao&start=600&end=1080');
    await page.goto(TRIPS);
    await page.getByTestId('finish').click();
    await expect(page.getByTestId('no-current')).toBeVisible();
    await expect(page.getByTestId('trip-past')).toHaveCount(3);
  });
  test('rename, delete with undo', async ({ page }) => {
    await page.goto(TRIPS);
    await page.getByRole('button', { name: 'Rename' }).first().click();
    await page.locator('#nameTxt').fill('Slow Sunday');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Slow Sunday' })).toBeVisible();
    await page.getByTestId('delete').first().click();
    await expect(page.getByTestId('trip-past')).toHaveCount(1);
    await page.getByRole('button', { name: /Undo/ }).click();
    await expect(page.getByTestId('trip-past')).toHaveCount(2);
  });
  test('share gives a code, and joining with that code adds a shared trip', async ({ page }) => {
    await page.goto(TRIPS);
    await page.getByTestId('share').first().click();
    const code = await page.getByTestId('share-code').inputValue();
    expect(code).toMatch(/^DO1-/);
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('join-input').fill(code);
    await page.getByTestId('join-btn').click();
    await expect(page.getByTestId('shared').getByTestId('trip-past')).toHaveCount(1);
    await expect(page.getByTestId('shared')).toContainText('from a shared code');
  });
  test('a bad code says so, a ?join= link joins on load', async ({ page }) => {
    await page.goto(TRIPS);
    await page.getByTestId('join-input').fill('nonsense');
    await page.getByTestId('join-btn').click();
    await expect(page.locator('#joinErr')).toContainText('did not work');
    const code = 'DO1-' + Buffer.from(JSON.stringify({ s: ['soheng', 'naam'], a: 600, b: 1080, n: null })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await page.goto(TRIPS + '&join=' + code);
    await expect(page.getByTestId('shared')).toContainText('2 stops');
  });
  test('Thai works and the phone layout has no horizontal scroll', async ({ page }) => {
    await page.goto(TRIPS);
    await page.getByRole('button', { name: 'ไทย' }).click();
    await expect(page.getByRole('heading', { name: 'ทริปของฉัน' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('Before and after compare page', () => {
  test('shows the old main page against Home and Trips, with working links', async ({ page, request }) => {
    await page.goto('/versions-compare.html?lang=en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Before and after');
    await expect(page.getByTestId('col-before')).toContainText('Classic main page');
    await expect(page.getByTestId('col-after')).toContainText('Home and Trips');
    const hrefs = await page.locator('.acts a').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')!.split('?')[0]));
    expect(hrefs).toEqual(['day-off-demo.html', 'day-off-home.html', 'day-off-trips.html']);
    for (const h of hrefs) expect((await request.get('/' + h)).status()).toBe(200);
    for (const i of ['classic', 'home', 'trips']) expect((await request.get(`/shared/previews/${i}.png`)).status()).toBe(200);
    expect(await page.locator('nav').count()).toBe(0); // no nav bar here
    await page.getByRole('button', { name: 'ไทย' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ก่อนและหลัง');
  });
  test('Home links to it', async ({ page }) => {
    await page.goto(HOME);
    await page.getByRole('link', { name: 'Compare with the old version' }).click();
    await expect(page).toHaveURL(/versions-compare\.html/);
  });
});
