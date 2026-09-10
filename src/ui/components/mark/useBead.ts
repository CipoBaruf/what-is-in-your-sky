import { useEffect, useState } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MARK_FRAME_MS, MARK_ORBIT_FRAMES } from './tiers';

/** FR-MARK-5: the one query the mark asks about the reader. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * R74 (FR-MARK-5): which pre-rasterised bead frame to draw.
 *
 * A `setInterval` a second apart, not `requestAnimationFrame`: the bead's
 * positions are `MARK_ORBIT_FRAMES` committed rasters, one per second of the
 * orbit, so a step is a text swap and between steps the page does nothing at
 * all. `running` is false whenever the thing the mark is reporting on has
 * settled — the home page's list is computed, the live page is holding an
 * instant — and under `prefers-reduced-motion: reduce` the bead never advances
 * for anyone; the tone and the word beside it still change, so no state is
 * carried by motion alone.
 */
export function useBead(running: boolean): number {
  const reduced = useMediaQuery(REDUCED_MOTION);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!running || reduced) return;
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % MARK_ORBIT_FRAMES);
    }, MARK_FRAME_MS);
    return () => {
      clearInterval(timer);
    };
  }, [running, reduced]);
  return frame;
}
