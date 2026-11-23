/**
 * R35 (FR-DESK-4, US-14 AC4) at 1280 px: the whole app driven from the
 * keyboard against a real browser, which is the only place the cursor is
 * visible at all — it is DOM focus on a pass card, and the guard is about what
 * has focus. The table, the guard's ignored cases and the overlay's parity with
 * the table are unit tests (`src/lib/shortcuts.test.ts`,
 * `src/ui/components/common/ShortcutsOverlay.test.tsx`); what is here is every
 * key doing its thing to the page, and the one thing no unit test can claim
 * honestly: that typing a place name types it and fires nothing.
 *
 * The captures of the overlay in both languages and both themes are at the
 * bottom — evidence for the PR, with an assertion that each shows what it is
 * named after.
 */
import { expect, test, type Page } from '@playwright/test';
import { openSettings, seedStoredRun } from './liveHelpers';

const WIDE = { width: 1280, height: 900 };

test.use({ viewport: WIDE });

/**
 * FR-CI-3 (R37): the shortcuts are not the pass search, so this file no longer
 * waits for one. `seedStoredRun` opens the page on a stored 72 h run, the way
 * a returning reader's browser does, and the keys have a list to work on from
 * the first frame.
 */
async function loadWithPasses(page: Page, locale: 'en' | 'es' = 'en', { cards = false } = {}): Promise<void> {
  // `cards`: a test that walks the list with j and k waits for the recompute behind the stored run
  // to land first, because the first object of it replaces the list (see `listSettled`). The tests
  // that only open the overlay do not, and those are most of this file.
  await seedStoredRun(page, { locale, settled: cards });
  // Nothing was typed, so nothing has the caret — but the focus is cleared: FR-DESK-4 says the keys are
  // the page's only while no field holds it, and starting from a known focus is what makes that true here.
  // R212 (D-1267): a route change hands the focus to the page's h1, so it is blurred rather than clicked.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  expect(await page.evaluate(() => document.activeElement?.tagName.toLowerCase())).toBe('body');
}

/** The pass the cursor is on: focus is the cursor (`components/passes/passCursor.ts`). */
async function cursor(page: Page): Promise<string | null> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset['passId'] ?? null);
}

/** The pass ids of the cards on offer, in the order the page shows them. */
async function cardIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-pass-card]'))
      .filter((card) => card.closest('[data-night-group][hidden]') === null)
      .map((card) => card.dataset['passId'] ?? ''),
  );
}

test('j and k move the cursor over the list, Enter opens the pass and Esc closes it (US-14 AC4)', async ({ page }) => {
  await loadWithPasses(page, 'en', { cards: true });
  // R212 (FR-LAND-6): the list is the pass page's rail, and the open pass's card is where the cursor starts.
  const ids = await cardIds(page);
  const open = await page.getByTestId('guide-panel').getAttribute('data-pass-id');
  const at = ids.indexOf(open ?? '');
  expect(at).toBeGreaterThanOrEqual(0);
  expect(ids.length).toBeGreaterThan(at + 2);
  const [first, second] = [ids[at + 1], ids[at + 2]] as [string, string];

  await page.keyboard.press('j');
  expect(await cursor(page)).toBe(first);
  await page.keyboard.press('j');
  expect(await cursor(page)).toBe(second);
  await page.keyboard.press('k');
  expect(await cursor(page)).toBe(first);

  // The cursor is really on the page, not a class name: the card is scrolled into view and carries the focus ring.
  await expect(page.locator(`[data-pass-card][data-pass-id="${first}"]`)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('guide-panel')).toHaveAttribute('data-pass-id', first);
  expect(page.url()).toContain(`#pass=${first}`);

  // On a desk the pass page closes to the live page.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('guide-panel')).toHaveCount(0);
  expect(page.url()).toContain('#live');
});

test('k and j stop at the ends of the list rather than wrap', async ({ page }) => {
  await loadWithPasses(page, 'en', { cards: true });
  const ids = await cardIds(page);
  const last = ids[ids.length - 1] as string;
  const first = ids[0] as string;

  for (const _ of ids) await page.keyboard.press('j');
  expect(await cursor(page)).toBe(last);
  await page.keyboard.press('j');
  expect(await cursor(page)).toBe(last);
  for (const _ of ids) await page.keyboard.press('k');
  expect(await cursor(page)).toBe(first);
  await page.keyboard.press('k');
  expect(await cursor(page)).toBe(first);
});

test('l opens the live page (FR-LIVE-1)', async ({ page }) => {
  await loadWithPasses(page);
  await page.keyboard.press('l');
  expect(page.url()).toContain('#live');
  await expect(page.getByRole('region', { name: 'Upcoming passes' })).toHaveCount(0);
});

test('v toggles the chart view and n toggles the palette (FR-DOME-7, FR-THEME-1)', async ({ page }) => {
  await loadWithPasses(page, 'en', { cards: true });
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  const chart = page.getByTestId('sky-chart');
  await expect(chart).toHaveAttribute('data-view', 'dome');

  // R186 (FR-WIDE-2, FR-DESK-4): on a desk `v` cycles the row's three, `Globe Window Dome`, from the one shown.
  await page.keyboard.press('v');
  await expect(chart).toHaveAttribute('data-view', 'globe');
  await page.keyboard.press('v');
  await expect(chart).toHaveAttribute('data-view', 'window');
  await page.keyboard.press('v');
  await expect(chart).toHaveAttribute('data-view', 'dome');

  const theme = () => page.evaluate(() => document.documentElement.dataset['theme']);
  expect(await theme()).toBe('dark');
  await page.keyboard.press('n');
  expect(await theme()).toBe('night');
  await page.keyboard.press('n');
  expect(await theme()).toBe('dark');
});

test('? opens the overlay, which lists the keys, and Esc closes it', async ({ page }) => {
  await loadWithPasses(page);
  await page.keyboard.press('?');

  const overlay = page.getByTestId('shortcuts-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('kbd')).toHaveText(['j', 'k', 'Enter', 'Esc', 'l', 's', 'v', 'n', '?', 'g', 'w', 'd', ',', '.', 't', 'Space', 'a', 'f', '← →', '↑ ↓', '+ −', '0 Home']);
  // Nothing behind it can be reached while it is up.
  await expect(page.getByRole('main')).toHaveAttribute('inert', '');

  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('main')).not.toHaveAttribute('inert', '');
});

test('typing a place name types it and fires nothing (FR-DESK-4, D-73)', async ({ page }) => {
  await loadWithPasses(page);
  // R212 (D-1230): the place group is the settings page’s.
  await openSettings(page);
  const url = page.url();
  const field = page.getByLabel('Place name');
  await field.click();
  await field.pressSequentially('jknvl?');

  await expect(field).toHaveValue('jknvl?');
  await expect(page.getByTestId('shortcuts-overlay')).toHaveCount(0);
  await expect(page.getByTestId('guide-panel')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset['theme'])).toBe('dark');
  expect(page.url()).toBe(url);
  // The cursor never moved: focus is still in the field, not on a card.
  await expect(field).toBeFocused();
});

test('the overlay reads in Spanish with the keys untranslated (FR-I18N-2/4)', async ({ page }) => {
  await loadWithPasses(page, 'es');
  await page.keyboard.press('?');
  const overlay = page.getByTestId('shortcuts-overlay');
  await expect(overlay.getByRole('heading', { name: 'Atajos de teclado' })).toBeVisible();
  await expect(overlay.locator('kbd')).toHaveText(['j', 'k', 'Enter', 'Esc', 'l', 's', 'v', 'n', '?', 'g', 'w', 'd', ',', '.', 't', 'Space', 'a', 'f', '← →', '↑ ↓', '+ −', '0 Home']);
  await expect(overlay).toContainText('Pase siguiente de la lista');
  await expect(overlay).not.toContainText('Next pass in the list');
});

for (const locale of ['en', 'es'] as const) {
  for (const theme of ['dark', 'night'] as const) {
    test(`captures the overlay at 1280 px, ${theme}, ${locale}`, async ({ page }) => {
      await loadWithPasses(page, locale);
      if (theme === 'night') await page.keyboard.press('n');
      await page.keyboard.press('?');
      await expect(page.getByTestId('shortcuts-overlay')).toBeVisible();
      await expect(page.getByTestId('shortcuts-overlay').locator('kbd')).toHaveCount(22); // R115: `s`, and the stars page's two key rows; R127: `f`; R189: the desk sky keys and the box's zoom and reset
      await page.screenshot({ path: `docs/screenshots/r35-shortcuts-1280-${theme}-${locale}.png` });
    });
  }
}
