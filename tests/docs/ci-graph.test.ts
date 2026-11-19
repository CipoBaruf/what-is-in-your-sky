/**
 * v2.16 (FR-CI-6, FR-CI-2 as amended; FR-CI-4 when R205 adds `ci.yml`'s half): the workflows' job graph, read as text
 * like `ci.test.ts` (the repository has no YAML parser). Each job is the block under its two-space key in `jobs:`.
 * What this cannot check is the wall time: that is each job's `timeout-minutes` on the runner.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(path, 'utf8');

/** A workflow's jobs by name, each its block of text up to the next job. */
function jobsOf(workflow: string): Record<string, string> {
  const body = workflow.slice(workflow.indexOf('\njobs:\n'));
  const jobs: Record<string, string> = {};
  for (const match of body.matchAll(/^ {2}([\w-]+):\n((?: {4}.*\n|\s*\n)*)/gm)) jobs[match[1] ?? ''] = match[2] ?? '';
  return jobs;
}

/** The number a workflow's top-level `env` gives `name`. */
const constant = (workflow: string, name: string): number => Number(new RegExp(`^ {2}${name}: (\\d+)$`, 'm').exec(workflow)?.[1]);

describe('captures.yml shoots on four runners and gathers once (FR-CI-6, D-1214)', () => {
  const captures = read('.github/workflows/captures.yml');
  const jobs = jobsOf(captures);
  const shards = constant(captures, 'CAPTURE_SHARDS');
  const budget = constant(captures, 'CAPTURES_BUDGET_MIN');

  it('FR-CI-6: the shard count and the budget are the spec\'s, written down as constants', () => {
    expect(shards).toBe(4);
    expect(budget).toBe(20);
  });

  it('has the three jobs, and the one-job `captures` is gone', () => {
    expect(Object.keys(jobs)).toEqual(['pick', 'shoot', 'gather']);
  });

  it('FR-CI-6: `shoot` is a matrix of CAPTURE_SHARDS shards, each running its share of v1-captures and uploading it', () => {
    const shoot = jobs['shoot'] ?? '';
    const matrix = /matrix:\n\s+shard: \[([^\]]+)\]/.exec(shoot)?.[1];
    expect(matrix?.split(',').map((n) => Number(n.trim()))).toEqual(Array.from({ length: shards }, (_, i) => i + 1));
    expect(shoot).toContain('fail-fast: false');
    expect(shoot).toContain('needs: pick');
    expect(shoot).toContain('npx playwright test v1-captures --reporter=list --shard=${{ matrix.shard }}/$CAPTURE_SHARDS');
    expect(shoot).toMatch(/CAPTURES: '1'/);
    expect(shoot).toContain('name: v1-captures-shard-${{ matrix.shard }}');
    // A shard shoots; it never checks, diffs or commits.
    expect(shoot).not.toContain('captures.test.ts');
    expect(shoot).not.toContain('git push');
  });

  it('FR-CI-6, FR-CI-2: `gather` needs every shard, takes their files over the restored set, then checks, diffs and commits', () => {
    const gather = jobs['gather'] ?? '';
    expect(gather).toContain('needs: [pick, shoot]');
    expect(gather).toContain('contents: write');
    const order = [
      'restore the set from the captures branch',
      'clear the files this run shoots',
      'pattern: v1-captures-shard-*',
      'every shard passed',
      'npm run design:captures',
      'npx vitest run tests/docs/captures.test.ts',
      'npx tsx scripts/captures/diff.ts base set',
      'git push',
    ].map((step) => gather.indexOf(step));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(gather).toContain('merge-multiple: true');
    // A failed shard still gets its diff and summary; the step after the download fails the job then.
    expect(gather).toMatch(/if: always\(\) && needs\.pick\.outputs\.captures != 'none'/);
    expect(gather).toContain('[ "$SHOOT" = success ]');
  });

  it('FR-CI-6: every job that shoots or gathers carries the budget as its timeout', () => {
    for (const name of ['shoot', 'gather']) expect(jobs[name]).toMatch(new RegExp(`^ {4}timeout-minutes: ${String(budget)}$`, 'm'));
    expect(Number(/^ {4}timeout-minutes: (\d+)$/m.exec(jobs['pick'] ?? '')?.[1])).toBeLessThanOrEqual(budget);
  });
});

describe('the capture routes answer the two questions (FR-CI-6, D-1213)', () => {
  const seeds = read('tests/e2e/captureSeeds.ts');
  const spec = read('tests/e2e/v1-captures.spec.ts');

  it("the seed writes `useFollow.ts`'s FOLLOW_ASKED_KEY for the visit", () => {
    const key = /export const FOLLOW_ASKED_KEY = '([^']+)'/.exec(read('src/ui/components/sky/useFollow.ts'))?.[1];
    expect(key).toBeDefined();
    expect(seeds).toContain(`const FOLLOW_ASKED_KEY = '${key ?? ''}';`);
    expect(seeds).toContain("sessionStorage.setItem(asked, '1');");
  });

  it("the live route answers the first-pass dialog through the seeds' one helper, with `[ stay here ]`'s Esc", () => {
    expect(seeds).toMatch(/export async function stayHere\(page: Page\)[^]*?page\.keyboard\.press\('Escape'\)/);
    expect(spec).toMatch(/import \{[^}]*\bstayHere\b[^}]*\} from '\.\/captureSeeds'/);
    expect(spec).toContain('if (await stayHere(page)) await blurFocus(page);');
  });
});
