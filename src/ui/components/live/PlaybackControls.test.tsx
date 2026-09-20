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
import { BackToLive, HiddenToggle, PlaybackControls, ScrubButton, type PlaybackControlsProps } from './PlaybackControls';

const handlers = () => ({ onPlay: vi.fn(), onPause: vi.fn(), onSpeed: vi.fn() });
const props = (over: Partial<PlaybackControlsProps> = {}): PlaybackControlsProps => ({ playing: false, speed: 60, ...handlers(), ...over });

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

  it('plays, pauses and picks a speed, as glyphs and a bracketed speed on compact, with no Now of its own (FR-WATCH-1)', async () => {
    const p = props();
    const { container, rerender } = render(<PlaybackControls {...p} />);
    expect(screen.getByRole('group', { name: 'Playback' })).toHaveAttribute('data-compact', 'true');
    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).toHaveTextContent('▶');
    fireEvent.click(play);
    expect(p.onPlay).toHaveBeenCalledTimes(1);
    // R77: `[ back to live ]` is the `now` action, and it stands where FR-WATCH-4 puts it, not on this row.
    expect(screen.queryByTestId('live-now')).toBeNull();
    const speeds = screen.getByRole('group', { name: 'Playback speed' });
    expect(speeds.querySelector('[aria-pressed="true"]')?.textContent).toBe('60×');
    expect(speeds.querySelectorAll('button')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: '3600×' }));
    expect(p.onSpeed).toHaveBeenLastCalledWith(3600);
    fireEvent.click(screen.getByRole('button', { name: '60×' }));
    expect(p.onSpeed).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();

    const playing = props({ playing: true, speed: 3600 });
    rerender(<PlaybackControls {...playing} />);
    const pause = screen.getByRole('button', { name: 'Pause' });
    expect(pause).toHaveTextContent('‖');
    fireEvent.click(pause);
    expect(playing.onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    expect(speeds.querySelector('[aria-pressed="true"]')?.textContent).toBe('3600×');
  });

  it('keeps the words and the [x] speed toggle on wide', () => {
    stubWide();
    render(<PlaybackControls {...props({ playing: true })} />);
    expect(screen.getByRole('group', { name: 'Playback' })).toHaveAttribute('data-compact', 'false');
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveTextContent('Pause');
    expect(screen.getByRole('group', { name: 'Playback speed' }).querySelector('[aria-pressed="true"]')?.textContent).toBe('60×');
  });

  it('[ scrub ] and [ back to live ] are one action each, the scrub named for the night on wide (FR-WATCH-1, FR-WATCH-8)', () => {
    const onScrub = vi.fn();
    const onNow = vi.fn();
    const { unmount } = render(<><ScrubButton onScrub={onScrub} /><BackToLive onNow={onNow} /></>);
    fireEvent.click(screen.getByRole('button', { name: 'scrub' }));
    expect(onScrub).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'back to live' }));
    expect(onNow).toHaveBeenCalledTimes(1);
    unmount();
    stubWide();
    render(<ScrubButton onScrub={onScrub} />);
    expect(screen.getByTestId('live-scrub')).toHaveTextContent(/^scrub the night$/);
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
        <PlaybackControls {...props()} />
        <HiddenToggle hidden={false} onToggle={vi.fn()} />
        <ScrubButton onScrub={vi.fn()} />
        <BackToLive onNow={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('group', { name: 'Reproducción' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fijar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ir al vivo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Objetos ocultos' })).toHaveTextContent(/^Ocultos$/);
    expect(screen.getByRole('group', { name: 'Velocidad de reproducción' })).toBeInTheDocument();
  });

  // FR-COMP-4 (D-245): the live page's compact control rows, counted from the catalogs. The count is
  // the characters: on compact every control on the two rows is text with no box or padding (`Live.module.css`).
  it('the two compact control rows fit 36 cells in both languages (FR-COMP-4)', () => {
    for (const catalog of [en, es]) {
      const m = catalog.live;
      const speeds = SPEEDS.map((value) => m.speed(value));
      const speedRow = speeds.reduce((sum, label) => sum + [...label].length, 0) + 2 + (speeds.length - 1);
      // R77 (FR-WATCH-1): `Now` has left the playback row for the actions row as `[ back to live ]`.
      const playback = cells([`[ ${m.playShort} ]`]) + 1 + speedRow;
      const pausing = cells([`[ ${m.pauseShort} ]`]) + 1 + speedRow;
      // R77 (FR-WATCH-4, V20-8): the two actions rows, watching and scrubbing, with the list at two digits.
      const watching = cells([`[ ${m.scrub} ]`, `[ ${m.list({ count: 12 })} ]`, m.shareShort]);
      const scrubbing = cells([`[ ${m.backToLive} ]`, `[ ] ${m.hiddenShort}`, m.shareShort]);
      expect(playback).toBeLessThanOrEqual(36);
      expect(pausing).toBeLessThanOrEqual(36);
      expect(watching).toBeLessThanOrEqual(36);
      expect(scrubbing).toBeLessThanOrEqual(36);
    }
  });
});
