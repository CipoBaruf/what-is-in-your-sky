/**
 * R202 (FR-OPEN-2..6; US-60, US-61; D-1183): the example first run where only a browser can answer. R212 (FR-LAND-1,
 * FR-LAND-7; D-1230): the home and its band are gone, so the example is the live page's — `/` opens `#live` over the
 * zone's city with FR-OPEN-7's line under the header — and the line's control opens the settings page's place group.
 * Every example case names the zone, a fixed clock and the elements fixture, so the example is the same on every run.
 */
import { expect, test, type Page } from '@playwright/test';
import { LABEL, NINE_DAYS_ON, stubNetwork } from './liveHelpers';
import { NEUQUEN } from './observers';

const ZONE = 'America/Argentina/Buenos_Aires';
const GEOCODE = 'tests/fixtures/open-meteo/2026-09-02-cipolletti-geocode.json';
const PAIR = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;
const WORDS = {
  en: { locale: 'en-GB', label: 'Example: Buenos Aires, from your time zone', set: 'set your place' },
  es: { locale: 'es-AR', label: 'Ejemplo: Buenos Aires, según tu zona horaria', set: 'elegí tu lugar' },
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

        test('US-60 AC1, AC2, AC5 (FR-OPEN-2, FR-OPEN-3 and FR-OPEN-14 as amended, FR-LAND-1, FR-LAND-7): `/` is the live page for the zone\'s city, its line under the header, nothing kept', async ({ page }) => {
          const seen = await open(page);
          await expect(page).toHaveURL(/#live$/);
          const notice = page.getByTestId('example-notice');
          await expect(notice).toContainText(w.label, { timeout: 60_000 });
          await expect(notice.getByTestId('example-notice-set')).toHaveText(w.set);
          await expect(page.getByTestId('live-layout')).toBeVisible();
          // FR-LAND-7: the example has no other first-visit text — the home's band, its tagline and its doors are gone.
          for (const id of ['example-band', 'home-tagline', 'home-doors', 'cold-open', 'example-after-dusk']) await expect(page.getByTestId(id)).toHaveCount(0);
          // On a desk the line stands under the header; the phone's live page is all sky and has none (FR-FULL-*).
          if (viewport.width >= 964) expect((await box(page, 'example-notice')).top).toBeGreaterThanOrEqual((await box(page, 'header')).bottom - 1);
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
          await expect(page.getByTestId('example-notice')).toContainText(w.label, { timeout: 60_000 });
        });
      });
    }
  });
}

test.describe('from the example to a place (US-61, FR-OPEN-5, D-1230)', () => {
  test.use({ timezoneId: ZONE, locale: 'en-GB' });

  for (const viewport of SIZES) {
    test(`at ${size(viewport)} the line's control opens the place group on the settings page, and a place set there is kept`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      await page.getByTestId('example-notice-set').click({ timeout: 60_000 });
      await expect(page).toHaveURL(/#settings$/);
      const disclosure = page.getByTestId('coords-disclosure');
      if ((await disclosure.getAttribute('aria-expanded')) === 'false') await disclosure.click();
      await page.getByLabel(LABEL.en.coords).fill(PAIR);
      const go = page.getByRole('button', { name: 'continue' });
      if (await go.isVisible()) await go.click();
      await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { observer?: unknown }).observer ?? null), { timeout: 30_000 }).not.toBeNull();
      await expect(page.getByTestId('example-notice')).toHaveCount(0);
    });
  }
});

/**
 * FR-OPEN-6 (US-60 AC4) as R212 leaves it: with no city for the zone the live page asks for a place in place of
 * the sky, and its control opens the settings page's place group (D-1230); R215 makes that the place dialog.
 */
test.describe('when there is no example (FR-OPEN-6)', () => {
  for (const viewport of SIZES) {
    test.describe(`no city (Etc/UTC), at ${size(viewport)}`, () => {
      test.use({ viewport, timezoneId: 'Etc/UTC', locale: 'en-GB' });

      test('the live page asks for a place, with no example line', async ({ page }) => {
        await open(page);
        await expect(page).toHaveURL(/#live$/);
        const ask = page.getByTestId('live-set-place');
        await expect(ask).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('example-notice')).toHaveCount(0);
        await ask.click();
        await expect(page).toHaveURL(/#settings$/);
      });
    });
  }
});
