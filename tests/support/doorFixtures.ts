/**
 * R130 (FR-FLOW-1): the home doors' fixtures — a pass, tonight's dark band and
 * the stars chunk's answers — shared by `doorLines.test.ts`, `HomeDoors.test.tsx`
 * and `tests/styles/doorRows.test.ts`.
 */
import { nextEvent } from '../../src/lib/nextEvent';
import type { DoorInput, DoorSky } from '../../src/ui/screens/home/doorLines';
import type { EpochMs, Pass } from '../../src/model';
import { NO_MOON_AT_PEAK } from './moonFixtures';

const DOOR_ZONE = 'America/Argentina/Salta'; // UTC−3, no DST
const MINUTE = 60_000;

/** `local(11, 22, 0)` is 2026-09-11 22:00 in DOOR_ZONE. */
export const local = (day: number, hour: number, minute = 0): EpochMs => Date.UTC(2026, 8, day, hour + 3, minute);

/** A pass rising at `startMs`, peaking 11° up in the NE two minutes later and ending in the ENE. */
export function doorPass(id: string, startMs: number, name = id): Pass {
  return {
    id,
    noradId: 48274,
    name,
    start: { t: startMs, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: startMs + 2 * MINUTE, azDeg: 45, elDeg: 11.2, rangeKm: 800 },
    end: { t: startMs + 4 * MINUTE, azDeg: 67.5, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 240,
    peakMagnitude: -1.8,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: local(11, 0),
    ...NO_MOON_AT_PEAK,
  };
}

export const DOOR_NIGHT = { from: local(11, 20, 25), to: local(12, 7, 5), sky: 'dark' as const };

export const DOOR_SKY: DoorSky = {
  brightest: { name: 'Canopus', dir: 'S' },
  moon: { pct: 64, event: 'sets', at: local(12, 2, 10) },
  landmark: { line: 'passes 3° beside Mintaka, in Orion', star: { name: 'Mintaka', word: 'beside' } },
};

/** The input at `over`, with the next event worked out from its `now` and `passes` as `HomeDoors` does. */
export function doorInput(over: Partial<Omit<DoorInput, 'event'>> = {}): DoorInput {
  const input = {
    now: local(11, 5, 0),
    zone: DOOR_ZONE,
    locale: 'en' as const,
    passes: [doorPass('tiangong', local(11, 5, 48), 'Tiangong')],
    pending: false,
    hours: 72,
    bandsKnown: true,
    dark: DOOR_NIGHT,
    cloud: 'clear' as const,
    sky: DOOR_SKY,
    ...over,
  };
  // `starsFrom` follows `dark` unless a test sets it: with a dark band, `tonightsStarsFrom` is that band (D-884).
  const starsFrom = 'starsFrom' in over ? (over.starsFrom ?? null) : input.dark;
  return { ...input, starsFrom, event: nextEvent(input.passes, input.now, { elementCount: 30, hasDarkness: true }) };
}
