import type { EpochMs } from '../model';
import { nextCalendarDate } from './timeFormat';

/**
 * FR-NIGHT-1 (D-534, F-90): a night is the half-open stretch from one local
 * noon to the next, in the observer's zone or, until one is known, the
 * device's — never UTC by default. A pass before dawn therefore belongs to the
 * night that began the evening before it, and a run computed at 01:00 files
 * that morning's 05:00 pass and the same evening's 21:00 pass apart.
 *
 * A night's key is the local date of the noon it began at, `YYYY-MM-DD`: it
 * sorts as it reads, it is what the dated heading shows (`Night of
 * 2026-09-12`), and the next night's key is the next calendar date on that
 * zone's calendar — not now + 24 h, which the two 23 h and 25 h days a year
 * get wrong (F-26).
 *
 * Pure and clock-free (D-15): the instant is a parameter. One cached
 * `Intl.DateTimeFormat` a zone, `hourCycle: 'h23'` so the hour reads 0..23.
 * `timeFormat.ts` still labels a time in UTC while the zone is unknown
 * (FR-LOC-3); only the grouping reads the device's zone.
 */
export type NightKey = string;

/** FR-NIGHT-2 (D-535): how long an ended pass stays a card, reading `ended`, before it leaves the list. */
export const ENDED_LINGER_S = 60;
export const ENDED_LINGER_MS = ENDED_LINGER_S * 1000;

export interface NightAt {
  /** The night holding the instant. */
  key: NightKey;
  /** The instant's own local date, which is the key from noon on and the key's next date before it. */
  date: string;
  /** Before local noon the night under way began yesterday evening (FR-NIGHT-1's "tonight" rule turns on this). */
  beforeNoon: boolean;
}

const formats = new Map<string, Intl.DateTimeFormat | null>();

function formatFor(zone: string): Intl.DateTimeFormat | null {
  const cached = formats.get(zone);
  if (cached !== undefined) return cached;
  let format: Intl.DateTimeFormat | null = null;
  try {
    format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' });
  } catch {
    // An IANA name this engine does not know: the caller falls back.
  }
  formats.set(zone, format);
  return format;
}

/** The device's own zone, which is what a null observer zone means here. */
export function deviceZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const iso = (year: number, month: number, day: number): string => `${String(year)}-${pad(month)}-${pad(day)}`;

export function nightAt(instant: EpochMs, zone: string | null): NightAt {
  const format = formatFor(zone ?? deviceZone()) ?? formatFor(deviceZone()) ?? (formatFor('UTC') as Intl.DateTimeFormat);
  const parts = format.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') % 24;
  const date = iso(year, month, day);
  if (hour >= 12) return { key: date, date, beforeNoon: false };
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1));
  return { key: iso(yesterday.getUTCFullYear(), yesterday.getUTCMonth() + 1, yesterday.getUTCDate()), date, beforeNoon: true };
}

/** The key of the night holding `instant`: the local date of the last local noon at or before it. */
export function nightOf(instant: EpochMs, zone: string | null): NightKey {
  return nightAt(instant, zone).key;
}

/** The night after `key`: the next date on the calendar, whatever the clocks did that day. */
export function nextNight(key: NightKey): NightKey {
  return nextCalendarDate(key);
}
