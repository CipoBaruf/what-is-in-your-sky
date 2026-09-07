/**
 * R45 captures (FR-LEG-1, FR-LEG-2, FR-COMP-5, FR-DOME-1 as amended, US-23):
 * the pass detail with the legend — under a full-bleed square chart on the
 * phone, under the chart in the 40-cell guide column of the three-column
 * desktop (1280 px, D-232) — in both themes and both languages on the dome;
 * the polar view once at each width, since its labels moved too; and the live
 * page at 1280 px, the one wide frame on this branch with the room for the
 * legend beside the drawing (the 1024 px mid width where the guide takes the
 * whole right column is D-192's, R43). Evidence for the PR, not a test: the
 * assertions only make sure the capture shows the thing it is named after.
 *
 *   npx playwright test r45-captures --project=chromium
 *
 * The place, the pass and the instant are `v1-captures.spec.ts`'s: Paris on
 * 2026-09-02, three minutes into the glare pass, where the Moon is 60° up and
 * the Sun is inside FR-DOME-6's twilight band, so the legend has its two body
 * lines as well as the row for the pass. The theme and the language are seeded
 * in `wiys:prefs:v1` (D-70), never clicked, and one capture is one test.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR, LOCALES, THEMES, type CaptureLocale, type CaptureTheme } from './captureSet';
import { domeDrawn, stripFilled } from './liveHelpers';
import { FIXTURE_DATE, PARIS } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

/** 390 the phone, 1280 the three-column desktop. */
const VIEWPORTS = {
  390: { width: 390, height: 844 },
  1280: { width: 1280, height: 800 },
} as const;
type Width = keyof typeof VIEWPORTS;

const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

async function open(page: Page, width: Width, prefs: { locale: CaptureLocale; theme: CaptureTheme; observer: Observer; chartView: 'dome' | 'polar' }, time = CLOCK): Promise<void> {
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
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}

async function openDetail(page: Page, width: Width, theme: CaptureTheme, locale: CaptureLocale, view: 'dome' | 'polar'): Promise<Locator> {
  await open(page, width, { locale, theme, observer: PARIS, chartView: view });
  await page.goto('/');
  const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await card.getByRole('button', { name: OPEN_GUIDE[locale] }).click();
  const figure = guide(page).getByRole('figure');
  await expect(figure).toHaveAttribute('data-view', view);
  await page.clock.runFor(1000);
  if (view === 'dome') await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);

  // What the capture is named after: the key at the peak and nothing else in words in the drawing; the legend with its row and its two body lines.
  const key = view === 'dome' ? figure.locator(`[data-pass-id="${GLARE_PASS}"][data-anchor="key"]`) : figure.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`);
  await expect(key).toHaveText('A');
  await expect(figure.locator('[data-anchor="pass"], [data-anchor="peak"], [data-anchor="sun"], [data-anchor="moon"]')).toHaveCount(0);
  const legend = figure.getByTestId('chart-legend');
  // R51 (FR-LEG-3): on the detail the explained pass's row is the numeric table, at the head of the legend.
  await expect(legend.getByTestId('legend-lead').locator('caption')).toContainText('A');
  await expect(legend.locator(`button[data-pass-id="${GLARE_PASS}"]`)).toHaveCount(0);
  await expect(legend.locator('[data-body="sun"]')).toHaveCount(1);
  await expect(legend.locator('[data-body="moon"]')).toHaveCount(1);
  await expect(legend).toHaveAttribute('aria-label', locale === 'es' ? 'Leyenda' : 'Legend');

  // FR-COMP-5 / FR-LEG-2 / D-232: on the phone the box spans the viewport and is square, the legend under it; at 1280 the
  // 40-cell guide column has no room for a 24-cell column beside the drawing, so the legend is under there too.
  const box = await figure.getByTestId('chart-box').boundingBox();
  const list = await legend.boundingBox();
  if (!box || !list) throw new Error('no chart box or legend');
  if (width === 390) {
    expect(box.width).toBe(390);
    expect(Math.abs(box.height - box.width)).toBeLessThanOrEqual(1);
  }
  expect(list.y).toBeGreaterThanOrEqual(box.y + box.height);
  await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  return figure;
}

/** FR-LEG-2 / D-232: the live page at 1280 px is the wide frame with the room, and the legend is the 24-cell column at the right. */
test('the live page at 1280 px, dark, en: the legend beside the dome', async ({ page }) => {
  await open(page, 1280, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' }, SHOWN);
  await page.goto('/');
  await expect(page.getByTestId('iss-hero')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await page.evaluate(() => {
    location.hash = '#live';
  });
  await domeDrawn(page);
  await stripFilled(page);
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);
  const dome = page.getByTestId('live-dome');
  await expect(dome.locator('[data-drawing] [data-anchor="key"]').first()).toBeAttached();
  const legend = dome.getByTestId('chart-legend');
  await expect(legend.locator('button[data-pass-id]').first()).toBeAttached();
  const box = await dome.getByTestId('chart-box').boundingBox();
  const list = await legend.boundingBox();
  if (!box || !list) throw new Error('no chart box or legend');
  expect(list.x).toBeGreaterThanOrEqual(box.x + box.width);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${CAPTURE_DIR}/r45-live-1280-dark-en.png` });
});

for (const width of [390, 1280] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the pass detail with the legend at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
        await openDetail(page, width, theme, locale, 'dome');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await page.screenshot({ path: `${CAPTURE_DIR}/r45-detail-${String(width)}-${theme}-${locale}.png` });
      });
    }
  }
  test(`the polar view with the legend at ${String(width)} px, dark, en`, async ({ page }) => {
    await openDetail(page, width, 'dark', 'en', 'polar');
    await page.screenshot({ path: `${CAPTURE_DIR}/r45-polar-${String(width)}-dark-en.png` });
  });
}
