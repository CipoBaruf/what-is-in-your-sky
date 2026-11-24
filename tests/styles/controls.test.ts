/**
 * R209 (FR-DS-11; D-1229): every control is a primitive. Each `.tsx` under `src/ui` outside `primitives/` is
 * parsed and its `<button>`, `<a>` and `<input>` are held to the lanes' lists, whose counts only fall.
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { components, isShipped, parsed, PRIMITIVES_DIR, type Hit } from './literals';
import { laneLists, listFaults, overCount, type LaneList } from './ratchet';

const ELEMENTS = new Set(['button', 'a', 'input']);

/** The tree's reading of D-1229's `<button[\s>/]`: a longer name never counts, nor does a tag in a comment or a string. */
function controls(path: string, text: string = readFileSync(path, 'utf8')): Hit[] {
  if (path.startsWith(`${PRIMITIVES_DIR}/`)) return [];
  const { source, line } = parsed(path, text);
  const found: Hit[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (ELEMENTS.has(tag)) found.push({ line: line(node), text: `<${tag}>` });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const files = components().filter(isShipped);
const lists = laneLists('controls');

describe('every control is a primitive (FR-DS-11, D-1229)', () => {
  it('reads the components under src/ui', () => {
    expect(files.length).toBeGreaterThan(40);
    expect(files.filter((path) => path.includes('.test.'))).toEqual([]);
  });

  it('FR-DS-11: no module outside the primitives renders more controls of its own than its lane’s list allows', () => {
    const failures = overCount(new Map(files.map((path) => [path, controls(path)])), lists);
    expect(failures, `Use a primitive (docs/DESIGN.md).\n${failures.join('\n')}`).toEqual([]);
  });

  it('the lists are one per lane, a file in one of them, each with its count and reason', () => {
    expect(listFaults('controls', lists)).toEqual([]);
  });

  it('FR-DS-11: R224 (D-1229) leaves every list `{}`, the controls’ and the brackets’, in every lane', () => {
    for (const list of [...lists, ...laneLists('brackets')]) expect(list.entries, list.path).toEqual({});
  });

  describe('what it matches and what the ratchet does with it', () => {
    const PATH = 'src/ui/X.tsx';
    const count = (tsx: string, path = PATH): number => controls(path, tsx).length;

    it('counts a button, a link and an input, in each form of the tag', () => {
      expect(count('const x = <p><button>a</button><button type="button">b</button><a\n href="#x">c</a><input/><input value="1" /></p>;')).toBe(5);
    });

    it('never counts <abbr>, <aside>, <article>, a component, a comment or a string', () => {
      expect(count('const x = <><abbr>a</abbr><aside /><article>b</article><TextButton /><Field /></>;\n// <button>\nconst s = "<a href>";')).toBe(0);
    });

    it('never counts the primitives’ own', () => {
      expect(count('const x = <button />;', `${PRIMITIVES_DIR}/Close.tsx`)).toBe(0);
    });

    it('fails on a raised count and passes on a lowered one', () => {
      const allowed: LaneList[] = [{ path: 'ui.controls.json', entries: { [PATH]: { count: 2, reason: 'fixture' } } }];
      const judged = (tsx: string): string[] => overCount(new Map([[PATH, controls(PATH, tsx)]]), allowed);
      expect(judged('const x = <><button /><button /><a /></>;')).toEqual([expect.stringContaining('3, over the 2')]);
      expect(judged('const x = <><button /><button /></>;')).toEqual([]);
      expect(judged('const x = <><button /></>;')).toEqual([]);
      expect(judged('const x = null;')).toEqual([]);
    });

    it('fails on a control in a file no list names', () => {
      expect(overCount(new Map([[PATH, controls(PATH, 'const x = <button />;')]]), [])).toEqual([expect.stringContaining('1, over the 0')]);
    });
  });
});
