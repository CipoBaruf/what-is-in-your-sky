/**
 * R48 (FR-TRAJ-5, US-22 AC6, FR-COMP-4): the six stepping buttons — the rise
 * jumps, the minute and ten-minute steps, the disabled ends — and the row's
 * width in cells, both languages.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { HOUR_MS, type Span } from '../../../lib/timeStripe';
import type { Pass } from '../../../model';
import { StepControls } from './StepControls';

const START = Date.UTC(2026, 8, 11, 9, 30, 0);
const span: Span = { start: START, end: START + 24 * HOUR_MS };
const golden = goldenPassFixture();
const rising = (id: string, atMs: number): Pass => ({ ...golden, id, start: { ...golden.start, t: START + atMs }, end: { ...golden.end, t: START + atMs + 10 * 60_000 } });
const passes = [rising('a', HOUR_MS), rising('b', 6 * HOUR_MS)];

/** FR-COMP-4: the cells a row of buttons takes — the labels and one cell between each pair. */
const cells = (labels: readonly string[]): number => labels.reduce((sum, label) => sum + [...label].length, 0) + labels.length - 1;

describe('<StepControls>', () => {
  it('jumps to the next and the previous rise, steps a minute and ten, and disables an end with nowhere to go', async () => {
    const onStep = vi.fn();
    const { container, rerender } = render(<StepControls t={START} span={span} passes={passes} onStep={onStep} />);
    expect(screen.getByRole('group', { name: 'Step the shown instant' })).toBeInTheDocument();
    // At the span's start there is no rise behind; the first ahead is one tap away (AC6).
    expect(screen.getByRole('button', { name: 'Previous rise' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next rise' }));
    expect(onStep).toHaveBeenLastCalledWith(START + HOUR_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Forward ten minutes' }));
    expect(onStep).toHaveBeenLastCalledWith(START + 10 * 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Forward one minute' }));
    expect(onStep).toHaveBeenLastCalledWith(START + 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Back one minute' }));
    expect(onStep).toHaveBeenLastCalledWith(START - 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Back ten minutes' }));
    expect(onStep).toHaveBeenLastCalledWith(START - 10 * 60_000);
    expect(await axe(container)).toHaveNoViolations();

    // From the last rise there is none ahead, and the one behind is the first.
    rerender(<StepControls t={START + 6 * HOUR_MS} span={span} passes={passes} onStep={onStep} />);
    expect(screen.getByRole('button', { name: 'Next rise' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous rise' }));
    expect(onStep).toHaveBeenLastCalledWith(START + HOUR_MS);
    // The visible labels are the spike's glyphs; the names are the words.
    expect([...container.querySelectorAll('button')].map((el) => el.textContent)).toEqual(['|◀ rise', '−10m', '−1m', '+1m', '+10m', 'rise ▶|']);
  });

  it('speaks Spanish, and the row fits 36 cells in both languages (FR-I18N-2, FR-COMP-4)', () => {
    render(
      <I18nProvider locale="es">
        <StepControls t={START} span={span} passes={passes} onStep={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('group', { name: 'Mover el instante mostrado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salida siguiente' })).toHaveTextContent('sale ▶|');
    for (const catalog of [en, es]) {
      expect(cells(Object.values(catalog.live.step))).toBeLessThanOrEqual(36);
    }
  });
});
