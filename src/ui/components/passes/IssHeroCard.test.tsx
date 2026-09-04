/**
 * TASKS R12 (spec §8 rank 1, US-5 AC4): the hero card names the pass,
 * carries the kicker, counts down to the rise, peak or end, shows the same
 * fields as a card, the twilight label when due, and the open control.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { HERO_TICK_MS, heroCountdown, heroKicker, IssHeroCard } from './IssHeroCard';

const pass = goldenPassFixture();

describe('heroKicker / heroCountdown', () => {
  it('says "Next ISS pass" for the station and "Next <name> pass" otherwise, with the name untranslated (FR-I18N-6)', () => {
    expect(heroKicker(pass, en)).toBe('Next ISS pass');
    expect(heroKicker({ ...pass, name: 'Tiangong (Tianhe)' }, en)).toBe('Next Tiangong (Tianhe) pass');
    expect(heroKicker(pass, es)).toBe('Próximo pase de la ISS');
    expect(heroKicker({ ...pass, name: 'Tiangong (Tianhe)' }, es)).toBe('Próximo pase de Tiangong (Tianhe)');
  });

  it('counts down to the rise, then the peak, then the end, then counts up since the end', () => {
    expect(heroCountdown(pass, pass.start.t - 754_000, en)).toBe('Appears in 12:34');
    expect(heroCountdown(pass, pass.start.t + 1000, en)).toMatch(/^Peak in \d+:\d\d$/);
    expect(heroCountdown(pass, pass.peak.t + 1000, en)).toMatch(/^Sets in \d+:\d\d$/);
    expect(heroCountdown({ ...pass, endReason: 'shadow' }, pass.peak.t + 1000, en)).toMatch(/^Enters shadow in /);
    expect(heroCountdown(pass, pass.end.t + 180_000, en)).toBe('Ended 3:00 ago');
    expect(heroCountdown(pass, pass.end.t + 180_000, es)).toBe('Terminó hace 3:00');
  });
});

describe('<IssHeroCard>', () => {
  it('is an article named after the pass with the kicker, the countdown, the fields, the twilight label and the open control', async () => {
    const onOpen = vi.fn();
    const { container } = render(<IssHeroCard pass={pass} timeZone={null} now={pass.start.t - 754_000} weather={null} onOpen={onOpen} />);
    const card = screen.getByRole('article', { name: 'ISS (Zarya)' });
    expect(card).toHaveAttribute('data-pass-id', pass.id);
    expect(card).toHaveAttribute('data-testid', 'iss-hero');
    expect(within(card).getByText('Next ISS pass')).toBeInTheDocument();
    expect(within(card).getByRole('timer')).toHaveTextContent('Appears in 12:34');
    expect(within(card).getByText('Start', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/\d\d:\d\d:\d\d UTC$/);
    expect(within(card).getByText('Max elevation', { selector: 'dt' }).nextElementSibling).toHaveTextContent(`${String(Math.round(pass.peak.elDeg))}°`);
    expect(within(card).getByText('Weather unknown')).toBeInTheDocument();
    expect(card).toHaveTextContent('sky still bright');
    await userEvent.click(within(card).getByRole('button', { name: 'Open guide → ISS (Zarya)' }));
    expect(onOpen).toHaveBeenCalledWith(pass.id);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('omits the twilight label and the open control when not due', () => {
    render(<IssHeroCard pass={{ ...pass, twilight: false }} timeZone={null} now={pass.start.t - 1000} />);
    const card = screen.getByRole('article');
    expect(card).not.toHaveTextContent('sky still bright');
    expect(within(card).queryByRole('button')).toBeNull();
    expect(within(card).queryByText('Clouds', { selector: 'dt' })).toBeNull();
  });

  describe('ticking', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      vi.setSystemTime(pass.start.t - 754_000);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('re-reads the clock every second without a `now` prop', () => {
      render(<IssHeroCard pass={pass} timeZone={null} />);
      const timer = screen.getByRole('timer');
      expect(timer).toHaveTextContent('Appears in 12:34');
      act(() => {
        vi.advanceTimersByTime(HERO_TICK_MS);
      });
      expect(timer).toHaveTextContent('Appears in 12:33');
    });
  });
});
