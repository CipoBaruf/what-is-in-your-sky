/**
 * FR-SDD-14: `scripts/sdd-map.ts` builds one map line per source file from a
 * fixture tree, and `--check` fails when the file on disk is stale.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportNames, firstSentence, MAP_PATH, mapLine, renderMap, run } from '../../scripts/sdd-map';

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'sdd-map-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const FIXTURE = {
  'src/a.ts': '/**\n * Parses the thing. Second sentence is left out.\n */\nexport const parse = 1;\nexport function load() {}\nexport type Shape = {};\n',
  'src/b/c.tsx': '// Line-comment header that runs\n// over two lines. Not this.\nexport default function C() {}\n',
  'src/b/c.test.ts': '/** a test */\nexport const t = 1;\n',
  'src/types.d.ts': 'export type X = 1;\n',
  'src/ui/__snapshots__/s.ts': 'export const s = 1;\n',
  'scripts/tool.ts': 'export { alpha, type Beta, gamma as delta };\n',
  'docs/ignored.ts': 'export const nope = 1;\n',
};

describe('firstSentence', () => {
  it('takes the first sentence of the first doc comment', () => {
    expect(firstSentence('/**\n * One.\n * Two.\n */\nx')).toBe('One.');
  });
  it('joins a wrapped sentence and keeps colons inside it', () => {
    expect(firstSentence('/**\n * Run `a.ts:` it\n * works. Rest.\n */')).toBe('Run `a.ts:` it works.');
  });
  it('falls back to a leading line-comment block', () => {
    expect(firstSentence('// Hello\n// world. More.\nconst a = 1;')).toBe('Hello world.');
  });
  it('is empty for a file with no comment, and truncates a very long sentence', () => {
    expect(firstSentence('const a = 1;\n')).toBe('');
    expect(firstSentence(`/** ${'word '.repeat(80)} */`).length).toBeLessThanOrEqual(140);
  });
});

describe('exportNames', () => {
  it('reads declarations, export lists with renames and a default', () => {
    expect(exportNames('export const a = 1;\nexport async function b() {}\nexport interface C {}\nexport { d, type E, f as g };\nexport default 1;\n')).toEqual([
      'a',
      'b',
      'C',
      'd',
      'E',
      'g',
      'default',
    ]);
  });
  it('does not read an indented export in a string or comment', () => {
    expect(exportNames('const s = `\n  export const nope = 1;\n`;\n')).toEqual([]);
  });
});

describe('mapLine', () => {
  it('shows path, sentence and exports, and counts the rest past eight', () => {
    const names = Array.from({ length: 10 }, (_, i) => `export const n${i} = ${i};`).join('\n');
    const line = mapLine('src/x.ts', `/** Does x. */\n${names}\n`);
    expect(line).toBe('- `src/x.ts` — Does x. — exports: n0, n1, n2, n3, n4, n5, n6, n7, +2');
  });
});

describe('renderMap', () => {
  it('lists src and scripts sources only, sorted, without tests, d.ts or snapshots', () => {
    const out = renderMap(tree(FIXTURE));
    const lines = out.split('\n').filter((l) => l.startsWith('- '));
    expect(lines).toEqual([
      '- `scripts/tool.ts` — exports: alpha, Beta, delta',
      '- `src/a.ts` — Parses the thing. — exports: parse, load, Shape',
      '- `src/b/c.tsx` — Line-comment header that runs over two lines. — exports: default',
    ]);
  });
});

describe('run', () => {
  it('writes the map, then --check passes; an edited source makes --check fail', () => {
    const root = tree(FIXTURE);
    const log: string[] = [];
    expect(run(root, true, (m) => log.push(m))).toBe(1); // no map yet
    expect(run(root, false, (m) => log.push(m))).toBe(0);
    expect(readFileSync(join(root, MAP_PATH), 'utf8')).toContain('`src/a.ts`');
    expect(run(root, true, (m) => log.push(m))).toBe(0);
    writeFileSync(join(root, 'src/a.ts'), '/** Changed. */\nexport const parse = 1;\n');
    log.length = 0;
    expect(run(root, true, (m) => log.push(m))).toBe(1);
    expect(log[0]).toContain('stale');
  });
});

describe('the committed map', () => {
  it('equals what the sources generate now (the check R179 wires into check:sdd)', () => {
    const root = resolve(__dirname, '../..');
    expect(run(root, true, () => undefined)).toBe(0);
  });
});
