/**
 * R178 (FR-SDD-22, PLAN D-1068): the capture manifest names every screen of the set, every glob in
 * it matches a tracked file, and `ci-affected.ts`'s matcher picks the screens a diff reaches.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { capturesReached, globToRegExp, screenGlobs, type CaptureManifest } from '../../scripts/ci-affected';
import { SCREENS } from '../e2e/captureSet';

const manifest = JSON.parse(readFileSync('scripts/captures/manifest.json', 'utf8')) as CaptureManifest;
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((path) => path !== '');
const edited = (...paths: string[]) => paths.map((path) => ({ path, deleted: false }));

describe('the capture manifest', () => {
  it('maps every screen of captureSet.ts, and nothing else', () => {
    expect(Object.keys(manifest.screens).sort()).toEqual(SCREENS.map((screen) => screen.name).sort());
    for (const screen of SCREENS) expect(screenGlobs(manifest, screen.name).length, screen.name).toBeGreaterThan(0);
  });

  it('has every screen name a route that exists', () => {
    for (const [name, screen] of Object.entries(manifest.screens)) expect(Object.keys(manifest.routes), name).toContain(screen.route);
  });

  it('covers every file a route imports, under src/, by its route list or `all`', () => {
    const entries: Record<string, string[]> = {
      home: ['src/ui/screens/Home.tsx'],
      settings: ['src/ui/screens/Settings.tsx', 'src/ui/screens/SettingsRoute.tsx'],
      detail: ['src/ui/screens/PassDetail.tsx'],
      live: ['src/ui/screens/Live.tsx', 'src/ui/screens/LiveRoute.ts'],
      stars: ['src/ui/screens/Stars.tsx', 'src/ui/screens/StarsRoute.ts'],
    };
    expect(Object.keys(entries).sort()).toEqual(Object.keys(manifest.routes).sort());
    const resolve = (from: string, spec: string): string | undefined => {
      const base = join(dirname(from), spec);
      return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((ext) => base + ext).find((path) => existsSync(path) && statSync(path).isFile());
    };
    // Static imports only: a lazy `import()` is another route's chunk, not this route's input.
    const reach = (entry: string[]): string[] => {
      const seen = new Set<string>();
      const visit = (file: string): void => {
        if (seen.has(file)) return;
        seen.add(file);
        if (!/\.tsx?$/.test(file)) return;
        for (const match of readFileSync(file, 'utf8').matchAll(/(?:\bfrom|\bimport)\s*'(\.[^']*)'/g)) {
          const next = resolve(file, match[1] ?? '');
          if (next !== undefined && next.startsWith('src/') && !/\.test\.tsx?$/.test(next)) visit(next);
        }
      };
      entry.forEach(visit);
      return [...seen];
    };
    const everything = manifest.all.map(globToRegExp);
    for (const [route, entry] of Object.entries(entries)) {
      const own = (manifest.routes[route] ?? []).map(globToRegExp);
      const missed = reach(entry).filter((file) => ![...everything, ...own].some((re) => re.test(file)));
      expect(missed, route).toEqual([]);
    }
  });

  it('has every glob match a tracked file', () => {
    const globs = new Set([...manifest.all, ...Object.values(manifest.routes).flat(), ...Object.values(manifest.screens).flatMap((screen) => screen.extras)]);
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

  it('escapes ? and reads ** inside {a,b}', () => {
    const literal = globToRegExp('x/{a?,b}.ts');
    expect(literal.test('x/ab.ts')).toBe(true); // `?` is one character here, as outside braces, not a quantifier
    expect(literal.test('x/a.ts')).toBe(false);
    expect(literal.test('x/a/.ts')).toBe(false);
    expect(globToRegExp('x/{a,b}?.ts').test('x/bc.ts')).toBe(true);
    const deep = globToRegExp('src/{a/**,b}.ts');
    expect(deep.test('src/a/x/y.ts')).toBe(true);
    expect(deep.test('src/b.ts')).toBe(true);
    expect(globToRegExp('{**/x,y}.ts').test('a/b/x.ts')).toBe(true);
    expect(globToRegExp('{a,b}/*.ts').test('a/b/c.ts')).toBe(false);
  });

  it('refuses an unclosed or nested brace', () => {
    expect(() => globToRegExp('a/{b,c')).toThrow();
    expect(() => globToRegExp('a/{b,{c}}')).toThrow();
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
