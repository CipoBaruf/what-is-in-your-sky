/**
 * R209 (FR-CTRL-16; D-1228): the disclosure in both themes — the arrow, the
 * count, the whole line the control, and `aria-expanded`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Disclosure } from './Disclosure';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Disclosure> under data-theme=%s', (theme) => {
  it('FR-CTRL-16: is one control whose aria-expanded and arrow follow `open`', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const onToggle = vi.fn();
    const { container, rerender } = render(<Disclosure open={false} onToggle={onToggle} label="Tonight" count={3} />);
    const line = screen.getByRole('button', { name: 'Tonight · 3' });
    expect(container.children).toHaveLength(1);
    expect(line).toHaveAttribute('type', 'button');
    expect(line).toHaveAttribute('aria-expanded', 'false');
    expect(line.textContent).toBe('▸ Tonight · 3');
    fireEvent.click(line);
    expect(onToggle).toHaveBeenCalledExactlyOnceWith();
    rerender(<Disclosure open onToggle={onToggle} label="Tonight" count={3} />);
    expect(line).toHaveAttribute('aria-expanded', 'true');
    expect(line.textContent).toBe('▾ Tonight · 3');
    expect(line).toHaveAccessibleName('Tonight · 3');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws a count of none and no dot without a count', () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { rerender } = render(<Disclosure open={false} onToggle={vi.fn()} label="Details" />);
    expect(screen.getByRole('button').textContent).toBe('▸ Details');
    rerender(<Disclosure open={false} onToggle={vi.fn()} label="Tonight" count={0} />);
    expect(screen.getByRole('button').textContent).toBe('▸ Tonight · 0');
  });
});
