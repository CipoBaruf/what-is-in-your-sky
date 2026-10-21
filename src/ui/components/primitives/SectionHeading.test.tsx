/**
 * R105 (FR-DS-4 item 5): the `── Title ─────` heading in both themes — an h2
 * named by its title alone (the rules are the stylesheet's content), an h3
 * where the outline asks (FR-A11Y-2), and the two home tones as classes.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { SectionHeading } from './SectionHeading';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<SectionHeading> under data-theme=%s', (theme) => {
  it('is an h2 named by its title alone, an h3 at level 3, and carries its tone as a class', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <>
        <section aria-labelledby="where">
          <SectionHeading id="where">Where</SectionHeading>
        </section>
        <section aria-labelledby="when">
          <SectionHeading id="when" tone="active">
            When
          </SectionHeading>
        </section>
        <section aria-labelledby="what">
          <SectionHeading id="what" tone="muted" level={3}>
            What
          </SectionHeading>
        </section>
        <section aria-labelledby="passes">
          <SectionHeading id="passes" visuallyHidden>
            Passes
          </SectionHeading>
        </section>
      </>,
    );
    // R107 (D-725): the hidden form is the same heading in the outline, clipped by `VisuallyHidden` and drawn by nothing.
    const passes = screen.getByRole('heading', { level: 2, name: 'Passes' });
    expect(passes).toHaveAttribute('id', 'passes');
    expect(passes).toHaveAttribute('data-visually-hidden', '');
    expect(passes.className).not.toMatch(/heading/);
    expect(passes.textContent).toBe('Passes');
    expect(screen.getByRole('region', { name: 'Passes' })).toContainElement(passes);
    const where = screen.getByRole('heading', { level: 2, name: 'Where' });
    expect(where).toHaveAttribute('id', 'where');
    expect(where.textContent).toBe('Where');
    expect(where.className).toMatch(/heading/);
    expect(where.className).not.toMatch(/active|muted/);
    expect(screen.getByRole('heading', { level: 2, name: 'When' }).className).toMatch(/active/);
    const what = screen.getByRole('heading', { level: 3, name: 'What' });
    expect(what.tagName).toBe('H3');
    expect(what.className).toMatch(/muted/);
    expect(screen.getByRole('region', { name: 'Where' })).toContainElement(where);
    expect(await axe(container)).toHaveNoViolations();
  });
});
