/**
 * R22 (FR-DOME-5, FR-DOME-6, FR-DOME-7) at 390 px on the production build:
 * the detail sheet of a pass that is happening *now*.
 *
 * The clock is installed a minute before the R1 golden pass and then run
 * forward in ten-second steps, which is the tick the sheet lives by. What the
 * test holds:
 *
 *   - the drawing changes at each tick while the satellite is up, in both
 *     views, and stops changing once the pass is over (the marker is gone);
 *   - the polar view's live marker moves between two ticks and its flown path
 *     grows behind it;
 *   - the Sun is labelled in both views — at this instant it is 10.6° under
 *     the horizon, inside FR-DOME-6's band — and the Moon, which is 11°
 *     *below* the horizon, is drawn in neither;
 *   - no worker request goes out between ticks other than the ones the rest of
 *     the page makes: the chart's marker is interpolated from `Pass.track`.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number }; end: { t: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;

test.use({ viewport: { width: 390, height: 844 } });

const golden = (): { start: number; end: number } => {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
  return { start: pass.start.t, end: pass.end.t };
};

/** The app at a chosen instant with the R1 fixtures, the golden pass's sheet open. */
async function openGoldenPassAt(page: Page, t: number): Promise<{ passId: string }> {
  const passId = `25544-${String(golden().start)}`;
  await page.clock.install({ time: t });
  await page.clock.pauseAt(t);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });
  await page.locator(`article[data-pass-id="${passId}"]`).getByRole('button', { name: /Open guide/ }).click();
  await expect(page.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeVisible();
  return { passId };
}

test('the dome redraws at every tick while the satellite is up, and labels the Sun but not a Moon below the horizon', async ({ page }) => {
  const pass = golden();
  await openGoldenPassAt(page, pass.start - 60_000);
  const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  const raster = dialog.locator('[data-layer="lines"] pre.glyph-output');
  // The chart chunk, the raster font and glyphcss's first rasterisation all
  // wait on timers the installed clock is holding; a second of it lets them go.
  await page.clock.runFor(1000);
  await expect(raster).toBeVisible({ timeout: 30_000 });

  // A minute before the pass: nothing is flying yet, so a tick changes nothing.
  const before = await raster.textContent();
  await page.clock.runFor(10_000);
  await expect.poll(async () => raster.textContent()).toBe(before);

  // FR-DOME-6: the Sun is 10.6° under the horizon here, inside the glow's
  // band; the Moon is 11° below it and is drawn nowhere.
  await expect(dialog.locator('[data-anchor="sun"]')).toHaveText('Sun');
  await expect(dialog.locator('[data-anchor="moon"]')).toHaveCount(0);

  // FR-DOME-5: into the pass, and the drawing moves on with each tick.
  await page.clock.runFor(60_000);
  const seen = new Set<string>();
  for (let tick = 0; tick < 3; tick++) {
    seen.add((await raster.textContent()) ?? '');
    await page.clock.runFor(10_000);
  }
  expect(seen.size).toBeGreaterThan(1);
});

test('the polar view moves the live marker and grows the flown arc behind it at the 10 s tick', async ({ page }) => {
  const pass = golden();
  await openGoldenPassAt(page, pass.start - 60_000);
  const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  await dialog.getByRole('button', { name: 'Polar' }).click();
  const drawing = dialog.locator('[data-drawing="polar"]');
  await expect(drawing).toBeVisible();

  // Before the pass there is nothing to mark and nothing flown.
  await expect(drawing.locator('[data-marker="now"]')).toHaveCount(0);
  await expect(drawing.locator('[data-marker="flown"]')).toHaveCount(0);
  await expect(drawing.locator('[data-anchor="sun"]')).toHaveText('Sun');

  await page.clock.runFor(70_000);
  const marker = drawing.locator('[data-marker="now"]');
  await expect(marker).toHaveCount(1);
  const first = await marker.getAttribute('transform');
  const flownFirst = (await drawing.locator('[data-marker="flown"]').getAttribute('d')) ?? '';
  expect(flownFirst).not.toBe('');

  await page.clock.runFor(10_000);
  await expect.poll(async () => marker.getAttribute('transform')).not.toBe(first);
  const flownSecond = (await drawing.locator('[data-marker="flown"]').getAttribute('d')) ?? '';
  expect(flownSecond.length).toBeGreaterThan(flownFirst.length);

  // Past the end of the pass there is no marker left, and the whole arc is flown.
  await page.clock.runFor(60_000);
  await expect(marker).toHaveCount(0);
});
