// @vitest-environment jsdom
/**
 * R144 (FR-TONIGHT-4, D-901): the three taps and the play control — the four controls in their order with the
 * catalog's words in both languages, each a `.target`; the play glyph named by its word and switching with the
 * state; each tap calling its handler; `next` and `now` disabled where FR-TONIGHT-4 says, and `tonight` with no night
 * to land in. What each tap lands on
 * is `lib/tonightJump.ts`'s (its own test) wired by `Live.tsx` (`Live.test.tsx`).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { TimeTaps, type TimeTapsProps } from './TimeTaps';

afterEach(cleanup);

const handlers = () => ({ onPlay: vi.fn(), onPause: vi.fn(), onTonight: vi.fn(), onNext: vi.fn(), onNow: vi.fn() });

const mount = (locale: Locale, over: Partial<TimeTapsProps> = {}) => {
  const fns = handlers();
  const utils = render(
    <I18nProvider locale={locale}>
      <TimeTaps playing={false} tonightDisabled={false} nextDisabled={false} nowDisabled={false} {...fns} {...over} />
    </I18nProvider>,
  );
  return { ...utils, ...fns, row: screen.getByTestId('live-taps') };
};

describe('<TimeTaps> (FR-TONIGHT-4)', () => {
  it.each([
    ['en', en],
    ['es', es],
  ] as const)('renders the play control then tonight, next and now in %s, each a target, under the group’s name', async (locale, m) => {
    const { container, row } = mount(locale);
    expect(row).toHaveAttribute('role', 'group');
    expect(row).toHaveAttribute('aria-label', m.live.taps);
    const buttons = within(row).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([m.live.playShort, m.live.tap.tonight, m.live.tap.next, m.live.tap.now]);
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(['live-play', 'live-tap-tonight', 'live-tap-next', 'live-tap-now']);
    for (const b of buttons) expect(b.classList.contains('target'), b.textContent ?? '').toBe(true);
    // The glyph's accessible name is the word (FR-X-5: the state in the characters, the name in words).
    expect(within(row).getByRole('button', { name: m.live.play })).toBe(buttons[0]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is ▶ named Play while paused and ‖ named Pause while playing, each calling its handler', () => {
    const paused = mount('en');
    const play = screen.getByTestId('live-play');
    expect(play).toHaveTextContent('▶');
    expect(play).toHaveAttribute('data-playing', 'false');
    fireEvent.click(play);
    expect(paused.onPlay).toHaveBeenCalledTimes(1);
    expect(paused.onPause).not.toHaveBeenCalled();
    cleanup();
    const playing = mount('en', { playing: true });
    const pause = screen.getByRole('button', { name: en.live.pause });
    expect(pause).toHaveTextContent('‖');
    expect(pause).toHaveAttribute('data-playing', 'true');
    fireEvent.click(pause);
    expect(playing.onPause).toHaveBeenCalledTimes(1);
    expect(playing.onPlay).not.toHaveBeenCalled();
  });

  it('calls onTonight, onNext and onNow from their taps', () => {
    const { onTonight, onNext, onNow } = mount('en');
    fireEvent.click(screen.getByRole('button', { name: en.live.tap.tonight }));
    fireEvent.click(screen.getByRole('button', { name: en.live.tap.next }));
    fireEvent.click(screen.getByRole('button', { name: en.live.tap.now }));
    expect(onTonight).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNow).toHaveBeenCalledTimes(1);
  });

  it('disables next at the last pass and now on real time, and a tap on either does nothing', () => {
    const { onNext, onNow } = mount('en', { nextDisabled: true, nowDisabled: true });
    const next = screen.getByTestId('live-tap-next');
    const now = screen.getByTestId('live-tap-now');
    expect(next).toBeDisabled();
    expect(now).toBeDisabled();
    expect(screen.getByTestId('live-tap-tonight')).toBeEnabled();
    fireEvent.click(next);
    fireEvent.click(now);
    expect(onNext).not.toHaveBeenCalled();
    expect(onNow).not.toHaveBeenCalled();
  });

  it('disables tonight with no night in the bands, and a tap on it does nothing', () => {
    const { onTonight } = mount('en', { tonightDisabled: true });
    const tonight = screen.getByTestId('live-tap-tonight');
    expect(tonight).toBeDisabled();
    expect(screen.getByTestId('live-tap-next')).toBeEnabled();
    fireEvent.click(tonight);
    expect(onTonight).not.toHaveBeenCalled();
  });
});
