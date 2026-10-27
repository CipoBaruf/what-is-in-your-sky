/**
 * R76 (FR-FIRST-2, FR-FIRST-3, FR-FIRST-5, US-26, D-443, D-444): the home page
 * as three readings, where only a browser can answer.
 *
 * The first run on a phone: the cold open's one primary action, answered by a
 * stubbed `geolocation`, moves the page through R82's three steps without a
 * navigation — the same document, the same URL, no `#settings` — and a reload
 * is the stacked page with the countdown. Then the three
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

/** R130 (FR-FLOW-1): the Satellites door's first line — `Next 05:48 · in 48:04`, `Up now · peaks in 0:08`, `Up now · sets in 2:05`. */
const NEXT_LABEL = /^(Next \d\d:\d\d( \S+)? · in|Up now · (peaks|sets|into shadow|fades) in) (\d+:)?\d\d?:\d\d$/;

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, D-513, D-514): the first visit on a phone
 * is three steps, and a reload is the stacked page — one page load and one
 * reload. The steps are the page's own state: the same document and the same
 * URL throughout, never `#settings`.
 */
test.describe('the first run on a phone (FR-FIRST-2, FR-FIRST-3, FR-FIRST-4)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('walks where → when → what with no navigation, and a reload opens on the stacked page', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: ha.observer.lat, longitude: ha.observer.lon, accuracy: 300 });
    await page.clock.setFixedTime(NINE_DAYS_ON);
    await stubNetwork(page);
    await page.goto('/');

    const steps = page.getByRole('list', { name: 'Steps' }).getByRole('listitem');
    const cold = page.getByTestId('cold-open');
    await expect(cold).toBeVisible();
    // The dashes between the steps are the stylesheet's; the three items are the text.
    await expect(steps).toHaveText(['[01] where', '02 when', '03 what']);
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

    // when: the step line with where finished, the question, the night's box and the sky's, and the control at the foot.
    const when = page.getByTestId('step-when');
    await expect(when).toBeVisible();
    await expect(cold).toHaveCount(0);
    await expect(steps).toHaveText(['01 where ✓', '[02] when', '03 what']);
    await expect(when.getByRole('heading', { level: 2, name: 'When is it dark enough?' })).toBeFocused();
    await expect(when.getByText('−38.93, −67.99, tonight. Satellites are only lit in the dark band between dusk and dawn.')).toBeVisible();
    await expect(when.getByTestId('when-passes')).toHaveText(/^\d+ tonight, \d+ in 72 h$/, { timeout: 60_000 });
    await expect(when.getByTestId('tonight-stripe')).toBeVisible();
    await expect(when.locator('[data-row="until"] dt')).toHaveText('Until');
    await expect(when.getByTestId('moon-note')).toHaveText(/^A bright moon washes out the faint ones\. Tonight it will( not)?\.$/);
    // One screen tall: the control stands at the foot of the step, which is the 844 px screen less the footer's
    // one row (R87, D-548 — the step shares its screen with the footer), so it is measured against the step's main.
    const next = when.getByRole('button', { name: 'See what crosses' });
    const nextBox = await next.boundingBox();
    const stepBox = await page.locator('main[data-step]').boundingBox();
    const stepFoot = (stepBox?.y ?? 0) + (stepBox?.height ?? 0);
    expect(stepFoot).toBeLessThanOrEqual(844);
    expect((nextBox?.y ?? 0) + (nextBox?.height ?? 0)).toBeGreaterThan(stepFoot - 60);
    expect((nextBox?.y ?? Infinity) + (nextBox?.height ?? 0)).toBeLessThanOrEqual(stepFoot);
    await next.click();

    // what: the count in words, the first card, the foot line with `[ edit ]`.
    const what = page.getByTestId('step-what');
    await expect(what).toBeVisible();
    await expect(steps).toHaveText(['01 where ✓', '02 when ✓', '[03] what']);
    await expect(what.getByRole('heading', { level: 2 }).first()).toHaveText(/^(One thing crosses|(Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|\d+) things cross|Nothing crosses) tonight$/);
    const first = what.getByTestId('next-event');
    await expect(first).toHaveAttribute('data-form', 'card');
    await expect(first.getByTestId('next-event-label')).toHaveText(/^(First up · in|Up now · (peaks|sets|enters shadow|fades) in) (\d+:)?\d\d?:\d\d$/);
    const foot = what.getByTestId('what-foot');
    await expect(foot).toContainText(/^−38\.93, −67\.99 · dark \d\d:\d\d–\d\d:\d\d( UTC)? · /);

    // [ edit ] returns to where with the group open; the finished steps are the way back to when.
    await foot.getByRole('button', { name: 'edit' }).click();
    await expect(cold).toBeVisible();
    await expect(page.getByTestId('location-group')).toBeVisible();
    await expect(steps).toHaveText(['[01] where', '02 when ✓', '03 what ✓']);
    await page.getByTestId('step-back-when').click();
    await expect(when).toBeVisible();

    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => (window as unknown as { __coldOpen?: boolean }).__coldOpen)).toBe(true);
    await expect(page.getByTestId('settings-back')).toHaveCount(0);

    // A later visit — the reload — is the stacked page, and never a step.
    await page.reload();
    // R130 (FR-FLOW-1): the next event is the Satellites door's — the label line, then the name and the path.
    const block = page.getByTestId('door-satellites');
    const label = block.getByTestId('door-satellites-line').first();
    await expect(label).toHaveText(NEXT_LABEL, { timeout: 60_000 });
    await expect(block.getByTestId('door-satellites-line').nth(1)).toHaveText(/^.+ · [NESW]{1,3} \d+° → [NESW]{1,3}$/);
    await expect(page.getByTestId('next-event')).toHaveCount(0);
    await expect(page.getByTestId('step-line')).toHaveCount(0);
    await expect(page.getByTestId('step-when')).toHaveCount(0);
    // FR-FIRST-11: the coordinates alone, and the sentence by the source with the accuracy the device gave.
    await expect(page.getByTestId('location-summary')).toHaveText('−38.93, −67.99');
    // R130 (FR-FLOW-2): the sentence is behind the folded Where's `[ details ]`.
    await expect(page.getByTestId('where-sentence')).toBeHidden();
    await page.getByTestId('where-details').click();
    await expect(page.getByTestId('where-sentence')).toHaveText(/^Using your device's location \(±300 m\)\. Saved in this browser only\.$/);
    await page.getByTestId('where-details').click();
    // The group folded away under the line.
    await expect(page.getByTestId('location-summary-change')).toHaveAttribute('aria-expanded', 'false');

    // FR-FIRST-4, FR-FLOW-1: the stacked page — Where, the doors, When, then What; no dome on a phone (D-512).
    const [summaryBox, blockBox, listBox] = await Promise.all([page.getByTestId('location-summary').boundingBox(), block.boundingBox(), page.getByTestId('list-column').boundingBox()]);
    if (!summaryBox || !blockBox || !listBox) throw new Error('the readings are not laid out');
    expect(blockBox.y).toBeGreaterThan(summaryBox.y);
    expect(listBox.y).toBeGreaterThan(blockBox.y);
    await expect(page.getByTestId('where-dome')).toHaveCount(0);
    // It ticks once a second from the wall clock.
    const before = await label.textContent();
    await page.clock.setFixedTime(NINE_DAYS_ON + 5_000);
    await expect(label).not.toHaveText(before ?? '');
  });
});

/**
 * R130 (FR-FLOW-1, FR-FLOW-2; D-843, D-844): on a phone the home is the Where
 * reading in two lines and then the three doors, whose foot is inside the first
 * 600 px of an 844 px screen in both languages; each door is one link to its
 * page — the next event's pass, `#stars`, `#live`.
 */
test.describe('the doors at 390 × 844 (FR-FLOW-1)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const locale of ['en', 'es'] as const) {
    test(`in ${locale}: the doors' bottom edge is at or above 600 px, under the two-line Where`, async ({ page }) => {
      await seedStoredRun(page, { locale });
      const doors = ['door-satellites', 'door-stars', 'door-both'].map((id) => page.getByTestId(id));
      for (const door of doors) await expect(door).toBeVisible();
      await expect(page.getByTestId('door-stars').getByTestId('door-stars-line').nth(1)).not.toHaveAttribute('data-pending', '', { timeout: 30_000 });
      const boxes = await Promise.all(doors.map((door) => door.boundingBox()));
      const status = await page.getByTestId('where-status').boundingBox();
      const bottom = Math.max(...boxes.map((box) => (box?.y ?? Infinity) + (box?.height ?? 0)));
      console.log(`R130: the doors' bottom edge at 390 × 844 in ${locale}: ${String(Math.round(bottom))} px`);
      expect(bottom).toBeLessThanOrEqual(600);
      // In order, one under the other, under the Where's status line; each at least 44 px tall and full width.
      for (const [i, box] of boxes.entries()) {
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.y ?? 0).toBeGreaterThan(i === 0 ? (status?.y ?? Infinity) : (boxes[i - 1]?.y ?? Infinity));
        expect(Math.abs((box?.width ?? 0) - (boxes[0]?.width ?? 0))).toBeLessThanOrEqual(1);
      }
      // Every line on one row: a door line never wraps (34 cells, `doorRows.test.ts`).
      const wrapped = await page.locator('[data-testid^="door-"][data-testid$="-line"]').evaluateAll((lines) => lines.filter((line) => line.scrollWidth > line.clientWidth + 1).map((line) => line.textContent));
      expect(wrapped).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }

  test('each door opens its page: the next pass, #stars, #live', async ({ page }) => {
    await seedStoredRun(page);
    const satellites = page.getByTestId('door-satellites');
    await expect(satellites).toHaveAttribute('href', /^#pass=/);
    // The stored run is recomputed under the page, so the next pass may change; the URL is the door's own at the tap.
    await satellites.click();
    await expect(page).toHaveURL(/#pass=[^&]+$/);
    await expect(page.getByTestId('guide-panel').or(page.getByRole('dialog')).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('door-stars').click();
    await expect(page).toHaveURL(/#stars$/);
    await page.goBack();
    await page.getByTestId('door-both').click();
    await expect(page).toHaveURL(/#live$/);
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
      // Board 1B's When: the stripe, then the table (FR-FIRST-8, FR-FIRST-9); the next event is the Satellites door's (R130).
      const whenPane = page.getByTestId('reading-when');
      const order = await Promise.all(['tonight-stripe', 'conditions'].map(async (id) => (await whenPane.getByTestId(id).boundingBox())?.y ?? NaN));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      await expect(page.getByTestId('next-event')).toHaveCount(0);
      // R130 (FR-FLOW-1, FR-FIRST-11 as amended): the doors one row over the panes, and no dome in Where.
      await expect(page.getByTestId('where-dome')).toHaveCount(0);
      const doors = await Promise.all(['door-satellites', 'door-stars', 'door-both'].map((id) => page.getByTestId(id).boundingBox()));
      for (const door of doors) {
        expect(Math.abs((door?.y ?? NaN) - (doors[0]?.y ?? NaN))).toBeLessThanOrEqual(1);
        expect((door?.y ?? Infinity) + (door?.height ?? 0)).toBeLessThanOrEqual(Math.min(where.y, when.y, what.y));
      }
      if (panes) {
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
