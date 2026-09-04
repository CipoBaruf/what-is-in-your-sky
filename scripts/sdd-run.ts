/**
 * PLAN §16: the v1 task driver. It reads TASKS.md from `origin/main`, works
 * out which tasks are ready, and runs a wave of them — one headless
 * `claude -p` session per task in its own worktree, then rebase, push, PR,
 * CI, review and (for `Gate: auto`) merge.
 *
 *   npm run sdd -- --status          # merged / ready / blocked / failed
 *   npm run sdd -- --dry-run         # print exactly what would run, and stop
 *   npm run sdd -- --wave            # run the current wave (<= 1 per lane, <= 3 at once, concurrently)
 *   npm run sdd -- --task R17        # run one task, dependencies checked
 *   npm run sdd -- --task R22 --model opus   # the same, on another model than TASKS.md says
 *
 * It is not a scheduler or a service (§16.7): it is a script the owner runs
 * in the foreground, with no state of its own. `origin/main`, the branches
 * and the PRs are the state, so an interrupted run needs no reconciling.
 * D-86 makes it repo tooling rather than a task in TASKS.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { helpText, parseArgs, type Options } from './sdd/cli';
import { modelFor, parseTasks, type Task } from './sdd/tasks';
import { addWorktree, changedFiles, commentOnPullRequest, commitsAhead, createPullRequest, fetchOrigin, installDeps, labelPullRequest, mergePullRequest, openPullRequests, push, readTasksAtRef, rebaseOnto, remoteBranches, removeWorktree, watchChecks } from './sdd/git';
import { consoleLogger, openTaskLog, writeRunReport, type Logger, type RunReport, type TaskReport } from './sdd/report';
import { IMPLEMENT_TOOLS, REVIEW_TOOLS, runSession } from './sdd/session';
import { refusalFor, selectWave, statusOf, type TaskStatus } from './sdd/waves';

const BASE = 'origin/main';
const WORKTREE_ROOT = '../wiys-tasks';
const NPM_CACHE = resolve('.sdd-cache/npm');
const OWNER_LABEL = 'needs-owner';
const IMPLEMENT = { maxTurns: 250, timeoutMs: 45 * 60_000 };
const REVIEW = { maxTurns: 40, timeoutMs: 15 * 60_000, model: 'opus' };
/** D-132: each concurrent task gets its own `vite preview` port, so no session's e2e runs against another's build. `E2E_PORT` in the driver's own environment moves the base, for a `--task` run beside a wave. */
const E2E_BASE_PORT = Number(process.env['E2E_PORT'] ?? 4173);

/**
 * D-132: the tasks of a wave run at the same time, but `git worktree add` and
 * `git worktree remove` write to the shared `.git`, so they are queued here
 * and happen one after another. Everything else a task does is in its own
 * worktree, its own PR, or on the network.
 */
let sharedGit: Promise<unknown> = Promise.resolve();
function withSharedGit<T>(work: () => Promise<T>): Promise<T> {
  const next = sharedGit.then(work, work);
  sharedGit = next.catch(() => undefined);
  return next;
}

/** Everything the wave logic needs, read from the remote. */
async function readFacts(options: Options, logger: Logger): Promise<{ statuses: TaskStatus[]; problems: readonly string[] }> {
  let markdown: string;
  let branches = new Set<string>();
  let prsByBranch = new Map<string, number>();
  if (options.tasksFile) {
    markdown = readFileSync(options.tasksFile, 'utf8');
    logger.line(`TASKS.md from ${options.tasksFile} (remote state ignored)`);
  } else {
    await fetchOrigin(logger);
    markdown = await readTasksAtRef(BASE, logger);
    branches = await remoteBranches(logger);
    prsByBranch = await openPullRequests(logger);
  }
  const { tasks, problems } = parseTasks(markdown);
  const openPrs = new Map<string, number>();
  for (const task of tasks) {
    const pr = prsByBranch.get(task.branch);
    if (pr !== undefined) openPrs.set(task.id, pr);
  }
  return { statuses: statusOf({ tasks, openPrs, remoteBranches: branches }), problems };
}

function printStatus(statuses: readonly TaskStatus[], problems: readonly string[], logger: Logger): void {
  const counts = new Map<string, number>();
  for (const status of statuses) counts.set(status.state, (counts.get(status.state) ?? 0) + 1);
  logger.line(`\n${String(statuses.length)} tasks`);
  for (const state of ['merged', 'in-review', 'ready', 'blocked', 'failed']) logger.line(`  ${state.padEnd(10)} ${String(counts.get(state) ?? 0)}`);
  logger.line('');
  for (const { task, state, missingDeps, blockers, pr } of statuses) {
    const notes = [
      task.lane ? `lane ${task.lane}` : null,
      task.gate ? `gate ${task.gate}` : null,
      state === 'merged' ? null : `model ${modelFor(task)}`,
      missingDeps.length > 0 ? `waiting on ${missingDeps.join(', ')}` : null,
      pr !== null ? `PR #${String(pr)}` : null,
      blockers.length > 0 && state !== 'merged' ? `breakdown bug: ${blockers.join(', ')}` : null,
    ].filter(Boolean);
    logger.line(`  ${task.id.padEnd(4)} ${state.padEnd(10)} ${task.title}${notes.length > 0 ? `  (${notes.join('; ')})` : ''}`);
  }
  if (problems.length > 0) {
    logger.line('\nBreakdown problems:');
    for (const problem of problems) logger.line(`  - ${problem}`);
  }
}

function printPlanned(wave: readonly TaskStatus[], skipped: readonly { task: Task; reason: string }[], logger: Logger): void {
  if (wave.length === 0) logger.line('\nNothing to run: no task is ready.');
  else {
    logger.line('\nWould run:');
    for (const { task } of wave) logger.line(`  ${task.id.padEnd(4)} lane ${String(task.lane).padEnd(8)} model ${modelFor(task).padEnd(6)} gate ${String(task.gate).padEnd(6)} branch ${task.branch}`);
  }
  if (skipped.length > 0) {
    logger.line('\nHeld back:');
    for (const { task, reason } of skipped) logger.line(`  ${task.id.padEnd(4)} ${reason}`);
  }
}

interface Handoff {
  blocked: string | null;
  summary: string | null;
  findings: number | null;
}

/** The files a session leaves for the driver in its worktree (§16.4). */
function readHandoff(dir: string, id: string): Handoff {
  const read = (name: string): string | null => {
    const path = join(dir, 'sdd-run', `${id}.${name}`);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  };
  const review = read('review.json');
  let findings: number | null = null;
  if (review !== null) {
    try {
      findings = (JSON.parse(review) as { findings?: unknown[] }).findings?.length ?? 0;
    } catch {
      findings = null;
    }
  }
  return { blocked: read('blocked.md'), summary: read('summary.md'), findings };
}

function prBody(task: Task, handoff: Handoff, screenshots: readonly string[], logPath: string | null): string {
  const lines = [`Gate: ${String(task.gate)}`, '', handoff.summary?.trim() ?? '_The session left no summary._', ''];
  if (screenshots.length > 0) lines.push('## Captures', ...screenshots.map((path) => `- \`${path}\``), '');
  lines.push(`Driven by \`scripts/sdd-run.ts\` (PLAN §16), model \`${modelFor(task)}\`.`);
  if (logPath) lines.push(`Session log: \`${logPath}\`.`);
  return lines.join('\n');
}

/** §16.4 steps 1–8 for one task. `slot` is its place in the wave: the e2e port and, when the wave has more than one task, the console prefix. */
async function runTask(status: TaskStatus, slot: { index: number; count: number }): Promise<TaskReport> {
  const { task } = status;
  const logger = openTaskLog(task.id, undefined, undefined, { prefixConsole: slot.count > 1 });
  const env = { npm_config_cache: NPM_CACHE, E2E_PORT: String(E2E_BASE_PORT + slot.index) };
  const startedAt = Date.now();
  const dir = join(WORKTREE_ROOT, task.id);
  const report: TaskReport = {
    id: task.id,
    branch: task.branch,
    lane: task.lane,
    model: modelFor(task),
    gate: task.gate,
    pr: null,
    outcome: 'failed',
    reason: '',
    worktree: dir,
    log: logger.path,
    durations: { totalMs: 0 },
    review: null,
  };
  const finish = (outcome: TaskReport['outcome'], reason: string): TaskReport => {
    report.outcome = outcome;
    report.reason = reason;
    report.durations.totalMs = Date.now() - startedAt;
    if (outcome === 'merged') report.worktree = null;
    logger.line(`  ${task.id}: ${outcome} — ${reason}`);
    logger.close();
    return report;
  };

  logger.line(`\n${task.id} — ${task.title}`);
  logger.line(`  lane ${String(task.lane)}, model ${modelFor(task)}, gate ${String(task.gate)}, branch ${task.branch}`);

  try {
    await withSharedGit(() => addWorktree(dir, task.branch, BASE, logger));
    await installDeps(dir, NPM_CACHE, logger);
  } catch (error) {
    return finish('failed', `worktree setup: ${error instanceof Error ? error.message : String(error)}`);
  }

  logger.line('  running the implementation session…');
  const session = await runSession({
    cwd: dir,
    prompt: `Use the sdd-implement skill on ${task.id}. This is a headless session: decide and record rather than ask, and commit each coherent step as you finish it — an uncommitted worktree is what the turn cap and the wall clock throw away.`,
    model: modelFor(task),
    maxTurns: IMPLEMENT.maxTurns,
    timeoutMs: IMPLEMENT.timeoutMs,
    allowedTools: IMPLEMENT_TOOLS,
    logger,
    env,
  });
  report.durations.implementMs = session.durationMs;

  const handoff = readHandoff(dir, task.id);
  if (handoff.blocked !== null) return finish('blocked', `the session stopped: ${handoff.blocked.trim().split('\n')[0] ?? 'see the blocked note'}`);
  if (session.outcome !== 'ok') return finish('failed', `session ended ${session.outcome}`);

  const commits = await commitsAhead(dir, BASE, logger);
  if (commits === 0) return finish('failed', 'the branch has no commits');
  const branchTasks = parseTasks(readFileSync(join(dir, 'TASKS.md'), 'utf8')).tasks;
  if (!branchTasks.find((candidate) => candidate.id === task.id)?.done) return finish('failed', `${task.id} is not checked off on the branch`);

  if (!(await rebaseOnto(dir, BASE, logger))) return finish('failed', `rebase onto ${BASE} conflicted`);
  if (!(await push(dir, task.branch, logger))) return finish('failed', 'push failed');

  const screenshots = (await changedFiles(dir, BASE, logger)).filter((path) => path.startsWith('docs/screenshots/'));
  const pr = await createPullRequest(dir, task.id, `${task.id}: ${task.title}`, prBody(task, handoff, screenshots, logger.path), logger);
  if (pr === null) return finish('failed', 'gh pr create failed');
  report.pr = pr;

  logger.line(`  PR #${String(pr)} opened; watching CI…`);
  const ciStartedAt = Date.now();
  const green = await watchChecks(dir, pr, logger);
  report.durations.ciMs = Date.now() - ciStartedAt;
  if (!green) return finish('failed', 'CI is red');

  logger.line('  running the review session…');
  const review = await runSession({
    cwd: dir,
    prompt: `Use the code-review skill on this branch's diff against ${BASE}, then write {"findings":[{"file":"","line":0,"summary":""}]} listing what you found to sdd-run/${task.id}.review.json. Change nothing else.`,
    model: REVIEW.model,
    maxTurns: REVIEW.maxTurns,
    timeoutMs: REVIEW.timeoutMs,
    allowedTools: REVIEW_TOOLS,
    logger,
    env,
  });
  report.durations.reviewMs = review.durationMs;
  const findings = readHandoff(dir, task.id).findings;
  report.review = findings === null ? null : { findings };

  if (findings === null) {
    await commentOnPullRequest(dir, task.id, pr, `The review session ended \`${review.outcome}\` without a verdict, so this PR is not merged automatically.\n\n${review.result ?? ''}`, logger);
    return finish('findings', 'the review left no verdict');
  }
  if (findings > 0) {
    await commentOnPullRequest(dir, task.id, pr, `## Automated review (PLAN §16.4)\n\n${review.result ?? `${String(findings)} findings; see \`sdd-run/${task.id}.review.json\`.`}`, logger);
    return finish('findings', `${String(findings)} review findings; the PR is left open`);
  }

  if (task.gate === 'owner') {
    await labelPullRequest(dir, pr, OWNER_LABEL, logger);
    return finish('awaiting-owner', `CI green, review clean, \`Gate: owner\` — PR #${String(pr)} labelled \`${OWNER_LABEL}\``);
  }
  if (!(await mergePullRequest(dir, pr, logger))) return finish('failed', 'squash merge failed');
  await withSharedGit(() => removeWorktree(dir, logger));
  return finish('merged', `PR #${String(pr)} squash-merged`);
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'help') {
    process.stdout.write(helpText(BASE));
    return 0;
  }

  const { statuses, problems } = await readFacts(options, consoleLogger);

  if (options.mode === 'status') {
    printStatus(statuses, problems, consoleLogger);
    return 0;
  }

  let planned: TaskStatus[];
  let skipped: { task: Task; reason: string }[] = [];
  if (options.mode === 'task' || (options.mode === 'dry-run' && options.taskId)) {
    const refusal = refusalFor(statuses, options.taskId ?? '');
    if (refusal) {
      consoleLogger.line(`Refusing: ${refusal}`);
      return 1;
    }
    planned = statuses
      .filter((status) => status.task.id.toLowerCase() === options.taskId?.toLowerCase())
      // §16.6: `--model` is the owner's hand on one run — the log, the PR body and the run report all say the model actually used.
      .map((status) => (options.model ? { ...status, task: { ...status.task, model: options.model } } : status));
  } else {
    const selection = selectWave(statuses);
    planned = [...selection.wave];
    skipped = [...selection.skipped];
  }

  if (options.mode === 'dry-run') {
    printPlanned(planned, skipped, consoleLogger);
    if (problems.length > 0) {
      consoleLogger.line('\nBreakdown problems:');
      for (const problem of problems) consoleLogger.line(`  - ${problem}`);
    }
    return 0;
  }

  printPlanned(planned, skipped, consoleLogger);
  const startedAt = new Date();
  const reports: TaskReport[] = [];
  // D-132: the wave runs concurrently; each task has its own worktree, log, port and PR.
  if (planned.length > 1) consoleLogger.line(`\nRunning ${String(planned.length)} at once; console lines are prefixed with the task id, the full transcripts are the per-task logs.`);
  reports.push(...(await Promise.all(planned.map((status, index) => runTask(status, { index, count: planned.length })))));
  const run: RunReport = { startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), mode: options.mode, tasks: reports };
  consoleLogger.line(`\nRun summary: ${writeRunReport(run)}`);
  for (const report of reports) consoleLogger.line(`  ${report.id.padEnd(4)} ${report.outcome.padEnd(15)} ${report.reason}`);
  return reports.some((report) => report.outcome === 'failed') ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
