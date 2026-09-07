import { readFileSync } from 'node:fs';

/**
 * R52 (FR-COMP-4, D-193): how a rendered control row is measured in cells.
 *
 * The measurement is of *strings*, not pixels — jsdom lays nothing out — and it
 * relies on the FR-X-6 invariant the whole app is built on: every control here
 * is monospace text, so its width is its length in characters. What that leaves
 * the test blind to is CSS wrapping, which is why FR-COMP-6 also asks each task
 * for a 390 px capture: the number here is the budget, the capture is the proof.
 *
 * Two things on a row are not in its `textContent`. The brackets — `[ Live sky ]`
 * is a link whose square brackets are `::before` / `::after` content — and the
 * gaps between controls, which are `gap` and padding in cells. The brackets are
 * read out of the CSS modules themselves, so a control that gains or loses them
 * changes the count without anyone remembering to update a table here. The gaps
 * are counted as one cell each, which is what every control row in the app
 * declares (`gap: 0 var(--cell)`) and what the approved mockups draw; a row that
 * wanted three would be measured a little tight, which is the safe direction to
 * be wrong in.
 *
 * The one subtlety is a decoration that belongs to a *state*. `.option::before`
 * is `[ ] ` and `.option[aria-pressed='true']::before` is `[x] `, which the
 * cascade means as "four cells either way"; but `.speed` has no unqualified
 * rule at all and only the pressed one is bracketed, which means "two cells, on
 * exactly one of the four" (D-245). So a rule keeps its qualifier and is
 * applied to the elements that actually match it, most specific first — which
 * is what the browser does, and the only way the two cases come out right.
 */

/** `_local_a1b2c3` — how Vite names a CSS-module class, and how the local name is read back out of one. */
const MODULE_CLASS = /^_(.+)_[0-9a-f]+$/;

interface Rule {
  /** The local class name the rule hangs off. */
  local: string;
  /** What else the element has to match, e.g. `[aria-pressed='true']`; empty for the plain class. */
  qualifier: string;
  side: 'before' | 'after';
  cells: number;
}

/** The `::before` and `::after` content the given stylesheets add, as rules that still know what they applied to. */
export function decorations(cssPaths: readonly string[]): readonly Rule[] {
  const rules: Rule[] = [];
  const pattern = /\.([A-Za-z][\w-]*)([^{,\s]*)\s*::(before|after)\s*\{([^}]*)\}/g;
  const content = /content:\s*'([^']*)'/;
  for (const path of cssPaths) {
    const css = readFileSync(path, 'utf8');
    for (const match of css.matchAll(pattern)) {
      const [, local, qualifier, side, body] = match;
      const text = content.exec(body ?? '')?.[1];
      if (text === undefined || local === undefined || side === undefined) continue;
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
function decorationOf(element: Element, rules: readonly Rule[]): number {
  const classes = localClasses(element);
  let cells = 0;
  for (const local of classes) {
    for (const side of ['before', 'after'] as const) {
      const candidates = rules.filter((rule) => rule.local === local && rule.side === side);
      const qualified = candidates.find((rule) => rule.qualifier !== '' && element.matches(`*${rule.qualifier}`));
      const plain = candidates.find((rule) => rule.qualifier === '');
      cells += (qualified ?? plain)?.cells ?? 0;
    }
  }
  return cells;
}

/** Whether the element is on the page at all: `hidden`, an empty `aria-hidden` and the `sr-only` box are not part of a row's width. */
function isVisible(element: Element): boolean {
  if (element.hasAttribute('hidden')) return false;
  return !element.classList.contains('sr-only');
}

/**
 * The controls on a row, each as the text it draws plus its own brackets. A
 * "control" is a leaf — an element with text and no element children of its own
 * — because that is what the row's `gap` sits between. Brackets are rendered as
 * `#` so a failure message shows where the width went.
 */
export function rowParts(row: Element, rules: readonly Rule[]): string[] {
  const parts: string[] = [];
  const walk = (element: Element): void => {
    if (!isVisible(element)) return;
    if (element.children.length === 0) {
      const text = element.textContent?.trim() ?? '';
      if (text === '') return;
      parts.push('#'.repeat(decorationOf(element, rules)) + text);
      return;
    }
    // Text of its own between the children (a sentence with a control in it) counts too.
    for (const node of element.childNodes) {
      if (node.nodeType === node.TEXT_NODE) {
        const text = node.textContent?.trim() ?? '';
        if (text !== '') parts.push(text);
      } else if (node.nodeType === node.ELEMENT_NODE) {
        walk(node as Element);
      }
    }
  };
  walk(row);
  return parts;
}

/** The row's width in cells: its controls, one cell of gap between each pair. */
export function rowCells(row: Element, rules: readonly Rule[]): number {
  return rowParts(row, rules).join(' ').length;
}
