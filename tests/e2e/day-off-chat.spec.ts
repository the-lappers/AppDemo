import { test, expect, Page } from '@playwright/test';

/* Chat version of Day-Off (day-off-chat.html). The classic page keeps its own spec; this one only covers the chat. */
const URL = '/day-off-chat.html?lang=en&at=Sat-11:00';

async function open(page: Page, url = URL) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|tile/i.test(m.text())) errors.push(m.text()); });
  await page.route(/tile\.openstreetmap|basemaps\.cartocdn|api\.mapbox|ms\.longdo|wikipedia|wikimedia|routing\.openstreetmap/, r => r.fulfill({ status: 404, body: '' }));
  await page.goto(url);
  await expect(page.getByTestId('chat-log')).toContainText('Where should I take you today');
  return errors;
}
const send = async (page: Page, text: string) => { await page.locator('#msg').fill(text); await page.locator('#msg').press('Enter'); };
const chip = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).first();
const cards = (page: Page) => page.getByTestId('pcard');
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 900;

test.describe('chat basics', () => {
  test('greets with starter chips and an honest demo note, no console errors', async ({ page }) => {
    const errors = await open(page);
    for (const n of ['Chill cafe', 'Cheap street food', 'Open right now', 'Plan my whole day', 'Load sample trip']) {
      await expect(chip(page, n)).toBeVisible();
    }
    await expect(page.getByTestId('chat-log')).toContainText('no live AI');
    await expect(page.getByRole('log', { name: 'Conversation with Day-Off' })).toBeVisible();
    await expect(page.getByLabel('Message Day-Off')).toBeVisible();
    await expect(page.getByTestId('daybar')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a starter chip sends a message and the reply shows place cards', async ({ page }) => {
    await open(page);
    await chip(page, 'Chill cafe').click();
    await expect(page.getByRole('status').filter({ hasText: 'typing' })).toHaveCount(0);   // never stuck on typing
    await expect(page.getByTestId('chat-log')).toContainText('Found');
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).first()).toContainText('Best match');
    await expect(page.getByText('Show 3 more')).toBeVisible();
    await page.getByText('Show 3 more').click();
    await expect(cards(page)).toHaveCount(6);
  });

  test('typing free text works in English and Thai, Enter sends, Shift+Enter does not', async ({ page }) => {
    await open(page);
    await page.locator('#msg').fill('quiet cafe, old walls');
    await page.locator('#msg').press('Shift+Enter');
    await expect(page.getByTestId('chat-log')).not.toContainText('Found');
    await page.locator('#msg').press('Enter');
    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByTestId('chat-log')).toContainText('quiet cafe, old walls');
    await send(page, 'ของกินริมทาง');
    await expect(page.getByTestId('chat-log')).toContainText('ของกินริมทาง');
    await expect(cards(page).first()).toBeVisible();
    await expect(page.locator('#msg')).toHaveValue('');
  });

  test('the send button is disabled until there is text', async ({ page }) => {
    await open(page);
    await expect(page.locator('#send')).toBeDisabled();
    await page.locator('#msg').fill('hi there');
    await expect(page.locator('#send')).toBeEnabled();
  });

  test('unknown words get an honest reply with examples, not a silent list', async ({ page }) => {
    await open(page);
    await send(page, 'zzzz qqqq');
    await expect(page.getByTestId('chat-log')).toContainText("I don't know “zzzz qqqq” yet");
    await expect(page.getByRole('button', { name: 'Art and murals' }).first()).toBeVisible();
  });

  test('help lists what the chat can do', async ({ page }) => {
    await open(page);
    await send(page, 'what can you do?');
    await expect(page.getByTestId('chat-log')).toContainText('plan a whole day');
  });

  test('language switch re-translates the whole conversation', async ({ page }) => {
    await open(page);
    await chip(page, 'Chill cafe').click();
    await expect(cards(page).first()).toBeVisible();
    await page.getByRole('button', { name: 'ไทย' }).click();
    await expect(page.getByTestId('chat-log')).toContainText('สวัสดี! วันนี้อยากให้พาไปไหนดี');
    await expect(page.getByTestId('chat-log')).toContainText('เจอ');
    await expect(page.getByTestId('chat-log')).toContainText('เพิ่มเข้าวัน');
    await expect(page.getByLabel('พิมพ์ถึง Day-Off')).toBeVisible();
  });
});

test.describe('filters inside the conversation', () => {
  test('"Cheap street food" applies a price filter and says so', async ({ page }) => {
    await open(page);
    await chip(page, 'Cheap street food').click();
    await expect(page.getByTestId('chat-log')).toContainText('Filters now: Up to ฿');
    const metas = await cards(page).locator('.meta').allTextContents();
    expect(metas.length).toBeGreaterThan(0);
    for (const m of metas) expect(m).not.toContain('฿฿');
  });

  test('"Open right now" and "Closer" re-run the last search with the filter', async ({ page }) => {
    await open(page, '/day-off-chat.html?lang=en&at=Sat-20:30');
    await chip(page, 'Open right now').click();
    await expect(page.getByTestId('chat-log')).toContainText('Open now');
    for (const m of await cards(page).locator('.meta').allTextContents()) expect(m).not.toContain('Closed today');
    await chip(page, 'Closer').click();
    await expect(page.getByTestId('chat-log')).toContainText('Within');
  });

  test('sliders re-rank the latest list live without rebuilding the slider', async ({ page }) => {
    await open(page);
    await chip(page, 'Chill cafe').click();
    await expect(cards(page).first()).toBeVisible();
    await chip(page, 'Show filters').click();
    const price = page.locator('#fPrice');
    await expect(price).toBeVisible();
    await price.focus();
    await page.evaluate(() => { (window as any).__slider = document.getElementById('fPrice'); });
    await price.fill('0');
    await expect(page.getByTestId('chat-log')).toContainText('Free only');
    await expect(page.locator('#fPrice-o')).toHaveText('Free only');
    const same = await page.evaluate(() => (window as any).__slider === document.getElementById('fPrice'));
    expect(same).toBe(true);                                    // same element: a drag in progress is never interrupted
    await expect(price).toBeFocused();
    const metas = await cards(page).last().locator('.meta').allTextContents();
    for (const m of metas) expect(m).toContain('Free');
    await page.getByRole('button', { name: 'Reset filters' }).first().click();
    await expect(page.locator('#fPrice-o')).toHaveText('Any price');
  });
});

test.describe('my day', () => {
  test('adding from a card fills the day bar and toggles back', async ({ page }) => {
    await open(page);
    await chip(page, 'Chill cafe').click();
    await expect(cards(page).first()).toBeVisible();
    const add = cards(page).first().getByRole('button', { name: /^Add .* to my day$/ });
    await add.click();
    await expect(page.getByTestId('daybar')).toContainText('1 stops');
    await expect(cards(page).first().getByRole('button', { name: /^Remove .* from my day$/ })).toHaveAttribute('aria-pressed', 'true');
    await cards(page).first().getByRole('button', { name: /^Remove .* from my day$/ }).click();
    await expect(page.getByTestId('daybar')).toHaveCount(0);
  });

  test('"Plan my whole day" builds a feasible day and opens it on request', async ({ page }) => {
    await open(page);
    await chip(page, 'Plan my whole day').click();
    await expect(page.getByTestId('miniday')).toBeVisible();
    const rows = await page.getByTestId('miniday').locator('li').count();
    expect(rows).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('daybar')).toContainText(`${rows} stops`);
    await page.getByRole('button', { name: 'Open my day' }).first().click();
    await expect(page.getByTestId('timeline')).toBeVisible();
    await expect(page.getByTestId('stop')).toHaveCount(rows);
    await expect(page.locator('#chatmain')).toHaveAttribute('inert', '');
    await page.getByRole('button', { name: 'Back to chat' }).click();
    await expect(page.getByTestId('timeline')).toBeHidden();
    await expect(page.locator('#chatmain')).not.toHaveAttribute('inert', '');
    await expect(page.getByTestId('daybar')).toBeFocused();
  });

  test('Escape closes the day panel', async ({ page }) => {
    await open(page);
    await chip(page, 'Load sample trip').click();
    await page.getByTestId('daybar').click();
    await expect(page.getByTestId('timeline')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('timeline')).toBeHidden();
  });

  test('the day panel keeps every old feature: stay stepper, done, skip, reorder, late, share', async ({ page }) => {
    await open(page);
    await chip(page, 'Load sample trip').click();
    await page.getByTestId('daybar').click();
    const stops = page.getByTestId('stop');
    await expect(stops.first()).toHaveClass(/done/);                       // sample: first stop already visited
    const second = stops.nth(1);
    const before = await second.locator('.stay output').textContent();
    await second.getByRole('button', { name: /^Longer stay at/ }).click();
    await expect(page.getByTestId('stop').nth(1).locator('.stay output')).not.toHaveText(before!);
    const name2 = await second.locator('h3').textContent();
    await second.getByRole('button', { name: /^Reorder / }).press('ArrowDown');
    await expect(page.getByText('Manual order')).toBeVisible();
    await expect(page.getByTestId('stop').nth(2).locator('h3')).toHaveText(name2!);
    await page.getByRole('button', { name: 'Running late? Re-plan' }).click();
    await expect(page.getByTestId('diff')).toBeVisible();
    await page.getByTestId('apply').click();
    await expect(page.locator('.late-chip', { hasText: 'late' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Share trip' }).click();
    await expect(page.getByTestId('votes')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    const cur = page.getByTestId('stop').nth(1);
    await cur.getByRole('button', { name: /^Mark .* done$/ }).click();
    await expect(page.getByTestId('stop').nth(1)).toHaveClass(/done/);
  });

  test('Mapbox-free, route and numbered pins show in the day panel', async ({ page }) => {
    await open(page);
    await chip(page, 'Plan my whole day').click();
    await expect(page.getByTestId('miniday')).toBeVisible();
    await page.getByRole('button', { name: 'Open my day' }).first().click();
    await expect(page.locator('.pin.num').first()).toBeVisible();
    expect(await page.locator('.pin.num').count()).toBeGreaterThanOrEqual(3);
  });
});

test.describe('where next, late, share, sample', () => {
  test('"Where should I go next?" without a day starts with good places', async ({ page }) => {
    await open(page);
    await send(page, 'where should I go?');
    await expect(page.getByTestId('chat-log')).toContainText('Good places to start');
    await expect(cards(page).first()).toBeVisible();
  });

  test('next-stop suggestion: add it, or reject it for a different one', async ({ page }) => {
    await open(page);
    await chip(page, 'Load sample trip').click();
    await expect(page.getByTestId('suggest').first()).toBeVisible();
    const sug = page.getByTestId('suggest').last();
    const first = await sug.locator('h3').textContent();
    await sug.getByRole('button', { name: 'Not this one' }).click();
    await expect(page.getByTestId('suggest')).toHaveCount(2);
    const second = await page.getByTestId('suggest').last().locator('h3').textContent();
    expect(second).not.toBe(first);
    await expect(sug).toContainText('Not this one');
    const before = await page.getByTestId('daybar').textContent();
    await page.getByTestId('suggest').last().getByRole('button', { name: 'Add to my day' }).click();
    await expect(page.getByTestId('chat-log')).toContainText('Added');
    await expect(page.getByTestId('daybar')).not.toHaveText(before!);
  });

  test('"I\'m 1 hour late" re-plans, explains and can be undone; without a day it asks for a stop', async ({ page }) => {
    await open(page);
    await send(page, "I'm late");
    await expect(page.getByTestId('chat-log')).toContainText('Add a stop first');
    await chip(page, 'Load sample trip').click();
    await expect(page.getByTestId('suggest').first()).toBeVisible();
    await chip(page, "I'm 1 hour late").click();
    await expect(page.getByTestId('chat-log')).toContainText('Re-planned for 1 hr late');
    await page.getByTestId('daybar').click();
    await expect(page.locator('.late-chip', { hasText: '1 hr' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to chat' }).click();
    await page.getByRole('button', { name: 'Undo last change' }).first().click();
    await page.getByTestId('daybar').click();
    await expect(page.locator('.late-chip', { hasText: '1 hr' })).toHaveCount(0);
  });

  test('"Share my trip" opens the share sheet with friend votes', async ({ page }) => {
    await open(page);
    await chip(page, 'Load sample trip').click();
    await chip(page, 'Share my trip').click();
    await expect(page.getByTestId('votes')).toBeVisible();
    await expect(page.getByTestId('group-diff')).toBeVisible();
  });

  test('"done" and "skip" act on the current stop', async ({ page }) => {
    await open(page);
    await chip(page, 'Load sample trip').click();
    await expect(page.getByTestId('suggest').first()).toBeVisible();
    await send(page, 'done');
    await expect(page.getByTestId('chat-log')).toContainText('done.');
    await send(page, 'skip');
    await expect(page.getByTestId('chat-log')).toContainText('Skipped');
  });

  test('place details open from a card and from a map pin', async ({ page }) => {
    await open(page);
    await chip(page, 'Chill cafe').click();
    await cards(page).first().getByRole('button', { name: /^Details for/ }).click();
    await expect(page.locator('#sheet')).toContainText('Vibe scores (demo estimates)');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('#sheet')).not.toHaveAttribute('open', '');
  });

  test('tapping a card photo pans the map to that place', async ({ page }) => {
    await open(page);
    await chip(page, 'Chill cafe').click();
    const target = cards(page).nth(1);
    const id = await target.getAttribute('data-id');
    await target.getByRole('button', { name: /^Show .* on map$/ }).click();
    await expect(page.locator('.leaflet-tooltip').first()).toBeVisible();
    expect(id).toBeTruthy();
  });
});

test.describe('layout', () => {
  test('desktop: chat 55% and map 45% side by side', async ({ page }) => {
    test.skip(isPhone(page), 'desktop only');
    await open(page);
    const chat = (await page.locator('#chatcol').boundingBox())!, map = (await page.locator('#mapcol').boundingBox())!;
    const w = chat.width + map.width;
    expect(Math.abs(chat.width / w - 0.55)).toBeLessThan(0.02);
    expect(Math.abs(map.width / w - 0.45)).toBeLessThan(0.02);
    await expect(page.locator('#mapbar')).toBeHidden();
  });

  test('phone: map strip on top can go full screen, hide, and come back', async ({ page }) => {
    test.skip(!isPhone(page), 'phone only');
    await open(page);
    const strip = (await page.locator('#mapcol').boundingBox())!;
    expect(strip.height).toBeGreaterThan(120); expect(strip.height).toBeLessThan(200);
    await page.getByRole('button', { name: 'Full screen map' }).click();
    const full = (await page.locator('#mapcol').boundingBox())!;
    expect(full.height).toBeGreaterThan(500);
    await expect(page.locator('#chatcol')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#chatcol')).not.toHaveAttribute('inert', '');
    await page.getByRole('button', { name: 'Hide map' }).click();
    expect((await page.locator('#mapcol').boundingBox())!.height).toBeLessThan(70);
    await page.getByRole('button', { name: 'Show map' }).click();
    expect((await page.locator('#mapcol').boundingBox())!.height).toBeGreaterThan(120);
  });

  test('the composer stays pinned and visible while the conversation scrolls', async ({ page }) => {
    await open(page);
    for (const q of ['quiet cafe', 'street food', 'art and murals']) { await send(page, q); await expect(page.getByTestId('chat-log')).toContainText(q); }
    await expect(page.locator('#msg')).toBeInViewport();
    const box = (await page.locator('#bottom').boundingBox())!, vp = page.viewportSize()!;
    expect(Math.round(box.y + box.height)).toBeLessThanOrEqual(vp.height);
    expect(Math.round(box.y + box.height)).toBeGreaterThan(vp.height - 4);
  });

  test('the old classic page is still served unchanged', async ({ request }) => {
    const r = await request.get('/day-off-demo.html');
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain('What kind of day off do you want?');
  });
});

test.describe('look and accessibility', () => {
  test('no green anywhere, light and dark', async ({ page }) => {
    await open(page);
    await chip(page, 'Plan my whole day').click();
    await expect(page.getByTestId('miniday')).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        const hue = (c: string) => {
          const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] === 0)) return null;
          const [r, g, b] = [+m[1] / 255, +m[2] / 255, +m[3] / 255], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
          if (d < 0.12) return null;
          const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
          return ((h * 60) + 360) % 360;
        };
        document.querySelectorAll('body *').forEach(el => {
          if (el.closest('.leaflet-container')) return;                    // map tiles are not ours
          const cs = getComputedStyle(el);
          for (const p of ['color', 'backgroundColor', 'borderTopColor', 'fill', 'stroke'] as const) {
            const h = hue((cs as any)[p]); if (h !== null && h > 75 && h < 170) out.push(`${el.tagName}.${(el as HTMLElement).className} ${p}`);
          }
        });
        return out.slice(0, 5);
      });
      expect(bad, theme).toEqual([]);
    }
  });

  test('keyboard reaches chips, the composer and shows a visible focus ring', async ({ page }) => {
    await open(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    let seen = false;
    for (let i = 0; i < 25 && !seen; i++) {
      await page.keyboard.press('Tab');
      seen = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement; if (!el || !el.matches('.chip')) return false;
        const cs = getComputedStyle(el); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
      });
    }
    expect(seen).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-log')).toContainText('Found');
  });

  test('tap targets: 44px on touch, 32px with a mouse', async ({ page }) => {
    await open(page);
    await chip(page, 'Chill cafe').click();
    await expect(cards(page).first()).toBeVisible();
    await cards(page).first().getByRole('button', { name: /^Add / }).click();
    await expect(page.getByTestId('daybar')).toBeVisible();
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    const min = coarse ? 44 : 32;
    const small = await page.evaluate(m => {
      const out: string[] = [];
      document.querySelectorAll('#log button, #bottom button, #mapbar button, .header button').forEach(el => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (el.classList.contains('linkbtn')) return;
        if (r.height < m - 0.5 || r.width < m - 0.5) out.push(`${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      return out;
    }, min);
    expect(small).toEqual([]);
  });

  test('the typing indicator is announced and goes away', async ({ page }) => {
    await open(page);
    await send(page, 'quiet cafe');
    await expect(page.locator('#typing')).toBeVisible();
    await expect(page.locator('#typing')).toHaveCount(0);
  });
});

test.describe('map provider switch', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  test('Mapbox | Longdo switch changes the tiles and is remembered', async ({ page }) => {
    const longdo: string[] = [];
    await open(page);
    await page.route(/ms\.longdo\.com/, r => { longdo.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
    await page.route(/api\.mapbox/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await page.reload();
    const sw = page.getByRole('group', { name: 'Map provider' });
    await expect(sw).toBeVisible();
    await expect(sw.getByRole('button', { name: 'Mapbox' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#map')).toHaveAttribute('data-tiles', 'mapbox');
    await sw.getByRole('button', { name: 'Longdo' }).click();
    await expect(page.locator('#map')).toHaveAttribute('data-tiles', 'longdo');
    await expect(sw.getByRole('button', { name: 'Longdo' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => longdo.some(u => u.includes('key=longdo-test-key-not-real'))).toBe(true);
    await page.reload();
    await expect(page.locator('#map')).toHaveAttribute('data-tiles', 'longdo');
    await sw.getByRole('button', { name: 'Mapbox' }).click();
    await expect(page.locator('#map')).toHaveAttribute('data-tiles', 'mapbox');
  });
  test('without a Longdo key the switch is hidden', async ({ page }) => {
    await page.route(/\/env\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.DAYOFF_ENV={MAP_BLOCK_KEY:"pk.test-token-not-real"};' }));
    await open(page);
    await expect(page.locator('#mapsw')).toBeHidden();
  });
});

test.describe('switching versions and voice', () => {
  test('header icon opens the classic version and keeps the language; classic icon opens the chat', async ({ page }) => {
    await open(page);
    const link = page.getByTestId('to-classic');
    await expect(link).toHaveAttribute('aria-label', 'Open the classic version');
    await expect(link).toHaveAttribute('href', /day-off-demo\.html\?lang=en&at=Sat-11%3A00/);
    await link.click();
    await expect(page).toHaveURL(/day-off-demo\.html/);
    const back = page.getByTestId('to-chat');
    await expect(back).toHaveAttribute('aria-label', 'Open the chat version');
    await back.click();
    await expect(page).toHaveURL(/day-off-chat\.html\?lang=en/);
  });
  test('the site root opens the new Home page first', async ({ page }) => {
    await page.route(/tile\.openstreetmap|basemaps\.cartocdn|api\.mapbox|ms\.longdo|wikipedia|wikimedia|routing\.openstreetmap/, r => r.fulfill({ status: 404, body: '' }));
    await page.goto('/?lang=en');
    await expect(page).toHaveTitle(/Home/);
    await expect(page.getByTestId('plan-day')).toBeVisible();
    await expect(page.getByTestId('chat-log')).toHaveCount(0);
  });
  test('voice button is hidden when the browser has no speech recognition', async ({ page }) => {
    await page.addInitScript(() => { delete (window as any).SpeechRecognition; delete (window as any).webkitSpeechRecognition; });
    await open(page);
    await expect(page.getByTestId('mic')).toBeHidden();
  });
  test('speaking sends the recognised words as a chat message, in the page language', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = class {
        lang = ''; onresult: any; onend: any; onerror: any;
        start() { (window as any).__lang = this.lang; setTimeout(() => {
          const r: any = [{ transcript: 'cheap street food' }]; r.isFinal = true;
          this.onresult({ results: [r] }); this.onend(); }, 150); }
        stop() { this.onend && this.onend(); }
      };
    });
    await open(page);
    const mic = page.getByTestId('mic');
    await expect(mic).toBeVisible();
    await expect(mic).toHaveAttribute('aria-label', /Speak your question/);
    await mic.click();
    await expect(page.getByTestId('chat-log')).toContainText('cheap street food');
    await expect(cards(page).first()).toBeVisible();
    expect(await page.evaluate(() => (window as any).__lang)).toBe('en-US');
    await expect(mic).toHaveAttribute('aria-pressed', 'false');
  });
  test('a blocked microphone shows a plain message', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = (window as any).webkitSpeechRecognition = class {
        onresult: any; onend: any; onerror: any;
        start() { setTimeout(() => { this.onerror({ error: 'not-allowed' }); this.onend(); }, 100); }
        stop() {}
      };
    });
    await open(page);
    await page.getByTestId('mic').click();
    await expect(page.locator('#toasts').getByText('Microphone is blocked')).toBeVisible();
  });
});
