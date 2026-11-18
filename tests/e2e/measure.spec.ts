/**
 * R196 (FR-MEAS-2, FR-MEAS-3, FR-MEAS-5; US-58 AC3, US-59 AC1..AC3): what a visit sends to `/e`, read from the
 * requests themselves. `__WIYS_MEASURE__` turns the sender on for this origin and this automated browser (D-1146);
 * `/e` is answered `204` here, since `vite preview` has no route. The service worker is blocked so every beacon
 * reaches `page.route`.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { isMeasureEvent, type MeasureEvent } from '../../src/model/measure';
import { LABEL, NINE_DAYS_ON, openSettings, stubNetwork } from './liveHelpers';
import { NEUQUEN } from './observers';

const GEOCODE = 'tests/fixtures/open-meteo/2026-09-02-cipolletti-geocode.json';
const TYPED = 'Cipolletti';
const PAIR = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;
const DEVICE = { latitude: -38.94, longitude: -68.0, accuracy: 30 };
/** US-58 AC3: the first run's six facts, in the order a reader reaches them. */
const WALK = ['open', 'where_shown', 'place_set', 'when_shown', 'what_shown', 'door'] as const;

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

    test.describe('at 390 × 844', () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test('US-58 AC3: the first run sends its six facts once each, in order, under one id', async ({ page }) => {
        const bodies = await recordBeacons(page);
        await serve(page);
        await page.goto('/');
        await expect(page.getByTestId('cold-open')).toBeVisible();
        await pickCipolletti(page);
        await expect(page.getByTestId('step-when')).toBeVisible();
        await page.getByTestId('see-what').click();
        await expect(page.getByTestId('step-what')).toBeVisible();
        await page.getByTestId('door-satellites').click();
        await expect.poll(() => pairs(bodies).filter((pair) => pair.startsWith('door')).length).toBe(1);
        await painted(page);

        const all = events(bodies);
        const walk = pairs(bodies).filter((pair) => (WALK as readonly string[]).includes(pair.split(':')[0] ?? ''));
        expect(walk).toEqual(['open:home', 'where_shown', 'place_set:search', 'when_shown', 'what_shown', 'door:satellites']);
        expect(new Set(all.map((event) => event.id)).size).toBe(1);
        for (const event of all) expect(event).toMatchObject({ visit: 'first', layout: 'compact', lang: language.lang });
        // V215-7: once per pair per load.
        expect(new Set(pairs(bodies)).size).toBe(bodies.length);
      });
    });

    test.describe('at 1280 × 800', () => {
      test.use({ viewport: { width: 1280, height: 800 } });

      test('FR-MEAS-2: the cold open to a pass, wide', async ({ page }) => {
        const bodies = await recordBeacons(page);
        await serve(page);
        await page.goto('/');
        await expect(page.getByTestId('ghost-when')).toBeVisible();
        await page.getByLabel(LABEL[language.lang].coords).fill(PAIR);
        const door = page.getByTestId('door-satellites');
        await expect(door).toHaveAttribute('href', /^#pass=/, { timeout: 60_000 });
        await door.click();
        await expect.poll(() => pairs(bodies).includes('pass_open')).toBe(true);
        await painted(page);

        const all = events(bodies);
        const walk = pairs(bodies).filter((pair) => [...WALK, 'pass_open'].includes(pair.split(':')[0] ?? ''));
        expect(walk).toEqual(['open:home', 'where_shown', 'place_set:coords', 'when_shown', 'what_shown', 'door:satellites', 'pass_open']);
        expect(new Set(all.map((event) => event.id)).size).toBe(1);
        for (const event of all) expect(event).toMatchObject({ visit: 'first', layout: 'wide', lang: language.lang });
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
async function fullVisit(page: Page, context: BrowserContext): Promise<{ before: unknown; after: unknown }> {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(DEVICE);
  await serve(page);
  await page.goto('/');
  await expect(page.getByTestId('cold-open')).toBeVisible();
  // The elements are cached as they arrive; "before" is the page once both groups are in, with and without the measurement.
  await expect.poll(async () => ((await kept(page, context)) as { idb: Record<string, string[]> }).idb['wiys/elementGroups']).toEqual(['stations', 'visual']);
  const before = await kept(page, context);
  await openSettings(page);
  await pickCipolletti(page);
  await expect(page.getByTestId('place-confirmation')).toBeVisible();
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
    test.use({ viewport, locale: 'en-GB' });

    test('US-59 AC1, AC2: nothing typed, named or placed leaves with a count, and the count keeps nothing on the device', async ({ page, context, browser }) => {
      const bodies = await recordBeacons(page);
      const on = await fullVisit(page, context);
      await expect.poll(() => pairs(bodies).filter((pair) => pair.startsWith('place_set:')).sort()).toEqual(['place_set:coords', 'place_set:device', 'place_set:search']);
      for (const body of bodies) {
        const event = JSON.parse(body) as MeasureEvent;
        // FR-MEAS-5: no field but `id` (16 hex characters) holds a digit, so no coordinate in any decimal form, and no word from the visit.
        const rest = JSON.stringify({ ...event, id: '' });
        expect(rest, body).not.toMatch(/\d/);
        for (const word of ['cipol', 'rio negro', 'argentina', 'neuqu', 'europe', 'america']) expect(rest.toLowerCase(), body).not.toContain(word);
      }

      // The same visit with the measurement off: the device ends up holding the same keys.
      const offContext = await browser.newContext({ viewport, locale: 'en-GB', serviceWorkers: 'block' });
      const offPage = await offContext.newPage();
      const offBodies = await recordBeacons(offPage, false);
      const off = await fullVisit(offPage, offContext);
      expect(offBodies).toEqual([]);
      await offContext.close();
      expect(on.before).toEqual(off.before);
      expect(on.after).toEqual(off.after);
      expect((on.after as { cookies: string[] }).cookies).toEqual([]);
    });
  });
}

test.describe('offline', () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: 'en-GB' });

  test('US-59 AC3: nothing counted offline is sent when the connection returns', async ({ page, context }) => {
    const bodies = await recordBeacons(page);
    await serve(page);
    await page.goto('/');
    await expect(page.getByTestId('cold-open')).toBeVisible();
    await expect.poll(() => pairs(bodies)).toEqual(['open:home', 'where_shown']);

    await context.setOffline(true);
    await page.getByLabel(LABEL.en.coords).fill(PAIR);
    await page.getByLabel(LABEL.en.coords).press('Enter');
    await expect(page.getByTestId('step-when')).toBeVisible();
    await painted(page);
    await context.setOffline(false);

    await page.getByTestId('see-what').click();
    await expect(page.getByTestId('step-what')).toBeVisible();
    await expect.poll(() => pairs(bodies)).toContain('what_shown');
    await painted(page);
    // A forecast refused while offline or after is the store's `failure`, whichever side it lands; it is not the walk.
    const sent = pairs(bodies).filter((pair) => !pair.startsWith('failure:'));
    expect(sent).not.toContain('place_set:coords');
    expect(sent).not.toContain('when_shown');
    expect(sent.slice(0, 3)).toEqual(['open:home', 'where_shown', 'what_shown']);
  });
});
