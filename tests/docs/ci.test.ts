/**
 * R37 (FR-CI-1, FR-CI-2, FR-CI-3, and the R36 findings F-46 … F-49).
 *
 * "A pull request's CI finishes inside ten minutes" is a claim about two
 * workflow files and a Playwright config, so — like `captures.test.ts`, which
 * checks a claim about a directory against the directory — it is checked
 * against the files. The workflows are read as text on purpose: the repository
 * has no YAML parser, and every claim here is about a line a person would
 * grep for anyway.
 *
 * What these cannot check is the wall time itself. That is `timeout-minutes`
 * doing it on the runner, and the stage table in the job summary saying where
 * it went.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { observerFromCoords } from '../../src/lib/place';
import { storedObserverSchema } from '../../src/data/schemas';
import { NEUQUEN, PARIS } from '../e2e/observers';
import { gatedSpecs } from '../../playwright.config';

const read = (path: string): string => readFileSync(path, 'utf8');
const ci = read('.github/workflows/ci.yml');
const captures = read('.github/workflows/captures.yml');
const captureSpec = read('tests/e2e/v1-captures.spec.ts');
const playwrightConfig = read('playwright.config.ts');

describe('the pull-request budget (FR-CI-1)', () => {
  it('is the CI job timeout, and the number is written down as a constant', () => {
    expect(ci).toMatch(/^\s*timeout-minutes: 10$/m);
    expect(ci).toMatch(/CI_PR_BUDGET_MIN: 10/);
    expect(ci).toContain('FR-CI-1');
  });

  /** D-526 (FR-CI-1 as amended v2.0.3, V20-24): the wait is the slowest shard, and the count is a constant like the budget. */
  it('splits the e2e stage across the shards the constant names, each under the budget', () => {
    const shards = Number(/CI_E2E_SHARDS: (\d+)/.exec(ci)?.[1]);
    expect(shards).toBeGreaterThan(1);
    // The matrix is that number written out, and the e2e stage is the only sharded one.
    const matrix = /matrix:\n\s+shard: \[([^\]]+)\]/.exec(ci)?.[1];
    expect(matrix?.split(',').map((n) => n.trim())).toEqual(Array.from({ length: shards }, (_, i) => String(i + 1)));
    expect(ci).toContain('--shard=${{ matrix.shard }}/${{ strategy.job-total }}');
    // One shard over the budget still fails the run: the timeout is the job's, and the matrix multiplies the job.
    expect(ci).toMatch(/^\s*timeout-minutes: 10$/m);
    // A red shard must not cancel its sibling and hide half the failures.
    expect(ci).toMatch(/fail-fast: false/);
    // Two shards would otherwise upload one artefact name twice, and the second would be refused.
    expect(ci).toContain('name: playwright-report-shard-${{ matrix.shard }}');
  });

  it('times every stage and writes the table to the job summary', () => {
    // Each stage goes through `stage.sh`, which records name, seconds and exit status…
    // D-1067: the `build` job's three stages, then the shards' six.
    const stages = [...ci.matchAll(/stage\.sh (\w+) /g)].map((match) => match[1]);
    expect(stages).toEqual(['install', 'build', 'bundle', 'install', 'typecheck', 'lint', 'browsers', 'unit', 'e2e']);
    expect(read('.github/workflows/stage.sh')).toContain('date +%s');
    // …and the summary step reads them back, on a failed run as well as a passing one, in both jobs.
    expect(read('.github/workflows/stage-summary.sh')).toContain('GITHUB_STEP_SUMMARY');
    expect([...ci.matchAll(/name: stage times\n\s+if: always\(\)\n\s+run: bash \.github\/workflows\/stage-summary\.sh /g)]).toHaveLength(2);
  });
});

/** D-836: Playwright sizes shards by test count, skipped tests included, so a spec that skips whole on CI is left out of the run instead. */
describe('the shards share tests that run (FR-CI-1, D-836)', () => {
  it('leaves out a spec only when the variable its first-level skip waits for is unset', () => {
    const unset = gatedSpecs('tests/e2e', {});
    expect(unset).toContain('v1-captures.spec.ts');
    expect(unset).toContain('dome-perf.spec.ts');
    // Captures that run on every pull request are not gated, so they stay in.
    expect(unset).not.toContain('r57-captures.spec.ts');
    expect(unset).not.toContain('r77-captures.spec.ts');
    expect(gatedSpecs('tests/e2e', { CAPTURES: '1' })).not.toContain('v1-captures.spec.ts');
    expect(gatedSpecs('tests/e2e', { DOME_PERF: '1' })).not.toContain('dome-perf.spec.ts');
    expect(gatedSpecs('tests/e2e', { CAPTURES: '1', DOME_PERF: '1' })).toEqual([]);
  });

  it('every spec it leaves out skips every test without its variable', () => {
    for (const file of gatedSpecs('tests/e2e', {})) expect(read(`tests/e2e/${file}`)).toMatch(/^test\.skip\(process\.env\['(CAPTURES|DOME_PERF)'\] !== '1'/m);
  });
});

describe('the capture set off the pull-request path (FR-CI-2, F-46)', () => {
  it('F-46: the capture spec is skipped unless CAPTURES=1', () => {
    expect(captureSpec).toMatch(/test\.skip\(process\.env\['CAPTURES'\] !== '1'/);
  });

  it('F-46: captures.yml is the only workflow that sets CAPTURES, so the PR job skips the sixty tests', () => {
    // The flag is unset in the PR job, which is what `test.skip` above reads; the comment naming
    // the other workflow is welcome, an `env:` entry would not be.
    expect(ci).not.toMatch(/^\s*CAPTURES:/m);
    expect(captures).toMatch(/CAPTURES: '1'/);
    expect(captures).toContain('npx playwright test v1-captures');
  });

  it('runs on a push to main and on demand, uploads the set, and commits only to the captures branch (FR-SDD-22)', () => {
    expect(captures).toMatch(/on:\n\s+push:\n\s+branches: \[main\]\n\s+workflow_dispatch:/);
    expect(captures).toContain('path: docs/screenshots/v1-*.png');
    // Incomplete is a failure: the files this run shoots are cleared first, so the check is about this run.
    expect(captures).toContain("find docs/screenshots -maxdepth 1 -name 'v1-*.png' -delete");
    expect(captures).toContain('npx vitest run tests/docs/captures.test.ts');
    // R178 (D-1068): the manifest picks the screens, and no screen is no capture job.
    expect(captures).toContain('node scripts/ci-affected.ts --captures');
    expect(captures).toContain("if: needs.pick.outputs.captures != 'none'");
    // The one push is to the orphan branch, from `main` only; nothing is committed to the checked-out ref.
    const pushes = [...captures.matchAll(/git push(?: --force)? (\S+ \S+?);?(?=\s)/g)].map((match) => match[1]);
    expect(pushes.length).toBeGreaterThan(0);
    expect(pushes.every((target) => target === 'origin captures')).toBe(true);
    expect(captures).toContain("if: github.ref == 'refs/heads/main'");
    // FR-SDD-23: the pixel diff writes the side-by-side images and the job summary shows them.
    expect(captures).toContain('npx tsx scripts/captures/diff.ts base set --out sides');
    expect(captures).toContain('GITHUB_STEP_SUMMARY');
  });
});

describe('the e2e suite on a pull request (FR-CI-3)', () => {
  it('runs one worker per core on CI, with the durations the 60 s rule is read from', () => {
    expect(playwrightConfig).toMatch(/workers: '100%'/);
    expect(playwrightConfig).toMatch(/reporter: process\.env\['CI'\] \? \[\['list'\]/);
    // A driver session never adopts another worktree's preview server (D-132), CI least of all.
    expect(playwrightConfig).toContain("reuseExistingServer: !process.env['CI']");
  });

  it('gives page specs a stored run instead of a 72 h search', () => {
    const helpers = read('tests/e2e/liveHelpers.ts');
    expect(helpers).toContain('export async function seedStoredRun');
    // The seeded run is computed, not written by hand, so the recompute behind it finds the same passes.
    const run = JSON.parse(read('tests/fixtures/stored-run-neuquen.json')) as { passes: unknown[]; observer: unknown; cellKey: string };
    expect(run.passes.length).toBeGreaterThan(10);
    expect(run.observer).toEqual(NEUQUEN);
    expect(run.cellKey).toBe('-38.93,-67.99');
    // The specs whose subject is the rendered page, not the search, open on it: the seed is there
    // and the coordinates are no longer typed in to make a list appear.
    for (const spec of ['shortcuts', 'desktop', 'pass-detail', 'language']) {
      const source = read(`tests/e2e/${spec}.spec.ts`);
      expect(source, spec).toContain('seedStoredRun');
      expect(source, spec).not.toMatch(/(Coordinates|Coordenadas) \(lat, lon\)'\)\s*\.fill\(/);
    }
  });
});

describe('the R36 capture findings (FR-FIX-2)', () => {
  it('F-47: the capture spec takes the live helpers rather than copying them', () => {
    expect(captureSpec).toMatch(/import \{[^}]*domeDrawn[^}]*stripFilled[^}]*\} from '\.\/liveHelpers'/);
    expect(captureSpec).not.toMatch(/(async )?function (domeDrawn|stripFilled)/);
  });

  it('F-48: the live capture is pinned to the shown instant after the drawing waits', () => {
    // `domeDrawn` ticks the paused clock until the chart is up, and where it stops is a property of
    // the run. Both chart routes end on `pinnedAt`, so two runs of the same file shoot the same frame.
    // P4 (D-653): the helper lives in `captureSeeds.ts`, shared with the recording run, and the spec imports it.
    expect(read('tests/e2e/captureSeeds.ts')).toContain('export async function pinnedAt(page: Page, t: number)');
    expect(captureSpec).toMatch(/import \{[^}]*pinnedAt[^}]*\} from '\.\/captureSeeds'/);
    // R79: `liveAt` pins to its `shown` parameter, `SHOWN` unless the chip capture asks for its own instant.
    // R128 (FR-SKY-9): four more — the window laid out in the box, the stars page with `[ passes ]`, the window
    // following the pass and the screen from the stars page each put the instant back on `SHOWN` after their waits.
    // R135 (R136's hold-up): the pass detail's sky screen is put back on `SHOWN` before `[ hold up to the sky ]`,
    // since the wait for the control ticked the clock 2.5.0's route did not.
    // R149 (FR-FULL-9, D-937): the sheet's two screens put it back on `SHOWN` after opening the sheet and the list.
    // R152 (FR-GYRO-6, D-958): the pass detail's sky screen and the stars page's screen with `[ passes ]` are retired,
    // and the two waits that were theirs went with their routes.
    // R153 (FR-GYRO-9): the live page following puts it back on `SHOWN` after the window has settled on the reading.
    // R161 (FR-PHONE-16, D-993): the whole sky with `[ passes ]` puts it back on `SHOWN` after the polar chart's wait.
    expect([...captureSpec.matchAll(/await pinnedAt\(page, (SHOWN|shown)\)/g)]).toHaveLength(8);
    expect(captureSpec).toContain('shown: number = SHOWN');
    expect(captureSpec).not.toContain('await page.clock.setSystemTime(SHOWN - TICK_MS)');
  });

  it('F-49: the coordinate observers the suite seeds are ones the app produces — no zone, no altitude', () => {
    // The capture set's observer is Bariloche since P8, a geocoder pick with its zone, which
    // `tests/docs/showcase.test.ts` holds to `observerFromPlace`; this is the coordinate half.
    for (const observer of [PARIS, NEUQUEN]) {
      expect(observer).toEqual(observerFromCoords(observer.lat, observer.lon));
      expect(observer.source).toBe('coords');
      expect(observer.timeZone).toBeNull();
      expect(observer.altM).toBe(0);
      // And it is a shape the store would accept back (`data/schemas.ts`).
      expect(storedObserverSchema.safeParse(observer).success).toBe(true);
    }
    expect(captureSpec).not.toMatch(/timeZone: '/);
  });
});

/** D-1031 (FR-CI-1 as amended 2026-11-02): a pull request runs the tests its change reaches; `main` runs them all. */
describe('the tests a change reaches (D-1031)', () => {
  it('selects from the merge commit against its first parent, and runs everything on main or under `full-ci`', () => {
    expect(ci).toMatch(/fetch-depth: 2/);
    expect(ci).toContain('node scripts/ci-affected.ts HEAD^1');
    expect(ci).toContain("github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'full-ci')");
    expect(ci).toContain('node scripts/ci-affected.ts --all');
    expect(ci).toMatch(/types: \[opened, synchronize, reopened, labeled\]/);
  });

  it('hands the selection to Vitest and Playwright, and an empty shard passes', () => {
    expect(ci).toContain('npx vitest related --run --passWithNoTests $json $UNIT_FILES');
    expect(ci).toContain('--pass-with-no-tests --reporter=list,github,html,json $E2E_SPECS');
    // D-1067: the `changes` job selects once and hands the selection on as its outputs.
    expect(ci).toContain('e2e: ${{ steps.affected.outputs.e2e }}');
    // The build job and the e2e stage wait for an e2e selection, and the unit tests run once, on shard 1.
    expect(ci).toMatch(/ {2}build:\n\s+needs: changes\n\s+if: needs\.changes\.outputs\.e2e != 'none'\n/);
    expect(ci).toMatch(/if: env\.HAS_DIST == 'true'\n(\s+\S.*\n){0,4}\s+run: bash \.github\/workflows\/stage\.sh e2e /);
    expect(ci).toMatch(/if: matrix\.shard == 1 && needs\.changes\.outputs\.unit != 'none'/);
  });

  it('keeps the whole-program checks on every pull request', () => {
    expect(ci).toMatch(/^ {2}trailers:$/m);
    expect(ci).toMatch(/^ {2}dead-code:$/m);
    expect(ci).toMatch(/if: matrix\.shard == 1\n\s+run: bash \.github\/workflows\/stage\.sh typecheck /);
    expect(ci).toMatch(/if: matrix\.shard == 1\n\s+run: bash \.github\/workflows\/stage\.sh lint /);
  });
});

/** D-1067 (FR-SDD-16, FR-SDD-25): CI does less, and a failure leaves a digest. */
describe('FR-SDD-25: CI does less (D-1067)', () => {
  const job = (name: string): string => {
    const start = ci.indexOf(`\n  ${name}:\n`);
    const next = ci.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
    return ci.slice(start, next < 0 ? undefined : start + 1 + next);
  };

  it('cancels a superseded pull-request run, and never a run on main', () => {
    expect(ci).toContain("group: ci-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}");
    expect(ci).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it('builds dist/ once and the shards download it', () => {
    const build = job('build');
    expect(build).toContain('npm run build');
    expect(build).toMatch(/upload-artifact@v\d+\n\s+with:\n\s+name: dist\n\s+path: dist\//);
    const shards = job('ci');
    expect(shards).toMatch(/needs: \[changes, build\]/);
    expect(shards).toMatch(/download-artifact@v\d+\n\s+with:\n\s+name: dist\n\s+path: dist/);
    expect(shards).not.toContain('npm run build');
  });

  it('caches the browsers on the locked Playwright version', () => {
    const shards = job('ci');
    expect(shards).toContain("require('./package-lock.json').packages['node_modules/playwright'].version");
    expect(shards).toContain('path: ~/.cache/ms-playwright');
    expect(shards).toContain('key: playwright-${{ runner.os }}-${{ steps.playwright.outputs.version }}');
    expect(shards).toContain('npx playwright install-deps chromium');
  });

  it('works out docs_only and tests_only with a plain git diff', () => {
    const changes = job('changes');
    expect(changes).toContain('git diff --name-only HEAD^1 HEAD');
    expect(changes).toContain('docs_only: ${{ steps.kind.outputs.docs_only }}');
    expect(changes).toContain('tests_only: ${{ steps.kind.outputs.tests_only }}');
    // No third-party action: only GitHub's own.
    for (const [, action] of ci.matchAll(/uses: ([^@\s]+)@/g)) expect(action).toMatch(/^actions\//);
    // A docs-only change skips the dead-code job; the trailers job always runs.
    expect(job('dead-code')).toContain("if: ${{ !cancelled() && needs.changes.outputs.docs_only != 'true' }}");
    expect(job('trailers')).not.toMatch(/^ {4}if:/m);
  });

  it('writes the failure digest when anything failed, from the reports every job leaves', () => {
    const digest = job('digest');
    expect(digest).toContain('needs: [changes, build, ci, trailers, dead-code]');
    expect(digest).toMatch(/if: failure\(\)/);
    expect(digest).toContain('node scripts/ci-digest.ts reports failure-digest.md');
    expect(digest).toContain('NEEDS: ${{ toJSON(needs) }}');
    expect(digest).toContain('name: failure-digest');
    for (const report of ['reports/typecheck.txt', 'reports/eslint.json', 'reports/vitest.json', 'reports/playwright-${{ matrix.shard }}.json', 'reports/build.txt', 'reports/trailers.txt', 'reports/dead-code.txt']) {
      expect(ci, report).toContain(report);
    }
  });
});
