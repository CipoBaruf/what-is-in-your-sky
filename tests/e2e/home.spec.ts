/**
 * R76 (FR-FIRST-2, FR-FIRST-3, FR-FIRST-5, US-26, D-443, D-444): the home page
 * as three readings, where only a browser can answer.
 *
 * The first run on a phone with no example (the suite's zone is UTC, D-1183):
 * the place question's one primary action, answered by a stubbed `geolocation`,
 * lands on the stacked page without a navigation and with no step between
 * (R202, FR-OPEN-5) — the same document, the same URL, no `#settings` — and a
 * reload is the stacked page with the countdown. The example's own first run is
 * `firstRun.spec.ts`. Then the three
 * readings at the three widths that decide their layout: 964 and 1024 px are
 * FR-DESK-2's two columns with Where above When, 1280 px is three equal panes.
 * And at 1280 × 800 an open pass takes the first two panes' width, with the list
 * still in the document beside it.
 */
import { expect, test, type Page } from '@playwright/test';
import { HOME_THREE_PANE_MIN_PX, WIDE_MIN_PX } from '../../src/lib/layout';
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
 * R202 (FR-FIRST-4 as amended v2.16, FR-OPEN-5, FR-OPEN-6): the first visit on a phone with no example is the
 * place question, and a place lands on the stacked page — one page load and one reload. The same document and the
 * same URL throughout, never `#settings`.
 */
test.describe('the first run on a phone (FR-FIRST-2, FR-FIRST-3, FR-FIRST-4)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the question, then the stacked page with no step and no navigation, and a reload opens on the stacked page', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: ha.observer.lat, longitude: ha.observer.lon, accuracy: 300 });
    await page.clock.setFixedTime(NINE_DAYS_ON);
    await stubNetwork(page);
    await page.goto('/');

    const cold = page.getByTestId('cold-open');
    await expect(cold).toBeVisible();
    // FR-OPEN-6: the fallback is the question under the tagline — no step line, no `[ back ]`.
    await expect(cold.getByTestId('home-tagline')).toHaveText('Which satellites you can see tonight, when, and where to look.');
    await expect(page.getByTestId('step-line')).toHaveCount(0);
    await expect(page.getByTestId('place-back')).toHaveCount(0);
    const primary = cold.getByRole('button', { name: 'Use my location' });
    await expect(primary).toBeVisible();
    // The one primary action is the first control of the group: the place field and the coordinates come after it.
    const place = cold.getByRole('combobox', { name: 'Place name' });
    const [primaryBox, placeBox] = await Promise.all([primary.boundingBox(), place.boundingBox()]);
    expect(placeBox?.y ?? 0).toBeGreaterThan(primaryBox?.y ?? Infinity);
    // One screen tall, the footer counted (FR-FIRST-1 as amended v2.1).
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);

    // A page-lifetime mark: a navigation, even a same-origin one, would take it away.
    const url = page.url();
    await page.evaluate(() => {
      (window as unknown as { __coldOpen?: boolean }).__coldOpen = true;
    });
    await primary.click();

    // FR-OPEN-5: the place lands on the stacked page — the doors, then Where, When and What — with no when or what step.
    await expect(cold).toHaveCount(0);
    await expect(page.getByTestId('home-doors').getByRole('link')).toHaveText([/^Satellites/, /^Stars/, /^Live sky/]);
    // D-1025: the device fix is named after the nearest town, on the device, once the coordinates are set.
    await expect(page.getByTestId('location-summary')).toHaveText('Cipolletti');
    await expect(page.getByTestId('reading-when').getByTestId('tonight-stripe')).toBeVisible();
    await expect(page.getByTestId('list-column')).toBeVisible();
    await expect(page.getByTestId('home-tagline')).toHaveCount(0);
    await expect(page.getByTestId('example-band')).toHaveCount(0);

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
    await expect(page.getByTestId('cold-open')).toHaveCount(0);
    // FR-FIRST-11: the nearest town alone (D-1025, D-1029); the coordinates open the sentence by the source with the accuracy the device gave.
    await expect(page.getByTestId('location-summary')).toHaveText('Cipolletti');
    // R130 (FR-FLOW-2): the sentence is at the top of the group the folded Where's `[ change ]` opens, above the inputs (D-1024).
    await expect(page.getByTestId('where-sentence')).toBeHidden();
    // `[ change ]` is the place line's one control; there is no `[ details ]`.
    await expect(page.getByTestId('where-place-row').getByRole('button')).toHaveCount(1);
    await expect(page.getByTestId('where-details')).toHaveCount(0);
    await page.getByTestId('location-summary-change').click();
    await expect(page.getByTestId('where-sentence')).toHaveText(/^−38\.93, −67\.99 · Using your device's location \(±300 m\)\. Saved in this browser only\.$/);
    const [statusBox, fieldBox] = await Promise.all([page.getByTestId('where-opened-status').boundingBox(), page.getByRole('combobox', { name: 'Place name' }).boundingBox()]);
    if (!statusBox || !fieldBox) throw new Error('the opened group is not laid out');
    expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(fieldBox.y);
    await page.getByTestId('location-summary-change').click();
    // The group folded away under the line.
    await expect(page.getByTestId('location-summary-change')).toHaveAttribute('aria-expanded', 'false');

    // FR-FIRST-4, FR-PHONE-12: the stacked page — the doors, Where, When, then What; no dome on a phone (D-512).
    const [summaryBox, blockBox, listBox] = await Promise.all([page.getByTestId('location-summary').boundingBox(), block.boundingBox(), page.getByTestId('list-column').boundingBox()]);
    if (!summaryBox || !blockBox || !listBox) throw new Error('the readings are not laid out');
    expect(summaryBox.y).toBeGreaterThan(blockBox.y);
    expect(listBox.y).toBeGreaterThan(summaryBox.y);
    await expect(page.getByTestId('where-dome')).toHaveCount(0);
    // It ticks once a second from the wall clock.
    const before = await label.textContent();
    await page.clock.setFixedTime(NINE_DAYS_ON + 5_000);
    await expect(label).not.toHaveText(before ?? '');
  });
});

/**
 * R130 (FR-FLOW-1, FR-FLOW-2; D-843, D-844), R156 (FR-PHONE-12): on a phone the
 * home is the three doors first and then the Where reading in two lines; the
 * doors' foot is inside the first 420 px of an 844 px screen in both languages
 * (`sky-layout.spec.ts` holds the same edge); each door is one link to its
 * page — the next event's pass, `#stars`, `#live`.
 */
test.describe('the doors at 390 × 844 (FR-FLOW-1)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const locale of ['en', 'es'] as const) {
    test(`in ${locale}: the doors' bottom edge is at or above 420 px, over the two-line Where`, async ({ page }) => {
      await seedStoredRun(page, { locale });
      const doors = ['door-satellites', 'door-stars', 'door-live'].map((id) => page.getByTestId(id));
      for (const door of doors) await expect(door).toBeVisible();
      await expect(page.getByTestId('door-stars').getByTestId('door-stars-line').nth(1)).not.toHaveAttribute('data-pending', '', { timeout: 30_000 });
      const boxes = await Promise.all(doors.map((door) => door.boundingBox()));
      const where = await page.getByTestId('location-summary').boundingBox();
      const bottom = Math.max(...boxes.map((box) => (box?.y ?? Infinity) + (box?.height ?? 0)));
      console.log(`R156: the doors' bottom edge at 390 × 844 in ${locale}: ${String(Math.round(bottom))} px`);
      expect(bottom).toBeLessThanOrEqual(420);
      // The Where reading's place line under the last door.
      expect(where?.y ?? 0).toBeGreaterThanOrEqual(bottom);
      // In order, one under the other; each at least 44 px tall and full width.
      for (const [i, box] of boxes.entries()) {
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        // Clear of the door above it, by at least the space scale's step: the boxes never touch or overlap.
        const above = boxes[i - 1];
        if (above) expect(box?.y ?? 0).toBeGreaterThanOrEqual((above.y) + (above.height) + 6);
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
    await page.getByTestId('door-live').click();
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
      const doors = await Promise.all(['door-satellites', 'door-stars', 'door-live'].map((id) => page.getByTestId(id).boundingBox()));
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

test.describe('an open pass at 1280 × 800 (FR-WIDE-1, amends FR-FIRST-5 and FR-DESK-3)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // R186 (FR-WIDE-1, D-1098, D-1118): a selected pass no longer takes the first two panes; it opens the desk shell in
  // the home's place, the home's list in the rail's `list` slot with the card highlighted, and `Esc` brings the home back.
  test('opens the shell in the home’s place, the list in the rail, and Esc brings the panes back', async ({ page }) => {
    await seedStoredRun(page);
    await page.getByRole('button', { name: /Open guide/ }).first().click();
    await expect(page).toHaveURL(/#pass=/);
    const layout = page.getByTestId('pass-layout');
    await expect(layout).toBeVisible();
    for (const id of ['reading-where', 'reading-when']) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(layout.locator('[data-slot="list"] article[data-pass-id][data-selected="true"]')).toHaveCount(1);
    await expect(page.getByTestId('guide-to-list')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(layout).toHaveCount(0);
    await expect(page.getByTestId('reading-where')).toBeVisible();
    await expect(page.getByTestId('reading-when')).toBeVisible();
  });
});
