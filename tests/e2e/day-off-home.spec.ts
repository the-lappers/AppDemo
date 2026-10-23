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
