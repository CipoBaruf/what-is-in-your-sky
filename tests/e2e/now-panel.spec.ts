/**
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
const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);
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
});

test('at the R3 clock the panel says plainly that nothing is above 10°, with the time it was checked', async ({ page }) => {
  const t = Date.parse(ha.capturedAt) + 9 * DAY_MS;
  await page.clock.setFixedTime(t);
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Right now' });
  await expect(panel).toContainText('Enter coordinates to see what is overhead right now.');

  await page.getByLabel('Coordinates (lat, lon)').fill(NEUQUEN);
  await expect(panel).toContainText('Nothing visible right now: no catalog satellite is above 10°.', { timeout: 15_000 });
  await expect(panel).toContainText(`as of ${hhmmss(t)} UTC`);
  await expect(panel.getByRole('list')).toHaveCount(0);
});

test('ten seconds into the golden ISS pass the panel lists the ISS with direction, elevation and countdown, and the countdown moves 10 s later', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const t = golden.start.t + 10_000;
  await page.clock.install({ time: t });
  await page.clock.pauseAt(t);
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(NEUQUEN);

  const panel = page.getByRole('region', { name: 'Right now' });
  await expect(panel).toContainText('1 satellite visible right now', { timeout: 15_000 });
  const item = panel.getByRole('listitem');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('ISS (Zarya)');
  await expect(item).toContainText('NE 49°');
  await expect(item).toContainText('10° up');
  await expect(item).toContainText(`sets in ${mmss(golden.end.t - t)}`);
  await expect(panel).toContainText(`as of ${hhmmss(t)} UTC`);

  // US-4 AC2: the 10 s tick re-asks the worker at the new time; no reload, same region.
  await page.clock.runFor(10_000);
  await expect(item).toContainText(`sets in ${mmss(golden.end.t - t - 10_000)}`, { timeout: 15_000 });
  await expect(panel).toContainText(`as of ${hhmmss(t + 10_000)} UTC`);
});
