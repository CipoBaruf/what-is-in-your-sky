/** TASKS R13: the bracketed option group; the pressed one is `aria-pressed`, a click on the other option reports it, a click on the pressed one reports nothing. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { OptionToggle } from './OptionToggle';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const;

describe('<OptionToggle>', () => {
  it('marks the current option pressed and reports a change only when another option is chosen', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<OptionToggle name="Pick" prefix="Pick:" options={options} value="a" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Pick' });
    expect(within(group).getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(within(group).getByRole('button', { name: 'Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(within(group).getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    rerender(<OptionToggle name="Pick" prefix="Pick:" options={options} value="b" onChange={onChange} />);
    expect(within(group).getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });
});
