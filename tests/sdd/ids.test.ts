/**
 * FR-SDD-6 (D-1061): ids.md resolves every id to its file and heading, `sdd:id` prints one of
 * each kind, and the committed file is what the layout generates.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectIds, extract, generateIds, IDS_PATH, kindOf, originOf, parseIds, printId, renderIds, slug } from '../../scripts/sdd/ids';
import { rewrapBlocks, unwrapBlocks } from '../../scripts/sdd/rewrap';

const committed = readFileSync(IDS_PATH, 'utf8');
const index = parseIds(committed);

describe('FR-SDD-6: ids.md', () => {
  it('is what the layout generates (the staleness check)', () => {
    expect(committed === generateIds('.'), `${IDS_PATH} is stale: run \`npx tsx scripts/sdd/ids.ts --write\``).toBe(true);
  });

  it('gives each id its file, anchor and heading, and each old section its file', () => {
    expect(index.get('V212-13')).toEqual({ key: 'V212-13', path: 'docs/sdd/decisions.md', anchor: '12-decision-log', heading: '12. Decision Log' });
    expect(index.get('FR-SDD-6')?.path).toBe('docs/sdd/phases/v2.13/spec.md');
    expect(index.get('D-89')?.path).toBe('docs/sdd/phases/v1/plan.md');
    expect(index.get('R171')?.path).toBe('docs/sdd/phases/v2.12/tasks.md');
    expect(index.get('R175')?.path).toBe('docs/sdd/phases/v2.13/tasks.md');
    expect(index.get('R182')?.path).toBe('TASKS.md');
    expect(index.get('SPEC §4.47')?.path).toBe('docs/sdd/phases/v2.5/spec.md');
    expect(index.get('PLAN §16.4')).toMatchObject({ path: 'docs/sdd/reference/delivery.md', anchor: '164-scriptssdd-runts' });
    expect(index.get('SPEC §1')?.path).toBe('SPEC.md');
  });

  it('lists an archived path with its location', () => {
    const text = renderIds({ ids: [], sections: [], archived: [['spike/', 'archive:spike/']] });
    expect(text).toContain('spike/\tarchive:spike/');
    expect(parseIds(text).get('spike/')?.path).toBe('archive:spike/');
  });

  it('takes the first definition and only from the document the kind lives in', () => {
    const files = new Map([
      ['docs/sdd/phases/v1/plan.md', '# x\n\n| F-1 | a plan row |\n- **D-1 — A decision.**\n'],
      ['docs/sdd/phases/v1/spec.md', '## 4.1 Here\n\n| F-1 | the finding |\n- **FR-A-1** One.\n- **FR-A-1** Again.\n'],
    ]);
    const { ids, sections } = collectIds(files);
    expect(ids.map((entry) => `${entry.key} ${entry.path}`)).toEqual(['D-1 docs/sdd/phases/v1/plan.md', 'F-1 docs/sdd/phases/v1/spec.md', 'FR-A-1 docs/sdd/phases/v1/spec.md']);
    expect(sections).toEqual([{ key: 'SPEC §4.1', path: 'docs/sdd/phases/v1/spec.md', anchor: '41-here', heading: '4.1 Here' }]);
  });

  it('knows each kind and each file’s origin', () => {
    expect(['FR-SDD-6', 'G1', 'US-51', 'F-53', 'OQ-10', 'V212-13', 'D-1059', 'R171', 'H'].map((id) => kindOf(id)?.name)).toEqual(['FR', 'G', 'US', 'row', 'row', 'row', 'D', 'task', 'task']);
    expect(originOf('docs/sdd/reference/glossary.md')).toEqual(['SPEC']);
    expect(originOf('docs/sdd/reference/revision-history.md')).toEqual(['SPEC', 'PLAN']);
    expect(originOf('docs/sdd/reference/breakdown-inputs.md')).toEqual(['TASKS']);
    expect(slug('16.4 `scripts/sdd-run.ts`')).toBe('164-scriptssdd-runts');
  });
});

describe('FR-SDD-6: review fixes', () => {
  it('prints an id with a lower-case suffix, and matches case-insensitively against the stored key', () => {
    expect(printId('.', 'FR-GUIDE-2b')).toMatch(/^FR-GUIDE-2b — /);
    expect(printId('.', 'fr-guide-2b')).toMatch(/^FR-GUIDE-2b — /);
  });

  it('gives back a block rewrapBlocks left alone exactly as it is', () => {
    // Unwrapping this block would join its two lines and not give it back, so rewrapBlocks left it.
    const left = ['Line one. Second.', 'Next line. Plus more.'];
    expect(rewrapBlocks(left)).toEqual(left);
    expect(unwrapBlocks(left)).toEqual(left);
    expect(unwrapBlocks(rewrapBlocks(['One. Two. Three.']))).toEqual(['One. Two. Three.']);
  });

  it('closes a fence only on the same marker and at least its length, and slugs as GitHub does', () => {
    const text = ['````', '```', '## not a heading', '````', '## Real [link](http://x.y) `code`', '- **D-1 — A.**'].join('\n');
    const { ids } = collectIds(new Map([['docs/sdd/phases/v1/plan.md', text]]));
    expect(ids[0]).toMatchObject({ key: 'D-1', anchor: 'real-link-code', heading: 'Real [link](http://x.y) `code`' });
    expect(slug('A [b](http://c) `d_e`')).toBe('a-b-d_e');
  });

  it('records old sections of a file fed from two documents under the document that holds each', () => {
    const { sections } = collectIds(new Map([['docs/sdd/reference/delivery.md', '## 16. Delivery\n\n### 16.1 Lanes\n']]));
    expect(sections.map((entry) => entry.key)).toEqual(['PLAN §16', 'PLAN §16.1']);
  });
});

describe('FR-SDD-6: npm run sdd:id, one id of each kind', () => {
  const print = (id: string): string => printId('.', id) ?? '';

  it('prints a decision-log row as it stands, with its file and heading (US-51 AC2)', () => {
    const out = print('V212-13').split('\n');
    expect(out[0]).toBe('V212-13 — docs/sdd/decisions.md#12-decision-log — 12. Decision Log');
    const parent = readFileSync('scripts/sdd/__fixtures__/parent/SPEC.md', 'utf8')
      .split('\n')
      .find((line) => line.startsWith('| 2026-11-03 | V212-13 |'));
    expect(out[2]).toBe(parent);
    expect(out).toHaveLength(3);
  });

  it('prints a requirement to the end of its bullet', () => {
    const out = print('FR-SDD-6');
    expect(out).toMatch(/^FR-SDD-6 — docs\/sdd\/phases\/v2\.13\/spec\.md#456-the-workflow-v213 — 4\.56 The workflow/);
    expect(out).toContain('- **FR-SDD-6** **Ids resolve in one place.**');
    expect(out).toContain('*Verification:*');
    expect(out).not.toContain('FR-SDD-7');
  });

  it('prints a goal, a story, a finding, an open question, a decision and a task', () => {
    expect(print('G1')).toContain('- **G1. Zero-friction start.**');
    expect(print('US-51')).toContain('- AC8: No file under `src/` or `public/` changes (FR-SDD-28).');
    expect(print('F-53')).toMatch(/\n\| F-53 \| R45 #70/);
    expect(print('OQ-10')).toMatch(/\n\| OQ-10 \| Product name and domain\./);
    expect(print('D-1059')).toMatch(/\n- \*\*D-1059 — The split is a heading map\.\*\*/);
    expect(print('D-1059')).not.toContain('D-1060');
    const task = print('R171');
    expect(task).toMatch(/\n- \[x\] \*\*R171 — /);
    expect(task).toContain('  - **Lane:**');
    expect(task).not.toContain('**R172');
  });

  it('prints an old section, accepts lower case, and returns null for an unknown id', () => {
    expect(print('PLAN §16.1')).toContain('| `docs` *(v1.1, D-196');
    expect(print('fr-sdd-6')).toContain('**FR-SDD-6**');
    expect(printId('.', 'FR-NOPE-1')).toBeNull();
  });

  it('stops a story at the blank line and a bullet at the next line at the margin', () => {
    const text = ['**US-1 — A**', 'As a user.', '- AC1: one.', '', '**US-2 — B**', '- **FR-A-1** One.', '  More.', '- **FR-A-2** Two.'].join('\n');
    expect(extract(text, 'US-1')).toBe('**US-1 — A**\nAs a user.\n- AC1: one.');
    expect(extract(text, 'FR-A-1')).toBe('- **FR-A-1** One.\n  More.');
  });
});
