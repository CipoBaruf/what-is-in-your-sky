/**
 * R143 (FR-TONIGHT-4, FR-TONIGHT-7, FR-COMP-4) → R213 (FR-STRIP-6): the compact live page's rows as the catalogs
 * word them — the play button's row and the taps', the time line's ends and every context-line form — each with its cell count, for
 * `controlRows.test.ts` and the task's Done note. Counted in body cells (16 px): the headline's time and its space
 * are at 1.25 rem and count 1.25 each, the chip and the context line at `--small` (14 px) count 0.875.
 *
 * The forms are their longest: the offset at 23 h 59 min (the span is 24 h), the countdown of an up pass at
 * `12:05` and the compass point at three letters. An up pass's name ellipsises (`ShownTime.module.css`), so its rows carry `Tiangong` and the fixed
 * part's cells say how much room a name has.
 */
import { formatClock, formatShortClock } from '../../src/lib/timeFormat';
import type { Messages } from '../../src/i18n/messages';
import type { CloudState, Locale, SkyState } from '../../src/model';

const HEADLINE_EM = 1.25;
const SMALL_EM = 14 / 16;

export interface CountedRow {
  name: string;
  text: string;
  /** Body cells, to two decimals. */
  cells: number;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** 2026-09-12 00:14:32 UTC: 21:14:32 in Salta (UTC−3). */
const T = Date.UTC(2026, 8, 12, 0, 14, 32);
const ZONE = 'America/Argentina/Salta';
/** 23 h 59 min, `heldOffset`'s hours and minutes. */
const LONGEST = { hours: 23, minutes: 59 };

export function tapsRows(m: Messages): CountedRow[] {
  // R206 (FR-CTRL-1): a button is its words and the cell each side that holds its edge, drawn here as `│`.
  const row = (name: string, ...labels: string[]): CountedRow => {
    const text = labels.map((label) => `│${label}│`).join(' ');
    return { name, text, cells: text.length };
  };
  return [row('play, paused', m.live.playButton), row('play, playing', m.live.pauseButton), row('taps', m.live.tap.tonight, m.live.tap.next, m.live.tap.now)];
}

export function chipRows(m: Messages, locale: Locale): CountedRow[] {
  const clock = formatClock(T, ZONE, locale);
  const seconds = clock.slice(0, clock.indexOf(' '));
  const minutes = formatShortClock(T, ZONE, locale);
  const row = (name: string, time: string, end: string): CountedRow => ({
    name,
    text: `${time} ${end}`,
    cells: round((time.length + 1) * HEADLINE_EM + end.length * SMALL_EM),
  });
  return [
    row('time line: live', seconds, `● ${m.live.state.live}`),
    row('time line: ahead', minutes, m.live.heldOffset({ sign: '+', ...LONGEST })),
    row('time line: behind', minutes, m.live.heldOffset({ sign: '−', ...LONGEST })),
  ];
}

export function contextRows(m: Messages): CountedRow[] {
  const c = m.live.context;
  const small = (name: string, text: string): CountedRow => ({ name, text, cells: round(text.length * SMALL_EM) });
  const longest = <K extends string>(words: Record<K, string>): string => Object.values<string>(words).reduce((a, b) => (b.length > a.length ? b : a));
  const sky = longest<SkyState>(c.skyWord);
  const cloud = longest<CloudState>(c.cloudWord);
  const tail = (event: 'peak' | 'horizon' | 'shadow' | 'twilight'): string => `${c.separator}${c.up({ event, point: 'SSW', countdown: '12:05' })}`;
  const up = (['peak', 'horizon', 'shadow', 'twilight'] as const).map((event) => small(`context: up, ${event}`, `Tiangong${tail(event)}`));
  return [
    ...up,
    small('context: up, the fixed part (the name’s room is the rest)', tail('shadow')),
    small('context: sky', c.sky({ sky, cloud, next: '21:47' })),
    small('context: no pass in 24 h', c.noneSpan),
    small('context: no pass tonight', c.noneTonight),
  ];
}
