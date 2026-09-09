/**
 * R36 (SPEC §9 Phase 2): "Desktop and phone captures for every screen in both
 * languages and both themes in `docs/screenshots/`" is a claim about a
 * directory, so it is checked against the directory. `tests/e2e/captureSet.ts`
 * says what the set is; `tests/e2e/v1-captures.spec.ts` produces it.
 *
 * This is a unit test and not part of the e2e run on purpose: `npm test` is
 * what every branch runs, so a screen added to the set — or a capture deleted
 * — is caught without a browser. Regenerate with
 * `npx playwright test v1-captures --project=chromium`.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPTURE_DIR, captureSet, LOCALES, SCREENS, THEMES } from '../e2e/captureSet';

const files = new Set(readdirSync(CAPTURE_DIR));
const v1Files = [...files].filter((file) => file.startsWith('v1-')).sort();

describe('the v1 capture set', () => {
  it('F-50: names every screen at both widths, in as many themes and languages as there are', () => {
    // F-50 (R37): the variants are counted, not remembered. The hard-coded `* 4` was the two
    // themes times the two languages, so a third theme or a third language would have been a set
    // this test called complete while a quarter of it was missing.
    // R73 (FR-FSC-7 as amended): a screen may name fewer themes or languages than there are — `sky-screen-turned`
    // is a geometry and the same picture in all four — so the count is per screen and the default is still all.
    expect(captureSet()).toHaveLength(SCREENS.reduce((total, screen) => total + screen.widths.length * (screen.themes ?? THEMES).length * (screen.locales ?? LOCALES).length, 0));
    expect(SCREENS.filter((screen) => screen.themes ?? screen.locales).map((screen) => screen.name)).toEqual(['sky-screen-turned']);
    /*
     * Every screen is on the phone and on the wide layout; nothing is desktop-only or phone-only.
     *
     * R64 (FR-FSC-7), widened by R66 (V13-6, V13-9), is the one exception, and it is an exception because
     * the app is: the sky screen is reached by the view control's "window", which is offered only where
     * FR-WIN-4's presence test passes — never on a desktop. So its widths are the phone's two, the
     * landscape one for the states the reader holds it sideways for and the portrait one for the two R73
     * added (the picture upright, and the layer turned under a rotation lock), and a 1280 px file would be
     * a picture of a screen no reader can be on. `window`, the same screen opened from a pass detail, is in
     * the exception for the same reason.
     */
    const UPRIGHT = new Set(['sky-screen-portrait', 'sky-screen-turned']);
    for (const screen of SCREENS) {
      if (screen.name.startsWith('sky-screen-') || screen.name === 'window') {
        expect(screen.widths, screen.name).toEqual(UPRIGHT.has(screen.name) ? [390] : [844]);
        continue;
      }
      expect(screen.widths, screen.name).toContain(390);
      expect(screen.widths, screen.name).toContain(1280);
    }
  });

  it('has every capture on disk, and none of them empty', () => {
    const missing = captureSet()
      .filter((capture) => !files.has(capture.file))
      .map((capture) => capture.file);
    expect(missing).toEqual([]);
    const empty = captureSet().filter((capture) => statSync(join(CAPTURE_DIR, capture.file)).size === 0);
    expect(empty.map((capture) => capture.file)).toEqual([]);
  });

  it('carries no v1 capture the set does not name', () => {
    const named = new Set(captureSet().map((capture) => capture.file));
    expect(v1Files.filter((file) => !named.has(file))).toEqual([]);
  });
});
