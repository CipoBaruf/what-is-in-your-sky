/**
 * R104 (FR-DS-4 item 3; D-705): the row of options in both themes — the group
 * and its name, the pressed option, a change reported only for another option,
 * the arrow keys moving between options and wrapping, the three marks, and
 * the `radiogroup` form where the arrows choose. The `group` form's DOM is the
 * one every row rendered before this primitive (role `group`, `aria-pressed`
 * buttons), which is what `controlRows.test.ts` and the captures count on.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToggleGroup } from './ToggleGroup';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const;

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<ToggleGroup> under data-theme=%s', (theme) => {
  const themed = (): void => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  it('marks the current option pressed and reports a change only when another option is chosen', async () => {
    themed();
    const onChange = vi.fn();
    const { container, rerender } = render(<ToggleGroup name="Pick" prefix="Pick:" options={options} value="a" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Pick' });
    expect(within(group).getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByText('Pick:')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(within(group).getByRole('button', { name: 'Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(group).getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    rerender(<ToggleGroup name="Pick" prefix="Pick:" options={options} value="b" onChange={onChange} />);
    expect(within(group).getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Beta' })).toHaveAttribute('data-option', 'b');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves between the options on the arrow keys, wrapping at the ends, and chooses nothing in a group', () => {
    themed();
    const onChange = vi.fn();
    render(<ToggleGroup name="Pick" options={options} value="a" onChange={onChange} />);
    const [alpha, beta, gamma] = within(screen.getByRole('group', { name: 'Pick' })).getAllByRole('button');
    alpha?.focus();
    fireEvent.keyDown(alpha as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(beta);
    fireEvent.keyDown(beta as Element, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(gamma);
    fireEvent.keyDown(gamma as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(alpha);
    fireEvent.keyDown(alpha as Element, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(gamma);
    fireEvent.keyDown(gamma as Element, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(beta);
    fireEvent.keyDown(beta as Element, { key: 'Enter' });
    expect(document.activeElement).toBe(beta);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('the bracket and tight marks render pressed text controls, the pressed one with its own class', () => {
    themed();
    const { rerender } = render(<ToggleGroup name="Sort" prefix="Sort:" mark="bracket" options={options} value="a" onChange={vi.fn()} />);
    const group = screen.getByRole('group', { name: 'Sort' });
    const alpha = within(group).getByRole('button', { name: 'Alpha' });
    expect(alpha).toHaveAttribute('aria-pressed', 'true');
    expect(alpha.className).toMatch(/toggle/);
    expect(alpha.className).not.toMatch(/toggleTight/);
    expect(within(group).getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'false');
    rerender(<ToggleGroup name="Speed" mark="tight" gap="none" options={options} value="b" onChange={vi.fn()} />);
    const speeds = screen.getByRole('group', { name: 'Speed' });
    expect(speeds.className).toMatch(/noGap/);
    expect(within(speeds).getByRole('button', { name: 'Beta' }).className).toMatch(/toggleTight/);
    expect(within(speeds).getAllByRole('button')).toHaveLength(3);
  });

  it('as a radiogroup: radios with aria-checked, one tab stop, and the arrow keys choose', async () => {
    themed();
    const onChange = vi.fn();
    const { container } = render(<ToggleGroup name="Pick" role="radiogroup" options={options} value="a" onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Pick' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(radios[0]).not.toHaveAttribute('aria-pressed');
    fireEvent.keyDown(radios[0] as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radios[1]);
    expect(onChange).toHaveBeenCalledWith('b');
    fireEvent.click(radios[2] as Element);
    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<ToggleGroup> targets (R134, FR-FLOW-11, D-851)', () => {
  it('makes each option a .target, and no row of the group itself', () => {
    render(<ToggleGroup name="Pick" options={options} value="a" onChange={vi.fn()} mark="tight" />);
    const group = screen.getByRole('group', { name: 'Pick' });
    expect(group).not.toHaveClass('target-row');
    for (const button of within(group).getAllByRole('button')) expect(button).toHaveClass('target');
  });

  it('is a .target-row when dense: the options meet, so none carries its own floor', () => {
    render(<ToggleGroup name="Facing" options={options} value="a" onChange={vi.fn()} mark="tight" dense />);
    const group = screen.getByRole('group', { name: 'Facing' });
    expect(group).toHaveClass('target-row');
    expect(group.className).toMatch(/noGap/);
    for (const button of within(group).getAllByRole('button')) expect(button).not.toHaveClass('target');
  });

  it.each(['check', 'tight'] as const)('gives each %s option the class once, and none when dense', (mark) => {
    const { unmount } = render(<ToggleGroup name="Pick" options={options} value="a" onChange={vi.fn()} mark={mark} />);
    for (const button of within(screen.getByRole('group', { name: 'Pick' })).getAllByRole('button')) {
      expect(button.className.split(/\s+/).filter((c) => c === 'target')).toHaveLength(1);
    }
    unmount();
    render(<ToggleGroup name="Pick" options={options} value="a" onChange={vi.fn()} mark={mark} dense />);
    for (const button of within(screen.getByRole('group', { name: 'Pick' })).getAllByRole('button')) expect(button).not.toHaveClass('target');
  });
});
