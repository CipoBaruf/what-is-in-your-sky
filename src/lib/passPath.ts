import type { Pass } from '../model';
import { compassPoint, type CompassPoint } from './compass';

/**
 * R81 (FR-FIRST-3, FR-FIRST-10, D-507): where a pass goes, as the next-event
 * block's path line writes it — `NW low → 68° N → SE`. Three ends, each a
 * compass point and, where it says something, an altitude, by the pass's own
 * boundary reasons (FR-VIS-3):
 *
 * - the start is `low` when the pass rises at the elevation threshold (a
 *   `horizon` start: it climbs out of the murk near the horizon), and its
 *   altitude otherwise — it leaves Earth's shadow, or the sky darkens round it,
 *   already that high, and that is where to be looking;
 * - the peak is always its altitude and its compass point;
 * - the end carries its altitude when it ends above the threshold (into
 *   shadow, or fading into a brightening sky), and nothing when it sets at the
 *   threshold, where the reader's eye follows it down anyway.
 *
 * Pure numbers and points; the catalog words them (`nextEvent.path`), so the
 * two languages order them as they like.
 */
export interface PathEnd {
  point: CompassPoint;
  /** Whole degrees above the horizon, or `low` for a rise at the threshold, or null where the end carries none. */
  altitude: number | 'low' | null;
}

export interface PassPath {
  start: PathEnd;
  peak: { point: CompassPoint; altitude: number };
  end: PathEnd;
}

export function passPath(pass: Pass): PassPath {
  return {
    start: { point: compassPoint(pass.start.azDeg), altitude: pass.startReason === 'horizon' ? 'low' : Math.round(pass.start.elDeg) },
    peak: { point: compassPoint(pass.peak.azDeg), altitude: Math.round(pass.peak.elDeg) },
    end: { point: compassPoint(pass.end.azDeg), altitude: pass.endReason === 'horizon' ? null : Math.round(pass.end.elDeg) },
  };
}
