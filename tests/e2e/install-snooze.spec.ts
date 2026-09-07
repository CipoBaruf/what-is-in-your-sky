/**
 * R55 (FR-OFF-6 as amended v1.1.2, US-16 AC4, D-272): "Not now" is a snooze,
 * end to end. The hint goes away, survives a reload while the snooze runs, and
 * comes back once it has run out and the browser is offering again — and the
 * third refusal ends it for good.
 *
 * The clock is Playwright's, because the component reads `Date.now()` once at
 * mount (D-272: the snooze is not ticked), so moving the clock and reloading is
 * exactly what a reader coming back a week later does. `beforeinstallprompt` is
 * dispatched by hand, as `r28-captures.spec.ts` does: Chromium fires it only
 * for an origin it has decided is installable, which a test server is not.
 */
import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_DATE, NEUQUEN } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const DAY_MS = 86_400_000;
const T0 = Date.UTC(2026, 8, 6, 21, 0);

async function home(page: Page, at: number): Promise<void> {
  await page.clock.setFixedTime(at);
  await page.goto('/');
  await expect(page.getByTestId('location-summary').or(page.getByRole('region', { name: 'Location' })).first()).toBeVisible({ timeout: 60_000 });
}

/** The event Chromium fires when it has decided the page is installable. */
async function offerInstall(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Seeded once and not on every navigation: the reloads below are the point, and what they have to
  // carry across is exactly what the reader's own browser would — the answer written on the last visit.
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ observer: NEUQUEN })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
});

test('"Not now" hides the install hint for a week, and it comes back after it', async ({ page }) => {
  await home(page, T0);
  await offerInstall(page);
  const hint = page.getByTestId('install-hint');
  await expect(hint).toBeVisible();

  await hint.getByRole('button', { name: 'Not now' }).click();
  await expect(hint).toBeHidden();
  // What was written is a snooze, not the old latch.
  const stored = async (): Promise<Record<string, unknown>> => JSON.parse((await page.evaluate((key: string) => localStorage.getItem(key), PREFS_KEY)) ?? '{}') as Record<string, unknown>;
  expect(await stored()).toMatchObject({ installHintDeclines: 1, installHintSnoozedUntil: T0 + 7 * DAY_MS });
  expect(await stored()).not.toHaveProperty('installHintDismissed');

  // A reload inside the snooze: still away, even though the browser offers again.
  await home(page, T0 + 7 * DAY_MS - 60_000);
  await offerInstall(page);
  await expect(page.getByTestId('install-hint')).toBeHidden();

  // The week is up: the offer is back, with a button that works because the event fired on this load.
  await home(page, T0 + 7 * DAY_MS);
  await offerInstall(page);
  await expect(page.getByTestId('install-hint')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install' })).toBeVisible();
});

test('the third "Not now" ends the offer for good', async ({ page }) => {
  for (const [index, at] of [T0, T0 + 7 * DAY_MS, T0 + 37 * DAY_MS].entries()) {
    await home(page, at);
    await offerInstall(page);
    await expect(page.getByTestId('install-hint'), `decline ${String(index + 1)}`).toBeVisible();
    await page.getByTestId('install-hint').getByRole('button', { name: 'Not now' }).click();
  }
  // Ten years on, with the browser still offering: nothing. Three refusals and no more (FR-OFF-6 as amended).
  await home(page, T0 + 3650 * DAY_MS);
  await offerInstall(page);
  await expect(page.getByTestId('install-hint')).toBeHidden();
});
