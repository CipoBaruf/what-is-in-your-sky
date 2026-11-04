/**
 * FR-SDD-24 (D-1069): the generator reads ids from test titles, keeps PLAN §12's hand-kept rows
 * byte for byte, and the committed file is what the tree generates.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pendingIds } from '../../scripts/check-sdd';
import { IDS_PATH, parseIds } from '../../scripts/sdd/ids';
import { collectTraces, generateTraceability, GENERATED_HEADING, handKept, renderTraceability, testTitles, titleIds, TRACEABILITY_PATH, tracedIds } from '../../scripts/sdd/traceability';

const committed = readFileSync(TRACEABILITY_PATH, 'utf8');
/** Builds a call so this file's own source holds no title with an id in it. */
const call = (name: string, title: string, quote = "'"): string => `${name}(${quote}${title}${quote}, () => {});`;

describe('FR-SDD-24: the generator', () => {
  it('reads the titles of describe, it and test, their modifiers and all three quotes', () => {
    const source = [call('describe', 'a'), call('it.skip', 'b', '"'), call('test.describe.serial', 'c', '`'), call('it.each([1, 2])', 'd'), call('it', "e \\' f"), 'notit("g")'].join('\n');
    expect(testTitles(source)).toEqual(['a', 'b', 'c', 'd', "e \\' f"]);
  });

  it('takes requirement and story ids from a title, a letter suffix included', () => {
    expect(titleIds('FR-SDD-6, FR-GUIDE-2b and US-51 AC7; not D-1069 or F-9')).toEqual(['FR-SDD-6', 'FR-GUIDE-2b', 'US-51']);
  });

  it('lists each id once, in natural order, with the files naming it', () => {
    const traces = collectTraces(
      new Map([
        ['tests/b.test.ts', call('it', ['FR-A-10', 'FR-A-2'].join(' '))],
        ['tests/a.test.ts', call('describe', 'FR-A-2')],
      ]),
    );
    expect([...traces]).toEqual([
      ['FR-A-2', ['tests/a.test.ts', 'tests/b.test.ts']],
      ['FR-A-10', ['tests/b.test.ts']],
    ]);
  });

  it('keeps the text above its heading as it is, and regenerating is a fixed point', () => {
    const kept = '## 12. Requirement Traceability\n\n| Requirement | Module(s) |\n|---|---|\n| FR-X-1 | `x.ts` |\n\n---\n';
    const once = renderTraceability(kept, new Map([['FR-X-1', ['tests/x.test.ts']]]));
    expect(once.startsWith(`${kept}\n${GENERATED_HEADING}\n`)).toBe(true);
    expect(handKept(once)).toBe(kept);
    expect(renderTraceability(handKept(once), new Map([['FR-X-1', ['tests/x.test.ts']]]))).toBe(once);
    expect([...tracedIds(once)]).toEqual(['FR-X-1']);
  });
});

describe('FR-SDD-24: docs/sdd/reference/traceability.md', () => {
  it('is what the tree generates', () => {
    expect(committed === generateTraceability('.'), `${TRACEABILITY_PATH} is stale: run \`npx tsx scripts/sdd/traceability.ts --write\``).toBe(true);
  });

  it("keeps PLAN §12's hand-kept rows byte for byte, as the parent of the split had them", () => {
    const plan = readFileSync('scripts/sdd/__fixtures__/parent/PLAN.md', 'utf8');
    const section = plan.slice(plan.indexOf('## 12. Requirement Traceability'), plan.indexOf('## 13. Risks and Mitigations'));
    // The split ends a moved file on one newline; the blank line before `## 13.` was the section break.
    expect(handKept(committed)).toBe(section.replace(/\n+$/, '\n'));
  });

  it('lists every FR-SDD id with a test; the rest are owed by an open task or moved out', () => {
    const traced = tracedIds(committed);
    const pending = pendingIds(readFileSync('TASKS.md', 'utf8'));
    const ids = [...parseIds(readFileSync(IDS_PATH, 'utf8')).keys()].filter((id) => id.startsWith('FR-SDD-'));
    expect(ids.length).toBeGreaterThanOrEqual(28);
    // FR-SDD-26 moved to the renderer phase (V213-12); check:sdd's movedOut skips it the same way.
    expect(ids.filter((id) => !traced.has(id) && !pending.has(id) && id !== 'FR-SDD-26')).toEqual([]);
    for (const id of ['FR-SDD-4', 'FR-SDD-6', 'FR-SDD-13', 'FR-SDD-19', 'FR-SDD-20', 'FR-SDD-24']) expect(traced, id).toContain(id);
  });
});
