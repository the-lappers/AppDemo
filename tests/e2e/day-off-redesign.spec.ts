import { test, expect, Page } from '@playwright/test';

// Redesign flow: Explore | Plan | Next stop, built from the research-findings input table.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const URL = '/day-off-redesign.html?lang=en&at=Sat-11:00';

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|api\.mapbox\.com|ms\.longdo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/routing\.openstreetmap\.de/, (r) => r.fulfill({ status: 404, body: '{}' }));
});

// Next stop starts by asking: say what you feel like (a chip), then pick one of the options
const chooseNext = async (page: Page, chip = 'nx-eat') => {
  await page.getByTestId(chip).click();
  await page.getByTestId('next-options').locator('.pkc').first().click();
};

const errors = (page: Page) => { const e: string[] = []; page.on('pageerror', (x) => e.push(x.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|tile|net::/.test(m.text())) e.push(m.text()); }); return e; };

test('home shows the three intents, no console errors, and the tabs match', async ({ page }) => {
  const e = errors(page);
  await page.goto(URL);
  await expect(page.getByTestId('greet')).toHaveText(/Good (morning|afternoon|evening)/);
  for (const s of ['explore', 'plan', 'next']) {
    await expect(page.getByTestId(`intent-${s}`)).toBeVisible();
    await expect(page.getByTestId(`tab-${s}`)).toBeEnabled();     // Next stop is never locked
  }
  await page.getByTestId('intent-explore').click();
  await expect(page.getByTestId('tab-explore')).toHaveAttribute('aria-current', 'page');
  expect(e).toEqual([]);
});

test('home dashboard: today card, calendar with trip dots, month view, trips tabs and Use again', async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByTestId('today')).toContainText('No plan yet');
  await expect(page.getByTestId('calendar')).toHaveCount(0);   // Home is the start page; the calendar lives on Trips
  await page.getByTestId('tab-trips').click();
  const cal = page.getByTestId('calendar');
  await expect(cal.getByTestId('cal-day')).toHaveCount(7);               // a week strip
  expect(await cal.locator('.cal-d .dot:not([hidden])').count()).toBeGreaterThan(0);   // days with trips are marked
  await page.getByTestId('cal-mode').click();
  expect(await cal.getByTestId('cal-day').count()).toBeGreaterThan(27);  // the month grid
  await page.getByTestId('cal-mode').click();
  await page.getByTestId('trt-past').click();
  const past = page.getByTestId('trips').getByTestId('trip-card');
  expect(await past.count()).toBeGreaterThanOrEqual(3);                  // sample past trips
  await past.first().getByTestId('trip-again').click();                  // use again -> a built day in Plan
  await expect(page.getByTestId('timeline')).toBeVisible();
  await page.getByTestId('tab-home').click();
  await expect(page.getByTestId('today')).toContainText('stops');
  await expect(page.getByTestId('plan-badge')).toBeVisible();            // the dock counts the stops
});

test('home dashboard: a day you plan is saved and shows on the calendar', async ({ page }) => {
  await page.goto(URL + '&s=plan&built=1&tray=soheng,traimit');
  await expect(page.getByTestId('timeline')).toBeVisible();
  await page.getByTestId('tab-trips').click();
  await page.getByTestId('trt-up').click();
  await expect(page.getByTestId('trips').getByTestId('trip-card').first()).toContainText('So Heng Tai');
  await page.goto(URL);                                                  // a fresh load: it is kept on this device
  await page.getByTestId('tab-trips').click();
  await page.getByTestId('trt-up').click();
  await expect(page.getByTestId('trips').getByTestId('trip-card').first()).toBeVisible();
});

test('dock: raised Next stop button shows the time, the Trips tab is its own page, keyboard reachable', async ({ page }) => {
  await page.goto(URL);
  const next = page.getByTestId('tab-next');
  await expect(next).toContainText('11:00');
  expect((await next.locator('.nb').boundingBox())!.width).toBeGreaterThan(50);
  await page.getByTestId('tab-trips').click();
  await expect(page.getByTestId('tab-trips')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('trips-title')).toBeVisible();
  await expect(page.getByTestId('intent-explore')).toHaveCount(0);   // a different page from Home
  await page.getByTestId('tab-explore').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tab-explore')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('tab-home')).not.toHaveAttribute('aria-current', 'page');
});

test('explore: the card is the main page card: image band, whole card adds, why expands, best match badge', async ({ page }) => {
  await page.goto(URL + '&s=explore&x=places');
  await page.getByTestId('search').fill('quiet cafe, old walls');
  await page.getByTestId('search').press('Enter');
  const first = page.getByTestId('results').locator('.pc').first();
  await expect(first.locator('.pc-thumb')).toBeVisible();
  expect((await first.locator('.pc-thumb').boundingBox())!.height).toBeGreaterThanOrEqual(160);
  await expect(first.locator('.best')).toHaveText('Best match');
  await expect(first.locator('.pc-more')).not.toHaveClass(/open/);
  await first.getByRole('button', { name: /Why this match/ }).click();
  await expect(first.locator('.pc-more')).toHaveClass(/open/);
  await expect(first.locator('.pc-more')).toContainText('Hours');
  await first.locator('.pc-add').click({ position: { x: 20, y: 200 } });   // tapping the card opens the place
  await expect(page.getByTestId('pinfo')).toBeVisible();
  await page.getByTestId('pi-close').click();
  await first.locator('.pc-plus').click();                               // the round button adds it
  await expect(first).toHaveAttribute('data-in', 'true');
});

test('explore feed: For you shows photo cards, Trips opens a trip you can like, save, share and use', async ({ page }) => {
  await page.goto(URL + '&s=explore');
  await expect(page.getByTestId('feed').locator('.fc').first()).toBeVisible();
  expect(await page.locator('.fc-art').first().evaluate((e) => getComputedStyle(e).borderRadius)).not.toBe('0px');
  await page.getByTestId('ex-trips').click();
  await expect(page.locator('[data-testid="post-trip"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="post-place"]')).toHaveCount(0);
  await page.locator('[data-testid="post-trip"] .fc-open').first().click();
  const trip = page.getByTestId('trip');
  await expect(trip).toBeVisible();
  const like = trip.locator('.tacts .hbtn');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await trip.getByRole('button', { name: /Save/ }).click();
  await expect(trip.getByRole('button', { name: /Saved/ })).toBeVisible();
  await page.getByTestId('trip-use').click();
  await expect(page.getByTestId('timeline')).toBeVisible();              // the trip became a built day
  await expect(page.getByTestId('tab-plan')).toHaveAttribute('aria-current', 'page');
});

test('explore feed: a place post opens the place info', async ({ page }) => {
  await page.goto(URL + '&s=explore');
  await page.locator('[data-testid="post-place"] .fc-open').first().click();
  await expect(page.getByTestId('pinfo')).toBeVisible();
});

test('explore: area pill is labelled default, area filter narrows results, add and star work', async ({ page }) => {
  await page.goto(URL + '&s=explore&x=places');
  const pill = page.getByTestId('area-pill');
  await expect(pill).toContainText('default');
  const all = await page.getByTestId('results').locator('li').count();
  await pill.click();
  await page.getByRole('dialog').getByRole('radio', { name: /Talat Noi/ }).click();
  await expect(pill).not.toContainText('default');
  await expect(pill).toContainText('Talat Noi');
  expect(await page.getByTestId('results').locator('li').count()).toBeLessThan(all);
  await page.getByTestId('star-soheng').click();                  // starring adds it to the day
  await expect(page.getByTestId('star-soheng')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('add-soheng')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('daybar')).toBeVisible();
});

test('plan: every field arrives labelled default and Build works untouched', async ({ page }) => {
  await page.goto(URL + '&s=plan');
  await expect(page.locator('.fields .deftag')).toHaveCount(4);
  await expect(page.getByTestId('start-time')).toHaveValue('11:00');   // now, rounded up to 15 min
  await expect(page.getByTestId('end-time')).toHaveValue('19:00');     // start + 8 h
  await page.getByTestId('build').click();
  await expect(page.getByTestId('recap')).toContainText('Today');
  await expect(page.getByTestId('recap')).toContainText('Hua Lamphong');
  await expect(page.getByTestId('timeline').locator('li').first()).toBeVisible();
  await page.getByTestId('edit-inputs').click();
  await expect(page.getByTestId('build')).toBeVisible();
});

test('plan: say-it-in-words fills the activity strip in order and the end time', async ({ page }) => {
  await page.goto(URL + '&s=plan');
  await page.getByTestId('say').fill('somewhere to work then lunch then photos, back by 6');
  await page.getByTestId('say-go').click();
  await expect(page.getByTestId('strip').locator('.lname')).toHaveText([/Work/, /Lunch/, /Photos/]);
  await expect(page.getByTestId('end-time')).toHaveValue('18:00');
  await expect(page.locator('.fields .deftag')).toHaveCount(3);       // the end time is no longer a default
  // reorder with the arrows
  await page.getByRole('button', { name: 'Move Lunch earlier' }).click();
  await expect(page.getByTestId('strip').locator('.lname')).toHaveText([/Lunch/, /Work/, /Photos/]);
  await page.getByTestId('build').click();
  // choices come before the plan: one row per activity, pick one, then build
  await expect(page.getByTestId('pick')).toBeVisible();
  await expect(page.locator('.pksec')).toHaveCount(3);
  const firstCard = page.locator('.pksec').first().locator('.pkc:not(.skip)').first();
  await firstCard.click();
  await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  const picked = await firstCard.locator('b').innerText();
  await page.getByTestId('pk-build').click();
  await expect(page.getByTestId('timeline').locator('.stop')).not.toHaveCount(0);
  await expect(page.getByTestId('timeline')).toContainText(picked);   // the chosen place is in the day
  await expect(page.getByTestId('recs')).toBeVisible();                // Wanderlog-style recommended row
  await page.getByTestId('recs').locator('.rplus').first().click();    // + adds it to the list
  await page.locator('.shead').first().click();
  await page.locator('.pnote').first().fill('bring cash');
  await expect(page.locator('.pnote').first()).toHaveValue('bring cash');
});

test('plan: a stop that cannot fit stays in the timeline, greyed, with a reason and one fix', async ({ page }) => {
  // Fish Ball Noodles closes at 15:00; starting at 14:45 cannot work
  await page.goto('/day-off-redesign.html?lang=en&at=Sat-14:45&s=plan&built=1&tray=fishball,hoytod&start=14:45&end=20:00');
  const bad = page.getByTestId('unfit');
  await expect(bad).toHaveCount(1);
  await expect(bad).toContainText("Doesn't fit");
  await expect(bad).toContainText(/Closes 15:00/);
  await expect(page.getByTestId('health')).toContainText("Doesn't fit");
  await expect(page.getByTestId('fix-one')).toBeVisible();
  await page.getByTestId('fix-all').click();
  await expect(page.getByTestId('health')).not.toContainText("Doesn't fit", { timeout: 3000 }).catch(() => {});
});

test('plan: a must-visit that no route can include is called out in a banner', async ({ page }) => {
  await page.goto('/day-off-redesign.html?lang=en&at=Sat-14:45&s=explore&start=14:45&end=20:00&must=fishball,hoytod');
  await page.getByTestId('daybar').click();
  await expect(page.getByTestId('must-banner')).toContainText('Fish Ball Noodles');
  await expect(page.getByTestId('unfit')).toContainText('Must visit');
});

test('plan: Fix it for me resolves a tight day and Undo brings it back', async ({ page }) => {
  // two long stays in a short window: Tight or worse
  await page.goto('/day-off-redesign.html?lang=en&at=Sat-11:00&s=plan&built=1&tray=naam,tk,hoytod&start=11:00&end=13:15');
  const health = page.getByTestId('health');
  await expect(health).not.toContainText('Fits your day');
  await page.getByTestId('fix-all').click();
  await expect(page.locator('.toast')).toContainText(/Fixed|Fixed what I could/);
  await page.locator('.toast button').click();                        // Undo
  await expect(health).not.toContainText('Fits your day');
});

test('plan: pin sheet keeps a position and fixes a time; timing is hidden until a stop is opened', async ({ page }) => {
  await page.goto(URL + '&s=plan&built=1&tray=soheng,eiahsae,gulongbao&start=10:00&end=18:00');
  const first = page.getByTestId('timeline').locator('.stop').first();
  await expect(first.locator('.sdet')).not.toHaveClass(/open/);       // lazy users see only start time + stay chip
  await expect(first.locator('.shead small')).toContainText('suggested');
  await first.locator('.shead').click();
  await expect(first.locator('.sdet')).toHaveClass(/open/);
  await expect(first.locator('.times')).toContainText('Arrive');
  await first.getByRole('button', { name: /Keep at stop 1/ }).click();
  await expect(page.getByTestId('timeline').locator('.stop').first().locator('.badge')).toContainText('Pinned at stop 1');
});

test('next stop: it asks first, you pick one of three, until-time is checked, Done moves on', async ({ page }) => {
  await page.goto(URL + '&s=next');
  await expect(page.getByTestId('tab-next')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('next-hero')).toHaveCount(0);          // nothing is chosen for you
  await expect(page.getByTestId('quick').locator('.chip')).toHaveCount(5);
  await page.getByTestId('nx-eat').click();
  await expect(page.locator('.msg.u').last()).toContainText('Something to eat');
  expect(await page.getByTestId('next-options').locator('.pkc').count()).toBeGreaterThan(3);   // a real choice, not three
  const opts = page.getByTestId('next-options').locator('.pkc');
  const first = await opts.first().locator('b').innerText();
  await opts.first().click();
  const hero = page.getByTestId('next-hero');
  await expect(hero.locator('h2')).toHaveText(first);
  await page.getByTestId('next-other').click();                        // back to the choices
  await expect(page.getByTestId('next-options')).toBeVisible();
  await page.getByTestId('next-options').locator('.pkc').nth(1).click();
  // a limit of 11:20 leaves nothing that fits
  await page.locator('details.dopt summary').click();
  await page.getByTestId('until-time').fill('11:20');
  await expect(page.getByTestId('next-empty')).toBeVisible();
  await page.locator('[data-act="n-until-clear"]').click();
  await page.getByTestId('next-options').locator('.pkc').first().click();
  // arrive then done: the done place is never suggested again
  const name = await page.getByTestId('next-hero').locator('h2').innerText();
  await page.getByTestId('next-go').click();
  await page.getByTestId('nav-start').click();
  await page.getByTestId('nav-stop').click();
  await page.getByTestId('next-arrive').click();
  await page.getByTestId('next-done').click();
  await expect(page.locator('.doneList')).toContainText(name);
  await expect(page.getByTestId('quick')).toBeVisible();                // the conversation starts over
});

test('next stop is a conversation: typed reply, three numbered options, map shows me and the pins', async ({ page }, info) => {
  await page.goto(URL + '&s=next');
  await expect(page.getByTestId('chat')).toContainText('What do you feel like?');
  await page.getByTestId('next-say').fill('im hungry');
  await page.getByTestId('next-send').click();
  await expect(page.locator('.msg.u').last()).toContainText('hungry');
  const sc = page.locator('#scroll');
  expect(await sc.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);   // the page never scrolls sideways; only the option row does
  await expect(page.getByTestId('next-options').locator('.pkn')).toContainText(['1','2','3']);
  if (info.project.name === 'desktop') {
    await expect(page.locator('#map')).toBeVisible();
    expect(await page.locator('#map .leaflet-marker-icon').count()).toBeGreaterThan(2);   // me + the places around
  }
});

test('next stop: you can say where you are by map pin or by searching a place, not only GPS', async ({ page }) => {
  await page.goto(URL + '&s=next');
  await expect(page.getByTestId('n-pin')).toBeVisible();
  await page.getByTestId('n-from').click();
  await page.getByTestId('from-search').fill('hong sieng');
  await page.locator('#fres [data-act="from-place"]').first().click();
  await expect(page.getByTestId('chat')).toContainText('you are at Hong Sieng Kong');
  await page.getByTestId('nx-eat').click();                              // the options are measured from there
  await expect(page.getByTestId('next-options')).toBeVisible();
});

test('plan: the pick step shows its search area and the day offers stay-time feedback that sticks', async ({ page }) => {
  await page.goto(URL + '&s=plan');
  await page.getByTestId('act-coffee').click();
  await page.getByTestId('build').click();
  await expect(page.getByTestId('pick').getByTestId('area-pill')).toBeVisible();
  await page.getByTestId('pk-build').click();
  await page.locator('.shead').first().click();
  await expect(page.locator('.stop').first()).toContainText('40 min');
  await page.getByTestId('fb-long').first().click();                    // too long: 25 min now, and coffee defaults to 25 next time
  await expect(page.locator('.stop').first()).toContainText('25 min');
  await page.getByTestId('edit-inputs').click();
  await page.getByTestId('build').click();
  await page.getByTestId('pk-build').click();
  await expect(page.locator('.stop').first()).toContainText('25 min');
});

test('place info: opens from a map pin with About, Photos and Vibe, and adds to the day', async ({ page }) => {
  await page.goto(URL + '&s=explore&x=places');
  await page.evaluate(() => { (window as any).openInfo('hongsieng'); });
  const pi = page.getByTestId('pinfo');
  await expect(pi).toBeVisible();
  await expect(pi).toContainText('Hong Sieng Kong');
  await pi.getByRole('tab', { name: 'Photos' }).click();
  await expect(pi.locator('.art')).toHaveCount(4);
  await pi.getByRole('tab', { name: 'Vibe' }).click();
  await expect(pi.locator('.vrow').first()).toBeVisible();
  await pi.getByRole('tab', { name: 'About' }).click();
  await page.getByTestId('pi-add').click();
  await expect(page.getByTestId('pi-add')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(pi).toBeHidden();
});

test('phone: the content is a bottom sheet over the map, the grab handle cycles its height, no Map button', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout');
  await page.goto(URL + '&s=explore&x=places');
  await expect(page.locator('[data-act="mapfab"]')).toHaveCount(0);
  const pane = page.locator('#pane');
  const top0 = (await pane.boundingBox())!.y;
  await page.getByTestId('grab').click();                              // half -> full
  await expect.poll(async () => (await pane.boundingBox())!.y).toBeLessThan(top0);
  await page.getByTestId('grab').click();                              // full -> peek
  await expect.poll(async () => (await pane.boundingBox())!.y).toBeGreaterThan(top0);
});

test('getting there: Go there offers walk, car and transit with times and a route line', async ({ page }) => {
  await page.goto(URL + '&s=next');
  await chooseNext(page);
  await page.getByTestId('next-go').click();
  const modes = page.getByTestId('modes');
  await expect(modes.getByTestId('mode-walk')).toBeEnabled();
  await expect(modes.getByTestId('mode-car')).toBeVisible();
  await expect(modes.locator('button')).toHaveCount(4);                // walk, car, BTS, MRT estimates when there is no Longdo key
  await modes.getByTestId('mode-car').click();
  await expect(modes.getByTestId('mode-car')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('route-line')).toContainText('by car');
});

test('getting there: a far stop offers a train estimate that names the stations', async ({ page }) => {
  await page.goto('/day-off-redesign.html?lang=en&at=Sat-17:00&s=plan&built=1&tray=walkst&start=17:00&end=21:00');
  await page.getByTestId('plan-nav').click();
  const train = page.getByTestId('modes').locator('button[data-m="bts"]:enabled, button[data-m="mrt"]:enabled').first();
  await train.click();
  await expect(page.getByTestId('route-line')).toContainText(/Walk \d+ min to .* ride \d+ stops/);
});

test('navigate: full screen, large instruction, finishes at Back to my day, Stop returns', async ({ page }) => {
  await page.goto(URL + '&s=next&navfast=1');
  await chooseNext(page);
  await page.getByTestId('next-go').click();
  await page.getByTestId('nav-start').click();
  await expect(page.locator('body')).toHaveClass(/navmode/);
  await expect(page.locator('#hdr')).toBeHidden();
  await expect(page.locator('#navbar')).toBeVisible();
  const fs = await page.locator('#navTxt').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(fs).toBeGreaterThanOrEqual(20);
  await page.getByTestId('nav-stop').click();                          // stop leaves navigation and the hero is still there
  await expect(page.locator('body')).not.toHaveClass(/navmode/);
  await expect(page.getByTestId('next-hero')).toBeVisible();
  await page.getByTestId('next-go').click();
  await page.getByTestId('nav-start').click();
  await expect(page.locator('#navbar')).toHaveClass(/done/, { timeout: 15000 });
  await expect(page.getByTestId('nav-arrive')).toHaveText('Back to my day');
  await page.getByTestId('nav-arrive').click();
  await expect(page.locator('body')).not.toHaveClass(/navmode/);
  await expect(page.getByTestId('next-done')).toBeVisible();           // arrived: the stay card
});

test('plan: Navigate to the first stop from the day', async ({ page }) => {
  await page.goto(URL + '&s=plan&built=1&tray=soheng,eiahsae,gulongbao&start=10:00&end=18:00&navfast=1');
  await page.getByTestId('plan-nav').click();
  await expect(page.getByRole('dialog')).toContainText('Eiah Sae');
  await page.getByTestId('nav-start').click();
  await expect(page.locator('#navbar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/navmode/);
  await expect(page.getByTestId('timeline')).toBeVisible();
});

test('plan: reaching a stop moves Navigate on to the next one, to the end of the day, and Undo steps back', async ({ page }) => {
  await page.goto(URL + '&s=plan&built=1&tray=soheng,eiahsae,gulongbao&start=10:00&end=18:00&navfast=1');
  const names = await page.getByTestId('timeline').locator('.shead b').allInnerTexts();
  expect(names.length).toBe(3);
  const go = async (name: string) => {
    await expect(page.getByTestId('plan-nav')).toContainText(name);
    await page.getByTestId('plan-nav').click();
    await expect(page.getByRole('dialog')).toContainText(name);
    await page.getByTestId('nav-start').click();
    await expect(page.locator('#navbar')).toHaveClass(/done/, { timeout: 15000 });
    await page.getByTestId('nav-arrive').click();
  };
  await go(names[0]);
  await expect(page.getByTestId('timeline').locator('li').first()).toHaveClass(/done/);
  await expect(page.getByTestId('plan-nav')).toContainText(names[1]);
  await page.getByRole('button', { name: 'Undo' }).click();              // a wrong "I've arrived" can be taken back
  await expect(page.getByTestId('timeline').locator('li.done')).toHaveCount(0);
  await go(names[0]);
  await go(names[1]);
  await go(names[2]);
  await expect(page.getByTestId('timeline').locator('li.done')).toHaveCount(3);
  await expect(page.getByTestId('plan-nav')).toHaveCount(0);             // the day is finished
});

test('plan: stopping navigation early does not count as arriving', async ({ page }) => {
  await page.goto(URL + '&s=plan&built=1&tray=soheng,eiahsae,gulongbao&start=10:00&end=18:00');
  const first = await page.getByTestId('timeline').locator('.shead b').first().innerText();
  await page.getByTestId('plan-nav').click();
  await page.getByTestId('nav-start').click();
  await page.getByTestId('nav-stop').click();
  await expect(page.getByTestId('timeline').locator('li.done')).toHaveCount(0);
  await expect(page.getByTestId('plan-nav')).toContainText(first);
});

test('plan: any stop can be navigated to from its card, starting at the stop before it', async ({ page }) => {
  await page.goto(URL + '&s=plan&built=1&tray=soheng,eiahsae,gulongbao&start=10:00&end=18:00&navfast=1');
  const stops = page.getByTestId('timeline').locator('li');
  const names = await page.getByTestId('timeline').locator('.shead b').allInnerTexts();
  await stops.nth(1).locator('.shead').click();
  await stops.nth(1).getByTestId('stop-nav').click();
  await expect(page.getByRole('dialog')).toContainText(names[1]);
  await page.getByTestId('nav-start').click();
  await expect(page.locator('#navbar')).toHaveClass(/done/, { timeout: 15000 });
  await page.getByTestId('nav-arrive').click();
  await expect(page.getByTestId('timeline').locator('li.done')).toHaveCount(1);
  await expect(page.getByTestId('timeline').locator('li.done .shead b')).toHaveText(names[1]);
  await expect(page.getByTestId('timeline').locator('li.done').getByTestId('stop-nav')).toHaveCount(0);   // no way back into a finished stop
  await expect(page.getByTestId('plan-nav')).toContainText(names[0]);    // the stop you skipped is still ahead
});

test('keyboard: tabs and the area sheet are reachable, Escape closes the sheet and returns focus', async ({ page }) => {
  await page.goto(URL + '&s=explore&x=places');
  const pill = page.getByTestId('area-pill');
  await pill.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(pill).toBeFocused();
  const outline = await page.getByTestId('tab-plan').evaluate((el) => { (el as HTMLElement).focus(); return getComputedStyle(el).outlineStyle; });
  expect(outline).not.toBe('none');
});

test('the page stands alone: no version menu, no link to the other versions, brand returns to the three intents', async ({ page }) => {
  await page.goto(URL + '&s=plan');
  await expect(page.locator('#vbtn, #vmenu, [data-testid="to-home"]')).toHaveCount(0);
  await expect(page.locator('#hdr a')).toHaveCount(0);
  await page.getByTestId('brand').click();
  await expect(page.getByTestId('intent-explore')).toBeVisible();
  await page.goto('/day-off-home.html?lang=en');
  await expect(page.locator('a[href^="day-off-redesign.html"]')).toHaveCount(0);
});

test('thai and dark theme render without errors', async ({ page }) => {
  const e = errors(page);
  await page.goto('/day-off-redesign.html?at=Sat-11:00');
  await expect(page.getByTestId('greet')).toHaveText(/สวัสดีตอน/);
  await page.locator('[data-theme-cycle]:visible, [data-theme="dark"]:visible').first().click();
  await page.getByTestId('intent-plan').click();
  await expect(page.getByTestId('build')).toBeVisible();
  expect(e).toEqual([]);
});
