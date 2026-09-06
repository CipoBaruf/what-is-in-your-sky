import type { Pass, PassPoint } from '../model';
import { ARC_LINGER_MS, ARC_LOOKAHEAD_MS } from '../physics/constants';
import { interpolateTrack } from './skyGeometry';

/**
 * FR-TRAJ-1 / D-189 (R45): what state a pass's arc is in at the shown
 * instant `t`, computed once here and carried per pass in `SkyChartProps`
 * so the dome, the polar chart, the window and the legend cannot disagree.
 *
 *   full    the whole arc as the pass detail draws it: `t` is undefined, or
 *           the caller wants the whole arc whatever the instant (FR-TRAJ-3)
 *   live    start ≤ t ≤ end — the arc from the rise to the position at `t`,
 *           solid, with the marker; nothing beyond `t`
 *   ahead   t < start ≤ t + ARC_LOOKAHEAD — the whole arc faint and dotted,
 *           the rise point marked, no marker
 *   linger  t − ARC_LINGER ≤ end < t — the whole arc faint, no marker
 *   hidden  otherwise: not drawn, not listed
 *
 * Pure: no React, no clock. The thresholds are `physics/constants.ts`'s
 * (FR-TRAJ-2), beside the other thresholds.
 */
export type ArcState = 'hidden' | 'ahead' | 'live' | 'linger' | 'full';

export const ARC_STATES: readonly ArcState[] = ['hidden', 'ahead', 'live', 'linger', 'full'];

export function arcState(pass: Pick<Pass, 'start' | 'end'>, t: number | undefined): ArcState {
  if (t === undefined || !Number.isFinite(t)) return 'full';
  if (t >= pass.start.t && t <= pass.end.t) return 'live';
  if (t < pass.start.t) return pass.start.t <= t + ARC_LOOKAHEAD_MS ? 'ahead' : 'hidden';
  return pass.end.t >= t - ARC_LINGER_MS ? 'linger' : 'hidden';
}

/** Whether an arc in this state is drawn at all — and, the same question, whether the legend lists it (FR-LEG-2). */
export const isDrawn = (state: ArcState): boolean => state !== 'hidden';

/**
 * The track up to `t`: every sample at or before it, with the interpolated
 * position at `t` appended so the cut ends exactly under the live marker.
 * Before the start it is the rise point alone; at or after the end it is the
 * whole track. A sample whose time is exactly `t` is not doubled.
 */
export function cutTrack(pass: Pick<Pass, 'track'>, t: number): PassPoint[] {
  const { track } = pass;
  const first = track[0];
  const last = track[track.length - 1];
  if (!first || !last) return [];
  if (t <= first.t) return [first];
  if (t >= last.t) return [...track];
  const before = track.filter((p) => p.t < t);
  const at = interpolateTrack(track, t);
  const previous = before[before.length - 1];
  return previous && previous.t === at.t ? before : [...before, at];
}
