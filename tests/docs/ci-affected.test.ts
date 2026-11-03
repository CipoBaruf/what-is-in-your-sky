/**
 * PLAN D-1031 (FR-CI-1 as amended 2026-11-02): a pull request runs the tests its change reaches.
 * `select` is the rule; these are the diffs it was written for.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CODE_READERS, parseNameStatus, readerTests, select, type Change } from '../../scripts/ci-affected';

const DOC_READERS = ['tests/docs/public.test.ts', 'tests/sdd/tasks.test.ts'];
const READERS = [...DOC_READERS, 'src/ui/screens/Live.test.tsx', 'tests/styles/tokens.test.ts'];
const edited = (...paths: string[]): Change[] => paths.map((path) => ({ path, deleted: false }));

describe('ci-affected (D-1031)', () => {
  it('a docs-only change runs the tests that read the docs by path, and no e2e spec', () => {
    const selection = select(edited('SPEC.md', 'PLAN.md', 'docs/RELEASE.md', 'docs/screenshots/v1-home.png'), READERS);
    expect(selection.e2e).toEqual([]);
    // The docs go to `vitest related` as well; nothing imports them, so only the doc readers run.
    expect(selection.unit).toEqual(['PLAN.md', 'SPEC.md', 'docs/RELEASE.md', 'docs/screenshots/v1-home.png', ...DOC_READERS].sort());
  });

  it('a src/lib change runs what imports it and every e2e spec, since the build reads it', () => {
    const selection = select(edited('src/lib/compass.ts'), READERS);
    expect(selection.unit).toEqual(['src/lib/compass.ts', ...READERS].sort());
    expect(selection.e2e).toBe('all');
    expect(selection.reason).toContain('src/lib/compass.ts');
  });

  it('a src/ui change (a component and its CSS module) does the same', () => {
    const selection = select(edited('src/ui/screens/home/HomeDoors.tsx', 'src/ui/screens/home/HomeDoors.module.css'), READERS);
    expect(selection.unit).toEqual(expect.arrayContaining(['src/ui/screens/home/HomeDoors.tsx', 'src/ui/screens/home/HomeDoors.module.css']));
    expect(selection.e2e).toBe('all');
  });

  it.each(['package.json', 'package-lock.json', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'tsconfig.app.json', 'eslint.config.js', 'knip.json', '.github/workflows/ci.yml', 'public/_headers', 'tests/setup/msw.ts', 'tests/support/fixtures.ts', 'tests/fixtures/heavens-above/iss.json'])('a change to %s runs everything', (path) => {
    expect(select(edited('src/lib/compass.ts', path), READERS)).toMatchObject({ unit: 'all', e2e: 'all' });
  });

  it('a unit-test-only change runs that test, and no e2e spec: the build does not read tests', () => {
    const selection = select(edited('src/lib/compass.test.ts'), READERS);
    expect(selection.unit).toEqual(['src/lib/compass.test.ts', ...READERS].sort());
    expect(selection.e2e).toEqual([]);
  });

  it('an e2e-spec-only change runs that spec and no unit test beyond the readers', () => {
    const selection = select(edited('tests/e2e/home.spec.ts'), READERS);
    expect(selection.e2e).toEqual(['tests/e2e/home.spec.ts']);
    expect(selection.unit).toEqual([...READERS].sort());
  });

  it('an e2e helper runs every spec, and the unit tests that import it', () => {
    const selection = select(edited('tests/e2e/liveHelpers.ts'), READERS);
    expect(selection.e2e).toBe('all');
    expect(selection.unit).toContain('tests/e2e/liveHelpers.ts');
  });

  it('a deleted file is not handed on: its importers are in the diff, and a deleted test has nothing to run', () => {
    const selection = select(
      [
        { path: 'src/lib/old.test.ts', deleted: true },
        { path: 'tests/e2e/old.spec.ts', deleted: true },
      ],
      READERS,
    );
    expect(selection.unit).toEqual([...READERS].sort());
    expect(selection.e2e).toEqual([]);
  });

  it('a deleted source file still runs every spec', () => {
    expect(select([{ path: 'src/lib/old.ts', deleted: true }], READERS).e2e).toBe('all');
  });

  it('a snapshot hands over the test file it belongs to', () => {
    expect(select(edited('src/i18n/__snapshots__/messages.test.ts.snap'), []).unit).toEqual(['src/i18n/messages.test.ts']);
  });

  it('a path with whitespace in it is not guessed at', () => {
    expect(select(edited('docs/a note.md'), READERS)).toMatchObject({ unit: 'all', e2e: 'all' });
  });

  it('no change runs nothing', () => {
    expect(select([], READERS)).toMatchObject({ unit: [], e2e: [] });
  });
});

describe('the readers (D-1031)', () => {
  const readers = readerTests('.');

  it('finds the tests that read by path, themselves or through a local helper', () => {
    expect(readers).toEqual(expect.arrayContaining(['tests/docs/ci.test.ts', 'tests/sdd/tasks.test.ts', 'src/data/zod.test.ts']));
    // `literals.test.ts` reads the stylesheets through `tests/styles/literals.ts`.
    expect(readers).toContain('tests/styles/literals.test.ts');
    // The worker integration test boots the worker by URL, which no import shows.
    expect(readers).toContain('src/worker/worker.integration.test.ts');
    expect(readers).not.toContain('src/lib/compass.test.ts');
  });

  it('a code reader names no doc, so a docs-only change can leave it out', () => {
    const docPath = /['`](?:[^'`\n]*\/)?(?:[^'`\n/]*\.md|docs\/[^'`\n]*|\.claude\/[^'`\n]*|LICENSE)['`]/;
    for (const reader of readers.filter((path) => CODE_READERS.test(path))) expect(readFileSync(reader, 'utf8'), reader).not.toMatch(docPath);
  });
});

describe('parseNameStatus', () => {
  it('splits a rename into the old path deleted and the new path added', () => {
    expect(parseNameStatus('M\tSPEC.md\nD\tsrc/lib/gone.ts\nR087\tsrc/lib/a.ts\tsrc/lib/b.ts\nA\tsrc/lib/c.ts\n')).toEqual([
      { path: 'SPEC.md', deleted: false },
      { path: 'src/lib/gone.ts', deleted: true },
      { path: 'src/lib/a.ts', deleted: true },
      { path: 'src/lib/b.ts', deleted: false },
      { path: 'src/lib/c.ts', deleted: false },
    ]);
  });
});
