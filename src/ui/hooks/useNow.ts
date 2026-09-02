import { useEffect, useState } from 'react';
import type { EpochMs } from '../../model';

/** The wall clock, re-read every `intervalMs` while mounted. UI code may read the clock; `src/lib` may not (D-15). R6 (PassDetail); shared from R11. */
export function useNow(intervalMs: number): EpochMs {
  const [now, setNow] = useState<EpochMs>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
