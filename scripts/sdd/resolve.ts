/**
 * D-1315: the conflicts every parallel task makes, resolved the way the owner's `resolve-sdd.sh`
 * did in v2.14. A phase `plan.md` keeps both sides' rows (main's first, then the branch's); the
 * generated files are taken from either side and regenerated; the i18n key snapshot is rewritten
 * by its own test. A conflict in any other file is not this module's to resolve.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Files a generator writes; whichever side is checked out, the generators rewrite them. */
export const GENERATED_FILES = ['docs/sdd/ids.md', 'docs/sdd/reference/traceability.md', 'docs/sdd/map.md'] as const;
/** The sorted i18n key snapshot, rewritten by `vitest -u` on its test. */
export const I18N_SNAPSHOT = 'src/i18n/__snapshots__/messages.test.ts.snap';
const PLAN_DOC = /^docs\/sdd\/phases\/[^/]+\/plan\.md$/;

export type SharedKind = 'plan' | 'generated' | 'snapshot';

/** Which kind of shared file `path` is, or `null` for any other file. */
export function sharedKind(path: string): SharedKind | null {
  if (PLAN_DOC.test(path)) return 'plan';
  if ((GENERATED_FILES as readonly string[]).includes(path)) return 'generated';
  if (path === I18N_SNAPSHOT) return 'snapshot';
  return null;
}

/**
 * Every conflict hunk of `text` replaced by both its sides, main's first. `mainSide` says which
 * side main is: `ours` in a rebase onto main (HEAD is main), `theirs` in a merge of main into the
 * branch. A diff3 base section is dropped. `null` when the text has no conflict.
 */
export function unionConflicts(text: string, mainSide: 'ours' | 'theirs'): string | null {
  if (!/^<{7} /m.test(text)) return null;
  const out: string[] = [];
  let ours: string[] = [];
  let theirs: string[] = [];
  let state: 'none' | 'ours' | 'base' | 'theirs' = 'none';
  for (const line of text.split('\n')) {
    if (state === 'none' && line.startsWith('<<<<<<< ')) state = 'ours';
    else if (state === 'ours' && line.startsWith('||||||| ')) state = 'base';
    else if ((state === 'ours' || state === 'base') && line === '=======') state = 'theirs';
    else if (state === 'theirs' && line.startsWith('>>>>>>> ')) {
      out.push(...(mainSide === 'ours' ? [...ours, ...theirs] : [...theirs, ...ours]));
      ours = [];
      theirs = [];
      state = 'none';
    } else if (state === 'ours') ours.push(line);
    else if (state === 'theirs') theirs.push(line);
    else if (state === 'none') out.push(line);
  }
  return out.join('\n');
}

/** What the resolver needs from git and the repo's generators; the driver passes real commands, a test passes its own. */
export interface ResolveIo {
  /** Paths git reports as unmerged. */
  conflicted(): Promise<string[]>;
  /** `git checkout --ours|--theirs -- path` (the side does not matter, the file is regenerated). */
  checkoutSide(path: string): Promise<boolean>;
  /** Rewrites ids.md, traceability.md and map.md from the tree. */
  regenerate(): Promise<boolean>;
  /** Rewrites the i18n key snapshot. */
  regenerateSnapshot(): Promise<boolean>;
  /** `git add` the paths. */
  add(paths: readonly string[]): Promise<boolean>;
}

/**
 * D-1315: resolves the current conflict when every conflicted file is a shared one, and stages
 * the result. `false` (nothing touched) when any other file conflicts or a step fails.
 */
export async function resolveSharedConflicts(dir: string, mainSide: 'ours' | 'theirs', io: ResolveIo): Promise<boolean> {
  const conflicted = await io.conflicted();
  if (conflicted.length === 0 || conflicted.some((path) => sharedKind(path) === null)) return false;
  for (const path of conflicted.filter((file) => sharedKind(file) === 'plan')) {
    const merged = unionConflicts(readFileSync(join(dir, path), 'utf8'), mainSide);
    if (merged === null) return false;
    writeFileSync(join(dir, path), merged);
  }
  for (const path of conflicted.filter((file) => sharedKind(file) !== 'plan')) if (!(await io.checkoutSide(path))) return false;
  if (!(await io.regenerate())) return false;
  if (conflicted.includes(I18N_SNAPSHOT) && !(await io.regenerateSnapshot())) return false;
  return io.add([...new Set([...conflicted, ...GENERATED_FILES])].filter((path) => existsSync(join(dir, path))));
}
