/**
 * R93 (FR-HOME-1..4; D-546, D-604..D-608; F-76, F-79): the home page at desk
 * widths. What only a browser can answer: whether a header line wraps, where a
 * block lands against the viewport, whether a pane scrolls, and how wide the
 * page is once it stops growing.
 *
 * - FR-HOME-1: at 964, 1024, 1118 and 1280 px in both languages the header's
 *   height is one of two values — with its tagline line or without — and the
 *   title row's children stand on one line.
 * - FR-HOME-2: at 1024 × 768 and 1280 × 800 in both languages the next event —
 *   since R130 (FR-FLOW-1) the Satellites door's — is wholly inside the viewport
 *   on load, and the three doors are one row above the panes.
 * - FR-HOME-3: at 1118 × 700, 1280 × 800 and 1920 × 1080 Where and When do not
 *   scroll, and Where's lines are on screen; no dome (FR-FIRST-11 as amended).
 * - FR-HOME-4: at 1920 and 2560 px the content is `HOME_MAX_CELLS` wide and
 *   centred, the panes equal.
 *
 * R102 (FR-HOME-3 as amended v2.2, D-681): the fourth credit makes the wide footer two lines under
 * `FOOTER_ONE_LINE_MIN_PX`, and the shell pays that row from its padding; FR-HOME-2 and FR-HOME-3 keep
 * their sizes above, unchanged, and this file is what proves it in both languages.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { HEADER_FOLD_PX, HOME_MAX_CELLS, HOME_THREE_PANE_MIN_PX, WIDE_MIN_PX } from '../../src/lib/layout';
import { seedStoredRun } from './liveHelpers';

const LOCALES = ['en', 'es'] as const;
type Locale = (typeof LOCALES)[number];

/** `--row`, 24 px at the 16 px base (`tokens.css`); the header's rows are counted in it. */
const ROW = 24;
/** The wide header: a row of padding, the title row, a row of padding and the hairline rule… */
const HEADER_WITHOUT_TAGLINE = 3 * ROW + 1;
/** …and with the tagline, its quarter-row margin and its line (`Header.module.css`). */
const HEADER_WITH_TAGLINE = HEADER_WITHOUT_TAGLINE + ROW / 4 + ROW;

/** One character advance, as this browser resolves the app's own monospace stack (`wide.spec.ts`). */
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

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error(`${String(locator)} is not laid out`);
  return rect;
}

/**
 * FR-FLAG-1 (D-183): the Moon's tradition line is the flag's experiment, off in the shipped build and on in
 * CI's e2e build so `moon.spec.ts` covers it. FR-HOME-2 and FR-HOME-3 are board 1B's When, which does not draw
 * it, so the pane is measured without that block and the gap it costs: zero where it is not on the page.
 */
async function loreAllowancePx(pane: Locator): Promise<number> {
  return pane.evaluate((element) => {
    const lore = element.querySelector<HTMLElement>('[data-testid="moon-lore"]');
    const gap = parseFloat(getComputedStyle(element).rowGap) || 0;
    return lore ? lore.getBoundingClientRect().height + gap : 0;
  });
}

/** The pane's content against its box: what it would scroll by, the tradition line discounted. */
async function overflowPx(pane: Locator): Promise<number> {
  const allowance = await loreAllowancePx(pane);
  return pane.evaluate((element, discount) => element.scrollHeight - discount - element.clientHeight, allowance);
}

async function openHome(page: Page, width: number, height: number, locale: Locale): Promise<void> {
  await page.setViewportSize({ width, height });
  await seedStoredRun(page, { locale });
  await expect(page.getByTestId('reading-when')).toBeVisible();
  await expect(page.getByTestId('door-satellites')).toBeVisible();
  // The When pane's late blocks — the flag's tradition line rides on a lazy chunk and the Moon's state — are
  // in before anything is measured: the pane's content is read until it has stood still for a moment.
  await page.waitForLoadState('networkidle');
  const when = page.getByTestId('reading-when');
  let last = -1;
  for (let i = 0; i < 20; i += 1) {
    const now = await when.evaluate((el) => el.scrollHeight);
    if (now === last) break;
    last = now;
    await page.waitForTimeout(250);
  }
}

test.describe('FR-HOME-1: the header holds', () => {
  for (const width of [WIDE_MIN_PX, 1024, HOME_THREE_PANE_MIN_PX, 1280] as const) {
    for (const locale of LOCALES) {
      test(`at ${String(width)} px in ${locale}: one title line, at most one tagline line`, async ({ page }) => {
        await openHome(page, width, 800, locale);
        const header = page.getByTestId('header');
        const height = (await box(header)).height;
        expect([HEADER_WITHOUT_TAGLINE, HEADER_WITH_TAGLINE]).toContain(Math.round(height));
        // The tagline is the difference between the two values, and the only thing that may go.
        const tagline = header.getByText(locale === 'es' ? /^Pases de satélites/ : /^Naked-eye satellite/);
        if (Math.round(height) === HEADER_WITH_TAGLINE) await expect(tagline).toBeVisible();
        else await expect(tagline).toBeHidden();
        // The title row: the mark, the title, `[ Live sky ]`, and the language and theme controls, on one line.
        // Their boxes are the 48 px tap boxes centred on the title's line, so each holds the title's line box.
        const title = header.getByRole('heading', { level: 1 });
        const titleBox = await box(title);
        const others = [page.getByTestId('live-link'), header.getByRole('group', { name: locale === 'es' ? 'Idioma' : 'Language' }), header.getByRole('group', { name: locale === 'es' ? 'Tema' : 'Theme' })];
        for (const other of others) {
          const rect = await box(other);
          expect(rect.y, `${String(other)} starts under the title's line`).toBeLessThanOrEqual(titleBox.y + 1);
          expect(rect.y + rect.height, `${String(other)} ends above the title's line`).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
          expect(Math.abs(rect.y + rect.height / 2 - (titleBox.y + titleBox.height / 2)), `${String(other)} is not on the title's line`).toBeLessThanOrEqual(1);
        }
        // `[ Live sky ]` follows the title on that line rather than dropping under it (F-76).
        const live = await box(page.getByTestId('live-link'));
        expect(live.x).toBeGreaterThan(titleBox.x + titleBox.width - 1);
        // The short form is drawn only under the language's fold (D-605; R115, D-774: moved out by `[ stars ]`): both
        // languages at 1024 px, Spanish at the three panes too, neither at 1280.
        const drawn = await title.evaluate((h1) => getComputedStyle(h1, '::after').content);
        const folded = width < HEADER_FOLD_PX[locale].title;
        expect(drawn).toBe(folded ? `"${locale === 'es' ? 'Tu cielo' : 'Your sky'}"` : 'none');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      });
    }
  }
});

test.describe('FR-HOME-2: the next event is on screen', () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 800],
  ] as const) {
    for (const locale of LOCALES) {
      test(`at ${String(width)} × ${String(height)} in ${locale}: the doors are one row above the panes, the Satellites door wholly on screen`, async ({ page }) => {
        await openHome(page, width, height, locale);
        // R130 (FR-FLOW-1, D-843): the next event is the Satellites door's, and the block has left the home.
        await expect(page.getByTestId('next-event')).toHaveCount(0);
        const satellites = page.getByTestId('door-satellites');
        await expect(satellites).toBeInViewport({ ratio: 1 });
        const doors = await Promise.all(['door-satellites', 'door-stars', 'door-both'].map((id) => box(page.getByTestId(id))));
        const panes = await Promise.all(['reading-where', 'reading-when', 'list-column'].map((id) => box(page.getByTestId(id))));
        const top = Math.min(...panes.map((pane) => pane.y));
        for (const door of doors) {
          // One row of three equal boxes, every one above the panes.
          expect(Math.abs(door.y - (doors[0]?.y ?? NaN))).toBeLessThanOrEqual(1);
          expect(Math.abs(door.width - (doors[0]?.width ?? NaN))).toBeLessThanOrEqual(1);
          expect(door.y + door.height).toBeLessThanOrEqual(top);
        }
        expect(doors[1]?.x ?? 0).toBeGreaterThan((doors[0]?.x ?? 0) + (doors[0]?.width ?? 0) - 1);
        expect(doors[2]?.x ?? 0).toBeGreaterThan((doors[1]?.x ?? 0) + (doors[1]?.width ?? 0) - 1);
        // No dome in the Where pane (FR-FIRST-11 as amended).
        await expect(page.getByTestId('reading-where').getByTestId('where-dome')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      });
    }
  }
});

test.describe('FR-HOME-3: one pane scrolls', () => {
  for (const [width, height] of [
    [HOME_THREE_PANE_MIN_PX, 700],
    [1280, 800],
    [1920, 1080],
  ] as const) {
    for (const locale of LOCALES) {
      test(`at ${String(width)} × ${String(height)} in ${locale}: Where and When fit their panes, under the doors`, async ({ page }) => {
        await openHome(page, width, height, locale);
        const where = page.getByTestId('reading-where');
        const when = page.getByTestId('reading-when');
        // R130: no dome in the Where pane (FR-FIRST-11 as amended); the Both door does its job.
        await expect(where.getByTestId('where-dome')).toHaveCount(0);
        expect(await overflowPx(where), 'Where scrolls').toBeLessThanOrEqual(0);
        expect(await overflowPx(when), 'When scrolls').toBeLessThanOrEqual(0);
        // The Where pane's lines are all on screen: the elements line and the saved places (and the readiness line where it is shown).
        for (const line of ['elements-line', 'favourites']) await expect(where.getByTestId(line)).toBeInViewport({ ratio: 1 });
        if ((await where.getByTestId('readiness').count()) > 0) await expect(where.getByTestId('readiness')).toBeInViewport({ ratio: 1 });
      });
    }
  }
});

test.describe('FR-HOME-4: the page stops growing', () => {
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    test(`at ${String(width)} px: the content is ${String(HOME_MAX_CELLS)} cells wide and centred, the panes equal`, async ({ page }) => {
      await openHome(page, width, height, 'en');
      const cell = await cellPx(page);
      const [header, main, footer] = await Promise.all([box(page.getByTestId('header')), box(page.getByRole('main')), box(page.getByRole('contentinfo'))]);
      for (const [name, rect] of [
        ['header', header],
        ['main', main],
        ['footer', footer],
      ] as const) {
        expect(Math.abs(rect.width - HOME_MAX_CELLS * cell), `${name} is not ${String(HOME_MAX_CELLS)} cells wide`).toBeLessThanOrEqual(1);
        expect(Math.abs(rect.x - (width - rect.width) / 2), `${name} is not centred`).toBeLessThanOrEqual(1);
      }
      const panes = await Promise.all(['reading-where', 'reading-when', 'list-column'].map((id) => box(page.getByTestId(id))));
      for (const pane of panes.slice(1)) expect(Math.abs(pane.width - (panes[0]?.width ?? 0))).toBeLessThanOrEqual(1);
      expect(panes[2]?.x ?? 0).toBeLessThan(main.x + main.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
});
