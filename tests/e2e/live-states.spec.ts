/**
 * R77 (FR-WATCH-1, FR-WATCH-2, FR-WATCH-4, FR-WATCH-9 b; US-27 AC1..AC4): the live page's two states in a real
 * browser. The page opens **watching** — the next event as its headline, the indicator saying `live`, the
 * overview as its only timeline, and no stripe, step row or playback row in the document — and `[ scrub ]`
 * holds the instant on screen and brings them out. A pass is stepped to with `pass ▶|`, playback runs at 60×,
 * and `[ back to live ]` puts the block away, returns the page to real time and takes the instant out of the
 * URL, so a link shared after it claims no held moment.
 *
 * At 390 × 844 and 1280 × 800 here; R78 extends the same spec to the landscape phone (844 × 390) and the short
 * wide window (1200 × 450), where the drawing's box must not move between the states.
 */
import { expect, test, type Page } from '@playwright/test';
import { backToLive, domeDrawn, enterScrubbing, homeAt, stripFilled, T } from './liveHelpers';

/** A speed button named exactly — the name is a substring match otherwise, and `60×` would name three (F-37). */
const speedButton = (page: Page, factor: number) => page.getByRole('button', { name: new RegExp(`^(\\[[ x]\\] )?\\[?${String(factor)}×\\]?$`) });

/** The shown instant, as the stripe's slider value says it — the stripe is the scrubbing state's. */
const shown = async (page: Page): Promise<number> => Number(await page.getByTestId('time-stripe').getAttribute('aria-valuenow'));

/** The rows only scrubbing renders (FR-WATCH-4): absent while watching, not merely hidden. */
const SCRUB_ROWS = ['time-row', 'time-stripe', 'step-controls', 'playback-row'] as const;

for (const [width, height] of [
  [390, 844],
  [1280, 800],
] as const) {
  test(`watching, then scrubbing: steps a pass, plays at 60× and returns to live at ${String(width)} × ${String(height)} (FR-WATCH-1, FR-WATCH-9 b)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await homeAt(page, T);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);

    // Watching (US-27 AC1): the next event is the headline, the mark runs beside `live`, the overview is the
    // one timeline, and the scrub block is not in the document at all.
    const indicator = page.getByTestId('live-indicator');
    await expect(indicator).toHaveAttribute('data-state', 'live');
    await expect(indicator).toContainText('live');
    await expect(indicator.getByTestId('mark')).toHaveAttribute('data-mark-running', 'true');
    await expect(page.getByTestId('next-event')).toBeVisible();
    await expect(page.getByTestId('next-event-label')).toHaveText(/^(Next up|Up now) · /);
    await expect(page.getByTestId('overview-row')).toBeVisible();
    for (const id of SCRUB_ROWS) await expect(page.getByTestId(id), `${id} is not rendered while watching`).toHaveCount(0);
    await expect(page.getByTestId('live-now')).toHaveCount(0);
    await expect(page).toHaveURL(/#live$/);

    // `[ scrub ]` (US-27 AC2): the instant on screen is held — the headline is it, `+0 min` from now — and the
    // block comes out. The URL carries the held instant (FR-LIVE-9 unchanged).
    await enterScrubbing(page);
    await expect(indicator).toContainText('held');
    await expect(indicator.getByTestId('mark')).toHaveAttribute('data-mark-running', 'false');
    await expect(page.getByTestId('next-event')).toHaveCount(0);
    for (const id of SCRUB_ROWS) await expect(page.getByTestId(id), `${id} is rendered while scrubbing`).toBeVisible();
    await expect(page.getByTestId('time-readout')).toHaveText(/^\d\d:\d\d · \+0 min$/);
    const held = await shown(page);
    expect(held - T).toBeGreaterThanOrEqual(0);
    expect(held - T).toBeLessThan(10_000);
    await page.clock.runFor(600);
    await expect(page).toHaveURL(/#live\?lat=-38\.93&lon=-67\.99&alt=0&t=/);
    // Real time moves on under a held instant; the instant does not (FR-WATCH-1).
    await page.clock.runFor(3000);
    expect(await shown(page)).toBe(held);

    // `pass ▶|`: one tap to the next rise, and the headline says how far ahead of now it is (US-27 AC3).
    await page.getByRole('button', { name: 'Next pass' }).click();
    const rise = await shown(page);
    expect(rise).toBeGreaterThan(held);
    await expect(page.getByTestId('time-readout')).toHaveText(/ · \+(\d+ min|\d+ h \d\d min)$/);

    // 60×: one second of wall time is a minute of shown time, and it is still the held state.
    await speedButton(page, 60).click();
    await expect(speedButton(page, 60)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.clock.runFor(1000);
    const played = await shown(page);
    expect(played - rise).toBeGreaterThan(50_000);
    expect(played - rise).toBeLessThan(70_000);
    await expect(indicator).toHaveAttribute('data-state', 'held');
    await page.getByRole('button', { name: 'Pause' }).click();

    // `[ back to live ]` (US-27 AC2): the block goes, the instant is real time again and advances on the tick,
    // and the URL is the bare route.
    await backToLive(page);
    await expect(indicator).toContainText('live');
    for (const id of SCRUB_ROWS) await expect(page.getByTestId(id), `${id} is gone with the state`).toHaveCount(0);
    await expect(page.getByTestId('next-event')).toBeVisible();
    await page.clock.runFor(600);
    await expect(page).toHaveURL(/#live$/);
  });
}

/** FR-WATCH-1 c (D-446): the URL is the state — a link with `t` opens scrubbing, a bare one watching, and a reload keeps it. */
test('a #live link with an instant opens scrubbing, and a reload after back to live opens watching (FR-WATCH-1, FR-LIVE-9)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await homeAt(page, T);
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await enterScrubbing(page);
  await page.getByRole('button', { name: 'Next pass' }).click();
  await page.clock.runFor(600);
  const url = page.url();
  expect(url).toMatch(/#live\?lat=.*&t=/);
  await page.reload();
  await domeDrawn(page);
  await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'held');
  await expect(page.getByTestId('time-stripe')).toBeVisible();
  await backToLive(page);
  await page.clock.runFor(600);
  await expect(page).toHaveURL(/#live$/);
  await page.reload();
  await domeDrawn(page);
  await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
  await expect(page.getByTestId('time-stripe')).toHaveCount(0);
});
