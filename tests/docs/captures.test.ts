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
import { CAPTURE_DIR, captureSet, SCREENS } from '../e2e/captureSet';

const files = new Set(readdirSync(CAPTURE_DIR));
const v1Files = [...files].filter((file) => file.startsWith('v1-')).sort();

describe('the v1 capture set', () => {
  it('names every screen at both widths, in both themes and both languages', () => {
    expect(captureSet()).toHaveLength(SCREENS.reduce((total, screen) => total + screen.widths.length * 4, 0));
    // Every screen is on the phone and on the wide layout; nothing is desktop-only or phone-only.
    for (const screen of SCREENS) {
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
