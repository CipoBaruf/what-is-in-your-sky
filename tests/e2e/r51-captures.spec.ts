/**
 * R51 captures (FR-LEG-3, US-23 AC3): the pass detail with the numeric table
 * as its legend — directly under the drawing, its caption carrying the key
 * the drawing puts at the arc's peak and a swatch in the arc's colour, with
 * the Sun and Moon lines under it. At 390 px and 1280 px, in both themes and
 * both languages. Evidence for the PR, not a test: the assertions only make
 * sure the capture shows the thing it is named after. Off the pull-request
 * path (FR-CI-1's budget), like R54's:
 *
 *   CAPTURES=1 npx playwright test r51-captures --project=chromium
 *
 * The place, the pass and the instant are `r45-captures.spec.ts`'s, so the
 * two sets are the same screen before and after the table moved: Paris on
 * 2026-09-02, three minutes into the glare pass, where the Moon is 60° up and
 * the Sun is inside FR-DOME-6's twilight band. The theme and the language are
 * seeded in `wiys:prefs:v1` (D-70), never clicked, and one capture is one test.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR, LOCALES, THEMES, type CaptureLocale, type CaptureTheme } from './captureSet';
import { FIXTURE_DATE, PARIS } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

const VIEWPORTS = { 390: { width: 390, height: 844 }, 1280: { width: 1280, height: 800 }, 1920: { width: 1920, height: 1080 } } as const;
type Width = keyof typeof VIEWPORTS;

const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

async function open(page: Page, width: Width, prefs: { locale: CaptureLocale; theme: CaptureTheme; observer: Observer; chartView: 'dome' }): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
}

for (const width of [390, 1280] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the pass detail with the table as its legend at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
        await open(page, width, { locale, theme, observer: PARIS, chartView: 'dome' });
        await page.goto('/');
        const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`);
        await expect(card).toBeVisible({ timeout: 60_000 });
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
        await card.getByRole('button', { name: OPEN_GUIDE[locale] }).click();
        const figure = guide(page).getByRole('figure');
        await page.clock.runFor(1000);
        await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
        await page.clock.setSystemTime(SHOWN - TICK_MS);
        await page.clock.runFor(TICK_MS);

        // What the capture is named after: the table at the head of the legend, keyed and swatched, directly under
        // the drawing, with no second row for the pass it explains and the two body lines under it (FR-LEG-3).
        const lead = figure.getByTestId('legend-lead');
        await expect(lead.getByRole('table')).toBeVisible();
        await expect(lead.locator('caption')).toContainText('A');
        await expect(lead.locator('caption [data-color="pass"]')).toHaveCount(1);
        await expect(figure.locator(`[data-pass-id="${GLARE_PASS}"][data-anchor="key"]`)).toHaveText('A');
        await expect(figure.getByTestId('chart-legend').locator(`button[data-pass-id="${GLARE_PASS}"]`)).toHaveCount(0);
        for (const body of ['sun', 'moon']) await expect(figure.getByTestId('chart-legend').locator(`[data-body="${body}"]`)).toHaveCount(1);
        const box = await figure.getByTestId('chart-box').boundingBox();
        const table = await lead.boundingBox();
        if (!box || !table) throw new Error('no chart box or table');
        expect(table.y).toBeGreaterThanOrEqual(box.y + box.height);

        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // On the phone the sheet scrolls the page, and the drawing at the top of the shot puts the table under it,
        // which is the thing being reviewed. On wide the guide is a column that scrolls itself and is shorter than
        // both, so the table is what is brought into view — the drawing above it is the same one R45 captured.
        await (width === 390 ? figure.locator('[data-drawing]') : lead).scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r51-detail-${String(width)}-${theme}-${locale}.png` });
      });
    }
  }
}

/**
 * D-259: the large desktop, where the guide column is past D-232's 62 cells
 * and the table would have gone into the 24-cell column beside the drawing.
 * One capture, dark and English: what is being shown is a placement.
 */
test('the pass detail at 1920 px, dark, en: the table under the drawing, not beside it', async ({ page }) => {
  await open(page, 1920, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
  await page.goto('/');
  const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await card.getByRole('button', { name: OPEN_GUIDE.en }).click();
  const figure = guide(page).getByRole('figure');
  await page.clock.runFor(1000);
  await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);

  const box = await figure.getByTestId('chart-box').boundingBox();
  const lead = await figure.getByTestId('legend-lead').boundingBox();
  if (!box || !lead) throw new Error('no chart box or table');
  expect(lead.y).toBeGreaterThanOrEqual(box.y + box.height);
  // The readout in the middle of the panel, which is what holds the dome and the table under it in one shot;
  // `scrollIntoViewIfNeeded` would not move at all here, since the readout is already on screen.
  await figure.getByTestId('dome-readout').evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
  });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${CAPTURE_DIR}/r51-detail-1920-dark-en.png` });
});
