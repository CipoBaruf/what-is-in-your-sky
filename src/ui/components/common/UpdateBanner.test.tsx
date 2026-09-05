import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { appStore, type AppState } from '../../../state';
import { UpdateBanner } from './UpdateBanner';

/**
 * TASKS R28 (FR-OFF-1, OQ-14): a waiting version is offered and never taken.
 * The banner's whole contract is that `applyUpdate` — the function
 * `state/serviceWorker.ts` puts in the store (D-126) — is called on the click
 * and at no other moment, so these tests count calls as much as they read text.
 */
const initial = appStore.getInitialState();
const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};

const show = (locale: 'en' | 'es' = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <UpdateBanner />
    </I18nProvider>,
  );

afterEach(() => {
  appStore.setState(initial, true);
});

describe('UpdateBanner (R28: FR-OFF-1)', () => {
  it('says nothing until a version is waiting', () => {
    show();
    expect(screen.queryByTestId('update-banner')).toBeNull();
    // The flag without the function is the state between two `set` calls, not an offer.
    set({ updateReady: true, applyUpdate: null });
    expect(screen.queryByTestId('update-banner')).toBeNull();
  });

  it('offers the reload once a version is waiting, and applies it only on the click', async () => {
    const apply = vi.fn();
    const user = userEvent.setup();
    const { container } = show();
    act(() => {
      appStore.getState().offerUpdate(apply);
    });
    const banner = screen.getByTestId('update-banner');
    expect(banner).toHaveTextContent('A new version is ready.');
    // Rendering the offer must not take it: `SKIP_WAITING` has one caller and it is the button.
    expect(apply).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Reload now' }));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('is announced politely, so it does not interrupt a reader mid-pass', () => {
    set({ updateReady: true, applyUpdate: () => undefined });
    show();
    expect(screen.getByTestId('update-banner')).toHaveAttribute('role', 'status');
  });

  it('reads in Spanish (FR-I18N-2)', () => {
    set({ updateReady: true, applyUpdate: () => undefined });
    show('es');
    expect(screen.getByTestId('update-banner')).toHaveTextContent('Hay una versión nueva lista.');
    expect(screen.getByRole('button', { name: 'Recargar ahora' })).toBeInTheDocument();
  });
});
