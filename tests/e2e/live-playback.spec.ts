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
import { domeDrawn, homeAt, realTimeField, setThemeOnHome, stripFilled, T } from './liveHelpers';

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
const speedButton = (page: Page, factor: number) => page.getByRole('button', { name: new RegExp(`^(\\[[ x]\\] )?\\[?${String(factor)}×\\]?$`) });

/** Presses a row (the stripe, or R70's overview) `fraction` of the way along and lets go. */
async function pressRow(page: Page, testId: 'time-stripe' | 'stripe-overview', fraction: number): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

/** The four hours the stripe is drawing (R70, FR-SPAN-1): what it says it is drawing. */
async function drawn(page: Page): Promise<{ start: number; end: number }> {
  const stripe = page.getByTestId('time-stripe');
  return { start: Number(await stripe.getAttribute('data-drawn-start')), end: Number(await stripe.getAttribute('data-drawn-end')) };
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

    // R70 (FR-SPAN-2): halfway along the *overview* is twelve hours on — the stripe below draws four — and
    // the strip's time, the count and the hash follow.
    await pressRow(page, 'stripe-overview', 0.5);
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

  /**
   * R70 (FR-SPAN-1, FR-SPAN-4, US-24 AC4, AC6; US-22 AC6 as amended): from real time, one tap on `pass ▶|`
   * puts the shown instant on the next pass's rise to the second and the stripe redraws around it. This is a
   * *pointer*: on the old code the row was behind `pageHasTouch()` and this viewport has no touch, so the
   * control was not on the page at all — and the stripe drew all 24 h, where the same tap left it.
   */
  test('one tap on `pass ▶|` lands on the rise and the stripe redraws around it, on a pointer (FR-SPAN-4)', async ({ page }) => {
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    // FR-SPAN-1: the stripe draws four hours of the span, not the span.
    const first = await drawn(page);
    const span = { start: Number(await page.getByTestId('time-stripe').getAttribute('aria-valuemin')), end: Number(await page.getByTestId('time-stripe').getAttribute('aria-valuemax')) };
    expect(span.end - span.start).toBe(24 * HOUR);
    expect(first.end - first.start).toBeLessThanOrEqual(4 * HOUR);
    expect(first.start).toBeGreaterThanOrEqual(span.start);

    await page.getByRole('button', { name: 'Next pass' }).click();
    await page.clock.runFor(300);
    // The pass it landed on is the live one in the legend, and its id carries its rise (D-56).
    const passId = (await page.getByTestId('live-dome').getByTestId('chart-legend').locator('button[data-state="live"]').first().getAttribute('data-pass-id')) ?? '';
    const rise = Number(passId.split('-')[1]);
    expect(Math.abs((await shownInstant(page)) - rise)).toBeLessThanOrEqual(1000);
    // …and the tap that found the pass is the tap that drew it: the chunk moved with the instant.
    const after = await drawn(page);
    expect(after.start).toBeLessThanOrEqual(rise);
    expect(after.end).toBeGreaterThanOrEqual(rise);
    expect(after.start).toBeGreaterThan(first.start);
    // The overview brackets exactly what the stripe draws, and the pass is a segment on the stripe now.
    await expect(page.getByTestId('stripe-overview')).toHaveAttribute('data-chunk-start', String(after.start));
    await expect(page.getByTestId('time-stripe').locator(`[data-pass-segment="${passId}"]`)).toHaveAttribute('data-current', 'true');
    /*
     * US-24 AC3: the chunk arrows move the instant four hours and the drawing goes with them. The pass this
     * fixture lands on is late in the span — under four hours from its end — so forward is FR-LIVE-4's clamp
     * and back is the four hours; both are the one `stepTo` (D-190).
     */
    const landed = await shownInstant(page);
    await page.getByRole('button', { name: 'Forward four hours' }).click();
    await page.clock.runFor(300);
    expect(await shownInstant(page)).toBe(Math.min(landed + 4 * HOUR, span.end));
    await page.getByRole('button', { name: 'Back four hours' }).click();
    await page.clock.runFor(300);
    const back = await shownInstant(page);
    expect(back).toBe(Math.min(landed + 4 * HOUR, span.end) - 4 * HOUR);
    const window_ = await drawn(page);
    expect(window_.start).toBeLessThanOrEqual(back);
    expect(window_.end).toBeGreaterThanOrEqual(back);
  });

  /**
   * R70 (FR-SPAN-5, FR-SPAN-6): playback crosses a boundary on its own at 60× — the chunk changes, `t` does
   * not — and at 3600× the stripe draws the whole 24 h instead, because a chunk that lasts four seconds
   * re-labels faster than it can be read. Pausing gives the chunk back. FR-LIVE-5's rate holds at both:
   * the instant advances by wall time × speed, which is what the frames it draws are measured by.
   */
  test('playback carries the chunk across its boundaries, and draws the whole span at 3600× (FR-SPAN-5, FR-SPAN-6)', async ({ page }) => {
    await homeAt(page, T);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    const before = await drawn(page);
    // 60×: an hour a minute. Four seconds of wall time is four minutes of shown time, so the boundary is
    // crossed by running to it — the first chunk is clipped to real time, so it is minutes away, not hours.
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByTestId('live-speed')).toHaveText('Speed 60×');
    await page.clock.runFor(4000);
    expect(await shownInstant(page)).toBeGreaterThan(T + 3 * 60_000);
    // Still a chunk, and still clipped to the span at its start: 60× is under the line (FR-SPAN-6).
    const playing = await drawn(page);
    expect(playing.end - playing.start).toBeLessThanOrEqual(4 * HOUR);
    expect(playing.end).toBe(before.end);

    // 3600×: the whole span, with no animation and without moving the instant.
    await speedButton(page, 3600).click();
    await page.clock.runFor(100);
    const held = await shownInstant(page);
    const whole = await drawn(page);
    expect(whole.end - whole.start).toBe(24 * HOUR);
    expect(whole.start).toBe(Number(await page.getByTestId('time-stripe').getAttribute('aria-valuemin')));
    expect(Math.abs((await shownInstant(page)) - held)).toBeLessThan(2 * 60_000);
    // FR-LIVE-5's rate at 3600×: two seconds of wall time is two hours of shown time.
    const from = await shownInstant(page);
    await page.clock.runFor(2000);
    const advanced = await shownInstant(page);
    expect(advanced - from).toBeGreaterThan(1.8 * HOUR);
    expect(advanced - from).toBeLessThan(2.2 * HOUR);
    // Pausing gives the chunk back, at the instant playback reached.
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.clock.runFor(300);
    const paused = await drawn(page);
    expect(paused.end - paused.start).toBeLessThanOrEqual(4 * HOUR);
    expect(paused.start).toBeLessThanOrEqual(advanced);
    expect(paused.end).toBeGreaterThanOrEqual(advanced);
  });

  test('the hidden-objects toggle draws dimmed objects with a reason and survives a reload (FR-LIVE-6)', async ({ page }) => {
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    const toggle = page.getByRole('button', { name: 'Hidden objects' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const dome = page.getByTestId('live-dome');
    await expect(dome.locator('[data-hidden-id]')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // The worker answers off the fake clock; the dome relabels on its next frame.
    // R45 (FR-LEG-1): the drawing carries the dimmed position and a key; the reason is the legend's row.
    const hidden = dome.locator('[data-hidden-id]');
    await expect
      .poll(async () => {
        await page.clock.runFor(200);
        return hidden.count();
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await expect(hidden.first()).toHaveText(/^[A-Z]$/);
    const rows = dome.getByTestId('chart-legend').locator('button[data-state="hidden-object"]');
    await expect(rows.first()).toHaveText(/ · (too low|in shadow|daylight|too faint)$/);
    // The ISS is on its arc, so it is not among the dimmed (D-102).
    await expect(rows.filter({ hasText: 'ISS' })).toHaveCount(0);

    await page.reload();
    await domeDrawn(page);
    await expect(page.getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Hidden objects' }).click();
    await expect(page.getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('live-dome').locator('[data-hidden-id]')).toHaveCount(0);
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
  await pressRow(page, 'stripe-overview', 3 / 24);
  await page.getByRole('button', { name: locale === 'es' ? 'Objetos ocultos' : 'Hidden objects' }).click();
  await page.clock.runFor(1500);
}

for (const width of [390, 1280] as const) {
  test(`captures at ${String(width)} px, in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await homeAt(page, T, 'en', true);
    await scrubbedWithHidden(page, 'en');
    await page.screenshot({ path: `docs/screenshots/r33-live-${String(width)}-dark-en.png` });
    // R48 (D-244): the theme is switched on the home page, since the compact live page carries no switch.
    await page.keyboard.press('Escape');
    await setThemeOnHome(page, 'en', 'night');
    await scrubbedWithHidden(page, 'en');
    await page.clock.runFor(500);
    await page.screenshot({ path: `docs/screenshots/r33-live-${String(width)}-night-en.png` });
    await page.keyboard.press('Escape');
    await setThemeOnHome(page, 'en', 'dark');
  });
}

test('captures in Spanish at 390 px: no English on the page (FR-I18N-2)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await homeAt(page, T, 'es', true);
  await scrubbedWithHidden(page, 'es');
  await expect(page.getByRole('group', { name: 'Reproducción', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ahora' })).toBeVisible();
  await expect(page.getByTestId('time-stripe')).toHaveAttribute('aria-label', 'Franja de tiempo: cuatro de las próximas 24 horas');
  await expect(page.getByTestId('stripe-overview')).toHaveAttribute('aria-label', 'Vista de la noche');
  await page.screenshot({ path: 'docs/screenshots/r33-live-390-dark-es.png' });
});

/**
 * R70's own record (FR-SPAN-7, FR-COMP-6): the compact page and the wide page with the overview, the chunk
 * and the new row, in both themes and both languages; and FR-SPAN-6's whole-span state at 1280 × 800, so the
 * two spans are on the record side by side.
 */
const CHUNK_LABEL = { en: 'Night overview', es: 'Vista de la noche' } as const;

for (const width of [390, 1280] as const) {
  for (const theme of ['dark', 'night'] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`R70 captures at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await homeAt(page, T, locale, true);
        if (theme === 'night') {
          await setThemeOnHome(page, locale, 'night');
        }
        await page.getByTestId('live-link').click();
        await domeDrawn(page);
        await stripFilled(page);
        // Three hours on: the cursor is inside the night, and the chunk drawn is the one that holds it.
        await pressRow(page, 'stripe-overview', 3 / 24);
        await page.clock.runFor(600);
        await expect(page.getByTestId('stripe-overview')).toHaveAttribute('aria-label', CHUNK_LABEL[locale]);
        await expect(page.getByTestId('step-controls')).toBeVisible();
        const window_ = await drawn(page);
        expect(window_.end - window_.start).toBeLessThanOrEqual(4 * HOUR);
        await page.screenshot({ path: `docs/screenshots/r70-live-${String(width)}-${theme}-${locale}.png` });
      });
    }
  }
}

test('R70 capture: FR-SPAN-6s whole span at 1280 × 800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await homeAt(page, T, 'en', true);
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
  await speedButton(page, 3600).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.runFor(2000);
  const window_ = await drawn(page);
  expect(window_.end - window_.start).toBe(24 * HOUR);
  await page.screenshot({ path: 'docs/screenshots/r70-live-1280-whole-span.png' });
});
