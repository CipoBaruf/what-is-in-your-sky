import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';
import type { Messages } from '../../src/i18n/messages';
import type { CloudState, Locale, Pass, PassBoundaryReason } from '../../src/model';
import { DOOR_CELLS, doorLines, type DoorInput } from '../../src/ui/screens/home/doorLines';
import { DOOR_NIGHT, DOOR_SKY, doorInput, doorPass, local } from '../support/doorFixtures';

/**
 * R130 (FR-FLOW-1, FR-COMP-4): every line a compact door draws is within 34
 * cells, in both languages. The doors are full width on compact, so 34 is the
 * row a 360 px phone's door holds at `--small` inside the card's border and
 * padding as well as a 390 px one's; the count is of characters, as
 * `controlRows.test.ts` counts (FR-X-6: every glyph is one cell), and the
 * captures at both widths are the proof that nothing wraps. The cases are the
 * longest each line can be: the longest countdown in the span, every end
 * reason, every cloud word, every landmark word, a planet, no zone (the UTC
 * stamps, F-27), and a name too long for its line, which the line cuts.
 */
const CATALOGS: Record<Locale, Messages> = { en, es };
const LONG = 'STARLINK-31415 (VISORSAT DARK)';
const CLOUDS: CloudState[] = ['clear', 'partly', 'obscured', 'unknown'];
const REASONS: PassBoundaryReason[] = ['horizon', 'shadow', 'twilight'];

function cases(locale: Locale): [string, DoorInput][] {
  const at = (over: Partial<DoorInput>): DoorInput => doorInput({ locale, ...over });
  const rise = local(11, 5, 48);
  const out: [string, DoorInput][] = [
    ['a later pass', at({})],
    ['the longest countdown in the span', at({ now: rise - 71 * 3_600_000 - 59 * 60_000 })],
    ['a long name', at({ passes: [doorPass('long', rise, LONG)] })],
    ['no pass', at({ passes: [] })],
    ['passes pending', at({ passes: [], pending: true })],
    ['no zone', at({ zone: null })],
    ['no zone, up now', at({ zone: null, now: rise + 60_000 })],
    ['daylight', at({ now: local(11, 14), sky: { ...DOOR_SKY, brightest: null } })],
    ['daylight, no zone', at({ now: local(11, 14), zone: null, sky: { ...DOOR_SKY, brightest: null } })],
    ['no dark band', at({ dark: null, sky: { ...DOOR_SKY, brightest: null } })],
    ['the chunk pending', at({ sky: null })],
    ['a long star', at({ sky: { ...DOOR_SKY, brightest: { name: 'Rigil Kentaurus Alpha Centauri', dir: 'WNW' } } })],
    ['a planet', at({ sky: { ...DOOR_SKY, brightest: { name: locale === 'es' ? 'Júpiter' : 'Jupiter', dir: 'SSW' } } })],
  ];
  for (const cloud of CLOUDS) out.push([`the cloud word ${cloud}`, at({ cloud })], [`no dark band, ${cloud}`, at({ cloud, dark: null })]);
  for (const reason of REASONS) {
    const pass: Pass = { ...doorPass('up', rise, LONG), endReason: reason };
    out.push([`up now, ending by ${reason}`, at({ passes: [pass], now: rise + 3 * 60_000 })]);
  }
  for (const word of ['above', 'below', 'beside'] as const) {
    for (const name of ['Mintaka', 'Rigil Kentaurus', 'Zubenelgenubi']) {
      out.push([`up now ${word} ${name}`, at({ now: rise + 60_000, passes: [doorPass('a', rise), doorPass('b', rise - 60_000), doorPass('c', rise - 30_000)], sky: { ...DOOR_SKY, landmark: { line: null, star: { name, word } } } })]);
    }
  }
  out.push(['the dark window across midnight', at({ dark: { ...DOOR_NIGHT, from: local(11, 23, 59), to: local(12, 23, 59) } })]);
  return out;
}

describe('the home doors’ lines (R130: FR-FLOW-1, FR-COMP-4)', () => {
  for (const width of [360, 390]) {
    for (const locale of ['en', 'es'] as const) {
      it(`every compact door line is within ${String(DOOR_CELLS)} cells at ${String(width)} px, ${locale}`, () => {
        for (const [name, input] of cases(locale)) {
          const doors = doorLines(input, CATALOGS[locale]);
          for (const door of [doors.satellites, doors.stars, doors.both]) {
            for (const line of [door.title, ...door.lines]) {
              if (line === null) continue;
              expect([...line].length, `${name}: "${line}"`).toBeLessThanOrEqual(DOOR_CELLS);
            }
          }
        }
      });
    }
  }
});
