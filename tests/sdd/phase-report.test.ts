import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { movedOut } from '../../scripts/check-sdd';

const report = readFileSync('docs/sdd/phases/v2.13/report.md', 'utf8');

describe('the v2.13 phase report', () => {
  it('FR-SDD-28: records the empty src/ and public/ diff and the dist/ comparison', () => {
    expect(report).toMatch(/git diff --stat fda34853\.\.HEAD -- src public/);
    expect(report).toMatch(/same 52 file names/);
  });

  it('FR-SDD-24: a requirement whose line says it moved is not owed a test here', () => {
    const spec = '- **FR-X-1** *(moved to the renderer phase, V213-12)* **A.**\n- **FR-X-2** **B.**';
    expect(movedOut(spec, 'FR-X-1')).toBe(true);
    expect(movedOut(spec, 'FR-X-2')).toBe(false);
  });
});
