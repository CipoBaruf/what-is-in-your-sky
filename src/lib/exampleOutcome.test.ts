/**
 * R199 (FR-OPEN-4, FR-OPEN-6, D-1177): each outcome of the example's run, the
 * wait's edge, a pass only on a later night, and a failure from either input.
 */
import { describe, expect, it } from 'vitest';
import run from '../../tests/fixtures/stored-run-neuquen.json';
import type { Pass } from '../model';
import type { Failure } from '../state/failure';
import { EXAMPLE_WAIT_MS, exampleOutcome } from './exampleOutcome';

const passes = run.passes as unknown as Pass[];
const FIRST_START = Math.min(...passes.map((p) => p.start.t));
const LAST_END = Math.max(...passes.map((p) => p.end.t));
const CITY = { name: 'Neuquén', lat: -38.95, lon: -68.06 };
const FAILURE: Failure = { kind: 'server', detail: '503' };

interface Over {
  city?: object | null;
  elements?: Failure | null;
  passes?: readonly Pass[] | Failure | null;
  /** The wall clock the outcome is asked at, epoch ms. */
  nowMs?: number;
}

/** The outcome `elapsedMs` after the example began, the clock at `over.nowMs`. */
const at = (elapsedMs: number, over: Over = {}) => {
  const nowMs = over.nowMs ?? FIRST_START - 3_600_000;
  return exampleOutcome({ city: CITY, elements: null, passes: null, ...over, startedMs: nowMs - elapsedMs, nowMs });
};

describe('exampleOutcome', () => {
  it('FR-OPEN-4: the wait is 10 000 ms', () => {
    expect(EXAMPLE_WAIT_MS).toBe(10_000);
  });

  it('FR-OPEN-6: no city is no_city, whatever else is true', () => {
    expect(at(0, { city: null })).toBe('no_city');
    expect(at(0, { city: null, elements: FAILURE })).toBe('no_city');
  });

  it('FR-OPEN-4: an unfinished run inside the wait is pending', () => {
    expect(at(0)).toBe('pending');
    expect(at(5_000, { elements: null })).toBe('pending');
  });

  it('FR-OPEN-6: an unfinished run is pending one ms before the wait and slow at it', () => {
    expect(at(EXAMPLE_WAIT_MS - 1)).toBe('pending');
    expect(at(EXAMPLE_WAIT_MS)).toBe('slow');
    expect(at(EXAMPLE_WAIT_MS + 1)).toBe('slow');
  });

  it('FR-OPEN-6: a run that finishes after the wait is still slow', () => {
    expect(at(EXAMPLE_WAIT_MS - 1, { passes })).toBe('pass');
    expect(at(EXAMPLE_WAIT_MS, { passes })).toBe('slow');
  });

  it('FR-OPEN-6: a Failure from the elements or from the run is failed', () => {
    expect(at(0, { elements: FAILURE })).toBe('failed');
    expect(at(0, { passes: FAILURE })).toBe('failed');
    expect(at(EXAMPLE_WAIT_MS + 5, { passes: FAILURE })).toBe('failed');
  });

  it('FR-OPEN-6: a finished run with a pass ahead is pass', () => {
    expect(at(100, { passes })).toBe('pass');
  });

  it('FR-OPEN-6: a pass only on a later night inside 72 h is pass, not a fallback', () => {
    const laterNight = passes.filter((p) => p.start.t > FIRST_START + 24 * 3_600_000);
    expect(laterNight.length).toBeGreaterThan(0);
    expect(at(100, { passes: laterNight, nowMs: FIRST_START })).toBe('pass');
  });

  it('FR-OPEN-6: a finished run with no visible pass is none', () => {
    expect(at(100, { passes: [] })).toBe('none');
    expect(at(100, { passes, nowMs: LAST_END + 1 })).toBe('none');
  });
});
