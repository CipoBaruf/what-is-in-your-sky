/**
 * R2 smoke test (PLAN §9.1 E2E row): clock fixed to the R1 fixture's
 * `capturedAt`, CelesTrak routed to the R1 OMM fixture, and the rendered line
 * must show the first golden pass's start time and max elevation.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number }; peak: { elDeg: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;

const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);

test('typing the Neuquén coordinates shows the first golden ISS pass', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');

  await page.clock.setFixedTime(Date.parse(ha.capturedAt));

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

  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText(/Enter coordinates/);

  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);

  const line = page.getByRole('status');
  await expect(line).toContainText(`start ${hhmmss(golden.start.t)} UTC`);
  await expect(line).toContainText(`max ${String(Math.round(golden.peak.elDeg))}°`);
  await expect(line).toContainText('ISS');

  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain('GROUP=stations');
  expect(requests[0]).not.toContain('CATNR');
});
