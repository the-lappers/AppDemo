import { test, expect } from '@playwright/test';

// Every page can get back to Home, and Navigate takes over the whole screen.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|api\.mapbox\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/wikipedia\.org|commons\.wikimedia\.org|routing\.openstreetmap\.de/, (r) => r.fulfill({ status: 404, body: '{}' }));
});

for (const f of ['day-off-chat', 'day-off-demo', 'day-off-swipe', 'day-off-mixer', 'day-off-line', 'day-off-room', 'day-off-gonow', 'versions', 'versions-compare']) {
  test(`${f} has a visible way back to Home that keeps the language`, async ({ page }) => {
    await page.goto(`/${f}.html?lang=en&at=Sat-11:00`);
    const home = page.getByTestId('to-home');
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('href', /day-off-home\.html.*lang=en/);
    expect((await home.boundingBox())!.height).toBeGreaterThanOrEqual(36);   // the app's own tap size on a mouse screen; 44 on touch
    await home.click();
    await expect(page).toHaveURL(/day-off-home\.html/);
  });
}

test('the chat inside Home has no Home link (it has Close instead)', async ({ page }) => {
  await page.goto('/day-off-chat.html?lang=en&embed=1');
  await expect(page.getByTestId('to-home')).toBeHidden();
});

test('Navigate takes over the screen, shows a large instruction and Back to my day at the end', async ({ page }) => {
  await page.goto('/day-off-home.html?lang=en&at=Sat-11:00&navfast=1&tray=soheng,eiahsae,gulongbao&start=600&end=1080');
  await page.getByTestId('navigate').click();
  await expect(page.locator('body')).toHaveClass(/navmode/);
  await expect(page.locator('.header')).toBeHidden();
  await expect(page.locator('#panel')).toBeHidden();
  await expect(page.locator('#navbar')).toBeVisible();
  const fs = await page.locator('#navTxt').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(fs).toBeGreaterThanOrEqual(20);
  await expect(page.getByTestId('nav-stop')).toBeVisible();
  await expect(page.getByTestId('nav-arrive')).toHaveText("I've arrived");
  await expect(page.locator('#navbar')).toHaveClass(/done/, { timeout: 15000 });
  await expect(page.getByTestId('nav-arrive')).toHaveText('Back to my day');
  await expect(page.getByTestId('nav-stop')).toBeHidden();
  await page.getByTestId('nav-arrive').click();
  await expect(page.locator('body')).not.toHaveClass(/navmode/);
  await expect(page.locator('.header')).toBeVisible();
});

test('Stop leaves navigation and the day is still there; dragging the map shows Centre', async ({ page }) => {
  await page.goto('/day-off-home.html?lang=en&at=Sat-11:00&tray=soheng,eiahsae,gulongbao&start=600&end=1080');
  await page.getByTestId('navigate').click();
  await expect(page.getByTestId('nav-center')).toBeHidden();
  await page.locator('#map').hover();
  await page.mouse.down(); await page.mouse.move(200, 400, { steps: 5 }); await page.mouse.up();
  await expect(page.getByTestId('nav-center')).toBeVisible();
  await page.getByTestId('nav-center').click();
  await expect(page.getByTestId('nav-center')).toBeHidden();
  await page.getByTestId('nav-stop').click();
  await expect(page.locator('body')).not.toHaveClass(/navmode/);
  await expect(page.getByTestId('daybar')).toBeVisible();
});
