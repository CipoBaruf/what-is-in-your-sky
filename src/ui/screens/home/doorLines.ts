import type { Messages } from '../../../i18n/messages';
import type { CompassPoint } from '../../../lib/compass';
import { formatClockDuration } from '../../../lib/format';
import { isNoEvent, nextEvent, type NextEventContext } from '../../../lib/nextEvent';
import { passPath } from '../../../lib/passPath';
import type { MoonNow } from '../../../lib/skyStars';
import { formatShortClock } from '../../../lib/timeFormat';
import type { SkyBand } from '../../../lib/timeStripe';
import type { CloudState, EpochMs, Locale, Pass } from '../../../model';

/**
 * R130 (FR-FLOW-1, D-843): the home's three doors' lines, from what the home
 * already reads — the next event (FR-FIRST-3's `nextEvent`), tonight's dark
 * band and the cloud word for it (`useNight`, the When reading's), the passes
 * up now — and, once the `stars` chunk is in, what only it can say: the
 * brightest thing drawn above the horizon, the Moon, and the highlighted
 * pass's landmark (`DoorSky`). Pure: the clock is `now`, the words are `t`.
 *
 * A line is a string, or `null` for a line whose words are not in yet (the
 * chunk, the bands): the door draws it empty at its full height, so nothing
 * under the doors moves when it arrives. `wide` is the one more line each door
 * has on wide — `undefined` where there is nothing to say.
 */

/** FR-COMP-4: a compact door line's width, in cells (`tests/styles/doorRows.test.ts`). */
export const DOOR_CELLS = 34;

/** What the `stars` chunk adds once it has loaded (`useDoorSky`). */
export interface DoorSky {
  /** The brightest star or planet drawn above 0° now, named; `null` with nothing drawn (the Sun up). */
  brightest: { name: string; dir: CompassPoint } | null;
  moon: MoonNow | null;
  /** The next event's pass's landmark (FR-SKY-11): the worded line, and the star alone for the Both door. */
  landmark: { line: string | null; star: { name: string; word: 'above' | 'below' | 'beside' } | null } | null;
}

export interface DoorInput {
  now: EpochMs;
  zone: string | null;
  locale: Locale;
  passes: readonly Pass[];
  context: NextEventContext;
  /** The passes are still arriving, so no pass is not yet "no pass". */
  pending: boolean;
  hours: number;
  /** Whether the bands are known yet (they come with the astronomy chunk). */
  bandsKnown: boolean;
  /** Tonight's dark band, or `null` with none. */
  dark: SkyBand | null;
  cloud: CloudState;
  /** `null` until the `stars` chunk has loaded. */
  sky: DoorSky | null;
}

export type DoorLine = string | null;

export interface Door {
  title: string;
  lines: DoorLine[];
  wide?: DoorLine;
}

export interface Doors {
  /** `passId` is the next event's pass, whose detail the door opens; `null` opens the What reading in place. */
  satellites: Door & { passId: string | null };
  stars: Door;
  both: Door;
}

/** `text` with `name` cut (an ellipsis) until the line is within `DOOR_CELLS`; a line that fits is returned whole. */
function fitName(name: string, line: (name: string) => string): string {
  const whole = line(name);
  const over = [...whole].length - DOOR_CELLS;
  if (over <= 0) return whole;
  const chars = [...name];
  const keep = Math.max(1, chars.length - over - 1);
  return line(`${chars.slice(0, keep).join('').trimEnd()}…`);
}

export function doorLines(input: DoorInput, t: Messages): Doors {
  const { now, zone, locale, passes, context, pending, hours, bandsKnown, dark, cloud, sky } = input;
  const clock = (at: EpochMs, last = false): string => formatShortClock(at, zone, locale, last && zone === null);
  const result = nextEvent(passes, now, context);
  const words = t.doors;

  let satellites: Doors['satellites'];
  if (isNoEvent(result)) {
    satellites = { title: words.satellites.title, lines: [pending ? words.satellites.pending : words.satellites.none(hours)], passId: null };
  } else {
    const { pass, kind } = result;
    const countdown = formatClockDuration((result.at - now) / 1000);
    const head = kind === 'rise' ? words.satellites.next({ time: clock(result.at, true), countdown }) : words.satellites.up({ kind, reason: pass.endReason, countdown });
    const path = passPath(pass);
    const pathLine = fitName(pass.name, (name) => words.satellites.path({ name, peakPoint: path.peak.point, peakDeg: path.peak.altitude, endPoint: path.end.point }));
    const wide = sky === null ? null : (sky.landmark?.line ?? undefined);
    satellites = { title: words.satellites.title, lines: [head, pathLine], passId: pass.id, ...(wide === undefined ? {} : { wide }) };
  }

  const darkLine: DoorLine = bandsKnown ? (dark ? words.stars.dark({ from: clock(dark.from), to: clock(dark.to, true), cloud: zone === null ? null : cloud }) : words.stars.noDark(cloud)) : null;
  let brightLine: DoorLine = null;
  if (sky !== null) {
    if (sky.brightest !== null) {
      const { dir } = sky.brightest;
      brightLine = fitName(sky.brightest.name, (name) => words.stars.brightest({ name, point: dir }));
    } else if (dark && dark.from > now) brightLine = words.stars.from(clock(dark.from, true));
    else brightLine = words.stars.noNight;
  }
  const moon = sky?.moon;
  const moonLine: DoorLine | undefined = sky === null ? null : moon && moon.at !== null ? words.stars.moon({ pct: String(moon.pct), event: moon.event, time: clock(moon.at, true) }) : undefined;
  const stars: Door = { title: words.stars.title, lines: [darkLine, brightLine], ...(moonLine === undefined ? {} : { wide: moonLine }) };

  const up = passes.filter((pass) => pass.start.t <= now && now < pass.end.t);
  let bothLine: string;
  if (up.length > 0) {
    // The landmark is the next event's pass's, so it is named only while that pass is one of those up.
    const highlightedUp = !isNoEvent(result) && result.kind !== 'rise';
    const star = highlightedUp ? (sky?.landmark?.star ?? null) : null;
    const plain = words.both.up({ count: up.length, star: null });
    const named = star === null ? plain : words.both.up({ count: up.length, star });
    bothLine = [...named].length <= DOOR_CELLS ? named : plain;
  } else {
    bothLine = !isNoEvent(result) && result.kind === 'rise' ? words.both.nothingNext(clock(result.at, true)) : words.both.nothing;
  }
  const both: Door = { title: words.both.title, lines: [bothLine], wide: words.both.hint };

  return { satellites, stars, both };
}
