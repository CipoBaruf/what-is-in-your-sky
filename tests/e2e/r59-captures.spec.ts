/**
 * R59 captures (FR-FOL-1, FR-FOL-3, FR-LIVE-7 as amended v1.2): the live page
 * on a phone, before and after `[ follow phone ]` is pressed — the two states
 * the control moves between. The first shot is the page not following: the
 * dome in its box, the rows under it spaced by the one `--live-row-gap`
 * (D-281), the stripe block and the playback row where they belong. The
 * second is following: the sky window in the box, the control pressed, the
 * stripe block and the playback row gone (FR-WIN-6) and the strip carrying the
 * true-north line.
 *
 * Evidence for the PR, not a test: the assertions only make sure each capture
 * shows the state it is named after. Off the pull-request path (FR-CI-1's
 * budget), like R54's, R55's and R56's:
 *
 *   CAPTURES=1 npx playwright test r59-captures --project=chromium
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR, LOCALES, THEMES } from './captureSet';
import { domeDrawn, heading, homeAt, setThemeOnHome, stripFilled, stubCompass, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const FRAME_MS = 16;
const FOLLOW = { en: 'Follow phone', es: 'Seguir al teléfono' } as const;

test.describe('the live page, following and not', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`capture: the live page and the window the control opens, 390 px, ${theme}, ${locale}`, async ({ page }) => {
        await stubCompass(page);
        await homeAt(page, T, locale, true);
        if (theme === 'night') await setThemeOnHome(page, locale, 'night');
        await page.getByTestId('live-link').click();
        await domeDrawn(page);
        await stripFilled(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // Not following: the stripe block and the playback row are on the page, and the control is unpressed.
        await expect(page.getByTestId('stripe-block')).toBeVisible();
        await expect(page.getByTestId('playback-row')).toBeVisible();
        await expect(page.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r59-live-390-${theme}-${locale}.png` });

        // Following: the press asks and arms, and the first reading with a north in it opens the window.
        await page.getByRole('button', { name: FOLLOW[locale] }).click();
        await heading(page, 270);
        await expect(page.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
        // The paused clock holds the lazy chunk's Suspense reveal (R32).
        await page.clock.runFor(1000);
        await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
        await expect(page.getByTestId('stripe-block')).toHaveCount(0);
        await expect(page.getByTestId('playback-row')).toHaveCount(0);
        await expect(page.getByTestId('live-heading')).toBeVisible();

        // Turned to where the pass is: the picture is worth more with an arc in it than with an empty sky.
        const window_ = page.locator('[data-look-az]');
        await expect(window_).toBeAttached();
        for (const azDeg of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
          await page.evaluate(
            ([alpha, beta]) => {
              globalThis.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha, beta, gamma: 0, absolute: true }));
            },
            [(360 - azDeg) % 360, 110] as [number, number],
          );
          // Frames enough for the FR-WIN-3 smoothing to settle on the reading.
          await page.clock.runFor(40 * FRAME_MS);
          if ((await page.locator('[data-drawing="window"] [data-pass-id]').count()) > 0) break;
        }
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r59-live-390-following-${theme}-${locale}.png` });
      });
    }
  }
});
