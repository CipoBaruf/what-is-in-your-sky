/**
 * R71's record (FR-LEG-9, FR-COMP-6): the legend's place.
 *
 * Three sets, and each one is a picture of a rule the task states:
 *
 *   - the compact live page with the list **closed** and with it **open**, at
 *     390 × 844 and 390 × 667, in both themes and both languages (FR-LEG-7).
 *     Closed is where FR-COMP-5's floor is measured (FR-LEG-8) and open is the
 *     two-`--tap` panel, so the pair shows what the reader's tap costs the box;
 *     the Spanish pair is also the FR-COMP-4 row the actions became — `[ ]
 *     Ocultos [ lista (n) ] Compartir`, 35 of the 36 cells (D-390);
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
import { domeDrawn, homeAt, setThemeOnHome, stripFilled, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const LIST = { en: /^list \(\d+\)$/, es: /^lista \(\d+\)$/ } as const;

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

for (const [width, height] of [
  [390, 844],
  [390, 667],
] as const) {
  for (const theme of ['dark', 'night'] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`the compact live page at ${String(width)} × ${String(height)}, ${theme}, ${locale}: the list closed and open`, async ({ page }) => {
        await openLive(page, width, height, theme, locale);
        const control = page.getByTestId('live-legend-toggle');
        await expect(control).toHaveText(LIST[locale]);
        await expect(control).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
        const closed = await page.getByTestId('chart-box').boundingBox();
        await page.screenshot({ path: `${CAPTURE_DIR}/r71-live-${String(width)}x${String(height)}-closed-${theme}-${locale}.png` });

        await control.click();
        await expect(control).toHaveAttribute('aria-expanded', 'true');
        const panel = await page.getByTestId('chart-legend-slot').boundingBox();
        expect(panel?.height, 'the open panel is two tap rows').toBeCloseTo(96, 0);
        expect(closed?.height ?? 0, 'and the box is what gives them').toBeGreaterThanOrEqual((await page.getByTestId('chart-box').boundingBox())?.height ?? 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r71-live-${String(width)}x${String(height)}-open-${theme}-${locale}.png` });
      });
    }
  }
}

/**
 * The empty panel. The instant is found rather than assumed: the overview row
 * carries the whole 24 h, and pressing along it moves the shown instant until
 * the control says `list (0)` — the sky between two passes, which is most of a
 * day. Then the panel is still two rows and says what it holds.
 */
test('the compact live page at 390 × 844: the empty list', async ({ page }) => {
  await openLive(page, 390, 844, 'dark', 'en');
  await page.getByTestId('live-legend-toggle').click();
  const overview = await page.getByTestId('stripe-overview').boundingBox();
  if (!overview) throw new Error('no overview row');
  for (const fraction of [0.5, 0.6, 0.4, 0.7, 0.3, 0.8, 0.2, 0.9]) {
    await page.mouse.move(overview.x + overview.width * fraction, overview.y + overview.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.clock.runFor(600);
    if ((await page.getByTestId('live-legend-toggle').textContent()) === 'list (0)') break;
  }
  await expect(page.getByTestId('live-legend-toggle')).toHaveText('list (0)');
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
    const rail = await page.getByTestId('chart-aside').boundingBox();
    if (!box || !rail) throw new Error('the page is not laid out');
    expect(rail.x, 'the rail is beside the box').toBeGreaterThanOrEqual(box.x + box.width - 1);
    // …with the legend over it in the same column, and no `[ list (n) ]` control anywhere: this page has no list to open.
    expect((await page.getByTestId('chart-legend-scroll').boundingBox())?.x ?? 0).toBeGreaterThanOrEqual(box.x + box.width - 1);
    await expect(page.getByTestId('live-legend-toggle')).toHaveCount(0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r71-live-${String(width)}x${String(height)}-dark-en.png` });
  });
}
