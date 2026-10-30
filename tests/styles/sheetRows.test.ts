// @vitest-environment jsdom
/**
 * R147 (FR-FULL-2, FR-FULL-3, FR-FULL-4, FR-COMP-4; D-920, D-921, D-924): the full sky's new rows, rendered from the
 * components the page will mount and measured as `controlRows.test.ts` measures a row (`cells.ts`: the text drawn,
 * the brackets the primitives' stylesheets add, a cell between two controls), in both languages, against FR-COMP-4's
 * 36 cells and what 390 and 360 px hold on the widest font. A row with text at another size counts it at its size,
 * as `tonightRows.ts` does: the shown time and its space at 1.25 rem count 1.25 cells a character, the chip at
 * `--small` 14/16.
 *
 * The rows: the head over the sky at its longest (`[ ← ] 21:47 tonight · in 13 h 55 min`, FR-FULL-2), the
 * `[ controls ]` button (FR-FULL-3), and the sheet's head row — the place, `[ settings ]`, `[ close ]` (FR-FULL-4).
 * The place and the chip are the parts that ellipsise, so each row also says how much of it the fixed part takes.
 * R146's card rows are `controlRows.test.ts`'s; this file is R147's own so the two tasks of wave 1 touch no file in
 * common (PLAN §16.27).
 */
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../support/matchMedia';
import { CATALOGS, I18nProvider } from '../../src/i18n/useT';
import { LOCALES } from '../../src/i18n/locale';
import { BASE_FONT_PX, CELL_ADVANCE_EM_MAX, SHELL_PADDING_CELLS } from '../../src/lib/layout';
import { tonightBand } from '../../src/lib/shownTime';
import type { SkyBand } from '../../src/lib/timeStripe';
import type { Locale } from '../../src/model';
import { ControlsSheet } from '../../src/ui/components/live/ControlsSheet';
import type { ShownTimeProps } from '../../src/ui/components/live/ShownTime';
import { SkyHead } from '../../src/ui/components/live/SkyHead';
import { decorations, rowCells, rowParts } from './cells';

/** FR-COMP-4: a 390 px viewport at the default cell. */
const BUDGET = 36;
const HEADING_EM = 1.25;
const SMALL_EM = 14 / 16;

const table = decorations(['src/ui/components/primitives/TextButton.module.css', 'src/ui/components/primitives/BracketLink.module.css'].map((file) => resolve(process.cwd(), file)));

/** The cells a compact row has at `px` on the widest font in the stack, the shell's padding off: 36 at 390, 33 at 360. */
const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
const round = (n: number): number => Math.round(n * 100) / 100;

const ZONE = 'America/Argentina/Salta';
const H = 3_600_000;
const MIN = 60_000;
/** Friday 2026-09-11, 07:52 in Salta (UTC−3); the shown time is 21:47 that night, 13 h 55 min on. */
const NOW = Date.UTC(2026, 8, 11, 10, 52);
const BANDS: SkyBand[] = [
  { from: NOW - H, to: NOW + 11 * H, sky: 'day' },
  { from: NOW + 11 * H, to: NOW + 22 * H, sky: 'dark' },
  { from: NOW + 22 * H, to: NOW + 24 * H, sky: 'day' },
];
const LONGEST: ShownTimeProps = { t: NOW + 13 * H + 55 * MIN, realTime: false, now: NOW, clock: NOW, night: tonightBand(BANDS, NOW), timeZone: ZONE };

let media: MatchMediaStub;

beforeEach(() => {
  media = stubMatchMedia(COMPACT_PX, 844);
});

afterEach(() => {
  cleanup();
  media.restore();
});

const inLocale = (locale: Locale, element: ReactElement) => render(createElement(I18nProvider, { locale, children: element }));

interface HeadRow {
  text: string;
  /** The back control and its gap, the time and its space: what never gives. */
  fixed: number;
  /** The whole row, the chip included. */
  cells: number;
}

/** The head rendered at its longest, measured by its parts. */
function headRow(locale: Locale): HeadRow {
  inLocale(locale, createElement(SkyHead, { ...LONGEST, onBack: () => undefined }));
  // `cells.ts` puts a control's brackets in front of its words (`####←`); the row is read with them where they stand.
  const back = `[ ${CATALOGS[locale].header.back} ]`;
  expect(rowCells(screen.getByTestId('live-back'), table)).toBe(back.length);
  const time = screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent ?? '';
  const chip = screen.getByTestId('shown-chip').textContent;
  const fixed = back.length + 1 + (time.length + 1) * HEADING_EM;
  return { text: `${back} ${time} ${chip}`, fixed: round(fixed), cells: round(fixed + chip.length * SMALL_EM) };
}

describe.each(LOCALES)('the full sky’s rows in %s (FR-FULL-2, FR-FULL-3, FR-FULL-4)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it('the head at its longest: [ ← ], the time at its size, the tonight chip at --small', () => {
    const row = headRow(locale);
    expect(row.text).toBe(locale === 'en' ? '[ ← ] 21:47 tonight · in 13 h 55 min' : '[ ← ] 21:47 esta noche · en 13 h 55 min');
    // What never gives — the back control, the time — takes 13.5 cells; the chip has the rest and is cut first.
    expect(row.fixed).toBe(13.5);
    if (locale === 'en') {
      // 34.5 cells: within 36, inside 390 px; at 360 px (33) the chip's end is cut by its ellipsis.
      expect(row.cells).toBe(34.5);
      expect(row.cells).toBeLessThanOrEqual(BUDGET);
      expect(row.cells).toBeLessThanOrEqual(rowCellsAt(390));
      // And inside the head's own room at 390 px: the box less `--space-3` (24 px) each side, less the head's half
      // cell of padding each side (`SkyHead.module.css`).
      expect(row.cells + 1).toBeLessThanOrEqual((390 - 2 * 24) / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX));
    } else {
      // 37.13 cells: over 36 by 1.13, so on every phone the Spanish chip's longest form ends in its ellipsis
      // ("esta noche · en 13 h 55 m…"), which FR-FULL-2 allows and is what keeps the row one line (D-933).
      expect(row.cells).toBe(37.13);
      expect(row.fixed + 'esta noche · en 13 h'.length * SMALL_EM).toBeLessThanOrEqual(rowCellsAt(360));
    }
  });

  it('[ controls ]: one control, well inside 36 cells', () => {
    inLocale(locale, createElement(ControlsSheet, { open: false, onOpenChange: () => undefined, place: null }));
    const cells = rowCells(screen.getByTestId('live-controls'), table);
    expect(cells).toBe(`[ ${t.sheet.controls} ]`.length);
    expect(cells).toBe(locale === 'en' ? 12 : 13);
    expect(cells).toBeLessThanOrEqual(rowCellsAt(360));
  });

  it('the sheet’s head row: a ten-letter place, [ settings ] and [ close ], inside 360 px', () => {
    inLocale(locale, createElement(ControlsSheet, { open: true, onOpenChange: () => undefined, place: 'Cipolletti' }));
    const head = screen.getByTestId('sheet-head');
    const cells = rowCells(head, table);
    expect(rowParts(head, table)).toEqual(['Cipolletti', `####${t.settings.open}`, `####${t.sheet.close}`]);
    expect(cells).toBe(33);
    expect(cells).toBeLessThanOrEqual(rowCellsAt(360));
    // The fixed part is 22 cells in both languages (`[ settings ] [ close ]`, `[ ajustes ] [ cerrar ]`), so a place has
    // 13 cells at 390 px and 10 at 360 before its ellipsis.
    expect(cells - 'Cipolletti'.length - 1).toBe(22);
  });
});
