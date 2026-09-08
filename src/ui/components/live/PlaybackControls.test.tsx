/**
 * R33 (FR-LIVE-5, FR-LIVE-6): the controls row words and wires what the page
 * owns. R48 (FR-LIVE-7 as amended, FR-COMP-4): on compact — jsdom, which has
 * no `matchMedia` — play and pause are glyphs under their spoken names and
 * the speeds bracket the chosen one; on wide the words and the `[x]` toggle;
 * the two compact control rows fit 36 cells in both languages.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { SPEEDS } from '../../../lib/playback';
import { HiddenToggle, PlaybackControls, type PlaybackControlsProps } from './PlaybackControls';

const handlers = () => ({ onPlay: vi.fn(), onPause: vi.fn(), onSpeed: vi.fn(), onNow: vi.fn() });
const props = (over: Partial<PlaybackControlsProps> = {}): PlaybackControlsProps => ({ playing: false, speed: 60, realTime: true, ...handlers(), ...over });

/** The wide shell: a `matchMedia` that says the viewport is past the breakpoint. */
const stubWide = (): void => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
};

/** FR-COMP-4: the cells of one control row — every label with its brackets, and one cell between the controls. */
const cells = (labels: readonly string[]): number => labels.reduce((sum, label) => sum + [...label].length, 0) + labels.length - 1;

describe('<PlaybackControls>', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays, pauses, picks a speed and returns to now, as glyphs and a bracketed speed on compact', async () => {
    const p = props();
    const { container, rerender } = render(<PlaybackControls {...p} />);
    expect(screen.getByRole('group', { name: 'Playback' })).toHaveAttribute('data-compact', 'true');
    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).toHaveTextContent('▶');
    fireEvent.click(play);
    expect(p.onPlay).toHaveBeenCalledTimes(1);
    // Real time: there is nothing for `Now` to do.
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
    const speeds = screen.getByRole('group', { name: 'Playback speed' });
    expect(speeds.querySelector('[aria-pressed="true"]')?.textContent).toBe('60×');
    expect(speeds.querySelectorAll('button')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: '3600×' }));
    expect(p.onSpeed).toHaveBeenLastCalledWith(3600);
    fireEvent.click(screen.getByRole('button', { name: '60×' }));
    expect(p.onSpeed).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();

    const playing = props({ playing: true, speed: 3600, realTime: false });
    rerender(<PlaybackControls {...playing} />);
    const pause = screen.getByRole('button', { name: 'Pause' });
    expect(pause).toHaveTextContent('‖');
    fireEvent.click(pause);
    expect(playing.onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Now' }));
    expect(playing.onNow).toHaveBeenCalledTimes(1);
    expect(speeds.querySelector('[aria-pressed="true"]')?.textContent).toBe('3600×');
  });

  it('keeps the words and the [x] speed toggle on wide', () => {
    stubWide();
    render(<PlaybackControls {...props({ playing: true })} />);
    expect(screen.getByRole('group', { name: 'Playback' })).toHaveAttribute('data-compact', 'false');
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveTextContent('Pause');
    expect(screen.getByRole('group', { name: 'Playback speed' }).querySelector('[aria-pressed="true"]')?.textContent).toBe('60×');
  });

  it('the hidden-objects toggle is a pressed button under its full name, one word on compact', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<HiddenToggle hidden={false} onToggle={onToggle} />);
    const toggle = screen.getByRole('button', { name: 'Hidden objects' });
    expect(toggle).toHaveTextContent(/^Hidden$/);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<HiddenToggle hidden onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('speaks Spanish (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <PlaybackControls {...props({ realTime: false })} />
        <HiddenToggle hidden={false} onToggle={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('group', { name: 'Reproducción' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahora' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Objetos ocultos' })).toHaveTextContent(/^Ocultos$/);
    expect(screen.getByRole('group', { name: 'Velocidad de reproducción' })).toBeInTheDocument();
  });

  // FR-COMP-4 (D-245): the live page's two compact control rows, counted from the catalogs. The count is
  // the characters: on compact every control on the two rows is text with no box or padding (`Live.module.css`).
  it('the two compact control rows fit 36 cells in both languages (FR-COMP-4)', () => {
    for (const catalog of [en, es]) {
      const m = catalog.live;
      const speeds = SPEEDS.map((value) => m.speed(value));
      const speedRow = speeds.reduce((sum, label) => sum + [...label].length, 0) + 2 + (speeds.length - 1);
      const playback = cells([`[ ${m.playShort} ]`, `[ ${m.now} ]`]) + 1 + speedRow;
      const pausing = cells([`[ ${m.pauseShort} ]`, `[ ${m.now} ]`]) + 1 + speedRow;
      // R66 (V13-6): the follow control is gone, so the actions row is the hidden-objects toggle and the share action.
      const actions = cells([`[ ] ${m.hiddenShort}`, `[ ${m.shareShort} ]`]);
      expect(playback).toBeLessThanOrEqual(36);
      expect(pausing).toBeLessThanOrEqual(36);
      expect(actions).toBeLessThanOrEqual(36);
    }
  });
});
