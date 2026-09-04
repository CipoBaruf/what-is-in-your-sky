/**
 * TASKS R20 (FR-THEME-1, US-19): the header's palette switch names both
 * themes in the active language, marks the current one, and puts the choice
 * in the store, which saves it; `applyTheme` is the one place the root
 * element's `data-theme` is written, and it replaces the old value rather
 * than adding to it.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { PREFS_KEY } from '../../../data/localPrefs';
import { I18nProvider } from '../../../i18n/useT';
import { appStore } from '../../../state';
import { applyTheme } from '../../styles/theme';
import { ThemeToggle } from './ThemeToggle';

afterEach(() => {
  appStore.getState().setTheme('dark');
  localStorage.removeItem(PREFS_KEY);
  delete document.documentElement.dataset['theme'];
});

describe('<ThemeToggle>', () => {
  it('marks the current theme, switches on a click, and saves the choice', async () => {
    const { container } = render(
      <I18nProvider locale="en">
        <ThemeToggle />
      </I18nProvider>,
    );
    const group = screen.getByRole('group', { name: 'Theme' });
    expect(within(group).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(within(group).getByRole('button', { name: 'Night' }));
    expect(appStore.getState().theme).toBe('night');
    expect(within(group).getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')).toMatchObject({ theme: 'night' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names both themes in Spanish too (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <ThemeToggle />
      </I18nProvider>,
    );
    const group = screen.getByRole('group', { name: 'Tema' });
    expect(within(group).getByRole('button', { name: 'Oscuro' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Nocturno' })).toBeInTheDocument();
  });
});

describe('applyTheme', () => {
  it('writes the theme to the root element and replaces it on the way back', () => {
    applyTheme('night');
    expect(document.documentElement.dataset['theme']).toBe('night');
    applyTheme('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
