/**
 * R156 (FR-PHONE-14, US-48 AC3, D-972, D-978): the pass detail's times. On
 * compact one row at `--small` — the rise, the peak with its altitude and
 * direction, the end, and with a shadow entry the word after the end's time —
 * within `DETAIL_TIMES_CELLS`, to the minute and with no zone (the head's
 * date line carries it once). The four cases the requirement names (plain,
 * shadow, both languages), then the forms that give up a word to fit, then
 * wide's three cells, unchanged.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { DETAIL_TIMES_CELLS, formatDateZone, formatTimesRow } from '../../../lib/format';
import type { Locale, Pass } from '../../../model';
import { TimesRow } from './TimesRow';

const ZONE = 'America/Argentina/Salta';
// 2026-09-06 10:20:00Z = 07:20 in GMT-3: the spec's own example, a rise at 07:20, a peak at 07:23 at 48° NNE, an end at 07:27.
const RISE = Date.UTC(2026, 8, 6, 10, 20, 10);
const base = goldenPassFixture();
const PLAIN: Pass = {
  ...base,
  start: { ...base.start, t: RISE },
  peak: { ...base.peak, t: RISE + 3 * 60_000 + 30_000, elDeg: 48.2, azDeg: 22.5 },
  end: { ...base.end, t: RISE + 7 * 60_000 + 20_000 },
  endReason: 'horizon',
};
const SHADOW: Pass = { ...PLAIN, endReason: 'shadow' };

const catalog = { en, es } as const;
const cells = (text: string): number => [...text].length;

function show(pass: Pass, locale: Locale, compact: boolean, timeZone: string | null = ZONE) {
  return render(
    <I18nProvider locale={locale}>
      <TimesRow pass={pass} timeZone={timeZone} compact={compact} />
    </I18nProvider>,
  );
}

describe('TimesRow compact (R156: FR-PHONE-14)', () => {
  it.each([
    ['plain', 'en', PLAIN, '07:20 → 07:23 at 48° NNE → 07:27'],
    ['plain', 'es', PLAIN, '07:20 → 07:23 a 48° NNE → 07:27'],
    ['shadow', 'en', SHADOW, '07:20 → 07:23 48° NNE → 07:27 shadow'],
    ['shadow', 'es', SHADOW, '07:20 → 07:23 48° NNE → 07:27 sombra'],
  ] as const)('%s, in %s: one row, within DETAIL_TIMES_CELLS', async (_case, locale, pass, text) => {
    const { container } = show(pass, locale, true);
    const row = screen.getByTestId('pass-times');
    expect(row).toHaveAttribute('data-form', 'row');
    expect(row.textContent).toBe(text);
    expect(cells(text)).toBeLessThanOrEqual(DETAIL_TIMES_CELLS);
    // No zone in the row: it is the head's date line's, once.
    expect(row.textContent).not.toMatch(/GMT|UTC/);
    expect(row.querySelectorAll('[data-cell]')).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a shadow entry drops the peak\'s "at", and that is all any line gives up', () => {
    const words = (locale: Locale) => catalog[locale].countdown.row;
    // The whole shadow line would be 39 cells in English and 37 even with a one-letter point: "at" never fits beside "shadow".
    expect(formatTimesRow(SHADOW, ZONE, 'en', words('en'))).toBe('07:20 → 07:23 48° NNE → 07:27 shadow');
    expect(formatTimesRow({ ...SHADOW, peak: { ...SHADOW.peak, azDeg: 0 } }, ZONE, 'en', words('en'))).toBe('07:20 → 07:23 48° N → 07:27 shadow');
    // Spanish's "a" would fit with a one-letter point; it goes all the same, so one pass reads one way whatever its direction.
    expect(formatTimesRow({ ...SHADOW, peak: { ...SHADOW.peak, azDeg: 0 } }, ZONE, 'es', words('es'))).toBe('07:20 → 07:23 48° N → 07:27 sombra');
    // A plain line keeps every word at every direction.
    expect(formatTimesRow({ ...PLAIN, peak: { ...PLAIN.peak, elDeg: 89.8 } }, ZONE, 'en', words('en'))).toBe('07:20 → 07:23 at 90° NNE → 07:27');
    // The longest shadow line, a three-letter point at any altitude, is exactly the budget.
    const zenith: Pass = { ...SHADOW, peak: { ...SHADOW.peak, elDeg: 89.8 } };
    expect(formatTimesRow(zenith, ZONE, 'en', words('en'))).toBe('07:20 → 07:23 90° NNE → 07:27 shadow');
    expect(cells(formatTimesRow(zenith, ZONE, 'en', words('en')))).toBe(DETAIL_TIMES_CELLS);
    // Every point, every altitude, both reasons, both languages: never over the budget.
    for (const locale of ['en', 'es'] as const) {
      for (let az = 0; az < 360; az += 11.25) {
        for (const elDeg of [10, 48, 89.6]) {
          for (const endReason of ['horizon', 'shadow', 'twilight'] as const) {
            const text = formatTimesRow({ ...PLAIN, endReason, peak: { ...PLAIN.peak, azDeg: az, elDeg } }, ZONE, locale, words(locale));
            expect(cells(text), text).toBeLessThanOrEqual(DETAIL_TIMES_CELLS);
          }
        }
      }
    }
  });

  it('with no zone yet the times are UTC, and the date line says so', () => {
    show(PLAIN, 'en', true, null);
    expect(screen.getByTestId('pass-times').textContent).toBe('10:20 → 10:23 at 48° NNE → 10:27');
    expect(formatDateZone(PLAIN.start.t, null, 'en')).toBe('2026-09-06 · UTC');
    expect(formatDateZone(PLAIN.start.t, ZONE, 'en')).toBe('2026-09-06 · GMT-3');
  });
});

describe('TimesRow wide (FR-FLOW-7, unchanged)', () => {
  it('keeps the three cells, each with its word and its time to the second', () => {
    show(PLAIN, 'en', false);
    const row = screen.getByTestId('pass-times');
    const cellsShown = row.querySelectorAll('[data-cell]');
    expect([...cellsShown].map((cell) => cell.getAttribute('data-cell'))).toEqual(['rise', 'peak', 'set']);
    expect(cellsShown[1]).toHaveTextContent(/^peak07:23:40 GMT-3 · 48° NNE$/);
  });
});

afterEach(cleanup);

describe('TimesRow wide with onSet (R187, FR-WIDE-4)', () => {
  it('FR-WIDE-4: the rise, peak and set are buttons that set the page\'s time to their instant, named in both languages', () => {
    const onSet = vi.fn();
    const { unmount } = render(
      <I18nProvider locale="en">
        <TimesRow pass={PLAIN} timeZone={ZONE} onSet={onSet} />
      </I18nProvider>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-set'))).toEqual(['rise', 'peak', 'set']);
    fireEvent.click(screen.getByRole('button', { name: /^Show the sky at peak, 07:23:40/ }));
    expect(onSet).toHaveBeenCalledWith(PLAIN.peak.t);
    unmount();
    render(
      <I18nProvider locale="es">
        <TimesRow pass={PLAIN} timeZone={ZONE} onSet={onSet} />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /^Mostrar el cielo a la hora de máximo, 07:23:40/ })).toBeInTheDocument();
  });

  it('draws no button on compact or without onSet', () => {
    show(PLAIN, 'en', false);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
