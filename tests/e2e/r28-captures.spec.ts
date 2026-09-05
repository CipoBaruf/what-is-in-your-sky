/**
 * R28 captures (FR-OFF-1, FR-OFF-6, FR-OFF-7): the saved places, the update
 * offer and both shapes of the install hint, in both languages. Evidence for
 * the PR, not a test: the assertions only make sure the capture shows the
 * thing it is named after. No colour was added — every mark here is an
 * existing token — so the captures are the dark theme.
 *
 * The favourites are seeded into `wiys:prefs:v1` rather than saved by hand:
 * the round trip through the panel is `favourites.spec.ts`'s job, and a
 * capture run that waited for three recomputes to show two rows would be
 * paying a minute for a picture of a list.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}

const OMM_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;
const T0 = Date.parse(ha.capturedAt) + 9 * DAY_MS;
const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

const neuquen = { lat: ha.observer.lat, lon: ha.observer.lon, altM: 270, label: '−38.93, −67.99', source: 'coords', timeZone: 'America/Argentina/Salta' };
const paris = { lat: 48.86, lon: 2.35, altM: 35, label: '48.86, 2.35', source: 'coords', timeZone: 'Europe/Paris' };

/** Two places already saved, the active one second in the list so the "in use" mark is visible mid-list. */
const seededPrefs = {
  observer: neuquen,
  favourites: [
    { cellKey: '48.86,2.35', observer: paris, addedAt: T0 - DAY_MS, lastUsedAt: T0 - 60_000 },
    { cellKey: '-38.93,-67.99', observer: neuquen, addedAt: T0 - 2 * DAY_MS, lastUsedAt: T0 - 120_000 },
  ],
};

const SPANISH = 'Español';

async function home(page: Page, width: 390 | 1280, locale: 'en' | 'es', prefs: unknown = seededPrefs): Promise<void> {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  await page.clock.setFixedTime(T0);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of EXTERNAL.slice(1)) await page.route(pattern, (route) => route.abort('failed'));
  await page.goto('/');
  if (locale === 'es') await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: SPANISH }).click();
}

/** The event Chromium fires when it has decided the page is installable. */
async function offerInstall(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
  });
}

test('the saved places, at both widths and in both languages', async ({ page }) => {
  for (const width of [390, 1280] as const) {
    for (const locale of ['en', 'es'] as const) {
      if (width === 1280 && locale === 'es') continue; // the wide page is the same list in a wider column
      await home(page, width, locale);
      await expect(page.getByTestId('favourite')).toHaveCount(2);
      await page.getByTestId('favourites').scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `docs/screenshots/r28-favourites-${String(width)}-dark-${locale}.png` });
    }
  }
});

test('the install hint, in both shapes and both languages', async ({ page }) => {
  for (const locale of ['en', 'es'] as const) {
    await home(page, 390, locale);
    await offerInstall(page);
    await expect(page.getByTestId('install-hint')).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/r28-install-390-dark-${locale}.png` });
  }

  // iOS, where the event never fires and `navigator.standalone` is the only tell.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => false });
  });
  for (const locale of ['en', 'es'] as const) {
    await home(page, 390, locale);
    await expect(page.getByTestId('install-hint')).toContainText(locale === 'en' ? 'Add to Home Screen' : 'Compartir');
    await page.screenshot({ path: `docs/screenshots/r28-install-ios-390-dark-${locale}.png` });
  }
});

test('the update offer, in both languages', async ({ page }) => {
  // The same fake waiting worker as `update-banner.spec.ts`, with no reload to follow.
  await page.addInitScript(() => {
    const container = {
      controller: {},
      addEventListener: () => undefined,
      register: () => Promise.resolve({ waiting: { postMessage: () => undefined }, addEventListener: () => undefined }),
    };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => container });
  });
  for (const locale of ['en', 'es'] as const) {
    await home(page, 390, locale);
    await expect(page.getByTestId('update-banner')).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/r28-update-390-dark-${locale}.png` });
  }
});
