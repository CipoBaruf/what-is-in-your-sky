/**
 * R8 (FR-WX-1..5, FR-LOC-3, US-7): the Neuquén flow with the Open-Meteo
 * forecast routed to the recorded response — every card and the Now panel
 * wear a cloud badge computed from it, the tooltip states the thresholds and
 * the provider, and every time on screen is in `America/Argentina/Salta`,
 * the zone the response carries. The page clock is the fixture's own fetch
 * time so the 24 h window lies inside the three days the response covers.
 * With the Open-Meteo route aborted (FR-X-4, US-7 AC4) the list still
 * renders, every badge reads unknown and times stay in UTC.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  observer: { lat: number; lon: number };
}
interface ForecastMeta {
  fetchedAt: string;
  cell: { lat: number; lon: number };
}

const OMM_DATE = '2026-09-02';
const FORECAST = '2026-09-02-neuquen-forecast';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const meta = JSON.parse(readFileSync(`tests/fixtures/open-meteo/${FORECAST}.meta.json`, 'utf8')) as ForecastMeta;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;
const ZONE = 'America/Argentina/Salta';
const STATES = ['clear', 'partly', 'obscured'];

/** What `lib/timeFormat` prints for `t` in `zone`: "2026-09-02 21:05:10 GMT-3" (same Intl data in Node and Chromium). */
function localStamp(t: number, zone: string): string {
  const p = new Map(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(t).map((x) => [x.type, x.value]));
  return `${p.get('year') ?? ''}-${p.get('month') ?? ''}-${p.get('day') ?? ''} ${p.get('hour') ?? ''}:${p.get('minute') ?? ''}:${p.get('second') ?? ''} ${p.get('timeZoneName') ?? ''}`;
}

test.beforeEach(async ({ page }) => {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
});

test('badges from the recorded forecast on every card and the Now panel, times in America/Argentina/Salta', async ({ page }) => {
  const t = Date.parse(meta.fetchedAt);
  await page.clock.setFixedTime(t);
  const forecastRequests: URL[] = [];
  await page.route('https://api.open-meteo.com/**', async (route) => {
    forecastRequests.push(new URL(route.request().url()));
    await route.fulfill({ path: `tests/fixtures/open-meteo/${FORECAST}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });

  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(NEUQUEN);
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/\d+ visible passes in the next 24 h/, { timeout: 15_000 });

  // FR-WX-1 / PLAN §7.3: one request, for the 0.1° cell, with exactly the four hourly variables over three days.
  expect(forecastRequests).toHaveLength(1);
  const [req] = forecastRequests;
  expect(req?.searchParams.get('latitude')).toBe(meta.cell.lat.toFixed(1));
  expect(req?.searchParams.get('longitude')).toBe(meta.cell.lon.toFixed(1));
  expect(req?.searchParams.get('hourly')?.split(',')).toEqual(['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high']);
  expect(req?.searchParams.get('forecast_days')).toBe('3');
  expect(req?.searchParams.get('timezone')).toBe('auto');
  expect(req?.searchParams.get('timeformat')).toBe('unixtime');

  // Every card: a three-state badge (never unknown: the window lies inside the response) and a start time in the Salta zone.
  const cards = page.locator('article[data-pass-id]');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const badge = card.locator('[data-state]');
    await expect(badge).toHaveCount(1);
    expect(STATES).toContain(await badge.getAttribute('data-state'));
    await expect(badge).toHaveText(/^(Clear|Partly cloudy|Likely obscured), \d+ % cloud$/);
    const startMs = Number((await card.getAttribute('data-pass-id'))?.split('-')[1]);
    await expect(card).toContainText(`Start${localStamp(startMs, ZONE)}`);
    await expect(card).toContainText('GMT-3');
    await expect(card).not.toContainText('UTC');
  }

  // US-7 AC2/AC3: the tooltip opens from the keyboard and states the thresholds, the provider and the fetch time.
  const firstBadge = cards.first().locator('[data-state]');
  await firstBadge.focus();
  const tip = cards.first().getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Clear below 30 %, partly cloudy 30–70 %, likely obscured above 70 %');
  await expect(tip).toContainText(`Forecast by Open-Meteo, fetched ${localStamp(t, ZONE)}`);

  // FR-WX-3: the Now panel shows the current cloud cover, and its "as of" time is local too.
  const panel = page.getByRole('region', { name: 'Right now' });
  await expect(panel).toContainText(/Clouds now: ?\[?(Clear|Partly cloudy|Likely obscured), \d+ % cloud/);
  await expect(panel).toContainText(`as of ${localStamp(t, ZONE).slice(11)}`);
});

test('with Open-Meteo unreachable the list still renders, every badge reads unknown and times stay in UTC (FR-X-4, US-7 AC4)', async ({ page }) => {
  const t = Date.parse(meta.fetchedAt);
  await page.clock.setFixedTime(t);
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));

  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(NEUQUEN);
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/\d+ visible passes in the next 24 h/, { timeout: 15_000 });

  const cards = page.locator('article[data-pass-id]');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  const badges = page.locator('article[data-pass-id] [data-state]');
  await expect(badges).toHaveCount(count);
  for (let i = 0; i < count; i++) {
    await expect(badges.nth(i)).toHaveAttribute('data-state', 'unknown');
    await expect(badges.nth(i)).toHaveText('Weather unknown');
    await expect(cards.nth(i)).toContainText(' UTC');
  }
  const panel = page.getByRole('region', { name: 'Right now' });
  await expect(panel).toContainText('Weather unknown');
  await expect(panel).toContainText(`as of ${new Date(t).toISOString().slice(11, 19)} UTC`);
});
