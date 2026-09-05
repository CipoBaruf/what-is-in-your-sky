/**
 * R28 (FR-OFF-1, OQ-14): a version waiting, offered and not taken until the
 * button is pressed.
 *
 * A real second build cannot be produced inside a test, so the waiting worker
 * is faked at the one seam the app has: `navigator.serviceWorker`, replaced
 * before any of our code runs. That is enough to exercise the whole path the
 * requirement is about — `registerServiceWorker` finds a `waiting` worker on a
 * controlled page, the store's `applyUpdate` is what the banner calls, the
 * message it posts is `SKIP_WAITING` and nothing else, and the reload happens
 * on the `controllerchange` that follows and not before it (D-126).
 *
 * `tests/e2e/pwa.spec.ts` holds the real worker, from the real build; this
 * holds the part of the lifecycle a build cannot show.
 */
/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

const APPLIED_KEY = 'fake-sw-applied';

/**
 * A `ServiceWorkerContainer` with one version already waiting. It reports a
 * controller, so the registration reads the waiting worker as an update rather
 * than as this page's first install; `postMessage` records what it was sent and
 * then does what a worker that skipped waiting does — takes control, which the
 * browser reports as `controllerchange`. After that the mark in
 * `sessionStorage` survives the reload and the next registration offers
 * nothing, which is exactly the shape of a real update having been applied.
 */
async function fakeWaitingWorker(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key: string) => {
    const listeners = new Map<string, ((event: Event) => void)[]>();
    const waiting = {
      postMessage: (message: unknown) => {
        sessionStorage.setItem(key, JSON.stringify(message));
        for (const listener of listeners.get('controllerchange') ?? []) listener(new Event('controllerchange'));
      },
    };
    const container = {
      controller: {},
      addEventListener: (type: string, listener: (event: Event) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      register: () => Promise.resolve({ waiting: sessionStorage.getItem(key) === null ? waiting : null, addEventListener: () => undefined }),
    };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => container });
  }, APPLIED_KEY);
}

test.beforeEach(async ({ page }) => {
  for (const pattern of ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) {
    await page.route(pattern, (route) => route.abort('failed'));
  }
  await fakeWaitingWorker(page);
});

test('a waiting version is offered, and the reload happens only on the click', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByTestId('update-banner');
  await expect(banner).toContainText('A new version is ready.');
  // Offered, not taken: nothing was posted to the waiting worker by rendering it.
  expect(await page.evaluate((key) => sessionStorage.getItem(key), APPLIED_KEY)).toBeNull();
  await page.screenshot({ path: 'test-results/r28-update-banner.png' });

  // A page-lifetime mark, so the reload is observed rather than assumed.
  await page.evaluate(() => {
    (window as unknown as { __beforeReload?: boolean }).__beforeReload = true;
  });
  await page.getByRole('button', { name: 'Reload now' }).click();

  await expect(banner).toHaveCount(0);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), APPLIED_KEY)).toBe(JSON.stringify({ type: 'SKIP_WAITING' }));
  expect(await page.evaluate(() => (window as unknown as { __beforeReload?: boolean }).__beforeReload)).toBeUndefined();
  await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText('What is in your sky right now');
});

/** D-154: the live page replaces the shell, so the offer is not on it at all and cannot be taken from it. */
test('the live page carries no update offer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('update-banner')).toBeVisible();
  await page.getByTestId('live-link').click();
  await expect(page.getByTestId('update-banner')).toHaveCount(0);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), APPLIED_KEY)).toBeNull();
});
