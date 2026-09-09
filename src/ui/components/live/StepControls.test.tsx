/**
 * R48 (FR-TRAJ-5, US-22 AC6, FR-COMP-4), re-cut by R70 (FR-SPAN-3, FR-SPAN-4,
 * US-24 AC3, AC4): the six stepping buttons in the order the requirement lists
 * them — the pass jumps, the chunk arrows, the minute steps — the ends that
 * disable rather than disappear, and the row's width in cells, both languages.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { CHUNK_MS, HOUR_MS, STRIPE_CHUNK_H, type Span } from '../../../lib/timeStripe';
import type { Pass } from '../../../model';
import { StepControls } from './StepControls';

const START = Date.UTC(2026, 8, 11, 9, 30, 0);
const span: Span = { start: START, end: START + 24 * HOUR_MS };
const golden = goldenPassFixture();
const rising = (id: string, atMs: number): Pass => ({ ...golden, id, start: { ...golden.start, t: START + atMs }, end: { ...golden.end, t: START + atMs + 10 * 60_000 } });
const passes = [rising('a', HOUR_MS), rising('b', 6 * HOUR_MS)];

/** FR-COMP-4 as amended v1.4: the stepping row's budget is 35 cells — the labels and one cell between each pair. */
const BUDGET = 35;
const cells = (labels: readonly string[]): number => labels.reduce((sum, label) => sum + [...label].length, 0) + labels.length - 1;

describe('<StepControls>', () => {
  it('is FR-SPAN-3s six in its order: the pass jumps, the chunk arrows and the minute steps', async () => {
    const onStep = vi.fn();
    const { container, rerender } = render(<StepControls t={START} span={span} passes={passes} onStep={onStep} />);
    expect(screen.getByRole('group', { name: 'Step the shown instant' })).toBeInTheDocument();
    expect([...container.querySelectorAll('button')].map((el) => el.getAttribute('data-step'))).toEqual(['prev-rise', '-chunk', '-1m', '+1m', '+chunk', 'next-rise']);
    expect([...container.querySelectorAll('button')].map((el) => el.textContent)).toEqual(['|◀ pass', '◀ 4h', '−1m', '+1m', '4h ▶', 'pass ▶|']);
    // FR-SPAN-4: one tap lands on the next rise, to the second (US-22 AC6's three-tap ceiling in one).
    fireEvent.click(screen.getByRole('button', { name: 'Next pass' }));
    expect(onStep).toHaveBeenLastCalledWith(START + HOUR_MS);
    // US-24 AC3: the chunk arrows are four hours, the stripe's own window, and the fine step is the minute.
    fireEvent.click(screen.getByRole('button', { name: 'Forward four hours' }));
    expect(onStep).toHaveBeenLastCalledWith(START + STRIPE_CHUNK_H * HOUR_MS);
    expect(CHUNK_MS).toBe(STRIPE_CHUNK_H * HOUR_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Forward one minute' }));
    expect(onStep).toHaveBeenLastCalledWith(START + 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Back one minute' }));
    expect(onStep).toHaveBeenLastCalledWith(START - 60_000);
    expect(await axe(container)).toHaveNoViolations();

    // From the last rise there is none ahead, and the one behind is the first.
    rerender(<StepControls t={START + 6 * HOUR_MS} span={span} passes={passes} onStep={onStep} />);
    expect(screen.getByRole('button', { name: 'Next pass' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous pass' }));
    expect(onStep).toHaveBeenLastCalledWith(START + HOUR_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Back four hours' }));
    expect(onStep).toHaveBeenLastCalledWith(START + 2 * HOUR_MS);
  });

  /** FR-SPAN-3, FR-SPAN-4: a control with nowhere to go dims; the row never loses a button, so it never moves. */
  it('disables rather than removes at either end of the span', () => {
    const onStep = vi.fn();
    const { rerender } = render(<StepControls t={START} span={span} passes={passes} onStep={onStep} />);
    expect(screen.getByRole('button', { name: 'Previous pass' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back four hours' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Forward four hours' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back four hours' }));
    expect(onStep).not.toHaveBeenCalled();
    rerender(<StepControls t={span.end} span={span} passes={passes} onStep={onStep} />);
    expect(screen.getAllByRole('button').every((el) => el.isConnected)).toBe(true);
    expect(screen.getByRole('button', { name: 'Forward four hours' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next pass' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back four hours' })).toBeEnabled();
    // …and the step it takes is clamped by the hook, not here: the row asks for four hours back and no more (D-190).
    fireEvent.click(screen.getByRole('button', { name: 'Back four hours' }));
    expect(onStep).toHaveBeenLastCalledWith(span.end - CHUNK_MS);
  });

  it('speaks Spanish, and the row fits 35 cells in both languages (FR-I18N-2, FR-COMP-4)', () => {
    render(
      <I18nProvider locale="es">
        <StepControls t={START} span={span} passes={passes} onStep={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('group', { name: 'Mover el instante mostrado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pasada siguiente' })).toHaveTextContent('sale ▶|');
    expect(screen.getByRole('button', { name: 'Cuatro horas adelante' })).toHaveTextContent('4h ▶');
    for (const catalog of [en, es]) {
      expect(cells(Object.values(catalog.live.step))).toBeLessThanOrEqual(BUDGET);
      // The chunk buttons say the hours the stripe actually draws.
      expect(catalog.live.step.forwardChunk).toContain(`${String(STRIPE_CHUNK_H)}h`);
      expect(catalog.live.step.backChunk).toContain(`${String(STRIPE_CHUNK_H)}h`);
    }
  });
});
