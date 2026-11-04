/**
 * FR-SDD-3..5 (D-1059, D-1060): the split is lossless, moves the Decision Log row for row and
 * fails on a heading its map lacks. The input is the parent's three documents, pinned in
 * `scripts/sdd/__fixtures__/parent/` by R175's first commit.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collapse, unwrap } from '../../scripts/sdd/rewrap';
import { cut, outputLines, pathFor, split, storyPhase } from '../../scripts/sdd/split';
import { DOCS, SPLIT_MAP, type Doc } from '../../scripts/sdd/splitMap';

const parent = (doc: Doc): string => readFileSync(`scripts/sdd/__fixtures__/parent/${doc}.md`, 'utf8');
const sources = { SPEC: parent('SPEC'), PLAN: parent('PLAN'), TASKS: parent('TASKS') };
const { pieces, files } = split(sources);

describe('FR-SDD-3: the lossless test', () => {
  it('cuts each document into pieces that put together are the document', () => {
    for (const doc of DOCS) {
      const joined = pieces
        .filter((piece) => piece.doc === doc)
        .map((piece) => piece.lines.join('\n'))
        .join('\n');
      expect(joined === sources[doc], `${doc}'s pieces are not the document`).toBe(true);
    }
  });

  it('puts every piece in its file, whitespace the only change, and every input line in the output once', () => {
    // Each file holds its pieces in input order, one after another and never overlapping; what
    // lies between them is the split's own (a phase file's title, an index file's map).
    const cursor = new Map<string, number>();
    let total = 0;
    for (const piece of pieces) {
      const lines = outputLines(piece);
      expect(collapse(lines.join('\n'))).toBe(collapse(piece.lines.join('\n')));
      const path = pathFor(piece.doc, piece.to);
      const text = files.get(path) ?? '';
      const body = lines.join('\n').replace(/\n+$/, '');
      const at = text.indexOf(body, cursor.get(path) ?? 0);
      expect(at, `${piece.doc}.md:${String(piece.start)} is not in ${path} after the piece before it`).toBeGreaterThanOrEqual(0);
      cursor.set(path, at + body.length);
      total += collapse(body).length;
    }
    expect(total).toBe(DOCS.reduce((sum, doc) => sum + collapse(sources[doc]).length, 0));
  });

  it('moves closed TASKS sections byte for byte, checkboxes included', () => {
    for (const piece of pieces.filter((candidate) => candidate.doc === 'TASKS')) expect(outputLines(piece)).toEqual(piece.lines);
    expect(files.get('docs/sdd/phases/v2.12/tasks.md')).toContain('- [x] **R171 —');
  });

  it('rewraps only where the brief can read the old text back (FR-SDD-7)', () => {
    for (const piece of pieces.filter((candidate) => candidate.doc !== 'TASKS')) expect(unwrap(outputLines(piece))).toEqual(unwrap(piece.lines));
  });

  it('leaves TASKS.md the v2.13 block and the status table', () => {
    const tasks = files.get('TASKS.md') ?? '';
    expect(tasks.match(/^## .*$/gm)).toEqual(['## Status', '## v2.13 tasks']);
    expect(tasks).toContain('| v2.12 | R167–R171 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.12/tasks.md) |');
    expect(files.get('docs/sdd/archive.json')).toBe('{}\n');
  });
});

describe('FR-SDD-5: the Decision Log moves whole', () => {
  it('equals SPEC §12 at the parent, row for row', () => {
    const start = sources.SPEC.indexOf('\n## 12. Decision Log');
    const end = sources.SPEC.indexOf('\n## Revision history');
    const section = sources.SPEC.slice(start + 1, end);
    const decisions = files.get('docs/sdd/decisions.md') ?? '';
    const rows = (text: string): string[] => text.split('\n').filter((line) => line.startsWith('|'));
    expect(rows(decisions)).toEqual(rows(section));
    expect(rows(decisions).length).toBeGreaterThan(290);
    expect(collapse(decisions)).toBe(collapse(section));
  });
});

describe('D-1059: the heading map', () => {
  it('fails on a heading the map does not list', () => {
    expect(() => cut('SPEC', `${sources.SPEC}\n## 13. Something new\n`)).toThrow(/"## 13. Something new" is not in the split map/);
    expect(() => cut('PLAN', sources.PLAN.replace('### 16.4 `scripts/sdd-run.ts`', '### 16.4 The driver'))).toThrow(/not in the split map/);
  });

  it('fails on a map entry the document does not have', () => {
    const map = { ...SPLIT_MAP.SPEC, sections: [...SPLIT_MAP.SPEC.sections, { h: '13. Gone', to: 'mvp' }] };
    expect(() => cut('SPEC', sources.SPEC, map)).toThrow(/names "## 13. Gone"/);
  });

  it('sends a story to the phase its tag names', () => {
    expect(storyPhase('**US-51 — Any agent, a fraction of the reading** *(v2.13)*')).toBe('v2.13');
    expect(storyPhase('**US-1 — Provide my location by place name**')).toBe('mvp');
    expect(storyPhase('**US-8 — Remember my last location** *(MVP, minimal)*')).toBe('mvp');
    expect(storyPhase('**US-21 — Point my phone at the sky** *(v1.1; the home of US-10 on a phone)*')).toBe('v1.1');
    expect(files.get('docs/sdd/phases/v2.13/spec.md')).toContain('**US-51 — Any agent');
  });

  it('keeps the index files to the summary, the fixed inputs and the maps', () => {
    expect(files.get('SPEC.md')).toContain('## 1. Summary');
    expect(files.get('SPEC.md')).toContain('### 2.20 Goals (v2.13, "the workflow")');
    expect(files.get('PLAN.md')).toContain('## 1. Fixed Inputs');
    expect(files.get('PLAN.md')).toContain('## 3. Architecture Overview');
    for (const doc of ['SPEC.md', 'PLAN.md']) expect(files.get(doc)).toContain('| v2.13 | [spec](docs/sdd/phases/v2.13/spec.md) | [plan](docs/sdd/phases/v2.13/plan.md) | [TASKS.md](TASKS.md) |');
  });
});
