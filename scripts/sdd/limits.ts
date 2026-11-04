/**
 * SPEC §4.56's constants (FR-SDD-4, FR-SDD-13, FR-SDD-19, FR-SDD-20, FR-SDD-24; D-1069): the one
 * place `check:sdd`, the lint config's test and the scripts read them from. Sizes are KB of 1,024
 * bytes. A constant here enforces nothing by itself; `LIMITS` holds all of them so a test can
 * hold the set against the spec's table.
 */

/** FR-SDD-4: a line of `docs/sdd/`, `AGENTS.md` or an index file, in characters. */
export const DOC_LINE_MAX = 400;
/** FR-SDD-13: SPEC.md, PLAN.md and TASKS.md (TASKS.md without the open phase's block, D-1081). */
export const INDEX_MAX_KB = 15;
/** FR-SDD-13: a phase's `spec.md` or `plan.md`. */
export const PHASE_DOC_MAX_KB = 60;
/** FR-SDD-13: an area file under `docs/sdd/areas/`, once there is one. */
export const AREA_DOC_MAX_KB = 30;
/** FR-SDD-9, FR-SDD-13: one of `docs/sdd/workflows/`. */
export const WORKFLOW_MAX_KB = 4;
/** FR-SDD-8, FR-SDD-13: `AGENTS.md`. */
export const AGENTS_MAX_KB = 6;
/** FR-SDD-20: a PR body. */
export const PR_BODY_MAX_KB = 1.5;
/** FR-SDD-20: a commit title, in characters. */
export const COMMIT_TITLE_MAX = 72;
/** FR-SDD-19: lint warns on any file over this many lines (ESLint's `max-lines`, D-1069). */
export const FILE_WARN_LINES = 600;

/** Every constant of the table, the ones no script reads yet included. */
export const LIMITS = {
  DOC_LINE_MAX,
  INDEX_MAX_KB,
  PHASE_DOC_MAX_KB,
  AREA_DOC_MAX_KB,
  WORKFLOW_MAX_KB,
  AGENTS_MAX_KB,
  /** The handoff a session writes. */
  HANDOFF_MAX_KB: 2,
  PR_BODY_MAX_KB,
  COMMIT_TITLE_MAX,
  /** FR-SDD-21: the breakdown's target diff per task, generated files and captures not counted. */
  TASK_DIFF_TARGET_LINES: 600,
  /** FR-SDD-16: the failure digest; `ci-digest.ts` runs under plain node and keeps its own copy. */
  FAILURE_DIGEST_MAX_KB: 4,
  /** FR-SDD-24: a snapshot file. */
  SNAPSHOT_MAX_KB: 5,
  /** FR-SDD-19: a new source file stays under this many lines. */
  NEW_FILE_MAX_LINES: 500,
  FILE_WARN_LINES,
  /** FR-SDD-23: 0.1 % as a share; `captures/diff.ts` keeps its own copy, held to this by the test. */
  CAPTURE_DIFF_SHARE: 0.001,
  /** FR-SDD-2: a tier's token ceiling as a multiple of the phase's 90th percentile. */
  TIER_BUDGET_FACTOR: 2,
} as const;
