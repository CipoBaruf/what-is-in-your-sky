/**
 * R107 (FR-DS-4 item 8): the cluster in both themes — a div, or the paragraph
 * `as` asks for, carrying the module's class, the gap's and the alignment's,
 * the host's placement class and every attribute through.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { Cluster } from './Cluster';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Cluster> under data-theme=%s', (theme) => {
  it('is a div two cells apart on the baseline by default, a paragraph when asked, with the gap, the alignment and the placement as classes', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container, rerender } = render(
      <Cluster className="placed" role="group" aria-label="Playback" data-testid="row">
        <button type="button">[ Play ]</button>
        <button type="button">[ 1× ]</button>
      </Cluster>,
    );
    const row = screen.getByRole('group', { name: 'Playback' });
    expect(row.tagName).toBe('DIV');
    expect(row.className).toMatch(/cluster/);
    expect(row.className).toMatch(/gap2/);
    expect(row.className).not.toMatch(/center/);
    expect(row.className).toMatch(/placed/);
    expect(row.children).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
    rerender(
      <Cluster as="p" gap={1} align="center" data-testid="row">
        <button type="button">[ Share ]</button>
        <span role="status">Link copied</span>
      </Cluster>,
    );
    const paragraph = screen.getByTestId('row');
    expect(paragraph.tagName).toBe('P');
    expect(paragraph.className).toMatch(/gap1/);
    expect(paragraph.className).toMatch(/center/);
    rerender(
      <Cluster gap={3} hidden data-testid="row">
        <a href="#live">[ live ]</a>
      </Cluster>,
    );
    expect(screen.getByTestId('row').className).toMatch(/gap3/);
    expect(screen.getByTestId('row')).toHaveAttribute('hidden');
  });
});
