/**
 * R81 (FR-FIRST-9, D-509): the Now panel is the When reading's conditions
 * table now, and this spec follows its facts there — the nothing-visible case
 * is the `Up now` row's absence, the visible one its value.
 *
 * R7 (US-4, FR-VIS-5): the "Now" panel at two fixed clocks for Neuquén, with
 * CelesTrak routed to the R1 OMM fixtures. At the R3 clock (nine days after
 * the R1 capture, 03:51 UTC) the sky is dark and no catalog object is above
 * 10°; ten seconds into the R1 golden ISS pass the ISS is the one visible
 * satellite, low in the north-east, about to set. Expected values come from
 * `physics/now.ts` on the same fixtures (see `now.test.ts`), so the panel is
 * checked against the physics, not against itself. The second test then
 * advances the page clock by 10 s and expects the countdown to move, which
 * is US-4 AC2 end to end.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { withSettings } from './liveHelpers';

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
const DAY_MS = 86_400_000;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;
const mmss = (ms: number): string => `${String(Math.floor(ms / 60_000))}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}`;

test.beforeEach(async ({ page }) => {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  // R8: without a forecast the zone stays unknown and times stay in UTC, which is what this spec asserts (weather.spec.ts covers the forecast).
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
});

test('at the R3 clock nothing is above 10°, so the table has no Up now row', async ({ page }) => {
  const t = Date.parse(ha.capturedAt) + 9 * DAY_MS;
  await page.clock.setFixedTime(t);
  await page.goto('/');
  const table = page.getByTestId('conditions');
  // R76 (FR-FIRST-1): with no place the page is the cold open, and the table waits for one.
  await expect(page.getByTestId('cold-open')).toBeVisible();
  await expect(table).toHaveCount(0);

  await withSettings(page, async () => {
    await page.getByLabel('Coordinates · e.g. -38.93, -67.99').fill(NEUQUEN);
  });
  // R81 (D-509, US-4 AC1 as amended v2.0.2): the sky check has answered — the Moon row is its — and with
  // nothing up there is no Up now row rather than a sentence about why; the Dark row says when to look.
  await expect(table.getByTestId('moon-row')).toBeVisible({ timeout: 30_000 });
  await expect(table.getByTestId('dark-window')).toHaveText(/^\d\d:\d\d → \d\d:\d\d UTC$|^until \d\d:\d\d UTC$/);
  await expect(table.getByTestId('up-now')).toHaveCount(0);
  await expect(table.getByRole('term')).toHaveText(['Dark', 'Clouds now', 'Moon']);
});

test('ten seconds into the golden ISS pass the Up now row names the ISS with its time left, and the time moves 10 s later', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const t = golden.start.t + 10_000;
  await page.clock.install({ time: t });
  await page.clock.pauseAt(t);
  await page.goto('/');
  await withSettings(page, async () => {
    await page.getByLabel('Coordinates · e.g. -38.93, -67.99').fill(NEUQUEN);
  });

  // US-4 AC3 as amended v2.0.2: the first one up, its time left, and no `+<n>` — it is the only one.
  const table = page.getByTestId('conditions');
  const upNow = table.getByTestId('up-now');
  await expect(upNow).toHaveText(`ISS (Zarya) · ${mmss(golden.end.t - t)} left`, { timeout: 30_000 });
  await expect(table.getByRole('term')).toHaveText(['Dark', 'Clouds now', 'Moon', 'Up now']);

  // US-4 AC2: the 10 s tick re-asks the worker at the new time; no reload, same row.
  await page.clock.runFor(10_000);
  await expect(upNow).toHaveText(`ISS (Zarya) · ${mmss(golden.end.t - t - 10_000)} left`, { timeout: 30_000 });
});
