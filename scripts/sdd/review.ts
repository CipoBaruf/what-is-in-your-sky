/**
 * FR-SDD-18, FR-SDD-9, FR-SDD-16 (D-1065): which tier reviews a task, the
 * findings it leaves as JSON lines, and the review and fix prompts, built
 * from `docs/sdd/workflows/review.md` and `fix-ci.md`. Pure: the caller reads
 * the files. It cannot tell a test that only moved from one that changed.
 */
import type { Tier } from './agents';
import type { Task } from './tasks';

export const REVIEW_WORKFLOW = 'docs/sdd/workflows/review.md';
export const FIX_WORKFLOW = 'docs/sdd/workflows/fix-ci.md';

/** The review's handoff file, relative to the worktree (D-1083: "the handoff file the prompt names"). */
export const findingsPath = (id: string): string => `sdd-run/${id}.findings.jsonl`;

/** Paths whose change always gets the `standard` review (FR-SDD-18). */
const CAREFUL = ['src/physics/', 'src/worker/', 'scripts/sdd/'];

const docsOnly = (path: string): boolean => path.startsWith('docs/') || (!path.includes('/') && path.endsWith('.md'));

/** D-1065: `null` (no review session) for a docs-only diff; `standard` for a hard task, an owner gate or a careful path; else `light`. */
export function reviewTier(task: Pick<Task, 'tier' | 'gate'>, paths: readonly string[]): Tier | null {
  if (paths.every(docsOnly)) return null;
  if (task.tier === 'hard' || task.gate === 'owner' || paths.some((path) => CAREFUL.some((prefix) => path.startsWith(prefix)))) return 'standard';
  return 'light';
}

/** D-659 on top of D-1065: a task's `Review:` picks the tier, except that a docs-only diff still gets no session. */
export const reviewTierFor = (task: Pick<Task, 'tier' | 'gate' | 'review'>, paths: readonly string[]): Tier | null => {
  const tier = reviewTier(task, paths);
  return tier === null ? null : (task.review ?? tier);
};

export interface Finding {
  file: string;
  line: number;
  claim: string;
  scenario: string;
}

/**
 * D-1065: the findings file, one JSON object a line. A line that is not a
 * finding is kept in `unreadable` and counts against the merge, since a
 * review the driver cannot read has not said the diff is clean.
 */
export function parseFindings(text: string): { findings: Finding[]; unreadable: string[] } {
  const findings: Finding[] = [];
  const unreadable: string[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as Partial<Finding>;
      if (typeof value.file === 'string' && typeof value.line === 'number' && typeof value.claim === 'string' && typeof value.scenario === 'string') findings.push({ file: value.file, line: value.line, claim: value.claim, scenario: value.scenario });
      else unreadable.push(line);
    } catch {
      unreadable.push(line);
    }
  }
  return { findings, unreadable };
}

/** FR-SDD-9: the review session's prompt — the brief, the base, the handoff file, then `review.md` whole. */
export function reviewPrompt(input: { id: string; brief: string; base: string; workflow: string }): string {
  return [
    `Review ${input.id}. Read ${input.brief} first: it replaces SPEC.md, PLAN.md and TASKS.md for this session.`,
    `The diff is \`git diff ${input.base}...HEAD\`. The handoff file is ${findingsPath(input.id)}: write it even when it stays empty, and change nothing else.`,
    'Follow this procedure:',
    '',
    input.workflow.trim(),
  ].join('\n');
}

/**
 * FR-SDD-16, D-1065: the fix session's prompt — `fix-ci.md` whole, then the
 * review's findings as written and the CI failure digest, never a log or a
 * transcript.
 */
export function fixPrompt(input: { id: string; brief: string; workflow: string; findings: readonly string[]; digest: string | null }): string {
  const parts = [
    `Fix ${input.id} on this branch. Read ${input.brief} for the task's scope and done-when. This is a headless session: decide and record rather than ask, and commit each fix as it passes.`,
    `When done, write the summary to sdd-run/${input.id}.summary.md, replacing the one there. Follow this procedure:`,
    '',
    input.workflow.trim(),
  ];
  if (input.findings.length > 0) parts.push('', '## The findings', '', ...input.findings);
  if (input.digest !== null) parts.push('', '## The failure digest', '', input.digest.trim());
  return parts.join('\n');
}
