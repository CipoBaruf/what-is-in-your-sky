import type { CloudState, CloudVerdict, EpochMs, HourlyCloud, WeatherSnapshot } from '../model';

/**
 * FR-WX-2 / FR-WX-4 / spec §6.3: cloud cover interpolated linearly, per
 * layer, to the instant asked for (a pass peak, or "now"), then weighted
 * `0.6·low + 0.3·mid + 0.1·high` when the layers are present, else the total.
 * Three states at < 30 / 30–70 / > 70 %; `unknown` without a snapshot or
 * outside the hours it covers. Pure: time is a parameter (D-15).
 */
export const CLEAR_BELOW_PCT = 30;
export const OBSCURED_ABOVE_PCT = 70;
export const LAYER_WEIGHTS = { low: 0.6, mid: 0.3, high: 0.1 } as const;

export function cloudState(effectivePct: number): CloudState {
  if (effectivePct < CLEAR_BELOW_PCT) return 'clear';
  if (effectivePct > OBSCURED_ABOVE_PCT) return 'obscured';
  return 'partly';
}

/** A sample has layers when all three are present (FR-WX-4 "where the provider supplies" them). */
export function hasLayers(sample: HourlyCloud): sample is HourlyCloud & { lowPct: number; midPct: number; highPct: number } {
  return sample.lowPct !== undefined && sample.midPct !== undefined && sample.highPct !== undefined;
}

export function effectiveCloudPct(sample: HourlyCloud): number {
  if (hasLayers(sample)) return LAYER_WEIGHTS.low * sample.lowPct + LAYER_WEIGHTS.mid * sample.midPct + LAYER_WEIGHTS.high * sample.highPct;
  return sample.totalPct;
}

/**
 * The sample at `t`, interpolated linearly between the two bracketing hourly
 * samples (each layer separately; layers survive only when both neighbours
 * have them). Null when `t` is outside the covered range or there is no data.
 */
export function interpolateCloud(hourly: readonly HourlyCloud[], t: EpochMs): HourlyCloud | null {
  if (hourly.length === 0) return null;
  const first = hourly[0];
  const last = hourly[hourly.length - 1];
  if (!first || !last || t < first.t || t > last.t) return null;
  let i = 0;
  while (i + 1 < hourly.length && (hourly[i + 1]?.t ?? Infinity) <= t) i++;
  const a = hourly[i];
  if (!a) return null;
  if (a.t === t || i + 1 >= hourly.length) return { ...a };
  const b = hourly[i + 1];
  if (!b) return { ...a };
  const f = (t - a.t) / (b.t - a.t);
  const mix = (x: number, y: number): number => x + (y - x) * f;
  const sample: HourlyCloud = { t, totalPct: mix(a.totalPct, b.totalPct) };
  if (hasLayers(a) && hasLayers(b)) {
    sample.lowPct = mix(a.lowPct, b.lowPct);
    sample.midPct = mix(a.midPct, b.midPct);
    sample.highPct = mix(a.highPct, b.highPct);
  }
  return sample;
}

export function cloudVerdict(snapshot: WeatherSnapshot | null, t: EpochMs): CloudVerdict {
  const sample = snapshot ? interpolateCloud(snapshot.hourly, t) : null;
  if (!sample) return { state: 'unknown', effectivePct: null, at: t };
  const effectivePct = effectiveCloudPct(sample);
  return { state: cloudState(effectivePct), effectivePct, at: t };
}
