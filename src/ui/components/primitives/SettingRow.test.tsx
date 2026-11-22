/**
 * R209 (FR-DS-12; D-1228): the labelled row in both themes — the label, then
 * the control, on the rhythm's tokens.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingRow } from './SettingRow';
import { TextButton } from './TextButton';

const THEMES = ['dark', 'night'] as const;
const css = readFileSync('src/ui/components/primitives/SettingRow.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<SettingRow> under data-theme=%s', (theme) => {
  it('FR-DS-12: is the label in its column and then the control, which keeps its own name', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <SettingRow label="Theme" data-testid="row">
        <TextButton label="dark" />
      </SettingRow>,
    );
    const row = screen.getByTestId('row');
    expect(row.children).toHaveLength(2);
    expect(row.firstElementChild).toHaveTextContent('Theme');
    expect(row.firstElementChild?.className).toMatch(/label/);
    expect(row.lastElementChild).toContainElement(screen.getByRole('button', { name: 'dark' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<SettingRow> in its stylesheet', () => {
  it('a hidden row is off the page', () => {
    render(
      <SettingRow hidden label="App" data-testid="row">
        <TextButton label="Install" />
      </SettingRow>,
    );
    expect(screen.getByTestId('row')).toHaveAttribute('hidden');
    expect(css).toMatch(/\.row\[hidden\] \{\s*display: none;/);
  });

  it('FR-DS-12: the label column, the row’s height and the gap between rows are the rhythm’s tokens', () => {
    expect(css).toMatch(/\.row \{[^}]*grid-template-columns: var\(--label-col\)/);
    expect(css).toMatch(/\.row \{[^}]*min-height: var\(--control-h\)/);
    const spaced = /([^{}]+)\{\s*margin-top: var\(--gap-row\)/.exec(css)?.[1]?.trim() ?? '';
    // Which of a group's rows take the gap, `-` for a hidden one.
    const gaps = (...rows: string[]): string[] => {
      const group = document.createElement('div');
      for (const name of rows) {
        const row = group.appendChild(document.createElement('div'));
        row.className = 'row';
        row.hidden = name === '-';
        row.textContent = name;
      }
      return [...group.querySelectorAll<HTMLElement>(spaced)].filter((row) => !row.hidden).map((row) => row.textContent ?? '');
    };
    expect(gaps('a', 'b', 'c')).toEqual(['b', 'c']);
    expect(gaps('-', 'b', 'c')).toEqual(['c']);
    expect(gaps('-', '-', 'c')).toEqual([]);
    expect(gaps('a', '-', '-', 'd')).toEqual(['d']);
    expect(css).toMatch(/\.label \{\s*color: var\(--fg-dim\)/);
  });
});
