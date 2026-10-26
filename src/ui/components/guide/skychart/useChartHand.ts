import { useMemo, useState } from 'react';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import type { ChartHand, HandSlot } from './SkyChart.types';
import type { HandCamera } from './window/camera';

/**
 * D-789 (R121 review): the window-in-the-box state, held by whoever calls
 * this — the live page for its charts, a chart for itself elsewhere. The slot
 * is a box the window fills in its own chunk (the camera is not made here, so
 * `camera.ts` stays out of the main chunk). The compact choice is reset the
 * moment the layout is wide, during the render that sees it, so no stale
 * `true` waits for the next compact render to override the saved view.
 */
export function useChartHand(): ChartHand {
  const compact = useLayoutMode() === 'compact';
  const [chosen, setChosen] = useState(false);
  if (chosen && !compact) setChosen(false);
  const [slot] = useState<HandSlot>(() => {
    let kept: HandCamera | null = null;
    return {
      get: () => kept,
      keep: (camera) => {
        kept = camera;
      },
    };
  });
  const handWindow = chosen && compact;
  return useMemo(() => ({ slot, window: handWindow, setWindow: setChosen }), [slot, handWindow]);
}
