/**
 * R76 (FR-FIRST-3, D-442), R81 (FR-FIRST-3 as amended v2.0.2, D-508): the next
 * event over a stored run — the Neuquén run the offline tests use — at instants
 * before a pass, between its start and its peak, between its peak and its end,
 * and after the last pass; and each of the three reasons there can be nothing
 * to count down to. The label line and the path are pinned through the catalog,
 * `formatClockDuration` and `passPath`, which is how `NextEventBlock` words
 * them, so these are the lines a reader sees.
 */
import { describe, expect, it } from 'vitest';
import run from '../../tests/fixtures/stored-run-neuquen.json';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import type { Messages } from '../i18n/messages';
import type { Pass } from '../model';
import { compassPoint } from './compass';
import { isNoEvent, nextEvent, type NextEvent } from './nextEvent';
import { formatClockDuration } from './format';
import { passPath } from './passPath';

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

/** The label line the block shows, in either language. */
function label(e: NextEvent, t: number, messages: Messages): string {
  return messages.nextEvent.label({ kind: e.kind, reason: e.kind === 'end' ? e.pass.endReason : e.pass.startReason, countdown: formatClockDuration((e.at - t) / 1000) });
}

/** The path line under the clock time. */
function path(e: NextEvent, messages: Messages): string {
  return messages.nextEvent.named({ name: e.pass.name, path: messages.nextEvent.path(passPath(e.pass)) });
}

describe('nextEvent (FR-FIRST-3, D-442)', () => {
  it('before a pass: its rise, where it rises, and the time to it', () => {
    const t = FIRST.start.t - (12 * 60 + 34) * 1000;
    const e = event(t);
    expect(e.pass.id).toBe(FIRST.id);
    expect(e.kind).toBe('rise');
    expect(e.at).toBe(FIRST.start.t);
    expect(compassPoint(e.azimuth)).toBe('S');
    expect(label(e, t, en)).toBe('Next up · in 12:34');
    expect(label(e, t, es)).toBe('A continuación · en 12:34');
    // It rises at the threshold (low), climbs to 32° in the ESE and sets at the threshold in the ENE.
    expect(path(e, en)).toBe('SL-16 R/B (Cosmos 2369) · S low → 32° ESE → ENE');
    expect(path(e, es)).toBe('SL-16 R/B (Cosmos 2369) · S bajo → 32° ESE → ENE');
  });

  it('hours before a pass: the countdown is h:mm:ss (D-502)', () => {
    const t = FIRST.start.t - ((3 * 60 + 45) * 60 + 7) * 1000;
    const e = event(t);
    expect(e.pass.id).toBe(FIRST.id);
    expect(label(e, t, en)).toBe('Next up · in 3:45:07');
  });

  it('between start and peak: the peak, its altitude and direction', () => {
    const t = FIRST.peak.t - 70_000;
    const e = event(t);
    expect(e.pass.id).toBe(FIRST.id);
    expect(e.kind).toBe('peak');
    expect(e.at).toBe(FIRST.peak.t);
    expect(compassPoint(e.azimuth)).toBe('ESE');
    expect(label(e, t, en)).toBe('Up now · peaks in 1:10');
    expect(label(e, t, es)).toBe('Visible ahora · culmina en 1:10');
    // The path is the whole pass's, whichever of its events is next.
    expect(path(e, en)).toBe('SL-16 R/B (Cosmos 2369) · S low → 32° ESE → ENE');
  });

  it('between peak and end: the end, where it sets, and the time to it', () => {
    const t = FIRST.end.t - 125_000;
    const e = event(t);
    expect(e.pass.id).toBe(FIRST.id);
    expect(e.kind).toBe('end');
    expect(e.at).toBe(FIRST.end.t);
    expect(compassPoint(e.azimuth)).toBe('ENE');
    expect(label(e, t, en)).toBe('Up now · sets in 2:05');
    expect(label(e, t, es)).toBe('Visible ahora · se pone en 2:05');
    expect(path(e, en)).toBe('SL-16 R/B (Cosmos 2369) · S low → 32° ESE → ENE');
  });

  it('words the rise and the end by the boundary reason: emerges from shadow, enters shadow', () => {
    const t = SECOND.start.t - 60_000;
    const rise = event(t);
    expect(rise.pass.id).toBe(SECOND.id);
    expect(label(rise, t, en)).toBe('Next up · in 1:00');
    // Out of Earth's shadow at 45°: the start carries its altitude, and the peak is the same instant.
    expect(path(rise, en)).toMatch(/^SL-16 R\/B \(Cosmos 2406\) · S 45° → 45° S → [A-Z]+$/);
    // start = peak: once risen there is no peak ahead, so the next event is the end.
    const after = event(SECOND.start.t + 1000);
    expect(after.pass.id).toBe(SECOND.id);
    expect(after.kind).toBe('end');
    const shadowEnd: Pass = { ...FIRST, endReason: 'shadow' };
    const t2 = shadowEnd.end.t - 5000;
    const end = nextEvent([shadowEnd], t2);
    expect(isNoEvent(end) ? null : label(end, t2, en)).toBe('Up now · enters shadow in 0:05');
    expect(isNoEvent(end) ? null : label(end, t2, es)).toBe('Visible ahora · entra en la sombra en 0:05');
    // Entering shadow above the threshold, the end carries its altitude.
    expect(isNoEvent(end) ? null : path(end, en)).toBe('SL-16 R/B (Cosmos 2369) · S low → 32° ESE → ENE 10°');
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
