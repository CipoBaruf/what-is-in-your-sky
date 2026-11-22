/**
 * R214 (FR-CTRL-9; D-1228): the zoom keys in both themes — the three in their
 * order, named, each its own press, and the one at the range's end disabled.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZoomKeys } from './ZoomKeys';

const THEMES = ['dark', 'night'] as const;
const names = { in: 'Zoom in', out: 'Zoom out', reset: 'Reset view' };

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<ZoomKeys> under data-theme=%s', (theme) => {
  it('FR-CTRL-9: is − + ⟲ in one box, each key named and its own press', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const [onIn, onOut, onReset] = [vi.fn(), vi.fn(), vi.fn()];
    const { container } = render(<ZoomKeys onIn={onIn} onOut={onOut} onReset={onReset} names={names} />);
    expect(container.children).toHaveLength(1);
    const keys = screen.getAllByRole('button');
    expect(keys.map((key) => key.textContent)).toEqual(['−', '+', '⟲']);
    expect(keys.map((key) => key.getAttribute('aria-label'))).toEqual(['Zoom out', 'Zoom in', 'Reset view']);
    for (const key of keys) expect(key).toHaveAttribute('type', 'button');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(onIn).toHaveBeenCalledExactlyOnceWith();
    expect(onOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(onOut).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(onReset).toHaveBeenCalledExactlyOnceWith();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FR-CTRL-17: disables the key at the end the zoom is at, and never the reset', () => {
    document.documentElement.setAttribute('data-theme', theme);
    const disabled = (): boolean[] => screen.getAllByRole<HTMLButtonElement>('button').map((key) => key.disabled);
    const press = vi.fn();
    const { rerender } = render(<ZoomKeys onIn={press} onOut={press} onReset={press} names={names} end="in" />);
    expect(disabled()).toEqual([false, true, false]);
    rerender(<ZoomKeys onIn={press} onOut={press} onReset={press} names={names} end="out" />);
    expect(disabled()).toEqual([true, false, false]);
    rerender(<ZoomKeys onIn={press} onOut={press} onReset={press} names={names} />);
    expect(disabled()).toEqual([false, false, false]);
  });
});
