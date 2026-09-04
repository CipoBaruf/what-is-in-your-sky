import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { Countdown, countdownState } from './Countdown';

const pass = goldenPassFixture();
const S = 1000;

const headline = (state: ReturnType<typeof countdownState>): string => en.countdown.headline({ phase: state.phase, reason: state.reason, clock: '0:10' });

describe('countdownState', () => {
  it('walks rise → peak → set → ended with the seconds to the next boundary', () => {
    expect(countdownState(pass, pass.start.t - 192 * S)).toEqual({ phase: 'before', reason: 'horizon', seconds: 192 });
    expect(countdownState(pass, pass.start.t)).toMatchObject({ phase: 'to-peak' });
    expect(countdownState(pass, pass.peak.t - 5 * S).seconds).toBe(5);
    expect(countdownState(pass, pass.peak.t)).toMatchObject({ phase: 'to-end', reason: 'horizon' });
    expect(countdownState(pass, pass.end.t)).toMatchObject({ phase: 'over', reason: 'horizon', seconds: 0 });
    expect(countdownState(pass, pass.end.t + 90 * S).seconds).toBe(90);
  });

  it('carries the boundary reason, which the catalog words (R17)', () => {
    const shadow = { ...pass, startReason: 'shadow' as const, endReason: 'shadow' as const };
    expect(headline(countdownState(shadow, pass.start.t - S))).toBe('Leaves shadow in 0:10');
    expect(headline(countdownState(shadow, pass.peak.t))).toBe('Enters shadow in 0:10');
    expect(headline(countdownState({ ...pass, endReason: 'twilight' }, pass.peak.t))).toBe('Fades in 0:10');
    expect(es.countdown.headline({ phase: 'to-end', reason: 'shadow', clock: '0:10' })).toBe('Entra en la sombra en 0:10');
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

  it('reads in Spanish under a Spanish provider, step names included (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <Countdown pass={pass} now={pass.start.t - 754 * S} timeZone={null} />
      </I18nProvider>,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('Aparece en 12:34');
    const steps = screen.getByRole('list', { name: es.countdown.steps });
    expect(steps).toHaveTextContent('salida 09:48:14 UTC');
    expect(steps).toHaveTextContent('máximo 09:48:38 UTC');
    expect(steps).toHaveTextContent('fin 09:49:02 UTC');
  });
});
