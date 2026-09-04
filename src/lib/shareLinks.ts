import type { EpochMs, NoradId, Observer, Pass } from '../model';
import { observerFromCoords } from './place';

/**
 * R31 (FR-SHARE-1, FR-LIVE-9, D-83): the app's URL hashes, built and parsed in
 * one module. Three forms live here:
 *
 * - `#pass=<id>` — the MVP selection hash (D-13/D-33), written when a pass is
 *   opened on this device. It carries no location: the observer is already set.
 * - `#pass?lat=&lon=&alt=&norad=&start=` — a shared pass (FR-SHARE-1). It
 *   carries everything the recipient's device needs to recompute the pass
 *   locally: no server, no shortener, no id that only means something here.
 * - `#live?lat=&lon=&alt=&t=` — a shared live moment (FR-LIVE-9), `t` absent
 *   for real time. R32 renders it; the grammar is here so both share actions
 *   are one round-trip test surface.
 *
 * Nothing in here throws on a hash it does not understand: a stranger's URL is
 * arbitrary text, and FR-SHARE-1's failure mode is the home screen, not an
 * error boundary. `parseHash` answers `null` for anything malformed, partial
 * or unknown, and every caller treats `null` as "no selection".
 *
 * D-15 keeps `src/lib` clock-free, and the lint rule that enforces it bans the
 * `Date` global outright, so the ISO-8601 instant of FR-SHARE-1 is converted
 * here by arithmetic (`daysFromCivil` / `civilFromDays`) rather than by
 * `physics/time.ts`, which `src/lib` may import for types only (D-133).
 */

/** The part of an `Observer` a link carries. The rest — label, source, zone — is derived on arrival. */
export interface SharedObserver {
  lat: number;
  lon: number;
  altM: number;
}

export interface PassLink {
  kind: 'pass';
  observer: SharedObserver;
  noradId: NoradId;
  startT: EpochMs;
}

export interface LiveLink {
  kind: 'live';
  observer: SharedObserver;
  /** The shown instant, or `null` for real time (FR-LIVE-9). */
  t: EpochMs | null;
}

/** The MVP selection hash: a pass id and nothing else (D-13). */
export interface PassIdHash {
  kind: 'passId';
  passId: string;
}

export type AppHash = PassIdHash | PassLink | LiveLink;

/** How far a pass start may drift from the instant in the hash and still count as the same pass (D-33). */
export const SAME_PASS_TOLERANCE_MS = 120_000;

const MS_PER_DAY = 86_400_000;
const ALTITUDE_MIN_M = -500;
const ALTITUDE_MAX_M = 9000;

/* -------------------------------------------------------------------------- */
/* ISO-8601 instants, without the clock                                        */
/* -------------------------------------------------------------------------- */

/** Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's `days_from_civil`; exact in doubles over any date a URL can carry). */
function daysFromCivil(y: number, m: number, d: number): number {
  const shifted = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(shifted / 400);
  const yoe = shifted - era * 400; // [0, 399]
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146_097 + doe - 719_468;
}

/** The inverse of `daysFromCivil`. */
function civilFromDays(days: number): { y: number; m: number; d: number } {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/**
 * `2026-09-02T03:04:05Z`, with milliseconds only when there are any, so the
 * common case reads like a time and the round trip is still exact.
 */
export function isoInstant(t: EpochMs): string {
  const days = Math.floor(t / MS_PER_DAY);
  const { y, m, d } = civilFromDays(days);
  const inDay = t - days * MS_PER_DAY;
  const ms = inDay % 1000;
  const seconds = Math.floor(inDay / 1000);
  const fraction = ms === 0 ? '' : `.${pad(ms, 3)}`;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}T${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}${fraction}Z`;
}

const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * An ISO-8601 instant to epoch milliseconds, or `null`. The zone designator is
 * required — a link without one names no instant — and an impossible date is
 * rejected by round-tripping it through `daysFromCivil`, which is what stops
 * `2026-02-30` from silently becoming the 2nd of March.
 */
export function parseIsoInstant(text: string): EpochMs | null {
  const m = ISO_INSTANT.exec(text);
  if (!m) return null;
  const [, yy, mm, dd, hh, mi, ss = '0', frac = '', zone = 'Z'] = m;
  const y = Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = Number(ss);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const days = daysFromCivil(y, month, day);
  const back = civilFromDays(days);
  if (back.y !== y || back.m !== month || back.d !== day) return null;
  const ms = frac === '' ? 0 : Math.floor(Number(`0.${frac}`) * 1000);
  let offsetMin = 0;
  if (zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1;
    const offHours = Number(zone.slice(1, 3));
    const offMinutes = Number(zone.slice(4, 6));
    if (offHours > 23 || offMinutes > 59) return null;
    offsetMin = sign * (offHours * 60 + offMinutes);
  }
  return days * MS_PER_DAY + (hour * 3600 + minute * 60 + second) * 1000 + ms - offsetMin * 60_000;
}

/* -------------------------------------------------------------------------- */
/* Building                                                                    */
/* -------------------------------------------------------------------------- */

/** Five decimals is about a metre: more than the pass search can tell apart, and short enough to read in a message. */
const coord = (n: number): string => String(Math.round(n * 1e5) / 1e5);

function observerQuery(observer: SharedObserver): string {
  return `lat=${coord(observer.lat)}&lon=${coord(observer.lon)}&alt=${String(Math.round(observer.altM))}`;
}

/** The selection hash of the MVP (D-13): `#pass=<id>`. */
export function passIdHash(passId: string): string {
  return `#pass=${encodeURIComponent(passId)}`;
}

/**
 * FR-SHARE-1's hash. The values are numbers and an ISO instant, so nothing in
 * them needs escaping: `:` and `-` are legal in a fragment, and a link someone
 * reads in a message is worth the plain colons.
 */
export function passLinkHash(link: Omit<PassLink, 'kind'>): string {
  return `#pass?${observerQuery(link.observer)}&norad=${String(link.noradId)}&start=${isoInstant(link.startT)}`;
}

/** FR-LIVE-9's hash. `t` is left out for real time. */
export function liveLinkHash(link: Omit<LiveLink, 'kind'>): string {
  const t = link.t === null ? '' : `&t=${isoInstant(link.t)}`;
  return `#live?${observerQuery(link.observer)}${t}`;
}

/** The link for one pass, seen from one observer (FR-SHARE-1). */
export function passLinkFor(observer: SharedObserver, pass: Pick<Pass, 'noradId' | 'start'>): string {
  return passLinkHash({ observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, noradId: pass.noradId, startT: pass.start.t });
}

/** The absolute URL to share: the current page, with the hash replaced. `href` keeps its query, which may carry a deploy preview's parameters. */
export function shareUrl(href: string, hash: string): string {
  return `${href.split('#')[0]}${hash}`;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

const NUMBER = /^[+-]?\d+(?:\.\d+)?$/;

function number(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || !NUMBER.test(raw.trim())) return null;
  return Number(raw.trim());
}

function sharedObserver(params: URLSearchParams): SharedObserver | null {
  const lat = number(params, 'lat');
  const lon = number(params, 'lon');
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  // A link with no altitude means sea level, the same default the coordinate input uses; a nonsense one is a broken link.
  const altRaw = params.get('alt');
  const altM = altRaw === null || altRaw.trim() === '' ? 0 : number(params, 'alt');
  if (altM === null || altM < ALTITUDE_MIN_M || altM > ALTITUDE_MAX_M) return null;
  return { lat, lon, altM };
}

/**
 * The hash the app is on, or `null` when it is on none of them. Never throws:
 * every branch either matches the grammar or answers `null`.
 */
export function parseHash(hash: string): AppHash | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (text === '') return null;
  const separator = text.search(/[=?]/);
  if (separator === -1) return null;
  const route = text.slice(0, separator);
  const rest = text.slice(separator + 1);

  if (route === 'pass' && text[separator] === '=') {
    let passId: string;
    try {
      passId = decodeURIComponent(rest);
    } catch {
      return null; // a stray "%" in someone's copy of the link
    }
    return passId === '' ? null : { kind: 'passId', passId };
  }

  const params = new URLSearchParams(rest);
  const observer = sharedObserver(params);
  if (observer === null) return null;

  if (route === 'pass') {
    const noradId = number(params, 'norad');
    const startRaw = params.get('start');
    if (noradId === null || !Number.isInteger(noradId) || noradId <= 0 || startRaw === null) return null;
    const startT = parseIsoInstant(startRaw.trim());
    if (startT === null) return null;
    return { kind: 'pass', observer, noradId, startT };
  }

  if (route === 'live') {
    const raw = params.get('t');
    if (raw === null || raw.trim() === '') return { kind: 'live', observer, t: null };
    const t = parseIsoInstant(raw.trim());
    return t === null ? null : { kind: 'live', observer, t };
  }

  return null;
}

/**
 * The observer a link sets on arrival (FR-LIVE-9, and FR-SHARE-1 by the same
 * rule): source `coords`, label from the rounded coordinates until a forecast
 * or a geocode says better, zone unknown.
 */
export function observerFromLink(link: PassLink | LiveLink): Observer {
  return observerFromCoords(link.observer.lat, link.observer.lon, link.observer.altM);
}

/* -------------------------------------------------------------------------- */
/* Resolving a shared pass (FR-SHARE-3)                                        */
/* -------------------------------------------------------------------------- */

/** The pass id a shared link names, in the MVP's `${noradId}-${start.t}` form. */
export function passIdOf(link: PassLink): string {
  return `${String(link.noradId)}-${String(link.startT)}`;
}

/** The pass of that object whose start is closest to `startT`, of any distance; `null` when the window holds none. */
export function nearestPassOf(passes: readonly Pass[], noradId: NoradId, startT: EpochMs): Pass | null {
  let best: Pass | null = null;
  let bestDrift = Number.POSITIVE_INFINITY;
  for (const pass of passes) {
    if (pass.noradId !== noradId) continue;
    const drift = Math.abs(pass.start.t - startT);
    if (drift < bestDrift) {
      best = pass;
      bestDrift = drift;
    }
  }
  return best;
}

export type PassLinkResolution =
  /** The pass the link names, within the recompute tolerance (D-33). */
  | { kind: 'same'; pass: Pass }
  /** FR-SHARE-3 first branch: that pass is gone, so the nearest pass of the same object stands in. */
  | { kind: 'nearest'; pass: Pass }
  /** FR-SHARE-3 second branch: the object has no pass in the window at all. */
  | { kind: 'none'; pass: null };

/**
 * FR-SHARE-3. The recipient recomputes from their own "now", so the link's
 * instant almost never matches to the millisecond: inside the D-33 tolerance
 * it is the same pass, outside it the nearest pass of that object stands in
 * and the screen says so, and with no pass of that object in the window there
 * is nothing to show but the message.
 */
export function resolvePassLink(passes: readonly Pass[], link: Pick<PassLink, 'noradId' | 'startT'>): PassLinkResolution {
  const nearest = nearestPassOf(passes, link.noradId, link.startT);
  if (nearest === null) return { kind: 'none', pass: null };
  return Math.abs(nearest.start.t - link.startT) <= SAME_PASS_TOLERANCE_MS ? { kind: 'same', pass: nearest } : { kind: 'nearest', pass: nearest };
}
