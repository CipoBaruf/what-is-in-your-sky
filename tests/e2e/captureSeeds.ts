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
 * P8 (FR-SHOW-9, FR-SHOW-10; D-684): one night, the showcase's — Bariloche,
 * the geocoder's first answer for `bariloche` as the app builds it, 5 to 6
 * September 2026, over the same 2026-09-02 elements and with the forecast
 * recorded for its cell. The observer carries its zone, so every clock reads
 * `GMT-3`; the elements are four days old, short of FR-SAT-4's five; and the
 * cloud badges read the forecast. It replaces D-179's Paris night, whose ISS
 * pass came at the price of "weather unknown" on every badge and UTC on every
 * clock. What the night does not hold: the ISS (its visible season over
 * northern Patagonia starts on the 11th), so no card carries the `Next ISS`
 * tag, and a pass the app flags with Moon glare (the Moon is a 27 % crescent
 * low in the north-east, 8° from the 05:48 pass and not flagged), so the chart
 * screens are of the night's brightest pass instead.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { SHOWCASE_NIGHT } from './observers';
import { BRIGHTEST_PASS, SHOWCASE_SHOWN } from './promoFlows';

export const DAY_MS = 86_400_000;
const PREFS_KEY = 'wiys:prefs:v1';

/**
 * The pass the chart screens are of: the night's brightest, Tiangong rising at
 * 07:20:47 local on the 6th, peak −2.1 at 48°, in twilight — the recordings'
 * desk pass (D-683). D-684 asked for a glare pass first; the stored run has
 * none on the night (every `moonGlare.glare` is false), so the glare state is
 * absent from the set and this is the pass the old `GLARE_PASS` screens are
 * shot on.
 */
export const SHOWN_PASS_START = BRIGHTEST_PASS.start;
export const SHOWN_PASS = BRIGHTEST_PASS.id;
/** 05:00 local on the 6th, 48 minutes before the night's first bright pass (D-690). */
export const CLOCK = SHOWCASE_NIGHT;
/** Three minutes into a six-minute pass: the marker near the peak, half the arc behind it (FR-DOME-5's two colours). */
export const SHOWN = SHOWCASE_SHOWN;
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

/**
 * A page on the paused clock at `time`, with the preferences already in storage. Called once per test, before the
 * first `goto`. P8 (D-684): the network is the capture spec's `stubNetwork(page, 'fixtures', 'showcase')` —
 * `liveHelpers.ts`'s, the recordings' — so this module no longer carries a copy that refused the forecast.
 */
export async function seedPage(page: Page, prefs: SeedPrefs, time = CLOCK): Promise<void> {
  await seedPrefs(page, prefs);
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
export const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

/**
 * The list, settled, asked in neither language: a card is up, the 72 h search
 * has stopped (nothing is left `aria-busy`) and the passes are grouped by
 * night. Every wait here is on a `data-testid` or an ARIA state, so the
 * English and the Spanish run take the same path. P8: it waited for the ISS's
 * `Next` tag until the showcase night, which has no ISS pass (FR-SHOW-9).
 */
export async function listSettled(page: Page): Promise<void> {
  await expect(page.locator('article[data-pass-card]').first()).toBeVisible({ timeout: 60_000 });
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
