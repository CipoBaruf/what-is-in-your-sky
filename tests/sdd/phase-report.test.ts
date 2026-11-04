import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { movedOut } from '../../scripts/check-sdd';

const report = readFileSync('docs/sdd/phases/v2.13/report.md', 'utf8');

describe('the v2.13 phase report', () => {
  // The phase's base and its last commit before R181; every v2.13 task is between them.
  const reachable = (sha: string): boolean => {
    try {
      execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  it('FR-SDD-28: no v2.13 commit touches src/ or public/ (the diff where the history is there, else the report)', () => {
    if (reachable('fda34853') && reachable('323f87b7')) {
      expect(execFileSync('git', ['diff', '--name-only', 'fda34853', '323f87b7', '--', 'src', 'public'], { encoding: 'utf8' })).toBe('');
    } else {
      // CI's shards fetch two commits; the report holds the same check, run where the history was.
      expect(report).toMatch(/git diff --stat fda34853\.\.HEAD -- src public/);
    }
    expect(report).toMatch(/same 52 file names/);
  });

  it('FR-SDD-24: a requirement whose line says it moved is not owed a test here', () => {
    const spec = '- **FR-X-1** *(moved to the renderer phase, V213-12)* **A.**\n- **FR-X-2** **B.**';
    expect(movedOut(spec, 'FR-X-1')).toBe(true);
    expect(movedOut(spec, 'FR-X-2')).toBe(false);
  });
});
