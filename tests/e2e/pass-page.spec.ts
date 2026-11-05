/**
 * v2.14.1 (FR-WIDE-1, FR-CLEAN-14, FR-WIDE-3 as amended; D-1134..D-1137): the wide pass page from the owner's desk
 * review — a header page with `[ ← ]` and `[ satellites ]`, its rail tonight's passes opened in place and never wider
 * than the page, and its arc the whole path, faced at open, paused at the rise. Every *Verification* line of the three
 * amended requirements, at 1024 × 640, 1280 × 800 and 1920 × 1080, in both languages.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { NINE_DAYS_ON, seedStoredRun, STORED_RUN } from './liveHelpers';

type Locale = 'en' | 'es';
const SIZES = [
  [1024, 640],
  [1280, 800],
  [1920, 1080],
] as const;
const LOCALES: readonly Locale[] = ['en', 'es'];
const WORD = { en: { satellites: 'satellites', back: 'Back' }, es: { satellites: 'satélites', back: 'Volver' } } as const;
const LIVE_WINDOW_MS = 24 * 3_600_000;

/** A stored pass's id and times, as the run file holds them. */
interface RunPass {
  id: string;
  start: { t: number };
  end: { t: number };
}
const RUN_PASSES = STORED_RUN.passes as RunPass[];

/** The home on a desk, the stored run's list settled, nothing saved but the language (a fresh desk opens the globe). */
async function home(page: Page, locale: Locale): Promise<void> {
  await seedStoredRun(page, { locale, settled: true, prefs: { chartView: undefined, theme: 'dark' } });
}

/** `[ satellites ]` from the header, and the pass page drawn. */
async function openFromHeader(page: Page): Promise<Locator> {
  await page.getByTestId('pass-link').click();
  return passPage(page);
}

async function passPage(page: Page): Promise<Locator> {
  const layout = page.getByTestId('pass-layout');
  await expect(layout).toBeVisible({ timeout: 30_000 });
  await expect(layout.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
  return layout;
}

const startOf = (id: string): number => Number(/-(\d+)$/.exec(id)?.[1] ?? NaN);

for (const [width, height] of SIZES) {
  test.describe(`${String(width)} × ${String(height)}`, () => {
    test.use({ viewport: { width, height } });
    for (const locale of LOCALES) {
      test.describe(locale, () => {
        test('FR-WIDE-1, FR-CLEAN-14: the header is a sub-page’s — [ ← ] first, [ satellites ] current — and [ ← ] returns home with the card in view (D-1134)', async ({ page }, info) => {
          test.skip(info.project.name !== 'chromium', 'the sizes are this file’s own');
          await home(page, locale);
          await openFromHeader(page);
          const header = page.locator('#root > header');
          const back = header.getByRole('button', { name: WORD[locale].back });
          await expect(back).toBeVisible();
          const links = header.getByRole('navigation').locator('[data-testid$="-link"]');
          await expect(links).toHaveText(locale === 'es' ? ['inicio', 'en vivo', 'satélites', 'estrellas'] : ['home', 'live', 'satellites', 'stars']);
          await expect(header.getByTestId('pass-link')).toHaveAttribute('aria-current', 'page');
          await expect(header.getByTestId('pass-link')).toHaveText(WORD[locale].satellites);
          const id = await page.getByTestId('guide-panel').getAttribute('data-pass-id');
          await back.click();
          await expect(page).not.toHaveURL(/#pass/);
          const card = page.locator(`article[data-pass-id="${id ?? ''}"]`);
          await expect(card).toBeInViewport();
          await expect(card).toBeFocused();
        });
      });
    }
  });
}

test.describe('FR-CLEAN-14: [ satellites ] opens the pass up, else the next, else the page with no pass (D-1134)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('with one ahead: the first rise after now', async ({ page }) => {
    await home(page, 'en');
    const href = (await page.getByTestId('pass-link').getAttribute('href')) ?? '';
    const ids = await page.locator('article[data-pass-id]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pass-id') ?? ''));
    const ahead = ids.map(startOf).filter((t) => t > NINE_DAYS_ON);
    expect(href).toMatch(/^#pass=\d+-\d+$/);
    expect(startOf(href)).toBe(Math.min(...ahead));
    await openFromHeader(page);
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('with a pass up: that pass', async ({ page }) => {
    const target = RUN_PASSES.filter((pass) => pass.start.t > NINE_DAYS_ON).sort((a, b) => a.start.t - b.start.t)[0];
    if (!target) throw new Error('the stored run has no pass ahead');
    const at = target.start.t + 60_000;
    await home(page, 'en');
    // The clock set again before the load: the pass is up; the recompute from that instant clips its rise (gotchas).
    await page.clock.setFixedTime(at);
    await page.reload();
    await expect(page.locator('article[data-pass-id]').first()).toBeAttached({ timeout: 30_000 });
    const norad = target.id.split('-')[0] ?? '';
    await expect.poll(async () => (await page.getByTestId('pass-link').getAttribute('href')) ?? '', { timeout: 30_000 }).toMatch(new RegExp(`^#pass=${norad}-\\d+$`));
    const href = (await page.getByTestId('pass-link').getAttribute('href')) ?? '';
    expect(startOf(href)).toBeGreaterThanOrEqual(target.start.t - 1000);
    expect(startOf(href)).toBeLessThanOrEqual(at);
    await openFromHeader(page);
  });

  test('with none in the span: `#pass`, the list’s empty line and no arc', async ({ page }) => {
    const later = RUN_PASSES.filter((pass) => pass.start.t > NINE_DAYS_ON + LIVE_WINDOW_MS);
    await seedStoredRun(page, { settled: false, elements: 'down', run: { ...STORED_RUN, passes: later }, prefs: { chartView: undefined } });
    await expect(page.getByTestId('pass-link')).toHaveAttribute('href', '#pass');
    const layout = await openFromHeader(page);
    await expect(page).toHaveURL(/#pass$/);
    await expect(page.getByTestId('pass-empty')).toBeVisible();
    await expect(page.getByTestId('pass-link')).toHaveAttribute('aria-current', 'page');
    await expect(layout.locator('[data-arc-series][data-pass-ids]:not([data-pass-ids=""])')).toHaveCount(0);
  });
});
