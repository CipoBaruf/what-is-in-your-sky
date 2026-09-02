import { useEffect, useState } from 'react';
import { fetchGroup } from '../data/celestrak';
import type { EpochMs, Observer } from '../model';
import { CoordsInput } from './components/location/CoordsInput';
import { NextPassLine, type ElementsState } from './components/passes/NextPassLine';

/**
 * R2: the thinnest product. Elements are fetched once on mount (no cache yet,
 * FR-SAT-6 arrives in R11); the store, worker and catalog arrive in R3–R5.
 * The clock is read here, in the UI, at the moment the observer changes (D-15).
 */
export function App() {
  const [observer, setObserver] = useState<Observer | null>(null);
  const [nowMs, setNowMs] = useState<EpochMs>(0);
  const [elements, setElements] = useState<ElementsState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchGroup('stations', { signal: controller.signal })
      .then((records) => {
        setElements({ status: 'ready', records });
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
      <NextPassLine observer={observer} elements={elements} nowMs={nowMs} />
    </main>
  );
}
