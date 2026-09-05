/**
 * R32 (FR-LIVE-1, FR-LIVE-2, FR-LIVE-3, FR-LIVE-9, FR-LIVE-10; US-15 AC1, AC2,
 * AC9) on the production build, with the R1 fixtures at Neuquén and the clock
 * installed ten seconds into the golden ISS pass — the instant `now-panel.spec`
 * pins the Now panel at, so the two counts can be held to each other.
 *
 *   - `#live` fills the viewport with the dome and nothing scrolls; the strip
 *     shows its five fields; the count is the Now panel's; Esc, the return
 *     control, the header and the Now panel each go one way or the other;
 *   - a `#live?…` URL in a fresh context sets the observer (rounded label,
 *     source coords) and the shown instant; a `t` that cannot be read falls
 *     back to real time;
 *   - both inert states are one line and the return control;
 *   - the captures the PR carries, at both widths, in both themes, and in
 *     Spanish at the phone width.
 */
import { expect, test } from '@playwright/test';
import { domeDrawn, golden, ha, hhmmss, homeAt, LABEL, realTimeField, stripFilled, stubNetwork, T } from './liveHelpers';

test.describe('the live page', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fills the viewport with the dome, shows the five fields, and counts what the Now panel counts', async ({ page }) => {
    const panelCount = await homeAt(page, T);
    expect(panelCount).toBe(1);

    await page.getByTestId('live-link').click();
    await expect(page).toHaveURL(/#live$/);
    await domeDrawn(page);

    // FR-LIVE-1: the page is the viewport — as tall as it, and nothing to scroll.
    const box = await page.getByTestId('live-page').boundingBox();
    expect(box?.height).toBe(844);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await expect(page.getByRole('banner')).toHaveCount(0);
    // The dome is the whole width inside the two cells of side padding, and most of the height.
    const dome = await page.getByTestId('live-dome').boundingBox();
    expect(dome?.width).toBeGreaterThan(390 - 4 * 9.6 - 1);
    // R33 (D-172): the stripe and the playback row took their share; 300 px is what the portrait dome keeps, and R34's landscape is the phone's real answer.
    expect(dome?.height).toBeGreaterThan(300);
    // R34 (FR-LIVE-7): portrait still stacks — the side column is under the dome, not beside it (`live-landscape.spec.ts` is the other case).
    const side = await page.getByTestId('live-side').boundingBox();
    expect(side?.y).toBeGreaterThanOrEqual((dome?.y ?? 0) + (dome?.height ?? 0) - 1);
    expect(side?.x).toBeLessThan((dome?.x ?? 0) + 1);
    // R34 (FR-LIVE-8, D-175): no touch screen in this profile, so no phone to follow and no control.
    await expect(page.getByTestId('follow-phone')).toHaveCount(0);

    // FR-LIVE-3: the five fields.
    await stripFilled(page);
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
    await expect(page.getByTestId('live-sky')).toHaveText(/Sky (dark|bright twilight|day)/);
    await expect(page.getByTestId('live-cloud')).toHaveText('Clouds Weather unknown');
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', String(panelCount));
    await expect(page.getByTestId('live-moon')).toHaveText(/Moon (new|waxing crescent|first quarter|waxing gibbous|full|waning gibbous|last quarter|waning crescent), \d+ % lit/);
    // FR-LIVE-2 / FR-LIVE-10: the ISS is drawn on the chart, by the chart, named at its rise. (The search
    // window starts at now, so the pass under way is listed from this instant and its id is not the golden one.)
    await expect(page.getByTestId('live-dome').locator('[data-pass-id]').first()).toBeAttached();
    await expect(page.getByTestId('live-dome').locator('[data-pass-id^="25544-"]')).toHaveCount(1);
    // FR-SHARE-1's live form.
    await expect(page.getByRole('button', { name: 'Share this sky' })).toBeVisible();

    // Esc returns to the home page, with the same observer and no hash.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('live-page')).toHaveCount(0);

    // …and the Now panel's link opens it again; the return control closes it.
    await page.getByTestId('now-live-link').click();
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
    await page.getByRole('button', { name: LABEL.en.back }).click();
    await expect(page.getByRole('region', { name: LABEL.en.now })).toBeVisible();
  });

  test('a #live?… URL sets the observer and the shown instant, and a bad t falls back to real time (FR-LIVE-9)', async ({ page }) => {
    const { peak } = golden();
    await page.clock.install({ time: T });
    await page.clock.pauseAt(T);
    await stubNetwork(page);
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=${new Date(peak).toISOString().replace('.000Z', 'Z')}`);

    // The observer came out of the link: rounded label, no saved location involved (a fresh context has none).
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    await domeDrawn(page);
    // The shown instant is the link's, not the clock's.
    await expect(page.getByTestId('live-time')).toHaveText(`Time ${new Date(peak).toISOString().slice(0, 10)} ${hhmmss(peak)} UTC`);
    // At the peak the ISS is up: one marker, once the passes are in.
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', '1', { timeout: 60_000 });
    await stripFilled(page);
    // Real time was not touched by the link.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: LABEL.en.now })).toContainText(`as of ${hhmmss(T)} UTC`, { timeout: 60_000 });
    await expect(page.getByTestId('active-location')).toContainText('−38.93, −67.99');

    // A t that names no instant: the place is kept and the instant is real time. (A hash-only
    // navigation stays in the document; the reload is what makes it a fresh arrival on the link.)
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=soon`);
    await page.reload();
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    // Real time: the installed clock, not the link.
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
  });

  test('is inert with one line and the return control without an observer, and without elements (FR-LIVE-1)', async ({ page }) => {
    await page.clock.setFixedTime(T);
    await stubNetwork(page, 'down');
    await page.goto('/#live');
    const inert = page.getByTestId('live-inert');
    await expect(inert).toHaveText('The live sky needs somewhere to look from: a place name or coordinates on the home page.');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'inert');
    await expect(page.getByTestId('sky-chart')).toHaveCount(0);
    await expect(page.getByTestId('status-strip')).toHaveCount(0);
    await page.getByRole('button', { name: LABEL.en.back }).click();
    await expect(page.getByRole('banner')).toBeVisible();

    // An observer from a link, and CelesTrak down with nothing cached: no elements, so nothing to draw.
    // A hash-only navigation stays in the document, so the page is reloaded for `startApp` to read the link.
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}`);
    await page.reload();
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    await expect(inert).toHaveText('No orbital elements yet, so there is nothing to draw.', { timeout: 30_000 });
    await expect(page.getByTestId('sky-chart')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
  });
});

/**
 * The captures for the PR: the live page at both widths, in both themes, in
 * English, and in Spanish at the phone width — the ISS up and marked, the
 * coming night's arcs in their series colours, the strip under the dome.
 */
for (const width of [390, 1280] as const) {
  test(`captures at ${String(width)} px, in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    // R34 (FR-LIVE-7, FR-LIVE-8): a desktop keeps the stack and gets no follow control.
    const dome = await page.getByTestId('live-dome').boundingBox();
    const side = await page.getByTestId('live-side').boundingBox();
    expect(side?.y).toBeGreaterThanOrEqual((dome?.y ?? 0) + (dome?.height ?? 0) - 1);
    await expect(page.getByTestId('follow-phone')).toHaveCount(0);
    await page.screenshot({ path: `docs/screenshots/r32-live-${String(width)}-dark-en.png` });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.night }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.clock.runFor(500);
    await page.screenshot({ path: `docs/screenshots/r32-live-${String(width)}-night-en.png` });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.dark }).click();
  });
}

test('captures in Spanish at 390 px: no English on the page (FR-I18N-2)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await homeAt(page, T, 'es', true);
  await page.getByTestId('live-link').click();
  await expect(page.getByTestId('live-link')).toHaveCount(0);
  await domeDrawn(page);
  await stripFilled(page);
  await expect(page.getByRole('button', { name: LABEL.es.back })).toBeVisible();
  await expect(page.getByTestId('status-strip')).toHaveAttribute('aria-label', 'Estado del cielo');
  await expect(page.getByTestId('live-sky')).toHaveText(/Cielo (oscuro|crepúsculo claro|de día)/);
  await expect(page.getByTestId('live-cloud')).toHaveText('Nubes Clima desconocido');
  await expect(page.getByRole('button', { name: 'Compartir este cielo' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/r32-live-390-dark-es.png' });
});
