/**
 * R54 (F-53, D-271, FR-LEG-2, FR-LEG-4): the legend beside the live drawing scrolls
 * inside the box, its last row is reached by pointer, and every row is a
 * keyboard stop — focus highlights a row without promoting it, so Tab walks
 * the list in order. On the four-pass Paris instant (`parisLive.ts`), at a
 * short two-column viewport (`LIVE_VIEWPORTS.short`) where the rail is shorter
 * than its list. R70 moved that viewport from 1660 × 540 to 1660 × 380, for the
 * reason written against it in `parisLive.ts`: the rows this phase adds under
 * the box pull FR-SHP-3's fold in, and a folded page's rail holds the whole
 * list. The behaviour under test is unchanged.
 */
import { expect, test } from '@playwright/test';
import { openParisLive } from './parisLive';

test('the legend beside the drawing scrolls inside the box; every row is a keyboard stop and the last is reached by pointer (F-53, D-271)', async ({ page }) => {
  await openParisLive(page, 'short', 'dark');
  const slot = page.getByTestId('chart-legend-slot');
  /*
   * R61 (D-312): the column beside the drawing is the page's rail now, and the legend has a box of its own
   * inside it — that box is what scrolls, so that a list longer than the column cannot push the playback
   * controls and the share action off the bottom of it. F-53's behaviour is unchanged and so is this test;
   * only which element carries the scroll has moved, and the test asks the frame which one that is.
   */
  const scroller = (await page.getByTestId('chart-legend-scroll').count()) > 0 ? page.getByTestId('chart-legend-scroll') : slot;
  const rows = slot.locator('button[data-pass-id]');
  const ids = await rows.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-pass-id')));
  expect(ids.length).toBeGreaterThan(1);
  const metrics = await scroller.evaluate((el) => ({ overflow: getComputedStyle(el).overflowY, client: el.clientHeight, scroll: el.scrollHeight }));
  expect(metrics.overflow).toBe('auto');
  expect(metrics.scroll, `the rail must be shorter than its list for this to test anything: ${JSON.stringify(metrics)}`).toBeGreaterThan(metrics.client);
  // By pointer: the column scrolls to its end and the last row is inside the box, where a click pins it.
  const lastId = ids[ids.length - 1];
  const last = slot.locator(`button[data-pass-id="${String(lastId)}"]`);
  await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  const slotBox = await scroller.boundingBox();
  const lastBox = await last.boundingBox();
  if (!slotBox || !lastBox) throw new Error('no legend');
  expect(lastBox.y).toBeGreaterThanOrEqual(slotBox.y - 1);
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(slotBox.y + slotBox.height + 1);
  await last.click();
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  // By keyboard: every row is a focus stop, in order — focus highlights without promoting (D-271), so the list holds
  // still — and the last one is inside the slot's box, scrolled into view by the browser.
  await rows.first().focus();
  const visited = [await page.evaluate(() => document.activeElement?.getAttribute('data-pass-id') ?? null)];
  for (let i = 1; i < ids.length; i++) {
    await page.keyboard.press('Tab');
    visited.push(await page.evaluate(() => document.activeElement?.getAttribute('data-pass-id') ?? null));
  }
  // n − 1 tabs from the first row visit every row once: no repeats, none skipped (the click above moved `lastId` to the top).
  expect(new Set(visited).size).toBe(ids.length);
  expect([...visited].sort()).toEqual([...ids].sort());
  const focused = await slot.locator(':focus').boundingBox();
  const slotNow = await slot.boundingBox();
  if (!focused || !slotNow) throw new Error('no focused row');
  expect(focused.y).toBeGreaterThanOrEqual(slotNow.y - 1);
  expect(focused.y + focused.height).toBeLessThanOrEqual(slotNow.y + slotNow.height + 1);
});
