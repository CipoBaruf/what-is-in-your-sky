/**
 * R104 (FR-DS-4 item 2): `[ label ]` on an `<a>` in both themes — a link named
 * by its words, and the `current` form a dim `aria-current` span with no href,
 * which is how the header marks the page it stands on (FR-COMP-1).
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { BracketLink } from './BracketLink';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<BracketLink> under data-theme=%s', (theme) => {
  it('is a link named by its label alone, the brackets being the stylesheet’s', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <nav aria-label="Pages">
        <BracketLink href="#live" label="live" data-testid="live" />
        <BracketLink href="#settings" label="settings" current data-testid="settings" />
      </nav>,
    );
    const link = screen.getByRole('link', { name: 'live' });
    expect(link).toHaveAttribute('href', '#live');
    expect(link).toHaveTextContent(/^live$/);
    expect(link.className).toMatch(/bracketLink/);
    expect(link.className).not.toMatch(/current/);
    const current = screen.getByTestId('settings');
    expect(current.tagName).toBe('SPAN');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).not.toHaveAttribute('href');
    expect(current.className).toMatch(/bracketLink/);
    expect(current.className).toMatch(/current/);
    expect(screen.queryByRole('link', { name: 'settings' })).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
