import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';
import type { Messages } from '../../src/i18n/messages';
import { BASE_FONT_PX, CELL_ADVANCE_EM_MAX, SHELL_PADDING_CELLS } from '../../src/lib/layout';
import type { CloudState, Locale, Pass, PassBoundaryReason } from '../../src/model';
import { DOOR_CELLS, doorLines, type DoorInput } from '../../src/ui/screens/home/doorLines';
import { DOOR_NIGHT, DOOR_SKY, doorInput, doorPass, local } from '../support/doorFixtures';

/**
 * R130 (FR-FLOW-1, FR-COMP-4): every line a compact door draws is within 34
 * cells, in both languages. The doors are full width on compact, so 34 is the
 * row a 360 px phone's door holds at `--small` inside the card's border and
 * padding as well as a 390 px one's: each width's row is worked out from the
 * widest font in the stack, the shell's padding and the card's (read from the
 * stylesheets), as `controlRows.test.ts` works out its 360 px row. The count
 * is of characters (FR-X-6: every glyph is one cell), and the captures at both
 * widths are the proof that nothing wraps. The cases are the
 * longest each line can be: the longest countdown in the span, every end
 * reason, every cloud word, every landmark word, a planet, no zone (the UTC
 * stamps, F-27), and a name too long for its line, which the line cuts.
 */
const CATALOGS: Record<Locale, Messages> = { en, es };

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8');
const TOKENS = read('src/ui/styles/tokens.css');
const CARD = read('src/ui/components/primitives/Card.module.css');
const DOORS = read('src/ui/screens/home/HomeDoors.module.css');

/** A `--name: Nrem;` token in px. */
function remToken(name: string): number {
  const match = new RegExp(`--${name}:\\s*([\\d.]+)rem;`).exec(TOKENS);
  if (!match) throw new Error(`no --${name} in rem`);
  return Number(match[1]) * BASE_FONT_PX;
}

/** The px a door's text has at a `width` px viewport: the shell's padding off each side, then the card's hairline and `--space-2`. */
function doorTextPx(width: number): number {
  expect(CARD).toMatch(/\.card\s*\{[^}]*border: var\(--border\);[^}]*padding: var\(--space-2\);/);
  expect(TOKENS).toMatch(/--hairline:\s*1px;/);
  expect(TOKENS).toMatch(/--space-2:\s*calc\(var\(--row\) \/ 2\);/);
  const space2 = remToken('row') / 2;
  return width - 2 * SHELL_PADDING_CELLS * CELL_ADVANCE_EM_MAX * BASE_FONT_PX - 2 * (1 + space2);
}

/** The characters one row of a door holds at `width`, at the title's body size or the lines' `--small`. */
function doorCells(width: number, fontPx: number): number {
  return Math.floor(doorTextPx(width) / (CELL_ADVANCE_EM_MAX * fontPx));
}
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
    // R138 (D-884): no dark band, so the second line is bright twilight's start.
    ['no dark band, stars from bright twilight', at({ now: local(11, 14), dark: null, starsFrom: { ...DOOR_NIGHT, sky: 'bright-twilight' }, sky: { ...DOOR_SKY, brightest: null } })],
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
  it('sets the lines at --small and the title at the body size', () => {
    expect(DOORS).toMatch(/\.line\s*\{[^}]*font-size: var\(--small\);/);
    expect(DOORS).not.toMatch(/\.title\s*\{[^}]*font-size/);
  });

  for (const width of [360, 390]) {
    const lineCells = doorCells(width, remToken('small'));
    const titleCells = doorCells(width, BASE_FONT_PX);
    it(`a ${String(width)} px door holds ${String(DOOR_CELLS)} cells at --small`, () => {
      expect(lineCells).toBeGreaterThanOrEqual(DOOR_CELLS);
    });

    for (const locale of ['en', 'es'] as const) {
      it(`every compact door line is within ${String(DOOR_CELLS)} cells and its ${String(width)} px row (${String(lineCells)}), ${locale}`, () => {
        for (const [name, input] of cases(locale)) {
          const doors = doorLines(input, CATALOGS[locale]);
          for (const door of [doors.satellites, doors.stars, doors.both]) {
            expect([...door.title].length, `${name}: "${door.title}"`).toBeLessThanOrEqual(titleCells);
            for (const line of door.lines) {
              if (line === null) continue;
              expect([...line].length, `${name}: "${line}"`).toBeLessThanOrEqual(Math.min(DOOR_CELLS, lineCells));
            }
          }
        }
      });
    }
  }
});
