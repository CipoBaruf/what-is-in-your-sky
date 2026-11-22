/**
 * R103 (FR-DS-2, D-701): what the literals test matches. A module names a
 * token; it does not write the value. This reads every stylesheet under `src/`
 * but `tokens.css` and every inline `style={{ … }}` in `src/ui/**\/*.tsx` and
 * returns each literal with its line, by kind, so `literals.test.ts` can hold
 * every file to its allow-list count and say which lines are the matches.
 * R209 (FR-CTRL-14, FR-DS-2 as amended; D-1229): and every bracketed word
 * outside `Tag`, for the lanes' ratchet (`ratchet.ts`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const SRC_DIR = 'src';
const UI_DIR = 'src/ui';
export const TOKENS_FILE = 'src/ui/styles/tokens.css';
export const PRIMITIVES_DIR = 'src/ui/components/primitives';
export const ALLOW_PATH = 'tests/styles/literals.allow.json';
/** FR-CTRL-14: brackets mean a label, and `Tag` is the one thing that writes them. */
export const TAG_COMPONENT = `${PRIMITIVES_DIR}/Tag.tsx`;
export const TAG_STYLESHEET = `${PRIMITIVES_DIR}/Tag.module.css`;

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

/** One match of a ratchet's rule. */
export interface Hit {
  line: number;
  text: string;
}

export function walk(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return entry === 'node_modules' ? [] : walk(path, keep);
      return keep(path) ? [path] : [];
    });
}

/** Posix-style paths, so the allow-list keys are the same on every platform. */
export const posix = (path: string): string => relative('.', path).split(sep).join('/');

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
/** A `px`, `rem` or `em` number, negative or not: not part of a longer word or a token name, and not `0`. */
const LENGTH = /(?<![\w.-])(-?\d*\.?\d+)(px|rem|em)(?![\w-])/g;
/** The inline-style keys React takes unitless, where a bare number is not a length (`zIndex` is counted apart, as a stacking level). */
const UNITLESS = new Set(['opacity', 'flex', 'flexGrow', 'flexShrink', 'lineHeight', 'fontWeight', 'order', 'zoom', 'tabSize', 'columnCount', 'gridRow', 'gridColumn', 'gridRowStart', 'gridRowEnd', 'gridColumnStart', 'gridColumnEnd', 'animationIterationCount', 'aspectRatio']);

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

/** The stylesheet with its comments blanked, not cut, so line numbers hold. */
export function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/** Comments blanked and every `@media`/`@container` prelude cut to its keyword (D-702: those are `breakpoint.test.ts`'s). */
function prepared(css: string): string {
  return withoutComments(css).replace(/@(media|container|supports)[^{]*\{/g, (prelude, kind: string) => `@${kind}${' '.repeat(prelude.length - kind.length - 2)}{`);
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Every literal D-701 names in one stylesheet. */
export function scanStylesheet(path: string, css: string = readFileSync(path, 'utf8')): Literal[] {
  const text = prepared(css);
  const found: Literal[] = [];
  // A declaration ends at `;` or at the block's `}` (the last one in a block may have no `;`).
  for (const m of text.matchAll(/([a-z-]+)\s*:\s*([^;{}]*?)\s*(?:;|(?=\}))/g)) {
    const property = m[1] ?? '';
    const value = m[2] ?? '';
    const line = lineOf(text, m.index);
    const at = (kind: Kind, literal: string): void => {
      found.push({ kind, line, text: `${property}: ${literal}` });
    };
    if (property.startsWith('--') || property === '') continue;
    for (const colour of colourLiterals(value)) at('colour', colour);
    for (const length of lengthLiterals(value)) at('length', length);
    if (property === 'z-index' && /^-?\d/.test(value)) at('z-index', value);
    if (property.startsWith('outline') && `${property}: ${value}` !== 'outline-offset: var(--focus-offset-tight)') at('outline', value);
    if (property === 'font-family' && value !== 'var(--font-mono)') at('font-family', value);
    if (property === 'content' && path !== TAG_STYLESHEET && /^(['"])(\[ | \])\1$/.test(value)) at('bracket', value);
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
      } else if (/^-?\d*\.?\d+$/.test(value) && Number(value) !== 0) {
        // A bare number is a px length to React, except on the unitless keys; a bare `zIndex` is a stacking level.
        if (key === 'zIndex') found.push({ kind: 'z-index', line, text: `${key}: ${value}` });
        else if (!UNITLESS.has(key)) found.push({ kind: 'inline-style', line, text: `${key}: ${value}` });
      }
    }
  }
  return found;
}

/** A module that ships: not a test. */
export const isShipped = (path: string): boolean => !/\.(test|spec)\.tsx?$/.test(path);

/** A module's tree and the line of a node in it. */
export function parsed(path: string, text: string): { source: ts.SourceFile; line: (node: ts.Node) => number } {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return { source, line: (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 };
}

/** What stands for an interpolation, a nested element or an expression when a text is read for brackets. */
const SLOT = '\uFFFC';
const BRACKETED = /\[[^[\]\n]+\]/g;
/** D-1229's `[${…}]`: an interpolation inside brackets with no `=`, which an attribute selector has. */
const BUILT = /\[[^[\]=\n]*\uFFFC[^[\]=\n]*\]/g;

const templateText = (node: ts.TemplateExpression): string => node.head.text + node.templateSpans.map((span) => SLOT + span.literal.text).join('');

/** The strings a JSX child can draw as written: a literal, or either side of a condition. */
function drawnStrings(node: ts.Expression | undefined): string[] {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return drawnStrings(node.expression);
  if (ts.isConditionalExpression(node)) return [...drawnStrings(node.whenTrue), ...drawnStrings(node.whenFalse)];
  if (ts.isBinaryExpression(node)) return drawnStrings(node.right);
  return [];
}

/**
 * D-1229, D-1257: a bracketed word outside `Tag` — in JSX text, in a catalog's
 * string, in a template that builds `[${…}]`, and in a stylesheet's `content`,
 * which is how most of the day's tags draw theirs.
 */
export function scanBrackets(path: string, text: string = readFileSync(path, 'utf8')): Hit[] {
  if (path === TAG_COMPONENT || path === TAG_STYLESHEET) return [];
  const found: Hit[] = [];
  if (path.endsWith('.css')) {
    const css = withoutComments(text);
    for (const m of css.matchAll(/(?<![\w-])content\s*:\s*(['"])([^'"\n]*)\1/g)) if (/[[\]]/.test(m[2] ?? '')) found.push({ line: lineOf(css, m.index), text: m[0] });
    return found;
  }
  const { source, line } = parsed(path, text);
  const inCatalog = path.startsWith('src/i18n/');
  const add = (node: ts.Node, words: string, pattern: RegExp): void => {
    for (const m of words.matchAll(pattern)) found.push({ line: line(node), text: m[0].replaceAll(SLOT, '…') });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      // The children as one line, so `[{word}]` is one bracketed word.
      add(node, node.children.map((child) => (ts.isJsxText(child) ? child.text : SLOT)).join(''), BRACKETED);
      for (const child of node.children) if (ts.isJsxExpression(child)) for (const words of drawnStrings(child.expression)) add(child, words, BRACKETED);
    } else if (ts.isTemplateExpression(node)) {
      add(node, templateText(node), inCatalog ? BRACKETED : BUILT);
    } else if (inCatalog && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      add(node, node.text, BRACKETED);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** What the bracket rule reads: the stylesheets, and the shipped modules of the screens, the catalogs and what formats for them. */
export function bracketFiles(): string[] {
  const modules = [UI_DIR, 'src/i18n', 'src/lib'].flatMap((dir) => walk(dir, (path) => /\.tsx?$/.test(path) && isShipped(path)).map(posix));
  return [...stylesheets(), ...modules];
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
