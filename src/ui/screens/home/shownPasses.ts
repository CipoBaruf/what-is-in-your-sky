import type { Pass } from '../../../model';
import { useAppStore } from '../../../state';

const NO_PASSES: readonly Pass[] = [];

/** The stored run's passes as the list shows them: a stored run shows whatever the elements are doing (D-108). */
export function useShownPasses(): readonly Pass[] {
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  return passes.passes.length > 0 && (elements.status === 'ready' || passes.storedAt !== null) ? passes.passes : NO_PASSES;
}

/** Why the next-event block may have nothing to count to: how many elements there are, or null while they load. */
export function usePassContext(): { elementCount: number | null; hasDarkness: boolean | null; pending: boolean } {
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const elementCount = elements.status === 'ready' ? elements.records.length : elements.status === 'error' ? 0 : null;
  const pending = elements.status === 'idle' || elements.status === 'loading' || (elementCount !== 0 && passes.status !== 'done' && passes.status !== 'error');
  return { elementCount, hasDarkness: passes.hasDarkness, pending };
}
