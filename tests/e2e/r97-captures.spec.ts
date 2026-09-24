/**
 * R97 captures (FR-FAINT-2): the list with faint passes hidden — `[ show 4 faint ]` on the count line — and
 * shown, dimmed and tagged `[faint]` in their places, at 390 and 1280 px, both themes and both languages. The
 * second night is opened in both, since the stored run's faint passes fall on the later nights.
 *
 * Evidence for the PR, not a test; off the pull-request path (FR-CI-1):
 *
 *   CAPTURES=1 npx playwright test r97-captures --project=chromium
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { LABEL, listSettled, seedStoredRun } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const THEMES = ['dark', 'night'] as const;
const LOCALES = ['en', 'es'] as const;

for (const width of [390, 1280] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the list with faint passes hidden and shown at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await seedStoredRun(page, { locale, prefs: { theme } });
        await listSettled(page);
        const list = page.getByRole('region', { name: LABEL[locale].passes });
        const second = list.getByTestId('night-toggle').nth(1);
        if ((await second.getAttribute('aria-expanded')) === 'false') await second.click();
        // On a phone the list is the page, drawn whole; on a desk it is a pane that scrolls on its own, so the capture
        // is the window with the count line, then the first faint card, in view.
        const shoot = async (state: string): Promise<void> => {
          const path = `${CAPTURE_DIR}/r97-list-${String(width)}-${theme}-${locale}-${state}.png`;
          if (width === 390) await list.screenshot({ path });
          else await page.screenshot({ path });
        };
        await list.getByTestId('count-line').scrollIntoViewIfNeeded();
        await shoot('hidden');
        await list.getByTestId('faint-toggle').click();
        const faint = list.getByTestId('card-faint').first();
        await expect(faint).toBeVisible();
        if (width !== 390) await faint.scrollIntoViewIfNeeded();
        await shoot('shown');
      });
    }
  }
}
