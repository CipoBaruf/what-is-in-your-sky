/**
 * R87 (FR-FIRST-1 and FR-FIRST-4 as amended v2.1, D-548, F-74): the phone's
 * first step is one screen with its footer. At 390 × 844 and 360 × 640, in
 * both languages: at 390 × 844 the header, the where step and the footer fit
 * the viewport with no scroll, and at 360 × 640 at most the footer is below the
 * fold (D-574 tightens the step's spacing under 700 px to get there). The
 * footer is the one-line form, with every credit and no privacy sentence,
 * because `home.savedFoot` says it four lines higher. Before R87 the step was
 * about 1180 px tall in an 844 px viewport.
 */
import { expect, test } from '@playwright/test';
import { NINE_DAYS_ON, stubNetwork } from './liveHelpers';

const LANGUAGES = [
  { locale: 'en-GB', lang: 'en', privacy: ['No tracking', 'No analytics, no tracking'] },
  { locale: 'es-AR', lang: 'es', privacy: ['Sin rastreo', 'Sin analítica ni rastreo'] },
] as const;

/** `whole`: the page's `scrollHeight` is the viewport's at most. `footer`: everything above the footer is. */
const VIEWPORTS = [
  { width: 390, height: 844, fits: 'whole' },
  { width: 360, height: 640, fits: 'footer' },
] as const;

for (const language of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${language.lang} at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
      test.use({ locale: language.locale, viewport: { width: viewport.width, height: viewport.height } });

      test(viewport.fits === 'whole' ? 'the where step and its line footer fit the screen with no scroll' : 'nothing but the footer is below the fold', async ({ page }) => {
        await page.clock.setFixedTime(NINE_DAYS_ON);
        await stubNetwork(page);
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('lang', language.lang);
        await expect(page.getByTestId('cold-open')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const footer = page.getByRole('contentinfo');
        await expect(footer).toHaveAttribute('data-form', 'line');
        // R102 (FR-SHOW-8): the three sources, the maker, glyphcss and its author.
        await expect(footer.getByRole('link')).toHaveCount(6);
        await expect(footer).toContainText('CelesTrak');
        await expect(footer).toContainText('(CC BY 4.0)');
        for (const privacy of language.privacy) await expect(footer).not.toContainText(privacy);

        const { scrollHeight, innerHeight, footerHeight } = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
          footerHeight: document.querySelector('footer')?.getBoundingClientRect().height ?? 0,
        }));
        const allowed = viewport.fits === 'whole' ? innerHeight : innerHeight + footerHeight;
        expect(scrollHeight, `the page is ${String(scrollHeight)} px in a ${String(innerHeight)} px viewport, its footer ${String(footerHeight)} px`).toBeLessThanOrEqual(allowed);
      });
    });
  }
}
