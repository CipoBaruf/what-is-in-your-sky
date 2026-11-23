/**
 * R28 (FR-OFF-1, OQ-14): a version waiting, offered and not taken until the
 * button is pressed.
 *
 * A real second build cannot be produced inside a test, so the new worker is
 * faked at the one seam the app has: `navigator.serviceWorker`, replaced before
 * any of our code runs. That is enough to exercise the whole path the
 * requirement is about — `registerServiceWorker` hears a worker install on a
 * controlled page, the store's `applyUpdate` is what the bar calls, the message
 * it posts is `SKIP_WAITING` and nothing else, and the reload happens on the
 * `controllerchange` that follows and not before it (D-126).
 *
 * `tests/e2e/pwa.spec.ts` holds the real worker, from the real build; this
 * holds the part of the lifecycle a build cannot show.
 *
 * R212 (D-1237, FR-UPD-2): the bar is the shell's, drawn under the header on every page.
 * R220 (FR-UPD-1, FR-UPD-2; US-66 AC1): the release lands while the tab is open, and the bar is on `#live`, `#pass`
 * and `#settings` within 10 s of the tab coming back into view, at 390 × 844 and 1280 × 800, and outside the sky's box.
 */
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { seedStoredRun } from './liveHelpers';

const APPLIED_KEY = 'fake-sw-applied';

/** What the fake puts on `window`: the release, and whether the app has registered yet. */
interface FakeRelease {
  __fakeSw: { registered: boolean; deploy: () => void };
}

/**
 * A `ServiceWorkerContainer` with nothing waiting at load. It reports a
 * controller, so a worker that installs reads as an update rather than as this
 * page's first install. `deploy()` is the release: from then on the
 * registration's `update()` finds a new worker, which installs and waits — the
 * shape the browser gives a changed `sw.js`. The worker's `postMessage` records
 * what it was sent and then does what a worker that skipped waiting does —
 * takes control, which the browser reports as `controllerchange`. After that
 * the mark in `sessionStorage` survives the reload and no update is found
 * again, which is exactly the shape of a real update having been applied.
 */
async function fakeServiceWorker(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    type Listener = (event: Event) => void;
    const on = (map: Map<string, Listener[]>, type: string, listener: Listener): void => {
      map.set(type, [...(map.get(type) ?? []), listener]);
    };
    const fire = (map: Map<string, Listener[]>, type: string): void => {
      for (const listener of map.get(type) ?? []) listener(new Event(type));
    };
    const containerListeners = new Map<string, Listener[]>();
    const registrationListeners = new Map<string, Listener[]>();
    let deployed = false;
    let found = false;
    const registration = {
      waiting: null as unknown,
      installing: null as unknown,
      addEventListener: (type: string, listener: Listener) => {
        on(registrationListeners, type, listener);
      },
      update: () => {
        if (deployed && !found && sessionStorage.getItem(key) === null) {
          found = true;
          const workerListeners = new Map<string, Listener[]>();
          const worker = {
            state: 'installing',
            addEventListener: (type: string, listener: Listener) => {
              on(workerListeners, type, listener);
            },
            postMessage: (message: unknown) => {
              sessionStorage.setItem(key, JSON.stringify(message));
              fire(containerListeners, 'controllerchange');
            },
          };
          registration.installing = worker;
          fire(registrationListeners, 'updatefound');
          setTimeout(() => {
            worker.state = 'installed';
            registration.installing = null;
            registration.waiting = worker;
            fire(workerListeners, 'statechange');
          }, 50);
        }
        return Promise.resolve(registration);
      },
    };
    const fake = { registered: false, deploy: () => (deployed = true) };
    (window as unknown as FakeRelease).__fakeSw = fake;
    const container = {
      controller: {},
      addEventListener: (type: string, listener: Listener) => {
        on(containerListeners, type, listener);
      },
      register: () => {
        fake.registered = true;
        return Promise.resolve(registration);
      },
    };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => container });
  }, APPLIED_KEY);
}

/** The release lands while the tab is in the background; then the reader comes back to it. */
async function releaseWhileAway(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as FakeRelease).__fakeSw.registered);
  await page.evaluate(() => {
    const show = (hidden: boolean): void => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    show(true);
    (window as unknown as FakeRelease).__fakeSw.deploy();
    show(false);
  });
}

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1280, height: 800 },
] as const;
const PAGES = ['live', 'pass', 'settings'] as const;

for (const size of SIZES) {
  for (const route of PAGES) {
    test(`US-66 AC1, FR-UPD-2: a release is said on #${route} at ${size.name} within 10 s of coming back, under the header and outside the sky's box, and reloads only on the click`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await fakeServiceWorker(page);
      // Ends on `#pass` with a place and a settled list; the other two pages keep the store.
      await seedStoredRun(page, { settled: true });
      if (route !== 'pass') {
        await page.evaluate((hash) => {
          location.hash = hash;
        }, route);
      }
      await expect(page.locator('[data-update-bar]')).toBeAttached();
      const bar = page.getByTestId('update-banner');
      // Nothing waits until the release: the load's own check found no new worker.
      await expect(bar).toHaveCount(0);

      await releaseWhileAway(page);
      await expect(bar).toBeVisible({ timeout: 10_000 });
      await expect(bar).toContainText('New version ready · reload');
      // Offered, not taken: nothing was posted to the waiting worker by rendering it.
      expect(await page.evaluate((key) => sessionStorage.getItem(key), APPLIED_KEY)).toBeNull();

      const barBox = await bar.boundingBox();
      if (barBox === null) throw new Error('the bar has no box');
      // Under the header: the page's `banner` landmark ends at or above the bar's top.
      const header = await page.getByRole('banner').first().boundingBox();
      if (header !== null) expect(barBox.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
      // Never over the sky: no visible sky box shares a pixel row with the bar.
      for (const drawing of await page.locator('[data-slot="drawing"]').all()) {
        const box = await drawing.boundingBox();
        if (box === null || box.height === 0) continue;
        const overlaps = box.y < barBox.y + barBox.height - 0.5 && barBox.y < box.y + box.height - 0.5 && box.x < barBox.x + barBox.width && barBox.x < box.x + box.width;
        expect(overlaps, `the bar (${JSON.stringify(barBox)}) stands over the sky's box (${JSON.stringify(box)})`).toBe(false);
      }
      // What the reader sees is the bar, not something drawn over it.
      const reload = page.getByRole('button', { name: 'reload', exact: true });
      const hit = await reload.boundingBox();
      if (hit === null) throw new Error('reload has no box');
      const topmost = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('[data-testid="update-banner"]') !== null, [hit.x + hit.width / 2, hit.y + hit.height / 2]);
      expect(topmost).toBe(true);
      await page.screenshot({ path: `test-results/r220-update-bar-${route}-${size.name}.png` });

      // A page-lifetime mark, so the reload is observed rather than assumed.
      await page.evaluate(() => {
        (window as unknown as { __beforeReload?: boolean }).__beforeReload = true;
      });
      await reload.click();

      await expect(bar).toHaveCount(0);
      expect(await page.evaluate((key) => sessionStorage.getItem(key), APPLIED_KEY)).toBe(JSON.stringify({ type: 'SKIP_WAITING' }));
      await expect.poll(() => page.evaluate(() => (window as unknown as { __beforeReload?: boolean }).__beforeReload)).toBeUndefined();
      // The same page after the reload; a desk's `#pass` carries the pass it opened (`#pass=<id>`).
      await expect(page).toHaveURL(new RegExp(`#${route}(=[^#]*)?$`));
    });
  }
}
