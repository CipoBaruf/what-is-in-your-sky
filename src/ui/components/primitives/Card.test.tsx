/**
 * R105 (FR-DS-4 item 4): the card in both themes — an article by default, a
 * named section, or one control as a button or a link; `selected` is told in
 * the attributes and not in the colour alone; `frame="accent"` is a class and
 * nothing else changes.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card } from './Card';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Card> under data-theme=%s', (theme) => {
  it('is an article ruled in --rule by default, and a selected one is aria-current', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <>
        <Card aria-label="A pass" data-testid="plain">
          <p>21:14 ISS</p>
        </Card>
        <Card aria-label="The open pass" selected data-testid="selected" className="placed">
          <p>21:52 Tiangong</p>
        </Card>
        <Card aria-label="The first card" frame="accent" data-testid="accent">
          <p>First up</p>
        </Card>
      </>,
    );
    const plain = screen.getByTestId('plain');
    expect(plain.tagName).toBe('ARTICLE');
    expect(plain).toHaveAttribute('data-card', '');
    expect(plain).not.toHaveAttribute('data-selected');
    expect(plain).not.toHaveAttribute('aria-current');
    expect(plain.className).toMatch(/card/);
    expect(plain.className).not.toMatch(/accent|control/);
    expect(plain).toHaveTextContent('21:14 ISS');

    const selected = screen.getByTestId('selected');
    expect(selected).toHaveAttribute('data-selected', 'true');
    expect(selected).toHaveAttribute('aria-current', 'true');
    expect(selected.className).toMatch(/placed/);

    const accent = screen.getByTestId('accent');
    expect(accent.className).toMatch(/accent/);
    expect(accent).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a named section, a button or a link when asked, with the same frame', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const onClick = vi.fn();
    const { container } = render(
      <>
        <Card as="section" aria-label="Next event">
          <p>Next up · in 3:45:07</p>
        </Card>
        <Card as="button" onClick={onClick}>
          Open the pass
        </Card>
        <Card as="a" href="#live">
          Open the live sky
        </Card>
      </>,
    );
    const section = screen.getByRole('region', { name: 'Next event' });
    expect(section.tagName).toBe('SECTION');
    expect(section.className).toMatch(/card/);

    const button = screen.getByRole('button', { name: 'Open the pass' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toMatch(/card/);
    expect(button.className).toMatch(/control/);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    const link = screen.getByRole('link', { name: 'Open the live sky' });
    expect(link).toHaveAttribute('href', '#live');
    expect(link.className).toMatch(/control/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
