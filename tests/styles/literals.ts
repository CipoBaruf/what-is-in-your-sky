/**
 * R103 (FR-DS-2, D-701): what the literals test matches. A module names a
 * token; it does not write the value. This reads every stylesheet under `src/`
 * but `tokens.css` and every inline `style={{ … }}` in `src/ui/**\/*.tsx` and
 * returns each literal with its line, by kind, so `literals.test.ts` can hold
 * every file to its allow-list count and say which lines are the matches.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC_DIR = 'src';
const UI_DIR = 'src/ui';
export const TOKENS_FILE = 'src/ui/styles/tokens.css';
export const PRIMITIVES_DIR = 'src/ui/components/primitives';
export const ALLOW_PATH = 'tests/styles/literals.allow.json';

type Kind = 'colour' | 'length' | 'z-index' | 'outline' | 'font-family' | 'bracket' | 'inline-style';

export interface Literal {
  kind: Kind;
  line: number;
  text: string;
}

interface Allowance {
  count: number;
  reason: string;
}

export type AllowList = Record<string, Allowance>;

function walk(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return entry === 'node_modules' ? [] : walk(path, keep);
      return keep(path) ? [path] : [];
    });
}

/** Posix-style paths, so the allow-list keys are the same on every platform. */
const posix = (path: string): string => relative('.', path).split(sep).join('/');

export function stylesheets(): string[] {
  return walk(SRC_DIR, (path) => path.endsWith('.css'))
    .map(posix)
    .filter((path) => path !== TOKENS_FILE);
}

export function components(): string[] {
  return walk(UI_DIR, (path) => path.endsWith('.tsx')).map(posix);
}

/** The CSS named colours, less the three D-701 lets through (`transparent`, `currentColor`, `inherit` — a keyword, not a colour). */
const NAMED_COLOURS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' '),
);

const HEX = /#[0-9a-f]{3,8}(?![\w-])/gi;
const FUNCTION_COLOUR = /\b(rgba?|hsla?)\(/g;
const COLOR_MIX = /color-mix\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
const WORD = /(?<![\w-])([a-z]+)(?![\w-])/gi;
/** A `px`, `rem` or `em` number: not part of a longer word or a token name, and not `0`. */
const LENGTH = /(?<![\w.-])(\d*\.?\d+)(px|rem|em)(?![\w-])/g;

/** The colour literals in one declaration value. */
function colourLiterals(value: string): string[] {
  const found: string[] = [];
  for (const m of value.matchAll(HEX)) found.push(m[0]);
  for (const m of value.matchAll(FUNCTION_COLOUR)) found.push(m[0]);
  for (const m of value.matchAll(COLOR_MIX)) if (colourLiterals(m[1] ?? '').length > 0 || [...(m[1] ?? '').matchAll(WORD)].some((w) => NAMED_COLOURS.has((w[1] ?? '').toLowerCase()))) found.push('color-mix(');
  for (const m of value.matchAll(WORD)) if (NAMED_COLOURS.has((m[1] ?? '').toLowerCase())) found.push(m[1] ?? '');
  return found;
}

function lengthLiterals(value: string): string[] {
  return [...value.matchAll(LENGTH)].filter((m) => Number(m[1]) !== 0).map((m) => m[0]);
}

/** Comments blanked (not cut, so line numbers hold) and every `@media`/`@container` prelude cut to its keyword (D-702: those are `breakpoint.test.ts`'s). */
function prepared(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/@(media|container|supports)[^{]*\{/g, (prelude, kind: string) => `@${kind}${' '.repeat(prelude.length - kind.length - 2)}{`);
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Every literal D-701 names in one stylesheet. */
export function scanStylesheet(path: string, css: string = readFileSync(path, 'utf8')): Literal[] {
  const text = prepared(css);
  const inPrimitives = path.startsWith(`${PRIMITIVES_DIR}/`);
  const found: Literal[] = [];
  for (const m of text.matchAll(/([a-z-]+)\s*:\s*([^;{}]*?)\s*;/g)) {
    const property = m[1] ?? '';
    const value = m[2] ?? '';
    const line = lineOf(text, m.index);
    const at = (kind: Kind, literal: string): void => {
      found.push({ kind, line, text: `${property}: ${literal}` });
    };
    if (property.startsWith('--') || property === '') continue;
    for (const colour of colourLiterals(value)) at('colour', colour);
    for (const length of lengthLiterals(value)) at('length', length);
    if (property === 'z-index' && /^\d/.test(value)) at('z-index', value);
    if (property.startsWith('outline') && `${property}: ${value}` !== 'outline-offset: var(--focus-offset-tight)') at('outline', value);
    if (property === 'font-family' && value !== 'var(--font-mono)') at('font-family', value);
    if (property === 'content' && !inPrimitives && /^(['"])(\[ | \])\1$/.test(value)) at('bracket', value);
  }
  return found;
}

/** The text between a `style={{` and its closing `}}`, braces matched; `null` when the value is not an object literal. */
function inlineStyles(source: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  for (const m of source.matchAll(/style=\{\{/g)) {
    let depth = 2;
    let i = m.index + m[0].length;
    const from = i;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ line: lineOf(source, m.index), body: source.slice(from, i - 2) });
  }
  return out;
}

/** The object's entries at its top level, split on commas outside brackets and quotes. */
function entries(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

/**
 * D-701: an inline `style` whose value is a colour or a length literal. A
 * custom property (`'--x': …`) and a value computed at runtime (a template
 * with an interpolation, a call, a variable) are allowed — a dome cell in px,
 * a gutter tick's `left` in % — which is what the eleven inline styles at
 * `ed8748a` set.
 */
export function scanComponent(path: string, source: string = readFileSync(path, 'utf8')): Literal[] {
  const found: Literal[] = [];
  for (const { line, body } of inlineStyles(source)) {
    for (const entry of entries(body)) {
      const colon = entry.indexOf(':');
      const key = entry.slice(0, colon).trim();
      const value = entry.slice(colon + 1).trim();
      if (colon < 0 || key.includes('--') || key.startsWith('...')) continue;
      const literal = /^(['"])(.*)\1$/.exec(value)?.[2] ?? (/^`([^$]*)`$/.exec(value)?.[1] ?? null);
      if (literal !== null) {
        if (colourLiterals(literal).length > 0 || lengthLiterals(literal).length > 0) found.push({ kind: 'inline-style', line, text: `${key}: ${value}` });
      } else if (/^\d*\.?\d+$/.test(value) && Number(value) !== 0) found.push({ kind: 'inline-style', line, text: `${key}: ${value}` });
    }
  }
  return found;
}

/** Every file the test reads, with its literals; files with none included, so a stale allow entry is seen. */
export function scanAll(): Map<string, Literal[]> {
  const out = new Map<string, Literal[]>();
  for (const path of stylesheets()) out.set(path, scanStylesheet(path));
  for (const path of components()) out.set(path, scanComponent(path));
  return out;
}

export function readAllowList(): AllowList {
  return JSON.parse(readFileSync(ALLOW_PATH, 'utf8')) as AllowList;
}
