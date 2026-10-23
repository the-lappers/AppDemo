import { test, expect, Page } from '@playwright/test';

/* The five experimental versions (swipe, mixer, line, room, gonow) and the compare hub (versions.html).
   Classic and chat have their own specs. Tiles, photos and routing are blocked so nothing leaves the machine. */
const q = '?lang=en&at=Sat-11:00';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function open(page: Page, file: string, extra = '') {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|tile/i.test(m.text())) errors.push(m.text()); });
  await page.route(/tile\.openstreetmap|basemaps\.cartocdn|api\.mapbox|ms\.longdo|wikipedia|wikimedia|routing\.openstreetmap/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.goto(`/${file}${q}${extra}`);
  return errors;
}
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 900;

test.describe('swipe deck', () => {
  test('setup, swipe with buttons and keys, undo, build a day, remove with undo', async ({ page }) => {
    const errors = await open(page, 'day-off-swipe.html');
    await expect(page.getByRole('heading', { name: 'How long is your day off?' })).toBeVisible();
    await page.getByRole('button', { name: /Full day/ }).click();
    await expect(page.locator('.prog')).toContainText('Kept 0');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.prog')).toContainText('Kept 1');
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await expect(page.locator('.prog')).toContainText('Kept 2');
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Undo swipe' }).click();
    await expect(page.locator('.prog')).toContainText('Kept 2');
    await page.getByRole('button', { name: 'Undo swipe' }).click();
    await expect(page.locator('.prog')).toContainText('Kept 1');
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await expect(page.locator('.prog')).toContainText('Kept 2');
    await page.getByRole('button', { name: /Build my day \(2\)/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Your day' })).toBeVisible();
    await expect(page.locator('.tk')).toHaveCount(2);
    await page.getByRole('button', { name: /^Remove/ }).first().click();
    await expect(page.locator('.tk')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.tk')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
  test('Thai labels and the version menu', async ({ page }) => {
    await open(page, 'day-off-swipe.html');
    await page.getByRole('button', { name: 'ไทย' }).click();
    await expect(page.getByRole('heading', { name: 'วันหยุดของคุณยาวแค่ไหน?' })).toBeVisible();
    await page.getByRole('button', { name: /สไลด์เลือก/ }).click();
    await expect(page.getByRole('link', { name: /Mood mixer|มิกเซอร์วาย/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#vmenu')).toBeHidden();
  });
});

test.describe('mood mixer', () => {
  test('radar handles work by keyboard, presets and filters re-rank, plan from the mix', async ({ page }) => {
    const errors = await open(page, 'day-off-mixer.html');
    const calm = page.getByRole('slider', { name: 'Calm' });
    await expect(calm).toHaveAttribute('aria-valuenow', '2.5');
    await calm.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('slider', { name: 'Calm' })).toHaveAttribute('aria-valuenow', '3.5');
    await page.getByRole('button', { name: 'Night eats' }).click();
    await expect(page.getByRole('slider', { name: 'Street food' })).toHaveAttribute('aria-valuenow', '5');
    await expect(page.locator('.rr').first()).toContainText(/T&K Seafood|Yoo Fishball|Nai Mong/);
    await page.getByRole('button', { name: '฿', exact: true }).click();
    const rows = await page.locator('.rr').count();
    expect(rows).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Any', exact: true }).click();
    await page.getByRole('button', { name: /^Add / }).first().click();
    await page.getByRole('button', { name: /Plan my day from this mix \(1\)/ }).click();
    await expect(page.getByRole('heading', { name: 'Your day' })).toBeVisible();
    await expect(page.locator('.st')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
  test('dragging a handle changes the value', async ({ page }) => {
    test.skip(isPhone(page), 'pointer drag is checked on desktop');
    await open(page, 'day-off-mixer.html');
    const h = page.locator('.rh[data-k="art"]'); const b = (await h.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 90, { steps: 6 }); await page.mouse.up();
    const v = Number(await page.getByRole('slider', { name: 'Art' }).getAttribute('aria-valuenow'));
    expect(v).not.toBe(2.5);
  });
});

test.describe('day line', () => {
  test('empty state, add the first stop, a fitting stop, stay, reorder, late, conflict, undo clear', async ({ page }) => {
    const errors = await open(page, 'day-off-line.html');
    await expect(page.getByRole('heading', { name: 'Your line is empty' })).toBeVisible();
    await page.getByRole('button', { name: 'Load a sample line' }).click();
    await expect(page.locator('.stn:not(.term)')).toHaveCount(4);
    await page.getByRole('button', { name: 'Longer' }).first().click();
    await expect(page.getByText('Stay 1 h 5 min').first()).toBeVisible();
    await page.getByRole('button', { name: 'Move later' }).first().click();
    await page.getByRole('button', { name: '+60' }).click();
    await expect(page.getByRole('button', { name: '+60' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Add a stop at the end' }).click();
    await expect(page.getByRole('heading', { name: 'Add a stop' })).toBeVisible();
    await expect(page.locator('#pick .pi.no').first()).toBeVisible();
    await expect(page.locator('#pick .pi:not(.no)').first()).toContainText('Fits');
    await page.locator('#pick .pi:not(.no)').first().click();
    await expect(page.locator('.stn:not(.term)')).toHaveCount(5);
    await page.getByRole('button', { name: 'Clear line' }).click();
    await expect(page.getByRole('heading', { name: 'Your line is empty' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.stn:not(.term)')).toHaveCount(5);
    expect(errors).toEqual([]);
  });
  test('a stop that runs past your day end is flagged with the reason', async ({ page }) => {
    await open(page, 'day-off-line.html');
    await page.getByRole('button', { name: 'Load a sample line' }).click();
    for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'End −30' }).click();
    await expect(page.locator('.pill.bad').first()).toContainText(/after your day end|you would finish/);
  });
});

test.describe('friends room', () => {
  test('votes change the tally, plan from votes shows fairness and cost', async ({ page }) => {
    const errors = await open(page, 'day-off-room.html');
    await expect(page.getByText('Everyone agrees on')).toBeVisible();
    const card = page.locator('.pc').first();
    const before = await card.getByText(/\d of 4 like/).innerText();
    await card.getByRole('button', { name: 'Like' }).click();
    await expect(page.locator('.pc [aria-pressed="true"]').first()).toBeVisible();
    await page.getByRole('button', { name: 'My votes' }).click();
    await expect(page.locator('.pc')).toHaveCount(1);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByRole('button', { name: 'Plan from votes' }).first().click();
    await expect(page.getByRole('heading', { name: "The group's day" })).toBeVisible();
    await expect(page.getByText('Who gets what they voted for')).toBeVisible();
    await expect(page.getByText(/Estimated cost per person/)).toBeVisible();
    expect(before).toMatch(/of 4 like/);
    expect(errors).toEqual([]);
  });
  test('the invite link is copied', async ({ page }) => {
    await open(page, 'day-off-room.html');
    await page.getByRole('button', { name: 'Copy invite link' }).click();
    await expect(page.getByText('Invite link copied')).toBeVisible();
  });
});

test.describe('go now', () => {
  test('pick a mood, leave-in number, here, done moves on, swap, skip with undo, recap', async ({ page }) => {
    const errors = await open(page, 'day-off-gonow.html');
    await expect(page.getByRole('heading', { name: "What is today's mood?" })).toBeVisible();
    await page.getByRole('button', { name: /Slow and old/ }).click();
    await expect(page.getByText(/Stop 1 of \d/)).toBeVisible();
    await expect(page.locator('.big')).toBeVisible();
    await expect(page.getByRole('link', { name: /Go, open the route/ })).toHaveAttribute('href', /google\.com\/maps\/dir.*walking/);
    await page.getByRole('button', { name: 'I am here' }).click();
    await page.getByRole('button', { name: /Done, next stop/ }).click();
    await expect(page.getByText(/Stop 2 of \d/)).toBeVisible();
    await page.getByRole('button', { name: 'Running late +15' }).click();
    await expect(page.getByText('Late by 15 min')).toBeVisible();
    const name = await page.locator('.card h1').innerText();
    await page.getByRole('button', { name: 'Skip this one' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.card h1')).toHaveText(name);
    await page.getByRole('button', { name: 'Hungry' }).click();
    expect(errors).toEqual([]);
  });
  test('finishing every stop shows the recap', async ({ page }) => {
    await open(page, 'day-off-gonow.html');
    await page.getByRole('button', { name: 'Try a day already in progress' }).click();
    for (let i = 0; i < 6; i++) {
      if (await page.getByRole('heading', { name: 'Day done' }).isVisible()) break;
      await page.getByRole('button', { name: 'I am here' }).click();
      await page.getByRole('button', { name: /Done, next stop/ }).click();
    }
    await expect(page.getByRole('heading', { name: 'Day done' })).toBeVisible();
    await page.getByRole('button', { name: 'Plan another day' }).click();
    await expect(page.getByRole('heading', { name: "What is today's mood?" })).toBeVisible();
  });
});

test.describe('compare hub and the way between versions', () => {
  test('lists all eight versions with pros, cons, flow and working links', async ({ page, request }) => {
    const errors = await open(page, 'versions.html');
    await expect(page.getByRole('heading', { name: 'Eight ways to plan one day' })).toBeVisible();
    await expect(page.locator('.vcard')).toHaveCount(8);
    await expect(page.locator('.vcard .box.pro')).toHaveCount(8);
    await expect(page.locator('.vcard .box.con')).toHaveCount(8);
    await expect(page.getByRole('table')).toBeVisible();
    const hrefs = await page.locator('.vcard a.btn').evaluateAll(els => els.map(e => (e as HTMLAnchorElement).getAttribute('href')!.split('?')[0]));
    expect(hrefs).toEqual(['day-off-demo.html', 'day-off-chat.html', 'day-off-swipe.html', 'day-off-mixer.html', 'day-off-line.html', 'day-off-room.html', 'day-off-gonow.html', 'day-off-home.html']);
    for (const h of hrefs) expect((await request.get('/' + h)).status()).toBe(200);
    await page.getByRole('button', { name: 'ไทย' }).click();
    await expect(page.getByRole('heading', { name: 'แปดวิธีวางแผนหนึ่งวัน' })).toBeVisible();
    expect(errors).toEqual([]);
  });
  test('classic and chat link to the hub; the version menu opens other versions', async ({ page }) => {
    await open(page, 'day-off-demo.html');
    await expect(page.getByTestId('to-hub')).toHaveAttribute('aria-label', 'Compare all versions');
    await page.getByTestId('to-hub').click();
    await expect(page).toHaveURL(/versions\.html/);
    await page.goBack();
    await page.goto('/day-off-chat.html' + q);
    await expect(page.getByTestId('to-hub')).toBeVisible();
    await page.goto('/day-off-room.html' + q);
    await page.locator('#vbtn').click();
    await page.getByRole('link', { name: /Go now/ }).click();
    await expect(page).toHaveURL(/day-off-gonow\.html\?lang=en/);
  });
  test('shared files are served, and env.js still exposes only the two map keys', async ({ request }) => {
    for (const f of ['shared/core.js', 'shared/ui.js', 'shared/map.js', 'shared/base.css', 'shared/sprite.js', 'shared/previews/swipe.png']) expect((await request.get('/' + f)).status(), f).toBe(200);
    const env = await (await request.get('/env.js')).text();
    expect(Object.keys(JSON.parse(env.replace(/^window\.DAYOFF_ENV=/, '').replace(/;$/, '')))).toEqual(['MAP_BLOCK_KEY', 'LONGDO_MAP_KEY']);
  });
  test('every new page keeps a visible keyboard focus ring', async ({ page }) => {
    for (const f of ['day-off-swipe.html', 'day-off-mixer.html', 'day-off-line.html', 'day-off-room.html', 'day-off-gonow.html', 'versions.html']) {
      await page.goto(`/${f}${q}`);
      const css = await page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch { return []; } }).join('\n'));
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => { const e = document.activeElement as HTMLElement; return e ? getComputedStyle(e).outlineStyle : 'none'; });
      expect(outline, f).not.toBe('none');
    }
  });
});
