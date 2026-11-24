/**
 * R50 (FR-DESK-3 as amended, FR-DESK-5, F-6, F-9, F-10, F-43, F-44). The wide
 * page at the two widths the capture set now carries: 1280 px, where the list
 * and the guide fit side by side, and 1024 px, where they do not. The
 * `desktop-1024` project in `playwright.config.ts` is the second one; every
 * test here reads its own viewport and asserts the layout that width is meant
 * to have, so the pair is one file and not two.
 *
 * R186 (FR-WIDE-1, D-1098): an open pass on wide is the desk shell at every desk width. R212 (FR-LAND-1,
 * FR-LAND-6): the home is gone, so the page these read is the satellites page, `#pass`, which settles on the pass
 * up now or next; `sky-layout.spec.ts` measures the shell.
 *
 * What only a browser can answer is why these are here at all: what `1ch`
 * really measures (F-10), how tall a list is against a real viewport (F-9),
 * and what `inert` does to focus and to a key press (F-43, F-44) — jsdom
 * implements none of the three.
 */
import { expect, test, type Page } from '@playwright/test';
import { CELL_ADVANCE_EM, CELL_ADVANCE_EM_MAX, CELL_ADVANCE_EM_MIN, BASE_FONT_PX, WIDE_CELLS, WIDE_MIN_PX } from '../../src/lib/layout';
import { listSettled, seedStoredRun } from './liveHelpers';

/** A describe whose tests seed the page themselves (in their own language) and skip the file's English seed. */
const SEEDS_ITSELF = '@seeds-itself';

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

/** The height this project runs at. */
function viewportHeight(page: Page): number {
  const size = page.viewportSize();
  if (!size) throw new Error('this project has no viewport');
  return size.height;
}

/** R212 (FR-LAND-6, D-1134): the satellites page on wide settles on the pass up now or next. */
async function onThePassPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#pass=/, { timeout: 30_000 });
  await expect(page.getByTestId('pass-layout')).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(async ({ page }, info) => {
  // R166: the desk-width describe seeds its own page, in its own language.
  if (info.tags.includes(SEEDS_ITSELF)) return;
  await seedStoredRun(page);
});

/**
 * F-10. The old derivation assumed every family in `--font-mono` advances
 * 0.6 em; Consolas advances 0.55, which made the 960 px literal 109 cells on
 * Windows rather than 100. The advances are recorded in `lib/layout.ts` now,
 * and this is the measurement that keeps that record honest: whatever this
 * browser resolved the stack to, its cell is one of the ones in the table, and
 * the literal the stylesheet carries is worth at least the cells it stands for.
 */
test('the cell is measured, not assumed: the breakpoint is at least its cells at the font the browser resolved (F-10)', async ({ page }) => {
  const cell = await cellPx(page);
  expect(cell).toBeGreaterThanOrEqual(CELL_ADVANCE_EM_MIN * BASE_FONT_PX - 0.01);
  expect(cell).toBeLessThanOrEqual(CELL_ADVANCE_EM_MAX * BASE_FONT_PX + 0.01);
  const advanceEm = cell / BASE_FONT_PX;
  expect(Object.values(CELL_ADVANCE_EM).some((known) => Math.abs(known - advanceEm) < 0.005), `${String(advanceEm)} em is a font the advance table does not know`).toBe(true);

  // The literal, in this browser's own cells (R186 retired the split's, R212 the three panes').
  expect(WIDE_MIN_PX / cell).toBeGreaterThanOrEqual(WIDE_CELLS);
  // And the page really is in the wide shell at this project's width: the desk shell with its rail.
  expect(page.viewportSize()?.width ?? 0).toBeGreaterThanOrEqual(WIDE_MIN_PX);
  await onThePassPage(page);
  await expect(page.getByTestId('pass-layout').locator('[data-slot="upFrom"]')).toBeVisible();
});

/**
 * R186 (FR-WIDE-1, D-1098; amends FR-DESK-3, retires F-6's split and D-444's panes for an open pass): on wide an
 * open pass is the desk shell — the pass list in the rail with the card highlighted — at every desk width, and the
 * page does not scroll sideways.
 */
test('an open pass is the desk shell, the list in its rail (FR-WIDE-1)', async ({ page }) => {
  await onThePassPage(page);
  const list = page.getByTestId('pass-layout').locator('[data-slot="upFrom"]');
  await expect(list.locator('article[data-pass-id][data-selected="true"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'the page scrolls sideways with a pass open').toBeLessThanOrEqual(1);
});

/**
 * F-9. The list's height was a fixed 34 rows — 816 px, taller than the 720 px
 * of a laptop screen — so the page scrolled underneath a list that was already
 * scrolling. It is the shell's height now (D-119), which is a fact about a
 * viewport and exists nowhere in the DOM.
 */
test('the list is as tall as the shell and no taller (F-9)', async ({ page }) => {
  const height = viewportHeight(page);
  await onThePassPage(page);
  await listSettled(page);
  // R216 (D-1277): the list is the rail's last group and the rail is the one scroll, so the rail is what fits.
  const rail = page.getByTestId('pass-layout').locator('[data-rail]');
  await expect(rail.locator('[data-slot="upFrom"]')).toBeAttached();
  const box = await rail.boundingBox();
  if (!box) throw new Error('the rail is not laid out');
  expect(box.y + box.height, 'the rail overflows the viewport').toBeLessThanOrEqual(height + 1);
  // The page itself does not scroll (D-119).
  expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight), 'the page scrolls').toBeLessThanOrEqual(1);
});

/**
 * F-43 and F-44 in the only place `inert` is real. Opening the overlay puts it
 * on the header, the main and the footer, and the browser blurs the card the
 * reader was on before any effect can read it — which is what used to leave
 * `Escape` nothing to give focus back to. And a card inside that subtree
 * cannot take focus at all, so `j` there is not a move and the key press is
 * not the app's.
 */
test('the shortcuts overlay gives focus back to the card, and leaves j to the browser while it is up (F-43, F-44)', async ({ page }) => {
  // The recompute replaces the stored list as it streams in; a card the cursor is on must outlive the overlay.
  await listSettled(page);
  await page.keyboard.press('j');
  const cursor = await page.evaluate(() => document.activeElement?.getAttribute('data-pass-id'));
  expect(cursor).not.toBeNull();

  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcuts-overlay')).toBeVisible();
  expect(await page.getByRole('main', { includeHidden: true }).getAttribute('inert')).not.toBeNull();

  // A second listener on the same target runs after the app's and can see what it did with the press.
  await page.evaluate(() => {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'j') document.body.dataset['jPrevented'] = String(event.defaultPrevented);
    });
  });
  await page.keyboard.press('j');
  expect(await page.evaluate(() => document.body.dataset['jPrevented'])).toBe('false');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-pass-id'))).toBeNull();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('shortcuts-overlay')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-pass-id'))).toBe(cursor);
});

/**
 * R166 (FR-CLEAN-12, FR-HOME-4 as amended v2.11; D-1003): one width on a desk. At 1920 and 2560 px every page — the
 * live page, the stars page, the pass detail and the settings page — holds `HOME_MAX_CELLS` and is
 * centred: each of its rows (the header, `main`, the footer where it has one; the live page's grid, which holds its
 * own landmarks) is 160 cells wide and stands in the middle of the viewport, and the sky's box stands inside it. At
 * 1280 px, under the cap, nothing moves: every row is the viewport's width. Both languages; the 1280 project only
 * (the sizes are this describe's own).
 */
// R222 (FR-LAND-3): the stars page folded into live.
type DeskPage = 'live' | 'pass' | 'settings';
const DESK_PAGES: readonly DeskPage[] = ['live', 'pass', 'settings'];

async function openDeskPage(page: Page, target: DeskPage, locale: 'en' | 'es'): Promise<void> {
  await seedStoredRun(page, { locale, settled: true });
  // R212 (FR-LAND-6, D-1134): the seed leaves the page on the satellites page, which settles on the next pass.
  if (target === 'pass') {
    await expect(page).toHaveURL(/#pass=/, { timeout: 30_000 });
    await expect(page.getByTestId('pass-layout').locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
    return;
  }
  await page.goto(`/#${target}`);
  if (target === 'live') {
    await expect(page.getByTestId('live-layout').locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
  } else {
    await expect(page.getByTestId('settings-back')).toBeVisible();
  }
}

/**
 * The page's rows, `#root`'s own children that carry its content: the header, `main` and the footer, plus the
 * page notices where they say something. Every expected row must be there, so a row moved out of `#root` fails.
 */
async function contentRows(page: Page, target: DeskPage): Promise<{ name: string; x: number; width: number }[]> {
  // R186 (FR-WIDE-1): the live page is in the shell, inside `main`, with the header and the footer as every page.
  const required = ['#root > header', '#root > main', '#root > footer'];
  const rows = await page.evaluate((selectors) => selectors.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { name: selector, x: NaN, width: NaN };
    const rect = element.getBoundingClientRect();
    return { name: selector, x: rect.x, width: rect.width };
  }), [...required, '#root > [data-page-notices]:not(:empty)']);
  for (const row of rows.slice(0, required.length)) expect(Number.isNaN(row.width), `${row.name} is not one of #root's rows`).toBe(false);
  return rows.filter((row) => !Number.isNaN(row.width));
}

/** The sky's box on the page, where it has one. */
function skyBox(page: Page, target: DeskPage) {
  if (target === 'settings') return null;
  const layout = target === 'live' ? 'live-layout' : 'pass-layout';
  return page.getByTestId(layout).locator('[data-slot="drawing"]').first();
}

test.describe('FR-CLEAN-12: one width on a desk (D-1003)', { tag: SEEDS_ITSELF }, () => {
  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    test.describe(`${String(width)} × ${String(height)}`, () => {
      test.use({ viewport: { width, height } });
      for (const locale of ['en', 'es'] as const) {
        for (const target of DESK_PAGES) {
          test(`${target} in ${locale}: ${width > 1600 ? 'the rows hold the home’s 160 cells, centred' : 'under the cap every row is the viewport’s width'}, the sky inside them`, async ({ page }, info) => {
            test.skip(info.project.name !== 'chromium', 'the sizes are this describe’s own: the 1024 project has nothing to add');
            await openDeskPage(page, target, locale);
            const cell = await cellPx(page);
            const capped = Math.min(width, 160 * cell);
            const rows = await contentRows(page, target);
            for (const row of rows) {
              expect(Math.abs(row.width - capped), `${row.name} is ${String(row.width)} px, not ${String(capped)}`).toBeLessThanOrEqual(1);
              expect(Math.abs(row.x - (width - row.width) / 2), `${row.name} is not centred`).toBeLessThanOrEqual(1);
            }
            const sky = skyBox(page, target);
            if (sky) {
              const rect = await sky.boundingBox();
              if (!rect) throw new Error('the sky is not laid out');
              const left = (width - capped) / 2;
              expect(rect.x, 'the sky starts inside the column').toBeGreaterThanOrEqual(left - 1);
              expect(rect.x + rect.width, 'the sky ends inside the column').toBeLessThanOrEqual(left + capped + 1);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'the page scrolls sideways').toBeLessThanOrEqual(1);
            info.annotations.push({ type: 'content-width', description: `${target} ${locale} ${String(width)}: ${rows.map((row) => `${row.name} ${row.width.toFixed(1)}`).join(', ')}` });
          });
        }
      }
    });
  }
});

