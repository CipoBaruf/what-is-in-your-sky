/**
 * R33 (FR-LIVE-5, FR-LIVE-6): the controls row words and wires what the page
 * owns: the words and the `[x]` speed toggle. R145 (FR-TONIGHT-6): the row,
 * `[ scrub the night ]` and `[ back to live ]` are wide's alone, so R48's
 * compact glyphs and R85's short labels left them; the hidden-objects toggle
 * is still one word on compact (jsdom, which has no `matchMedia`), in the list
 * panel's head.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { BackToLive, HiddenToggle, PlaybackControls, ScrubButton, type PlaybackControlsProps } from './PlaybackControls';

const handlers = () => ({ onPlay: vi.fn(), onPause: vi.fn(), onSpeed: vi.fn() });
const props = (over: Partial<PlaybackControlsProps> = {}): PlaybackControlsProps => ({ playing: false, speed: 60, ...handlers(), ...over });

describe('<PlaybackControls>', () => {
  it('plays, pauses and picks a speed, in words, with no Now of its own (FR-WATCH-1)', async () => {
    const p = props();
    const { container, rerender } = render(<PlaybackControls {...p} />);
    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).toHaveTextContent(/^Play$/);
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
    expect(pause).toHaveTextContent(/^Pause$/);
    fireEvent.click(pause);
    expect(playing.onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    expect(speeds.querySelector('[aria-pressed="true"]')?.textContent).toBe('3600×');
  });

  it('[ scrub the night ] and [ back to live ] are one action each (FR-WATCH-1, FR-WATCH-8)', () => {
    const onScrub = vi.fn();
    const onNow = vi.fn();
    render(<><ScrubButton onScrub={onScrub} /><BackToLive onNow={onNow} /></>);
    fireEvent.click(screen.getByRole('button', { name: 'scrub the night' }));
    expect(onScrub).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'back to live' }));
    expect(onNow).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole('button', { name: 'recorrer la noche' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ir al vivo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Objetos ocultos' })).toHaveTextContent(/^Ocultos$/);
    expect(screen.getByRole('group', { name: 'Velocidad de reproducción' })).toBeInTheDocument();
  });
});
