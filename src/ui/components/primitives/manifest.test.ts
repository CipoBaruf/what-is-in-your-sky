/**
 * R104 (FR-DS-4, FR-DS-6; D-703): the manifest is the join between the
 * directory, the guide and the dev page, so it is held to the files: every
 * component in `primitives/` has a row and every row names a component that
 * exists, exports a function of its name and a `<Name>Props` type, and has one
 * module beside it. The props' names are a type-level check in `manifest.ts`
 * itself (`Docs<P>`); here each row's sentences are checked for being there.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRIMITIVES } from './manifest';

const DIR = 'src/ui/components/primitives';
const components = readdirSync(DIR).filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'));

describe('the primitives manifest (D-703)', () => {
  it('has a row for every component in the directory, and a component for every row', () => {
    expect([...PRIMITIVES.map((entry) => entry.file)].sort()).toEqual([...components].sort());
    for (const entry of PRIMITIVES) expect(entry.file).toBe(`${entry.name}.tsx`);
  });

  it.each(PRIMITIVES.map((entry) => [entry.name, entry] as const))('%s: one .tsx exporting the component and its Props, one .module.css, one test', (name, entry) => {
    const source = readFileSync(join(DIR, entry.file), 'utf8');
    expect(source).toMatch(new RegExp(`export function ${name}\\b`));
    expect(source).toMatch(new RegExp(`export (interface|type) ${name}Props\\b`));
    expect(existsSync(join(DIR, `${name}.module.css`))).toBe(true);
    expect(existsSync(join(DIR, `${name}.test.tsx`))).toBe(true);
    expect(source).toContain(`./${name}.module.css`);
  });

  it.each(PRIMITIVES.map((entry) => [entry.name, entry] as const))('%s: one sentence on when it is the right one, and one per prop', (_name, entry) => {
    expect(entry.when).toMatch(/\.$/);
    expect(entry.when).not.toContain('\n');
    expect(entry.props.length).toBeGreaterThan(0);
    for (const prop of entry.props) {
      expect(prop.name).toMatch(/^[a-zA-Z]+$/);
      expect(prop.type.trim()).not.toBe('');
      expect(prop.text).toMatch(/\.$/);
    }
    expect(new Set(entry.props.map((prop) => prop.name)).size).toBe(entry.props.length);
  });

  it('writes the brackets in TextButton and BracketLink and nowhere else in the directory', () => {
    const withBrackets = readdirSync(DIR)
      .filter((file) => file.endsWith('.css'))
      .filter((file) => /content:\s*'\[ '/.test(readFileSync(join(DIR, file), 'utf8')));
    expect(withBrackets.sort()).toEqual(['BracketLink.module.css', 'TextButton.module.css']);
  });
});
