/**
 * R3 smoke test (PLAN §9.1 E2E row): CelesTrak routed to the R1 OMM fixtures
 * (both groups), the clock fixed nine days after the R1 `capturedAt` so the
 * window's first night contains the first golden pass with the coarse grid in phase
 * with R1's (PLAN D-20). The Neuquén flow must show a list of cards and the
 * golden ISS pass must be among them with the expected fields.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number }; peak: { azDeg: number; elDeg: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;

const DAY_MS = 86_400_000;
const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);
// Mirrors src/lib/compass.ts for the golden peak azimuth (53.3° → NE) without importing app code into the e2e project.
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (az: number): string => COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16] ?? 'N';

test('typing the Neuquén coordinates shows the pass list with the golden ISS pass among the cards', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');

  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);

  const requests: string[] = [];
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.toString());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });

  // R8: without a forecast the zone stays unknown and times stay in UTC, which is what this spec asserts (weather.spec.ts covers the forecast).
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/Enter a place name or coordinates/);

  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);

  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });
  const cards = page.getByRole('list', { name: '' }).getByRole('listitem');
  expect(await cards.count()).toBeGreaterThan(1);

  const iss = page.getByRole('article', { name: 'ISS (Zarya)' });
  await expect(iss).toHaveCount(1);
  await expect(iss).toContainText(`${hhmmss(golden.start.t)} UTC`);
  // The `<dt>` labels get their colon from CSS (`::after`), which is not part of the text content.
  await expect(iss).toContainText(`Max elevation${String(Math.round(golden.peak.elDeg))}°`);
  await expect(iss).toContainText(`Peak direction${compass(golden.peak.azDeg)} (${String(Math.round(golden.peak.azDeg))}°)`);
  await expect(iss).toContainText(/Duration\d+ s/);
  await expect(iss).toContainText(/Magnitude[+−]\d\.\d/);

  // FR-SAT-2: one request per group, never per object.
  expect(requests.map((u) => new URL(u).searchParams.get('GROUP')).sort()).toEqual(['stations', 'visual']);
  for (const u of requests) expect(u).not.toContain('CATNR');
});
