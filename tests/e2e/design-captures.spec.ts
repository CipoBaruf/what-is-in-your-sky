/**
 * R108 (FR-DS-6, FR-DS-9; D-706, D-728): the design captures — the dev page,
 * `dev/primitives.html`, shot at 390 and 1280 px, one file per theme, into
 * `docs/screenshots/design/`. `captureSet.ts`'s `design` group says what the
 * four files are and `tests/docs/captures.test.ts` checks the directory against
 * it; this file fills it.
 *
 *   npm run design:captures
 *
 * Only `playwright.design.config.ts` runs it: the committed config serves the
 * production build, where the page does not exist, so under `npm run e2e` the
 * spec is never matched (D-706). Like `v1-captures.spec.ts`, this is evidence
 * and not a test — every assertion is there so a file cannot be a picture of a
 * page that had not finished, or of a page missing a primitive the manifest has.
 *
 * One file is one theme: the page draws both palettes as two `data-theme`
 * subtrees side by side (stacked at 390 px), and the capture is that subtree
 * alone, so a token's change in one theme is a diff in that theme's file and
 * the other stays byte-identical. The page is static — no clock, no network,
 * no animation — so two runs on one box agree to the byte (FR-CAP-5's bar).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { PRIMITIVES } from '../../src/ui/components/primitives/manifest';
import { DESIGN_CAPTURE_DIR, DESIGN_PAGE, designCaptureSet, VIEWPORTS } from './captureSet';

for (const capture of designCaptureSet()) {
  test(capture.file, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[capture.width]);
    await page.goto(DESIGN_PAGE);
    // The grid is the fonts': `--cell` is a character advance, so nothing is measured before they are in.
    await page.evaluate(() => document.fonts.ready);

    const column = page.locator(`section[data-theme="${capture.theme}"]`);
    await expect(column).toBeVisible();
    // Every manifest row is on the page with its specimens; a row without one reads "no specimen" and fails here.
    for (const primitive of PRIMITIVES) await expect(column.locator(`[data-primitive="${primitive.name}"]`)).toBeVisible();
    await expect(column.locator('[data-primitive]')).toHaveCount(PRIMITIVES.length);
    await expect(column.locator('.missing')).toHaveCount(0);
    // The page states its mode: compact under the wide breakpoint, wide above it.
    await expect(page.locator('.page')).toHaveAttribute('data-compact', capture.width === 390 ? 'true' : 'false');

    mkdirSync(DESIGN_CAPTURE_DIR, { recursive: true });
    await column.screenshot({ path: join(DESIGN_CAPTURE_DIR, capture.file), animations: 'disabled', caret: 'hide' });
  });
}
