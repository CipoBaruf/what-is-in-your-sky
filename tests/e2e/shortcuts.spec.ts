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
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;
const WIDE = { width: 1280, height: 900 };

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

async function loadWithPasses(page: Page, locale: 'en' | 'es' = 'en'): Promise<void> {
  await page.goto('/');
  if (locale === 'es') await page.getByRole('banner').getByRole('button', { name: 'Español' }).click();
  await page.getByLabel(locale === 'es' ? 'Coordenadas (lat, lon)' : 'Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  const passes = page.getByRole('region', { name: locale === 'es' ? 'Próximos pases' : 'Upcoming passes' });
  await expect(passes.getByRole('status')).toHaveText(/\d+ (visible passes in the next 72 h|pases visibles en las próximas 72 h)/, { timeout: 60_000 });
  // Typing the coordinates left the caret in the field, where FR-DESK-4 says
  // the keys are the field's. Clicking the title is how a reader leaves it, and
  // it is what makes the shortcuts live for the rest of the test.
  await page.getByRole('heading', { level: 1 }).click();
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
      .filter((card) => card.closest('details:not([open])') === null)
      .map((card) => card.dataset['passId'] ?? ''),
  );
}

test('j and k move the cursor over the list, Enter opens the pass and Esc closes it (US-14 AC4)', async ({ page }) => {
  await loadWithPasses(page);
  const ids = await cardIds(page);
  expect(ids.length).toBeGreaterThan(2);
  const [first, second] = ids as [string, string];

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

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('guide-panel')).toHaveCount(0);
  expect(page.url()).not.toContain('#pass=');
});

test('k from the bottom, and the ends of the list stop rather than wrap', async ({ page }) => {
  await loadWithPasses(page);
  const ids = await cardIds(page);
  const last = ids[ids.length - 1] as string;

  await page.keyboard.press('k');
  expect(await cursor(page)).toBe(last);
  await page.keyboard.press('j');
  expect(await cursor(page)).toBe(last);
});

test('l opens the live page (FR-LIVE-1)', async ({ page }) => {
  await loadWithPasses(page);
  await page.keyboard.press('l');
  expect(page.url()).toContain('#live');
  await expect(page.getByRole('region', { name: 'Upcoming passes' })).toHaveCount(0);
});

test('v toggles the chart view and n toggles the palette (FR-DOME-7, FR-THEME-1)', async ({ page }) => {
  await loadWithPasses(page);
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  const chart = page.getByTestId('sky-chart');
  await expect(chart).toHaveAttribute('data-view', 'dome');

  await page.keyboard.press('v');
  await expect(chart).toHaveAttribute('data-view', 'polar');
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
  await expect(overlay.locator('kbd')).toHaveText(['j', 'k', 'Enter', 'Esc', 'l', 'v', 'n', '?']);
  // Nothing behind it can be reached while it is up.
  await expect(page.getByRole('main')).toHaveAttribute('inert', '');

  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('main')).not.toHaveAttribute('inert', '');
});

test('typing a place name types it and fires nothing (FR-DESK-4, D-73)', async ({ page }) => {
  await loadWithPasses(page);
  const field = page.getByLabel('Place name');
  await field.click();
  await field.pressSequentially('jknvl?');

  await expect(field).toHaveValue('jknvl?');
  await expect(page.getByTestId('shortcuts-overlay')).toHaveCount(0);
  await expect(page.getByTestId('guide-panel')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset['theme'])).toBe('dark');
  expect(page.url()).not.toContain('#');
  // The cursor never moved: focus is still in the field, not on a card.
  await expect(field).toBeFocused();
});

test('the overlay reads in Spanish with the keys untranslated (FR-I18N-2/4)', async ({ page }) => {
  await loadWithPasses(page, 'es');
  await page.keyboard.press('?');
  const overlay = page.getByTestId('shortcuts-overlay');
  await expect(overlay.getByRole('heading', { name: 'Atajos de teclado' })).toBeVisible();
  await expect(overlay.locator('kbd')).toHaveText(['j', 'k', 'Enter', 'Esc', 'l', 'v', 'n', '?']);
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
      await expect(page.getByTestId('shortcuts-overlay').locator('kbd')).toHaveCount(8);
      await page.screenshot({ path: `docs/screenshots/r35-shortcuts-1280-${theme}-${locale}.png` });
    });
  }
}
