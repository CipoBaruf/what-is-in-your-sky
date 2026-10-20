/**
 * R105 (FR-DS-4 item 6): the line in both themes — the marker before the
 * sentence and the actions after it, the tone and the ink as classes the
 * stylesheet reads, the dot as text so the line reads the same to a test and
 * a reader, the two `rows` forms and the banner's `box`; the role and the
 * data attributes a host passes land on the line itself.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { Line } from './Line';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Line> under data-theme=%s', (theme) => {
  it('is a paragraph of the sentence in the page’s ink by default, a dim status with no marker', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(<Line data-testid="line">Ready offline until 2026-09-21 21:14.</Line>);
    const line = screen.getByTestId('line');
    expect(line.tagName).toBe('P');
    expect(line).toHaveTextContent(/^Ready offline until 2026-09-21 21:14\.$/);
    expect(line.className).toMatch(/_line_/);
    expect(line.className).toMatch(/status/);
    expect(line.className).not.toMatch(/dim|toned|small|box|rows/);
    expect(line.querySelector('[class*="marker"]')).toBeNull();
    expect(line.querySelector('[class*="actions"]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('puts the marker first and the actions last, the dot as text between the sentence and the actions', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <>
        <Line role="alert" tone="notice" box marker="[Warning]" data-testid="banner">
          CelesTrak could not be reached.
        </Line>
        <Line tone="notice" ink="tone" size="small" dot actions={<button type="button">details</button>} data-testid="elements">
          Elements 9 d 4 h old
        </Line>
        <Line ink="dim" size="small" actions={<button type="button">×</button>} data-testid="note">
          The link could not be read.
        </Line>
      </>,
    );
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('[Warning] CelesTrak could not be reached.');
    expect(banner.firstElementChild?.className).toMatch(/marker/);
    expect(banner.className).toMatch(/notice/);
    expect(banner.className).toMatch(/box/);

    const elements = screen.getByTestId('elements');
    expect(elements).toHaveTextContent('Elements 9 d 4 h old · details');
    expect(elements.className).toMatch(/toned/);
    expect(elements.className).toMatch(/small/);
    expect(elements.lastElementChild?.className).toMatch(/actions/);
    expect(elements.lastElementChild).toContainElement(screen.getByRole('button', { name: 'details' }));
    const dot = elements.querySelector('[aria-hidden="true"]');
    expect(dot?.textContent).toBe(' · ');

    const note = screen.getByTestId('note');
    expect(note.className).toMatch(/dim/);
    expect(note.textContent).toBe('The link could not be read. ×');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a grid of two rows with `rows`, a div where asked, and the sentence’s tone is a class', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <>
        <Line as="div" role="status" size="small" rows="text" actions={<button type="button">back to my place</button>} data-testid="visit" data-form="rows">
          <span data-testid="visit-sentence">Showing 48.86, 2.35 from a link</span>
        </Line>
        <Line tone="failure" rows="controls" actions={<button type="button">retry</button>} data-testid="failure">
          Could not load the orbital elements.
        </Line>
        <Line tone="ok" data-testid="ok">
          Stored.
        </Line>
      </>,
    );
    const visit = screen.getByRole('status');
    expect(visit.tagName).toBe('DIV');
    expect(visit).toHaveAttribute('data-form', 'rows');
    expect(visit.className).toMatch(/rowsText/);
    expect(screen.getByTestId('visit-sentence')).toHaveTextContent('Showing 48.86, 2.35 from a link');
    expect(visit.textContent).toBe('Showing 48.86, 2.35 from a link back to my place');

    const failure = screen.getByTestId('failure');
    expect(failure.className).toMatch(/failure/);
    expect(failure.className).toMatch(/rowsControls/);
    expect(failure.lastElementChild).toContainElement(screen.getByRole('button', { name: 'retry' }));
    expect(screen.getByTestId('ok').className).toMatch(/_ok_/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
