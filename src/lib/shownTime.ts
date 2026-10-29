import type { EpochMs } from '../model';
import { formatDate } from './timeFormat';
import type { SkyBand } from './timeStripe';

/**
 * R143 (FR-TONIGHT-7, D-903): the chip beside the compact live page's shown time — `now` while `t` is real time,
 * otherwise how far `t` is from it, with `tonight` when `t` is inside tonight's night band and the weekday when `t`
 * is not today (FR-WATCH-2's rule). Pure: the words are the catalog's, the weekday's spelling the component's.
 *
 * "Real time" is `t === now`: the page passes the real clock as `t` while nothing is held (`usePlayback`), so a held
 * instant that happens to equal the clock reads `now` too, which is what it shows.
 */
export type ShownChip = { kind: 'now' } | { kind: 'ahead' | 'behind'; minutes: number; tonight: boolean; weekday: boolean };

/** An instant interval, `from` inclusive and `to` exclusive. */
export interface Interval {
  from: EpochMs;
  to: EpochMs;
}

/**
 * Tonight's night band (FR-TONIGHT-4): the run of non-`day` bands at or after `now` — from the end of the day band
 * to the start of the next one — bright twilight and dark together. While `now` is already in the night it is the
 * night under way. `null` with no night in the bands (a polar summer, or no bands yet).
 */
export function tonightBand(bands: readonly SkyBand[], now: EpochMs): Interval | null {
  const sorted = [...bands].sort((a, b) => a.from - b.from);
  const first = sorted.findIndex((band) => band.sky !== 'day' && band.to > now);
  const seed = sorted[first];
  if (seed === undefined) return null;
  const night: Interval = { from: seed.from, to: seed.to };
  for (let i = first - 1; i >= 0; i -= 1) {
    const band = sorted[i];
    if (band === undefined || band.sky === 'day' || band.to < night.from) break;
    night.from = band.from;
  }
  for (let i = first + 1; i < sorted.length; i += 1) {
    const band = sorted[i];
    if (band === undefined || band.sky === 'day' || band.from > night.to) break;
    night.to = band.to;
  }
  return night;
}

/** Whether `t` is inside tonight's night band. */
export function isTonight(t: EpochMs, bands: readonly SkyBand[], now: EpochMs): boolean {
  const night = tonightBand(bands, now);
  return night !== null && t >= night.from && t < night.to;
}

/**
 * The chip for `t`. The offset is in whole minutes, rounded as the held offset is (`heldOffset`). "Tonight" names
 * the night already, so a `t` past midnight inside it carries `tonight` and not the weekday as well: the headline
 * keeps its 36 cells and says one thing about the day.
 */
export function chipFor(t: EpochMs, now: EpochMs, bands: readonly SkyBand[], timeZone: string | null): ShownChip {
  if (t === now) return { kind: 'now' };
  const total = Math.round((t - now) / 60_000);
  const tonight = isTonight(t, bands, now);
  const today = formatDate(t, timeZone, 'en') === formatDate(now, timeZone, 'en');
  return { kind: total < 0 ? 'behind' : 'ahead', minutes: Math.abs(total), tonight, weekday: !today && !tonight };
}
