/**
 * R209 (FR-CTRL-15; D-1228, D-1258): the row you pick in both themes — a
 * button or a link, the picked one told by `aria-current` or `aria-pressed`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PickRow } from './PickRow';

const THEMES = ['dark', 'night'] as const;
const css = readFileSync('src/ui/components/primitives/PickRow.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<PickRow> under data-theme=%s', (theme) => {
  it('FR-CTRL-15: a link, the picked one aria-current and the others without it', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <>
        <PickRow picked href="#a">
          ISS
        </PickRow>
        <PickRow picked={false} href="#b">
          Tiangong
        </PickRow>
      </>,
    );
    const picked = screen.getByRole('link', { name: 'ISS' });
    const other = screen.getByRole('link', { name: 'Tiangong' });
    expect(picked).toHaveAttribute('href', '#a');
    expect(picked).toHaveAttribute('aria-current', 'true');
    expect(picked).not.toHaveAttribute('aria-pressed');
    expect(picked.className).toMatch(/picked/);
    expect(other).not.toHaveAttribute('aria-current');
    expect(other.className).not.toMatch(/picked/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FR-CTRL-15: a button with `current` is aria-current and never aria-pressed', () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { rerender } = render(
      <PickRow picked current onPick={vi.fn()}>
        ISS
      </PickRow>,
    );
    const row = screen.getByRole('button', { name: 'ISS' });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(row).not.toHaveAttribute('aria-pressed');
    rerender(
      <PickRow picked={false} current onPick={vi.fn()}>
        ISS
      </PickRow>,
    );
    expect(row).not.toHaveAttribute('aria-current');
  });

  it('FR-CTRL-15: otherwise a button is aria-pressed, and a press picks', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const onPick = vi.fn();
    const { container, rerender } = render(
      <PickRow picked={false} onPick={onPick}>
        Vega
      </PickRow>,
    );
    const row = screen.getByRole('button', { name: 'Vega' });
    expect(row).toHaveAttribute('type', 'button');
    expect(row).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(row);
    expect(onPick).toHaveBeenCalledExactlyOnceWith();
    rerender(
      <PickRow picked onPick={onPick}>
        Vega
      </PickRow>,
    );
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(row).not.toHaveAttribute('aria-current');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<PickRow> in its stylesheet', () => {
  it('FR-CTRL-15: no frame, the raised ground on hover and picked, the 2 px mark at the left', () => {
    expect(css).toMatch(/\.row \{[^}]*border: 0;/);
    expect(css).toMatch(/\.row:is\(:hover, :active\):not\(:disabled\),\s*\.picked \{\s*background: var\(--hover-ground\)/);
    expect(css).toMatch(/\.picked::before \{[^}]*border-inline-start: calc\(2 \* var\(--hairline\)\) solid var\(--mark\)/);
    expect(css).not.toMatch(/\.picked[^{]*\{[^}]*[\s;]color:/);
  });
});
