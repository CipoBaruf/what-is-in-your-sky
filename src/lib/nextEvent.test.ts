/**
 * R76 (FR-FIRST-3, D-442): the next event over a stored run — the Neuquén run
 * the offline tests use — at instants before a pass, between its start and its
 * peak, between its peak and its end, and after the last pass; and each of the
 * three reasons there can be nothing to count down to. The verb and the
 * countdown are pinned through the catalog and `formatCountdown`, which is how
 * `NextEventBlock` words them, so this is the sentence a reader sees.
 */
import { describe, expect, it } from 'vitest';
import run from '../../tests/fixtures/stored-run-neuquen.json';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import type { Messages } from '../i18n/messages';
import type { Pass } from '../model';
import { compassPoint } from './compass';
import { isNoEvent, nextEvent, type NextEvent } from './nextEvent';
import { formatCountdown } from './timeFormat';

const passes = run.passes as unknown as Pass[];
const byId = (id: string): Pass => {
  const pass = passes.find((p) => p.id === id);
  if (!pass) throw new Error(`no pass ${id} in the fixture`);
  return pass;
};

/** The run's first pass: SL-16 R/B (Cosmos 2369), rising at the horizon at 184°, peaking 32° at 121°, setting at 58°. */
const FIRST = byId('26070-1789112167032');
/** The second: it leaves Earth's shadow already at its peak (start = peak), so it has no peak to count to once risen. */
const SECOND = byId('28353-1789113574032');
const LAST_END = Math.max(...passes.map((p) => p.end.t));

function event(t: number): NextEvent {
  const result = nextEvent(passes, t, { hasDarkness: run.hasDarkness, elementCount: 12 });
  if (isNoEvent(result)) throw new Error(`expected an event at ${String(t)}, got ${result.reason}`);
  return result;
}

/** The headline the block shows, in either language. */
function headline(e: NextEvent, t: number, messages: Messages): string {
  return messages.nextEvent.headline({
    name: e.pass.name,
    kind: e.kind,
    reason: e.kind === 'end' ? e.pass.endReason : e.pass.startReason,
    point: compassPoint(e.azimuth),
    altitude: `${String(Math.round(e.pass.peak.elDeg))}°`,
    countdown: formatCountdown(e.at - t),
  });
}

describe('nextEvent (FR-FIRST-3, D-442)', () => {
  it('before a pass: its rise, where it rises, and the time to it', () => {
    const t = FIRST.start.t - (12 * 60 + 34) * 1000;
    const e = event(t);
    expect(e.pass.id).toBe(FIRST.id);
    expect(e.kind).toBe('rise');
    expect(e.at).toBe(FIRST.start.t);
    expect(compassPoint(e.azimuth)).toBe('S');
    expect(headline(e, t, en)).toBe('SL-16 R/B (Cosmos 2369) appears S in 12:34');
    expect(headline(e, t, es)).toBe('SL-16 R/B (Cosmos 2369) aparece al S en 12:34');
  });

  it('between start and peak: the peak, its altitude and direction', () => {
    const t = FIRST.peak.t - 70_000;
    const e = event(t);
    expect(e.pass.id).toBe(FIRST.id);
    expect(e.kind).toBe('peak');
    expect(e.at).toBe(FIRST.peak.t);
    expect(compassPoint(e.azimuth)).toBe('ESE');
    expect(headline(e, t, en)).toBe('SL-16 R/B (Cosmos 2369) peaks 32° ESE in 1:10');
    expect(headline(e, t, es)).toBe('SL-16 R/B (Cosmos 2369) culmina a 32° al ESE en 1:10');
  });

  it('between peak and end: the end, where it sets, and the time to it', () => {
    const t = FIRST.end.t - 125_000;
    const e = event(t);
    expect(e.pass.id).toBe(FIRST.id);
    expect(e.kind).toBe('end');
    expect(e.at).toBe(FIRST.end.t);
    expect(compassPoint(e.azimuth)).toBe('ENE');
    expect(headline(e, t, en)).toBe('SL-16 R/B (Cosmos 2369) sets ENE in 2:05');
  });

  it('words the rise and the end by the boundary reason: emerges from shadow, enters shadow', () => {
    const t = SECOND.start.t - 60_000;
    const rise = event(t);
    expect(rise.pass.id).toBe(SECOND.id);
    expect(headline(rise, t, en)).toBe('SL-16 R/B (Cosmos 2406) emerges from shadow S in 1:00');
    // start = peak: once risen there is no peak ahead, so the next event is the end.
    const after = event(SECOND.start.t + 1000);
    expect(after.pass.id).toBe(SECOND.id);
    expect(after.kind).toBe('end');
    const shadowEnd: Pass = { ...FIRST, endReason: 'shadow' };
    const t2 = shadowEnd.end.t - 5000;
    const end = nextEvent([shadowEnd], t2);
    expect(isNoEvent(end) ? null : headline(end, t2, en)).toBe('SL-16 R/B (Cosmos 2369) enters shadow ENE in 0:05');
  });

  it('takes the pass whose next event is soonest, not the first in the list', () => {
    // The run is stored in object order, not time order; the ISS is first in it and rises hours later.
    expect(passes[0]?.name).toMatch(/^ISS/);
    expect(event(FIRST.start.t - 1000).pass.id).toBe(FIRST.id);
    // Across passes too: another pass rising before the one under way ends is the next event.
    const overlapping: Pass = { ...SECOND, id: 'overlap', start: { ...SECOND.start, t: FIRST.end.t - 10_000 }, peak: { ...SECOND.peak, t: FIRST.end.t - 10_000 } };
    const e = nextEvent([FIRST, overlapping], FIRST.end.t - 20_000);
    expect(isNoEvent(e) ? null : [e.pass.id, e.kind]).toEqual(['overlap', 'rise']);
  });

  it('after the last pass: nothing, and says it is for want of passes', () => {
    expect(nextEvent(passes, LAST_END, { hasDarkness: true, elementCount: 12 })).toEqual({ reason: 'no-passes' });
    expect(nextEvent(passes, LAST_END + 1)).toEqual({ reason: 'no-passes' });
  });

  it('with no darkness in the window: no-darkness', () => {
    expect(nextEvent([], FIRST.start.t, { hasDarkness: false, elementCount: 12 })).toEqual({ reason: 'no-darkness' });
  });

  it('with no elements to compute from: no-elements, whatever the darkness', () => {
    expect(nextEvent([], FIRST.start.t, { hasDarkness: false, elementCount: 0 })).toEqual({ reason: 'no-elements' });
    expect(nextEvent([], FIRST.start.t, { hasDarkness: null, elementCount: 0 })).toEqual({ reason: 'no-elements' });
  });

  it('is pure: the same instant gives the same answer, and it never reads the clock', () => {
    const t = FIRST.start.t - 1;
    expect(nextEvent(passes, t)).toEqual(nextEvent(passes, t));
  });
});
