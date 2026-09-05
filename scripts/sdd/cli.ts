/**
 * PLAN §16.4: the driver's command line. Kept apart from `sdd-run.ts`, which
 * runs `main()` on import, so the parsing is testable without a run.
 */
import { MODELS, type SessionModel } from './tasks';

/** The models `--model` accepts: everything `claude -p` can be given, so not `interactive` (§16.6, D-197). */
const SESSION_MODELS: readonly SessionModel[] = MODELS.filter((model): model is SessionModel => model !== 'interactive');

export interface Options {
  mode: 'status' | 'dry-run' | 'wave' | 'task' | 'help';
  taskId: string | null;
  tasksFile: string | null;
  /** §16.6: `--model` overrides a task's `Model:` for this one `--task` run. */
  model: SessionModel | null;
}

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { mode: 'help', taskId: null, tasksFile: null, model: null };
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
    } else if (arg === '--model') {
      index += 1;
      const value = argv[index];
      const model = SESSION_MODELS.find((candidate) => candidate === value);
      if (!model) throw new Error(`--model needs one of ${SESSION_MODELS.join(', ')}, e.g. \`--model opus\``);
      options.model = model;
    } else if (arg === '--help' || arg === '-h') options.mode = 'help';
    else throw new Error(`unknown argument \`${String(arg)}\``);
  }
  if (options.mode === 'task' && !options.taskId) throw new Error('--task needs a task id, e.g. `--task R17`');
  if (options.tasksFile && (options.mode === 'wave' || options.mode === 'task')) throw new Error('--tasks-file is for --status and --dry-run only');
  if (options.model && !options.taskId) throw new Error('--model is for --task only: a wave runs every task on the model TASKS.md gives it (§16.6)');
  return options;
}

export const helpText = (base: string): string => `sdd-run — the v1 task driver (PLAN §16)

  npm run sdd -- --status                 what is merged, ready, blocked, in review or failed
  npm run sdd -- --dry-run                print exactly what would run, and stop
  npm run sdd -- --wave                   run the current wave (<= 1 per lane, <= 2 at once)
  npm run sdd -- --task R17               run one task, dependencies checked
  npm run sdd -- --task R22 --model opus  the same, on another model than TASKS.md says (§16.6)

  --tasks-file <path>                     read TASKS.md from a file instead of ${base}
                                          (--status and --dry-run only)
`;
