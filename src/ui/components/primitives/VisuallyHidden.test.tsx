/**
 * R107 (FR-DS-4 item 8): the hidden-text block in both themes — the element
 * `as` asks for, named and placed by what passes through, carrying the
 * module's clip class and the marker a test finds it by, and read by
 * assistive technology as the words alone.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { VisuallyHidden } from './VisuallyHidden';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<VisuallyHidden> under data-theme=%s', (theme) => {
  it('is a span by default, the element asked for otherwise, with the clip class, the marker and every attribute through', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <>
        <p>
          Rise <VisuallyHidden>at </VisuallyHidden>09:48
        </p>
        <VisuallyHidden as="h2" id="title" className="placed">
          Passes
        </VisuallyHidden>
        <VisuallyHidden as="p" role="status" aria-live="polite" data-testid="announcer">
          Settings
        </VisuallyHidden>
        <VisuallyHidden as="label" htmlFor="alt">
          Altitude
        </VisuallyHidden>
        <input id="alt" />
      </>,
    );
    const span = screen.getByText('at');
    expect(span.tagName).toBe('SPAN');
    expect(span.className).toMatch(/hidden/);
    expect(span).toHaveAttribute('data-visually-hidden', '');
    const heading = screen.getByRole('heading', { level: 2, name: 'Passes' });
    expect(heading).toHaveAttribute('id', 'title');
    expect(heading.className).toMatch(/hidden/);
    expect(heading.className).toMatch(/placed/);
    const status = screen.getByTestId('announcer');
    expect(status.tagName).toBe('P');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByLabelText('Altitude')).toHaveAttribute('id', 'alt');
    expect(container.querySelector('label')).toHaveAttribute('for', 'alt');
    expect(container.querySelectorAll('[data-visually-hidden]')).toHaveLength(4);
    expect(await axe(container)).toHaveNoViolations();
  });
});
