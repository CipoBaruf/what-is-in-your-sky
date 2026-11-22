/**
 * v2.16 (FR-CI-6, FR-CI-2 as amended; FR-CI-4, FR-CI-5 and FR-CI-1 as amended for `ci.yml`): the workflows' job graph, read as text
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

describe('ci.yml: the checks that need no build run beside it (FR-CI-4, FR-CI-5, D-1215, D-1216)', () => {
  const ci = read('.github/workflows/ci.yml');
  const jobs = jobsOf(ci);
  const budget = constant(ci, 'CI_PR_BUDGET_MIN');
  const unitShards = constant(ci, 'CI_UNIT_SHARDS');
  const e2eShards = constant(ci, 'CI_E2E_SHARDS');
  const needs = (job: string): string[] => {
    const match = /^ {4}needs: (?:\[([^\]]*)\]|(\S+))$/m.exec(jobs[job] ?? '');
    return (match?.[1] ?? match?.[2] ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  };
  const stages = (job: string): string[] => [...(jobs[job] ?? '').matchAll(/stage\.sh (\w+) /g)].map((match) => match[1] ?? '');
  const matrix = (job: string): number[] | undefined =>
    /matrix:\n\s+shard: \[([^\]]+)\]/
      .exec(jobs[job] ?? '')?.[1]
      ?.split(',')
      .map((n) => Number(n.trim()));

  it("FR-CI-1, FR-CI-4, FR-CI-5: the budget, the shard counts and the spread are the spec's constants", () => {
    expect(budget).toBe(8);
    expect(constant(ci, 'CI_E2E_TIMEOUT_MIN')).toBe(10);
    expect(unitShards).toBe(2);
    expect(e2eShards).toBe(6);
    expect(constant(ci, 'CI_SHARD_SPREAD_S')).toBe(60);
  });

  it('FR-CI-4: `static` and `unit` need `changes` and not `build`', () => {
    for (const job of ['static', 'unit']) expect(needs(job), job).toEqual(['changes']);
    expect(needs('ci')).toEqual(['changes', 'build']);
  });

  it('FR-CI-4: `static` typechecks and lints on every pull request, `unit` runs the unit suite in CI_UNIT_SHARDS shards', () => {
    expect(stages('static')).toEqual(['install', 'typecheck', 'lint']);
    expect(jobs['static']).toMatch(/^ {4}if: \$\{\{ !cancelled\(\) \}\}$/m);
    expect(stages('unit')).toEqual(['install', 'browsers', 'unit']);
    expect(matrix('unit')).toEqual(Array.from({ length: unitShards }, (_, i) => i + 1));
    expect(jobs['unit']).toContain('fail-fast: false');
    expect(jobs['unit']).toContain('npm test -- --shard=${{ matrix.shard }}/${{ strategy.job-total }} $json');
    // FR-CI-1's selection holds: a partial one is `vitest related`, on one shard.
    expect(jobs['unit']).toContain('npx vitest related --run --passWithNoTests $json $UNIT_FILES');
    expect(jobs['unit']).toContain("RUNS: ${{ matrix.shard == 1 || needs.changes.outputs.unit == 'all' }}");
  });

  it('FR-CI-4: the e2e shards run no typecheck, lint or unit stage', () => {
    expect(stages('ci')).toEqual(['install', 'browsers', 'e2e']);
    const code = (jobs['ci'] ?? '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    for (const word of ['typecheck', 'eslint', 'vitest', 'npm test']) expect(code, word).not.toContain(word);
    expect(matrix('ci')).toEqual(Array.from({ length: e2eShards }, (_, i) => i + 1));
  });

  it("FR-CI-5: a shard runs `e2e-shards.ts`'s cut of the specs, not Playwright's `--shard`, and an empty cut starts no Playwright", () => {
    const shard = jobs['ci'] ?? '';
    expect(shard).not.toContain('--shard=');
    expect(shard).toContain('specs=$(npx tsx scripts/e2e-shards.ts ${{ matrix.shard }} ${{ strategy.job-total }} $E2E_SPECS)');
    expect(shard.indexOf('if [ -z "$specs" ]; then')).toBeGreaterThan(0);
    expect(shard.indexOf('if [ -z "$specs" ]; then')).toBeLessThan(shard.indexOf('stage.sh e2e npx playwright test'));
    expect(shard).toContain('npx playwright test --pass-with-no-tests --reporter=list,github,html,json $specs');
    // The refresh's input: every shard's JSON report on a full run.
    expect(shard).toContain('name: e2e-report-shard-${{ matrix.shard }}');
    expect((JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts['e2e:durations']).toBe('tsx scripts/e2e-shards.ts --durations');
  });

  it('D-1215, D-1067: each new job leaves its report for `digest`, which waits on it', () => {
    expect(jobs['static']).toContain('reports/typecheck.txt');
    expect(jobs['static']).toContain('reports/eslint.json');
    expect(jobs['static']).toContain('name: reports-static');
    expect(jobs['unit']).toContain('--outputFile.json=reports/vitest-${{ matrix.shard }}.json');
    expect(jobs['unit']).toContain('name: reports-unit-${{ matrix.shard }}');
    expect(needs('digest')).toEqual(expect.arrayContaining(['static', 'unit', 'ci']));
  });

  it('FR-CI-1, D-1313: no job waits past the budget but the e2e shard, which carries its own timeout; every other stage job carries the budget', () => {
    const e2eTimeout = constant(ci, 'CI_E2E_TIMEOUT_MIN');
    for (const [name, job] of Object.entries(jobs)) {
      const limit = name === 'ci' ? e2eTimeout : budget;
      expect(Number(/^ {4}timeout-minutes: (\d+)$/m.exec(job)?.[1]), name).toBeLessThanOrEqual(limit);
      if (job.includes('stage.sh ')) expect(job, name).toMatch(new RegExp(`^ {4}timeout-minutes: ${String(limit)}$`, 'm'));
    }
  });
});
