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

/** FR-SDD-14's ignored paths, as patterns over `rg --files` output. */
const IGNORED = [
  /(^|\/)dist\//,
  /(^|\/)node_modules\//,
  /^docs\/screenshots\//,
  /(^|\/)__snapshots__\//,
  /(^|\/)fixtures\//,
  /^public\/data\//,
  /^src\/data\/.*\.json$/,
  /^src\/data\/places\/places\.txt$/,
  /^data-src\//,
  /(^|\/)package-lock\.json$/,
  /\.lock$/,
];

const rg = spawnSync('rg', ['--version'], { encoding: 'utf8' });
const hasRg = rg.error === undefined && rg.status === 0;

describe('.ignore', () => {
  it('names every ignored class FR-SDD-14 lists', () => {
    const text = readFileSync(resolve(root, '.ignore'), 'utf8');
    for (const entry of ['dist/', 'node_modules/', 'docs/screenshots/', '**/__snapshots__/', 'fixtures/', 'public/data/', 'package-lock.json', '*.lock']) {
      expect(text.split('\n')).toContain(entry);
    }
  });

  // rg is on the CI image and on the owner's Mac, not guaranteed everywhere: skip, don't fail.
  it.skipIf(!hasRg)('leaves `rg --files` from the root with none of the ignored paths and with the sources', () => {
    const out = spawnSync('rg', ['--files'], { cwd: root, encoding: 'utf8', maxBuffer: 1e8 });
    expect(out.status).toBe(0);
    const files = out.stdout.split('\n').filter(Boolean).map((f) => f.replace(/^\.\//, ''));
    expect(files.filter((f) => IGNORED.some((re) => re.test(f)))).toEqual([]);
    expect(files).toContain('src/main.tsx');
    expect(files).toContain('docs/sdd/map.md');
    expect(files).toContain('src/data/stars/catalog.ts');
  });
});

describe('docs/sdd/gotchas.md', () => {
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
