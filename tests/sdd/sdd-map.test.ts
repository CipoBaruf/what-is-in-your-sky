/**
 * FR-SDD-14: `scripts/sdd-map.ts` builds one map line per source file from a
 * fixture tree (a git repository, so the production path runs), and `--check`
 * fails when the file on disk is stale.
 */
import { execFileSync } from 'node:child_process';
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
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '--', ...Object.keys(files).filter((f) => !f.startsWith('untracked/') && f !== 'src/scratch.ts')], { cwd: root });
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
  'src/scratch.ts': '/** Untracked, never in the map. */\nexport const scratch = 1;\n',
  'src/barrel.ts': "export * from './a';\nexport * as b from \"./b/c\";\n",
  'src/ünï.ts': '#!/usr/bin/env node\n// eslint line\n/** Non-ASCII path, e.g. a name. Not this. */\nexport const u = 1;\n',
};

describe('firstSentence', () => {
  it('takes the first sentence of the first doc comment', () => {
    expect(firstSentence('/**\n * One.\n * Two.\n */\nx')).toBe('One.');
  });
  it('joins a wrapped sentence and keeps colons inside it', () => {
    expect(firstSentence('/**\n * Run `a.ts:` it\n * works. Rest.\n */')).toBe('Run `a.ts:` it works.');
  });
  it('takes only a leading doc comment, past a shebang and // lines', () => {
    expect(firstSentence('#!/usr/bin/env node\n// a\n/* plain */\n/** Lead. */\nx')).toBe('Lead.');
    expect(firstSentence('// Hello\n// world. More.\nconst a = 1;')).toBe('');
    expect(firstSentence('import x from "y";\n/** A function\'s JSDoc. */\nexport function f() {}')).toBe('');
    expect(firstSentence("const g = 'src/**/*.ts';\n/** Later. */")).toBe('');
  });
  it('does not end a sentence at e.g., i.e., vs., etc. or No.', () => {
    expect(firstSentence('/** Uses e.g. this, i.e. that, a vs. b, x etc. and No. 5 here. Not this. */')).toBe(
      'Uses e.g. this, i.e. that, a vs. b, x etc. and No. 5 here.',
    );
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
  it('lists export * and export * as ns', () => {
    expect(exportNames("export * from './x';\nexport * as ns from \"./y\";\n")).toEqual(["* from './x'", '* as ns from "./y"']);
  });
  it('does not read an indented export in a string or comment', () => {
    expect(exportNames('const s = `\n  export const nope = 1;\n`;\n')).toEqual([]);
  });
});

describe('mapLine', () => {
  it('shows path, sentence and exports, and counts the rest past eight', () => {
    const names = Array.from({ length: 10 }, (_, i) => `export const n${i} = ${i};`).join('\n');
    const line = mapLine('src/x.ts', `/** Does x. */\n${names}\n`);
    expect(line).toBe('- `src/x.ts` — exports: n0, n1, n2, n3, n4, n5, n6, n7, +2 — Does x.');
  });
  it('always has the exports field, and a description with " — " stays whole after the second separator', () => {
    const line = mapLine('src/y.ts', '/** Path — `NW → SE`. */\nconst y = 1;\n');
    expect(line).toBe('- `src/y.ts` — exports: none — Path — `NW → SE`.');
    const [path, exports, ...rest] = line.split(' — ');
    expect([path, exports, rest.join(' — ')]).toEqual(['- `src/y.ts`', 'exports: none', 'Path — `NW → SE`.']);
    expect(mapLine('src/z.ts', 'const z = 1;\n')).toBe('- `src/z.ts` — exports: none');
  });
});

describe('renderMap', () => {
  it('lists tracked src and scripts sources only, sorted, without tests, d.ts, snapshots or untracked files', () => {
    const out = renderMap(tree(FIXTURE));
    const lines = out.split('\n').filter((l) => l.startsWith('- '));
    expect(lines).toEqual([
      '- `scripts/tool.ts` — exports: alpha, Beta, delta',
      '- `src/a.ts` — exports: parse, load, Shape — Parses the thing.',
      '- `src/b/c.tsx` — exports: default',
      `- \`src/barrel.ts\` — exports: * from './a', * as b from "./b/c"`,
      '- `src/ünï.ts` — exports: u — Non-ASCII path, e.g. a name.',
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
    const map = join(root, MAP_PATH);
    writeFileSync(map, readFileSync(map, 'utf8').replace(/\n/g, '\r\n'));
    expect(run(root, true, (m) => log.push(m))).toBe(0); // a CRLF checkout is not stale
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
