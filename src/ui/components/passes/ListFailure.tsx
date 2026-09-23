import { useT } from '../../../i18n/useT';
import { useAppStore, type ElementsState, type Failure, type PassesState } from '../../../state';
import { FailureLine } from '../common/FailureLine';

/**
 * R91 (FR-FAIL-1, FR-FAIL-4, US-33 AC1 and AC3): what the pass list's status
 * line says when the list could not be had. Two things feed it and either can
 * fail: the elements load, and the pass job — a job the worker reported as
 * failed, a worker that died (`error`, `messageerror`) or one that went
 * `JOB_STALL_S` without progress (R86). Either takes the place of
 * "Computing…" with the failure line, and the job's `error` status is what
 * already stops the header mark's bead (`isLoading` reads `computing`).
 *
 * `[ retry ]` is the slice's own action (D-541): the elements' re-enters the
 * first load, the job's starts a new one on a new worker when the last one
 * died (D-543). Both put their slice back into loading or computing, so the
 * status line's progress text replaces this line on the next render.
 *
 * With a stored or earlier run still on screen under it, the line says that
 * list is what the page is using instead.
 */
export type ListFailureSite = { site: 'elements'; failure: Failure } | { site: 'passes'; failure: Failure };

/** Which of the two failed, the elements first: with no elements there was no job to fail. */
export function listFailure(elements: ElementsState, passes: PassesState): ListFailureSite | null {
  if (elements.status === 'error') return { site: 'elements', failure: elements.failure };
  if (elements.status === 'ready' && passes.status === 'error') return { site: 'passes', failure: passes.error ?? { kind: 'unknown', detail: '' } };
  return null;
}

export interface ListFailureProps {
  failed: ListFailureSite;
  /** A list is on screen below the line: a stored run, or the earlier run a failed recompute left up. */
  showingList: boolean;
}

export function ListFailure({ failed, showingList }: ListFailureProps) {
  const t = useT();
  const retryElements = useAppStore((s) => s.retryElements);
  const retryPasses = useAppStore((s) => s.retryPasses);
  const instead = showingList ? { instead: t.failure.instead.storedList } : {};
  return (
    <FailureLine
      failure={failed.failure}
      what={failed.site === 'elements' ? t.failure.what.elements : t.failure.what.passes}
      site={failed.site}
      onRetry={failed.site === 'elements' ? retryElements : retryPasses}
      {...instead}
    />
  );
}
