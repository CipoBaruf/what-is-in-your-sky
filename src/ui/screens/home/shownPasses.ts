import { useMemo } from 'react';
import { splitFaint } from '../../../lib/faint';
import { isNoEvent, nextEvent } from '../../../lib/nextEvent';
import { ENDED_LINGER_MS } from '../../../lib/nights';
import type { EpochMs, Pass } from '../../../model';
import { isFeatured, useAppStore } from '../../../state';

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
  return useListedPasses(keep).shown;
}

/**
 * The list's two numbers from one selector (FR-FAINT-2, D-623).
 *
 * `shown` is what is drawn: cards, a night's count, the stripe's ticks.
 * `faint` is every faint pass still in the window, whether shown or not, so
 * the count line reads "28 visible passes in 72 h · [ show 12 faint ]" and,
 * shown, "40 … · [ hide 12 faint ]" from the same arrays. `listed` is the
 * window before the faint filter, which the nights are cut from so that a
 * night with only faint passes keeps its heading ("0 passes · 3 faint").
 */
export interface ListedPasses {
  shown: readonly Pass[];
  faint: readonly Pass[];
  listed: readonly Pass[];
  showFaint: boolean;
}

/**
 * `notEnded → notFaint(showFaint)` (D-623). The exemptions are the ISS, the
 * pass the next-event block names — `nextEvent` over the window before this
 * filter, on the same clock, so it is the pass the block will name after it —
 * and `keep`, the open pass.
 */
export function useListedPasses(keep: string | null = null): ListedPasses {
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const showFaint = useAppStore((s) => s.showFaint);
  const clock = useShownClock();
  const stored = passes.passes.length > 0 && (elements.status === 'ready' || passes.storedAt !== null) ? passes.passes : NO_PASSES;
  const cutoff = clock - ENDED_LINGER_MS;
  const gone = stored
    .filter((pass) => pass.end.t < cutoff && pass.id !== keep)
    .map((pass) => pass.id)
    .join('\n');
  const listed = useMemo(() => {
    if (gone === '') return stored;
    const ids = new Set(gone.split('\n'));
    const left = stored.filter((pass) => !ids.has(pass.id));
    return left.length === 0 ? NO_PASSES : left;
  }, [stored, gone]);
  const next = nextEvent(listed, clock);
  const nextEventId = isNoEvent(next) ? null : next.pass.id;
  return useMemo(() => {
    const { bright, faint } = splitFaint(listed, { isIss: isFeatured, nextEventId, openId: keep });
    if (faint.length === 0) return { shown: listed, faint: NO_PASSES, listed, showFaint };
    return { shown: showFaint ? listed : bright.length === 0 ? NO_PASSES : bright, faint, listed, showFaint };
  }, [listed, nextEventId, keep, showFaint]);
}

/** Whether the list draws a pass as faint (FR-FAINT-2: its name in `--fg-dim`, a `[faint]` tag). */
export function faintIds(listed: ListedPasses): ReadonlySet<string> {
  return new Set(listed.faint.map((pass) => pass.id));
}

/** Why the next-event block may have nothing to count to: how many elements there are, or null while they load. */
export function usePassContext(): { elementCount: number | null; hasDarkness: boolean | null; pending: boolean } {
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const elementCount = elements.status === 'ready' ? elements.records.length : elements.status === 'error' ? 0 : null;
  const pending = elements.status === 'idle' || elements.status === 'loading' || (elementCount !== 0 && passes.status !== 'done' && passes.status !== 'error');
  return { elementCount, hasDarkness: passes.hasDarkness, pending };
}
