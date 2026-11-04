/**
 * FR-SDD-4, D-1060: one sentence per line. `rewrap` breaks a line after `.`, `?` or `!` plus
 * one space when the next character opens a sentence; `unwrap` is its inverse, block by
 * block, which is what the brief needs to come out byte for byte (FR-SDD-7). Whitespace only.
 */

/** SPEC §4.56's `DOC_LINE_MAX`; R179's `limits.ts` takes the constants over. */
export const DOC_LINE_MAX = 400;

/** D-1060: a terminator after one of these is not a sentence end. */
const ABBREVIATIONS = ['e.g.', 'i.e.', 'vs.', 'No.', 'approx.'];
/** D-1060: what opens a sentence — a capital, `*`, a backtick, `(`. */
const OPENER = /[A-Z*`(]/;
/** A sentence end, with the closing emphasis a bold sentence carries (`**… done.** Next`). */
const SENTENCE_END = /[.?!](?:\*\*|\*|_)?$/;

const isFence = (line: string): boolean => /^\s*(```|~~~)/.test(line);
const isTableRow = (line: string): boolean => /^\s*\|/.test(line);
const isHeading = (line: string): boolean => /^#{1,6}\s/.test(line);
const isBlockquote = (line: string): boolean => /^\s*>/.test(line);

/** The column where a list item's text starts, or `null` when the line is not a list item. */
export function itemTextColumn(line: string): number | null {
  const match = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/.exec(line);
  return match ? match[0].length : null;
}

const leadingSpace = (line: string): number => /^\s*/.exec(line)?.[0].length ?? 0;

/**
 * The indexes of the spaces a line breaks at: each follows a terminator (and a closing
 * emphasis) and precedes an opener, outside code spans, links, and never after an
 * abbreviation. A break needs exactly one space, so the inverse is exact.
 */
export function breakPoints(line: string): number[] {
  const points: number[] = [];
  let codeTicks = 0; // the length of the backtick run that opened the current code span
  let bracket = 0; // depth inside `[…]`
  let linkParen = false; // inside the `(…)` of `[…](…)`
  let bold = false; // inside `**…**`
  // A numbered item's own `1.` is a marker, not a sentence end.
  for (let index = itemTextColumn(line) ?? 0; index < line.length; index += 1) {
    const char = line[index] ?? '';
    if (char === '`') {
      let run = 1;
      while (line[index + run] === '`') run += 1;
      if (codeTicks === 0) codeTicks = run;
      else if (codeTicks === run) codeTicks = 0;
      index += run - 1;
      continue;
    }
    if (codeTicks > 0) continue;
    if (char === '*' && line[index + 1] === '*') {
      bold = !bold;
      index += 1;
      continue;
    }
    if (char === '[') bracket += 1;
    else if (char === ']' && bracket > 0) {
      bracket -= 1;
      if (bracket === 0 && line[index + 1] === '(') linkParen = true;
    } else if (char === ')' && linkParen) linkParen = false;
    if (bracket > 0 || linkParen) continue;
    if (char !== '.' && char !== '?' && char !== '!') continue;
    let end = index + 1;
    const emphasis = /^(\*\*|\*|_)/.exec(line.slice(end));
    if (emphasis) end += emphasis[0].length;
    // Inside a bold span (`**G1. Zero-friction start.**`) only its closing `**` ends a sentence.
    if (bold && emphasis?.[0] !== '**') continue;
    if (line[end] !== ' ' || line[end + 1] === ' ' || line[end + 1] === undefined) continue;
    if (!OPENER.test(line[end + 1] ?? '')) continue;
    const word = line.slice(line.lastIndexOf(' ', index) + 1, index + 1);
    if (ABBREVIATIONS.some((abbreviation) => word.toLowerCase().endsWith(abbreviation.toLowerCase()))) continue;
    points.push(end);
  }
  return points;
}

/** One line into its sentences, continuation lines indented to the item's text or the line's own indent. */
export function rewrapLine(line: string): string[] {
  const points = breakPoints(line);
  if (points.length === 0) return [line];
  const indent = ' '.repeat(itemTextColumn(line) ?? leadingSpace(line));
  const pieces: string[] = [];
  let start = 0;
  for (const point of points) {
    pieces.push(line.slice(start, point));
    start = point + 1;
  }
  pieces.push(line.slice(start));
  return pieces.map((piece, index) => (index === 0 ? piece : indent + piece));
}

/** D-1060 over a whole file: headings, table rows, blockquotes and fenced blocks are left alone. */
export function rewrap(lines: readonly string[]): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of lines) {
    if (isFence(line)) {
      fenced = !fenced;
      out.push(line);
      continue;
    }
    if (fenced || isHeading(line) || isTableRow(line) || isBlockquote(line)) out.push(line);
    else out.push(...rewrapLine(line));
  }
  return out;
}

/**
 * The inverse of `rewrap`: a line at the column `rewrap` gives continuations (the enclosing
 * item's text, else the paragraph's own indent) that opens a sentence, after a line that ended
 * one, is joined back with one space. The split keeps a block rewrapped only where this gives
 * the block back exactly (`roundTrips`), so the brief can read the old text (FR-SDD-7).
 */
export function unwrap(lines: readonly string[]): string[] {
  const out: string[] = [];
  let fenced = false;
  let column: number | null = null;
  for (const line of lines) {
    if (isFence(line)) {
      fenced = !fenced;
      column = null;
      out.push(line);
      continue;
    }
    if (fenced || line.trim() === '' || isHeading(line) || isTableRow(line) || isBlockquote(line)) {
      column = null;
      out.push(line);
      continue;
    }
    const itemColumn = itemTextColumn(line);
    if (itemColumn !== null) {
      column = itemColumn;
      out.push(line);
      continue;
    }
    const indent = leadingSpace(line);
    const previous = out[out.length - 1];
    if (column !== null && indent === column && OPENER.test(line[indent] ?? '') && previous !== undefined && SENTENCE_END.test(previous)) {
      out[out.length - 1] = `${previous} ${line.slice(indent)}`;
      continue;
    }
    if (column === null || indent < column) column = indent;
    out.push(line);
  }
  return out;
}

const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((line, index) => line === b[index]);

/** The blocks of a file: runs of lines between blank lines, a fenced block never cut. */
function blocksOf(lines: readonly string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  let fenced = false;
  for (const line of lines) {
    if (isFence(line)) fenced = !fenced;
    if (!fenced && line.trim() === '') {
      if (current.length > 0) blocks.push(current);
      blocks.push([line]);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

/**
 * D-1060 as the split applies it: each block rewrapped where `unwrap` gives it back exactly,
 * left as it is where not (a block already one sentence per line, or one whose inverse is
 * ambiguous). Lossless either way: only whitespace moves.
 */
export function rewrapBlocks(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const block of blocksOf(lines)) {
    const wrapped = rewrap(block);
    out.push(...(same(unwrap(wrapped), block) ? wrapped : block));
  }
  return out;
}

/** Whitespace removed: what the lossless test compares (D-1060). */
export const collapse = (text: string): string => text.replace(/\s+/g, '');
