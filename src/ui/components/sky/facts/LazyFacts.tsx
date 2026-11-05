import { lazy, Suspense, useEffect } from 'react';
import { loadGlobe } from '../../../screens/stars/globeChunk';
import { whenIdle } from '../../../screens/whenIdle';
import type { FactsGroupProps } from './FactsGroup';

/**
 * R188 (FR-WIDE-11, D-1101): the pages' side of the `facts` chunk — fetched when a group first opens, and on wide
 * prefetched on idle once the globe's chunk is in; compact asks for nothing. A failed fetch is dropped, so the next
 * ask fetches again (`globeChunk.ts`'s shape).
 */
type FactsModule = typeof import('./facts');
let facts: Promise<FactsModule> | undefined;

function loadFacts(): Promise<FactsModule> {
  facts ??= import('./facts').catch((reason: unknown) => {
    facts = undefined;
    throw reason;
  });
  return facts;
}

/** FR-WIDE-11: after the globe, on idle, on wide only. */
export function useFactsPrefetch(wide: boolean): void {
  useEffect(() => {
    if (!wide) return;
    let cancel: (() => void) | undefined;
    let live = true;
    loadGlobe()
      .catch(() => undefined)
      .then(() => {
        if (live)
          cancel = whenIdle(() => {
            loadFacts().catch(() => undefined);
          });
      })
      .catch(() => undefined);
    return () => {
      live = false;
      cancel?.();
    };
  }, [wide]);
}

const Group = lazy(() => loadFacts());

/** The group, lazy: nothing in its place while the chunk is on its way. */
export function LazyFacts(props: FactsGroupProps) {
  return (
    <Suspense fallback={null}>
      <Group {...props} />
    </Suspense>
  );
}
