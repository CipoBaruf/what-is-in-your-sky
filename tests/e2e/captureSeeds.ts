/**
 * P4 (FR-SHOW-6, D-653): what the v1 capture set seeds, shared with the
 * recording run. `v1-captures.spec.ts` shot the set off these for six phases
 * and kept them to itself; `promo-record.spec.ts` records the same screens on
 * the same night, so the two must not carry two copies of "the Paris moment"
 * that could drift apart. The constants, the seed and the two waits every
 * chart screen makes are here; the routes to the screens stay in the capture
 * spec, because a route is what a capture is *of* and a recording walks its
 * own.
 *
 * One night: 2026-09-02 over Paris, the elements seven hours old (D-179). The
 * rest of the suite runs at Neuquén nine days on, where the golden ISS pass
 * is; a capture cannot, because nine days puts FR-SAT-4's staleness warning
 * across the home. Over Paris the same fixtures have an ISS pass fifty minutes
 * ahead at `CLOCK`, so one place and one night carry every screen. What it
 * costs is the weather: the only forecast in the fixtures is over Neuquén, so
 * every cloud badge here reads "weather unknown" (the FR-WX-1 fallback).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { FIXTURE_DATE, PARIS_NIGHT } from './observers';

export const DAY_MS = 86_400_000;
const PREFS_KEY = 'wiys:prefs:v1';

/** The pass the Moon stands 8° from (`live-captures.spec.ts`, R22), and the night the whole set is shot on. */
export const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
export const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
/** 2026-09-02 03:00 UTC; the number lives in `observers.ts` so the stored-run script can compute the recording run's list at it (P4). */
export const CLOCK = PARIS_NIGHT;
/** Three minutes into a six-minute pass: the marker near the peak, half the arc behind it (FR-DOME-5's two colours). */
export const SHOWN = GLARE_PASS_START + 180_000;
/** The ten-second tick the strip reads the clock at (FR-VIS-5). */
export const TICK_MS = 10_000;

export const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

export interface SeedPrefs {
  locale: 'en' | 'es';
  theme: 'dark' | 'night';
  observer?: Observer;
  chartView?: 'dome' | 'polar';
  favourites?: { cellKey: string; observer: Observer; addedAt: number; lastUsedAt: number }[];
  /** FR-LIVE-6: the hidden-objects toggle's saved state, which the legend screen wants on. */
  liveHidden?: boolean;
}

/**
 * The preferences already in storage before the first paint (D-70): the
 * locale and the theme go into `wiys:prefs:v1` from an init script and
 * `main.tsx` writes `lang` and `data-theme` from them, so no run ever clicks a
 * toggle whose label is in the language under test.
 */
async function seedPrefs(page: Page, prefs: SeedPrefs): Promise<void> {
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as [string, string],
  );
}

/** The elements from the fixtures, and nothing else: no forecast over Paris, and no geocoder, since every observer here is a coordinate pair. */
async function stubNetwork(page: Page): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
}

/** A page on the paused clock at `time`, with the preferences already in storage and the network stubbed. Called once per test, before the first `goto`. */
export async function seedPage(page: Page, prefs: SeedPrefs, time = CLOCK): Promise<void> {
  await seedPrefs(page, prefs);
  await stubNetwork(page);
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
export const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

/**
 * The list, settled, asked in neither language: the ISS hero card is up, the
 * 72 h search has stopped (nothing is left `aria-busy`) and the passes are
 * grouped by night. Every wait here is on a `data-testid` or an ARIA state, so
 * the English and the Spanish run take the same path.
 */
export async function listSettled(page: Page): Promise<void> {
  await expect(page.locator('article[data-pass-card]', { has: page.getByTestId('next-tag') })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  expect(await page.getByTestId('night-group').count()).toBeGreaterThan(0);
  // The readiness line appears once the finished run has been stored (FR-OFF-4), which is a
  // beat after the search itself ends: without this wait two runs of the same capture
  // disagree about whether the location block has a line under it.
  await expect(page.getByTestId('readiness')).toBeVisible({ timeout: 60_000 });
  // The pointer is wherever the last action left it, and a cloud badge under it opens its tooltip over the capture.
  await page.mouse.move(0, 0);
}

/**
 * F-48 (R37): every capture is shot at its instant, on the dot.
 *
 * Waiting for a drawn chart means ticking the paused clock (`domeDrawn`), and
 * how many ticks that takes is a property of the run, not of the picture: R36's
 * live captures were shot wherever the last tick left the clock, so the time
 * field and the marker moved between two runs of the same file. So the waiting
 * is done first and the clock is only then put where the capture wants it —
 * one tick short of the instant, then a tick, which is how the page arrives at
 * a new `now` in the app as well (`NOW_TICK_MS`).
 *
 * F-99 (V21-24, D-642): the tick is a `fastForward`, not a `runFor`. `runFor`
 * fires every interval on its own phase, and a 1 s interval's phase (the
 * next-event countdown, the instant `[ scrub ]` holds) was set by how many
 * ticks the waiting took. It last fired anywhere in the second before `t`, so
 * two runs showed the instant a second apart. `fastForward` fires each due
 * timer once, at `t`, so every clock on the page reads `t` whatever the wait
 * left behind.
 */
export async function pinnedAt(page: Page, t: number): Promise<void> {
  await page.clock.setSystemTime(t - TICK_MS);
  await page.clock.fastForward(TICK_MS);
}
