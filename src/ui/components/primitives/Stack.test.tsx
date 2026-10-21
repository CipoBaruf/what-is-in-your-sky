/**
 * R107 (FR-DS-4 item 8): the stack in both themes — a div carrying the
 * module's class, the gap's class and the host's placement class, every
 * attribute through, and off the page when `hidden`.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { Stack } from './Stack';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Stack> under data-theme=%s', (theme) => {
  it('is a div with the gap’s class and the host’s placement class, attributes through, hidden when asked', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container, rerender } = render(
      <Stack gap={2} className="placed" data-testid="block" aria-label="A block">
        <p>One.</p>
        <p>Two.</p>
      </Stack>,
    );
    const stack = screen.getByTestId('block');
    expect(stack.tagName).toBe('DIV');
    expect(stack.className).toMatch(/stack/);
    expect(stack.className).toMatch(/gap2/);
    expect(stack.className).toMatch(/placed/);
    expect(stack).toHaveAttribute('aria-label', 'A block');
    expect(stack.children).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
    for (const gap of [1, 3, 4, 5] as const) {
      rerender(
        <Stack gap={gap} data-testid="block">
          <p>One.</p>
        </Stack>,
      );
      expect(screen.getByTestId('block').className).toMatch(new RegExp(`gap${String(gap)}`));
      expect(screen.getByTestId('block').className).not.toMatch(/gap2/);
    }
    rerender(
      <Stack gap={1} id="panel" hidden data-testid="block">
        <p>One.</p>
      </Stack>,
    );
    expect(screen.getByTestId('block')).toHaveAttribute('hidden');
    expect(screen.getByTestId('block')).toHaveAttribute('id', 'panel');
  });
});
