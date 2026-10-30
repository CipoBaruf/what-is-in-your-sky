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
 *
 * R94 (SPEC §4.39, FR-CAP-1..3, FR-TAB-3): the set's shape after v2.1 — a
 * `-view` twin where a capture differs from what the reader opens, a 360 px
 * column beside every 390 one, a 768 px column for four screens and the home at
 * 1920 — is pinned here as well, so the arithmetic of D-626 is a test and not a
 * count somebody did once.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPTURE_DIR, CAPTURE_FILE, captureSet, DESIGN_CAPTURE_DIR, DESIGN_FILE, designCaptureSet, LOCALES, SCREENS, THEMES } from '../e2e/captureSet';

const files = new Set(readdirSync(CAPTURE_DIR));
const v1Files = [...files].filter((file) => file.startsWith('v1-')).sort();
/** R108: the design captures' directory, read the same way; absent is an empty list and the test below says so. */
const designFiles = existsSync(DESIGN_CAPTURE_DIR) ? readdirSync(DESIGN_CAPTURE_DIR).sort() : [];

describe('the v1 capture set', () => {
  it('F-50: names every screen at both widths, in as many themes and languages as there are', () => {
    // F-50 (R37): the variants are counted, not remembered. The hard-coded `* 4` was the two
    // themes times the two languages, so a third theme or a third language would have been a set
    // this test called complete while a quarter of it was missing.
    // R73 (FR-FSC-7 as amended): a screen may name fewer themes or languages than there are — `sky-screen-turned`
    // is a geometry and the same picture in all four — so the count is per screen and the default is still all.
    // R94 (FR-CAP-1): a screen with `view` has every file twice, the second cropped to the viewport.
    expect(captureSet()).toHaveLength(SCREENS.reduce((total, screen) => total + screen.widths.length * (screen.themes ?? THEMES).length * (screen.locales ?? LOCALES).length * (screen.view ? 2 : 1), 0));
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
     *
     * R94 (FR-CAP-2): every compact screen with a 390 px picture has a 360 px one beside it — the upright
     * sky screens included, since they are compact screens with a 390 px capture.
     *
     * R118 (FR-STAR-5, D-786): `stars-screen` is the same layer in its stars inventory, opened by
     * `[ hold up to the sky ]`, which is offered only where the presence test passes; it is shot sideways
     * at 844 like `sky-screen-sky`, and the `stars` page under it is an ordinary screen with all four widths.
     *
     * R128 (FR-SKY-9, D-829): `stars-passes-screen` is the same layer opened from the page with `[ passes ]` on,
     * so it joins the exception. And the other way round, two desk screens: `live-window-follow` (`f` is a key,
     * FR-SKY-13) and `stars-zoom` (the narrowest field), each at the one width FR-SKY-9 names for it, 1280.
     */
    const UPRIGHT = new Set(['sky-screen-portrait', 'sky-screen-turned']);
    const DESK_ONLY = new Set(['live-window-follow', 'stars-zoom']);
    // R135 (FR-FLOW-14): `live-window` is a desk's screen too — on a phone `live-watching` opens on the window, and
    // a 360 or 390 px `live-window` file was the same picture under a second name. It keeps both desk widths.
    const DESK_WIDE = new Set(['live-window']);
    // R135 (FR-FLOW-2, FR-FLOW-12): the Where opened by its `[ details ]` is a phone's screen — on wide the Where is
    // never folded (D-844), so there is nothing to open and no 1280 px file to shoot.
    // R145 (FR-TONIGHT-1): the jumped live page was a phone's screen too, at 360 and 390 — wide never jumps; R149
    // turned it into the card and gave it the turned phone, below.
    const PHONE_ONLY = new Set(['where-opened']);
    // R149 (FR-FULL-9, FR-FULL-10, D-937): the sheet open and the sheet with the list are the phone's two sizes
    // FR-FULL-9 names, upright and turned, and the card is the day's opening state upright (with the 360 beside the
    // 390) and turned; wide has no sheet and never asks, so a 1280 px file would be `live-watching`'s.
    const PHONE_TURNED: ReadonlyMap<string, readonly number[]> = new Map([
      ['live-tonight', [360, 390, 844]],
      ['live-sheet', [390, 844]],
      ['live-sheet-list', [390, 844]],
    ]);
    for (const screen of SCREENS) {
      if (PHONE_ONLY.has(screen.name)) {
        expect(screen.widths, screen.name).toEqual([360, 390]);
        continue;
      }
      const turned = PHONE_TURNED.get(screen.name);
      if (turned) {
        expect(screen.widths, screen.name).toEqual(turned);
        continue;
      }
      if (screen.name.startsWith('sky-screen-') || screen.name === 'window' || screen.name === 'stars-screen' || screen.name === 'stars-passes-screen') {
        expect(screen.widths, screen.name).toEqual(UPRIGHT.has(screen.name) ? [360, 390] : [844]);
        continue;
      }
      if (DESK_WIDE.has(screen.name)) {
        expect(screen.widths, screen.name).toEqual([1280, 1920]);
        continue;
      }
      if (DESK_ONLY.has(screen.name)) {
        expect(screen.widths, screen.name).toEqual([1280]);
        continue;
      }
      expect(screen.widths, screen.name).toContain(390);
      expect(screen.widths, screen.name).toContain(360);
      expect(screen.widths, screen.name).toContain(1280);
    }
  });

  it('R94: the `-view` twin, the 768 column and the home at 1920 (FR-CAP-1, FR-CAP-3, FR-TAB-3)', () => {
    // FR-CAP-1: the home is the one screen whose capture differs from what the reader opens (every night closed).
    expect(SCREENS.filter((screen) => screen.view).map((screen) => screen.name)).toEqual(['home']);
    const home = SCREENS.find((screen) => screen.name === 'home');
    expect(home?.what).toMatch(/closed/);
    // FR-CAP-3: the home at 1920 × 1080, all four variants, and its `-view` twin there too (OQ-32's evidence).
    expect(captureSet().filter((capture) => capture.screen.name === 'home' && capture.width === 1920).map((capture) => capture.file)).toEqual([
      'v1-home-1920-dark-en.png',
      'v1-home-1920-dark-es.png',
      'v1-home-1920-night-en.png',
      'v1-home-1920-night-es.png',
      'v1-home-1920-view-dark-en.png',
      'v1-home-1920-view-dark-es.png',
      'v1-home-1920-view-night-en.png',
      'v1-home-1920-view-night-es.png',
    ]);
    // FR-TAB-3: the 768 px column for the home, the guide, the live page (both states since R80) and settings.
    expect(SCREENS.filter((screen) => screen.widths.includes(768)).map((screen) => screen.name)).toEqual(['home', 'settings', 'guide', 'live-watching', 'live-scrubbing']);
    // D-626's arithmetic, as it came out: 161 + 45 (the 360 column) + 4 (home at 1920) + 20 (the 768 column) + 24 (the `-view` twins).
    // R118 (D-786): + 16 for the `stars` page (360, 390, 1280, 1920) and + 4 for `stars-screen` (844).
    // R128 (FR-SKY-9, D-829): + 16 `live-window` and + 16 `guide-window` (360, 390, 1280, 1920), + 12 `stars-passes`
    // (360, 390, 1280), + 4 each for `live-window-follow` and `stars-zoom` (1280) and `stars-passes-screen` (844).
    // R135 (FR-FLOW-12): + 16 each for `home-up-now`, `home-no-pass` and `home-daylight` (360, 390, 1280, 1920),
    // + 8 `where-opened` (360, 390), and + 4 each for `guide` and `stars` at 844 × 390, the phone turned; − 8 for
    // `live-window` at 360 and 390, which since FR-FLOW-14 is `live-watching`'s picture there.
    // R145 (FR-TONIGHT-1): + 8 `live-tonight` (360, 390).
    // R149 (FR-FULL-9, D-937): + 4 `live-tonight` at 844, + 8 each for `live-sheet` and `live-sheet-list` (390, 844).
    expect(captureSet()).toHaveLength(414);
  });

  it('names every file by the one pattern, `-view` included (FR-CAP-1)', () => {
    for (const capture of captureSet()) expect(capture.file).toMatch(CAPTURE_FILE);
    expect(v1Files.filter((file) => !CAPTURE_FILE.test(file))).toEqual([]);
    expect(captureSet().filter((capture) => capture.view).every((capture) => capture.file.includes(`-${String(capture.width)}-view-`))).toBe(true);
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

/**
 * R108 (FR-DS-6; D-706, D-728): the dev page's captures, the `design` group.
 * Four files — the two widths by the two themes, no language — in a directory
 * of their own under `docs/screenshots/`, held to the set the same way the
 * `v1-` files are: every one named is on disk and non-empty, and nothing else
 * is there. `docs/DESIGN.md` links them, so a missing one is also a broken link.
 * Regenerate with `npm run design:captures`.
 */
describe('the design captures', () => {
  it('are the two widths by the two themes, named by the one pattern', () => {
    expect(designCaptureSet().map((capture) => capture.file)).toEqual(['design-primitives-390-dark.png', 'design-primitives-390-night.png', 'design-primitives-1280-dark.png', 'design-primitives-1280-night.png']);
    for (const capture of designCaptureSet()) expect(capture.file).toMatch(DESIGN_FILE);
    expect(designCaptureSet()).toHaveLength(THEMES.length * 2);
  });

  it('are every one on disk, none of them empty', () => {
    const present = new Set(designFiles);
    expect(designCaptureSet().filter((capture) => !present.has(capture.file)).map((capture) => capture.file)).toEqual([]);
    expect(designCaptureSet().filter((capture) => statSync(join(DESIGN_CAPTURE_DIR, capture.file)).size === 0)).toEqual([]);
  });

  it('and the directory carries nothing the group does not name', () => {
    const named = new Set(designCaptureSet().map((capture) => capture.file));
    expect(designFiles.filter((file) => !named.has(file))).toEqual([]);
  });
});
