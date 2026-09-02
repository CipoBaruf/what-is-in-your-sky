/**
 * R5 (FR-VIS-4, spec §5.6): the pass list renders progressively as the
 * worker streams each object's passes, the ISS card first; and changing the
 * coordinates mid-stream leaves only the second location's cards. The worker
 * script is served through a throttled route so the page is visibly
 * "computing" (responsive, no cards) before the first card lands. A
 * MutationObserver installed before the app boots records every distinct set
 * of card ids the DOM went through, which is how progressive rendering is
 * proven rather than eyeballed.
 */
/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}

declare global {
  interface Window {
    __cardLog?: string[][];
  }
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;
const PARIS = '48.86, 2.35';
const WORKER_DELAY_MS = 1_500;

test('cards appear one at a time with the ISS first; a location change mid-stream leaves only the new location’s cards', async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.addInitScript(() => {
    window.__cardLog = [];
    const observer = new MutationObserver(() => {
      const ids = Array.from(document.querySelectorAll('article[data-pass-id]')).map((el) => el.getAttribute('data-pass-id') ?? '');
      const last = window.__cardLog?.at(-1);
      if (!last || last.join('|') !== ids.join('|')) window.__cardLog?.push(ids);
    });
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pass-id'] });
    });
  });
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  // Throttled worker route: the worker script arrives late, so the page must stay responsive without it.
  let workerRequests = 0;
  await page.route(/\/assets\/passes\.worker-.*\.js$/, async (route) => {
    workerRequests++;
    await new Promise((r) => setTimeout(r, WORKER_DELAY_MS));
    await route.continue();
  });

  await page.goto('/');
  const status = page.getByRole('status');
  const input = page.getByLabel('Coordinates (lat, lon)');
  await input.fill(NEUQUEN);

  // Main thread free while the worker is still loading: status says computing, no cards yet, input still editable.
  await expect(status).toHaveText(/Computing passes…/);
  await expect(page.locator('article[data-pass-id]')).toHaveCount(0);
  await expect(status).toHaveAttribute('aria-busy', 'true');

  // The first card rendered is the ISS (the list is chronological, so the DOM log, not `.first()`, tells the render order).
  await page.waitForFunction(() => (window.__cardLog ?? []).some((ids) => ids.length > 0), undefined, { timeout: 15_000 });
  const firstLog = (await page.evaluate(() => window.__cardLog ?? [])).filter((ids) => ids.length > 0);
  expect(firstLog[0]).toHaveLength(1);
  expect(firstLog[0]?.[0]).toMatch(/^25544-/);
  await expect(page.getByRole('article', { name: 'ISS (Zarya)' })).toBeVisible();

  // Change the location while the first job is streaming.
  await input.fill(PARIS);
  const neuquenIds = new Set((await page.evaluate(() => window.__cardLog ?? [])).flat());
  expect(neuquenIds.size).toBeGreaterThan(0);

  await expect(status).toHaveText(new RegExp(`\\d+ visible passes in the next 24 h from ${PARIS}`), { timeout: 15_000 });
  const finalIds = await page.locator('article[data-pass-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-pass-id')));
  expect(finalIds.length).toBeGreaterThan(0);
  for (const id of finalIds) expect(neuquenIds.has(id ?? '')).toBe(false);
  await expect(page.getByRole('article', { name: 'ISS (Zarya)' })).toHaveCount(finalIds.filter((id) => id?.startsWith('25544-')).length);

  // Progressive rendering: the DOM went through several distinct card sets on the way to the final one.
  const log = await page.evaluate(() => window.__cardLog ?? []);
  const parisSteps = log.filter((ids) => ids.length > 0 && ids.every((id) => !neuquenIds.has(id)));
  expect(parisSteps.length).toBeGreaterThan(1);
  expect(parisSteps.at(-1)).toEqual(finalIds);
  // Once the switch happened, no later DOM state mixed the two locations.
  const switchIndex = log.findIndex((ids) => ids.length > 0 && ids.every((id) => !neuquenIds.has(id)));
  for (const ids of log.slice(switchIndex)) expect(ids.some((id) => neuquenIds.has(id))).toBe(false);
  expect(workerRequests).toBe(1);
});
