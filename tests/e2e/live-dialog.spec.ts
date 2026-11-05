/**
 * v2.14.1 (FR-WIDE-13, V214-31; D-1140): the wide live page's first-pass dialog at 1280 × 800 in both languages. By
 * day at Neuquén nothing is up and tonight's first pass rises hours ahead, so the page asks once per visit — "Nothing
 * is up right now. Go to the first pass and play?" — focus on `[ go and play ]`, which holds the page at the pass's
 * rise and plays; `[ stay here ]` and `Esc` leave it at now (and `Esc` does not leave the page). Leaving the page and
 * coming back by the hash within the visit does not ask again; a pass up at now never asks. Axe on the open dialog.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { NINE_DAYS_ON, recomputeEnded, seedStoredRun } from './liveHelpers';

/** Twelve hours after the seed's instant: 15:51 UTC, 12:51 at Neuquén — by day, with tonight's passes ahead (`live-jump.spec.ts`'s). */
const MIDDAY = NINE_DAYS_ON + 12 * 3_600_000;

const WORDS = {
  en: { question: 'Nothing is up right now. Go to the first pass and play?', go: 'go and play', stay: 'stay here' },
  es: { question: 'Ahora no hay nada arriba. ¿Ir al primer pase y reproducir?', go: 'ir y reproducir', stay: 'quedarme' },
} as const;

/** The live page by day, reached by the hash from a settled home (no job starts), the dialog left to the spec. */
async function openLiveAt(page: Page, locale: 'en' | 'es', at: number): Promise<void> {
  await seedStoredRun(page, { settled: true, locale, firstPass: 'ask', prefs: { chartView: undefined } });
  await page.clock.setFixedTime(at);
  await page.reload();
  await recomputeEnded(page);
  await page.evaluate(() => {
    window.location.hash = '#live';
  });
  await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
}

const dialog = (page: Page) => page.getByRole('dialog');

for (const locale of ['en', 'es'] as const) {
  const words = WORDS[locale];
  test.describe(`the first-pass dialog at 1280 × 800, ${locale} (FR-WIDE-13)`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

    test('asks with nothing up, focus on its first button, no axe violation; go and play holds the rise and plays', async ({ page }) => {
      await openLiveAt(page, locale, MIDDAY);
      const shown = page.getByRole('dialog', { name: words.question });
      await expect(shown).toBeVisible({ timeout: 30_000 });
      await expect(shown).toHaveAttribute('aria-modal', 'true');
      await expect(shown.getByRole('button')).toHaveText([words.go, words.stay]);
      await expect(page.getByTestId('first-pass-go')).toBeFocused();
      // It stands in for the headline's `[ see this pass ]` while it asks.
      await expect(page.getByTestId('next-event-see')).toHaveCount(0);
      const results = await new AxeBuilder({ page }).include('[data-testid="first-pass-dialog"]').analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      // The page behind is inert: Tab stays in the dialog.
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('first-pass-stay')).toBeFocused();

      await page.getByTestId('first-pass-go').click();
      await expect(dialog(page)).toHaveCount(0);
      // Held at the first pass's rise — FR-JUMP-1's landing — and playing at the row's speed.
      const stripe = page.getByTestId('time-stripe');
      await expect(stripe).toBeVisible();
      const play = page.getByTestId('live-play');
      await expect(play).toHaveAttribute('data-playing', 'true');
      const held = Number(await stripe.getAttribute('aria-valuenow'));
      expect(held - MIDDAY, 'the rise is more than two minutes and less than a day ahead').toBeGreaterThan(120_000);
      expect(held - MIDDAY).toBeLessThanOrEqual(24 * 3_600_000);
      await page.clock.runFor(1_000);
      await expect.poll(async () => Number(await stripe.getAttribute('aria-valuenow'))).toBeGreaterThan(held);
    });

    test('stay here leaves the page at now; back by the hash within the visit, it is not asked again', async ({ page }) => {
      await openLiveAt(page, locale, MIDDAY);
      await expect(dialog(page)).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('first-pass-stay').click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
      await expect(page.getByTestId('time-control')).toHaveAttribute('data-state', 'watching');
      await expect(page.getByTestId('next-event-see')).toBeVisible();
      // Home and back by the hash: the same visit.
      await page.evaluate(() => {
        window.location.hash = '';
      });
      await expect(page.getByTestId('live-layout')).toHaveCount(0);
      await page.evaluate(() => {
        window.location.hash = '#live';
      });
      await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('next-event-see')).toBeVisible();
      await expect(dialog(page)).toHaveCount(0);
    });

    test('Esc is stay here, and does not also leave the page', async ({ page }) => {
      await openLiveAt(page, locale, MIDDAY);
      await expect(dialog(page)).toBeVisible({ timeout: 30_000 });
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect(page.getByTestId('live-layout')).toBeVisible();
      await expect(page.getByTestId('time-control')).toHaveAttribute('data-state', 'watching');
      expect(await page.evaluate(() => window.location.hash)).toMatch(/^#live/);
      await expect(page.getByTestId('first-pass-go')).toHaveCount(0);
    });

    test('is not shown with a pass up', async ({ page }) => {
      // The rise the dialog would go to, then a new visit thirty seconds after it, the pass up.
      await openLiveAt(page, locale, MIDDAY);
      await page.getByTestId('first-pass-stay').click();
      const rise = Number(await page.getByTestId('next-event-see').getAttribute('data-rise'));
      await page.clock.setFixedTime(rise + 30_000);
      await page.reload();
      await recomputeEnded(page);
      await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('next-event-label')).not.toHaveAttribute('data-kind', 'rise', { timeout: 30_000 });
      await page.clock.runFor(2_000);
      await expect(dialog(page)).toHaveCount(0);
    });
  });
}
