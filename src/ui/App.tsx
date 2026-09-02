import { useEffect, useState } from 'react';
import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import type { EpochMs, Observer } from '../model';
import { CoordsInput } from './components/location/CoordsInput';
import { PassList, type ElementsState } from './components/passes/PassList';

/**
 * R3: elements for the whole catalog are fetched once on mount (no cache yet,
 * FR-SAT-6 arrives in R11); the store and worker arrive in R5. `App` still
 * imports `src/data` directly until then. The clock is read here, in the UI,
 * at the moment the observer changes (D-15).
 */
export function App() {
  const [observer, setObserver] = useState<Observer | null>(null);
  const [nowMs, setNowMs] = useState<EpochMs>(0);
  const [elements, setElements] = useState<ElementsState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    loadElements(CATALOG, { signal: controller.signal })
      .then(({ records, unavailable }) => {
        setElements({ status: 'ready', records, unavailable });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setElements({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      controller.abort();
    };
  }, []);

  const handleObserver = (next: Observer | null): void => {
    setObserver(next);
    setNowMs(Date.now());
  };

  return (
    <main>
      <h1>What is in your sky right now</h1>
      <CoordsInput onObserver={handleObserver} />
      <PassList observer={observer} elements={elements} nowMs={nowMs} />
    </main>
  );
}
