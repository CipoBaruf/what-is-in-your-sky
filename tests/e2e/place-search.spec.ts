/**
 * R9 (US-1, FR-LOC-1 (a), FR-LOC-2, FR-LOC-3, FR-LOC-6): the place flow at a
 * phone width. Typing "Cipolletti" key by key produces one geocoding request
 * (the PLAN §7.2 one) after the 500 ms debounce; picking the result shows
 * "Using the centre of Cipolletti, Rio Negro, Argentina (−38.93, −67.99)"
 * and the pass list for it — the R1 golden observer, so the golden ISS pass
 * is among the cards — with times already in the geocoded zone (GMT-3)
 * although the forecast route is aborted: the zone came with the geocoding
 * result, not the forecast. A second test types "Rosario" for the ambiguous
 * eight-row list and checks every row is readable at arm's length (name and
 * region at ≥ 16 px, rows ≥ 44 px, inside the viewport).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
}
interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}
interface GeocodeFixture {
  results: { name: string; admin1?: string; country?: string }[];
}

const OMM_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const rosario = JSON.parse(readFileSync(`tests/fixtures/open-meteo/${OMM_DATE}-rosario-geocode.json`, 'utf8')) as GeocodeFixture;
const DAY_MS = 86_400_000;
const ZONE = 'America/Argentina/Salta';

/** What `lib/timeFormat` prints for `t` in `zone`: "2026-09-11 21:05:10 GMT-3" (same Intl data in Node and Chromium). */
function localStamp(t: number, zone: string): string {
  const p = new Map(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(t).map((x) => [x.type, x.value]));
  return `${p.get('year') ?? ''}-${p.get('month') ?? ''}-${p.get('day') ?? ''} ${p.get('hour') ?? ''}:${p.get('minute') ?? ''}:${p.get('second') ?? ''} ${p.get('timeZoneName') ?? ''}`;
}

test.use({ viewport: { width: 390, height: 844 } });

/** Records every geocoding request and answers the two recorded names, the provider's no-match shape for any other. */
async function routeGeocoding(page: Parameters<Parameters<typeof test>[2]>[0]['page'], requests: URL[]): Promise<void> {
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const name = url.searchParams.get('name');
    if (name === 'cipolletti' || name === 'rosario') {
      await route.fulfill({ path: `tests/fixtures/open-meteo/${OMM_DATE}-${name}-geocode.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    await route.fulfill({ json: { generationtime_ms: 0.5 }, headers: { 'access-control-allow-origin': '*' } });
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  // No forecast: whatever zone the times show must have come from the geocoding result (FR-LOC-3).
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
});

test('search → pick list → confirmation line → pass list for Cipolletti, at 390 px', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const requests: URL[] = [];
  await routeGeocoding(page, requests);

  await page.goto('/');
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/Enter a place name or coordinates/);

  const field = page.getByRole('combobox', { name: 'Place name' });
  await field.pressSequentially('Cipolletti', { delay: 30 }); // ten keystrokes inside 400 ms → one request (FR-LOC-2)
  const options = page.getByRole('listbox', { name: 'Matching places' }).getByRole('option');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText('Cipolletti');
  await expect(options.first()).toContainText('Rio Negro, Argentina');
  expect(requests).toHaveLength(1);
  const [req] = requests;
  expect(req?.searchParams.get('name')).toBe('cipolletti');
  expect(req?.searchParams.get('count')).toBe('8');
  expect(req?.searchParams.get('language')).toBe('en');
  expect(req?.searchParams.get('format')).toBe('json');
  await page.screenshot({ path: 'test-results/r9-place-search-390.png' });

  await options.first().click();
  await expect(options).toHaveCount(0);
  await expect(field).toHaveValue('Cipolletti, Rio Negro, Argentina');
  await expect(page.getByTestId('place-confirmation')).toHaveText('Using the centre of Cipolletti, Rio Negro, Argentina (−38.93, −67.99).');

  // The pass list for the picked place: the golden observer, so the golden ISS pass is among the cards, with times in the geocoded zone.
  await expect(status).toHaveText(/\d+ visible passes in the next 24 h from Cipolletti, Rio Negro, Argentina/, { timeout: 15_000 });
  // The observer stands 267 m up and 0.004° from the golden one, which moves this horizon-grazing pass by about a second.
  const iss = page.getByRole('article', { name: 'ISS (Zarya)' });
  await expect(iss).toHaveCount(1);
  const startMs = Number((await iss.getAttribute('data-pass-id'))?.split('-')[1]);
  expect(Math.abs(startMs - golden.start.t)).toBeLessThanOrEqual(5_000);
  await expect(iss).toContainText(`Start${localStamp(startMs, ZONE)}`);
  await expect(iss).toContainText('GMT-3');
  await expect(iss).not.toContainText('UTC');
  await page.screenshot({ path: 'test-results/r9-place-picker-390.png' });
  expect(requests).toHaveLength(1);
});

test('an ambiguous name shows a pick list readable at arm\'s length: eight rows, name and region, ≥ 16 px, ≥ 44 px tall, inside 390 px', async ({ page }) => {
  const requests: URL[] = [];
  await routeGeocoding(page, requests);
  await page.goto('/');
  const field = page.getByRole('combobox', { name: 'Place name' });
  await field.fill('Rosario');
  const options = page.getByRole('listbox', { name: 'Matching places' }).getByRole('option');
  await expect(options).toHaveCount(rosario.results.length);
  for (let i = 0; i < rosario.results.length; i++) {
    const r = rosario.results[i];
    if (!r) throw new Error('fixture row missing');
    await expect(options.nth(i)).toContainText(r.name);
    if (r.admin1) await expect(options.nth(i)).toContainText(`${r.admin1}, ${r.country ?? ''}`);
    const box = await options.nth(i).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  }
  const fontPx = async (locator: ReturnType<typeof page.locator>): Promise<number> => parseFloat(await locator.evaluate((el) => getComputedStyle(el).fontSize));
  expect(await fontPx(field)).toBeGreaterThanOrEqual(16);
  expect(await fontPx(options.first())).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/r9-place-list-rosario-390.png' });
  // Keyboard: ArrowDown highlights the first row, Enter picks it.
  await field.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await field.press('Enter');
  await expect(page.getByTestId('place-confirmation')).toHaveText('Using the centre of Rosario, Santa Fe, Argentina (−32.95, −60.64).');
  expect(requests).toHaveLength(1);
});

test('no match points at the coordinates input; a failed search leaves the field usable', async ({ page }) => {
  let fail = true;
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    if (fail) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ json: { generationtime_ms: 0.5 }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/');
  const field = page.getByRole('combobox', { name: 'Place name' });
  await field.fill('Cipolletti');
  const alert = page.getByRole('region', { name: 'Location' }).getByRole('alert'); // not the elements banners (R11)
  await expect(alert).toContainText('Could not search for places');
  await expect(alert.getByRole('link', { name: 'enter coordinates instead' })).toBeVisible();
  await expect(field).toBeEnabled();

  fail = false;
  await field.fill('Zzzzqqqq');
  const empty = page.getByText(/No place matches “Zzzzqqqq”/);
  await expect(empty).toBeVisible();
  await expect(alert).toHaveCount(0);
  await empty.getByRole('link', { name: 'enter coordinates instead' }).click();
  await expect(page.getByLabel('Coordinates (lat, lon)')).toBeFocused();
});
