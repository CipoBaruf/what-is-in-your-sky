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
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPTURE_DIR, CAPTURE_FILE, captureSet, LOCALES, SCREENS, THEMES } from '../e2e/captureSet';

const files = new Set(readdirSync(CAPTURE_DIR));
const v1Files = [...files].filter((file) => file.startsWith('v1-')).sort();

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
     */
    const UPRIGHT = new Set(['sky-screen-portrait', 'sky-screen-turned']);
    for (const screen of SCREENS) {
      if (screen.name.startsWith('sky-screen-') || screen.name === 'window') {
        expect(screen.widths, screen.name).toEqual(UPRIGHT.has(screen.name) ? [360, 390] : [844]);
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
    expect(captureSet()).toHaveLength(254);
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
