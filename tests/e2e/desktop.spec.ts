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
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { GUIDE_PANE_MIN_CELLS, WIDE_CELLS, WIDE_MIN_PX } from '../../src/lib/layout';
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
/** A desktop screen with room to spare, where D-119's slack is visible at all. */
const TALL_HEIGHT = 1200;
const LEFT_COLUMN_CELLS = 40;
/** FR-FIRST-5: a pane is at least the compact card's 36 cells. */
const PANE_MIN_CELLS = 36;
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
  await seedStoredRun(page);
}

/**
 * D-119: the shortest the wide page ever is — nothing entered, so no list, no
 * Now panel and three paragraphs in the left column. The footer belongs on
 * the bottom of the screen there, not under the last paragraph with the
 * ground showing below it, and the page still must not scroll to manage it.
 */
test('wide: with nothing entered the page still fills the screen and the footer sits on the bottom (D-119)', async ({ page }) => {
  // Tall enough that the empty page does not fill it on its own: at 900 px the
  // left column's own paragraphs already overflow and the page rightly
  // scrolls, so there would be no slack to put anywhere.
  await page.setViewportSize({ width: WIDE.width, height: TALL_HEIGHT });
  await page.goto('/');
  // R76 (FR-FIRST-1): nothing entered is the cold open.
  await expect(page.getByTestId('cold-open')).toBeVisible();

  const footer = page.getByRole('contentinfo');
  const box = await footer.boundingBox();
  if (!box) throw new Error('the footer is not laid out');
  expect(Math.abs(box.y + box.height - TALL_HEIGHT)).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight),
  ).toBeLessThanOrEqual(1);
  // And it is the footer that moved, not the content: the panes stay at the top. R76 (board 1B): the cold open is
  // the Where pane of the three-pane grid, whose column wrappers are `display: contents`, so the pane is measured.
  const where = await page.getByTestId('cold-open').boundingBox();
  expect(where?.y).toBeLessThan(TALL_HEIGHT / 2);
});

/**
 * D-119: with a list and no pass open — the ordinary state of the page — the
 * scroll belongs to the list and to nothing else. The header keeps the two
 * switches reachable, the left column keeps saying what the list is of, and
 * the footer stays on the bottom of the screen.
 */
test('wide: with a list and no pass open, only the list scrolls (D-119)', async ({ page }) => {
  await loadWithPasses(page);

  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight),
  ).toBeLessThanOrEqual(1);

  const list = page.getByTestId('list-column');
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.evaluate((el) => {
    el.scrollTop = 300;
  });
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Scrolling the list moved nothing else: the header, the Where pane and the
  // footer are where they were, and the footer is on the bottom of the screen.
  const [header, left, footer] = await Promise.all([
    page.getByRole('banner').boundingBox(),
    page.getByTestId('reading-where').boundingBox(),
    page.getByRole('contentinfo').boundingBox(),
  ]);
  if (!header || !left || !footer) throw new Error('the shell is not laid out');
  expect(header.y).toBeGreaterThanOrEqual(0);
  expect(left.y).toBeLessThan(WIDE.height / 2);
  expect(Math.abs(footer.y + footer.height - WIDE.height)).toBeLessThanOrEqual(1);
});

test('wide: two columns at the mid width, the guide beside a live list in three panes, Escape and the hash (FR-DESK-1/2/3, FR-FIRST-5)', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(golden.start.t)}`;
  await page.setViewportSize(MID);
  // Settled: this test resizes the page between its halves, long enough for the recompute behind the stored run
  // to land mid-test and re-render the list between reading a card's id and clicking it.
  await seedStoredRun(page, { settled: true });

  // FR-DESK-1: the breakpoint the stylesheet uses really is 100 cells wide
  // here. R50 (F-10): "at least", not "exactly" — one literal is a different
  // number of cells on each font of the stack, and `wide.spec.ts` is where
  // that is measured against `lib/layout.ts`'s table.
  const cell = await cellPx(page);
  expect(WIDE_MIN_PX / cell).toBeGreaterThanOrEqual(WIDE_CELLS);
  expect(WIDE_MIN_PX / cell).toBeLessThan(WIDE_CELLS + 1);

  // FR-DESK-2: two columns side by side, the left one 40 cells, the header spanning both —
  // with Where above When in the left one and What at the right (FR-FIRST-5).
  const left = page.getByTestId('col-left');
  const right = page.getByTestId('col-right');
  const [leftBox, rightBox, headerBox] = await Promise.all([left.boundingBox(), right.boundingBox(), page.getByRole('banner').boundingBox()]);
  if (!leftBox || !rightBox || !headerBox) throw new Error('the columns are not laid out');
  expect(Math.abs(leftBox.width - LEFT_COLUMN_CELLS * cell)).toBeLessThanOrEqual(1);
  expect(rightBox.x).toBeGreaterThan(leftBox.x + leftBox.width);
  expect(Math.abs(leftBox.y - rightBox.y)).toBeLessThanOrEqual(1);
  expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(leftBox.y);
  expect(headerBox.width).toBeGreaterThan(leftBox.width + rightBox.width);
  const [where, when] = [left.getByTestId('reading-where'), left.getByTestId('reading-when')];
  const [whereBox, whenBox] = await Promise.all([where.boundingBox(), when.boundingBox()]);
  if (!whereBox || !whenBox) throw new Error('the readings are not laid out');
  expect(whenBox.y).toBeGreaterThanOrEqual(whereBox.y + whereBox.height);
  await where.getByTestId('location-summary-change').click();
  await expect(where.getByRole('region', { name: 'Location' })).toBeVisible();
  // R81 (FR-FIRST-9): the Now panel's facts are the When reading's conditions table.
  await expect(left.getByTestId('reading-when').getByTestId('conditions')).toBeVisible();
  await expect(right.getByRole('region', { name: 'Upcoming passes' })).toBeVisible();

  // FR-FIRST-5: at 1280 px the three readings are three equal panes, side by side on one band.
  await page.setViewportSize(WIDE);
  const panes = await Promise.all(['reading-where', 'reading-when', 'list-column'].map((id) => page.getByTestId(id).boundingBox()));
  const [p1, p2, p3] = panes;
  if (!p1 || !p2 || !p3) throw new Error('the panes are not laid out');
  expect(p2.x).toBeGreaterThan(p1.x + p1.width - 1);
  expect(p3.x).toBeGreaterThan(p2.x + p2.width - 1);
  for (const pane of [p2, p3]) {
    expect(Math.abs(pane.width - p1.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(pane.y - p1.y)).toBeLessThanOrEqual(1);
  }
  expect(p1.width).toBeGreaterThanOrEqual(PANE_MIN_CELLS * cell - 1);

  // FR-DESK-3: the guide opens beside the list, not over it.
  const card = page.locator(`article[data-pass-id="${passId}"]`);
  await card.getByRole('button', { name: /Open guide/ }).click();
  await expect(page).toHaveURL(new RegExp(`#pass=${passId}$`));
  const panel = page.getByTestId('guide-panel');
  await expect(panel).toHaveAttribute('data-pass-id', passId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(panel.getByTestId('guide-sentence')).toBeVisible();

  const list = page.getByTestId('list-column');
  const [listBox, panelBox] = await Promise.all([list.boundingBox(), panel.boundingBox()]);
  if (!listBox || !panelBox) throw new Error('the guide is not laid out beside the list');
  // D-444: the guide is the first two panes, the list the third.
  expect(listBox.x).toBeGreaterThan(panelBox.x + panelBox.width - 1);
  expect(listBox.width).toBeGreaterThanOrEqual(PANE_MIN_CELLS * cell - 1);
  expect(panelBox.width).toBeGreaterThanOrEqual(GUIDE_PANE_MIN_CELLS * cell - 1);
  expect(Math.abs(panelBox.x - p1.x)).toBeLessThanOrEqual(1);
  // They share the same band of the page: the guide is beside the list, not under it.
  expect(Math.abs(listBox.y - panelBox.y)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The list is still on screen, still scrolling itself, with the open pass marked.
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-current', 'true');
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.evaluate((el) => {
    el.scrollTop = 200;
  });
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // Nothing behind it is inert, and the page itself still scrolls (the sheet's lock is compact-only). The Where
  // dome's drawing is inert inside its own link (D-512), which is the dome's business and not the guide's.
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('[inert]')).filter((el) => !el.closest('[data-testid="where-dome"]')).length)).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');

  // A second pass replaces the guide in place, and the highlight moves with it.
  const others = page.locator('ol article[data-pass-id]');
  const secondId = await others.first().getAttribute('data-pass-id');
  await others.first().getByRole('button', { name: /Open guide/ }).click();
  await expect(panel).toHaveAttribute('data-pass-id', String(secondId));
  await expect(card).not.toHaveAttribute('aria-current', 'true');

  // D-119: the page itself does not scroll with a pass open — every pane that
  // can outgrow the viewport carries its own scrollbar instead, so nothing
  // scrolls the guide out from under the list or the list out from under the
  // guide. One pixel of slack for sub-pixel row heights.
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight),
  ).toBeLessThanOrEqual(1);

  // The shell is exactly the viewport, and the guide reaches the footer as the
  // list does rather than stopping at its content (the dead space D-119 removes).
  const [leftNow, rightNow] = await Promise.all([
    page.getByTestId('guide-panel').boundingBox(),
    page.getByTestId('list-column').boundingBox(),
  ]);
  if (!leftNow || !rightNow) throw new Error('the columns are not laid out');
  expect(Math.abs(leftNow.height - rightNow.height)).toBeLessThanOrEqual(1);
  expect(leftNow.y + leftNow.height).toBeLessThanOrEqual(WIDE.height + 1);

  // D-120: the footer is one row, left-aligned with the columns above it (an
  // auto margin inside the shell's grid had it shrink to its text and centre),
  // and it still names and links every source it is used under.
  const footer = page.getByRole('contentinfo');
  await expect(footer).toHaveAttribute('data-form', 'short');
  expect(await footer.locator('p').count()).toBe(1);
  // The line itself, not the footer's border box: both carry the same two
  // cells of side padding, and it is the text that has to line up.
  const [footerLine, leftBox2] = await Promise.all([footer.locator('p').boundingBox(), page.getByTestId('guide-panel').boundingBox()]);
  if (!footerLine || !leftBox2) throw new Error('the footer is not laid out');
  expect(Math.abs(footerLine.x - leftBox2.x)).toBeLessThanOrEqual(1);
  for (const name of ['CelesTrak', 'Open-Meteo.com', 'GeoNames']) {
    await expect(footer.getByRole('link', { name })).toBeVisible();
  }
  await expect(footer).toContainText('CC BY 4.0');
  await expect(footer.getByRole('link', { name: 'Ezequiel Baruf' })).toHaveAttribute('href', 'https://github.com/CipoBaruf');

  // The guide's body scrolls itself, and its head stays where it is while it does.
  const body = panel.getByTestId('guide-body');
  // It opens at the top and its first line is whole: nothing inside may start
  // above the box that clips it (`.meta` pulls itself half a row up for the
  // compact sheet, and did exactly that here).
  expect(await body.evaluate((el) => el.scrollTop)).toBe(0);
  expect(
    await body.evaluate((el) => {
      const first = el.firstElementChild;
      return first ? first.getBoundingClientRect().top - el.getBoundingClientRect().top : -1;
    }),
  ).toBeGreaterThanOrEqual(0);
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const headBefore = await panel.getByRole('heading', { level: 2 }).boundingBox();
  await body.evaluate((el) => {
    el.scrollTop = 200;
  });
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const headAfter = await panel.getByRole('heading', { level: 2 }).boundingBox();
  expect(Math.abs((headAfter?.y ?? 0) - (headBefore?.y ?? -1))).toBeLessThanOrEqual(1);
  // Scrolling the guide has not moved the list, and the page still has not scrolled.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Escape closes it and clears the hash; the Where and When panes come back (D-444).
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page).not.toHaveURL(/#pass=/);
  await expect(page.getByTestId('reading-where')).toBeVisible();
  await expect(page.getByTestId('reading-when')).toBeVisible();
  const closedBox = await page.getByTestId('list-column').boundingBox();
  expect(Math.abs((closedBox?.width ?? 0) - listBox.width)).toBeLessThanOrEqual(1);
  // The shell is the wide layout, not a mode a pass puts it into: closing the
  // guide gives the two panes back and changes nothing about the scroll.
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight),
  ).toBeLessThanOrEqual(1);
  expect(await page.getByTestId('list-column').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
});

/**
 * FR-DESK-5: the captures the PR is compared against the mockup with, in both
 * languages. Viewport-sized, like the mockup's own frames, and taken from the
 * same two states it fixes — nothing selected, and a pass open.
 */
test('captures the wide layout in both languages, list and guide (FR-DESK-5)', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(golden.start.t)}`;
  await loadWithPasses(page);
  await page.screenshot({ path: 'test-results/r23-home-1280-en.png' });

  await page.locator(`article[data-pass-id="${passId}"]`).getByRole('button', { name: /Open guide/ }).click();
  const panel = page.getByTestId('guide-panel');
  // The capture is only evidence once the lazy chart chunk has drawn. R21 (FR-DOME-7): that chart is the dome.
  await expect(panel.locator(`[data-layer="lines"] [data-pass-id="${passId}"][data-anchor="key"]`)).toHaveText('A', { timeout: 30_000 });
  // R45 (FR-LEG-2) / R51 (FR-LEG-3): the legend is under the drawing in the 40-cell guide column, and the explained
  // pass's row there is the numeric table, carrying the drawing's key.
  await expect(panel.getByTestId('legend-lead').getByRole('table')).toBeVisible();
  await expect(panel.getByTestId('legend-lead').locator('caption')).toContainText('A');
  await expect(panel.getByTestId('chart-legend').locator(`button[data-pass-id="${passId}"]`)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/r23-guide-1280-en.png' });

  // FR-I18N-2: the header switch, which the wide header carries at the right (FR-DESK-2).
  await page.getByRole('banner').getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
  await expect(panel.getByRole('button', { name: 'Cerrar la guía' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Próximos pases' })).toBeVisible();
  await page.screenshot({ path: 'test-results/r23-guide-1280-es.png' });

  await panel.getByRole('button', { name: 'Cerrar la guía' }).click();
  await expect(panel).toHaveCount(0);
  await page.screenshot({ path: 'test-results/r23-home-1280-es.png' });
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

/**
 * R51 (FR-LEG-3, D-259): the guide column grows with the screen (`1.05fr`,
 * D-253), so on a large desktop the chart frame passes D-232's 62 cells and
 * the legend would move into the 24-cell column beside the drawing. That is
 * right for a list of passes and wrong for the pass detail, where the legend
 * is a five-column table of figures: it folds, and the drawing is squeezed
 * beside it. Only a browser answers this — jsdom resolves no container query
 * — so the check is the measurement, at a width no other spec runs at.
 */
test('the detail table stays under the drawing on a large desktop, however wide the guide column gets (D-259)', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(golden.start.t)}`;
  await page.setViewportSize({ width: 1920, height: 1080 });
  await loadWithPasses(page);
  await page.locator(`article[data-pass-id="${passId}"]`).getByRole('button', { name: /Open guide/ }).click();
  const panel = page.getByTestId('guide-panel');
  await expect(panel.locator(`[data-layer="lines"] [data-pass-id="${passId}"][data-anchor="key"]`)).toHaveText('A', { timeout: 30_000 });

  // The frame is past the threshold — so this is the case the rule has to exclude, not a width where it never applied.
  const frame = await panel.getByTestId('chart-frame').boundingBox();
  const cell = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:100ch';
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return width;
  });
  if (!frame) throw new Error('no chart frame');
  expect(frame.width / cell).toBeGreaterThan(62);

  const box = await panel.getByTestId('chart-box').boundingBox();
  const lead = await panel.getByTestId('legend-lead').boundingBox();
  if (!box || !lead) throw new Error('no chart box or table');
  expect(lead.y).toBeGreaterThanOrEqual(box.y + box.height);
  // And it has the frame's width to lay its five columns out in, not a 24-cell column.
  expect(lead.width).toBeGreaterThan(frame.width * 0.8);
});
