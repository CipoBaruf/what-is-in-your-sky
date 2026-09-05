/**
 * R33 (FR-LIVE-4, FR-LIVE-5, FR-LIVE-6; US-15 AC3, AC4, AC6) on the production
 * build, with the R1 fixtures at Neuquén and the clock installed ten seconds
 * into the golden ISS pass:
 *
 *   - the stripe spans now to now + 24 h with the passes on it; a press
 *     moves the shown instant and the strip, the marker and the hash follow;
 *     the arrow keys step a minute and ten;
 *   - play runs the instant forward at the chosen speed, the strip names the
 *     speed, pause holds, and `now` returns to real time on the tick;
 *   - the hidden-objects toggle draws dimmed objects with a reason, and its
 *     state survives a reload;
 *   - the captures the PR carries, at both widths, in both themes, and in
 *     Spanish at the phone width.
 *
 * Playwright's installed clock drives `requestAnimationFrame` too, so
 * `runFor` is playback's wall time.
 */
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, homeAt, LABEL, realTimeField, stripFilled, T } from './liveHelpers';

const HOUR = 3_600_000;

/** The time field's instant: the `<time>` element's `datetime`. */
const shownInstant = async (page: Page): Promise<number> => Date.parse((await page.getByTestId('live-time').locator('time').getAttribute('datetime')) ?? '');

/**
 * R39 (F-37): a speed button, named exactly. A `name` option is a substring
 * match, so `60×` also named `600×` and `3600×` — three buttons, a strict-mode
 * failure the moment it was clicked, and the `60×` half of the test below never
 * ran. `exact` is not the answer either: the accessible name carries the
 * `[ ]`/`[x]` the CSS writes before the label (FR-X-5), so an anchored pattern
 * is what names one button and only one.
 */
const speedButton = (page: Page, factor: number) => page.getByRole('button', { name: new RegExp(`^\\[[ x]\\] ${String(factor)}×$`) });

/** Presses the stripe `fraction` of the way along and lets go. */
async function pressStripe(page: Page, fraction: number): Promise<void> {
  const box = await page.getByTestId('time-stripe').boundingBox();
  if (!box) throw new Error('the stripe has no box');
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test.describe('the live page: stripe, playback and hidden objects', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the stripe scrubs the shown instant, the arrow keys step it, and the hash follows (FR-LIVE-4, FR-LIVE-9)', async ({ page }) => {
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    const stripe = page.getByTestId('time-stripe');
    await expect(stripe).toHaveAttribute('role', 'slider');
    // The span starts at real time as the page read it, within the tick `domeDrawn` let run.
    const min = Number(await stripe.getAttribute('aria-valuemin'));
    expect(min - T).toBeGreaterThanOrEqual(0);
    expect(min - T).toBeLessThan(10_000);
    await expect(stripe).toHaveAttribute('aria-valuemax', String(min + 24 * HOUR));
    // The ISS pass under way is a segment on the stripe, the current one.
    await expect(stripe.locator('[data-pass-segment^="25544-"]')).toHaveAttribute('data-current', 'true');
    await expect(stripe.locator('[data-tick]').first()).toBeAttached();
    await expect(page.getByRole('button', { name: 'Now' })).toBeDisabled();

    // Halfway along is twelve hours on: the strip's time, the count and the hash follow.
    await pressStripe(page, 0.5);
    await page.clock.runFor(600);
    const half = await shownInstant(page);
    expect(Math.abs(half - (T + 12 * HOUR))).toBeLessThan(15 * 60_000);
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', '0');
    await expect(page).toHaveURL(/#live\?lat=-38\.93&lon=-67\.99&alt=0&t=2026-09-1\dT\d\d:\d\d/);
    await expect(page.getByRole('button', { name: 'Now' })).toBeEnabled();

    // The arrow keys: one minute, ten with Shift.
    await stripe.focus();
    await page.keyboard.press('ArrowRight');
    expect(await shownInstant(page)).toBe(half + 60_000);
    await page.keyboard.press('Shift+ArrowLeft');
    expect(await shownInstant(page)).toBe(half - 9 * 60_000);

    // The hash is written at most twice a second while scrubbing: many steps, few writes.
    await page.evaluate(() => {
      (window as unknown as { __hashWrites: number }).__hashWrites = 0;
      const original = history.replaceState.bind(history);
      history.replaceState = (...args: Parameters<History['replaceState']>) => {
        (window as unknown as { __hashWrites: number }).__hashWrites++;
        original(...args);
      };
    });
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowRight');
      await page.clock.runFor(25);
    }
    await page.clock.runFor(600);
    expect(await page.evaluate(() => (window as unknown as { __hashWrites: number }).__hashWrites)).toBeLessThanOrEqual(3);

    // `now` returns to real time and the bare route.
    await page.getByRole('button', { name: 'Now' }).click();
    await page.clock.runFor(600);
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
    await expect(page).toHaveURL(/#live$/);
  });

  test('play advances the instant by wall time × speed, the strip names the speed, pause holds, now returns (FR-LIVE-5)', async ({ page }) => {
    await homeAt(page, T);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    await expect(page.getByTestId('live-speed')).toHaveCount(0);
    await expect(speedButton(page, 60)).toHaveCount(1);
    await speedButton(page, 3600).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByTestId('live-speed')).toHaveText('Speed 3600×');
    // Two seconds of wall time at 3600× is two hours — within a frame's worth either way.
    await page.clock.runFor(2000);
    const afterPlay = await shownInstant(page);
    expect(afterPlay - T).toBeGreaterThan(1.8 * HOUR);
    expect(afterPlay - T).toBeLessThan(2.2 * HOUR);
    // Nothing was written to the hash while playing.
    await expect(page).toHaveURL(/#live$/);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByTestId('live-speed')).toHaveCount(0);
    const paused = await shownInstant(page);
    await page.clock.runFor(1000);
    expect(await shownInstant(page)).toBe(paused);
    // Paused: the held instant is in the hash.
    await expect(page).toHaveURL(/#live\?lat=-38\.93&lon=-67\.99&alt=0&t=/);
    // Play again at 60×: one second is one minute.
    await speedButton(page, 60).click();
    await expect(speedButton(page, 60)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.clock.runFor(1000);
    const later = await shownInstant(page);
    expect(later - paused).toBeGreaterThan(50_000);
    expect(later - paused).toBeLessThan(70_000);
    await page.getByRole('button', { name: 'Now' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T + 4000));
  });

  test('the hidden-objects toggle draws dimmed objects with a reason and survives a reload (FR-LIVE-6)', async ({ page }) => {
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    const toggle = page.getByRole('button', { name: 'Hidden objects' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('live-dome').locator('[data-anchor="hidden"]')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // The worker answers off the fake clock; the dome relabels on its next frame.
    const hidden = page.getByTestId('live-dome').locator('[data-anchor="hidden"]');
    await expect
      .poll(async () => {
        await page.clock.runFor(200);
        return hidden.count();
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await expect(hidden.first()).toHaveText(/ · (too low|in shadow|daylight|too faint)$/);
    // The ISS is on its arc, so it is not among the dimmed (D-102).
    await expect(page.getByTestId('live-dome').locator('[data-anchor="hidden"]', { hasText: 'ISS' })).toHaveCount(0);

    await page.reload();
    await domeDrawn(page);
    await expect(page.getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Hidden objects' }).click();
    await expect(page.getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('live-dome').locator('[data-anchor="hidden"]')).toHaveCount(0);
  });
});

/**
 * The captures for the PR: the live page with the stripe and the controls, the
 * instant scrubbed three hours on so the cursor sits inside the night and the
 * hidden objects on, at both widths, in both themes, and in Spanish at the
 * phone width.
 */
async function scrubbedWithHidden(page: Page, locale: 'en' | 'es'): Promise<void> {
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
  await pressStripe(page, 3 / 24);
  await page.getByRole('button', { name: locale === 'es' ? 'Objetos ocultos' : 'Hidden objects' }).click();
  await page.clock.runFor(1500);
}

for (const width of [390, 1280] as const) {
  test(`captures at ${String(width)} px, in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await homeAt(page, T, 'en', true);
    await scrubbedWithHidden(page, 'en');
    await page.screenshot({ path: `docs/screenshots/r33-live-${String(width)}-dark-en.png` });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.night }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.clock.runFor(500);
    await page.screenshot({ path: `docs/screenshots/r33-live-${String(width)}-night-en.png` });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.dark }).click();
  });
}

test('captures in Spanish at 390 px: no English on the page (FR-I18N-2)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await homeAt(page, T, 'es', true);
  await scrubbedWithHidden(page, 'es');
  await expect(page.getByRole('group', { name: 'Reproducción', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ahora' })).toBeVisible();
  await expect(page.getByTestId('time-stripe')).toHaveAttribute('aria-label', 'Franja de tiempo: las próximas 24 horas');
  await page.screenshot({ path: 'docs/screenshots/r33-live-390-dark-es.png' });
});
