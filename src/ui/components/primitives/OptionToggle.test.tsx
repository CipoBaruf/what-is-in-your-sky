/**
 * TASKS R13, moved and re-cut by R104 (FR-DS-4 item 3): one `[x] option` in
 * both themes — a pressed-state button whose state is `aria-pressed`, whose
 * tap means what the parent says (nothing, when the parent passes nothing),
 * whose value is findable as `data-option` (R66), and which stands alone
 * without the trailing cell a group gives it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OptionToggle } from './OptionToggle';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<OptionToggle> under data-theme=%s', (theme) => {
  it('is a pressed-state button named by its label, with its value as data-option', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const onPress = vi.fn();
    const { container, rerender } = render(<OptionToggle label="Alpha" pressed={false} value="a" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Alpha' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('data-option', 'a');
    expect(button).toHaveTextContent(/^Alpha$/);
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<OptionToggle label="Alpha" pressed value="a" />);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('alone, it drops the trailing cell; as a radio, its state is aria-checked', () => {
    document.documentElement.setAttribute('data-theme', theme);
    render(
      <>
        <OptionToggle label="Hidden" pressed alone aria-label="Hidden objects" />
        <div role="radiogroup" aria-label="Pick">
          <OptionToggle label="A" pressed role="radio" />
        </div>
      </>,
    );
    const alone = screen.getByRole('button', { name: 'Hidden objects' });
    expect(alone.className).toMatch(/option/);
    expect(alone.className).toMatch(/alone/);
    const radio = screen.getByRole('radio', { name: 'A' });
    expect(radio).toHaveAttribute('aria-checked', 'true');
    expect(radio).not.toHaveAttribute('aria-pressed');
    expect(radio.className).not.toMatch(/alone/);
  });
});

describe('<OptionToggle> target (R134, FR-FLOW-11, D-851)', () => {
  it('is a .target, alone or in a group', () => {
    render(<OptionToggle label="Hidden" pressed={false} alone />);
    expect(screen.getByRole('button', { name: 'Hidden' })).toHaveClass('target');
  });
});
