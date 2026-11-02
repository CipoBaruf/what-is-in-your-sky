/**
 * R50 (FR-DESK-3 as amended, FR-DESK-5, F-6, F-9, F-10, F-43, F-44). The wide
 * page at the two widths the capture set now carries: 1280 px, where the list
 * and the guide fit side by side, and 1024 px, where they do not. The
 * `desktop-1024` project in `playwright.config.ts` is the second one; every
 * test here reads its own viewport and asserts the layout that width is meant
 * to have, so the pair is one file and not two.
 *
 * R76 (FR-FIRST-5, D-444): from `HOME_THREE_PANE_MIN_PX` (1118) the wide home
 * is three panes, and an open pass takes the first two with the list kept in
 * the third — so at 1280 px, and at the split literal itself, what used to be
 * D-253's split is the pane layout, and those branches ask for that instead.
 * The 1024 px project runs every branch it ran before, unchanged.
 *
 * What only a browser can answer is why these are here at all: what `1ch`
 * really measures (F-10), how tall a list is against a real viewport (F-9),
 * and what `inert` does to focus and to a key press (F-43, F-44) — jsdom
 * implements none of the three.
 */
import { expect, test, type Page } from '@playwright/test';
import { CELL_ADVANCE_EM, CELL_ADVANCE_EM_MAX, CELL_ADVANCE_EM_MIN, BASE_FONT_PX, GUIDE_PANE_MIN_CELLS, GUTTER_CELLS, HOME_THREE_PANE_MIN_CELLS, SHELL_PADDING_CELLS, HOME_THREE_PANE_MIN_PX, WIDE_CELLS, WIDE_MIN_PX, WIDE_SPLIT_MIN_PX } from '../../src/lib/layout';
import { listSettled, seedStoredRun } from './liveHelpers';

/** A describe whose tests seed the page themselves (in their own language) and skip the file's English seed. */
const SEEDS_ITSELF = '@seeds-itself';

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

/** The width this project runs at, and whether the three panes (D-444) are meant to be on at it — which, since they start under D-253's split, is what the split's widths are now too. */
function viewport(page: Page): { width: number; height: number; panes: boolean } {
  const size = page.viewportSize();
  if (!size) throw new Error('this project has no viewport');
  return { ...size, panes: size.width >= HOME_THREE_PANE_MIN_PX };
}

/**
 * R76 (FR-FIRST-5, D-444): with a pass open at three-pane widths, the guide is
 * the first two panes' width — at least 72 cells — beside the list in the
 * third, the list still on the page and `[ list ]` with nothing to do.
 */
async function expectThePanes(page: Page, cell: number): Promise<void> {
  const list = page.getByTestId('list-column');
  await expect(list).toBeVisible();
  await expect(page.getByTestId('guide-to-list')).toBeHidden();
  await expect(page.getByTestId('reading-where')).toBeHidden();
  const [listBox, guide, main] = await Promise.all([list.boundingBox(), page.getByTestId('guide-panel').boundingBox(), page.getByRole('main').boundingBox()]);
  if (!listBox || !guide || !main) throw new Error('the panes are not laid out');
  expect(guide.width).toBeGreaterThanOrEqual(GUIDE_PANE_MIN_CELLS * cell - 1);
  // The first pane starts where the shell's content does, inside its side padding.
  expect(Math.abs(guide.x - (main.x + SHELL_PADDING_CELLS * cell))).toBeLessThanOrEqual(1);
  expect(listBox.x).toBeGreaterThan(guide.x + guide.width - 1);
  // Two panes and the gutter between them: twice the list's pane and a gutter, to the pixel.
  expect(Math.abs(guide.width - (2 * listBox.width + GUTTER_CELLS * cell))).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'the page scrolls sideways with the panes').toBeLessThanOrEqual(1);
}

async function openTheGuide(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /Open guide/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#pass=/);
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

  // The three literals, in this browser's own cells.
  expect(WIDE_MIN_PX / cell).toBeGreaterThanOrEqual(WIDE_CELLS);
  expect(HOME_THREE_PANE_MIN_PX / cell).toBeGreaterThanOrEqual(HOME_THREE_PANE_MIN_CELLS + 2 * GUTTER_CELLS);
  expect(WIDE_SPLIT_MIN_PX / cell).toBeGreaterThanOrEqual(LEFT_COLUMN_CELLS + LIST_MIN_CELLS + GUIDE_MIN_CELLS + 2 * GUTTER_CELLS);
  // And the page really is in the wide shell at this project's width: two columns, or from the
  // three-pane literal three panes (R76), each to the right of the one before.
  const { width, panes } = viewport(page);
  expect(width).toBeGreaterThanOrEqual(WIDE_MIN_PX);
  const ids = panes ? ['reading-where', 'reading-when', 'list-column'] : ['col-left', 'col-right'];
  const boxes = await Promise.all(ids.map((id) => page.getByTestId(id).boundingBox()));
  for (const [i, box] of boxes.entries()) {
    if (!box) throw new Error(`${ids[i] ?? ''} is not laid out`);
    const before = boxes[i - 1];
    if (before) expect(box.x).toBeGreaterThan(before.x + before.width - 1);
  }
});

/**
 * F-6. Below the split width the guide had the column's leftovers after the
 * list's 44-cell floor — 43 to 107 px of it between 960 px and about 1350 px,
 * a chart in a slot narrower than the word beneath it. It takes the column
 * instead, and the list is one `[ list ]` away.
 */
test('an open guide either splits the column with the list or takes it whole, by the width (F-6)', async ({ page }) => {
  const { panes } = viewport(page);
  const cell = await cellPx(page);
  const list = page.getByTestId('list-column');
  const panel = page.getByTestId('guide-panel');
  const toList = page.getByTestId('guide-to-list');

  await expect(list).toBeVisible();
  await openTheGuide(page);
  await expect(panel).toBeVisible();

  // R76 (D-444): from the three-pane width the guide is the first two panes, not a track of the right column.
  if (panes) {
    await expectThePanes(page, cell);
    return;
  }

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
 * R76 (D-444): the split literal is a three-pane width now, where the guide is
 * the first two panes and the list the third; the claim that survives from
 * D-253 is the one about the margin — nothing runs off the screen and the page
 * does not scroll sideways. The three-pane literal itself is the width that can
 * disprove the new one: at it the panes have exactly the cells they count.
 */
for (const literal of [HOME_THREE_PANE_MIN_PX, WIDE_SPLIT_MIN_PX]) {
  test(`at ${String(literal)} px an open pass is the first two panes and the page does not scroll sideways (D-444)`, async ({ page }) => {
    await page.setViewportSize({ width: literal, height: 800 });
    const cell = await cellPx(page);
    await openTheGuide(page);
    await expect(page.getByTestId('guide-panel')).toBeVisible();
    await expectThePanes(page, cell);
    const guide = await page.getByTestId('guide-panel').boundingBox();
    if (!guide) throw new Error('the guide is not laid out');
    expect(guide.x + guide.width, 'the guide runs off the screen').toBeLessThanOrEqual(literal + 1);
  });
}

/**
 * F-9. The list's height was a fixed 34 rows — 816 px, taller than the 720 px
 * of a laptop screen — so the page scrolled underneath a list that was already
 * scrolling. It is the shell's height now (D-119), which is a fact about a
 * viewport and exists nowhere in the DOM.
 */
test('the list is as tall as the shell and no taller, with a pass open and without (F-9)', async ({ page }) => {
  const { height, panes } = viewport(page);
  const list = page.getByTestId('list-column');

  const listFitsTheScreen = async (state: string): Promise<void> => {
    const box = await list.boundingBox();
    if (!box) throw new Error(`the list is not laid out ${state}`);
    expect(box.y + box.height, `the list overflows the viewport ${state}`).toBeLessThanOrEqual(height + 1);
    // The page itself does not scroll: the list does (D-119).
    expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight), `the page scrolls ${state}`).toBeLessThanOrEqual(1);
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight), `the list is not the one scrolling ${state}`).toBe(true);
  };

  // The recompute replaces the stored list as it streams in, and would fold the nights opened below.
  await listSettled(page);
  // FR-FIRST-11 as amended v2.6 (R130): the Where pane has no dome at any width; the Both door does its job.
  await expect(page.getByTestId('reading-where').getByTestId('where-dome')).toHaveCount(0);
  await expect(page.getByTestId('door-live')).toHaveAttribute('href', '#live');
  // The one-line cards (FR-FIRST-10) leave tonight alone shorter than a laptop's list: every night open, as a
  // reader planning the three would have them, is the list this is about.
  const closed = page.locator('[data-testid="night-toggle"][aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
  await listFitsTheScreen('with no pass open');
  await openTheGuide(page);
  // Below the three panes the list is off the page while the guide is up; `[ list ]`
  // is how the reader has both a pass open and the list in front of them.
  if (!panes) await page.getByTestId('guide-to-list').click();
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
 * live page, the stars page, the pass detail and the settings page, as the home — holds `HOME_MAX_CELLS` and is
 * centred: each of its rows (the header, `main`, the footer where it has one; the live page's grid, which holds its
 * own landmarks) is 160 cells wide and stands in the middle of the viewport, and the sky's box stands inside it. At
 * 1280 px, under the cap, nothing moves: every row is the viewport's width. Both languages; the 1280 project only
 * (the sizes are this describe's own).
 */
type DeskPage = 'live' | 'stars' | 'pass' | 'settings';
const DESK_PAGES: readonly DeskPage[] = ['live', 'stars', 'pass', 'settings'];

async function openDeskPage(page: Page, target: DeskPage, locale: 'en' | 'es'): Promise<void> {
  await seedStoredRun(page, { locale, settled: true });
  if (target === 'pass') {
    await page
      .getByRole('button', { name: locale === 'es' ? /Abrir la guía/ : /Open guide/ })
      .first()
      .click();
    await expect(page.getByTestId('guide-panel')).toBeVisible();
    await expect(page.getByTestId('pass-layout').locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
    return;
  }
  await page.goto(`/#${target}`);
  if (target === 'live') {
    await expect(page.getByTestId('live-layout').locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
  } else if (target === 'stars') {
    await expect(page.getByTestId('stars-layout').locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
  } else {
    await expect(page.getByTestId('settings-back')).toBeVisible();
  }
}

/**
 * The page's rows, `#root`'s own children that carry its content: the live page's grid (which holds its own
 * landmarks), or the header, `main` and — on every page but the stars page, which has none — the footer, plus the
 * page notices where they say something. Every expected row must be there, so a row moved out of `#root` fails.
 */
async function contentRows(page: Page, target: DeskPage): Promise<{ name: string; x: number; width: number }[]> {
  const required = target === 'live' ? ['[data-testid="live-page"]'] : target === 'stars' ? ['#root > header', '#root > main'] : ['#root > header', '#root > main', '#root > footer'];
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
  const layout = target === 'live' ? 'live-layout' : target === 'stars' ? 'stars-layout' : 'pass-layout';
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

/**
 * R166 (FR-CLEAN-16, D-1017): on a desk the three doors are the home's main navigation and look it. Each title is
 * a pane heading's size (`--text-pane`, 20 px), its lines the body's (`--text-body`, 16 px), the frame a control's
 * edge (`--border-control`); on hover the frame and the title take the accent. The 1280 project only.
 */
test.describe('FR-CLEAN-16: the doors stand out on a desk', { tag: SEEDS_ITSELF }, () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('pane-sized titles, body-sized lines, a control frame, the accent on hover', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'the size is this test’s own: the 1024 project has nothing to add');
    await seedStoredRun(page, { settled: true });
    /** A token resolved to the colour the browser computes, so it compares with a computed style. */
    const token = (name: string) =>
      page.evaluate((property) => {
        const probe = document.createElement('span');
        probe.style.color = `var(${property})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, name);
    const [edge, accent, fg] = await Promise.all([token('--edge'), token('--accent'), token('--fg')]);
    for (const id of ['door-satellites', 'door-stars', 'door-live']) {
      const door = page.getByTestId(id);
      await expect(door).toBeVisible();
      const title = door.locator('span').first();
      const look = () =>
        door.evaluate((el) => {
          const [first, second] = [el.children[0], el.children[1]];
          if (!first || !second) throw new Error('the door has no title and line');
          const box = getComputedStyle(el);
          return { frame: box.borderTopColor, width: box.borderTopWidth, title: getComputedStyle(first).fontSize, titleColour: getComputedStyle(first).color, line: getComputedStyle(second).fontSize };
        });
      const rest = await look();
      expect(rest.title, `${id}'s title`).toBe('20px');
      expect(rest.line, `${id}'s line`).toBe('16px');
      expect(rest.frame, `${id}'s frame at rest`).toBe(edge);
      expect(rest.titleColour, `${id}'s title at rest`).toBe(fg);
      await title.hover();
      await expect.poll(async () => (await look()).frame, `${id}'s frame on hover`).toBe(accent);
      expect((await look()).titleColour, `${id}'s title on hover`).toBe(accent);
    }
  });

  // D-1017: a body-sized line does not fit a third of a narrow desk, so it wraps rather than being cut, and the
  // three boxes stay as tall as the tallest.
  for (const width of [964, 1024, 1118, 1280]) {
    for (const locale of ['en', 'es'] as const) {
      test(`at ${String(width)} px in ${locale} no door line is cut and the three boxes are one height`, async ({ page }, info) => {
        test.skip(info.project.name !== 'chromium', 'the sizes are this test’s own');
        await page.setViewportSize({ width, height: 800 });
        await seedStoredRun(page, { locale, settled: true });
        await expect(page.getByTestId('door-stars-line')).toHaveCount(3);
        await expect(page.locator('[data-testid^="door-"][data-pending]')).toHaveCount(0);
        const doors = await page.evaluate(() =>
          ['door-satellites', 'door-stars', 'door-live'].map((id) => {
            const door = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
            if (!door) throw new Error(`${id} is not on the page`);
            const cut = [...door.querySelectorAll<HTMLElement>(`[data-testid="${id}-line"]`)].filter((line) => line.scrollWidth > line.clientWidth + 1).map((line) => line.textContent);
            return { id, cut, height: door.getBoundingClientRect().height };
          }),
        );
        for (const door of doors) expect(door.cut, `${door.id} cuts a line`).toEqual([]);
        const heights = doors.map((door) => door.height);
        expect(Math.max(...heights) - Math.min(...heights), 'the three boxes differ in height').toBeLessThanOrEqual(1);
      });
    }
  }
});
