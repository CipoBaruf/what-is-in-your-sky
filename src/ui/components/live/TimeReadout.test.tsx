/**
 * R48 (FR-TRAJ-4, US-22 AC5): the readout above the stripe — the clock to the minute, and the weekday only when
 * the instant is not today. R77 (FR-WATCH-2, US-27 AC3): the scrubbing state's headline, with its offset from now.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { TimeReadout } from './TimeReadout';

const ZONE = 'America/Argentina/Salta';
const NOW = Date.UTC(2026, 8, 11, 9, 30, 0); // Friday 06:30 in Neuquén

describe('<TimeReadout>', () => {
  it('prints the shown instant to the minute in the zone, with no weekday today, and its offset from now', () => {
    render(<TimeReadout t={NOW + 33 * 60_000 + 10_000} now={NOW} timeZone={ZONE} />);
    const readout = screen.getByTestId('time-readout');
    expect(readout).toHaveTextContent(/^07:03 · \+33 min$/);
    expect(readout).toHaveAttribute('data-today', 'true');
  });

  it('reads an instant behind now with a minus, and hours past sixty minutes', () => {
    const { rerender } = render(<TimeReadout t={NOW - 12 * 60_000} now={NOW} timeZone={ZONE} />);
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^06:18 · −12 min$/);
    rerender(<TimeReadout t={NOW + 125 * 60_000} now={NOW} timeZone={ZONE} />);
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^08:35 · \+2 h 05 min$/);
  });

  it('puts the weekday in front once the instant has crossed midnight, in the page language', () => {
    const { rerender } = render(<TimeReadout t={NOW + 20 * 3_600_000} now={NOW} timeZone={ZONE} />);
    const readout = screen.getByTestId('time-readout');
    expect(readout).toHaveTextContent(/^Sat 02:30 · \+20 h 00 min$/);
    expect(readout).toHaveAttribute('data-today', 'false');
    rerender(
      <I18nProvider locale="es">
        <TimeReadout t={NOW + 20 * 3_600_000} now={NOW} timeZone={ZONE} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^sáb 02:30 · \+20 h 00 min$/);
  });

  it('reads UTC while the zone is unknown', () => {
    render(<TimeReadout t={NOW} now={NOW} timeZone={null} />);
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^09:30 · \+0 min$/);
  });
});
