// @vitest-environment jsdom
/**
 * R147 (FR-FULL-2, FR-FULL-3, FR-FULL-4, FR-COMP-4; D-920, D-921, D-924): the full sky's new rows, rendered from the
 * components the page will mount and measured as `controlRows.test.ts` measures a row (`cells.ts`: the text drawn,
 * the boxes the primitives' stylesheets add, a cell between two controls), in both languages, against FR-COMP-4's
 * 36 cells and what 390 and 360 px hold on the widest font. A row with text at another size counts it at its size,
 * as `tonightRows.ts` does: the shown time and its space at 1.25 rem count 1.25 cells a character, the chip at
 * `--small` 14/16.
 *
 * The rows: the head over the sky at its longest (`│ ← │ 21:47 +13 h 55 min`, FR-FULL-2, FR-STRIP-6), the
 * `controls` button (FR-FULL-3), and the sheet's head row — the place, the `settings` link, the `×` (FR-FULL-4, R150's
 * FR-GYRO-8).
 * The place and the chip are the parts that ellipsise, so each row also says how much of it the fixed part takes.
 * This file is R147's own so the two tasks of wave 1 touch no file in common (PLAN §16.27).
 *
 * R157 (FR-PHONE-3, D-964): the overlay's bottom row with its two controls, `follow` and `controls` / `seguir` and
 * `controles` — 19 and 20 cells, following or not since R206 (FR-CTRL-2: an option's block is as wide off as on),
 * inside 36 and inside what 360 px holds.
 */
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../support/matchMedia';
import { CATALOGS, I18nProvider } from '../../src/i18n/useT';
import { LOCALES } from '../../src/i18n/locale';
import { BASE_FONT_PX, CELL_ADVANCE_EM_MAX, SHELL_PADDING_CELLS } from '../../src/lib/layout';
import type { Locale } from '../../src/model';
import { ControlsSheet } from '../../src/ui/components/sky/ControlsSheet';
import { FollowControl } from '../../src/ui/components/live/FollowControl';
import { ShownTime, type ShownTimeProps } from '../../src/ui/components/live/ShownTime';
import { SkyHead } from '../../src/ui/components/sky/SkyHead';
import { decorations, rowCells, rowParts } from './cells';

/** FR-COMP-4: a 390 px viewport at the default cell. */
const BUDGET = 36;
const HEADING_EM = 1.25;
const SMALL_EM = 14 / 16;

const table = decorations(['src/ui/components/primitives/TextButton.module.css', 'src/ui/components/primitives/OptionToggle.module.css'].map((file) => resolve(process.cwd(), file)));

/** The cells a compact row has at `px` on the widest font in the stack, the shell's padding off: 36 at 390, 33 at 360. */
const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
const round = (n: number): number => Math.round(n * 100) / 100;

const ZONE = 'America/Argentina/Salta';
const H = 3_600_000;
const MIN = 60_000;
/** Friday 2026-09-11, 07:52 in Salta (UTC−3); the shown time is 21:47 that night, 13 h 55 min on. */
const NOW = Date.UTC(2026, 8, 11, 10, 52);
const LONGEST: ShownTimeProps = { t: NOW + 13 * H + 55 * MIN, realTime: false, now: NOW, clock: NOW, timeZone: ZONE };

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
  inLocale(locale, createElement(SkyHead, { line: createElement(ShownTime, LONGEST), onBack: () => undefined }));
  // `cells.ts` puts a control's box in front of its words (`####←`); the row is read with it round them, five cells (`--target`).
  const back = `│ ${CATALOGS[locale].header.back} │`;
  expect(rowCells(screen.getByTestId('live-back'), table)).toBe(back.length);
  const time = screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent ?? '';
  const chip = screen.getByTestId('shown-chip').textContent;
  const fixed = back.length + 1 + (time.length + 1) * HEADING_EM;
  return { text: `${back} ${time} ${chip}`, fixed: round(fixed), cells: round(fixed + chip.length * SMALL_EM) };
}

describe.each(LOCALES)('the full sky’s rows in %s (FR-FULL-2, FR-FULL-3, FR-FULL-4)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it('the head at its longest: the back box, the time at its size, the offset at --small (FR-STRIP-6)', () => {
    const row = headRow(locale);
    expect(row.text).toBe('│ ← │ 21:47 +13 h 55 min');
    // What never gives — the back control, the time — takes 13.5 cells; the offset has the rest.
    expect(row.fixed).toBe(13.5);
    // 24 cells in both languages, so nothing is cut at 360 px either.
    expect(row.cells).toBe(24);
    expect(row.cells).toBeLessThanOrEqual(rowCellsAt(360));
    expect(row.cells).toBeLessThanOrEqual(BUDGET);
    // And inside the head's own room at 390 px: the box less `--space-3` (24 px) each side, less the head's half
    // cell of padding each side (`SkyHead.module.css`).
    expect(row.cells + 1).toBeLessThanOrEqual((390 - 2 * 24) / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX));
  });

  it('controls: one control, well inside 36 cells', () => {
    inLocale(locale, createElement(ControlsSheet, { open: false, onOpenChange: () => undefined, place: null }));
    const cells = rowCells(screen.getByTestId('live-controls'), table);
    expect(cells).toBe(`│${t.sheet.controls}│`.length);
    expect(cells).toBe(locale === 'en' ? 10 : 11);
    expect(cells).toBeLessThanOrEqual(rowCellsAt(360));
  });

  it('the bottom row: follow before controls, 19 cells in English and 20 in Spanish in both states, inside 360 px (FR-PHONE-3)', () => {
    // FR-WIN-4's presence test: a touch screen with the constructor.
    vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
      return undefined;
    });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    try {
      for (const on of [true, false]) {
        inLocale(locale, createElement(ControlsSheet, { open: false, onOpenChange: () => undefined, place: null, beside: createElement(FollowControl, { follow: { sensor: true, on, armed: false, refused: false, asking: false, allow: () => undefined, notNow: () => undefined, turnOn: () => undefined, turnOff: () => undefined, onFollowEnd: () => undefined, firstTouch: undefined } }) }));
        const row = screen.getByTestId('live-bottom-row');
        expect(rowParts(row, table)).toEqual([`##${t.sheet.follow}`, `##${t.sheet.controls}`]);
        const cells = rowCells(row, table);
        expect(cells).toBe(locale === 'en' ? 19 : 20);
        expect(cells).toBeLessThanOrEqual(BUDGET);
        expect(cells).toBeLessThanOrEqual(rowCellsAt(360));
        cleanup();
      }
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    }
  });

  it('the sheet’s head row: a ten-letter place, the settings link and the ×, inside 360 px', () => {
    inLocale(locale, createElement(ControlsSheet, { open: true, onOpenChange: () => undefined, place: 'Cipolletti' }));
    const head = screen.getByTestId('sheet-head');
    const cells = rowCells(head, table);
    // R150 (FR-GYRO-8): the `×` is one character drawn in a `--tap` box (48 px), wider than its cell: count the box.
    expect(rowParts(head, table)).toEqual(['Cipolletti', t.settings.open, '×']);
    const tapCells = Math.ceil(48 / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX));
    const fixed = t.settings.open.length + 1 + tapCells;
    expect(cells - 'Cipolletti'.length - 1 - 1).toBe(t.settings.open.length + 1);
    expect('Cipolletti'.length + 1 + fixed).toBeLessThanOrEqual(rowCellsAt(360));
    // The fixed part is 14 cells in English and 13 in Spanish (`settings ×`, `ajustes ×`, the `×` as its five
    // cells of box), so a place has 21 or 22 cells at 390 px before its ellipsis (R206: the brackets' four more).
    expect(tapCells).toBe(5);
    expect(fixed).toBe(locale === 'en' ? 14 : 13);
  });
});
