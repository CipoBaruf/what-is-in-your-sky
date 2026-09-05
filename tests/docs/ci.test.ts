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

  it('times every stage and writes the table to the job summary', () => {
    // Each stage goes through `stage.sh`, which records name, seconds and exit status…
    const stages = [...ci.matchAll(/stage\.sh (\w+) /g)].map((match) => match[1]);
    expect(stages).toEqual(['install', 'typecheck', 'lint', 'browsers', 'unit', 'build', 'bundle', 'e2e']);
    expect(read('.github/workflows/stage.sh')).toContain('date +%s');
    // …and the summary step reads them back, on a failed run as well as a passing one.
    expect(ci).toContain('$GITHUB_STEP_SUMMARY');
    expect(ci).toMatch(/name: stage times\n\s+if: always\(\)/);
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

  it('runs on a push to main and on demand, uploads the set, and commits nothing', () => {
    expect(captures).toMatch(/on:\n\s+push:\n\s+branches: \[main\]\n\s+workflow_dispatch:/);
    expect(captures).toContain('path: docs/screenshots/v1-*.png');
    // Incomplete is a failure: the committed files are cleared first, so the check is about this run.
    expect(captures).toContain("find docs/screenshots -name 'v1-*.png' -delete");
    expect(captures).toContain('npx vitest run tests/docs/captures.test.ts');
    expect(captures).not.toMatch(/git (commit|push)/);
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
    expect(captureSpec).toContain('async function pinnedAt(page: Page, t: number)');
    expect([...captureSpec.matchAll(/await pinnedAt\(page, SHOWN\)/g)]).toHaveLength(2);
    expect(captureSpec).not.toContain('await page.clock.setSystemTime(SHOWN - TICK_MS)');
  });

  it('F-49: the seeded observers are ones the app produces — coordinates, no zone', () => {
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
