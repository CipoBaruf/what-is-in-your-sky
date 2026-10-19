/**
 * R103 (FR-DS-3, D-702): every `@media` and `@container` condition in the
 * tree, read as `(feature, comparator, value)` whatever syntax it is written
 * in. `(min-width: 964px)` and `(width >= 964px)` are the same condition —
 * `width >= 964px` — so a listing made before the range-syntax rewrite and one
 * made after it are identical when the rewrite changed no size, which is what
 * `breakpoint.test.ts` holds `breakpoints.json` to.
 */
import { readFileSync } from 'node:fs';

export const UI_DIR = 'src/ui';
export const BREAKPOINTS_PATH = 'tests/styles/breakpoints.json';

export interface Condition {
  feature: string;
  comparator: string;
  value: string;
}

import { posix, walk, withoutComments } from './literals';

export interface Query {
  /** `media` or `container`. */
  at: string;
  /** The prelude as written, trimmed. */
  prelude: string;
  conditions: Condition[];
}

/** Every `.css` file under `dir`, posix paths relative to the root (the same walk and the same keys as `literals.ts`). */
export function cssFiles(dir: string): string[] {
  return walk(dir, (path) => path.endsWith('.css')).map(posix);
}

/**
 * One parenthesised condition as `(feature, comparator, value)`: the range
 * form `(width >= 964px)` as written, the legacy `min-`/`max-` form folded onto
 * the same shape, and a discrete feature (`orientation: landscape`) with `:`.
 */
function parseCondition(text: string): Condition {
  const inner = text.trim().replace(/^\(|\)$/g, '').trim();
  const range = /^([a-z-]+)\s*(<=|>=|<|>|=)\s*(.+)$/.exec(inner);
  if (range?.[1] && range[2] && range[3]) return { feature: range[1], comparator: range[2], value: range[3].trim() };
  const plain = /^([a-z-]+)\s*:\s*(.+)$/.exec(inner);
  if (!plain?.[1] || !plain[2]) throw new Error(`cannot read the condition \`${text}\``);
  const [, feature, value] = plain;
  const minMax = /^(min|max)-(width|height)$/.exec(feature);
  if (minMax?.[1] && minMax[2]) return { feature: minMax[2], comparator: minMax[1] === 'min' ? '>=' : '<=', value: value.trim() };
  return { feature, comparator: ':', value: value.trim() };
}

/** Every `@media` / `@container` prelude in `css`, comments stripped, in source order. */
export function queriesOf(css: string): Query[] {
  return [...withoutComments(css).matchAll(/@(media|container)([^{]*)\{/g)].map((match) => {
    const prelude = (match[2] ?? '').trim();
    const conditions = [...prelude.matchAll(/\([^()]*\)/g)].map((m) => parseCondition(m[0]));
    if (conditions.length === 0) throw new Error(`@${match[1] ?? ''} ${prelude}: no condition`);
    return { at: match[1] ?? '', prelude, conditions };
  });
}

/** `(feature, comparator, value)` as one line: `width >= 964px`, `orientation : landscape`. */
export function conditionText({ feature, comparator, value }: Condition): string {
  return `${feature} ${comparator} ${value}`;
}

/**
 * One query as the listing prints it: the prelude as written, each condition
 * normalised to `(feature comparator value)` and the words between them —
 * `and`, `or`, `not`, a comma — kept, so a rewrite that changes which sizes
 * match is a changed line even when every number is the same.
 */
export function queryText({ at, prelude }: Query): string {
  const normalised = prelude.replace(/\([^()]*\)/g, (m) => `(${conditionText(parseCondition(m))})`).replace(/\s+/g, ' ').trim();
  return `@${at} ${normalised}`;
}

/** The listing `breakpoints.json` holds: per file, each query in source order, as `queryText` prints it. */
export type Listing = Record<string, string[]>;

export function listing(dir: string = UI_DIR): Listing {
  const out: Listing = {};
  for (const path of cssFiles(dir)) {
    const queries = queriesOf(readFileSync(path, 'utf8'));
    if (queries.length > 0) out[path] = queries.map(queryText);
  }
  return out;
}
