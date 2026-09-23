import { useMemo } from 'react';
import { ENDED_LINGER_MS } from '../../../lib/nights';
import type { EpochMs, Pass } from '../../../model';
import { useAppStore } from '../../../state';

const NO_PASSES: readonly Pass[] = [];

/**
 * FR-NIGHT-2 (D-535): the clock the shown list is pruned by — the `now`
 * slice's instant, which FR-VIS-5 already advances every 10 s while the tab
 * is visible, so no new timer. Before the worker has answered once (or with
 * no elements for it to answer from) it is the instant the observer was set,
 * which is the page's load for a stored run. The wall clock is never read
 * here (D-15), so a test sets the store and the list follows.
 */
export function useShownClock(): EpochMs {
  const state = useAppStore((s) => s.now.state);
  const nowMs = useAppStore((s) => s.nowMs);
  return state?.t ?? nowMs;
}

/** True once the pass is over on the shown clock: its card reads `ended` while it lingers (FR-NIGHT-2). */
export function hasEnded(pass: Pass, clock: EpochMs): boolean {
  return pass.end.t <= clock;
}

/**
 * The stored run's passes as the list shows them: a stored run shows whatever
 * the elements are doing (D-108), less the passes that have left (FR-NIGHT-2,
 * D-535) — a pass whose end is more than `ENDED_LINGER_S` behind the shown
 * clock is not a card, not in the count line or a night's count and not a
 * tick on tonight's stripe, all of which read this one selector. `keep` is
 * the open pass, exempt while it is open (FR-DESK-3's marked card).
 *
 * The array is kept between ticks that drop nothing: a re-grouping, and a
 * re-drawn stripe, every 10 s would be work for no change.
 */
export function useShownPasses(keep: string | null = null): readonly Pass[] {
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const clock = useShownClock();
  const stored = passes.passes.length > 0 && (elements.status === 'ready' || passes.storedAt !== null) ? passes.passes : NO_PASSES;
  const cutoff = clock - ENDED_LINGER_MS;
  const gone = stored
    .filter((pass) => pass.end.t < cutoff && pass.id !== keep)
    .map((pass) => pass.id)
    .join('\n');
  return useMemo(() => {
    if (gone === '') return stored;
    const ids = new Set(gone.split('\n'));
    const left = stored.filter((pass) => !ids.has(pass.id));
    return left.length === 0 ? NO_PASSES : left;
  }, [stored, gone]);
}

/** Why the next-event block may have nothing to count to: how many elements there are, or null while they load. */
export function usePassContext(): { elementCount: number | null; hasDarkness: boolean | null; pending: boolean } {
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const elementCount = elements.status === 'ready' ? elements.records.length : elements.status === 'error' ? 0 : null;
  const pending = elements.status === 'idle' || elements.status === 'loading' || (elementCount !== 0 && passes.status !== 'done' && passes.status !== 'error');
  return { elementCount, hasDarkness: passes.hasDarkness, pending };
}
