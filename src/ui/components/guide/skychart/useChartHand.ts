import { useState } from 'react';
import { appStore } from '../../../../state';
import type { ChartHand, HandSlot } from './SkyChart.types';
import type { HandCamera } from './window/camera';

/**
 * D-789 (R121 review): the window-in-the-box state, held by whoever calls
 * this — the live page for its charts, a chart for itself elsewhere. The slot
 * is a box the window fills in its own chunk (the camera is not made here, so
 * `camera.ts` stays out of the main chunk).
 *
 * R132 (FR-FLOW-6, D-848): the slot carries the first gesture too. The views
 * call `gesture()` on every pointer down on the drawing; the first one sets
 * `skyHintSeen` in the store, which is saved in the prefs, and the hint under
 * the drawing (`SkyHint`) is gone for good. Read off the store at the call,
 * not subscribed: a drag's frame must not re-render the page that holds this.
 */
export function markSkyHintSeen(): void {
  const state = appStore.getState();
  if (!state.skyHintSeen) state.setSkyHintSeen(true);
}

/** An empty slot: the first window to mount fills it, and every later one takes its camera. */
function createChartHand(): ChartHand {
  let kept: HandCamera | null = null;
  const slot: HandSlot = {
    get: () => kept,
    keep: (camera) => {
      kept = camera;
    },
    gesture: markSkyHintSeen,
  };
  return { slot };
}

export function useChartHand(): ChartHand {
  const [hand] = useState<ChartHand>(createChartHand);
  return hand;
}

/**
 * R190 (R186's note): one slot per visit of a route — a new one each time `active` rises — for a page its parent
 * mounts in a different tree on each side of the wide breakpoint (the live page), so a resize keeps the facing.
 */
export function useVisitHand(active: boolean): ChartHand {
  const [held, setHeld] = useState(() => ({ active, hand: createChartHand() }));
  if (held.active !== active) setHeld({ active, hand: active ? createChartHand() : held.hand });
  return held.hand;
}
