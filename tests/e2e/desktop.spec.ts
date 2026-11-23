/**
 * R23 (US-14 AC1/AC2/AC5, FR-DESK-1/2/3) at 1280 px, the width the approved
 * mockup fixes (`docs/mockups/desktop-1280.html`, FR-DESK-5).
 *
 * Three things a unit test cannot see, because they need a real layout: that
 * the columns are side by side and 40 cells wide, that the guide opens
 * *beside* a list that is still there and still scrolling, and that the
 * breakpoint really is 100 cells — the D-71 arithmetic is checked against the
 * stylesheets in `tests/styles/breakpoint.test.ts`, and here against a `1ch`
 * the browser measured for itself. A fourth since D-119: that with a pass
 * open the page does not scroll at all and each pane scrolls itself, which is
 * a fact about three boxes and a viewport and exists nowhere in the DOM. The compact sheet at 390 px is
 * `pass-detail.spec.ts`, unchanged.
 *
 * R76 (FR-FIRST-5, D-443, D-444): 1280 px is a three-pane width now — Where,
 * When and What — and an open pass takes the first two panes beside the list
 * in the third. FR-DESK-2's two columns hold between the wide breakpoint and
 * the three panes, so the two-column measurements are taken at 1024 px, the
 * mid width FR-DESK-5 already captures. The list's pane is FR-FIRST-5's 36
 * cells at least, the compact card's width, where the split column's list had
 * D-253's 44.
 *
 * R212 (FR-LAND-1): the home is gone; the panes' measurements went with it.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { WIDE_CELLS, WIDE_MIN_PX } from '../../src/lib/layout';
import { seedStoredRun } from './liveHelpers';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const DAY_MS = 86_400_000;
const WIDE = { width: 1280, height: 900 };
const COMPACT = { width: 390, height: 844 };
const MID = { width: 1024, height: 900 };

test.use({ viewport: WIDE });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
});

/** One character advance, as this browser resolves the app's own monospace stack. */
async function cellPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:100ch';
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return width;
  });
}

/**
 * FR-CI-3 (R37): the layout is not the pass search. The page opens on a stored
 * 72 h run — the way a returning reader's does (FR-OFF-2) — so what is measured
 * here is a full page, reached without waiting for one to be computed.
 */
async function loadWithPasses(page: Page): Promise<void> {
  // Settled: mid-recompute the list is one satellite's passes, and the one-line cards (R81) make that short enough not to scroll.
  await seedStoredRun(page, { settled: true });
}

/**
 * R212 (FR-LAND-1, FR-LAND-6): the home's two columns and three panes are gone, and with them D-119's measurements
 * of them (`wide.spec.ts` keeps the rail's). What stays: the breakpoint in the browser's own cells, and the pass
 * detail as the desk shell with the list in its rail, a second pass from the rail replacing the first in place.
 */
test('wide: the breakpoint is 100 cells, and a pass from the rail replaces the open one in place (FR-DESK-1, FR-WIDE-1)', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(golden.start.t)}`;
  await page.setViewportSize(MID);
  await loadWithPasses(page);

  // FR-DESK-1: the breakpoint the stylesheet uses really is 100 cells wide here. R50 (F-10): "at least", not
  // "exactly" — one literal is a different number of cells on each font of the stack, and `wide.spec.ts` is where
  // that is measured against `lib/layout.ts`'s table.
  const cell = await cellPx(page);
  expect(WIDE_MIN_PX / cell).toBeGreaterThanOrEqual(WIDE_CELLS);
  expect(WIDE_MIN_PX / cell).toBeLessThan(WIDE_CELLS + 1);

  // R186 (FR-WIDE-1, amends FR-DESK-3; D-1098, D-1118): a selected pass is the desk shell, the pass list in the rail
  // and the card marked.
  await page.setViewportSize(WIDE);
  const card = page.locator(`article[data-pass-id="${passId}"]`);
  await card.getByRole('button', { name: /Open guide/ }).click();
  await expect(page).toHaveURL(new RegExp(`#pass=${passId}$`));
  const panel = page.getByTestId('guide-panel');
  await expect(panel).toHaveAttribute('data-pass-id', passId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(panel.getByTestId('pass-layout')).toBeVisible();
  await expect(panel.locator(`article[data-pass-id="${passId}"]`)).toHaveAttribute('data-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // A second pass from the rail's list replaces the detail in place, and the highlight moves with it.
  const others = panel.locator('article[data-pass-id]:not([data-selected])');
  const secondId = await others.first().getAttribute('data-pass-id');
  await others.first().getByRole('button', { name: /Open guide/ }).click();
  await expect(panel).toHaveAttribute('data-pass-id', String(secondId));
  await expect(panel.locator(`article[data-pass-id="${passId}"]`)).not.toHaveAttribute('data-selected');
  expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBeLessThanOrEqual(1);
});

test('crossing the breakpoint keeps the same pass open, in the other shell (D-72)', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(golden.start.t)}`;
  await loadWithPasses(page);
  await page.locator(`article[data-pass-id="${passId}"]`).getByRole('button', { name: /Open guide/ }).click();
  await expect(page.getByTestId('guide-panel')).toHaveAttribute('data-pass-id', passId);

  await page.setViewportSize(COMPACT);
  const sheet = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  await expect(sheet).toHaveAttribute('data-pass-id', passId);
  await expect(page.getByTestId('guide-panel')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#pass=${passId}$`));
  // The compact sheet on this branch, for the PR: the MVP one, on R21's default view.
  await expect(sheet.locator(`[data-layer="lines"] [data-pass-id="${passId}"][data-anchor="key"]`)).toHaveText('A', { timeout: 30_000 });
  await page.screenshot({ path: 'test-results/r23-guide-390-en.png' });

  await page.setViewportSize(WIDE);
  await expect(page.getByTestId('guide-panel')).toHaveAttribute('data-pass-id', passId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#pass=${passId}$`));
});
