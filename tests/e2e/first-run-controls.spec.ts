/**
 * R84 (FR-FIRST-2, FR-FIRST-3 and FR-FIRST-10 as amended v2.1, US-26 AC7,
 * D-548): the first run's controls, where only a browser can answer.
 *
 * - At 390 × 844 a typed coordinate pair offers `[ continue ]`, which moves the
 *   where step on; on the third step a tap on the bottom row of the first card
 *   opens its pass (F-84, F-86).
 * - At 1280 × 800 — no steps on a desk (D-513), so no `[ continue ]` — a typed
 *   pair fills the panes, and a tap on the bottom row of a card opens its pass;
 *   the card's control covers its whole box (F-85).
 * - At 375 and 1280 px, in both languages, with `Sort:` forced to wrap, no line
 *   of the count row ends in `·`, and with room for both it is one line with
 *   the separator drawn (F-78).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';
import { NEUQUEN, STORED_RUN_FILE } from './observers';

const STORED_RUN = JSON.parse(readFileSync(STORED_RUN_FILE, 'utf8')) as unknown;
const TYPED = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;

/**
 * A first visit with no place, and the finished run for the place the test
 * will type already in IndexedDB (R82's capture method), so the steps and the
 * panes show the same passes every time without waiting for the worker.
 */
async function coldWithRun(page: Page): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.goto('/');
  await page.evaluate(async (run: unknown) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('wiys', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('elementGroups')) db.createObjectStore('elementGroups', { keyPath: 'group' });
        if (!db.objectStoreNames.contains('passRuns')) db.createObjectStore('passRuns', { keyPath: 'cellKey' });
      };
      request.onerror = () => {
        reject(new Error('could not open the wiys database'));
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('passRuns', 'readwrite');
        tx.objectStore('passRuns').put(run);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          reject(new Error('could not store the run'));
        };
      };
    });
  }, STORED_RUN);
  await expect(page.getByTestId('cold-open')).toBeVisible();
}

/**
 * The recompute that follows a new place has finished: it replaces the stored
 * list as its first batch arrives (R24), so a spec that reads a card waits for
 * nothing to be busy and then for `steady` to stop changing.
 */
async function recomputed(page: Page, steady: Locator): Promise<void> {
  await page
    .locator('[aria-busy="true"]')
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .catch(() => undefined);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  let last = '';
  await expect
    .poll(
      async () => {
        const text = (await steady.textContent()) ?? '';
        const same = text === last && text !== '';
        last = text;
        return same;
      },
      { timeout: 90_000, intervals: [2_000] },
    )
    .toBe(true);
}

/** Taps a card a few pixels above its bottom edge — its last row, the cloud line where there is one. */
async function tapBottomRow(card: Locator): Promise<void> {
  const box = await card.boundingBox();
  if (!box) throw new Error('the card is not laid out');
  await card.click({ position: { x: box.width / 2, y: box.height - 6 } });
}

/** The guide for a pass: the sheet on a phone, the panel on a desk. */
const guideFor = (page: Page, passId: string): Locator => page.locator(`[role="dialog"][data-pass-id="${passId}"], [data-guide-panel][data-pass-id="${passId}"]`);

test.describe('the first run on a phone (FR-FIRST-2, FR-FIRST-3 as amended v2.1)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a typed pair offers [ continue ], and the third step’s first card opens its pass from its bottom row', async ({ page }) => {
    await coldWithRun(page);
    const cold = page.getByTestId('cold-open');
    // FR-FIRST-2 as amended: no field looks filled — the placeholders are the format and 0, and both fields are empty.
    const coords = cold.getByLabel('Coordinates · e.g. -38.93, -67.99');
    const altitude = cold.getByLabel('Altitude (m)');
    await expect(coords).toHaveValue('');
    await expect(coords).toHaveAttribute('placeholder', 'lat, lon');
    await expect(altitude).toHaveValue('');
    await expect(altitude).toHaveAttribute('placeholder', '0');

    const next = cold.getByRole('button', { name: 'continue' });
    await expect(next).toHaveCount(0);
    await coords.fill(TYPED);
    // The pair parsed: the control is under the coordinate fields, 48 px tall, and the field still has the focus.
    await expect(next).toBeVisible();
    await expect(coords).toBeFocused();
    const [nextBox, coordsBox] = await Promise.all([next.boundingBox(), coords.boundingBox()]);
    if (!nextBox || !coordsBox) throw new Error('the where step is not laid out');
    expect(nextBox.y).toBeGreaterThan(coordsBox.y + coordsBox.height - 1);
    expect(Math.round(nextBox.height)).toBe(48);
    await next.click();

    const when = page.getByTestId('step-when');
    await expect(when).toBeVisible();
    await expect(when.getByTestId('when-passes')).toHaveText(/^\d+ tonight, \d+ in 72 h$/, { timeout: 60_000 });
    // The recompute after the place replaces the stored list as it streams in; the first card is read once it has finished.
    await recomputed(page, when.getByTestId('when-passes'));
    await when.getByTestId('see-what').click();

    const what = page.getByTestId('step-what');
    const first = what.getByTestId('next-event');
    await expect(first).toHaveAttribute('data-form', 'card');
    const control = first.getByRole('button', { name: /^Open guide → / });
    await expect(control).toHaveCount(1);
    const name = ((await control.getAttribute('aria-labelledby')) ?? '').split(' ')[1] ?? '';
    const passName = await page.locator(`[id="${name}"]`).textContent();
    // The bottom row is the brightness line; the tap there opens the first card's pass, which the list under it leaves out.
    await tapBottomRow(first);
    await expect(page).toHaveURL(/#pass=/);
    const opened = new URL(page.url()).hash.slice('#pass='.length);
    const guide = guideFor(page, opened);
    await expect(guide).toBeVisible();
    await expect(guide.getByRole('heading', { level: 2 }).first()).toContainText(passName ?? '');
    await expect(what.locator(`article[data-pass-id="${opened}"]`)).toHaveCount(0);
  });
});

test.describe('the cards at 1280 × 800 (FR-FIRST-10 as amended v2.1)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a typed pair fills the panes, and a tap on a card’s bottom row opens its pass; the control is the card’s box', async ({ page }) => {
    await coldWithRun(page);
    // No steps on a desk: the pair fills the panes and nothing offers to continue.
    await page.getByTestId('cold-open').getByLabel('Coordinates · e.g. -38.93, -67.99').fill(TYPED);
    await expect(page.getByRole('button', { name: 'continue' })).toHaveCount(0);
    const card = page.locator('article[data-pass-card]').first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    await recomputed(page, page.getByTestId('count-line').getByRole('status'));

    // The control's box is the card's, within 2 px, with the pointer over all of it.
    const [cardBox, controlBox] = await Promise.all([card.boundingBox(), card.getByRole('button').boundingBox()]);
    if (!cardBox || !controlBox) throw new Error('the card is not laid out');
    for (const side of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(controlBox[side] - cardBox[side]), side).toBeLessThanOrEqual(2);
    expect(await card.getByRole('button').evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
    // What is under the card's bottom row — the cloud line — is its control.
    const under = await card.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.bottom - 6);
      return hit === el.querySelector('button') ? 'control' : (hit?.outerHTML.slice(0, 120) ?? 'nothing');
    });
    expect(under).toBe('control');

    const id = (await card.getAttribute('data-pass-id')) ?? '';
    await tapBottomRow(card);
    await expect(page).toHaveURL(new RegExp(`#pass=${id}$`));
    await expect(guideFor(page, id)).toBeVisible();
  });
});

/**
 * F-78: every line of the count row, as the reader sees it — characters left of
 * the row's clipped edge are not drawn — must not end in `·`. Lines are the
 * characters' vertical centres, clustered.
 */
async function countRowLines(page: Page): Promise<string[]> {
  return page.getByTestId('count-line').evaluate((row) => {
    const edge = row.getBoundingClientRect().left;
    const chars: { x: number; y: number; c: string }[] = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      for (let i = 0; i < text.length; i += 1) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.right <= edge + 0.5) continue; // in the clipped margin: not drawn
        chars.push({ x: rect.left, y: rect.top + rect.height / 2, c: text[i] ?? '' });
      }
    }
    chars.sort((a, b) => a.y - b.y);
    const lines: (typeof chars)[] = [];
    for (const ch of chars) {
      const line = lines.at(-1);
      if (line && Math.abs((line[0]?.y ?? 0) - ch.y) < 8) line.push(ch);
      else lines.push([ch]);
    }
    return lines.map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((ch) => ch.c)
        .join('')
        .trim(),
    );
  });
}

for (const width of [375, 1280] as const) {
  for (const locale of ['en', 'es'] as const) {
    test(`the count line at ${String(width)} px in ${locale}: the separator only between words on one line (F-78)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await seedStoredRun(page, { locale, settled: true });
      const row = page.getByTestId('count-line');
      const status = row.getByRole('status');
      const sort = row.getByRole('group');

      // With room for all of it, one line with the separators drawn between the pieces. R97: the stored run's
      // faint control is a third piece (`· [ ver 4 tenues ]`), which takes the Spanish line past 72ch.
      await row.evaluate((el) => {
        el.style.width = '96ch';
      });
      let lines = await countRowLines(page);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/ · /);

      // Forced to wrap: the row a few characters wider than the count alone.
      const statusWidth = (await status.boundingBox())?.width ?? 0;
      await row.evaluate((el, w) => {
        el.style.width = `calc(${String(w)}px + 4ch)`;
      }, statusWidth);
      const [statusBox, sortBox] = await Promise.all([status.boundingBox(), sort.boundingBox()]);
      expect(sortBox?.y ?? 0).toBeGreaterThan((statusBox?.y ?? 0) + 4);
      lines = await countRowLines(page);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const line of lines) expect(line.at(-1), line).not.toBe('·');
      expect(lines.join('\n')).not.toMatch(/·/);
    });
  }
}
