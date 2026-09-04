import type { NoradId } from './catalog';
import type { MoonGlare, MoonState } from './moon';
import type { EpochMs } from './thresholds';

export interface PassPoint {
  t: EpochMs;
  azDeg: number;
  elDeg: number;
  rangeKm: number;
}

export type PassBoundaryReason = 'horizon' | 'shadow' | 'twilight';

export interface Pass {
  id: string; // `${noradId}-${start.t}`
  noradId: NoradId;
  name: string;
  start: PassPoint;
  peak: PassPoint;
  end: PassPoint;
  startReason: PassBoundaryReason; // rose above 10° | exited shadow | sky got dark enough
  endReason: PassBoundaryReason;
  durationS: number;
  peakMagnitude: number;
  sunAltAtPeakDeg: number;
  twilight: boolean; // FR-VIS-7: sun in (−12°, −6°] at peak
  track: PassPoint[]; // 10 s samples over [start, end] for the sky chart
  elementsEpochMs: EpochMs; // provenance
  /**
   * v1, FR-MOON-2: the Moon at the pass peak, or null when it is below the
   * horizon there. One evaluation per pass, not per sample — the Moon moves
   * about 0.5° in the length of a pass, far below the 30° separation threshold
   * (PLAN §6.3 step 8).
   */
  moonAtPeak: MoonState | null;
  moonGlare: MoonGlare; // v1, FR-MOON-2
}

export interface NowItem {
  noradId: NoradId;
  name: string;
  azDeg: number;
  elDeg: number;
  rangeKm: number;
  magnitude: number | null; // null when below horizon or in shadow
  lit: boolean;
  aboveMinElevation: boolean;
  visible: boolean;
  visibleUntil?: EpochMs;
  endReason?: PassBoundaryReason;
}

export type SkyState = 'day' | 'bright-twilight' | 'dark'; // sun > −6°, (−12°, −6°], ≤ −12°

export interface NowState {
  t: EpochMs;
  sunAltDeg: number;
  sky: SkyState;
  items: NowItem[];
  /**
   * v1, FR-LIVE-6 (D-76): everything above the horizon at `t` that the app
   * would not tell you to look for — too low, in shadow, in daylight or too
   * faint. Present only when `computeNow` asked for it (`includeHidden`), so
   * an MVP response is unchanged. Each item carries its own reason fields.
   */
  hidden?: NowItem[];
  /** v1, FR-MOON-3: the Moon at `t`, computed with everything else so the main thread does no astronomy (D-80). */
  moon: MoonState;
}
