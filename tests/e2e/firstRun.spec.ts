/**
 * R202 (FR-OPEN-2..6; US-60, US-61; D-1183): the example first run where only a browser can answer. R212 (FR-LAND-1,
 * FR-LAND-7; D-1230): the home and its band are gone, so the example is the live page's — `/` opens `#live` over the
 * zone's city. R215 (FR-LAND-4, D-1238): the line under the header gave way to the header's place line on a desk
 * (`Buenos Aires · example  change`; a phone's is the controls sheet's, R219's) and `change` opens the place dialog.
 * Every example case names the zone, a fixed clock and the elements fixture, so the example is the same on every run.
 */
import { expect, test, type Page } from '@playwright/test';
import { LABEL, NINE_DAYS_ON, stubNetwork } from './liveHelpers';
import { NEUQUEN } from './observers';

const ZONE = 'America/Argentina/Buenos_Aires';
const GEOCODE = 'tests/fixtures/open-meteo/2026-09-02-cipolletti-geocode.json';
const PAIR = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;
const WORDS = {
  en: { locale: 'en-GB', example: 'example', change: 'change' },
  es: { locale: 'es-AR', example: 'ejemplo', change: 'cambiar' },
} as const;
const LANGS = ['en', 'es'] as const;
const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;
const size = (v: { width: number; height: number }): string => `${String(v.width)} × ${String(v.height)}`;

test.use({ serviceWorkers: 'block' });

/** The suite's clock and elements, the count's route answered, and every request's host kept for US-60 AC2. */
async function open(page: Page): Promise<{ hosts: Set<string>; forecasts: URL[] }> {
  const seen = { hosts: new Set<string>(), forecasts: [] as URL[] };
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http')) seen.hosts.add(url.hostname);
    if (url.hostname === 'api.open-meteo.com') seen.forecasts.push(url);
  });
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.route('**/e', (route) => route.fulfill({ status: 204 }));
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.fulfill({ path: GEOCODE, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/');
  return seen;
}

/** The example is the page's: on a desk the header's place line reads it; on a phone the live page draws the sky. */
async function exampleShown(page: Page, wide: boolean, word: string): Promise<void> {
  await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('live-no-place')).toHaveCount(0);
  if (!wide) return;
  const line = page.getByTestId('header').getByTestId('place-line');
  await expect(line).toHaveAttribute('data-place', 'example', { timeout: 60_000 });
  await expect(line).toContainText(`Buenos Aires · ${word}`);
}

/** Where the bottom of `testId` is. */
async function box(page: Page, testId: string): Promise<{ top: number; bottom: number }> {
  const rect = await page.getByTestId(testId).first().boundingBox();
  if (!rect) throw new Error(`${testId} is not laid out`);
  return { top: rect.y, bottom: rect.y + rect.height };
}

/** Nothing of the example kept: no observer in the prefs, no run in IndexedDB, no city in storage. */
async function kept(page: Page): Promise<{ observer: unknown; runs: number; storage: string }> {
  return page.evaluate(async () => {
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
    return { observer: prefs.observer ?? null, runs, storage: JSON.stringify(localStorage) };
  });
}

for (const lang of LANGS) {
  const w = WORDS[lang];
  test.describe(`the example on the live page, ${lang}`, () => {
    test.use({ timezoneId: ZONE, locale: w.locale });

    for (const viewport of SIZES) {
      test.describe(`at ${size(viewport)}`, () => {
        test.use({ viewport });

        test('US-60 AC1, AC2, AC5 (FR-OPEN-2, FR-OPEN-3 and FR-OPEN-14 as amended, FR-LAND-1, FR-LAND-7): `/` is the live page for the zone\'s city, its place line, nothing kept', async ({ page }) => {
          const seen = await open(page);
          await expect(page).toHaveURL(/#live$/);
          const wide = viewport.width >= 964;
          await exampleShown(page, wide, w.example);
          if (wide) await expect(page.getByTestId('header').getByTestId('place-change')).toHaveText(w.change);
          // FR-LAND-7: the example has no other first-visit text — the home's band, its tagline and its doors are gone.
          for (const id of ['example-band', 'home-tagline', 'home-doors', 'cold-open', 'example-after-dusk']) await expect(page.getByTestId(id)).toHaveCount(0);
          // On a desk the place line stands inside the header's row (FR-LAND-4).
          if (wide) expect((await box(page, 'place-line')).bottom).toBeLessThanOrEqual((await box(page, 'header')).bottom + 1);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

          // US-60 AC2 (FR-OPEN-2): no host but CelesTrak, Open-Meteo and the page's own; the forecast is the zone city's.
          await expect.poll(() => seen.forecasts.length, { timeout: 30_000 }).toBeGreaterThan(0);
          expect([...seen.hosts].sort()).toEqual(['api.open-meteo.com', 'celestrak.org', 'localhost']);
          for (const url of seen.forecasts) {
            expect(Number(url.searchParams.get('latitude'))).toBeCloseTo(-34.6, 0);
            expect(Number(url.searchParams.get('longitude'))).toBeCloseTo(-58.45, 0);
          }
          const stored = await kept(page);
          expect(stored.observer).toBeNull();
          expect(stored.runs).toBe(0);
          expect(stored.storage).not.toMatch(/Buenos|-34\.6|-58\.4/);

          // US-60 AC5: a reload with no place set shows the example again.
          await page.reload();
          await exampleShown(page, wide, w.example);
        });
      });
    }
  });
}

test.describe('from the example to a place (US-61, FR-OPEN-5, FR-LAND-4, D-1238)', () => {
  test.use({ timezoneId: ZONE, locale: 'en-GB' });

  for (const viewport of SIZES) {
    test(`at ${size(viewport)} change opens the place dialog, and a place set there closes it and is kept`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      // A desk's change is the header's; a phone's live page has none until R219's sheet, so its list's head (#pass).
      if (viewport.width < 964) {
        await page.evaluate(() => {
          location.hash = '#pass';
        });
      }
      await page.getByTestId('place-change').first().click({ timeout: 60_000 });
      const dialog = page.getByTestId('place-dialog');
      await expect(dialog).toBeVisible();
      // The dialog's coordinates are open, and a typed pair waits for its continue (D-1275).
      await dialog.getByLabel(LABEL.en.coords).fill(PAIR);
      await dialog.getByTestId('place-dialog-continue').click();
      await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { observer?: unknown }).observer ?? null), { timeout: 30_000 }).not.toBeNull();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId('place-line').first()).toHaveAttribute('data-place', 'set');
    });
  }
});

/**
 * FR-OPEN-6 (US-60 AC4) as R212 leaves it: with no city for the zone the live page asks for a place in place of
 * the sky, and its control opens the place dialog (R215, D-1238).
 */
test.describe('when there is no example (FR-OPEN-6)', () => {
  for (const viewport of SIZES) {
    test.describe(`no city (Etc/UTC), at ${size(viewport)}`, () => {
      test.use({ viewport, timezoneId: 'Etc/UTC', locale: 'en-GB' });

      // R222 (FR-LAND-5, US-62 AC2): no city, so the sky's box holds the place group under the tagline.
      test('the live page draws the place group in the box, the tagline above it, with no example line', async ({ page }) => {
        await open(page);
        await expect(page).toHaveURL(/#live$/);
        const group = page.getByTestId('live-place-group');
        await expect(group).toBeVisible({ timeout: 60_000 });
        await expect(group.getByRole('combobox').first()).toBeVisible();
        const tagline = await page.getByTestId('live-tagline').boundingBox();
        const card = await group.boundingBox();
        expect(tagline && card && tagline.y + tagline.height <= card.y + 1).toBe(true);
        await expect(page).toHaveURL(/#live$/);
      });
    });
  }
});
