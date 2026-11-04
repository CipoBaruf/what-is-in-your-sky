/**
 * FR-SDD-4, D-1060: the rewrap breaks at sentence ends and nowhere else, and `unwrapItems`
 * takes a list item back to the line it was, which is what keeps the briefs byte for byte.
 */
import { describe, expect, it } from 'vitest';
import { DOC_LINE_MAX, breakPoints, collapse, itemTextColumn, rewrap, rewrapLine, unwrapItems } from '../../scripts/sdd/rewrap';

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

describe('FR-SDD-7: unwrapItems is the inverse for list items', () => {
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

  it('restores every list item byte for byte and never joins lines at the margin', () => {
    const wrapped = rewrap(original);
    expect(wrapped).not.toEqual(original);
    // The list items come back as they were; the paragraph's and the story's sentences stay on
    // their lines, since nothing says they were one line before the split.
    expect(unwrapItems(wrapped)).toEqual([
      '## 4.56 The workflow',
      '',
      'Preamble one.',
      'Preamble two.',
      'A second line of the preamble.',
      '',
      '- **FR-A-1** First. Second `x`. *(tag)* Third.',
      '- **FR-A-2** Only one',
      '  - **Nested:** yes. (Note.)',
      '',
      '**US-1 — Title**',
      'As a user, I do.',
      'So that.',
      '- AC1: one. Two.',
    ]);
  });

  it('leaves a sub-bullet and a deeper-indented line where they are', () => {
    const lines = ['- **D-1 — T.**', '  - sub. Item', '    Deeper. Line', '  Continuation.'];
    expect(unwrapItems(lines)).toEqual(['- **D-1 — T.**', '  - sub. Item', '    Deeper. Line', '  Continuation.']);
  });
});
