import { describe, expect, it } from 'vitest';
import type { Observer, Pass } from '../model';
import {
  SAME_PASS_TOLERANCE_MS,
  isLiveRoute,
  isoInstant,
  liveLinkFromHash,
  liveLinkHash,
  nearestPassOf,
  observerFromLink,
  parseHash,
  parseIsoInstant,
  passIdHash,
  passIdOf,
  passLinkFor,
  passLinkHash,
  resolvePassLink,
  shareUrl,
  type PassLink,
} from './shareLinks';

/* Test files are exempt from the `Date` ban (D-15 is about the shipped code
   reading the clock), so `Date` is the independent implementation the
   arithmetic in `shareLinks.ts` is checked against. */

const OBSERVER = { lat: -38.93, lon: -67.99, altM: 270 };
const START = Date.UTC(2026, 8, 2, 3, 4, 5); // 2026-09-02T03:04:05Z

function pass(noradId: number, startT: number): Pass {
  const point = { t: startT, azDeg: 0, elDeg: 10, rangeKm: 1000 };
  return {
    id: `${String(noradId)}-${String(startT)}`,
    noradId,
    name: `SAT ${String(noradId)}`,
    start: point,
    peak: { ...point, t: startT + 120_000 },
    end: { ...point, t: startT + 300_000 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 300,
    peakMagnitude: -1,
    sunAltAtPeakDeg: -20,
    twilight: false,
    track: [],
    elementsEpochMs: startT,
    moonAtPeak: { t: startT, phase: 'new', phaseAngleDeg: 0, illumination: 0, azDeg: 0, elDeg: -10, eclipticLonDeg: 0 },
    moonGlare: { glare: false, separationDeg: 90 },
  } as unknown as Pass;
}

describe('ISO-8601 instants without the clock', () => {
  it('formats epoch milliseconds the way Date does', () => {
    for (const t of [0, START, Date.UTC(1970, 0, 1, 0, 0, 1), Date.UTC(2000, 1, 29, 23, 59, 59), Date.UTC(2026, 11, 31, 23, 59, 59), Date.UTC(2100, 2, 1)]) {
      expect(isoInstant(t)).toBe(new Date(t).toISOString().replace('.000Z', 'Z'));
    }
  });

  it('keeps milliseconds when there are any', () => {
    expect(isoInstant(START + 42)).toBe('2026-09-02T03:04:05.042Z');
    expect(parseIsoInstant(isoInstant(START + 42))).toBe(START + 42);
  });

  it('round-trips every instant it writes', () => {
    for (let i = 0; i < 500; i++) {
      const t = Math.floor(START + (i - 250) * 987_654_321);
      expect(parseIsoInstant(isoInstant(t))).toBe(t);
    }
  });

  it('accepts a zone offset and a missing seconds field', () => {
    expect(parseIsoInstant('2026-09-02T00:04:05-03:00')).toBe(START);
    expect(parseIsoInstant('2026-09-02T06:04:05+03:00')).toBe(START);
    expect(parseIsoInstant('2026-09-02T03:04Z')).toBe(START - 5000);
  });

  it('rejects what is not an instant', () => {
    for (const text of ['', 'now', '2026-09-02', '2026-09-02T03:04:05', '2026-02-30T00:00:00Z', '2026-13-01T00:00:00Z', '2026-09-02T24:00:00Z', '2026-09-02T03:60:00Z', '2026-09-02T03:04:05+99:00']) {
      expect(parseIsoInstant(text)).toBeNull();
    }
  });
});

describe('building and parsing a pass link', () => {
  it('round-trips the observer, the object and the instant', () => {
    const hash = passLinkHash({ observer: OBSERVER, noradId: 25544, startT: START });
    expect(hash).toBe('#pass?lat=-38.93&lon=-67.99&alt=270&norad=25544&start=2026-09-02T03:04:05Z');
    expect(parseHash(hash)).toEqual({ kind: 'pass', observer: OBSERVER, noradId: 25544, startT: START });
  });

  it('builds the same link from an observer and a pass', () => {
    const observer: Observer = { ...OBSERVER, label: '−38.93, −67.99', source: 'coords', timeZone: 'America/Argentina/Salta' };
    expect(passLinkFor(observer, pass(25544, START))).toBe(passLinkHash({ observer: OBSERVER, noradId: 25544, startT: START }));
  });

  it('replaces the hash of the page it was shared from and keeps the query', () => {
    expect(shareUrl('https://example.test/?preview=1#pass=25544-1', '#pass?lat=0&lon=0')).toBe('https://example.test/?preview=1#pass?lat=0&lon=0');
    expect(shareUrl('https://example.test/', '#live?lat=0&lon=0')).toBe('https://example.test/#live?lat=0&lon=0');
  });

  it('sets the observer from the link: rounded label, source coords, zone unknown', () => {
    const link = parseHash(passLinkHash({ observer: OBSERVER, noradId: 25544, startT: START }));
    expect(link?.kind).toBe('pass');
    expect(observerFromLink(link as PassLink)).toEqual({ lat: -38.93, lon: -67.99, altM: 270, label: '−38.93, −67.99', source: 'coords', timeZone: null });
  });

  it('names the pass id the selection hash uses', () => {
    expect(passIdOf({ kind: 'pass', observer: OBSERVER, noradId: 25544, startT: START })).toBe(`25544-${String(START)}`);
  });
});

describe('the live link (FR-LIVE-9)', () => {
  it('round-trips an instant and real time', () => {
    expect(parseHash(liveLinkHash({ observer: OBSERVER, t: START }))).toEqual({ kind: 'live', observer: OBSERVER, t: START });
    const realTime = liveLinkHash({ observer: OBSERVER, t: null });
    expect(realTime).toBe('#live?lat=-38.93&lon=-67.99&alt=270');
    expect(parseHash(realTime)).toEqual({ kind: 'live', observer: OBSERVER, t: null });
  });

  /** R32: a `t` that names no instant is real time, so the place in the link is still looked from. */
  it('falls back to real time on a t it cannot read, and keeps the observer', () => {
    for (const t of ['soon', '2026-02-30T00:00:00Z', '2026-09-02T03:04:05', '']) {
      expect(parseHash(`#live?lat=-38.93&lon=-67.99&alt=270&t=${t}`), t).toEqual({ kind: 'live', observer: OBSERVER, t: null });
    }
    expect(liveLinkFromHash('#live?lat=-38.93&lon=-67.99&alt=270&t=soon')).toEqual({ kind: 'live', observer: OBSERVER, t: null });
    expect(liveLinkFromHash('#live')).toBeNull();
    expect(liveLinkFromHash(`#pass?lat=-38.93&lon=-67.99&alt=270&norad=25544&start=2026-09-02T03:04:05Z`)).toBeNull();
  });

  it('knows the live route with or without a readable link (FR-LIVE-1)', () => {
    for (const hash of ['#live', 'live', '#live?', '#live?lat=-38.93', '#live?lat=-38.93&lon=-67.99&t=soon', liveLinkHash({ observer: OBSERVER, t: START })]) {
      expect(isLiveRoute(hash), hash).toBe(true);
    }
    for (const hash of ['', '#', '#lives', '#live=1', '#pass=25544-1', '#livestream?lat=1&lon=2', `#pass?lat=-38.93&lon=-67.99&norad=25544&start=2026-09-02T03:04:05Z`]) {
      expect(isLiveRoute(hash), hash).toBe(false);
    }
  });
});

describe('the selection hash of the MVP (D-13)', () => {
  it('round-trips a pass id', () => {
    expect(passIdHash('25544-1756782245000')).toBe('#pass=25544-1756782245000');
    expect(parseHash('#pass=25544-1756782245000')).toEqual({ kind: 'passId', passId: '25544-1756782245000' });
  });

  it('decodes an escaped id', () => {
    expect(parseHash(passIdHash('25544 a'))).toEqual({ kind: 'passId', passId: '25544 a' });
  });
});

describe('a hash the app does not understand', () => {
  const bad = [
    '',
    '#',
    '#pass',
    '#pass=',
    '#pass=%E0%A4%A',
    '#pass?',
    '#pass?lat=-38.93',
    '#pass?lat=-38.93&lon=-67.99',
    '#pass?lat=-38.93&lon=-67.99&norad=25544',
    '#pass?lat=-38.93&lon=-67.99&alt=270&norad=25544&start=tomorrow',
    '#pass?lat=-38.93&lon=-67.99&alt=270&norad=abc&start=2026-09-02T03:04:05Z',
    '#pass?lat=-38.93&lon=-67.99&alt=270&norad=25544.5&start=2026-09-02T03:04:05Z',
    '#pass?lat=-99&lon=-67.99&norad=25544&start=2026-09-02T03:04:05Z',
    '#pass?lat=-38.93&lon=-999&norad=25544&start=2026-09-02T03:04:05Z',
    '#pass?lat=-38.93&lon=-67.99&alt=99999&norad=25544&start=2026-09-02T03:04:05Z',
    '#pass?lat=&lon=&norad=&start=',
    '#live',
    '#live?lat=-38.93',
    '#live?lat=-99&lon=-67.99',
    '#elsewhere?lat=-38.93&lon=-67.99',
    '#lat=1&lon=2',
    '%%%',
  ];

  it('answers null instead of throwing, so the app stays on the home screen', () => {
    for (const hash of bad) {
      expect(() => parseHash(hash), hash).not.toThrow();
      expect(parseHash(hash), hash).toBeNull();
    }
  });

  it('takes a link with no altitude as sea level, which is a link and not a broken one', () => {
    expect(parseHash('#pass?lat=-38.93&lon=-67.99&norad=25544&start=2026-09-02T03:04:05Z')).toEqual({ kind: 'pass', observer: { ...OBSERVER, altM: 0 }, noradId: 25544, startT: START });
    expect(parseHash('#live?lat=-38.93&lon=-67.99')).toEqual({ kind: 'live', observer: { ...OBSERVER, altM: 0 }, t: null });
  });
});

describe('resolving a shared pass (FR-SHARE-3)', () => {
  const link = { noradId: 25544, startT: START };

  it('takes a pass within the recompute tolerance as the same pass', () => {
    const shifted = pass(25544, START + SAME_PASS_TOLERANCE_MS - 1);
    expect(resolvePassLink([pass(43013, START), shifted], link)).toEqual({ kind: 'same', pass: shifted });
  });

  it('falls back to the nearest pass of that object when the pass is gone', () => {
    const earlier = pass(25544, START + 4 * 3600_000);
    const later = pass(25544, START + 9 * 3600_000);
    expect(resolvePassLink([later, earlier], link)).toEqual({ kind: 'nearest', pass: earlier });
    expect(nearestPassOf([later, earlier], 25544, START)).toBe(earlier);
  });

  it('has nothing to show when the object has no pass in the window', () => {
    expect(resolvePassLink([pass(43013, START)], link)).toEqual({ kind: 'none', pass: null });
    expect(resolvePassLink([], link)).toEqual({ kind: 'none', pass: null });
    expect(nearestPassOf([], 25544, START)).toBeNull();
  });
});
