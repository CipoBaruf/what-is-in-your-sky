/**
 * R81 (FR-FIRST-3 as amended v2.0.2, D-508): the block's lines and its control
 * in order — the label with its countdown, the clock time, the path, then
 * `[ Open the live sky ]` — and the phone's first-card form; the one-line
 * statement with no pass, with and without the live link.
 */
import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import run from '../../../../tests/fixtures/stored-run-neuquen.json';
import { I18nProvider } from '../../../i18n/useT';
import type { Pass } from '../../../model';
import { NEXT_EVENT_TICK_MS, NextEventBlock } from './NextEventBlock';

const passes = run.passes as unknown as Pass[];
/** SL-16 R/B (Cosmos 2369): rises at the threshold in the S at 07:36:07 UTC, peaks 32° ESE, sets ENE at 07:46:12; 10 min long. */
const FIRST = passes.find((p) => p.id === '26070-1789112167032') as Pass;
const ZONE = 'America/Argentina/Salta';

const lines = (): string[] => [...screen.getByTestId('next-event').querySelectorAll('p')].map((p) => p.textContent);

describe('<NextEventBlock> (FR-FIRST-3)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('the label, the clock time, the path and the live link, in that order', async () => {
    const { container } = render(<NextEventBlock passes={passes} timeZone={ZONE} now={FIRST.start.t - (3 * 3600 + 45 * 60 + 7) * 1000} hours={72} />);
    expect(lines()).toEqual(['Next up · in 3:45:07', '04:36', 'SL-16 R/B (Cosmos 2369) · S low → 32° ESE → ENE', 'Open the live sky']);
    expect(screen.getByRole('region', { name: 'Next event' })).toBe(screen.getByTestId('next-event'));
    expect(screen.getByRole('link', { name: 'Open the live sky' })).toHaveAttribute('href', '#live');
    expect(screen.getByTestId('next-event-label')).toHaveAttribute('data-kind', 'rise');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('under way, counts to the peak and then to the end, and names the end’s time', () => {
    const { rerender } = render(<NextEventBlock passes={passes} timeZone={ZONE} now={FIRST.peak.t - 70_000} hours={72} />);
    expect(screen.getByTestId('next-event-label')).toHaveTextContent('Up now · peaks in 1:10');
    rerender(<NextEventBlock passes={passes} timeZone={ZONE} now={FIRST.end.t - 125_000} hours={72} />);
    expect(screen.getByTestId('next-event-label')).toHaveTextContent('Up now · sets in 2:05');
    expect(screen.getByTestId('next-event-time')).toHaveTextContent('04:46');
  });

  it('with no observer zone, the time is UTC and says so', () => {
    render(<NextEventBlock passes={passes} timeZone={null} now={FIRST.start.t - 60_000} hours={72} />);
    expect(screen.getByTestId('next-event-time')).toHaveTextContent('07:36 UTC');
  });

  it('ticks once a second from the wall clock', () => {
    vi.useFakeTimers({ now: FIRST.start.t - 65_000 });
    render(<NextEventBlock passes={passes} timeZone={ZONE} hours={72} />);
    expect(screen.getByTestId('next-event-label')).toHaveTextContent('Next up · in 1:05');
    act(() => {
      vi.advanceTimersByTime(NEXT_EVENT_TICK_MS);
    });
    expect(screen.getByTestId('next-event-label')).toHaveTextContent('Next up · in 1:04');
  });

  it('in Spanish', () => {
    render(
      <I18nProvider locale="es">
        <NextEventBlock passes={passes} timeZone={ZONE} now={FIRST.start.t - 754_000} hours={72} />
      </I18nProvider>,
    );
    expect(lines()).toEqual(['A continuación · en 12:34', '04:36', 'SL-16 R/B (Cosmos 2369) · S bajo → 32° ESE → ENE', 'Abrir el cielo en vivo']);
  });

  it('the first-card form: First up, the time and the name, the path with the duration, the brightness', () => {
    render(<NextEventBlock form="card" passes={passes} timeZone={ZONE} now={FIRST.start.t - 754_000} hours={72} />);
    expect(screen.getByTestId('next-event')).toHaveAttribute('data-form', 'card');
    expect(lines()).toEqual(['First up · in 12:34', '04:36   SL-16 R/B (Cosmos 2369)', 'S low → 32° ESE → ENE · 10 min', 'Faint, needs dark sky (+3.6)']);
    // The card is the phone's third step's: no link, the step's own control follows it.
    expect(screen.queryByRole('link')).toBeNull();
    // Without `onOpen` it is not a control.
    expect(screen.queryByRole('button')).toBeNull();
  });

  // R84 (FR-FIRST-3 as amended v2.1, US-26 AC7, F-84): the first card opens its pass like any other card.
  it('the first-card form with onOpen is one control, named like a pass card’s, that opens its pass', async () => {
    const onOpen = vi.fn();
    const { container } = render(<NextEventBlock form="card" passes={passes} timeZone={ZONE} now={FIRST.start.t - 754_000} hours={72} onOpen={onOpen} />);
    const card = screen.getByTestId('next-event');
    const button = screen.getByRole('button', { name: 'Open guide → SL-16 R/B (Cosmos 2369)' });
    expect(card.lastElementChild).toBe(button);
    expect(card.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')).toHaveLength(1);
    // The lines are unchanged by it.
    expect(lines()).toEqual(['First up · in 12:34', '04:36   SL-16 R/B (Cosmos 2369)', 'S low → 32° ESE → ENE · 10 min', 'Faint, needs dark sky (+3.6)']);
    act(() => {
      button.click();
    });
    expect(onOpen).toHaveBeenCalledWith(FIRST.id);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('with no pass: one line, with the reason, and the live link still', () => {
    render(<NextEventBlock passes={[]} timeZone={ZONE} context={{ hasDarkness: false, elementCount: 12 }} now={FIRST.start.t} hours={72} />);
    expect(screen.getByTestId('next-event-none')).toHaveTextContent('No darkness in the next 72 h at this latitude, so nothing to see.');
    expect(screen.getByTestId('next-event-none')).toHaveAttribute('data-reason', 'no-darkness');
    expect(screen.getByRole('link', { name: 'Open the live sky' })).toBeInTheDocument();
  });

  it('while the passes are arriving, says it is looking rather than that there are none', () => {
    render(<NextEventBlock passes={[]} timeZone={ZONE} pending now={FIRST.start.t} hours={72} />);
    expect(screen.getByTestId('next-event-none')).toHaveTextContent('Looking for the next pass…');
    expect(screen.getByTestId('next-event-none')).toHaveAttribute('data-reason', 'pending');
  });
});
