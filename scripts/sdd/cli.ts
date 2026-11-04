/**
 * PLAN §16.4: the driver's command line. Kept apart from `sdd-run.ts`, which
 * runs `main()` on import, so the parsing is testable without a run.
 */
import { TIERS, type Tier } from './agents';

export interface Options {
  mode: 'status' | 'dry-run' | 'wave' | 'task' | 'help';
  taskId: string | null;
  tasksFile: string | null;
  /** §16.6, FR-SDD-11: `--tier` overrides a task's tier for this one `--task` run. */
  tier: Tier | null;
  /** `--model`: the same override named by one of the agent's models; the driver reads it through the agent's map. */
  model: string | null;
  /** FR-SDD-10: `--agent` picks an entry of `sdd.agents.json` for the run; a task's `Agent:` still wins. */
  agent: string | null;
  /** §16.4 step 10 (D-197): retry a limit-stopped session once on the next tier. On unless `--no-fallback`. */
  fallback: boolean;
  /** §16.4 step 10 (D-835): wait out an account limit and resume in the same worktree. On unless `--no-wait`. */
  waitForReset: boolean;
  /** FR-SDD-16, D-1065: one fix session on a red CI run or on review findings. Off unless `--fix`. */
  fix: boolean;
}

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { mode: 'help', taskId: null, tasksFile: null, tier: null, model: null, agent: null, fallback: true, waitForReset: true, fix: false };
  const value = (index: number, flag: string, example: string): string => {
    const next = argv[index];
    if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value, e.g. \`${flag} ${example}\``);
    return next;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--status') options.mode = 'status';
    else if (arg === '--dry-run') options.mode = 'dry-run';
    else if (arg === '--wave') options.mode = 'wave';
    else if (arg === '--task') {
      options.mode = 'task';
      index += 1;
      options.taskId = argv[index] ?? null;
    } else if (arg === '--tasks-file') {
      index += 1;
      options.tasksFile = argv[index] ?? null;
    } else if (arg === '--tier') {
      index += 1;
      const tier = TIERS.find((candidate) => candidate === argv[index]);
      if (!tier) throw new Error(`--tier needs one of ${TIERS.join(', ')}, e.g. \`--tier standard\``);
      options.tier = tier;
    } else if (arg === '--model') {
      index += 1;
      options.model = value(index, '--model', '<a model of the agent>');
    } else if (arg === '--agent') {
      index += 1;
      options.agent = value(index, '--agent', '<a name in sdd.agents.json>');
    } else if (arg === '--fallback') options.fallback = true;
    else if (arg === '--no-fallback') options.fallback = false;
    else if (arg === '--wait') options.waitForReset = true;
    else if (arg === '--no-wait') options.waitForReset = false;
    else if (arg === '--fix') options.fix = true;
    else if (arg === '--no-fix') options.fix = false;
    else if (arg === '--help' || arg === '-h') options.mode = 'help';
    else throw new Error(`unknown argument \`${String(arg)}\``);
  }
  if (options.mode === 'task' && !options.taskId) throw new Error('--task needs a task id, e.g. `--task R17`');
  if (options.tasksFile && (options.mode === 'wave' || options.mode === 'task')) throw new Error('--tasks-file is for --status and --dry-run only');
  if ((options.tier || options.model) && !options.taskId) throw new Error('--tier and --model are for --task only: a wave runs every task on the tier TASKS.md gives it (§16.6)');
  if (options.tier && options.model) throw new Error('--tier and --model name the same thing; give one');
  return options;
}

export const helpText = (base: string): string => `sdd-run — the task driver (PLAN §16)

  npm run sdd -- --status                 what is merged, ready, blocked, in review or failed
  npm run sdd -- --dry-run                print exactly what would run, and stop
  npm run sdd -- --wave                   run the current wave (<= 1 per lane, <= 3 at once)
  npm run sdd -- --task R17               run one task, dependencies checked
  npm run sdd -- --task R22 --tier hard   the same, on another tier than TASKS.md says (§16.6)
  npm run sdd -- --task R22 --model <m>   the same, naming one of the agent's models instead
  npm run sdd -- --wave --agent <name>    run on another entry of sdd.agents.json (FR-SDD-10)
  npm run sdd -- --wave --no-fallback     do not retry a limit-stopped session on the next tier (§16.4 step 10)
  npm run sdd -- --wave --no-wait         end a task as limit instead of waiting for the reset and resuming (D-835)
  npm run sdd -- --wave --fix             one fix session on a red CI run or review findings (FR-SDD-16)

  --tasks-file <path>                     read TASKS.md from a file instead of ${base}
                                          (--status and --dry-run only)
`;
