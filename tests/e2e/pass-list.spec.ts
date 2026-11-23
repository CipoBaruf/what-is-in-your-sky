/**
 * R3 smoke test (PLAN §9.1 E2E row): CelesTrak routed to the R1 OMM fixtures
 * (both groups), the clock fixed nine days after the R1 `capturedAt` so the
 * window's first night contains the first golden pass with the coarse grid in phase
 * with R1's (PLAN D-20). The Neuquén flow must show a list of cards and the
 * golden ISS pass must be among them with the expected fields.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { seedStoredRun, withSettings } from './liveHelpers';

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

/* R212 (FR-LAND-6, D-1231): the whole list, with its conditions and readiness, is the phone's satellites page. */
test.use({ viewport: { width: 390, height: 844 } });

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

  await page.goto('/#pass');
  // R212 (FR-LAND-6): with no place the satellites page asks for one, and the list waits for it.
  await expect(page.getByTestId('pass-set-place')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Upcoming passes' })).toHaveCount(0);

  await withSettings(page, async () => {

    await page.getByLabel('Coordinates · e.g. -38.93, -67.99').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);

  });

  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in 72 h/, { timeout: 30_000 });
  const cards = page.getByRole('list', { name: '' }).getByRole('listitem');
  expect(await cards.count()).toBeGreaterThan(1);

  // The tagged card is the next ISS pass, which is the golden one; the 72 h window holds later ISS passes too (R24, R81).
  const iss = page.locator('article[data-pass-card]', { has: page.getByTestId('next-tag') });
  await expect(iss).toHaveCount(1);
  // FR-FIRST-10: the start and the name, then the duration, the peak altitude and point, and the magnitude (US-5 AC1).
  await expect(iss.getByTestId('card-first-line')).toContainText(`${hhmmss(golden.start.t).slice(0, 5)} UTC`);
  await expect(iss.getByTestId('next-tag')).toHaveText('[Next ISS]');
  await expect(iss.getByTestId('card-detail')).toContainText(`peak ${String(Math.round(golden.peak.elDeg))}° ${compass(golden.peak.azDeg)}`);
  await expect(iss.getByTestId('card-detail')).toHaveText(/^\d+ min · peak \d+° [NESW]{1,3} · mag [+−]\d\.\d$/);

  // FR-SAT-2: one request per group, never per object.
  expect(requests.map((u) => new URL(u).searchParams.get('GROUP')).sort()).toEqual(['stations', 'visual']);
  for (const u of requests) expect(u).not.toContain('CATNR');
});

/** A token resolved to the rgb() the browser computes for it, through a probe's colour. */
async function tokenRgb(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  }, token);
}

test('FR-CTRL-15, FR-CTRL-16, FR-CTRL-14: a card has no frame and a hover ground; the nights are ▸ / ▾ disclosures; a tag has no role and no hover', async ({ page }) => {
  await seedStoredRun(page, { settled: true });
  const list = page.getByRole('region', { name: 'Upcoming passes' });
  const raised = await tokenRgb(page, '--bg-raised');
  const card = list.locator('article[data-pass-card]:visible').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  expect(await card.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('none');
  // The card's lines let the pointer through to its control, which lays the raised ground under them.
  await card.hover();
  await expect(card.locator(':scope > button')).toHaveCSS('background-color', raised);

  // US-16 AC5 as amended by FR-CTRL-16: tonight open, `▾ Tonight · 3`, the rest `▸`, the whole line the control.
  const toggles = list.getByTestId('night-toggle');
  await expect(toggles.first()).toHaveText(/^▾ Tonight · \d+$/);
  await expect(toggles.nth(1)).toHaveText(/^▸ Tomorrow night · \d+/);
  await toggles.nth(1).click();
  await expect(toggles.nth(1)).toHaveText(/^▾ Tomorrow night · \d+/);
  await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');

  // FR-CTRL-14: `[Next ISS]` is a Tag — no role, never underlined, no ground under the pointer.
  const tag = list.getByTestId('next-tag');
  await expect(tag).toHaveText(/^\[.+\]$/);
  expect(await tag.getAttribute('role')).toBeNull();
  const tagLook = await tag.evaluate((el) => ({ line: getComputedStyle(el).textDecorationLine, ground: getComputedStyle(el).backgroundColor }));
  expect(tagLook).toEqual({ line: 'none', ground: 'rgba(0, 0, 0, 0)' });
});

test.describe('on a desk', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('FR-CTRL-15, US-65 AC6: the picked row is raised, with a 2 px accent line at its left and aria-current', async ({ page }) => {
    await seedStoredRun(page, { settled: true });
    const rail = page.getByTestId('pass-layout').locator('[data-slot="upFrom"]');
    const picked = rail.locator('article[data-selected]');
    await expect(picked).toHaveCount(1, { timeout: 30_000 });
    const control = picked.locator(':scope > button');
    await expect(control).toHaveAttribute('aria-current', 'true');
    await expect(control).toHaveCSS('background-color', await tokenRgb(page, '--bg-raised'));
    const line = await control.evaluate((el) => {
      const before = getComputedStyle(el, '::before');
      return { width: before.borderLeftWidth, colour: before.borderLeftColor, left: el.getBoundingClientRect().left };
    });
    expect(line.width).toBe('2px');
    expect(line.colour).toBe(await tokenRgb(page, '--accent'));
    expect(Math.round(line.left)).toBe(Math.round((await picked.boundingBox())?.x ?? NaN));
    // Every other row is not picked.
    for (const other of await rail.locator('article[data-pass-card]:not([data-selected]) > button').all()) await expect(other).not.toHaveAttribute('aria-current');
  });
});
