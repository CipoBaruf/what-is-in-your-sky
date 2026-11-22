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
  it('FR-DS-12: the label column, the row’s height and the gap between rows are the rhythm’s tokens', () => {
    expect(css).toMatch(/\.row \{[^}]*grid-template-columns: var\(--label-col\)/);
    expect(css).toMatch(/\.row \{[^}]*min-height: var\(--control-h\)/);
    expect(css).toMatch(/\.row \+ \.row \{\s*margin-top: var\(--gap-row\)/);
    expect(css).toMatch(/\.label \{\s*color: var\(--fg-dim\)/);
  });
});
