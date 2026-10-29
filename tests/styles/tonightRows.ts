/**
 * R143 (FR-TONIGHT-4, FR-TONIGHT-7, FR-COMP-4): the compact live page's new rows as the catalogs word them — the
 * taps row, every chip form in the headline and every context-line form — each with its cell count, for
 * `controlRows.test.ts` and the task's Done note. Counted in body cells (16 px): the headline's time and its space
 * are at 1.25 rem and count 1.25 each, the chip and the context line at `--small` (14 px) count 0.875.
 *
 * The forms are their longest: the offset at 23 h 59 min (the span is 24 h), the weekday as `shortWeekday` spells
 * it (three letters every day in both languages), the countdown of an up pass at `12:05` and the compass point at
 * three letters. An up pass's name ellipsises (`ShownTime.module.css`), so its rows carry `Tiangong` and the fixed
 * part's cells say how much room a name has.
 */
import { formatClock, formatShortClock } from '../../src/lib/timeFormat';
import { shortWeekday } from '../../src/lib/timeStripe';
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

/** Friday 2026-09-11, 21:14:32 in Neuquén; a Saturday instant for the weekday. */
const T = Date.UTC(2026, 8, 12, 0, 14, 32);
const ZONE = 'America/Argentina/Salta';
const LONGEST = 23 * 60 + 59;

export function tapsRows(m: Messages): CountedRow[] {
  const taps = (glyph: string): string => `${glyph} [ ${m.live.tap.tonight} ] [ ${m.live.tap.next} ] [ ${m.live.tap.now} ]`;
  return [
    { name: 'taps, playing stopped (▶)', text: taps(m.live.playGlyph), cells: taps(m.live.playGlyph).length },
    { name: 'taps, playing (❚❚)', text: taps(m.live.pauseGlyph), cells: taps(m.live.pauseGlyph).length },
  ];
}

export function chipRows(m: Messages, locale: Locale): CountedRow[] {
  const weekday = shortWeekday(T, ZONE, locale);
  const clock = formatClock(T, ZONE, locale);
  const seconds = clock.slice(0, clock.indexOf(' '));
  const minutes = formatShortClock(T, ZONE, locale);
  const row = (name: string, time: string, chip: string): CountedRow => ({
    name,
    text: `${time} ${chip}`,
    cells: round((time.length + 1) * HEADLINE_EM + chip.length * SMALL_EM),
  });
  const forms = [
    ['ahead', 'ahead', false, null],
    ['behind', 'behind', false, null],
    ['ahead, tonight', 'ahead', true, null],
    ['behind, tonight', 'behind', true, null],
    ['ahead, weekday', 'ahead', false, weekday],
    ['behind, weekday', 'behind', false, weekday],
  ] as const;
  return [
    row('chip: now', seconds, m.live.chip({ kind: 'now' })),
    ...forms.map(([name, kind, tonight, day]) => row(`chip: ${name}`, minutes, m.live.chip({ kind, minutes: LONGEST, tonight, weekday: day }))),
  ];
}

export function contextRows(m: Messages): CountedRow[] {
  const c = m.live.context;
  const small = (name: string, text: string): CountedRow => ({ name, text, cells: round(text.length * SMALL_EM) });
  const longest = <K extends string>(words: Record<K, string>): string => Object.values<string>(words).reduce((a, b) => (b.length > a.length ? b : a));
  const sky = longest<SkyState>(c.skyWord);
  const cloud = longest<CloudState>(c.cloudWord);
  const up = (['peak', 'horizon', 'shadow', 'twilight'] as const).map((event) => small(`context: up, ${event}`, c.up({ name: 'Tiangong', event, point: 'SSW', countdown: '12:05' })));
  return [
    ...up,
    small('context: up, the fixed part (the name’s room is the rest)', c.up({ name: '', event: 'shadow', point: 'SSW', countdown: '12:05' })),
    small('context: sky, next', c.sky({ sky, cloud, next: '21:47' })),
    small('context: sky, no next', c.sky({ sky, cloud, next: null })),
    small('context: no pass in 24 h', c.noneSpan),
    small('context: no pass tonight', c.noneTonight),
  ];
}
