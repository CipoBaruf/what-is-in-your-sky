/**
 * FR-SDD-4, D-1060: the rewrap breaks at sentence ends and nowhere else, and `unwrap`
 * takes a block back to the lines it was, which is what keeps the briefs byte for byte.
 */
import { describe, expect, it } from 'vitest';
import { DOC_LINE_MAX, breakPoints, collapse, itemTextColumn, rewrap, rewrapBlocks, rewrapLine, unwrap } from '../../scripts/sdd/rewrap';

describe('FR-SDD-4: rewrapLine', () => {
  it('breaks after a terminator plus one space when a capital, `*`, a backtick or `(` follows', () => {
    expect(rewrapLine('One thing. Another thing? A third! *(v1)* Then `code` starts. (A note.) end.')).toEqual([
      'One thing.',
      'Another thing?',
      'A third!',
      '*(v1)* Then `code` starts.',
      '(A note.) end.',
    ]);
  });

  it('indents a list item’s continuation to its text, a checkbox item included', () => {
    expect(rewrapLine('- **FR-X-1** First. Second.')).toEqual(['- **FR-X-1** First.', '  Second.']);
    expect(rewrapLine('  - **Goal:** one. Two.')).toEqual(['  - **Goal:** one.', '    Two.']);
    expect(rewrapLine('- [x] **R1 — Done.** Note.')).toEqual(['- [x] **R1 — Done.**', '      Note.']);
    expect(rewrapLine('1. **Set.** Then.')).toEqual(['1. **Set.**', '   Then.']);
    expect(itemTextColumn('   plain')).toBeNull();
  });

  it('keeps a plain indented line’s own indent', () => {
    expect(rewrapLine('  The group is x. The next.')).toEqual(['  The group is x.', '  The next.']);
  });

  it('never breaks inside a code span, a link, or after an abbreviation, a lowercase or two spaces', () => {
    expect(breakPoints('See `a. B` and [a link. Title](http://x.y/a. B) here. done')).toEqual([]);
    expect(breakPoints('Use e.g. This and i.e. That, vs. Those, No. Four, approx. Five.')).toEqual([]);
    expect(breakPoints('lower. case and double.  Spaced and 1280 × 800. 25 points')).toEqual([]);
    expect(breakPoints('A `` ` `` tick. Next')).toEqual([15]);
  });

  it('breaks after a bold sentence’s closing emphasis', () => {
    expect(rewrapLine('- **D-1 — Title.** (FR-1.) `x` is y. Z.')).toEqual(['- **D-1 — Title.**', '  (FR-1.) `x` is y.', '  Z.']);
  });
});

describe('FR-SDD-4: rewrap over a file', () => {
  const input = ['# Heading. Not split', '', '| a. B | c. D |', '```', 'code. Code', '```', '> quoted. Quote', '- item. Next', 'Para one. Para two.'];

  it('leaves headings, table rows, fences and blockquotes alone and wraps the rest', () => {
    expect(rewrap(input)).toEqual(['# Heading. Not split', '', '| a. B | c. D |', '```', 'code. Code', '```', '> quoted. Quote', '- item.', '  Next', 'Para one.', 'Para two.']);
  });

  it('changes whitespace only', () => {
    expect(collapse(rewrap(input).join('\n'))).toBe(collapse(input.join('\n')));
  });

  it('exports the line ceiling', () => {
    expect(DOC_LINE_MAX).toBe(400);
  });
});

describe('FR-SDD-7: unwrap is the inverse, and rewrapBlocks keeps only what it can undo', () => {
  const original = [
    '## 4.56 The workflow',
    '',
    'Preamble one. Preamble two.',
    'A second line of the preamble.',
    '',
    '- **FR-A-1** First. Second `x`. *(tag)* Third.',
    '- **FR-A-2** Only one',
    '  - **Nested:** yes. (Note.)',
    '',
    '**US-1 — Title**',
    'As a user, I do. So that.',
    '- AC1: one. Two.',
  ];

  it('gives back every list item and story byte for byte', () => {
    const items = original.slice(5);
    const wrapped = rewrap(items);
    expect(wrapped).not.toEqual(items);
    expect(unwrap(wrapped)).toEqual(items);
  });

  it('leaves a block whose inverse is ambiguous as it was', () => {
    const out = rewrapBlocks(original);
    // The preamble's second line opens a sentence after one ended: unwrap would join it.
    expect(out.slice(0, 5)).toEqual(original.slice(0, 5));
    expect(out).toContain('As a user, I do.');
    expect(out).toContain('  - **Nested:** yes.');
    expect(collapse(out.join('\n'))).toBe(collapse(original.join('\n')));
    expect(unwrap(out)).toEqual(unwrap(original));
  });

  it('leaves a sub-bullet and a deeper-indented line where they are', () => {
    const lines = ['- **D-1 — T.**', '  - sub. Item', '    Deeper. Line', '  Continuation.'];
    expect(unwrap(lines)).toEqual(lines);
  });
});
