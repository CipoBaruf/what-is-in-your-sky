/**
 * PLAN §16: the v1 task driver. It reads TASKS.md from `origin/main`, works
 * out which tasks are ready, and runs a wave of them — one headless session
 * per task in its own worktree, on the agent `sdd.agents.json` names
 * (FR-SDD-10), then rebase, push, PR, CI, review and (for `Gate: auto`) merge.
 *
 *   npm run sdd -- --status          # merged / ready / blocked / failed
 *   npm run sdd -- --dry-run         # print exactly what would run, and stop
 *   npm run sdd -- --wave            # run the current wave (<= 1 per lane, <= 3 at once, concurrently)
 *   npm run sdd -- --task R17        # run one task, dependencies checked
 *   npm run sdd -- --task R22 --tier hard    # the same, on another tier than TASKS.md says
 *   npm run sdd -- --wave --agent <name>     # on another entry of sdd.agents.json
 *   npm run sdd -- --wave --no-fallback      # do not retry a limit-stopped session on the next tier
 *
 * It is not a scheduler or a service (§16.7): it is a script the owner runs
 * in the foreground, with no state of its own. `origin/main`, the branches
 * and the PRs are the state, so an interrupted run needs no reconciling.
 * D-86 makes it repo tooling rather than a task in TASKS.md.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadAgents, modelTiers, nextTier, pickAgent, toolLists, type Agent, type AgentsConfig, type SessionKind, type Tier } from './sdd/agents';
import { buildBrief } from './sdd/brief';
import { layoutLookup } from './sdd/ids';
import { OPEN_PHASE, PHASES } from './sdd/splitMap';
import { helpText, parseArgs, type Options } from './sdd/cli';
import { fallbackFor, layoutTasksText, limitsFor, parseTasks, phaseTasksPath, tierFor, type Task } from './sdd/tasks';
import { addWorktree, branchAt, changedFiles, commentOnPullRequest, commitsAhead, createPullRequest, dirtyFiles, editPullRequestBody, failureDigest, fetchOrigin, fileExistsAtRef, installDeps, listFilesAtRef, labelPullRequest, mergePullRequest, openPullRequests, push, readFileAtRef, readTasksAtRef, rebaseOnto, remoteBranches, removeWorktree, watchChecks } from './sdd/git';
import { budgetOverrun, LEDGER_PATH, readLedger } from './sdd/ledger';
import { totalTokens } from './sdd/parsers';
import { checksRun, closedIds, consoleLogger, openTaskLog, prBody as shortPrBody, whatChanged, writeRunReport, type Logger, type RunReport, type TaskReport } from './sdd/report';
import { findingsPath, FIX_WORKFLOW, fixPrompt, parseFindings, REVIEW_WORKFLOW, reviewPrompt, reviewTierFor } from './sdd/review';
import { limitNote, MAX_RESET_WAITS, resetTime, resetWaitMs, runSession, type SessionResult } from './sdd/session';
import { openFindings, refusalFor, selectWave, statusOf, type TaskStatus } from './sdd/waves';

const BASE = 'origin/main';
const WORKTREE_ROOT = '../wiys-tasks';
const NPM_CACHE = resolve('.sdd-cache/npm');
const OWNER_LABEL = 'needs-owner';
const IMPLEMENT = { maxTurns: 250, timeoutMs: 45 * 60_000 };
const REVIEW = { maxTurns: 40, timeoutMs: 15 * 60_000 };
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

/** The tasks text `readFacts` last parsed: the brief's fallback when ids.md has no entry for a task. */
let tasksMarkdown: string | null = null;
/** FR-SDD-2: the open phase's task ids, whose sessions are the running 90th percentile's history. */
let openPhaseTasks = new Set<string>();

/** Everything the wave logic needs, read from the remote. `models` is the default agent's model → tier map (FR-SDD-11). */
async function readFacts(options: Options, models: Readonly<Record<string, Tier>>, logger: Logger): Promise<{ statuses: TaskStatus[]; problems: readonly string[] }> {
  let open: string;
  let markdown: string;
  let branches = new Set<string>();
  let prsByBranch = new Map<string, number>();
  if (options.tasksFile) {
    const base = dirname(options.tasksFile);
    open = readFileSync(options.tasksFile, 'utf8');
    markdown = layoutTasksText(open, (path) => (existsSync(join(base, path)) ? readFileSync(join(base, path), 'utf8') : null));
    logger.line(`TASKS.md from ${options.tasksFile} (remote state ignored)`);
  } else {
    await fetchOrigin(logger);
    // FR-SDD-7: the open TASKS.md and every closed phase's tasks.md, so a dependency on a closed task reads as merged.
    const closed = new Map<string, string | null>();
    // One ls-tree says which phase files exist; only those are read (the open phase lives in TASKS.md).
    const existing = await listFilesAtRef(BASE, 'docs/sdd/phases', logger);
    for (const phase of PHASES) if (phase !== OPEN_PHASE && existing.has(phaseTasksPath(phase))) closed.set(phaseTasksPath(phase), await readFileAtRef(BASE, phaseTasksPath(phase), logger));
    open = await readTasksAtRef(BASE, logger);
    markdown = layoutTasksText(open, (path) => closed.get(path) ?? null);
    branches = await remoteBranches(logger);
    prsByBranch = await openPullRequests(logger);
  }
  tasksMarkdown = markdown;
  openPhaseTasks = new Set(parseTasks(open, models).tasks.map((task) => task.id));
  const { tasks, problems } = parseTasks(markdown, models);
  const openPrs = new Map<string, number>();
  for (const task of tasks) {
    const pr = prsByBranch.get(task.branch);
    if (pr !== undefined) openPrs.set(task.id, pr);
  }
  // §16.3 `Precondition:`: read once per path from origin/main; with --tasks-file nothing is checked.
  const present = new Map<string, boolean>();
  if (!options.tasksFile) for (const task of tasks) if (task.precondition !== null && !present.has(task.precondition)) present.set(task.precondition, await fileExistsAtRef(BASE, task.precondition, logger));
  const fileOnMain = options.tasksFile ? undefined : (path: string): boolean => present.get(path) ?? false;
  return { statuses: statusOf({ tasks, openPrs, remoteBranches: branches, ...(fileOnMain ? { fileOnMain } : {}) }), problems };
}

function printStatus(statuses: readonly TaskStatus[], problems: readonly string[], logger: Logger): void {
  const counts = new Map<string, number>();
  for (const status of statuses) counts.set(status.state, (counts.get(status.state) ?? 0) + 1);
  logger.line(`\n${String(statuses.length)} tasks`);
  for (const state of ['merged', 'in-review', 'ready', 'blocked', 'failed', 'owner-driven']) logger.line(`  ${state.padEnd(10)} ${String(counts.get(state) ?? 0)}`);
  logger.line('');
  for (const { task, state, missingDeps, blockers, missingPrecondition, pr } of statuses) {
    const notes = [
      task.lane ? `lane ${task.lane}` : null,
      task.gate ? `gate ${task.gate}` : null,
      state === 'merged' ? null : task.model === 'interactive' ? 'interactive' : `tier ${tierFor(task)}${task.agent ? ` on ${task.agent}` : ''}`,
      missingDeps.length > 0 ? `waiting on ${missingDeps.join(', ')}` : null,
      missingPrecondition !== null ? `waiting for ${missingPrecondition}` : null,
      task.findings.length > 0 && state !== 'merged' ? `closes ${task.findings.join(', ')}` : null,
      pr !== null ? `PR #${String(pr)}` : null,
      blockers.length > 0 && state !== 'merged' ? `breakdown bug: ${blockers.join(', ')}` : null,
    ].filter(Boolean);
    logger.line(`  ${task.id.padEnd(4)} ${state.padEnd(10)} ${task.title}${notes.length > 0 ? `  (${notes.join('; ')})` : ''}`);
  }
  const open = openFindings(statuses);
  logger.line(`\nOpen findings: ${open.length > 0 ? `${open.join(', ')} (${String(open.length)})` : 'none'}`);
  if (problems.length > 0) {
    logger.line('\nBreakdown problems:');
    for (const problem of problems) logger.line(`  - ${problem}`);
  }
}

function printPlanned(wave: readonly TaskStatus[], skipped: readonly { task: Task; reason: string }[], agentOf: (task: Task) => Agent, logger: Logger): void {
  if (wave.length === 0) logger.line('\nNothing to run: no task is ready.');
  else {
    logger.line('\nWould run:');
    for (const { task } of wave) {
      const agent = agentOf(task);
      const tier = tierFor(task);
      logger.line(
        `  ${task.id.padEnd(4)} lane ${String(task.lane).padEnd(8)} agent ${agent.name} tier ${tier.padEnd(8)} (${agent.tiers[tier].model}) review ${task.review ?? 'by the diff'} turns ${String(limitsFor(task, { implement: IMPLEMENT, review: REVIEW }).implement.maxTurns).padEnd(4)} gate ${String(task.gate).padEnd(6)} branch ${task.branch}`,
      );
    }
  }
  if (skipped.length > 0) {
    logger.line('\nHeld back:');
    for (const { task, reason } of skipped) logger.line(`  ${task.id.padEnd(4)} ${reason}`);
  }
}

interface Handoff {
  blocked: string | null;
  summary: string | null;
  /** D-1065: the review's lines, as written, and how many count against the merge; `null` when the review left no file. */
  findings: { lines: string[]; count: number } | null;
}

/** The files a session leaves for the driver in its worktree (§16.4). */
function readHandoff(dir: string, id: string): Handoff {
  const read = (relative: string): string | null => {
    const path = join(dir, relative);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  };
  const text = read(findingsPath(id));
  let findings: Handoff['findings'] = null;
  if (text !== null) {
    const parsed = parseFindings(text);
    findings = { lines: text.split('\n').filter((line) => line.trim() !== ''), count: parsed.findings.length + parsed.unreadable.length };
  }
  return { blocked: read(join('sdd-run', `${id}.blocked.md`)), summary: read(join('sdd-run', `${id}.summary.md`)), findings };
}

/**
 * §16.4 step 3 (D-198): `sdd-run/<id>.brief.md`, from the documents as the
 * fresh worktree has them, which is `origin/main`. Returns the path relative
 * to the worktree, which is how the prompt names it.
 */
function writeBrief(dir: string, task: Task, agent: Agent, logger: Logger): string {
  const tools = toolLists(agent, 'implement');
  // FR-SDD-7: every id through docs/sdd/ids.md, the task from TASKS.md or its phase's tasks.md.
  const brief = buildBrief(task, { textFor: layoutLookup(dir), ...(tasksMarkdown === null ? {} : { fallbackTasks: tasksMarkdown }) }, { allowedTools: tools.allowed, deniedTools: tools.denied });
  mkdirSync(join(dir, 'sdd-run'), { recursive: true });
  const relative = join('sdd-run', `${task.id}.brief.md`);
  writeFileSync(join(dir, relative), brief.markdown);
  logger.line(`  brief: ${relative}, ${String(brief.markdown.length)} chars (~${String(Math.round(brief.markdown.length / 4))} tokens)${brief.missing.length > 0 ? `; cited but not found: ${brief.missing.join(', ')}` : ''}`);
  if (brief.missing.length > 0) logger.line(`  WARNING: ${String(brief.missing.length)} cited id(s) are not in docs/sdd/ids.md or their file; if ids.md is stale run \`npx tsx scripts/sdd/ids.ts --write\``);
  return relative;
}

/** FR-SDD-1 (D-1058): the ledger in the driver's own checkout, which outlives every task worktree. */
const LEDGER = resolve(LEDGER_PATH);

/** What every session of one task shares. */
interface TaskContext {
  task: Task;
  agent: Agent;
  dir: string;
  logger: Logger;
  env: Record<string, string>;
  fallback: boolean;
  waitForReset: boolean;
  report: TaskReport;
}

/**
 * §16.4 step 10 (D-197, D-835): one stage, retried once on the next tier of
 * the agent's fallback chain when it ends on a limit that is not the
 * account's and fallback is on. An account-wide limit (every model shares
 * it) ends the task `limit` with the reset time, or, with `waitForReset`, is
 * waited out: the driver sleeps to the reset and runs the stage again in the
 * same worktree, on `resumePrompt` where one is given, up to
 * `MAX_RESET_WAITS` times. Every attempt lands in the report, and with no
 * ceiling set a session past its tier's running 90th percentile is recorded
 * as an overrun, stopping nothing (FR-SDD-2).
 */
async function runStage(context: TaskContext, kind: SessionKind, tier: Tier, prompt: string, caps: { maxTurns: number; timeoutMs: number }, resumePrompt?: string, handoff?: string): Promise<{ session: SessionResult; tier: Tier }> {
  const { agent, task, logger, report } = context;
  let current = tier;
  let waits = 0;
  for (;;) {
    const history = readLedger(LEDGER).filter((entry) => openPhaseTasks.has(entry.task) && entry.agent === agent.name && entry.kind === kind && entry.tier === current);
    const session = await runSession({ cwd: context.dir, prompt, agent, tier: current, kind, maxTurns: agent.tiers[current].maxTurns ?? caps.maxTurns, timeoutMs: caps.timeoutMs, logger, env: context.env, ...(handoff === undefined ? {} : { handoff }), ledger: { task: task.id, path: LEDGER } });
    report.attempts.push({ stage: kind, tier: current, model: session.model, outcome: session.outcome, durationMs: session.durationMs });
    const overrun = agent.tiers[current].tokenCeiling === undefined ? budgetOverrun(session.usage ? totalTokens(session.usage) : null, history) : null;
    if (overrun) {
      const line = `${kind} on ${current}: ${String(overrun.tokens)} tokens, past the phase's 90th percentile of ${String(overrun.p90)} over ${String(overrun.samples)} sessions`;
      report.overruns.push(line);
      logger.line(`  budget overrun (FR-SDD-2, report-only): ${line}`);
    }
    const next = session.outcome === 'limit' && context.fallback && session.limit?.accountWide === false ? nextTier(agent, current) : null;
    if (next !== null) {
      logger.line(`  the ${kind} session ended on its model's own limit after ${String(Math.round(session.durationMs / 60_000))} min; retrying once on ${next} in the same worktree (§16.4 step 10)`);
      current = next;
      continue;
    }
    const wait = session.outcome === 'limit' && context.waitForReset && waits < MAX_RESET_WAITS ? resetWaitMs(session.limit, Date.now()) : null;
    if (wait !== null) {
      waits += 1;
      logger.line(`  the ${kind} session ended on a usage limit (${session.limit?.window ?? 'window unknown'}); waiting until ${resetTime(session.limit)} and resuming in the same worktree (D-835, wait ${String(waits)} of ${String(MAX_RESET_WAITS)})`);
      await new Promise((done) => setTimeout(done, wait));
      if (resumePrompt !== undefined) prompt = resumePrompt;
      continue;
    }
    if (session.outcome === 'limit') logger.line(limitNote(kind, session.limit, context.fallback));
    return { session, tier: current };
  }
}

/**
 * FR-SDD-20: the short body — what changed and the checks from the session's
 * summary, the ids it closes, the capture count until R178's diff summary,
 * and one usage line per session this run of the task left in the ledger.
 */
function prBody(task: Task, handoff: Handoff, screenshots: readonly string[], since: Date): string {
  return shortPrBody({
    gate: task.gate,
    changed: whatChanged(handoff.summary),
    closes: closedIds(task.id, task.findings, handoff.summary),
    checks: checksRun(handoff.summary),
    captureDiff: screenshots.length > 0 ? `${String(screenshots.length)} file(s) under \`docs/screenshots/\`` : null,
    // This run's sessions only: an abandoned or failed earlier run of the task is not this PR's usage.
    usage: readLedger(LEDGER, task.id, since),
  });
}

const readWorkflow = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8');

/**
 * FR-SDD-16, D-1065 (`--fix`): one fix session on the task's tier, handed the
 * review's findings or the CI failure digest and `fix-ci.md`, never a log or
 * a transcript; then its commits are pushed. `false` when it did not commit
 * or the push failed.
 */
async function runFix(context: TaskContext, brief: string, caps: { maxTurns: number; timeoutMs: number }, input: { findings: readonly string[]; digest: string | null }): Promise<boolean> {
  const { dir, task, logger, report } = context;
  const before = await commitsAhead(dir, BASE, logger);
  logger.line(`  running a fix session on ${input.digest !== null ? 'the failure digest' : `${String(input.findings.length)} finding(s)`}…`);
  const prompt = fixPrompt({ id: task.id, brief, workflow: readWorkflow(dir, FIX_WORKFLOW), findings: input.findings, digest: input.digest });
  const { session } = await runStage(context, 'fix', tierFor(task), prompt, caps, undefined, join('sdd-run', `${task.id}.summary.md`));
  report.durations.fixMs = report.attempts.filter((attempt) => attempt.stage === 'fix').reduce((sum, attempt) => sum + attempt.durationMs, 0);
  if (session.outcome !== 'ok' || (await commitsAhead(dir, BASE, logger)) <= before) return false;
  return push(dir, task.branch, logger);
}

/** D-1065 and FR-SDD-9: the review on the tier the diff calls for, from `review.md`; `null` tier when the diff is docs-only. */
async function runReview(context: TaskContext, brief: string, changed: readonly string[], caps: { maxTurns: number; timeoutMs: number }): Promise<{ session: SessionResult | null; tier: Tier | null; findings: Handoff['findings'] }> {
  const { dir, task, logger, agent } = context;
  const tier = reviewTierFor(task, changed);
  if (tier === null) {
    logger.line('  every changed path is under docs/ or a root *.md: no review session (D-1065)');
    return { session: null, tier: null, findings: { lines: [], count: 0 } };
  }
  logger.line(`  running the review session on ${tier} (${agent.tiers[tier].model})…`);
  // A file left by an earlier review (a resumed worktree, or before a fix) is not this review's verdict.
  rmSync(join(dir, findingsPath(task.id)), { force: true });
  const prompt = reviewPrompt({ id: task.id, brief, base: BASE, workflow: readWorkflow(dir, REVIEW_WORKFLOW) });
  const { session, tier: ran } = await runStage(context, 'review', tier, prompt, caps, undefined, findingsPath(task.id));
  return { session, tier: ran, findings: readHandoff(dir, task.id).findings };
}

/** §16.4 steps 1–8 for one task. `slot` is its place in the wave: the e2e port and, when the wave has more than one task, the console prefix. */
async function runTask(status: TaskStatus, agent: Agent, slot: { index: number; count: number }, options: Pick<Options, 'fallback' | 'waitForReset' | 'fix'>): Promise<TaskReport> {
  const { task } = status;
  const logger = openTaskLog(task.id, undefined, undefined, { prefixConsole: slot.count > 1 });
  const env = { npm_config_cache: NPM_CACHE, E2E_PORT: String(E2E_BASE_PORT + slot.index) };
  const startedAt = Date.now();
  const dir = join(WORKTREE_ROOT, task.id);
  const tier = tierFor(task);
  const report: TaskReport = {
    id: task.id,
    branch: task.branch,
    lane: task.lane,
    agent: agent.name,
    tier,
    model: agent.tiers[tier].model,
    gate: task.gate,
    pr: null,
    outcome: 'failed',
    reason: '',
    worktree: dir,
    log: logger.path,
    durations: { totalMs: 0 },
    attempts: [],
    review: null,
    overruns: [],
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
  logger.line(`  lane ${String(task.lane)}, agent ${agent.name}, tier ${tier} (${agent.tiers[tier].model}), gate ${String(task.gate)}, branch ${task.branch}`);

  // A kept worktree on the task's branch is a session the limit or the clock cut short (§16.5):
  // the new session continues from its commits and its working tree instead of starting over.
  let resumed = false;
  try {
    if (existsSync(dir) && (await branchAt(dir, logger)) === task.branch) {
      resumed = true;
      const ahead = await commitsAhead(dir, BASE, logger);
      const dirty = await dirtyFiles(dir, logger);
      logger.line(`  resuming the kept worktree: ${String(ahead)} commit(s) ahead of ${BASE}, ${String(dirty.length)} uncommitted file(s)`);
      if (!existsSync(join(dir, 'node_modules'))) await installDeps(dir, NPM_CACHE, logger);
    } else {
      await withSharedGit(() => addWorktree(dir, task.branch, BASE, logger));
      await installDeps(dir, NPM_CACHE, logger);
    }
  } catch (error) {
    return finish('failed', `worktree setup: ${error instanceof Error ? error.message : String(error)}`);
  }

  let brief: string;
  try {
    brief = writeBrief(dir, task, agent, logger);
  } catch (error) {
    return finish('failed', `brief: ${error instanceof Error ? error.message : String(error)}`);
  }

  // §16.3 (v2.2, D-659): `Turns:` and `Fallback:` on the task, else the driver's defaults and the flag.
  const limits = limitsFor(task, { implement: IMPLEMENT, review: REVIEW });
  const context: TaskContext = { task, agent, dir, logger, env, fallback: fallbackFor(task, options.fallback), waitForReset: options.waitForReset, report };
  logger.line(`  running the implementation session… (${String(limits.implement.maxTurns)} turns, ${String(Math.round(limits.implement.timeoutMs / 60_000))} min, fallback ${context.fallback ? 'on' : 'off'})`);
  const implementPrompt = (cutShort: boolean): string =>
    `Use the sdd-implement skill on ${task.id}. Read ${brief} first: it replaces SPEC.md, PLAN.md and TASKS.md for this session. This is a headless session: decide and record rather than ask, and commit each coherent step as you finish it — an uncommitted worktree is what the turn cap and the wall clock throw away.${cutShort ? ` An earlier session on this branch was cut short: read \`git log ${BASE}..HEAD\` and \`git status\` first, commit what it left in the working tree if it is coherent, and continue from there rather than starting over.` : ''}`;
  const { session, tier: ran } = await runStage(context, 'implement', tier, implementPrompt(resumed), limits.implement, implementPrompt(true), join('sdd-run', `${task.id}.summary.md`));
  report.tier = ran;
  report.model = agent.tiers[ran].model;
  report.durations.implementMs = report.attempts.filter((attempt) => attempt.stage === 'implement').reduce((sum, attempt) => sum + attempt.durationMs, 0);

  const handoff = readHandoff(dir, task.id);
  if (handoff.blocked !== null) return finish('blocked', `the session stopped: ${handoff.blocked.trim().split('\n')[0] ?? 'see the blocked note'}`);
  if (session.outcome === 'limit') return finish('limit', `a usage limit ended the session (resets ${resetTime(session.limit)}); the worktree is kept — \`--wave\` or \`--task ${task.id}\` resumes it after that`);
  if (session.outcome !== 'ok') return finish('failed', `session ended ${session.outcome}`);

  const commits = await commitsAhead(dir, BASE, logger);
  if (commits === 0) return finish('failed', 'the branch has no commits');
  const branchTasks = parseTasks(readFileSync(join(dir, 'TASKS.md'), 'utf8'), modelTiers(agent)).tasks;
  if (!branchTasks.find((candidate) => candidate.id === task.id)?.done) return finish('failed', `${task.id} is not checked off on the branch`);

  if (!(await rebaseOnto(dir, BASE, logger))) return finish('failed', `rebase onto ${BASE} conflicted`);
  if (!(await push(dir, task.branch, logger))) return finish('failed', 'push failed');

  const changed = await changedFiles(dir, BASE, logger);
  const screenshots = changed.filter((path) => path.startsWith('docs/screenshots/'));
  const pr = await createPullRequest(dir, task.id, `${task.id}: ${task.title}`, prBody(task, handoff, screenshots, new Date(startedAt)), logger);
  if (pr === null) return finish('failed', 'gh pr create failed');
  report.pr = pr;

  // FR-SDD-16 (`--fix`): at most one fix session per task run, on the digest or on the findings.
  let fixed = false;
  const watch = async (): Promise<boolean> => {
    logger.line(`  PR #${String(pr)} opened or updated; watching CI…`);
    const ciStartedAt = Date.now();
    const green = await watchChecks(dir, pr, logger);
    report.durations.ciMs = (report.durations.ciMs ?? 0) + Date.now() - ciStartedAt;
    return green;
  };
  let green = await watch();
  if (!green && options.fix) {
    fixed = true;
    const digest = await failureDigest(dir, task.branch, logger);
    if (await runFix(context, brief, limits.implement, { findings: [], digest })) green = await watch();
  }
  if (!green) return finish('failed', fixed ? 'CI is red after the fix session' : 'CI is red');

  let reviewed = await runReview(context, brief, changed, limits.review);
  if (options.fix && !fixed && reviewed.findings !== null && reviewed.findings.count > 0) {
    if (await runFix(context, brief, limits.implement, { findings: reviewed.findings.lines, digest: null })) {
      if (!(await watch())) return finish('failed', 'CI is red after the fix session');
      reviewed = await runReview(context, brief, await changedFiles(dir, BASE, logger), limits.review);
    }
  }
  const { session: review, findings } = reviewed;
  report.durations.reviewMs = report.attempts.filter((attempt) => attempt.stage === 'review').reduce((sum, attempt) => sum + attempt.durationMs, 0);
  report.review = findings === null ? null : { findings: findings.count, tier: reviewed.tier, model: reviewed.tier === null ? null : agent.tiers[reviewed.tier].model };
  // FR-SDD-1: the body carries one usage line per session, and the review's are new since the PR opened.
  await editPullRequestBody(dir, task.id, pr, prBody(task, readHandoff(dir, task.id), screenshots, new Date(startedAt)), logger);

  if (review?.outcome === 'limit') {
    await commentOnPullRequest(dir, task.id, pr, `The review session ended on a usage limit (resets ${resetTime(review.limit)}) without a verdict, so this PR is not merged automatically. Review it by hand or rerun the review.`, logger);
    return finish('limit', `CI green; a usage limit ended the review (resets ${resetTime(review.limit)}); PR #${String(pr)} waits for a review`);
  }
  if (findings === null) {
    await commentOnPullRequest(dir, task.id, pr, `The review session ended \`${review?.outcome ?? 'unknown'}\` without a verdict, so this PR is not merged automatically.\n\n${review?.result ?? ''}`, logger);
    return finish('findings', 'the review left no verdict');
  }
  if (findings.count > 0) {
    await commentOnPullRequest(dir, task.id, pr, `## Automated review (PLAN §16.4, D-1065)\n\n${String(findings.count)} finding(s), one JSON line each (\`${findingsPath(task.id)}\`):\n\n\`\`\`jsonl\n${findings.lines.join('\n')}\n\`\`\``, logger);
    return finish('findings', `${String(findings.count)} review findings; the PR is left open`);
  }

  if (task.gate === 'owner') {
    await labelPullRequest(dir, pr, OWNER_LABEL, logger);
    return finish('awaiting-owner', `CI green, review clean, \`Gate: owner\` — PR #${String(pr)} labelled \`${OWNER_LABEL}\``);
  }
  if (!(await mergePullRequest(dir, pr, logger))) return finish('failed', 'squash merge failed');
  await withSharedGit(() => removeWorktree(dir, logger));
  return finish('merged', `PR #${String(pr)} squash-merged`);
}

/** §16.6, FR-SDD-11: `--tier`, or `--model` read through the agent's map, as the task's tier for one `--task` run. */
function overrideTier(options: Options, agent: Agent): Tier | null {
  if (options.tier) return options.tier;
  if (!options.model) return null;
  const tier = modelTiers(agent)[options.model];
  if (!tier) throw new Error(`--model ${options.model}: agent ${agent.name} has ${Object.keys(modelTiers(agent)).join(', ')}`);
  return tier;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'help') {
    process.stdout.write(helpText(BASE));
    return 0;
  }

  const config: AgentsConfig = loadAgents();
  // FR-SDD-10: a task's `Agent:` pins it; else `--agent`; else the config's default.
  const agentOf = (task: Task): Agent => pickAgent(config, task.agent, options.agent);
  const { statuses, problems } = await readFacts(options, modelTiers(pickAgent(config)), consoleLogger);

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
      // §16.6: the override is the owner's hand on one run — the log, the PR body and the run report all say the tier actually used.
      .map((status) => {
        const tier = overrideTier(options, agentOf(status.task));
        return tier ? { ...status, task: { ...status.task, tier } } : status;
      });
  } else {
    const selection = selectWave(statuses);
    planned = [...selection.wave];
    skipped = [...selection.skipped];
  }

  if (options.mode === 'dry-run') {
    printPlanned(planned, skipped, agentOf, consoleLogger);
    if (problems.length > 0) {
      consoleLogger.line('\nBreakdown problems:');
      for (const problem of problems) consoleLogger.line(`  - ${problem}`);
    }
    return 0;
  }

  printPlanned(planned, skipped, agentOf, consoleLogger);
  const startedAt = new Date();
  const reports: TaskReport[] = [];
  // D-132: the wave runs concurrently; each task has its own worktree, log, port and PR.
  if (planned.length > 1) consoleLogger.line(`\nRunning ${String(planned.length)} at once; console lines are prefixed with the task id, the full transcripts are the per-task logs.`);
  if (!options.fallback) consoleLogger.line('--no-fallback: a session that ends on a usage limit ends its task (§16.4 step 10).');
  if (!options.waitForReset) consoleLogger.line('--no-wait: a session that ends on a usage limit ends its task `limit` instead of waiting for the reset (D-835).');
  if (options.fix) consoleLogger.line('--fix: a red CI run or review findings get one fix session per task (FR-SDD-16).');
  reports.push(...(await Promise.all(planned.map((status, index) => runTask(status, agentOf(status.task), { index, count: planned.length }, options)))));
  const run: RunReport = { startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), mode: options.mode, tasks: reports };
  consoleLogger.line(`\nRun summary: ${writeRunReport(run)}`);
  for (const report of reports) consoleLogger.line(`  ${report.id.padEnd(4)} ${report.outcome.padEnd(15)} ${report.reason}${report.overruns.length > 0 ? ` (${String(report.overruns.length)} budget overrun(s))` : ''}`);
  return reports.some((report) => report.outcome === 'failed' || report.outcome === 'limit') ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
