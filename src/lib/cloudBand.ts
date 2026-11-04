import type { EpochMs, HourlyCloud } from '../model';
import { effectiveCloudPct } from './cloudVerdict';

/**
 * FR-WIDE-8 (R183, D-1100): the stripe's cloud band — one cell per forecast hour in four bands, and the runs of equal
 * bands its text alternative joins. An hour the forecast does not hold is a gap (`null`), never clear.
 */

/** SPEC v2.14's constants table: the cuts between clear, some, mostly and overcast, in effective cover %. */
export const CLOUD_STEPS = [20, 50, 80] as const;

export type CloudBand = 'clear' | 'some' | 'mostly' | 'overcast';

const HOUR_MS = 3_600_000;

export function cloudBandOf(effectivePct: number): CloudBand {
  const [some, mostly, overcast] = CLOUD_STEPS;
  if (effectivePct < some) return 'clear';
  if (effectivePct < mostly) return 'some';
  if (effectivePct <= overcast) return 'mostly';
  return 'overcast';
}

export interface CloudCell {
  /** The hour's start. */
  t: EpochMs;
  band: CloudBand | null;
}

/** One cell per whole hour from `from`'s hour up to `to` (exclusive), the forecast's sample at that hour or a gap. */
export function cloudCells(hourly: readonly HourlyCloud[], from: EpochMs, to: EpochMs): CloudCell[] {
  const byHour = new Map<number, HourlyCloud>();
  for (const sample of hourly) if (sample.t % HOUR_MS === 0) byHour.set(sample.t, sample);
  const cells: CloudCell[] = [];
  for (let t = Math.floor(from / HOUR_MS) * HOUR_MS; t < to; t += HOUR_MS) {
    const sample = byHour.get(t);
    cells.push({ t, band: sample ? cloudBandOf(effectiveCloudPct(sample)) : null });
  }
  return cells;
}

export interface CloudRun {
  band: CloudBand | null;
  /** The first cell's start. */
  from: EpochMs;
  /** The last cell's end. */
  to: EpochMs;
}

/** Consecutive cells of one band (or one gap) joined, in order. */
export function cloudRuns(cells: readonly CloudCell[]): CloudRun[] {
  const runs: CloudRun[] = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last && last.band === cell.band && last.to === cell.t) last.to = cell.t + HOUR_MS;
    else runs.push({ band: cell.band, from: cell.t, to: cell.t + HOUR_MS });
  }
  return runs;
}
