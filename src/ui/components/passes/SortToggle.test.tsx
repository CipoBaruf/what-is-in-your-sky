/** TASKS R12 (US-5 AC2): two pressed-state buttons in a labelled group; a click on the other one reports the new order, a click on the pressed one reports nothing. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SortToggle } from './SortToggle';

describe('<SortToggle>', () => {
  it('marks the current order pressed and reports a change only when the other order is chosen', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<SortToggle value="chronological" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Sort passes' });
    expect(within(group).getByRole('button', { name: 'Soonest first' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Best first' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(within(group).getByRole('button', { name: 'Soonest first' }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(within(group).getByRole('button', { name: 'Best first' }));
    expect(onChange).toHaveBeenCalledWith('best');
    rerender(<SortToggle value="best" onChange={onChange} />);
    expect(within(group).getByRole('button', { name: 'Best first' })).toHaveAttribute('aria-pressed', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });
});
