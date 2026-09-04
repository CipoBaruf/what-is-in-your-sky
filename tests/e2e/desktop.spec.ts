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
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

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
/** FR-DESK-1: 100 cells, and `--cell` is one character advance (D-71). */
const WIDE_MIN_PX = 960;
const WIDE_CELLS = 100;
const LEFT_COLUMN_CELLS = 40;
const LIST_MIN_CELLS = 44;

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

async function loadWithPasses(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });
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
  await expect(page.getByRole('region', { name: 'Upcoming passes' })).toBeVisible();

  const footer = page.getByRole('contentinfo');
  const box = await footer.boundingBox();
  if (!box) throw new Error('the footer is not laid out');
  expect(Math.abs(box.y + box.height - TALL_HEIGHT)).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight),
  ).toBeLessThanOrEqual(1);
  // And it is the footer that moved, not the content: the columns stay at the top.
  const left = await page.getByTestId('col-left').boundingBox();
  expect(left?.y).toBeLessThan(TALL_HEIGHT / 2);
});

test('wide: two columns, the guide beside a live list, Escape and the hash (FR-DESK-1/2/3)', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(golden.start.t)}`;
  await loadWithPasses(page);

  // FR-DESK-1: the breakpoint the stylesheet uses really is 100 cells wide here.
  const cell = await cellPx(page);
  expect(Math.abs(WIDE_CELLS * cell - WIDE_MIN_PX)).toBeLessThanOrEqual(cell / 2);

  // FR-DESK-2: two columns side by side, the left one 40 cells, the header spanning both.
  const left = page.getByTestId('col-left');
  const right = page.getByTestId('col-right');
  const [leftBox, rightBox, headerBox] = await Promise.all([left.boundingBox(), right.boundingBox(), page.getByRole('banner').boundingBox()]);
  if (!leftBox || !rightBox || !headerBox) throw new Error('the columns are not laid out');
  expect(Math.abs(leftBox.width - LEFT_COLUMN_CELLS * cell)).toBeLessThanOrEqual(1);
  expect(rightBox.x).toBeGreaterThan(leftBox.x + leftBox.width);
  expect(Math.abs(leftBox.y - rightBox.y)).toBeLessThanOrEqual(1);
  expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(leftBox.y);
  expect(headerBox.width).toBeGreaterThan(leftBox.width + rightBox.width);
  await expect(left.getByRole('region', { name: 'Location' })).toBeVisible();
  await expect(left.getByRole('region', { name: 'Right now' })).toBeVisible();
  await expect(right.getByRole('region', { name: 'Upcoming passes' })).toBeVisible();

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
  expect(panelBox.x).toBeGreaterThan(listBox.x + listBox.width - 1);
  expect(listBox.width).toBeGreaterThanOrEqual(LIST_MIN_CELLS * cell - 1);
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
  // Nothing behind it is inert, and the page itself still scrolls (the sheet's lock is compact-only).
  expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
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

  // The shell is exactly the viewport, and the left column reaches the footer
  // rather than stopping at the Now panel (the dead space D-119 removes).
  const [leftNow, rightNow] = await Promise.all([
    page.getByTestId('col-left').boundingBox(),
    page.getByTestId('col-right').boundingBox(),
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
  const [footerLine, leftBox2] = await Promise.all([footer.locator('p').boundingBox(), page.getByTestId('col-left').boundingBox()]);
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

  // Escape closes it and clears the hash; the right column is one column again.
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page).not.toHaveURL(/#pass=/);
  const closedBox = await page.getByTestId('list-column').boundingBox();
  expect(closedBox?.width).toBeGreaterThan(listBox.width);
  // D-119 is scoped to an open pass: the list on its own is an ordinary long
  // page again, scrolling as one rather than inside a bounded shell.
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight),
  ).toBe(true);
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
  // The capture is only evidence once the lazy chart chunk has drawn.
  await expect(panel.locator(`svg[data-drawing="polar"] [data-pass-id="${passId}"] [data-anchor="pass"]`)).toContainText('ISS (Zarya)');
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
  // The compact sheet on this branch, for the PR: the MVP one, unchanged.
  await expect(sheet.locator(`svg[data-drawing="polar"] [data-pass-id="${passId}"] [data-anchor="pass"]`)).toContainText('ISS (Zarya)');
  await page.screenshot({ path: 'test-results/r23-guide-390-en.png' });

  await page.setViewportSize(WIDE);
  await expect(page.getByTestId('guide-panel')).toHaveAttribute('data-pass-id', passId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#pass=${passId}$`));
});
