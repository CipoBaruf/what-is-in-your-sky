import { readFileSync } from 'node:fs';
import { BASE_FONT_PX, CELL_ADVANCE_EM_MAX, WIDE_QUERY } from '../../src/lib/layout';

/**
 * R52 (FR-COMP-4, D-193): how a rendered control row is measured in cells.
 *
 * The measurement is of *strings*, not pixels — jsdom lays nothing out — and it
 * relies on the FR-X-6 invariant the whole app is built on: every control here
 * is monospace text, so its width is its length in characters. What that leaves
 * the test blind to is CSS wrapping, which is why FR-COMP-6 also asks each task
 * for a 390 px capture: the number here is the budget, the capture is the proof.
 *
 * Three things on a row are not in its `textContent`, and all three are read
 * out of the stylesheets, so a control that gains or loses one changes the
 * count without anyone remembering to update a table here.
 *
 * - A box (R206, D-1226): a button's outline and an option's block are a cell
 *   of padding each side of the words (`--control-pad`, the hairline inside
 *   it), whatever the state. A `content` of characters counts as it always did.
 * - A width floor: a button or an option of one or two characters, and a link
 *   that is a `.target` on compact, is `--target` wide, five cells.
 * - The gaps: one cell between two controls, which is what every control row
 *   in the app declares (`gap: 0 var(--cell)`), and a quarter between the
 *   options of a `ToggleGroup` (FR-CTRL-3), read off its module. A row that
 *   wanted three would be measured a little tight, which is the safe direction
 *   to be wrong in.
 *
 * A rule keeps its qualifier and is applied to the elements that match it, most
 * specific first, as the browser does (D-245).
 */

/** `_local_a1b2c3` — how Vite names a CSS-module class, and how the local name is read back out of one. */
const MODULE_CLASS = /^_(.+)_[0-9a-f]+$/;

interface Rule {
  /** The local class name the rule hangs off. */
  local: string;
  /** What else the element has to match, e.g. `[aria-pressed='true']`; empty for the plain class. */
  qualifier: string;
  side: 'before' | 'after' | 'box' | 'floor';
  cells: number;
}

/** A class whose rule lays `--control-pad` each side of its words, whole or with the hairline inside it. */
const BOX = /(?:^|\})\s*\.([A-Za-z][\w-]*)\s*\{[^}]*padding-inline:\s*(?:var\(--control-pad\)|calc\(var\(--control-pad\) - var\(--hairline\)\));/g;
/** `--target`, 44 px, in whole cells of the widest font. */
const TARGET_CELLS = Math.ceil(44 / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX));

/** What the given stylesheets add to a control's words, as rules that still know what they applied to. */
export function decorations(cssPaths: readonly string[]): readonly Rule[] {
  const rules: Rule[] = [];
  const pattern = /\.([A-Za-z][\w-]*)([^{,\s]*)\s*::(before|after)\s*\{([^}]*)\}/g;
  const content = /content:\s*'([^']*)'/;
  for (const path of cssPaths) {
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, local] of css.matchAll(BOX)) if (local) rules.push({ local, qualifier: '', side: 'box', cells: 2 });
    for (const match of css.matchAll(pattern)) {
      const [, local, qualifier, side, body] = match;
      const text = content.exec(body ?? '')?.[1];
      if (text === undefined || local === undefined || side === undefined) continue;
      if (side === 'after' && /inline-size:\s*var\(--target\)/.test(body ?? '')) rules.push({ local, qualifier: qualifier ?? '', side: 'floor', cells: TARGET_CELLS });
      rules.push({ local, qualifier: qualifier ?? '', side: side as 'before' | 'after', cells: text.length });
    }
  }
  return rules;
}

/** The local class names an element carries, with Vite's per-file hash stripped off. */
function localClasses(element: Element): Set<string> {
  const names = new Set<string>();
  for (const className of element.classList) names.add(MODULE_CLASS.exec(className)?.[1] ?? className);
  return names;
}

/**
 * What one element's own classes add to it, in cells: for each class and each
 * side, the most specific rule that matches — a qualified one where the element
 * is in that state, the plain one otherwise, and nothing where neither applies.
 */
function addedBy(element: Element, rules: readonly Rule[], sides: readonly Rule['side'][]): number {
  let cells = 0;
  for (const local of localClasses(element)) {
    for (const side of sides) {
      const candidates = rules.filter((rule) => rule.local === local && rule.side === side);
      // A class in a qualifier is hashed on the element, as its own is.
      const qualified = candidates.find((rule) => rule.qualifier !== '' && element.matches(`*${rule.qualifier.replace(/\.([A-Za-z][\w-]*)/g, '[class*="_$1_"]')}`));
      const plain = candidates.find((rule) => rule.qualifier === '');
      cells += (qualified ?? plain)?.cells ?? 0;
    }
  }
  return cells;
}

/** The least cells the element takes: its module's floor, or `.target`'s for a link on compact (primitives.css). */
function floorOf(element: Element, rules: readonly Rule[]): number {
  if (element.matches('a.target') && !window.matchMedia(WIDE_QUERY).matches) return TARGET_CELLS;
  return addedBy(element, rules, ['floor']);
}

/** Whether the element is on the page at all: `hidden`, an empty `aria-hidden` and a `VisuallyHidden` block (R107) are not part of a row's width. */
function isVisible(element: Element): boolean {
  if (element.hasAttribute('hidden')) return false;
  return !element.hasAttribute('data-visually-hidden');
}

/**
 * The controls on a row, each as the text it draws plus its box. A
 * "control" is a leaf — an element with text and no element children of its own
 * — because that is what the row's `gap` sits between. What is drawn round the
 * words is rendered as `#` so a failure message shows where the width went.
 */
export function rowParts(row: Element, rules: readonly Rule[]): string[] {
  const parts: string[] = [];
  const walk = (element: Element): void => {
    if (!isVisible(element)) return;
    // R74 (D-441): the mark is a drawing, not a word. It declares how many
    // cells of the row it occupies (`markCells`, from its pixel size), and the
    // braille inside it is never counted as text.
    const mark = element.getAttribute('data-mark-cells');
    if (mark !== null) {
      parts.push('#'.repeat(Number(mark)));
      return;
    }
    const first = parts.length;
    // Text of its own between the children (a sentence with a control in it) counts too.
    for (const node of element.childNodes) {
      if (node.nodeType === node.TEXT_NODE) {
        const text = node.textContent?.trim() ?? '';
        if (text !== '') parts.push(text);
      } else if (node.nodeType === node.ELEMENT_NODE) {
        walk(node as Element);
      }
    }
    const words = parts[first];
    if (words === undefined) return;
    const drawn = '#'.repeat(addedBy(element, rules, ['before', 'after', 'box'])) + words;
    parts[first] = parts.length === first + 1 ? drawn.padStart(floorOf(element, rules), '#') : drawn;
  };
  walk(row);
  return parts;
}

/** A quarter of a cell between two options: the share of a cell `ToggleGroup.module.css`'s `.group` declares. */
function optionGap(): number {
  const part = /\.group \{[^}]*gap: 0 calc\(var\(--cell\) \/ (\d+)\)/.exec(readFileSync('src/ui/components/primitives/ToggleGroup.module.css', 'utf8'))?.[1];
  if (part === undefined) throw new Error('ToggleGroup.module.css: .group has no gap in shares of a cell');
  return 1 / Number(part);
}

/** The row's width in cells: its controls, one cell of gap between each pair, less what a group's options save of it. */
export function rowCells(row: Element, rules: readonly Rule[]): number {
  const groups = [row, ...row.querySelectorAll('*')].filter((el) => el.matches('[role="group"], [role="radiogroup"]') && !el.classList.contains('target-row') && el.closest('[hidden]') === null);
  const pairs = groups.reduce((sum, group) => sum + Math.max(0, group.querySelectorAll(':scope > button[data-option]').length - 1), 0);
  return rowParts(row, rules).join(' ').length - pairs * (1 - optionGap());
}
