/**
 * R76 (FR-FIRST-2, FR-FIRST-3, FR-FIRST-5, US-26, D-443, D-444): the home page
 * as three readings, where only a browser can answer.
 *
 * The first run on a phone: the cold open's one primary action, answered by a
 * stubbed `geolocation`, turns the page into the countdown without a
 * navigation — the same document, the same URL, no `#settings`. Then the three
 * readings at the three widths that decide their layout: 964 and 1024 px are
 * FR-DESK-2's two columns with Where above When, 1280 px is three equal panes.
 * And at 1280 × 800 an open pass takes the first two panes' width, with the list
 * still in the document beside it.
 */
import { expect, test, type Page } from '@playwright/test';
import { GUIDE_PANE_MIN_CELLS, HOME_THREE_PANE_MIN_PX, WIDE_MIN_PX } from '../../src/lib/layout';
import { ha, NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';

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

/** FR-FIRST-3 as amended v2.0.2: `Next up · in 3:45:07`, `Up now · peaks in 1:10`, `Up now · sets in 2:05`. */
const NEXT_LABEL = /^(Next up · in|Up now · (peaks|sets|enters shadow|fades) in) (\d+:)?\d\d?:\d\d$/;

test.describe('the first run on a phone (FR-FIRST-2, FR-FIRST-3)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[ Use my location ] turns the cold open into the countdown, with no navigation', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: ha.observer.lat, longitude: ha.observer.lon, accuracy: 300 });
    await page.clock.setFixedTime(NINE_DAYS_ON);
    await stubNetwork(page);
    await page.goto('/');

    const cold = page.getByTestId('cold-open');
    await expect(cold).toBeVisible();
    // The dashes between the steps are the stylesheet's; the three items are the text.
    await expect(page.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveText(['[01] where', '02 when', '03 what']);
    const primary = cold.getByRole('button', { name: 'Use my location' });
    await expect(primary).toBeVisible();
    // The one primary action is the first control of the group: the place field and the coordinates come after it.
    const place = cold.getByRole('combobox', { name: 'Place name' });
    const [primaryBox, placeBox] = await Promise.all([primary.boundingBox(), place.boundingBox()]);
    expect(placeBox?.y ?? 0).toBeGreaterThan(primaryBox?.y ?? Infinity);

    // A page-lifetime mark: a navigation, even a same-origin one, would take it away.
    const url = page.url();
    await page.evaluate(() => {
      (window as unknown as { __coldOpen?: boolean }).__coldOpen = true;
    });
    await primary.click();

    const block = page.getByTestId('next-event');
    // FR-FIRST-3 as amended v2.0.2: the label line, the clock time and the path.
    await expect(block.getByTestId('next-event-label')).toHaveText(NEXT_LABEL, { timeout: 60_000 });
    await expect(block.getByTestId('next-event-time')).toHaveText(/^\d\d:\d\d( \S+)?$/);
    await expect(block.getByTestId('next-event-path')).toHaveText(/^.+ · [NESW]{1,3}( low| \d+°)? → \d+° [NESW]{1,3} → [NESW]{1,3}( \d+°)?$/);
    await expect(cold).toHaveCount(0);
    // FR-FIRST-11: the coordinates alone, and the sentence by the source with the accuracy the device gave.
    await expect(page.getByTestId('location-summary')).toHaveText('−38.93, −67.99');
    await expect(page.getByTestId('where-sentence')).toHaveText(/^Using your device's location \(±300 m\)\. Saved in this browser only\. /);
    // The group folded away under the line: the device answered, so there is nothing left to type.
    await expect(page.getByTestId('location-summary-change')).toHaveAttribute('aria-expanded', 'false');
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => (window as unknown as { __coldOpen?: boolean }).__coldOpen)).toBe(true);
    await expect(page.getByTestId('settings-back')).toHaveCount(0);

    // FR-FIRST-4: the stacked page — Where, then When ending on the next event, then What; no dome on a phone (D-512).
    const [summaryBox, blockBox, listBox] = await Promise.all([page.getByTestId('location-summary').boundingBox(), block.boundingBox(), page.getByTestId('list-column').boundingBox()]);
    if (!summaryBox || !blockBox || !listBox) throw new Error('the readings are not laid out');
    expect(blockBox.y).toBeGreaterThan(summaryBox.y);
    expect(listBox.y).toBeGreaterThan(blockBox.y);
    await expect(page.getByTestId('where-dome')).toHaveCount(0);
    // It ticks once a second from the wall clock.
    const before = await block.getByTestId('next-event-label').textContent();
    await page.clock.setFixedTime(NINE_DAYS_ON + 5_000);
    await expect(block.getByTestId('next-event-label')).not.toHaveText(before ?? '');
  });
});

test.describe('the three readings by width (FR-FIRST-5, D-443)', () => {
  for (const [width, panes] of [
    [964, false],
    [1024, false],
    [1280, true],
  ] as const) {
    test(`at ${String(width)} px: ${panes ? 'three panes' : 'two columns, Where above When'}`, async ({ page }) => {
      expect(width).toBeGreaterThanOrEqual(WIDE_MIN_PX);
      expect(width >= HOME_THREE_PANE_MIN_PX).toBe(panes);
      await page.setViewportSize({ width, height: 800 });
      await seedStoredRun(page);
      const boxes = await Promise.all(['reading-where', 'reading-when', 'list-column'].map((id) => page.getByTestId(id).boundingBox()));
      const [where, when, what] = boxes;
      if (!where || !when || !what) throw new Error('the readings are not laid out');
      // Populated, each reading is headed by its plain word (FR-FIRST-5 as amended v2.0.2), and the heading is
      // drawn: a pane is a bounded grid that scrolls itself, and an overflowing one once shrank its clipped
      // heading row to nothing.
      for (const [id, name] of [
        ['reading-where', 'Where'],
        ['reading-when', 'When'],
        ['list-column', 'What'],
      ] as const) {
        const heading = page.getByTestId(id).getByRole('heading', { level: 2, name: new RegExp(`^── ${name} ─`) });
        await expect(heading).toBeVisible();
        expect((await heading.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(20);
      }
      // Board 1B's When: the stripe, the table, then the next event (FR-FIRST-8, FR-FIRST-9, FR-FIRST-3).
      const whenPane = page.getByTestId('reading-when');
      const order = await Promise.all(['tonight-stripe', 'conditions', 'next-event'].map(async (id) => (await whenPane.getByTestId(id).boundingBox())?.y ?? NaN));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      if (panes) {
        // FR-FIRST-11 (D-512): the dome of the sky now, in Where, the pane's width square, one link to #live.
        const dome = page.getByTestId('reading-where').getByTestId('where-dome');
        await expect(dome).toHaveAttribute('href', '#live');
        await expect(dome.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
        const domeBox = await dome.boundingBox();
        expect(domeBox?.width ?? 0).toBeGreaterThan(where.width * 0.9);
        // Three equal panes, side by side, on one band.
        expect(when.x).toBeGreaterThan(where.x + where.width - 1);
        expect(what.x).toBeGreaterThan(when.x + when.width - 1);
        for (const pane of [when, what]) {
          expect(Math.abs(pane.width - where.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(pane.y - where.y)).toBeLessThanOrEqual(1);
        }
      } else {
        // FR-DESK-2's two columns: Where above When in the 40-cell left one, What at the right.
        const cell = await cellPx(page);
        expect(Math.abs(where.x - when.x)).toBeLessThanOrEqual(1);
        expect(when.y).toBeGreaterThanOrEqual(where.y + where.height - 1);
        expect(Math.abs(where.width - 40 * cell)).toBeLessThanOrEqual(1);
        expect(what.x).toBeGreaterThan(where.x + where.width - 1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('an open pass at 1280 × 800 (FR-FIRST-5, D-444)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('takes the first two panes and keeps the list in the third', async ({ page }) => {
    await seedStoredRun(page);
    const cell = await cellPx(page);
    const [where, when] = await Promise.all([page.getByTestId('reading-where').boundingBox(), page.getByTestId('reading-when').boundingBox()]);
    if (!where || !when) throw new Error('the panes are not laid out');

    await page.getByRole('button', { name: /Open guide/ }).first().click();
    await expect(page).toHaveURL(/#pass=/);
    const panel = page.getByTestId('guide-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('main')).toHaveAttribute('data-guide', 'pane');

    const [guide, list] = await Promise.all([panel.boundingBox(), page.getByTestId('list-column').boundingBox()]);
    if (!guide || !list) throw new Error('the guide and the list are not laid out');
    // The first two panes' width: from Where's left edge to When's right edge.
    expect(Math.abs(guide.x - where.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(guide.x + guide.width - (when.x + when.width))).toBeLessThanOrEqual(1);
    expect(guide.width).toBeGreaterThanOrEqual(GUIDE_PANE_MIN_CELLS * cell - 1);
    // The list is still in the document, on the page, with the open card marked.
    await expect(page.getByTestId('list-column')).toBeVisible();
    expect(list.x).toBeGreaterThan(guide.x + guide.width - 1);
    await expect(page.locator('[data-pass-card][aria-current="true"]')).toHaveCount(1);
    await expect(page.getByTestId('guide-to-list')).toBeHidden();

    // Escape brings the two panes back.
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('reading-where')).toBeVisible();
    await expect(page.getByTestId('reading-when')).toBeVisible();
  });
});
