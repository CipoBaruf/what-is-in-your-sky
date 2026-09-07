/**
 * TASKS R12 (US-5 AC2): two pressed-state buttons in a labelled group; a click
 * on the other one reports the new order, a click on the pressed one reports
 * nothing. R52 (US-5 AC2 as amended, FR-COMP-4): the same two orders under two
 * sets of labels, short on compact and long on wide, with one meaning and one
 * group name between them.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { SortToggle } from './SortToggle';

let media: MatchMediaStub | undefined;

afterEach(() => {
  media?.restore();
  media = undefined;
});

describe('<SortToggle>', () => {
  it('marks the current order pressed and reports a change only when the other order is chosen', async () => {
    media = stubMatchMedia(WIDE_PX);
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

  it('names the same two orders short on compact, under the same group name (US-5 AC2 as amended)', () => {
    media = stubMatchMedia(COMPACT_PX);
    render(<SortToggle value="chronological" onChange={vi.fn()} />);
    const group = screen.getByRole('group', { name: 'Sort passes' });
    expect(within(group).getByRole('button', { name: 'Soonest' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Best' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).queryByRole('button', { name: 'Soonest first' })).toBeNull();
  });
});
