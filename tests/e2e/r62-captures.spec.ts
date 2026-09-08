/**
 * R62 captures (FR-FSC-6, FR-WIN-4 and FR-WIN-5 as amended v1.3): the compact
 * live page with the view control R62 leaves it — the dome and the polar chart,
 * two options on one row. The shot is taken on a phone with a compass, which is
 * the device that used to be offered a third option here: on this page the
 * window is reached by `[ follow phone ]` alone now, and a `window` this phone
 * saved is drawn as the dome and left in the preference for the pass detail.
 *
 * These replace `r59-live-390-{theme}-{locale}.png`, which are the same page
 * with the three-option control that wrapped to a second row. The following
 * state R59 also captured is unchanged by R62 and is R64's to re-shoot as the
 * follow screen.
 *
 * Evidence for the PR, not a test: the assertions only make sure each capture
 * shows the state it is named after. Off the pull-request path (FR-CI-1's
 * budget), like R54's, R55's, R56's and R59's:
 *
 *   CAPTURES=1 npx playwright test r62-captures --project=chromium
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR, LOCALES, THEMES } from './captureSet';
import { domeDrawn, homeAt, setThemeOnHome, stripFilled, stubCompass, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;
const VIEWS = { en: ['Polar', 'Dome'], es: ['Polar', 'Domo'] } as const;

test.describe('the compact live page and its view control', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`capture: the live page's two-option view control, 390 px, ${theme}, ${locale}`, async ({ page }) => {
        await stubCompass(page);
        await homeAt(page, T, locale, true);
        if (theme === 'night') await setThemeOnHome(page, locale, 'night');
        await page.getByTestId('live-link').click();
        await domeDrawn(page);
        await stripFilled(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);

        // FR-FSC-6: two options, and no "Window" — on a phone the presence test passes and the option used to be there.
        const toggle = page.getByRole('group', { name: VIEW_GROUP[locale] });
        await expect(toggle.getByRole('button')).toHaveText([...VIEWS[locale]]);
        // …on one row: the control is no taller than one tap target (G6's 48 px), which the third option cost it.
        const box = await toggle.boundingBox();
        expect(box?.height ?? 0).toBeLessThanOrEqual(56);
        // The follow control is what reaches the window here, and it is still offered.
        await expect(page.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');

        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r62-live-390-${theme}-${locale}.png` });
      });
    }
  }
});
