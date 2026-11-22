/**
 * R209 (FR-CTRL-17; D-1228): the feedback line in both themes — each tone's
 * role and ink, on `Line`.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusLine } from './StatusLine';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<StatusLine> under data-theme=%s', (theme) => {
  it.each([
    ['progress', 'status', /status.*dim/],
    ['empty', 'status', /status.*dim/],
    ['ok', 'status', /ok.*toned/],
    ['failure', 'alert', /failure.*toned/],
  ] as const)('FR-CTRL-17: %s is one %s line', async (tone, role, look) => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <StatusLine tone={tone} id="feedback" className="placed">
        Finding your location…
      </StatusLine>,
    );
    const line = screen.getByRole(role);
    expect(screen.queryByRole(role === 'alert' ? 'status' : 'alert')).toBeNull();
    expect(line.tagName).toBe('P');
    expect(line).toHaveAttribute('id', 'feedback');
    expect(line).toHaveTextContent(/^Finding your location…$/);
    expect(line.className).toMatch(look);
    expect(line.className).toMatch(/placed/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
