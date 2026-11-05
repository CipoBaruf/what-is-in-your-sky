import { fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { FirstPassDialog } from './FirstPassDialog';

/**
 * v2.14.1 (FR-WIDE-13, V214-31; D-1140): the first-pass dialog as a component — a modal dialog named by its
 * question, the two answers in both languages, focus on the first and back to the opener, `Esc` as `stay here`
 * taken before any page listener, the document behind inert while it is up, and no axe violation.
 */
function open(locale: Locale = 'en') {
  const onGo = vi.fn();
  const onStay = vi.fn();
  const pageKey = vi.fn();
  document.addEventListener('keydown', pageKey);
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const result = render(
    <I18nProvider locale={locale}>
      <FirstPassDialog onGo={onGo} onStay={onStay} />
    </I18nProvider>,
  );
  return { ...result, onGo, onStay, pageKey, opener, done: () => {
      document.removeEventListener('keydown', pageKey);
      opener.remove();
    } };
}

describe('<FirstPassDialog> (FR-WIDE-13)', () => {
  it.each([
    ['en', en],
    ['es', es],
  ] as const)('asks the question with its two answers in %s', (locale, m) => {
    const { done } = open(locale);
    const dialog = screen.getByRole('dialog', { name: m.live.firstPass.question });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual([m.live.firstPass.go, m.live.firstPass.stay]);
    done();
  });

  it('takes focus on [ go and play ], makes the rest inert, and gives both back on close', () => {
    const { unmount, opener, onGo, done } = open();
    expect(document.activeElement).toBe(screen.getByTestId('first-pass-go'));
    expect(opener.closest('[inert]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('first-pass-go'));
    expect(onGo).toHaveBeenCalledTimes(1);
    unmount();
    expect(opener.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    done();
  });

  it('answers Esc as stay here, before the page sees it; other keys do not reach the page either', () => {
    const { onStay, onGo, pageKey, done } = open();
    fireEvent.keyDown(screen.getByTestId('first-pass-go'), { key: 'Escape' });
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onGo).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId('first-pass-go'), { key: 'v' });
    expect(pageKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('first-pass-stay'));
    expect(onStay).toHaveBeenCalledTimes(2);
    done();
  });

  it('has no axe violation', async () => {
    const { done } = open();
    expect(await axe(document.body)).toHaveNoViolations();
    done();
  });
});
