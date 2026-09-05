/**
 * R35 (FR-DESK-4, D-73): the overlay and the table are one thing. Both
 * directions are asserted here — every registered shortcut has a row, and
 * every row is a registered shortcut — so neither an undocumented shortcut
 * nor a documented one that does nothing can survive a run.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { SHORTCUTS } from '../../../lib/shortcuts';
import { ShortcutsOverlay } from './ShortcutsOverlay';

const rows = () => within(screen.getByTestId('shortcuts-overlay')).getAllByRole('row').slice(1); // the header row is not a shortcut

describe('<ShortcutsOverlay> (FR-DESK-4)', () => {
  it('lists every registered shortcut, its key and what it does', () => {
    render(<ShortcutsOverlay onClose={vi.fn()} />);
    const listed = rows().map((row) => {
      const cells = within(row).getAllByRole('cell');
      return { key: cells[0]?.textContent, does: cells[1]?.textContent, id: row.dataset.shortcut };
    });
    expect(listed).toEqual(SHORTCUTS.map((shortcut) => ({ key: shortcut.label, does: en.shortcuts.does[shortcut.id], id: shortcut.id })));
  });

  it('has no row that is not a registered shortcut', () => {
    render(<ShortcutsOverlay onClose={vi.fn()} />);
    const registered = new Set<string>(SHORTCUTS.map((shortcut) => shortcut.id));
    for (const row of rows()) {
      expect(row.dataset.shortcut).toBeDefined();
      expect(registered.has(row.dataset.shortcut ?? '')).toBe(true);
    }
    expect(rows()).toHaveLength(SHORTCUTS.length);
  });

  it('prints the keys untranslated and the descriptions in the reader’s language (FR-I18N-2/4)', () => {
    render(
      <I18nProvider locale="es">
        <ShortcutsOverlay onClose={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { name: es.shortcuts.title })).toBeInTheDocument();
    for (const shortcut of SHORTCUTS) {
      const row = screen.getByTestId('shortcuts-overlay').querySelector(`[data-shortcut="${shortcut.id}"]`);
      expect(row?.textContent).toContain(shortcut.label);
      expect(row?.textContent).toContain(es.shortcuts.does[shortcut.id]);
      expect(row?.textContent).not.toContain(en.shortcuts.does[shortcut.id]);
    }
  });

  it('is a modal dialog that takes focus on open and gives it back on close, and closes from its button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(<ShortcutsOverlay onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(en.shortcuts.title);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.shortcuts.title }));

    await user.click(screen.getByRole('button', { name: en.shortcuts.close }));
    expect(onClose).toHaveBeenCalled();

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('has no axe violations', async () => {
    render(<ShortcutsOverlay onClose={vi.fn()} />);
    expect(await axe(screen.getByTestId('shortcuts-overlay'))).toHaveNoViolations();
  });
});
