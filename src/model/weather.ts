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
