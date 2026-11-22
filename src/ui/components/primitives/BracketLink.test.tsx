/**
 * R104 (FR-DS-4 item 2), R206 (FR-CTRL-11): the link in both themes — named by
 * its words, the global `a` (accent, underlined) with nothing of its own round
 * it, and the `current` form a dim `aria-current` span with no href, which is
 * how the header marks the page it stands on (FR-COMP-1).
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { BracketLink } from './BracketLink';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<BracketLink> under data-theme=%s', (theme) => {
  it('FR-CTRL-11: is a link named by its label alone', async () => {
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

describe('<BracketLink> in its stylesheet (R206)', () => {
  it('FR-CTRL-11: leaves the underline and the accent to the global a, and draws no bracket', () => {
    const css = readFileSync('src/ui/components/primitives/BracketLink.module.css', 'utf8');
    expect(css).not.toMatch(/content:|text-decoration:/);
    expect(/\.bracketLink \{([^}]*)\}/.exec(css)?.[1]).not.toMatch(/color/);
    expect(readFileSync('src/ui/styles/global.css', 'utf8')).toMatch(/\na \{\n {2}color: var\(--accent\);\n {2}text-decoration: underline;/);
  });
});
