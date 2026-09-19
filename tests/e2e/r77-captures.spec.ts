/**
 * R77's record (FR-WATCH-9 f, FR-COMP-6's rule): the live page in both states — watching, and scrubbing on
 * the next pass's rise — at 390 × 844 and 1280 × 800, in both themes and both languages, filed as
 * `docs/screenshots/r77-live-<state>-<width>-<theme>-<locale>.png`. The Spanish captures also check that the
 * words the task added are the catalog's and not English left in place (FR-I18N-2). The landscape phone and
 * the short wide window are R78's.
 */
import { expect, test } from '@playwright/test';
import { domeDrawn, enterScrubbing, homeAt, setThemeOnHome, stripFilled, T } from './liveHelpers';

const WORDS = {
  en: { live: 'live', held: 'held', next: 'Next pass', share: 'Share this sky', moment: 'Share this moment' },
  es: { live: 'en vivo', held: 'fijado', next: 'Pasada siguiente', share: 'Compartir este cielo', moment: 'Compartir este momento' },
} as const;

for (const width of [390, 1280] as const) {
  for (const theme of ['dark', 'night'] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`captures ${String(width)} px, ${theme}, ${locale}: watching and scrubbing`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await homeAt(page, T, locale, true);
        if (theme === 'night') await setThemeOnHome(page, locale, 'night');
        await page.getByTestId('live-link').click();
        await domeDrawn(page);
        await stripFilled(page);
        const words = WORDS[locale];

        await expect(page.getByTestId('live-state-word')).toHaveText(words.live);
        await expect(page.getByRole('button', { name: words.share })).toBeVisible();
        await page.clock.runFor(500);
        await page.screenshot({ path: `docs/screenshots/r77-live-watching-${String(width)}-${theme}-${locale}.png` });

        await enterScrubbing(page);
        await page.getByRole('button', { name: words.next }).click();
        await page.clock.runFor(600);
        await expect(page.getByTestId('live-state-word')).toHaveText(words.held);
        await expect(page.getByRole('button', { name: words.moment })).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/r77-live-scrubbing-${String(width)}-${theme}-${locale}.png` });
      });
    }
  }
}
