/**
 * FR-FLAG-1/FR-FLAG-2, D-183: a real production build with the flag off (the
 * default: `VITE_MOON_LORE` unset) proves the lore data never reaches a
 * chunk — not merely that the app declines to fetch it. "Wolf Moon" is
 * January's folk name (`lore.json`); it names nothing else in `src` (the
 * shared zod schema in `data/moon/schema.ts` that also serves `MOON_PHASES`,
 * an enum `passesCache.ts` needs regardless of the flag, carries field names
 * like `startLonDeg` but none of the hand-reviewed text FR-FLAG-1 is about).
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const OUT_DIR = 'tests/build/.tmp-flags-off';
const LORE_KEY = 'Wolf Moon';

describe('the default build (FR-FLAG-1)', () => {
  afterAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true });
  });

  it('prints the flag as off and ships the lore data in no chunk', () => {
    const env = { ...process.env };
    delete env['VITE_MOON_LORE']; // the default: unset, not merely falsy
    const log = execFileSync('npx', ['vite', 'build', '--outDir', OUT_DIR, '--emptyOutDir'], { cwd: process.cwd(), env, encoding: 'utf8' });
    expect(log).toContain('VITE_MOON_LORE=off');

    const assetsDir = join(OUT_DIR, 'assets');
    const files = readdirSync(assetsDir).filter((file) => file.endsWith('.js') || file.endsWith('.css'));
    expect(files.some((file) => file.startsWith('MoonLore'))).toBe(false);
    for (const file of files) expect(readFileSync(join(assetsDir, file), 'utf8'), file).not.toContain(LORE_KEY);
  }, 60_000);
});

/**
 * F-64 (R67): the e2e specs read the flag's "on" state, and the build they run
 * against is made twice — by `npm run e2e` locally and by ci.yml's build stage.
 * When only one of the two sets the flag, `moon.spec.ts` passes in CI and fails
 * on the owner's machine, which is exactly what F-64 was. Neither side can be
 * read from the other, so this test holds them together.
 */
describe('the e2e build carries the flag on both sides (F-64)', () => {
  const flagOn = /VITE_MOON_LORE[=:]\s*'?on'?/;

  it('is set by the `e2e` npm script', () => {
    const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
    const e2e = scripts['e2e'] ?? '';
    expect(e2e).toContain('vite build');
    expect(e2e).toMatch(flagOn);
  });

  it('is set by the build stage the CI e2e stage previews', () => {
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).toMatch(flagOn);
  });
});
