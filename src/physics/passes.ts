import type { EpochMs, NoradId, Observer, Pass, PassBoundaryReason, PassPoint, TimeWindow, VisibilityThresholds } from '../model';
import { BISECTION_TOLERANCE_MS, COARSE_STEP_MS, DENSE_STEP_MS, TRACK_EVERY_N_SAMPLES } from './constants';
import { lookAnglesFrom } from './frames';
import { propagateEci, type SatRec } from './sgp4';
import { failingReason, sampleAt, visibilityAt, type VisibilitySample } from './visibility';

export interface PassObject {
  noradId: NoradId;
  name: string;
  stdMag: number;
  elementsEpochMs: EpochMs;
}

interface CoarseSegment {
  startMs: EpochMs; // first coarse sample above 0°, minus one step
  endMs: EpochMs; // last coarse sample above 0°, plus one step
}

/** Elevation only; the coarse scan does not need the sun. Returns −Infinity when SGP4 fails. */
function elevationAt(satrec: SatRec, observer: Observer, t: EpochMs): number {
  const state = propagateEci(satrec, t);
  return state ? lookAnglesFrom(observer, state.position, t).elDeg : Number.NEGATIVE_INFINITY;
}

/** PLAN §6.3 step 1: 30 s scan, group samples above 0°, pad each group by one step. */
export function coarseSegments(satrec: SatRec, observer: Observer, window: TimeWindow): CoarseSegment[] {
  const segments: CoarseSegment[] = [];
  let open: CoarseSegment | null = null;
  for (let t = window.startMs; t <= window.endMs; t += COARSE_STEP_MS) {
    const above = elevationAt(satrec, observer, t) > 0;
    if (above) {
      if (open) open.endMs = t + COARSE_STEP_MS;
      else open = { startMs: t - COARSE_STEP_MS, endMs: t + COARSE_STEP_MS };
    } else if (open) {
      segments.push(open);
      open = null;
    }
  }
  if (open) segments.push(open);
  return segments;
}

/**
 * Bisect `el(t) − minEl = 0` between `lo` (below) and `hi` (above), or the
 * reverse, until the bracket is ≤ BISECTION_TOLERANCE_MS. Returns the bracket
 * end on the "above" side, so dense sampling starts inside the pass.
 */
function bisectCrossing(satrec: SatRec, observer: Observer, minEl: number, below: EpochMs, above: EpochMs): EpochMs {
  let lo = below;
  let hi = above;
  while (Math.abs(hi - lo) > BISECTION_TOLERANCE_MS) {
    const mid = Math.round((lo + hi) / 2);
    if (elevationAt(satrec, observer, mid) >= minEl) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * PLAN §6.3 step 2: within a coarse segment, find the first and last coarse
 * samples at or above `minEl` and bisect the flank on each side. Null when the
 * segment never reaches `minEl`.
 */
function refineHorizonCrossings(
  satrec: SatRec,
  observer: Observer,
  segment: CoarseSegment,
  minEl: number,
): { riseMs: EpochMs; setMs: EpochMs } | null {
  const times: EpochMs[] = [];
  for (let t = segment.startMs; t <= segment.endMs; t += COARSE_STEP_MS) times.push(t);
  const els = times.map((t) => elevationAt(satrec, observer, t));
  const first = els.findIndex((e) => e >= minEl);
  if (first < 0) return null;
  let last = els.length - 1;
  while (last > first && (els[last] ?? -Infinity) < minEl) last--;
  const tFirst = times[first] ?? segment.startMs;
  const tLast = times[last] ?? segment.endMs;
  const riseMs = first === 0 ? tFirst : bisectCrossing(satrec, observer, minEl, tFirst - COARSE_STEP_MS, tFirst);
  const setMs = last === els.length - 1 ? tLast : bisectCrossing(satrec, observer, minEl, tLast + COARSE_STEP_MS, tLast);
  return { riseMs, setMs };
}

function toPoint(s: VisibilitySample): PassPoint {
  return { t: s.t, azDeg: s.azDeg, elDeg: s.elDeg, rangeKm: s.rangeKm };
}

/** PLAN §6.3 step 4: the longest contiguous run of visible samples, as [first, last] indices. */
function longestVisibleRun(samples: VisibilitySample[], thresholds: VisibilityThresholds): [number, number] | null {
  let best: [number, number] | null = null;
  let runStart = -1;
  for (let i = 0; i <= samples.length; i++) {
    const s = samples[i];
    const visible = s !== undefined && visibilityAt(s, thresholds).visible;
    if (visible) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      if (!best || i - 1 - runStart > best[1] - best[0]) best = [runStart, i - 1];
      runStart = -1;
    }
  }
  return best;
}

/**
 * PLAN §6.3 step 5 / D-7: parabola through the three samples around the
 * maximum elevation. Returns the refined time of the vertex, clamped to the
 * neighbours; falls back to the sample time when there is no curvature.
 */
export function parabolicPeakTime(prev: PassPoint | undefined, peak: PassPoint, next: PassPoint | undefined): EpochMs {
  if (!prev || !next) return peak.t;
  const h = DENSE_STEP_MS;
  const denom = prev.elDeg - 2 * peak.elDeg + next.elDeg;
  if (denom >= 0) return peak.t; // no concave curvature; keep the sample
  const offset = (0.5 * (prev.elDeg - next.elDeg)) / denom; // in units of h, ∈ (−1, 1) for a true max
  return Math.round(peak.t + Math.max(-1, Math.min(1, offset)) * h);
}

/**
 * Search `window` for naked-eye-visible passes of one object (PLAN §6.3).
 * Pure: time enters only through `window` (D-15).
 */
export function findPasses(
  satrec: SatRec,
  observer: Observer,
  window: TimeWindow,
  thresholds: VisibilityThresholds,
  object: PassObject,
): Pass[] {
  const passes: Pass[] = [];
  for (const segment of coarseSegments(satrec, observer, window)) {
    const crossings = refineHorizonCrossings(satrec, observer, segment, thresholds.minElevationDeg);
    if (!crossings) continue;

    // Step 3: dense sampling, clamped to the requested window.
    const from = Math.max(crossings.riseMs, window.startMs);
    const to = Math.min(crossings.setMs, window.endMs);
    const samples: VisibilitySample[] = [];
    for (let t = from; t <= to; t += DENSE_STEP_MS) {
      const s = sampleAt(satrec, observer, t, object.stdMag);
      if (s) samples.push(s);
    }

    // Step 4: longest visible run and its boundary reasons.
    const run = longestVisibleRun(samples, thresholds);
    if (!run) continue;
    const [i0, i1] = run;
    const visible = samples.slice(i0, i1 + 1);
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (!first || !last) continue;
    const startReason = boundaryReason(samples[i0 - 1], thresholds, 'horizon');
    const endReason = boundaryReason(samples[i1 + 1], thresholds, 'horizon');

    // Step 5: peak with parabolic refinement, re-evaluated at the refined instant.
    let peakIdx = 0;
    visible.forEach((s, i) => {
      if (s.elDeg > (visible[peakIdx]?.elDeg ?? -Infinity)) peakIdx = i;
    });
    const peakSample = visible[peakIdx];
    if (!peakSample) continue;
    const tPeak = parabolicPeakTime(visible[peakIdx - 1], peakSample, visible[peakIdx + 1]);
    const peak = (tPeak === peakSample.t ? null : sampleAt(satrec, observer, tPeak, object.stdMag)) ?? peakSample;

    // Step 6: magnitude at peak; step 7: twilight flag and track.
    if (peak.magnitude > thresholds.magLimit) continue;
    const twilight = peak.sunAltDeg > thresholds.twilightLabelSunAltDeg;
    const track = buildTrack(visible, first, peak, last);

    passes.push({
      id: `${object.noradId}-${first.t}`,
      noradId: object.noradId,
      name: object.name,
      start: toPoint(first),
      peak: toPoint(peak),
      end: toPoint(last),
      startReason,
      endReason,
      durationS: (last.t - first.t) / 1000,
      peakMagnitude: peak.magnitude,
      sunAltAtPeakDeg: peak.sunAltDeg,
      twilight,
      track,
      elementsEpochMs: object.elementsEpochMs,
    });
  }
  passes.sort((a, b) => a.start.t - b.start.t);
  return passes;
}

/** The condition that failed on the sample just outside the run; `fallback` when the run touches the 10° crossing. */
function boundaryReason(
  outside: VisibilitySample | undefined,
  thresholds: VisibilityThresholds,
  fallback: PassBoundaryReason,
): PassBoundaryReason {
  if (!outside) return fallback;
  return failingReason(outside, thresholds) ?? fallback;
}

/** Every Nth visible sample plus the exact start, peak and end points, ordered by time, no duplicates. */
function buildTrack(visible: VisibilitySample[], first: VisibilitySample, peak: VisibilitySample, last: VisibilitySample): PassPoint[] {
  const byTime = new Map<EpochMs, PassPoint>();
  visible.forEach((s, i) => {
    if (i % TRACK_EVERY_N_SAMPLES === 0) byTime.set(s.t, toPoint(s));
  });
  for (const s of [first, peak, last]) byTime.set(s.t, toPoint(s));
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}
