/**
 * R209 (FR-CTRL-12; D-1228, D-1257): the close in both themes — the bare `×`,
 * named in the active language by `I18nProvider` or by the host's `label`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { Close } from './Close';

const THEMES = ['dark', 'night'] as const;
const css = readFileSync('src/ui/components/primitives/Close.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Close> under data-theme=%s', (theme) => {
  it.each([
    ['en', 'Close'],
    ['es', 'Cerrar'],
  ] as const)('FR-CTRL-12: in %s it is a bare × named "%s"', async (locale, name) => {
    document.documentElement.setAttribute('data-theme', theme);
    const onClose = vi.fn();
    const { container } = render(
      <I18nProvider locale={locale}>
        <Close onClose={onClose} />
      </I18nProvider>,
    );
    const button = screen.getByRole('button', { name });
    expect(button).toHaveAccessibleName(name);
    expect(button.textContent).toBe('×');
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledExactlyOnceWith();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('follows a switch of language, and a label outranks the word', () => {
    document.documentElement.setAttribute('data-theme', theme);
    const form = (locale: 'en' | 'es', label?: string) => (
      <I18nProvider locale={locale}>
        <Close onClose={vi.fn()} label={label} />
      </I18nProvider>
    );
    const { rerender } = render(form('en'));
    rerender(form('es'));
    expect(screen.getByRole('button')).toHaveAccessibleName('Cerrar');
    rerender(form('es', 'Cerrar la guía'));
    expect(screen.getByRole('button')).toHaveAccessibleName('Cerrar la guía');
  });
});

describe('<Close> in its stylesheet', () => {
  it('FR-CTRL-12: dim with a --target hit area, and on hover --fg on the raised ground', () => {
    expect(css).toMatch(/\.close \{[^}]*min-width: var\(--target\);\s*min-height: var\(--target\)/);
    expect(css).toMatch(/\.close \{[^}]*color: var\(--fg-dim\)/);
    expect(css).toMatch(/:hover[^{]*\{\s*background: var\(--hover-ground\);\s*color: var\(--fg\)/);
  });
});
