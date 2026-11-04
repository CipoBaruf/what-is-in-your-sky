/**
 * FR-SDD-14: a search from the root never lists a fixture, a capture, a
 * snapshot, a built file or a catalogue; FR-SDD-12: `docs/sdd/gotchas.md` has
 * its seven sections and no personal preference.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

/** FR-SDD-14's ignored classes, as patterns over tracked paths. */
const IGNORED: Record<string, RegExp> = {
  dist: /(^|\/)dist\//,
  node_modules: /(^|\/)node_modules\//,
  screenshots: /^docs\/screenshots\//,
  snapshots: /(^|\/)__snapshots__\//,
  fixtures: /(^|\/)fixtures\//,
  'public/data': /^public\/data\//,
  'catalogue json': /^src\/data\/.*\.json$/,
  'places catalogue': /^src\/data\/places\/places\.txt$/,
  'data-src': /^data-src\//,
  'package-lock': /(^|\/)package-lock\.json$/,
  lockfiles: /\.lock$/,
};

/** Tracked files, through git's gitignore matcher with `.ignore` as the exclude list. */
function lsFiles(...args: string[]): string[] {
  const out = spawnSync('git', ['ls-files', '-z', '--cached', '--exclude-from=.ignore', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1e8,
  });
  expect(out.status, out.stderr).toBe(0);
  return out.stdout.split('\0').filter(Boolean);
}

describe('.ignore', () => {
  it('names every ignored class FR-SDD-14 lists', () => {
    const text = readFileSync(resolve(root, '.ignore'), 'utf8');
    for (const entry of ['dist/', 'node_modules/', 'docs/screenshots/', '**/__snapshots__/', 'fixtures/', 'public/data/', 'src/data/**/*.json', 'src/data/places/places.txt', 'data-src/', 'package-lock.json', '*.lock']) {
      expect(text.split('\n')).toContain(entry);
    }
  });

  // `.ignore` is gitignore syntax, so git's own matcher decides what a search
  // (ripgrep, the Grep tool) would hide; no rg needed, so this always runs.
  it('hides a tracked example of every ignored class, and leaves none of them searchable', () => {
    const tracked = lsFiles();
    const ignored = new Set(lsFiles('--ignored'));
    const searchable = tracked.filter((f) => !ignored.has(f));
    for (const [name, re] of Object.entries(IGNORED)) {
      const examples = tracked.filter((f) => re.test(f));
      if (examples.length === 0) continue; // nothing of this class is tracked (dist/, node_modules/, public/data/)
      expect(examples.filter((f) => !ignored.has(f)), `${name} files left searchable`).toEqual([]);
    }
    expect(searchable.filter((f) => Object.values(IGNORED).some((re) => re.test(f)))).toEqual([]);
    // the classes that do have tracked files are really matched as ignored
    for (const name of ['screenshots', 'snapshots', 'fixtures', 'catalogue json', 'places catalogue', 'data-src', 'package-lock']) {
      const re = IGNORED[name];
      expect(re && [...ignored].some((f) => re.test(f)), `${name}: no tracked example ignored`).toBe(true);
    }
    expect(searchable).toContain('src/main.tsx');
    expect(searchable).toContain('docs/sdd/map.md');
    expect(searchable).toContain('src/data/stars/catalog.ts');
  });
});

describe('FR-SDD-12: docs/sdd/gotchas.md', () => {
  const text = readFileSync(resolve(root, 'docs/sdd/gotchas.md'), 'utf8');
  const headings = text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());

  it('has one section for each of the seven subjects', () => {
    expect(headings).toEqual([
      'e2e and sandbox',
      'captures',
      'the driver',
      'the npm cache',
      'GitHub merging',
      'glyphcss',
      'the dome-perf method',
    ]);
  });

  it('keeps personal preferences out', () => {
    for (const personal of [/Co-Authored-By/i, /AskUserQuestion/, /LinkedIn/i, /promo voice/i, /domain shortlist/i, /inyoursky\.app/]) {
      expect(text).not.toMatch(personal);
    }
  });
});
