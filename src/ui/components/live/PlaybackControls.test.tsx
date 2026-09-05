/** R33 (FR-LIVE-5, FR-LIVE-6): the controls row words and wires what the page owns. */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { PlaybackControls, type PlaybackControlsProps } from './PlaybackControls';

const handlers = () => ({ onPlay: vi.fn(), onPause: vi.fn(), onSpeed: vi.fn(), onNow: vi.fn(), onToggleHidden: vi.fn() });
const props = (over: Partial<PlaybackControlsProps> = {}): PlaybackControlsProps => ({ playing: false, speed: 60, realTime: true, hidden: false, ...handlers(), ...over });

describe('<PlaybackControls>', () => {
  it('plays, pauses, picks a speed, returns to now and toggles the hidden objects', async () => {
    const p = props();
    const { container, rerender } = render(<PlaybackControls {...p} />);
    expect(screen.getByRole('group', { name: 'Playback' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(p.onPlay).toHaveBeenCalledTimes(1);
    // Real time: there is nothing for `Now` to do.
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
    const speeds = screen.getByRole('group', { name: 'Playback speed' });
    expect(speeds.querySelector('[aria-pressed="true"]')?.textContent).toBe('60×');
    fireEvent.click(screen.getByRole('button', { name: '3600×' }));
    expect(p.onSpeed).toHaveBeenLastCalledWith(3600);
    fireEvent.click(screen.getByRole('button', { name: 'Hidden objects' }));
    expect(p.onToggleHidden).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'false');
    expect(await axe(container)).toHaveNoViolations();

    const playing = props({ playing: true, speed: 3600, realTime: false, hidden: true });
    rerender(<PlaybackControls {...playing} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(playing.onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Now' }));
    expect(playing.onNow).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'true');
    expect(speeds.querySelector('[aria-pressed="true"]')?.textContent).toBe('3600×');
  });

  it('speaks Spanish (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <PlaybackControls {...props({ realTime: false })} />
      </I18nProvider>,
    );
    expect(screen.getByRole('group', { name: 'Reproducción' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahora' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Objetos ocultos' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Velocidad de reproducción' })).toBeInTheDocument();
  });
});
