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
 * R206 (FR-DS-13, D-1227): hover and focus are forced on their cells through CDP
 * `CSS.forcePseudoState`, so no production CSS carries a test selector.
 *
 * R209 (D-1256): the page is shot under reduced motion, so a busy button's words
 * are held at the pulse's low end and not at whatever frame the shot fell on.
 *
 * One file is one theme: the page draws both palettes as two `data-theme`
 * subtrees side by side (stacked at 390 px), and the capture is that subtree
 * alone, so a token's change in one theme is a diff in that theme's file and
 * the other stays byte-identical. The page is static — no clock, no network,
 * no animation — so two runs on one box agree to the byte (FR-CAP-5's bar).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PRIMITIVES } from '../../src/ui/components/primitives/manifest';
import { DESIGN_CAPTURE_DIR, DESIGN_PAGE, designCaptureSet, VIEWPORTS } from './captureSet';

/** Force `:hover` on the hover cells' controls and `:focus-visible` on the focus cells', for as long as the page lives. */
async function forceStates(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  for (const [state, pseudo] of [
    ['hover', ['hover']],
    ['focus', ['focus', 'focus-visible']],
  ] as const) {
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: `[data-state="${state}"] :is(button, a, input, summary)` });
    expect(nodeIds.length, `the ${state} cells' controls`).toBeGreaterThan(0);
    for (const nodeId of nodeIds) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [...pseudo] });
  }
}

for (const capture of designCaptureSet()) {
  test(capture.file, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[capture.width]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
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

    await forceStates(page);
    for (const { name, states } of PRIMITIVES) {
      for (const state of states) await expect(column.locator(`[data-primitive="${name}"] [data-state="${state}"]`), `${name}, ${state}`).toHaveCount(1);
    }
    // The forced states are drawn, and the control tokens are this column's theme's.
    const cell = (name: string, state: string) => column.locator(`[data-primitive="${name}"] [data-state="${state}"] button`).first();
    await expect(cell('TextButton', 'focus')).toHaveCSS('outline-style', 'solid');
    await expect(cell('TextButton', 'hover').locator('span')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const ink = await column.evaluate((el) => getComputedStyle(el).color);
    await expect(cell('OptionToggle', 'on').locator('span')).toHaveCSS('background-color', ink);

    // R209, what jsdom cannot measure. FR-CTRL-4: busy, the button and its box are the size they rest at.
    const box = (state: string) => cell('TextButton', state).evaluate((el) => [el, el.firstElementChild ?? el].map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]));
    expect(await box('busy')).toEqual(await box('rest'));
    await expect(cell('TextButton', 'busy').locator('span > span')).toHaveCSS('opacity', '0.35');
    // FR-CTRL-7: the field's box is the button's height, and its hover and focus are drawn on it.
    const frame = (state: string) => column.locator(`[data-primitive="Field"] [data-state="${state}"] input + span`);
    const height = (at: ReturnType<typeof frame>) => at.evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs((await height(frame('rest'))) - (await height(cell('TextButton', 'rest').locator('span'))))).toBeLessThan(1);
    const resting = await frame('rest').evaluate((el) => getComputedStyle(el).borderTopColor);
    await expect(frame('hover')).not.toHaveCSS('border-top-color', resting);
    await expect(frame('focus')).not.toHaveCSS('box-shadow', 'none');
    // FR-CTRL-12: the close's hit area is --target both ways.
    const close = await cell('Close', 'rest').boundingBox();
    expect(Math.min(close?.width ?? 0, close?.height ?? 0)).toBeGreaterThanOrEqual(43.9);

    mkdirSync(DESIGN_CAPTURE_DIR, { recursive: true });
    await column.screenshot({ path: join(DESIGN_CAPTURE_DIR, capture.file), animations: 'disabled', caret: 'hide' });
  });
}
