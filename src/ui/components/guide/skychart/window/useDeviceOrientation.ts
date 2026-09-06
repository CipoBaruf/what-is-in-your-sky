import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { orientationApiPresent, orientationEventName, screenAngle } from '../../../live/compassHeading';
import { orientationAnswer, orientationGestureNeeded, orientationRequestInFlight, requestOrientationAccess, type OrientationAnswer } from './orientationAccess';
import { alphaFor, calibrationSample, converged, OffsetEstimate, rotationMatrix, settling, smoothRotation, WINDOW_SMOOTHING, windowReadingFrom, type Mat3 } from './projection';

/**
 * R47 (FR-WIN-3, FR-WIN-4, FR-WIN-5; D-188, D-240): the phone's orientation
 * as one rotation for the sky window — `useFollowPhone` (D-175) extended from
 * a heading to the three angles, with the R38 spike's sensor path
 * (`docs/window/FINDINGS.md`) made product.
 *
 *   - The listener is Chrome's absolute event where the window has it and the
 *     plain one elsewhere (iOS, which puts the compass on it).
 *   - Each reading is kept as the latest and feeds the compass calibration
 *     (`calibrationSample` → `OffsetEstimate`, while the phone is upright);
 *     the picture is computed in an animation frame, never in the event: the
 *     fused heading (`alphaFor`, corrected to true north by the observer's
 *     declination, R44), the W3C rotation from the three angles, then
 *     `smoothRotation` by `WINDOW_SMOOTHING` toward it. One state update per
 *     frame at most, and where the sensor is slower than the display (iOS
 *     Chrome's 10 readings a second) the frames keep coming, easing toward
 *     the latest reading until `converged` — so the window draws at the
 *     display rate whatever the sensor's (FR-WIN-3's ≥ 30/s).
 *   - The screen's angle is read once and again on every orientation change,
 *     and handed out for the projection's `screenAngleDeg`.
 *
 * States: `idle` before anything (the gate, or a phone that has been armed
 * and said nothing yet — F-42's lesson: armed is not on); `waiting` between
 * the tap and the first reading with a heading (iOS's settling compass, the
 * request in flight); `on` with a rotation; `relative` when a reading carries
 * no north at all (FR-LIVE-8's case, which the boundary turns into a note and
 * drops the option on); `denied` when the permission was refused.
 *
 * `start` is the `[ point at the sky ]` control's click: it asks (iOS) and
 * arms. Where no gesture is needed — no request exists, or the toggle's tap
 * already got the grant — the hook arms itself on mount; a request still in
 * flight from that tap is awaited.
 */
export type OrientationState = 'idle' | 'waiting' | 'on' | 'relative' | 'denied';

export interface DeviceOrientationHandle {
  /** D-175's presence test: a touch screen with the constructor. */
  available: boolean;
  /** FR-WIN-5: a tap is still needed before the browser will give orientation. */
  needsGesture: boolean;
  state: OrientationState;
  /** The smoothed device → earth rotation, at most one per frame; `null` before the first reading. */
  rotation: Mat3 | null;
  /** `screen.orientation.angle`, degrees, kept current. */
  screenAngleDeg: number;
  /** The control's click: ask inside the gesture, then listen. */
  start: () => void;
}

export function useDeviceOrientation(declinationDeg = 0): DeviceOrientationHandle {
  const available = useMemo(() => typeof window !== 'undefined' && orientationApiPresent(), []);
  const [needsGesture, setNeedsGesture] = useState(() => available && orientationGestureNeeded());
  const [armed, setArmed] = useState(false);
  const [state, setState] = useState<OrientationState>('idle');
  const [rotation, setRotation] = useState<Mat3 | null>(null);
  const [screenAngleDeg, setScreenAngleDeg] = useState(() => (typeof window === 'undefined' ? 0 : screenAngle()));

  // The declination changes only with the observer; a ref keeps it out of the listener's dependencies.
  const declination = useRef(declinationDeg);
  useEffect(() => {
    declination.current = declinationDeg;
  }, [declinationDeg]);

  const answered = useCallback((answer: OrientationAnswer) => {
    if (answer === 'granted') {
      setNeedsGesture(false);
      setArmed(true);
      return;
    }
    setState('denied');
  }, []);

  // Armed without a tap where none is needed (Android; the toggle's grant), or the tap's request awaited.
  useEffect(() => {
    if (!available) return;
    if (orientationAnswer() === 'denied') {
      // The toggle's tap was refused before this mounted: the note, not a second prompt.
      setState('denied');
      return;
    }
    const pending = orientationRequestInFlight();
    if (pending) {
      let live = true;
      setState('waiting');
      void pending.then((answer) => {
        if (live) answered(answer);
      });
      return () => {
        live = false;
      };
    }
    if (!orientationGestureNeeded()) setArmed(true);
    return undefined;
  }, [available, answered]);

  useEffect(() => {
    if (!armed) return;
    const latest: { reading: ReturnType<typeof windowReadingFrom> | null } = { reading: null };
    const offset = new OffsetEstimate();
    let smoothed: Mat3 | null = null;
    let frame = 0;
    const draw = (): void => {
      frame = 0;
      const reading = latest.reading;
      if (!reading) return;
      const alpha = alphaFor(reading, offset.get(), declination.current);
      if (alpha === null || reading.beta === null || reading.gamma === null) {
        setState('relative');
        return;
      }
      const target = rotationMatrix(alpha, reading.beta, reading.gamma);
      const next = smoothRotation(smoothed, target, WINDOW_SMOOTHING);
      smoothed = next;
      setRotation(next);
      setState('on');
      // The sensor may be slower than the display: keep easing toward the latest reading until it has arrived.
      if (!converged(next, target)) frame = requestAnimationFrame(draw);
    };
    const onReading = (event: Event): void => {
      const reading = windowReadingFrom(event as DeviceOrientationEvent);
      const sample = calibrationSample(reading);
      if (sample !== null) offset.add(sample);
      if (settling(reading)) {
        // iOS's first events: heading 0 with accuracy −1, not a reading yet (R38, measured).
        setState((current) => (current === 'on' ? current : 'waiting'));
        return;
      }
      latest.reading = reading;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const name = orientationEventName();
    window.addEventListener(name, onReading);
    return () => {
      window.removeEventListener(name, onReading);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [armed]);

  // The screen's angle: the projected plane turns with it (FR-WIN-3, R38's `+angle`).
  useEffect(() => {
    if (!available) return;
    const update = (): void => {
      setScreenAngleDeg(screenAngle());
    };
    const orientation = window.screen.orientation as ScreenOrientation | undefined;
    orientation?.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      orientation?.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [available]);

  const start = useCallback(() => {
    if (!available) return;
    // The refusal's note belongs to the answer before this tap, not to the reading this one is waiting for.
    setState((current) => (current === 'denied' ? 'waiting' : current === 'idle' ? 'waiting' : current));
    void requestOrientationAccess().then(answered);
  }, [available, answered]);

  return { available, needsGesture, state, rotation, screenAngleDeg, start };
}
