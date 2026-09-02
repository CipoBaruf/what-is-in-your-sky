import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { Countdown, countdownState } from './Countdown';

const pass = goldenPassFixture();
const S = 1000;

describe('countdownState', () => {
  it('walks rise → peak → set → ended with the seconds to the next boundary', () => {
    expect(countdownState(pass, pass.start.t - 192 * S)).toEqual({ phase: 'before', label: 'Appears in', seconds: 192 });
    expect(countdownState(pass, pass.start.t)).toMatchObject({ phase: 'to-peak', label: 'Peak in' });
    expect(countdownState(pass, pass.peak.t - 5 * S).seconds).toBe(5);
    expect(countdownState(pass, pass.peak.t)).toMatchObject({ phase: 'to-end', label: 'Sets in' });
    expect(countdownState(pass, pass.end.t)).toMatchObject({ phase: 'over', label: 'Ended', seconds: 0 });
    expect(countdownState(pass, pass.end.t + 90 * S).seconds).toBe(90);
  });

  it('words the boundaries after their reasons', () => {
    const shadow = { ...pass, startReason: 'shadow' as const, endReason: 'shadow' as const };
    expect(countdownState(shadow, pass.start.t - S).label).toBe('Leaves shadow in');
    expect(countdownState(shadow, pass.peak.t).label).toBe('Enters shadow in');
    expect(countdownState({ ...pass, endReason: 'twilight' }, pass.peak.t).label).toBe('Fades in');
  });
});

describe('<Countdown>', () => {
  it('shows the headline and marks the current step', () => {
    const { rerender } = render(<Countdown pass={pass} now={pass.start.t - 754 * S} timeZone={null} />);
    expect(screen.getByRole('timer')).toHaveTextContent('Appears in 12:34');
    const steps = screen.getByRole('list', { name: 'Rise, peak and set times' });
    expect(steps).toHaveTextContent('rise 09:48:14 UTC');
    expect(steps).toHaveTextContent('peak 09:48:38 UTC');
    expect(steps).toHaveTextContent('set 09:49:02 UTC');
    expect(screen.getByText(/rise/).closest('li')).toHaveAttribute('aria-current', 'step');

    rerender(<Countdown pass={pass} now={pass.peak.t + S} timeZone={null} />);
    expect(screen.getByRole('timer')).toHaveTextContent('Sets in 0:23');
    expect(screen.getByText(/set/).closest('li')).toHaveAttribute('aria-current', 'step');

    rerender(<Countdown pass={pass} now={pass.end.t + 3661 * S} timeZone={null} />);
    expect(screen.getByRole('timer')).toHaveTextContent('Ended 1:01:01 ago');
    expect(document.querySelector('[aria-current]')).toBeNull();
  });
});
