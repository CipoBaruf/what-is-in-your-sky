import type { EpochMs, Pass, Readiness, ReadinessGap, WeatherSnapshot } from '../model';

/**
 * FR-OFF-4 (PLAN §7.5): how long the app can keep answering with no signal.
 *
 * Three things have to be on the device for that to be true — orbital elements,
 * a stored run of passes and a forecast — and the answer is only as long as the
 * shortest of them: `offlineUntil = min(last pass end, forecast end)`. Whatever
 * is absent is named instead, in `missing`, so the line can say what to go and
 * fetch rather than only that something is wrong.
 *
 * Pure, and time is never read here (D-15): `now` is not even a parameter,
 * because readiness is a statement about the data and not about the clock. The
 * caller renders the two epochs.
 */
export interface ReadinessInput {
  /**
   * The passes on screen — the stored run flattened into the slice (D-105), or
   * this session's own list, which is the same question either way: how far
   * ahead the device can already name a pass.
   */
  passes: readonly Pass[];
  /** `PassesState.storedAt`: when the run was computed, or null when the list is this session's. */
  storedAt: EpochMs | null;
  /** The snapshot in use, stored or fresh; null when there is none for this observer. */
  forecast: WeatherSnapshot | null;
  /** Whether a usable element set is loaded (from the network or from IndexedDB). */
  hasElements: boolean;
}

/**
 * The last instant the stored passes reach. The list is sorted by start and not
 * by end, so this is a maximum rather than the last entry's.
 */
export function lastPassEnd(passes: readonly Pass[]): EpochMs | null {
  let end: EpochMs | null = null;
  for (const pass of passes) if (end === null || pass.end.t > end) end = pass.end.t;
  return end;
}

/**
 * The last instant the forecast can answer for: its final hourly sample. Past
 * it `interpolateCloud` returns null and every badge reads "unknown"
 * (FR-OFF-3), so this is the end in the sense the readiness line means — the
 * point where the app stops being able to say anything about the sky, not the
 * point where the response's array happens to stop being useful.
 */
export function forecastEnd(forecast: WeatherSnapshot | null): EpochMs | null {
  const last = forecast?.hourly[forecast.hourly.length - 1];
  return last ? last.t : null;
}

export function readiness({ passes, storedAt, forecast, hasElements }: ReadinessInput): Readiness {
  const passEnd = lastPassEnd(passes);
  const wxEnd = forecastEnd(forecast);
  const missing: ReadinessGap[] = [];
  if (!hasElements) missing.push('elements');
  if (wxEnd === null) missing.push('forecast');
  if (passEnd === null) missing.push('passes');
  return {
    // Both bounds or none: "ready until" is a promise about the whole answer, and a date
    // covering the passes while the weather has already run out would be the wrong promise.
    offlineUntil: passEnd === null || wxEnd === null ? null : Math.min(passEnd, wxEnd),
    storedAt,
    missing,
  };
}
