/**
 * R139 (FR-FLOW-16, D-886): the capture specs run. A capture spec that waits for an element the pages no longer
 * draw times out under `CAPTURES=1` and nowhere else — the e2e run skips the capture specs — so v2.6's removal of
 * the home's dome (`where-dome`) left the r76 and r84 specs waiting for a test id nothing renders, and nobody
 * noticed until the review (B3). This is the check that would have: every literal test id a capture spec names,
 * in `getByTestId('…')` or a `[data-testid="…"]` selector, is a string some `.tsx` under `src/` (its tests aside)
 * writes — as `data-testid="…"`, a `testId` prop or any other string literal the id is passed through.
 *
 * A unit test and not an e2e one for the same reason as `captures.test.ts`: `npm test` runs on every branch, with
 * no browser and no build.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const E2E_DIR = 'tests/e2e';
const SRC_DIR = 'src';

/** The specs `CAPTURES=1` runs: every `*-captures.spec.ts` and `v1-captures.spec.ts`. */
const captureSpecs = readdirSync(E2E_DIR)
  .filter((file) => file.endsWith('-captures.spec.ts'))
  .sort();

/** Every `.tsx` under `src/` the app is built from (its tests render nothing on a page). */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.tsx') && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

/** The literal test ids a spec names: `getByTestId('…')` and `[data-testid="…"]`, in any quotes, no interpolation. */
export function specTestIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/getByTestId\(\s*(['"`])([^'"`$]+)\1\s*\)/g)) if (match[2]) ids.add(match[2]);
  for (const match of text.matchAll(/\[data-testid=(['"]?)([^'"\]$]+)\1\]/g)) if (match[2]) ids.add(match[2]);
  return [...ids];
}

/**
 * The ids the app builds (`` data-testid={`${testId}-line`} ``, `` data-testid={`${page}-back`} ``), as patterns: each
 * interpolation stands for one id-shaped word, and the literal text around it has to be there.
 */
export function templates(source: string): RegExp[] {
  return Array.from(source.matchAll(/data-testid=\{`([^`]*\$\{[^`]*)`\}/g), (match) => {
    const parts = (match[1] ?? '').split(/\$\{[^}]*\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^${parts.join('[\\w-]+')}$`);
  }).filter((pattern) => pattern.source !== '^[\\w-]+$');
}

/** Whether `id` is a whole string literal in the app's source (`data-testid="id"`, `testId="id"`, `testId: 'id'`) or an id it builds. */
export function rendered(id: string, source: string, built: readonly RegExp[] = templates(source)): boolean {
  return [`"${id}"`, `'${id}'`, `\`${id}\``].some((literal) => source.includes(literal)) || built.some((pattern) => pattern.test(id));
}

const source = sources(SRC_DIR)
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const built = templates(source);

describe('FR-FLOW-16: the capture specs wait for what the pages draw', () => {
  it('finds the capture specs, v1-captures among them', () => {
    expect(captureSpecs).toContain('v1-captures.spec.ts');
    expect(captureSpecs).toContain('r76-captures.spec.ts');
    expect(captureSpecs).toContain('r84-captures.spec.ts');
  });

  it('reads both forms of a test id, and only literal ones', () => {
    const text = `page.getByTestId('home-doors'); page.getByTestId("live-layout"); page.locator('[data-testid="reading-where"] p'); page.getByTestId(\`card-\${id}\`)`;
    expect(specTestIds(text).sort()).toEqual(['home-doors', 'live-layout', 'reading-where']);
    expect(rendered('home-doors', '<nav data-testid="home-doors">')).toBe(true);
    expect(rendered('where-dome', '<div data-testid="where-dome-frame">')).toBe(false);
    const doors = '<span data-testid={`${testId}-line`} /><a data-testid={`${target}-link`} /><b data-testid={`${x}`} />';
    expect(rendered('door-stars-line', doors)).toBe(true);
    expect(rendered('stars-link', doors)).toBe(true);
    // A bare interpolation would match any id, so it matches none.
    expect(rendered('where-dome', doors)).toBe(false);
  });

  for (const spec of captureSpecs) {
    it(`${spec}: every test id it names is rendered by some .tsx under src/`, () => {
      const ids = specTestIds(readFileSync(join(E2E_DIR, spec), 'utf8'));
      expect(ids.filter((id) => !rendered(id, source, built))).toEqual([]);
    });
  }
});
