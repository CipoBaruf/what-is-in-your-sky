import type { EpochMs } from './thresholds';

/** One hourly forecast sample; layers are present only when the provider supplied all three (FR-WX-4). */
export interface HourlyCloud {
  t: EpochMs;
  totalPct: number;
  lowPct?: number;
  midPct?: number;
  highPct?: number;
}

export interface WeatherSnapshot {
  provider: 'open-meteo';
  lat: number;
  lon: number;
  cellKey: string; // "-38.9,-68.0"
  fetchedAt: EpochMs;
  timeZone: string;
  hourly: HourlyCloud[]; // covers at least the prediction window
}

export type CloudState = 'clear' | 'partly' | 'obscured' | 'unknown';

export interface CloudVerdict {
  state: CloudState;
  effectivePct: number | null;
  at: EpochMs;
}

/**
 * D-1028: tonight's cloud as the lines word it — one state all night, one change at a clock time (`at`, already
 * formatted), or `variable` when it changes more than once. `nightClouds` (lib) works it out from the hourly states.
 */
export type TonightCloud = { kind: 'steady'; state: CloudState } | { kind: 'change'; before: CloudState; after: CloudState; at: string } | { kind: 'variable' };
