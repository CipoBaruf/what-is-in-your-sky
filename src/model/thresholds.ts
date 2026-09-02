/** UTC epoch milliseconds. Every time in the model is one of these (PLAN §5, D-3). */
export type EpochMs = number;

export interface VisibilityThresholds {
  minElevationDeg: number; // 10
  sunAltMaxDeg: number; // −6
  twilightLabelSunAltDeg: number; // −12
  magLimit: number; // 4.5
}

export interface TimeWindow {
  startMs: EpochMs;
  endMs: EpochMs;
}
