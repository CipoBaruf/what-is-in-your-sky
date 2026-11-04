/**
 * R178 (FR-SDD-22, PLAN D-1068): the capture manifest names every screen of the set, every glob in
 * it matches a tracked file, and `ci-affected.ts`'s matcher picks the screens a diff reaches.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { capturesReached, globToRegExp, type CaptureManifest } from '../../scripts/ci-affected';
import { SCREENS } from '../e2e/captureSet';

const manifest = JSON.parse(readFileSync('scripts/captures/manifest.json', 'utf8')) as CaptureManifest;
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((path) => path !== '');
const edited = (...paths: string[]) => paths.map((path) => ({ path, deleted: false }));

describe('the capture manifest', () => {
  it('maps every screen of captureSet.ts, and nothing else', () => {
    expect(Object.keys(manifest.screens).sort()).toEqual(SCREENS.map((screen) => screen.name).sort());
    for (const screen of SCREENS) expect(manifest.screens[screen.name]?.length, screen.name).toBeGreaterThan(0);
  });

  it('has every glob match a tracked file', () => {
    const globs = new Set([...manifest.all, ...Object.values(manifest.screens).flat()]);
    const unmatched = [...globs].filter((glob) => !tracked.some((path) => globToRegExp(glob).test(path)));
    expect(unmatched).toEqual([]);
  });
});

describe('globToRegExp', () => {
  it('reads **, *, ? and {a,b}', () => {
    expect(globToRegExp('src/ui/styles/**').test('src/ui/styles/tokens/colour.css')).toBe(true);
    expect(globToRegExp('src/ui/*.{ts,tsx,css}').test('src/ui/App.tsx')).toBe(true);
    expect(globToRegExp('src/ui/*.{ts,tsx,css}').test('src/ui/screens/Home.tsx')).toBe(false);
    expect(globToRegExp('src/**/x.ts').test('src/x.ts')).toBe(true);
    expect(globToRegExp('src/**/x.ts').test('src/a/b/x.ts')).toBe(true);
    expect(globToRegExp('tests/e2e/{captureSet,observers}.ts').test('tests/e2e/observers.ts')).toBe(true);
    expect(globToRegExp('a?.md').test('ab.md')).toBe(true);
    expect(globToRegExp('a.md').test('aXmd')).toBe(false);
  });
});

describe('capturesReached', () => {
  it('re-shoots every screen when a change is under `all`', () => {
    expect(capturesReached(edited('src/i18n/en/ui.ts'), manifest)).toBe('all');
    expect(capturesReached(edited('tests/e2e/v1-captures.spec.ts'), manifest)).toBe('all');
  });

  it('re-shoots only the screens a screen-level change reaches', () => {
    const reached = capturesReached(edited('src/ui/screens/Settings.tsx'), manifest);
    expect(reached).toEqual(['favourites', 'settings']);
    const globe = capturesReached(edited('src/ui/screens/stars/GlobeRail.tsx'), manifest);
    expect(globe).toContain('stars-globe');
    expect(globe).not.toContain('home');
  });

  it('re-shoots nothing for docs, a unit test or a snapshot', () => {
    expect(capturesReached(edited('SPEC.md', 'docs/RELEASE.md', 'src/ui/screens/Settings.test.tsx', 'src/ui/components/mark/__snapshots__/Mark.test.tsx.snap'), manifest)).toEqual([]);
  });

  it('counts a deleted file as a change to the screens that drew it', () => {
    expect(capturesReached([{ path: 'src/ui/screens/home/HomeDoors.tsx', deleted: true }], manifest)).toContain('home-up-now');
  });
});
