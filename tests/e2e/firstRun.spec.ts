/**
 * R202 (FR-OPEN-2..6, FR-OPEN-12..14; US-60, US-61; D-1183): the example first run where only a browser can answer —
 * the fold at 390 × 844 and 360 × 640, the populated panes at 1024 × 768 and 1280 × 800, the question the action
 * opens and the three ways out of it, each fallback cause, and a run that lands after the wait. Every example case
 * names the zone, a fixed clock and the elements fixture, so the example's pass is the same on every run.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { LABEL, NINE_DAYS_ON, stubNetwork } from './liveHelpers';
import { FIXTURE_DATE, NEUQUEN } from './observers';

const ZONE = 'America/Argentina/Buenos_Aires';
/** Noon in the example's zone (UTC−3) on the suite's day: the Sun is in the stripe's day band (FR-OPEN-14). */
const NOON = Date.UTC(2026, 8, 11, 15, 0);
const GEOCODE = 'tests/fixtures/open-meteo/2026-09-02-cipolletti-geocode.json';
const PAIR = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;
const WORDS = {
  en: {
    locale: 'en-GB',
    tagline: 'Which satellites you can see tonight, when, and where to look.',
    label: 'Example: Buenos Aires, from your time zone',
    action: 'Not there? Set your place',
    looks: /^A steady moving dot, no blinking, crosses in about \d+ min\.$/,
    dusk: 'Satellites are only visible after dusk.',
    back: 'back',
    question: 'Where will you be looking from?',
    device: 'Use my location',
    go: 'continue',
  },
  es: {
    locale: 'es-AR',
    tagline: 'Qué satélites se ven esta noche, cuándo y hacia dónde mirar.',
    label: 'Ejemplo: Buenos Aires, según tu zona horaria',
    action: '¿No es ahí? Elegí tu lugar',
    looks: /^Un punto que se mueve parejo, sin parpadear, cruza en unos \d+ min\.$/,
    dusk: 'Los satélites solo se ven después del anochecer.',
    back: 'volver',
    question: '¿Desde dónde se va a mirar?',
    device: 'Usar mi ubicación',
    go: 'continuar',
  },
} as const;
type Lang = keyof typeof WORDS;
const LANGS = ['en', 'es'] as const;
const PHONES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
] as const;
const DESKS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
] as const;
const size = (v: { width: number; height: number }): string => `${String(v.width)} × ${String(v.height)}`;

test.use({ serviceWorkers: 'block' });

/** The suite's clock and elements, the count's route answered, and every request's host kept for US-60 AC2. */
async function open(page: Page, time: number = NINE_DAYS_ON, elements: 'fixtures' | 'down' = 'fixtures'): Promise<{ hosts: Set<string>; forecasts: URL[] }> {
  const seen = { hosts: new Set<string>(), forecasts: [] as URL[] };
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http')) seen.hosts.add(url.hostname);
    if (url.hostname === 'api.open-meteo.com') seen.forecasts.push(url);
  });
  await page.clock.setFixedTime(time);
  await stubNetwork(page, elements);
  await page.route('**/e', (route) => route.fulfill({ status: 204 }));
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.fulfill({ path: GEOCODE, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/');
  return seen;
}

/** Where the bottom of `testId` is, and how far the page has scrolled. */
async function foot(page: Page, testId: string): Promise<{ bottom: number; top: number; scrollY: number }> {
  const box = await page.getByTestId(testId).first().boundingBox();
  if (!box) throw new Error(`${testId} is not laid out`);
  return { top: box.y, bottom: box.y + box.height, scrollY: await page.evaluate(() => window.scrollY) };
}

for (const lang of LANGS) {
  const w = WORDS[lang as Lang];
  test.describe(`the example, ${lang}`, () => {
    test.use({ timezoneId: ZONE, locale: w.locale });

    for (const viewport of PHONES) {
      test.describe(`at ${size(viewport)}`, () => {
        test.use({ viewport });

        test('US-60 AC1, AC2, AC5, AC6 (FR-OPEN-2, FR-OPEN-3): the tagline, the band and its action above the fold, in words, from the zone alone', async ({ page }) => {
          const seen = await open(page);
          const band = page.getByTestId('example-band');
          await expect(band).toHaveAttribute('data-state', 'pass', { timeout: 60_000 });
          await page.evaluate(() => document.fonts.ready);
          await expect(page.getByTestId('home-tagline')).toHaveText(w.tagline);
          await expect(band.getByTestId('example-label')).toHaveText(w.label);
          const card = band.getByTestId('next-event');
          await expect(card).toHaveAttribute('data-form', 'card');
          await expect(band.getByTestId('tonight-stripe')).toBeVisible();
          const action = band.getByRole('button', { name: w.action });
          await expect(action).toBeVisible();
          await expect(page.getByTestId('step-line')).toHaveCount(0);

          // FR-OPEN-3: the header, the tagline and the band's last control inside the viewport, with no scroll; the
          // action at least 48 px tall and the page no wider than the screen.
          const header = await foot(page, 'header');
          const tagline = await foot(page, 'home-tagline');
          const last = await foot(page, 'example-set-place');
          expect(last.scrollY).toBe(0);
          expect(header.top).toBeGreaterThanOrEqual(0);
          expect(tagline.top).toBeGreaterThanOrEqual(header.bottom - 1);
          expect(last.bottom, `the action ends at ${String(last.bottom)} px of ${String(viewport.height)}`).toBeLessThanOrEqual(viewport.height);
          expect(last.bottom - last.top).toBeGreaterThanOrEqual(48);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
          // Then the stacked page for the example, doors first.
          const doors = await foot(page, 'home-doors');
          expect(doors.top).toBeGreaterThanOrEqual(last.bottom);
          await expect(page.getByTestId('reading-when')).toBeVisible();

          // US-60 AC6 (FR-OPEN-12, FR-OPEN-13): what it looks like, and no degree or magnitude on the home.
          await expect(card.getByTestId('example-looks')).toHaveText(w.looks);
          await expect(page.getByTestId('list-column').getByTestId('card-detail').first()).toBeVisible();
          for (const part of ['example-band', 'home-doors', 'list-column']) expect(await page.getByTestId(part).innerText(), part).not.toMatch(/\d°|\bmag\b/);
          // At night the day line is not drawn (FR-OPEN-14).
          await expect(band.getByTestId('example-after-dusk')).toHaveCount(0);

          // US-60 AC2 (FR-OPEN-2): no host but CelesTrak, Open-Meteo and the page's own; the forecast is the zone city's.
          expect([...seen.hosts].sort()).toEqual(['api.open-meteo.com', 'celestrak.org', 'localhost']);
          expect(seen.forecasts.length).toBeGreaterThan(0);
          for (const url of seen.forecasts) {
            expect(Number(url.searchParams.get('latitude'))).toBeCloseTo(-34.6, 0);
            expect(Number(url.searchParams.get('longitude'))).toBeCloseTo(-58.45, 0);
          }
          // Nothing of the example is kept: no observer in the prefs, no run in IndexedDB.
          const kept = await page.evaluate(async () => {
            const prefs = JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { observer?: unknown };
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open('wiys');
              request.onsuccess = () => {
                resolve(request.result);
              };
              request.onerror = () => {
                reject(new Error('no database'));
              };
            });
            const runs = db.objectStoreNames.contains('passRuns')
              ? await new Promise<number>((resolve) => {
                  const count = db.transaction('passRuns').objectStore('passRuns').count();
                  count.onsuccess = () => {
                    resolve(count.result);
                  };
                })
              : 0;
            db.close();
            return { observer: prefs.observer ?? null, runs, hash: location.hash, storage: JSON.stringify(localStorage) };
          });
          expect(kept.observer).toBeNull();
          expect(kept.runs).toBe(0);
          expect(kept.hash).toBe('');
          expect(kept.storage).not.toMatch(/Buenos|-34\.6|-58\.4/);

          // US-60 AC5: a reload with no place set shows the example again.
          await page.reload();
          await expect(page.getByTestId('example-band')).toHaveAttribute('data-state', 'pass', { timeout: 60_000 });
          await expect(page.getByTestId('example-label')).toHaveText(w.label);
        });
      });
    }

    for (const viewport of DESKS) {
      test.describe(`at ${size(viewport)}`, () => {
        test.use({ viewport });

        test('US-60 AC3 (FR-OPEN-4): the populated page for the example — the label and the action in the Where pane, the next event in When', async ({ page }) => {
          await open(page);
          const where = page.getByTestId('reading-where');
          const when = page.getByTestId('reading-when');
          const block = when.getByTestId('next-event');
          await expect(block).toBeVisible({ timeout: 60_000 });
          await expect(page.getByTestId('header')).toContainText(w.tagline);
          await expect(where.getByTestId('where-example-label')).toHaveText(w.label);
          await expect(where.getByRole('button', { name: w.action })).toBeVisible();
          await expect(where.getByTestId('location-summary')).toHaveCount(0);
          await expect(where.getByTestId('favourites')).toHaveCount(0);
          await expect(block.getByTestId('example-looks')).toHaveText(w.looks);
          await expect(page.getByTestId('home-doors').getByRole('link')).toHaveCount(3);
          await expect(page.getByTestId('list-column').getByTestId('card-detail').first()).toBeVisible();
          for (const id of ['example-band', 'cold-open', 'ghost-when', 'ghost-what']) await expect(page.getByTestId(id)).toHaveCount(0);
          for (const part of ['home-doors', 'reading-when', 'list-column']) expect(await page.getByTestId(part).innerText(), part).not.toMatch(/\d°|\bmag\b/);
          // The page is the viewport on a desk (D-119), sideways too.
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        });
      });
    }

    test.describe('opened at noon', () => {
      test('US-60 AC6 (FR-OPEN-14): the band at 390 × 844 and the Where pane at 1280 × 800 say why the pass is tonight', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await open(page, NOON);
        const band = page.getByTestId('example-band');
        await expect(band).toHaveAttribute('data-state', 'pass', { timeout: 60_000 });
        await expect(band.getByTestId('example-after-dusk')).toHaveText(w.dusk);
        const [card, line, stripe] = await Promise.all([foot(page, 'next-event'), foot(page, 'example-after-dusk'), foot(page, 'tonight-stripe')]);
        expect(line.top).toBeGreaterThanOrEqual(card.bottom);
        expect(stripe.top).toBeGreaterThanOrEqual(line.bottom);
        expect((await foot(page, 'example-set-place')).bottom).toBeLessThanOrEqual(844);
        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.getByTestId('reading-where').getByTestId('where-example-after-dusk')).toHaveText(w.dusk);
      });
    });
  });
}

test.describe('from the example to a place (US-61, FR-OPEN-5)', () => {
  test.use({ timezoneId: ZONE, locale: 'en-GB' });
  const w = WORDS.en;
  /** Each way in, from the open group; the typed pair is left by `[ continue ]` on a phone and stands at once on a desk. */
  const WAYS = [
    {
      name: 'the device',
      set: async (page: Page) => {
        await page.getByRole('button', { name: w.device }).click();
      },
      place: 'Cipolletti',
    },
    {
      name: 'a place name',
      set: async (page: Page) => {
        await page.getByRole('combobox').first().pressSequentially('Cipolletti', { delay: 20 });
        await page.getByRole('option').first().click();
      },
      place: 'Cipolletti',
    },
    {
      name: 'coordinates',
      set: async (page: Page) => {
        await page.getByLabel(LABEL.en.coords).fill(PAIR);
        const go = page.getByRole('button', { name: w.go });
        if (await go.isVisible()) await go.click();
      },
      place: /^−38\.\d+, −6[78]\.\d+$/,
    },
  ] as const;

  for (const way of WAYS) {
    test(`US-61 AC1, AC2 at 390 × 844 by ${way.name}: the action opens the question with [ back ]; the place lands on the stacked page`, async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: NEUQUEN.lat, longitude: NEUQUEN.lon, accuracy: 300 });
      await page.setViewportSize({ width: 390, height: 844 });
      const seen = await open(page);
      const band = page.getByTestId('example-band');
      await expect(band).toHaveAttribute('data-state', 'pass', { timeout: 60_000 });
      const before = { card: await band.getByTestId('next-event-time').innerText(), forecasts: seen.forecasts.length };
      await band.getByRole('button', { name: w.action }).click();

      // One screen: `[ back ]` above the heading, its sentence and the boxed group, the focus in it, and no scroll.
      const cold = page.getByTestId('cold-open');
      await expect(cold.getByRole('heading', { level: 2, name: w.question })).toBeVisible();
      await expect(cold.getByTestId('location-group')).toHaveAttribute('data-look', 'boxed');
      await expect(cold.getByRole('button', { name: w.device })).toBeFocused();
      expect((await foot(page, 'place-back')).bottom).toBeLessThanOrEqual((await cold.getByRole('heading', { level: 2 }).boundingBox())?.y ?? 0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
      await expect(band).toHaveCount(0);

      // `[ back ]` returns to the example as it was: the same card, and nothing asked again.
      await cold.getByRole('button', { name: w.back }).click();
      await expect(band.getByTestId('next-event-time')).toHaveText(before.card);
      await expect(band.getByRole('button', { name: w.action })).toBeFocused();
      expect(seen.forecasts.length).toBe(before.forecasts);

      await band.getByRole('button', { name: w.action }).click();
      await way.set(page);
      await expect(page.getByTestId('location-summary')).toHaveText(way.place, { timeout: 30_000 });
      await expect(page.getByTestId('home-doors').getByRole('link')).toHaveText([/^Satellites/, /^Stars/, /^Live sky/]);
      for (const id of ['cold-open', 'example-band', 'home-tagline', 'step-line', 'where-example']) await expect(page.getByTestId(id)).toHaveCount(0);
      await expect(page.getByTestId('reading-when')).toBeVisible();
      // The observer is saved as today (FR-OPEN-5).
      expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { observer?: unknown }).observer ?? null)).not.toBeNull();
    });

    test(`US-61 AC1, AC2 at 1280 × 800 by ${way.name}: the group opens in place with [ back ] under it; the place lands on the panes`, async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: NEUQUEN.lat, longitude: NEUQUEN.lon, accuracy: 300 });
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      const where = page.getByTestId('reading-where');
      await expect(page.getByTestId('reading-when').getByTestId('next-event')).toBeVisible({ timeout: 60_000 });
      await where.getByRole('button', { name: w.action }).click();
      const group = where.getByTestId('location-group');
      await expect(group).toBeVisible();
      await expect(group).toHaveAttribute('data-look', 'plain');
      await expect(group.getByRole('button', { name: w.device })).toBeFocused();
      expect((await foot(page, 'place-back')).top).toBeGreaterThanOrEqual((await foot(page, 'location-group')).bottom - 1);
      // In place: the other panes are still the example's.
      await expect(page.getByTestId('list-column')).toBeVisible();
      await where.getByRole('button', { name: w.back }).click();
      await expect(group).toBeHidden();
      await where.getByRole('button', { name: w.action }).click();

      await way.set(page);
      await expect(page.getByTestId('location-summary')).toHaveText(way.place, { timeout: 30_000 });
      for (const id of ['where-example', 'cold-open', 'ghost-when']) await expect(page.getByTestId(id)).toHaveCount(0);
      await expect(page.getByTestId('reading-when')).toBeVisible();
      await expect(page.getByTestId('list-column')).toBeVisible();
      // A set place keeps its figures (FR-OPEN-13).
      await expect(page.getByTestId('list-column').getByTestId('card-detail').first()).toHaveText(/\d+° [NESW]{1,3} · mag/, { timeout: 60_000 });
    });
  }

  test('a denial of the device location keeps the group open (US-3 AC2)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.getByTestId('example-band').getByRole('button', { name: w.action }).click();
    const cold = page.getByTestId('cold-open');
    await cold.getByRole('button', { name: w.device }).click();
    await expect(cold.getByText('Location permission was denied. You can still enter a place name or coordinates.')).toBeVisible();
    await expect(cold.getByLabel(LABEL.en.coords)).toBeVisible();
    await expect(cold.getByRole('button', { name: w.back })).toBeVisible();
  });
});

/**
 * FR-OPEN-6 (US-60 AC4): each cause of no example, at 390 × 844 and 1280 × 800 — the question and the tagline, no
 * band. `slow` holds the elements back past `EXAMPLE_WAIT_MS` on a clock the test runs forward, then lets them go:
 * the late run leaves the question on screen.
 */
test.describe('when there is no example (FR-OPEN-6)', () => {
  /** One satellite on an equatorial orbit, which never clears 10° from 34.6° S: a finished run with no visible pass. */
  const equatorial = (): string => {
    const [iss] = JSON.parse(readFileSync(`tests/fixtures/omm/${FIXTURE_DATE}-stations.json`, 'utf8')) as Record<string, unknown>[];
    return JSON.stringify([{ ...iss, INCLINATION: 0.5 }]);
  };
  /** Each cause after the suite's own routes: the route registered last is the one that answers. */
  const CAUSES = [
    { name: 'no city (Etc/UTC)', zone: 'Etc/UTC', setup: (page: Page) => stubNetwork(page) },
    { name: 'the elements failing', zone: ZONE, setup: (page: Page) => stubNetwork(page, 'down') },
    {
      name: 'no visible pass in 72 h',
      zone: ZONE,
      setup: async (page: Page) => {
        await stubNetwork(page);
        await page.route('https://celestrak.org/**', (route) => route.fulfill({ body: equatorial(), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
      },
    },
  ] as const;

  async function expectQuestion(page: Page, wide: boolean): Promise<void> {
    const cold = page.getByTestId('cold-open');
    await expect(cold.getByRole('heading', { level: 2, name: WORDS.en.question })).toBeVisible({ timeout: 60_000 });
    if (wide) {
      await expect(page.getByTestId('header')).toContainText(WORDS.en.tagline);
      await expect(page.getByTestId('ghost-when')).toBeVisible();
      await expect(page.getByTestId('ghost-what')).toBeVisible();
    } else {
      const [tagline, heading] = await Promise.all([foot(page, 'home-tagline'), cold.getByRole('heading', { level: 2 }).boundingBox()]);
      await expect(cold.getByTestId('home-tagline')).toHaveText(WORDS.en.tagline);
      expect(tagline.bottom).toBeLessThanOrEqual(heading?.y ?? 0);
    }
    for (const id of ['example-band', 'where-example', 'place-back', 'home-doors', 'list-column']) await expect(page.getByTestId(id)).toHaveCount(0);
  }

  for (const viewport of [PHONES[0], DESKS[1]] as const) {
    const wide = viewport.width >= 964;
    for (const cause of CAUSES) {
      test.describe(`${cause.name}, at ${size(viewport)}`, () => {
        test.use({ viewport, timezoneId: cause.zone, locale: 'en-GB' });

        test('the first screen is the place question, under the tagline', async ({ page }) => {
          await page.clock.setFixedTime(NINE_DAYS_ON);
          await cause.setup(page);
          await page.route('**/e', (route) => route.fulfill({ status: 204 }));
          await page.goto('/');
          await expectQuestion(page, wide);
        });
      });
    }

    test.describe(`the run not ready inside the wait, at ${size(viewport)}`, () => {
      test.use({ viewport, timezoneId: ZONE, locale: 'en-GB' });

      test('the wait shows the label and the live action, then the question; a late run does not replace it', async ({ page }) => {
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.clock.install({ time: NINE_DAYS_ON });
        await page.route('**/e', (route) => route.fulfill({ status: 204 }));
        await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
        await page.route('https://celestrak.org/**', async (route) => {
          await held;
          const group = new URL(route.request().url()).searchParams.get('GROUP') ?? 'unknown';
          await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${group}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
        });
        await page.goto('/');
        // FR-OPEN-4: the wait — the label, the line and the action, already live.
        const host = wide ? page.getByTestId('reading-where') : page.getByTestId('example-band');
        await expect(host.getByText("Finding tonight's passes over Buenos Aires…")).toBeVisible();
        await expect(host.getByText(WORDS.en.label)).toBeVisible();
        await expect(host.getByRole('button', { name: WORDS.en.action })).toBeEnabled();
        await expect(page.getByTestId('cold-open')).toHaveCount(0);

        // EXAMPLE_WAIT_MS (10 000) on the page's clock: the question.
        await page.clock.fastForward(10_000);
        await expectQuestion(page, wide);

        // The elements arrive and the run finishes: the question stays (FR-OPEN-6).
        release();
        await expect
          .poll(
            () =>
              page.evaluate(
                () =>
                  new Promise<number>((resolve) => {
                    const request = indexedDB.open('wiys');
                    request.onsuccess = () => {
                      const db = request.result;
                      if (!db.objectStoreNames.contains('elementGroups')) {
                        db.close();
                        resolve(0);
                        return;
                      }
                      const count = db.transaction('elementGroups').objectStore('elementGroups').count();
                      count.onsuccess = () => {
                        db.close();
                        resolve(count.result);
                      };
                    };
                    request.onerror = () => {
                      resolve(0);
                    };
                  }),
              ),
            { timeout: 30_000 },
          )
          .toBe(2);
        await page.clock.runFor(5_000);
        await page.waitForTimeout(3_000);
        await expectQuestion(page, wide);
      });
    });
  }
});
