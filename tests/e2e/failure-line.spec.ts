/**
 * R91 (FR-FAIL-1, FR-FAIL-4, US-33 AC3, F-88) on the production build: a pass
 * worker that throws is a failure, not "Computing…" for ever. The first worker
 * the page spawns is served with a listener in front of its own that throws on
 * the pass job; the worker client's `error` listener ends the job (R86), the
 * status line becomes the failure line well inside `JOB_STALL_S`, and the
 * mark's bead stops. `[ retry ]` spawns a new worker — served as built — and
 * the list arrives.
 */
import { expect, test } from '@playwright/test';
import { ha, PASS_COUNT, stubNetwork, T } from './liveHelpers';

/** `JOB_STALL_S` (`src/state/workerClient.ts`), not imported: the e2e project does not load app code. */
const JOB_STALL_S = 60;

// The precache would serve the worker script past `page.route`, and the poison with it.
test.use({ serviceWorkers: 'block' });
const PREFS_KEY = 'wiys:prefs:v1';
const NEUQUEN = { lat: ha.observer.lat, lon: ha.observer.lon, altM: 0, label: `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`, source: 'coords', timeZone: null };

/** Runs before the worker's own `onmessage` and throws on the pass job, which the worker then never sees. */
const POISON = `self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'computePasses') {
    event.stopImmediatePropagation();
    throw new Error('R91 e2e: the pass worker throws');
  }
});
`;

for (const width of [390, 1280]) {
  test(`at ${String(width)} px a worker that throws turns "Computing…" into the failure line, and [ retry ] produces a list (FR-FAIL-4)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(T);
    await stubNetwork(page);
    // The first worker is poisoned and every later one is served as built: nothing but [ retry ] spawns another
    // after a job's worker dies (D-543; R91 closed the Now request's path that restarted the job at once).
    let spawned = 0;
    await page.route('**/passes.worker*.js', async (route) => {
      spawned += 1;
      const first = spawned === 1;
      const response = await route.fetch();
      const body = await response.text();
      await route.fulfill({ response, body: first ? POISON + body : body });
    });
    await page.addInitScript(
      ([key, value]: [string, string]) => {
        localStorage.setItem(key, value);
      },
      [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
    );
    await page.goto('/');

    const list = page.getByRole('region', { name: 'Upcoming passes' });
    const line = list.getByTestId('failure-line');
    await expect(line).toHaveAttribute('data-site', 'passes', { timeout: JOB_STALL_S * 1000 });
    await expect(line.getByTestId('failure-sentence')).toHaveText(/^Could not compute the passes\./);
    await expect(line.getByTestId('failure-sentence')).not.toHaveText(/HTTP|\d{3}|Error:/);
    await expect(list.getByText(/Computing passes/)).toHaveCount(0);
    // The raw error is only behind [ details ], and the mark's bead has stopped.
    await expect(line.getByTestId('failure-detail')).toBeHidden();
    await expect(line.getByTestId('failure-detail')).toContainText('R91 e2e: the pass worker throws');
    await expect(page.locator('header [data-mark-running]').first()).toHaveAttribute('data-mark-running', 'false');

    // The line stands: the page does not retry on its own (D-541).
    await page.waitForTimeout(12_000); // past one Now tick
    await expect(line).toBeVisible();
    expect(spawned).toBe(1);

    await line.getByTestId('failure-retry').click();
    await expect(list.getByRole('status')).toHaveText(PASS_COUNT, { timeout: 60_000 });
    await expect(list.getByTestId('failure-line')).toHaveCount(0);
    await expect(list.getByRole('article').first()).toBeVisible();
    // The retry ran on a new worker, served as built.
    expect(spawned).toBe(2);
  });
}
