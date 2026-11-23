/**
 * R196 (FR-MEAS-2, FR-MEAS-3, FR-MEAS-5; US-58 AC3, US-59 AC1..AC3): what a visit sends to `/e`, read from the
 * requests themselves. `__WIYS_MEASURE__` turns the sender on for this origin and this automated browser (D-1146);
 * `/e` is answered `204` here, since `vite preview` has no route. The service worker is blocked so every beacon
 * reaches `page.route`.
 *
 * R202 (FR-OPEN-10, US-61 AC4; D-1182, D-1183): the first run is counted from the example — `open`, `example_shown`,
 * `where_shown` with its detail, `place_set` — in the example's zone, on the fallback (the suite's UTC) and wide, and
 * no event carries the example's city, zone or coordinates.
 *
 * R212 (FR-LAND-1, D-1242): the visit opens on the live page, so `open` is `live`; `door` left with the home's doors,
 * and `example_shown` is sent from the live page. `where_shown` has no sender until R215's place dialog, and the
 * example's control opens the settings page's place group (D-1230).
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { isMeasureEvent, type MeasureEvent } from '../../src/model/measure';
import { LABEL, NINE_DAYS_ON, stubNetwork } from './liveHelpers';
import { NEUQUEN } from './observers';

const GEOCODE = 'tests/fixtures/open-meteo/2026-09-02-cipolletti-geocode.json';
const TYPED = 'Cipolletti';
const PAIR = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;
const DEVICE = { latitude: -38.94, longitude: -68.0, accuracy: 30 };
/** FR-OPEN-11: the zone whose city is the example every example spec runs on. */
const EXAMPLE_ZONE = 'America/Argentina/Buenos_Aires';
/** FR-MEAS-2 as amended v2.16: the first run's facts, in the order a reader reaches them. */
const WALK = ['open', 'example_shown', 'where_shown', 'place_set', 'pass_open'] as const;
/**
 * FR-OPEN-10, FR-MEAS-5: what no event may carry — the place a reader typed and the example's city, zone and
 * coordinates (Buenos Aires, −34.60, −58.45; whole and in parts, any digit being refused besides).
 */
const FORBIDDEN = ['cipol', 'rio negro', 'argentina', 'neuqu', 'europe', 'america', 'buenos', 'aires', 'buenos_aires', '34.6', '58.45', '-34', '-58', 'utc', 'etc/'] as const;
const walked = (bodies: readonly string[]): string[] => pairs(bodies).filter((pair) => (WALK as readonly string[]).includes(pair.split(':')[0] ?? ''));
/** FR-MEAS-5: no field but `id` (16 hex characters) holds a digit, so no coordinate in any decimal form, and no word of a place. */
function expectNoPlace(bodies: readonly string[]): void {
  for (const body of bodies) {
    const event = JSON.parse(body) as MeasureEvent;
    const rest = JSON.stringify({ ...event, id: '' });
    expect(rest, body).not.toMatch(/\d/);
    for (const word of FORBIDDEN) expect(rest.toLowerCase(), body).not.toContain(word);
  }
}

test.use({ serviceWorkers: 'block' });

/** Every body posted to `/e`, as text, in the order the page sent them. */
async function recordBeacons(page: Page, on = true): Promise<string[]> {
  const bodies: string[] = [];
  if (on) {
    await page.addInitScript(() => {
      (globalThis as { __WIYS_MEASURE__?: boolean }).__WIYS_MEASURE__ = true;
    });
  }
  await page.route('**/e', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') bodies.push(request.postData() ?? '');
    await route.fulfill({ status: 204 });
  });
  return bodies;
}

/** The forecast stays refused (`stubNetwork`); the geocoder answers the one recorded name. */
async function serve(page: Page): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    const name = new URL(route.request().url()).searchParams.get('name');
    if (name === TYPED.toLowerCase()) await route.fulfill({ path: GEOCODE, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    else await route.abort('failed');
  });
}

const events = (bodies: readonly string[]): MeasureEvent[] =>
  bodies.map((body) => {
    const event: unknown = JSON.parse(body);
    // FR-MEAS-1: exactly the six fields, every value from its closed list.
    expect(isMeasureEvent(event), body).toBe(true);
    return event as MeasureEvent;
  });
const pairs = (bodies: readonly string[]): string[] => events(bodies).map((event) => (event.detail === undefined ? event.name : `${event.name}:${event.detail}`));

/** After the next paint and a zero timeout the sender has run (D-1146): what was counted by now has been posted. */
async function painted(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50))));
}

async function pickCipolletti(page: Page): Promise<void> {
  await page.getByRole('combobox').first().pressSequentially(TYPED, { delay: 20 });
  await page.getByRole('option').first().click();
  // The pointer would otherwise rest where the next screen draws a tooltip over its control.
  await page.mouse.move(0, 0);
}

for (const language of [
  { locale: 'en-GB', lang: 'en' },
  { locale: 'es-AR', lang: 'es' },
] as const) {
  test.describe(`${language.lang}`, () => {
    test.use({ locale: language.locale });

    test.describe('from the example, at 390 × 844', () => {
      test.use({ viewport: { width: 390, height: 844 }, timezoneId: EXAMPLE_ZONE });

      test('FR-OPEN-10, D-1242: open:live, example_shown on the live page, place_set — once each, in order, under one id, and no word of the example', async ({ page }) => {
        const bodies = await recordBeacons(page);
        await serve(page);
        await page.goto('/');
        await expect(page).toHaveURL(/#live$/);
        await expect(page.getByTestId('example-notice')).toBeVisible({ timeout: 60_000 });
        await expect.poll(() => walked(bodies), { timeout: 60_000 }).toEqual(['open:live', 'example_shown:pass']);
        await page.getByTestId('example-notice-set').click();
        await expect(page).toHaveURL(/#settings$/);
        await pickCipolletti(page);
        await expect(page.getByTestId('place-confirmation')).toBeVisible();
        await expect.poll(() => walked(bodies).length).toBe(3);
        await painted(page);

        const all = events(bodies);
        expect(walked(bodies)).toEqual(['open:live', 'example_shown:pass', 'place_set:search']);
        expect(new Set(all.map((event) => event.id)).size).toBe(1);
        for (const event of all) expect(event).toMatchObject({ visit: 'first', layout: 'compact', lang: language.lang });
        // V215-7: once per pair per load.
        expect(new Set(pairs(bodies)).size).toBe(bodies.length);
        expectNoPlace(bodies);
      });
    });

    test.describe('with no example, at 390 × 844', () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test('FR-OPEN-10: the fallback walk — example_shown:no_city on the live page, then the place', async ({ page }) => {
        const bodies = await recordBeacons(page);
        await serve(page);
        await page.goto('/');
        await page.getByTestId('live-set-place').click({ timeout: 60_000 });
        await expect(page).toHaveURL(/#settings$/);
        await pickCipolletti(page);
        await expect.poll(() => walked(bodies).length).toBe(3);
        await painted(page);

        const all = events(bodies);
        expect(walked(bodies)).toEqual(['open:live', 'example_shown:no_city', 'place_set:search']);
        expect(new Set(all.map((event) => event.id)).size).toBe(1);
        for (const event of all) expect(event).toMatchObject({ visit: 'first', layout: 'compact', lang: language.lang });
        expect(new Set(pairs(bodies)).size).toBe(bodies.length);
        expectNoPlace(bodies);
      });
    });

    test.describe('from the example, at 1280 × 800', () => {
      test.use({ viewport: { width: 1280, height: 800 }, timezoneId: EXAMPLE_ZONE });

      test('FR-OPEN-10: the wide walk — the example on the live page, a place by coordinates, the satellites page on a pass', async ({ page }) => {
        // Until R213 lands the wide live page asks about its first pass; the reader stays (`Esc`).
        await page.addLocatorHandler(page.getByTestId('first-pass-dialog-overlay'), () => page.keyboard.press('Escape'));
        const bodies = await recordBeacons(page);
        await serve(page);
        await page.goto('/');
        await expect.poll(() => walked(bodies), { timeout: 60_000 }).toEqual(['open:live', 'example_shown:pass']);
        await page.getByTestId('example-notice-set').click();
        await expect(page).toHaveURL(/#settings$/);
        const disclosure = page.getByTestId('coords-disclosure');
        if ((await disclosure.getAttribute('aria-expanded')) === 'false') await disclosure.click();
        await page.getByLabel(LABEL[language.lang].coords).fill(PAIR);
        await expect.poll(() => walked(bodies).length).toBe(3);
        await page.getByTestId('pass-link').click();
        await expect(page).toHaveURL(/#pass=/, { timeout: 60_000 });
        await expect.poll(() => pairs(bodies).includes('pass_open')).toBe(true);
        await painted(page);

        const all = events(bodies);
        expect(walked(bodies)).toEqual(['open:live', 'example_shown:pass', 'place_set:coords', 'pass_open']);
        expect(new Set(all.map((event) => event.id)).size).toBe(1);
        for (const event of all) expect(event).toMatchObject({ visit: 'first', layout: 'wide', lang: language.lang });
        expectNoPlace(bodies);
      });
    });
  });
}

/** Cookie names and every key a page can keep: local and session storage, and each IndexedDB store's keys. */
async function kept(page: Page, context: BrowserContext): Promise<unknown> {
  const cookies = (await context.cookies()).map((cookie) => cookie.name);
  const stores = await page.evaluate(async () => {
    const idb: Record<string, string[]> = {};
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onsuccess = () => {
          resolve(open.result);
        };
        open.onerror = () => {
          reject(new Error(String(open.error)));
        };
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const keys = await new Promise<string[]>((resolve) => {
          const all = db.transaction(store).objectStore(store).getAllKeys();
          all.onsuccess = () => {
            resolve(all.result.map(String).sort());
          };
        });
        // A finished 72 h run is stored when the worker is done, a moment this test does not hold: that store is compared by name.
        idb[`${name}/${store}`] = store === 'passRuns' ? [] : keys;
      }
      db.close();
    }
    return { local: Object.keys(localStorage).sort(), session: Object.keys(sessionStorage).sort(), idb };
  });
  return { cookies, ...stores };
}

/** US-59 AC1's visit: a place typed and picked, a coordinate pair entered, the device location used — on the settings page, where all three are. */
async function fullVisit(page: Page, context: BrowserContext, bodies: readonly string[] | null): Promise<{ before: unknown; after: unknown }> {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(DEVICE);
  await serve(page);
  await page.goto('/');
  // FR-OPEN-10: the visit starts on the example, so its city, zone and coordinates are in reach of every count.
  // Its run is in before the reader moves on: a place set during the wait leaves the outcome `pending` (D-1191).
  // R212: the live page draws the example's line from the first paint, so the latch is read where it is sent — the
  // `example_shown` count — on the measured visit; the visit without the measurement waits for the elements below.
  await expect(page.getByTestId('example-notice')).toBeVisible({ timeout: 60_000 });
  if (bodies) await expect.poll(() => pairs(bodies), { timeout: 60_000 }).toContain('example_shown:pass');
  // The elements are cached as they arrive; "before" is the page once both groups are in, with and without the measurement.
  await expect.poll(async () => ((await kept(page, context)) as { idb: Record<string, string[]> }).idb['wiys/elementGroups']).toEqual(['stations', 'visual']);
  const before = await kept(page, context);
  // R212: the phone's live page has no header, so the settings page is reached by its address.
  await page.evaluate(() => {
    location.hash = '#settings';
  });
  await expect(page.getByTestId('location-actions')).toBeVisible({ timeout: 30_000 });
  await pickCipolletti(page);
  await expect(page.getByTestId('place-confirmation')).toBeVisible();
  // The coordinates are behind their disclosure on the settings page.
  const disclosure = page.getByTestId('coords-disclosure');
  if ((await disclosure.getAttribute('aria-expanded')) === 'false') await disclosure.click();
  await page.getByLabel(LABEL.en.coords).fill(PAIR);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByTestId('active-location')).toContainText('from your device');
  await painted(page);
  return { before, after: await kept(page, context) };
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport, locale: 'en-GB', timezoneId: EXAMPLE_ZONE });

    test('FR-MEAS-5, FR-OPEN-10, US-59 AC1, AC2: nothing typed, named or placed — nor the example’s city, zone or coordinates — leaves with a count, and the count keeps nothing on the device', async ({ page, context, browser }) => {
      const bodies = await recordBeacons(page);
      const on = await fullVisit(page, context, bodies);
      await expect.poll(() => pairs(bodies).filter((pair) => pair.startsWith('place_set:')).sort()).toEqual(['place_set:coords', 'place_set:device', 'place_set:search']);
      expect(pairs(bodies)).toContain('example_shown:pass');
      expectNoPlace(bodies);

      // The same visit with the measurement off: the device ends up holding the same keys.
      const offContext = await browser.newContext({ viewport, locale: 'en-GB', timezoneId: EXAMPLE_ZONE, serviceWorkers: 'block' });
      const offPage = await offContext.newPage();
      const offBodies = await recordBeacons(offPage, false);
      const off = await fullVisit(offPage, offContext, null);
      expect(offBodies).toEqual([]);
      await offContext.close();
      expect(on.before).toEqual(off.before);
      expect(on.after).toEqual(off.after);
      expect((on.after as { cookies: string[] }).cookies).toEqual([]);
    });
  });
}

test.describe('offline', () => {
  // The example's zone: its populated page has loaded every chunk the stacked page needs before the connection goes
  // (the service worker that would serve them is blocked here).
  test.use({ viewport: { width: 390, height: 844 }, locale: 'en-GB', timezoneId: EXAMPLE_ZONE });

  test('FR-MEAS-3, US-59 AC3: nothing counted offline is sent when the connection returns', async ({ page, context }) => {
    const bodies = await recordBeacons(page);
    await serve(page);
    await page.goto('/');
    await expect.poll(() => walked(bodies), { timeout: 60_000 }).toEqual(['open:live', 'example_shown:pass']);
    // The settings chunk in hand before the connection goes (the service worker that would serve it is blocked here).
    const chunk = page.waitForResponse((response) => /\/Settings-[^/]*\.js$/.test(response.url()), { timeout: 5_000 }).catch(() => undefined);
    await page.getByTestId('example-notice-set').click();
    await chunk;
    await expect(page.getByTestId('location-actions')).toBeVisible();

    await context.setOffline(true);
    const disclosure = page.getByTestId('coords-disclosure');
    if ((await disclosure.getAttribute('aria-expanded')) === 'false') await disclosure.click();
    await page.getByLabel(LABEL.en.coords).fill(PAIR);
    await page.getByLabel(LABEL.en.coords).press('Enter');
    await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { observer?: unknown }).observer ?? null)).not.toBeNull();
    await painted(page);
    await context.setOffline(false);

    // Back online, a count the reader makes now is sent: the satellites page, a card's pass opened.
    await page.evaluate(() => {
      location.hash = '#pass';
    });
    await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click({ timeout: 60_000 });
    await expect.poll(() => pairs(bodies)).toContain('pass_open');
    await painted(page);
    // A forecast refused while offline or after is the store's `failure`, whichever side it lands; it is not the walk.
    const sent = walked(bodies);
    expect(sent).not.toContain('place_set:coords');
    expect(sent).toEqual(['open:live', 'example_shown:pass', 'pass_open']);
  });
});
