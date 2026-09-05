import { useEffect, useRef, useState } from 'react';
import { HIDDEN_EVERY_MS } from '../../../lib/playback';
import type { EpochMs, NowState, Observer } from '../../../model';
import { computeNowAt } from '../../../state';
import { useWallThrottle } from './useWallThrottle';

/**
 * R33 (FR-LIVE-6, D-81, D-169): the worker's answer for the shown instant
 * while the hidden objects are on. The instant is throttled to one request
 * per 250 ms of wall time (`useWallThrottle`, with the trailing update so the
 * instant a scrub stops at is always asked for), and a reply is dropped when a
 * later request has gone out since — `t` moved past it — so the dome never
 * shows an older instant's objects over a newer one's arcs. Off, or failing,
 * the answer is `null` and the page dims nothing; turned back on, the last
 * answer stands for the round trip it takes the new one to land.
 */
export function useHiddenObjects(observer: Observer, t: EpochMs, enabled: boolean): NowState | null {
  const [state, setState] = useState<NowState | null>(null);
  const asked = useWallThrottle(t, HIDDEN_EVERY_MS);
  const sequence = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const id = ++sequence.current;
    computeNowAt(observer, asked).then(
      (answer) => {
        if (id === sequence.current) setState(answer);
      },
      () => {
        // No worker, or the elements are not loaded: nothing to dim, and nothing to say about it here.
      },
    );
  }, [observer, asked, enabled]);
  return enabled ? state : null;
}
