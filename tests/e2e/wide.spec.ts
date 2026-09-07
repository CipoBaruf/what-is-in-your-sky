/**
 * R50 (FR-DESK-3 as amended, FR-DESK-5, F-6, F-9, F-10, F-43, F-44). The wide
 * page at the two widths the capture set now carries: 1280 px, where the list
 * and the guide fit side by side, and 1024 px, where they do not. The
 * `desktop-1024` project in `playwright.config.ts` is the second one; every
 * test here reads its own viewport and asserts the layout that width is meant
 * to have, so the pair is one file and not two.
 *
 * What only a browser can answer is why these are here at all: what `1ch`
 * really measures (F-10), how tall a list is against a real viewport (F-9),
 * and what `inert` does to focus and to a key press (F-43, F-44) — jsdom
 * implements none of the three.
 */
import { expect, test, type Page } from '@playwright/test';
import { CELL_ADVANCE_EM, CELL_ADVANCE_EM_MAX, CELL_ADVANCE_EM_MIN, BASE_FONT_PX, GUTTER_CELLS, WIDE_CELLS, WIDE_MIN_PX, WIDE_SPLIT_MIN_PX } from '../../src/lib/layout';
import { seedStoredRun } from './liveHelpers';

/** FR-DESK-2/3: the left column, the list's floor and the guide's, in cells. */
const LEFT_COLUMN_CELLS = 40;
const LIST_MIN_CELLS = 44;
const GUIDE_MIN_CELLS = 40;

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

/** The width this project runs at, and whether the split is meant to be on at it. */
function viewport(page: Page): { width: number; height: number; split: boolean } {
  const size = page.viewportSize();
  if (!size) throw new Error('this project has no viewport');
  return { ...size, split: size.width >= WIDE_SPLIT_MIN_PX };
}

async function openTheGuide(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /Open guide/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#pass=/);
}

test.beforeEach(async ({ page }) => {
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

  // The two literals, in this browser's own cells.
  expect(WIDE_MIN_PX / cell).toBeGreaterThanOrEqual(WIDE_CELLS);
  expect(WIDE_SPLIT_MIN_PX / cell).toBeGreaterThanOrEqual(LEFT_COLUMN_CELLS + LIST_MIN_CELLS + GUIDE_MIN_CELLS + 2 * GUTTER_CELLS);
  // And the page really is in the wide shell at this project's width.
  expect(viewport(page).width).toBeGreaterThanOrEqual(WIDE_MIN_PX);
  const [left, right] = await Promise.all([page.getByTestId('col-left').boundingBox(), page.getByTestId('col-right').boundingBox()]);
  if (!left || !right) throw new Error('the columns are not laid out');
  expect(right.x).toBeGreaterThan(left.x + left.width - 1);
});

/**
 * F-6. Below the split width the guide had the column's leftovers after the
 * list's 44-cell floor — 43 to 107 px of it between 960 px and about 1350 px,
 * a chart in a slot narrower than the word beneath it. It takes the column
 * instead, and the list is one `[ list ]` away.
 */
test('an open guide either splits the column with the list or takes it whole, by the width (F-6)', async ({ page }) => {
  const { split } = viewport(page);
  const cell = await cellPx(page);
  const list = page.getByTestId('list-column');
  const panel = page.getByTestId('guide-panel');
  const toList = page.getByTestId('guide-to-list');

  await expect(list).toBeVisible();
  await openTheGuide(page);
  await expect(panel).toBeVisible();

  const right = await page.getByTestId('col-right').boundingBox();
  const guide = await panel.boundingBox();
  if (!right || !guide) throw new Error('the right column is not laid out');
  // FR-DESK-3: the guide is never narrower than 40 cells while it is open.
  expect(guide.width).toBeGreaterThanOrEqual(GUIDE_MIN_CELLS * cell - 1);
  // D-253: the split literal counts the columns, the gutters and one of the
  // shell's two paddings, so just above it the pair leans into the right
  // margin. The one thing that lean may never do is make the page scroll
  // sideways, and this is the width where it would first show.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'the page scrolls sideways with the guide open').toBeLessThanOrEqual(1);

  if (split) {
    await expect(list).toBeVisible();
    await expect(toList).toBeHidden();
    const listBox = await list.boundingBox();
    if (!listBox) throw new Error('the list is not laid out');
    expect(listBox.width).toBeGreaterThanOrEqual(LIST_MIN_CELLS * cell - 1);
    expect(guide.x).toBeGreaterThan(listBox.x + listBox.width - 1);
    return;
  }

  // Below the split: one thing at a time, and the guide has the whole column.
  await expect(list).toBeHidden();
  expect(Math.abs(guide.width - right.width)).toBeLessThanOrEqual(1);
  await expect(toList).toBeVisible();

  // `[ list ]` is a swap, not a close: the pass stays selected, stays in the
  // hash, and the reader lands on the card it is about.
  await toList.click();
  await expect(list).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/#pass=/);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-selected'))).toBe('true');

  const listBox = await list.boundingBox();
  if (!listBox) throw new Error('the list is not laid out');
  expect(Math.abs(listBox.width - right.width)).toBeLessThanOrEqual(1);
});

/**
 * D-253 at the one width that can disprove it. The split literal is the three
 * columns, the two gutters and one of the shell's two paddings, so at the
 * literal itself the pair of tracks is a padding wider than the column that
 * holds them and leans into the right margin. Either width the projects run at
 * is a few pixels clear of that; this sets the viewport to the literal, where
 * the margin is exactly used up, and asks for both halves of the claim.
 */
test('at the split literal itself the two tracks fit the margin and the page does not scroll sideways (D-253)', async ({ page }) => {
  await page.setViewportSize({ width: WIDE_SPLIT_MIN_PX, height: 800 });
  const cell = await cellPx(page);
  await openTheGuide(page);
  await expect(page.getByTestId('guide-panel')).toBeVisible();
  await expect(page.getByTestId('list-column')).toBeVisible();

  const [listBox, guide] = await Promise.all([page.getByTestId('list-column').boundingBox(), page.getByTestId('guide-panel').boundingBox()]);
  if (!listBox || !guide) throw new Error('the two tracks are not laid out');
  expect(listBox.width).toBeGreaterThanOrEqual(LIST_MIN_CELLS * cell - 1);
  expect(guide.width).toBeGreaterThanOrEqual(GUIDE_MIN_CELLS * cell - 1);
  expect(guide.x + guide.width, 'the guide runs off the screen').toBeLessThanOrEqual(WIDE_SPLIT_MIN_PX + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'the page scrolls sideways at the split literal').toBeLessThanOrEqual(1);
});

/**
 * F-9. The list's height was a fixed 34 rows — 816 px, taller than the 720 px
 * of a laptop screen — so the page scrolled underneath a list that was already
 * scrolling. It is the shell's height now (D-119), which is a fact about a
 * viewport and exists nowhere in the DOM.
 */
test('the list is as tall as the shell and no taller, with a pass open and without (F-9)', async ({ page }) => {
  const { height, split } = viewport(page);
  const list = page.getByTestId('list-column');

  const listFitsTheScreen = async (state: string): Promise<void> => {
    const box = await list.boundingBox();
    if (!box) throw new Error(`the list is not laid out ${state}`);
    expect(box.y + box.height, `the list overflows the viewport ${state}`).toBeLessThanOrEqual(height + 1);
    // The page itself does not scroll: the list does (D-119).
    expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight), `the page scrolls ${state}`).toBeLessThanOrEqual(1);
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight), `the list is not the one scrolling ${state}`).toBe(true);
  };

  await listFitsTheScreen('with no pass open');
  await openTheGuide(page);
  // Below the split the list is off the page while the guide is up; `[ list ]`
  // is how the reader has both a pass open and the list in front of them.
  if (!split) await page.getByTestId('guide-to-list').click();
  await listFitsTheScreen('with a pass open');
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
