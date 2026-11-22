/**
 * R209 (FR-CTRL-14; D-1228): the tag in both themes — the bracketed word in
 * each tone, never a control, and its explanation kept as a description.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Tag } from './Tag';

const THEMES = ['dark', 'night'] as const;
const TONES = ['dim', 'accent', 'ok', 'warn', 'danger'] as const;
const css = readFileSync('src/ui/components/primitives/Tag.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Tag> under data-theme=%s', (theme) => {
  it.each(TONES)('FR-CTRL-14: %s is the word in brackets and never a control', async (tone) => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(<Tag tone={tone}>twilight</Tag>);
    const tag = screen.getByText('[twilight]');
    expect(tag.tagName).toBe('SPAN');
    expect(tag.textContent).toBe('[twilight]');
    expect(tag.className).toContain(tone);
    expect(tag).not.toHaveAttribute('role');
    expect(tag).not.toHaveAttribute('tabindex');
    expect(container.querySelector('button, a, input, [role="button"], [role="link"]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FR-CTRL-14: keeps an explanation the host gives it, on focus and as a description', () => {
    document.documentElement.setAttribute('data-theme', theme);
    render(
      <>
        <Tag tone="ok" tabIndex={0} aria-describedby="why" data-testid="cloud">
          clear
        </Tag>
        <p id="why">Under 30 % cloud.</p>
      </>,
    );
    const tag = screen.getByTestId('cloud');
    tag.focus();
    expect(tag).toHaveFocus();
    expect(tag).toHaveAccessibleDescription('Under 30 % cloud.');
  });
});

describe('<Tag> in its stylesheet', () => {
  it('FR-CTRL-14: no underline and no ground under the pointer', () => {
    expect(css).not.toMatch(/:hover|background|cursor|underline/);
  });
});
