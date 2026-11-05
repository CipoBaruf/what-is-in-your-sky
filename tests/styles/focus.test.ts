/**
 * v2.14.1 (FR-WIDE-14, V214-31; D-1141): a focused field draws one line. `global.css` gives a focused text field,
 * select or textarea its own border in the ring's colour and no outline, after the one ring rule (D-704), and no
 * other stylesheet restates a field's focus: no rule on a field — by element, or by the class `Field` puts on its
 * `<input>` — sets an outline or a border under `:focus` or `:focus-visible`. `focus.spec.ts` measures it in Chromium.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stylesheets } from './literals';

interface Rule {
  selector: string;
  body: string;
  at: number;
}

/** Every innermost rule of a stylesheet, its selector and declarations, comments dropped; a media block's rules are its own. */
function rules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: Rule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    found.push({ selector: (match[1] ?? '').trim().replace(/\s+/g, ' '), body: match[2] ?? '', at: match.index });
  }
  return found;
}

const GLOBAL = 'src/ui/styles/global.css';
/** The classes `Field` (the one component that draws an `<input>`) puts on it. */
const FIELD_CLASSES = ['.input', '.inUnit'];
const FIELD_MODULE = 'src/ui/components/primitives/Field.module.css';
const isField = (path: string, selector: string): boolean => /(^|[\s,>+~(])(input|select|textarea)\b/.test(selector) || (path === FIELD_MODULE && FIELD_CLASSES.some((name) => selector.includes(name)));
const declares = (body: string, property: RegExp): string[] => body.split(';').map((line) => line.trim()).filter((line) => property.test(line));

describe('a focused field’s one line (FR-WIDE-14, D-1141)', () => {
  const global = rules(readFileSync(GLOBAL, 'utf8'));

  it('global.css draws it: no outline and the border in the accent, after the ring rule', () => {
    const field = global.find((rule) => rule.selector === ':is(input, select, textarea):focus-visible');
    expect(field, 'the field focus rule').toBeDefined();
    if (!field) return;
    expect(declares(field.body, /^outline/)).toEqual(['outline: none']);
    expect(declares(field.body, /^border/)).toEqual(['border-color: var(--accent)']);
    const ring = global.find((rule) => rule.selector.startsWith(':focus-visible,'));
    expect(ring, 'the ring rule').toBeDefined();
    expect(declares(ring?.body ?? '', /^outline:/)).toEqual(['outline: var(--focus-ring) solid var(--accent)']);
    // The ring's colour is the field border's, and the field rule is read after the ring's.
    expect(field.at).toBeGreaterThan(ring?.at ?? Number.POSITIVE_INFINITY);
  });

  it('no stylesheet restates a field’s focus: no outline or border on a field under :focus or :focus-visible', () => {
    const offending: string[] = [];
    for (const path of stylesheets()) {
      for (const rule of rules(readFileSync(path, 'utf8'))) {
        if (!/:focus/.test(rule.selector) || !isField(path, rule.selector)) continue;
        if (path === GLOBAL && rule.selector === ':is(input, select, textarea):focus-visible') continue;
        const set = declares(rule.body, /^(outline|border)/);
        if (set.length > 0) offending.push(`${path}: ${rule.selector} { ${set.join('; ')} }`);
      }
    }
    expect(offending).toEqual([]);
  });

  it('reads a field rule where it is written (the matcher itself)', () => {
    expect(isField('x.css', 'input:focus-visible')).toBe(true);
    expect(isField('x.css', '.form > select:focus')).toBe(true);
    expect(isField(FIELD_MODULE, '.inUnit:focus-visible')).toBe(true);
    expect(isField('x.css', 'button:focus-visible')).toBe(false);
    expect(isField('x.css', '.inputs:focus-within')).toBe(false);
  });
});
