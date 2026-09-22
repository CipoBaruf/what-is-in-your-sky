/**
 * TASKS R83 (FR-VISIT-1, FR-VISIT-3, FR-VISIT-4, FR-SHARE-3, D-539): what
 * `openLink` answers for each kind of hash, and each of the moment's notes.
 * It is pure — the hash, the saved place and the clock in, the answer out — so
 * the boot and the running tab can be trusted to read a link the same way.
 */
import { describe, expect, it } from 'vitest';
import { isoInstant, liveLinkHash, passLinkHash } from '../lib/shareLinks';
import type { Observer } from '../model';
import { LINK_SPAN_MS, openLink } from './openLink';

const NOW = Date.UTC(2026, 8, 21, 22, 0, 0);
/** A GPS fix keeps every digit; the links below carry five decimals and whole metres (D-295). */
const saved: Observer = { lat: -38.933921274, lon: -67.990318617, altM: 270.4, label: 'Cipolletti, Río Negro, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const elsewhere = { lat: 48.86, lon: 2.35, altM: 35 };

describe('openLink (R83, D-539)', () => {
  it('a pass link for the saved place, rounded as the hash rounds it, is own', () => {
    const hash = passLinkHash({ observer: saved, noradId: 25544, startT: NOW + 3_600_000 });
    expect(hash).toContain('lat=-38.93392&lon=-67.99032&alt=270');
    expect(openLink(hash, saved, NOW)).toMatchObject({ kind: 'own', link: { kind: 'pass', noradId: 25544 } });
  });

  it('a live link for the saved place is own too', () => {
    expect(openLink(liveLinkHash({ observer: saved, t: null }), saved, NOW)).toMatchObject({ kind: 'own', link: { kind: 'live' } });
  });

  it('a link for another place over a saved one is a visit, pass or live', () => {
    expect(openLink(passLinkHash({ observer: elsewhere, noradId: 25544, startT: NOW }), saved, NOW)).toMatchObject({ kind: 'visit', link: { observer: elsewhere } });
    expect(openLink(liveLinkHash({ observer: elsewhere, t: null }), saved, NOW)).toMatchObject({ kind: 'visit' });
    // Half a kilometre away rounds to the same two decimals, and is still somewhere else.
    expect(openLink('#live?lat=-38.929&lon=-67.99032&alt=270', saved, NOW)).toMatchObject({ kind: 'visit' });
  });

  it('with no saved place, the link is adopted', () => {
    expect(openLink(passLinkHash({ observer: elsewhere, noradId: 25544, startT: NOW }), null, NOW)).toMatchObject({ kind: 'adopt' });
    expect(openLink(liveLinkHash({ observer: elsewhere, t: null }), null, NOW)).toMatchObject({ kind: 'adopt' });
  });

  it('a known route that does not parse is unreadable', () => {
    expect(openLink('#live?lat=999', saved, NOW)).toEqual({ kind: 'unreadable' });
    expect(openLink('#live?lat=999', null, NOW)).toEqual({ kind: 'unreadable' });
    expect(openLink('#pass?lat=48.86&lon=2.35&alt=0&norad=25544&start=yesterday', saved, NOW)).toEqual({ kind: 'unreadable' });
    expect(openLink('#pass=%', saved, NOW)).toEqual({ kind: 'unreadable' });
  });

  it('a hash that is none of the routes is unknown', () => {
    expect(openLink('#weather?lat=48.86', saved, NOW)).toEqual({ kind: 'unknown' });
    expect(openLink('#hello', saved, NOW)).toEqual({ kind: 'unknown' });
  });

  it('the routes that carry no place answer nothing', () => {
    for (const hash of ['', '#', '#live', '#settings', '#pass=25544-1790000000000']) expect(openLink(hash, saved, NOW), hash).toBeNull();
  });

  it("a live link's t behind the clock is past, and more than the span ahead is far (FR-VISIT-3)", () => {
    const at = (t: number): string => `#live?lat=48.86&lon=2.35&alt=35&t=${isoInstant(t)}`;
    expect(openLink(at(NOW - 60_000), saved, NOW)).toMatchObject({ kind: 'visit', note: 'past' });
    expect(openLink(at(NOW + LINK_SPAN_MS + 60_000), saved, NOW)).toMatchObject({ kind: 'visit', note: 'far' });
    expect(openLink(at(NOW + 3_600_000), saved, NOW)).not.toHaveProperty('note');
    expect(openLink(at(NOW + LINK_SPAN_MS), saved, NOW)).not.toHaveProperty('note');
    // Real time has no moment to have passed.
    expect(openLink(liveLinkHash({ observer: elsewhere, t: null }), saved, NOW)).not.toHaveProperty('note');
    // The note goes with any kind: an own-place link can be for a moment that has passed too.
    expect(openLink(liveLinkHash({ observer: saved, t: NOW - 60_000 }), saved, NOW)).toMatchObject({ kind: 'own', note: 'past' });
  });
});
