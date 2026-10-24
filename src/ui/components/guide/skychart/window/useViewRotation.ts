import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { handRotation, type HandState, type SkyCamera } from './camera';
import type { Mat3 } from './projection';
import { useDeviceOrientation, type DeviceOrientationHandle } from './useDeviceOrientation';

/**
 * R113 (FR-STAR-4, FR-STAR-9 as amended, FR-STAR-11; PLAN D-750, D-751): the
 * one rotation, whichever source drives it, published two ways in one commit.
 *
 * The **source**: under the sensor the rotation is `useDeviceOrientation`'s,
 * smoothed and quartered as before, or the caller's `fallback` — the window's
 * placeholder, the phone held upright toward the peak — until the first
 * reading; under the hand it is `handRotation` of the camera's state, read
 * with `useSyncExternalStore` so a move the window's handlers make lands as
 * one render. The sensor hook is not armed under the hand (`enabled` false):
 * a phone on the stars page would otherwise listen, ease and re-render at the
 * sensor's rate for a rotation nobody reads.
 *
 * The **channel** (D-751): the rotation goes to React state — it is the
 * render's value, and the window's existing layers, the readout, the ground
 * state and the gutter draw from it — and, in the layout effect of the same
 * commit, to every subscriber, which is how the star field writes its nodes
 * outside render (D-744). A layout effect runs after React has written the
 * commit's DOM and before the browser paints it, so the horizon the render
 * drew and the stars the subscribers placed are from one rotation at every
 * paint; nothing is published between commits, so a subscriber sees exactly
 * one call per rotation the window drew. A subscriber that arrives late is
 * given the current rotation at once, so a field mounted after the first
 * reading does not wait for the next.
 */
export type RotationListener = (rotation: Mat3) => void;

export interface ViewRotation {
  /** The rotation this render draws: the source's, or `fallback` while the sensor has none. */
  rotation: Mat3;
  /** Whether the source itself gave `rotation` — a reading has arrived, or the hand drives. */
  live: boolean;
  /** One call per rotation the window draws, in the commit that draws it; the current one at once. Returns the unsubscribe. */
  subscribe: (listener: RotationListener) => () => void;
  /** The sensor's handle, for the window's state machine; a device without the API under the hand. */
  orientation: DeviceOrientationHandle;
}

const noHand = (): null => null;
const neverChanges = (): (() => void) => () => {
  /* the sensor camera has no state to watch */
};

export function useViewRotation(camera: SkyCamera, declinationDeg: number, fallback: Mat3): ViewRotation {
  const byHand = camera.source === 'hand';
  const orientation = useDeviceOrientation(declinationDeg, !byHand);
  const hand: HandState | null = useSyncExternalStore(byHand ? camera.subscribe : neverChanges, byHand ? camera.get : noHand, byHand ? camera.get : noHand);
  const sensed = orientation.rotation;
  const rotation = useMemo(() => (hand ? handRotation(hand) : (sensed ?? fallback)), [hand, sensed, fallback]);

  const listeners = useRef(new Set<RotationListener>());
  const current = useRef<Mat3 | null>(null);
  useLayoutEffect(() => {
    current.current = rotation;
    for (const listener of [...listeners.current]) listener(rotation);
  }, [rotation]);
  const subscribe = useCallback((listener: RotationListener) => {
    listeners.current.add(listener);
    if (current.current) listener(current.current);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return { rotation, live: hand !== null || sensed !== null, subscribe, orientation };
}
