/**
 * R71's record (FR-LEG-9, FR-COMP-6): the legend's place.
 *
 * Three sets, and each one is a picture of a rule the task states:
 *
 *   - the compact live page with the list **closed** and with it **open** (since R150, the sheet closed and the
 *     sheet open at its satellites; R153), at
 *     390 × 844 and 390 × 667, in both themes and both languages (FR-LEG-7).
 *     Closed is where FR-COMP-5's floor is measured (FR-LEG-8) and open is the
 *     two-`--tap` panel, so the pair shows what the reader's tap costs the box;
 *     the Spanish pair is also the FR-COMP-4 row the actions became — `[ ]
 *     Ocultos [ lista (n) ] Compartir`, 35 of the 36 cells (D-411);
 *   - the empty line at 390 × 844: an instant with nothing drawn, where the
 *     panel is still two rows and carries "nothing up right now" (FR-LEG-7);
 *   - the wide page at 964 × 700, 1024 × 768 and 1280 × 800, where the rail now
 *     stands beside the box at every width (FR-LEG-6). These replace the
 *     one-column wide captures the record carries from R61 at 1280.
 *
 * Evidence for the pull request, not a test: the assertions only make sure the
 * capture shows the thing it is named after — `live-compact.spec.ts` and
 * `live-rail.spec.ts` are where the rules are measured. Off the pull-request
 * path (FR-CI-1's budget), like the D-179 set and R61's, so they run on demand:
 *
 *   CAPTURES=1 npx playwright test r71-captures --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { domeDrawn, homeAt, NINE_DAYS_ON, openSheet, recomputeEnded, seedStoredRun, setThemeOnHome, stripFilled, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

/** The live page at a size, a theme and a language, drawn and settled. */
async function openLive(page: Page, width: number, height: number, theme: 'dark' | 'night', locale: 'en' | 'es'): Promise<void> {
  await page.setViewportSize({ width, height });
  await homeAt(page, T, locale, true);
  // R48 (D-244): the compact live page carries no theme switch, so the theme is set on the home page.
  if (theme === 'night') await setThemeOnHome(page, locale, 'night');
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

/**
 * R153 (FR-GYRO-10, FR-FULL-4): since R150 the compact list has no `[ list (n) ]` to press — the satellites are open
 * at the end of the controls sheet, two `--tap` rows scrolling inside themselves as R71 made them. So "closed" is the
 * sky with the sheet closed and "open" is the sheet open, scrolled to its satellites; the sky never gives them room
 * (FR-FULL-1), so the box is not compared.
 */
async function satellitesOpen(page: Page): Promise<void> {
  await openSheet(page);
  await page.getByTestId('live-satellites').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('chart-legend-slot')).toBeVisible();
  await page.clock.runFor(300);
  await page.mouse.move(0, 0);
}

for (const [width, height] of [
  [390, 844],
  [390, 667],
] as const) {
  for (const theme of ['dark', 'night'] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`the compact live page at ${String(width)} × ${String(height)}, ${theme}, ${locale}: the list closed and open`, async ({ page }) => {
        await openLive(page, width, height, theme, locale);
        await page.screenshot({ path: `${CAPTURE_DIR}/r71-live-${String(width)}x${String(height)}-closed-${theme}-${locale}.png` });

        await satellitesOpen(page);
        const panel = await page.getByTestId('chart-legend-slot').boundingBox();
        expect(panel?.height, 'the open panel is two tap rows').toBeCloseTo(96, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r71-live-${String(width)}x${String(height)}-open-${theme}-${locale}.png` });
      });
    }
  }
}

/**
 * The empty panel. R153: the instant is the day's — the stored run at midday, nothing visible up, so the page asks with its
 * card (FR-FULL-10) and `[ see now ]` keeps real time — where the satellites count none and the panel is still two
 * rows saying what it holds.
 */
test('the compact live page at 390 × 844: the empty list', async ({ page }) => {
  const midday = NINE_DAYS_ON + 12 * 3_600_000;
  await page.setViewportSize({ width: 390, height: 844 });
  await seedStoredRun(page, { locale: 'en', settled: true });
  await page.clock.setFixedTime(midday);
  await page.reload();
  await recomputeEnded(page);
  await page.clock.install({ time: midday });
  await page.clock.pauseAt(midday + 1_000);
  await page.evaluate(() => {
    window.location.hash = '#live';
  });
  await domeDrawn(page);
  const card = page.getByTestId('live-card');
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return card.count();
    }, { timeout: 30_000 })
    .toBe(1);
  await card.getByTestId('live-card-now').click();
  await satellitesOpen(page);
  await expect(page.getByTestId('legend-empty')).toHaveText('nothing up right now');
  const panel = await page.getByTestId('chart-legend-slot').boundingBox();
  expect(panel?.height, 'an empty panel is two tap rows like any other').toBeCloseTo(96, 0);
  await page.screenshot({ path: `${CAPTURE_DIR}/r71-live-390x844-empty-dark-en.png` });
});

/** The wide page: the rail beside the box at the three widths that had none before (FR-LEG-6). */
for (const [width, height] of [
  [964, 700],
  [1024, 768],
  [1280, 800],
] as const) {
  test(`the wide live page at ${String(width)} × ${String(height)}: the rail beside the box`, async ({ page }) => {
    await openLive(page, width, height, 'dark', 'en');
    const box = await page.getByTestId('chart-box').boundingBox();
    // R132 (D-864): the rail is the layout's; the legend is its `list` slot.
    const rail = await page.getByTestId('live-layout').locator('[data-slot="list"]').boundingBox();
    if (!box || !rail) throw new Error('the page is not laid out');
    expect(rail.x, 'the rail is beside the box').toBeGreaterThanOrEqual(box.x + box.width - 1);
    // …with the legend over it in the same column, as on every page since R150.
    expect((await page.getByTestId('chart-legend').boundingBox())?.x ?? 0).toBeGreaterThanOrEqual(box.x + box.width - 1);
    await page.screenshot({ path: `${CAPTURE_DIR}/r71-live-${String(width)}x${String(height)}-dark-en.png` });
  });
}
