/**
 * R226 (D-1244, FR-LAND-1/3/4, FR-STRIP-1/5, FR-DARK-4, FR-CTRL-14): the documents outside the history
 * no longer describe what 3.0 removed — the `#stars` route, the home's bracketed controls, the sun glow,
 * the `Next up` block. A listed string in a swept file fails. History (decisions, revision history, the
 * phase folders, release records) is exempt; so is a line that says the string is gone (`removed`, `folded`).
 * It cannot tell a stale sentence from a new one that names the old word; the exemption is the marker.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

export const STALE: readonly string[] = ['#stars', '[ home ]', '[ set your place ]', 'sunGlow', 'Next up', 'v1-home', 'r12-home'];
/** `Next up` is still the rail head's label in the catalog (R226 assumption); it is swept in the documents only. */
const DOCS_ONLY = ['Next up'];
const EXEMPT_LINE = /\b(removed|folded|dropped|ignored|gone|retired|lands? as|is `#live)/i;

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((p) => p !== '');

/** Swept: the root documents, the pages under docs/ and the catalogs; not history. */
export function isSwept(path: string): boolean {
  if (path === 'README.md') return true;
  if (path.startsWith('src/i18n/') && /\.ts$/.test(path) && !/\.test\./.test(path)) return true;
  if (!path.startsWith('docs/') || !path.endsWith('.md')) return false;
  if (/^docs\/(sdd\/phases|sdd\/archive|proposals|mockups|spike|stars|window|dome-composition|readme|screenshots)\//.test(path)) return false;
  if (/^docs\/sdd\/(decisions|revision-history)\.md$|revision-history\.md$|release[^/]*\.md$/.test(path)) return false;
  return !/^docs\/sdd\/reference\/(traceability|breakdown-inputs)\.md$/.test(path);
}

/** The swept lines that carry a listed string. */
export function staleHits(files: readonly string[], read: (p: string) => string): string[] {
  const hits: string[] = [];
  for (const file of files) {
    read(file).split('\n').forEach((line, i) => {
      if (STALE.some((s) => line.includes(s) && !(file.startsWith('src/') && DOCS_ONLY.includes(s))) && !EXEMPT_LINE.test(line)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  return hits;
}

describe('D-1244: the swept documents describe 3.0', () => {
  const files = tracked.filter(isSwept);
  it('sweeps the root documents, the pages and the catalogs', () => {
    expect(files).toEqual(expect.arrayContaining(['README.md', 'docs/DESIGN.md', 'docs/sdd/map.md', 'src/i18n/en/ui.ts']));
    expect(files).not.toContain('docs/sdd/decisions.md');
  });
  it('names no removed route, control or capture', () => {
    expect(staleHits(files, (p) => readFileSync(p, 'utf8'))).toEqual([]);
  });
  it('fails on a planted `#stars`', () => {
    expect(staleHits(['x.md'], () => 'open the page at #stars?lat=1')).toHaveLength(1);
  });
});
