import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { MAX_FAVOURITES, type Favourite, type Observer } from '../../../model';
import { appStore, favouriteCellKey, type AppState } from '../../../state';
import { Favourites } from './Favourites';

/**
 * TASKS R28 (FR-OFF-7, US-17): save the active place, pick one, remove one,
 * and read the limit. The store's own operations are R26's ground and are
 * stubbed here, so what these tests hold is the panel: which control appears
 * when, what it is called, and which cell key it names.
 */
const NOW = 1_789_120_000_000;
const cipolletti: Observer = { lat: -38.93, lon: -67.99, altM: 270, label: 'Cipolletti', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const paris: Observer = { lat: 48.86, lon: 2.35, altM: 35, label: 'Paris', source: 'geocode', timeZone: 'Europe/Paris' };

const saved = (observer: Observer): Favourite => ({ cellKey: favouriteCellKey(observer), observer, addedAt: NOW, lastUsedAt: NOW });

const initial = appStore.getInitialState();
const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};

const show = (locale: 'en' | 'es' = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <Favourites />
    </I18nProvider>,
  );

afterEach(() => {
  appStore.setState(initial, true);
  localStorage.clear();
});

describe('Favourites (R28: FR-OFF-7, US-17)', () => {
  it('says nothing on a first visit: no observer to save and no place saved', () => {
    show();
    expect(screen.queryByTestId('favourites')).toBeNull();
  });

  it('offers the save and states the limit once there is a place to save', async () => {
    const addFavourite = vi.fn();
    set({ observer: cipolletti, addFavourite });
    const { container } = show();
    expect(screen.getByText('Saved places')).toBeInTheDocument();
    expect(screen.getByText('No places saved yet.')).toBeInTheDocument();
    // US-17 AC1: the limit is stated, and so is what reaching it costs (D-85).
    expect(screen.getByText(`Up to ${String(MAX_FAVOURITES)} places. Saving another forgets the one you have not used for longest.`)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.setup().click(screen.getByTestId('save-favourite'));
    // Saved under its own label, which the store takes off the observer (US-17 AC1).
    expect(addFavourite).toHaveBeenCalledWith(cipolletti);
  });

  it('picks a saved place by its label, which is the recompute (US-17 AC2)', async () => {
    const selectFavourite = vi.fn(() => true);
    set({ observer: cipolletti, favourites: [saved(paris), saved(cipolletti)], selectFavourite });
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Use Paris' }));
    expect(selectFavourite).toHaveBeenCalledWith(favouriteCellKey(paris));
  });

  it('marks the entry the app is computing for, and only that one', () => {
    set({ observer: cipolletti, favourites: [saved(paris), saved(cipolletti)] });
    show();
    const [first, second] = screen.getAllByTestId('favourite');
    expect(first).toHaveAttribute('data-current', 'no');
    expect(second).toHaveAttribute('data-current', 'yes');
    expect(within(second as HTMLElement).getByText('(in use)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Cipolletti' })).toHaveAttribute('aria-current', 'true');
    // An observer a few hundred metres away is the same 0.01° cell, so it is the same saved place (D-138).
    set({ observer: { ...cipolletti, lat: cipolletti.lat + 0.001, label: '−38.93, −67.99', source: 'coords' } });
    expect(screen.getAllByTestId('favourite')[1]).toHaveAttribute('data-current', 'yes');
  });

  it('removes in one click, with nothing in front of it (US-17 AC2)', async () => {
    const removeFavourite = vi.fn();
    set({ observer: cipolletti, favourites: [saved(paris)], removeFavourite });
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Paris' }));
    expect(removeFavourite).toHaveBeenCalledWith(favouriteCellKey(paris));
    // No dialog, no confirmation step: the click is the whole of it.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the list after the observer is cleared, so a saved place is the way back', () => {
    set({ observer: null, favourites: [saved(paris)] });
    show();
    expect(screen.getByRole('button', { name: 'Use Paris' })).toBeInTheDocument();
    // Nothing to save when there is no place: the button would have no subject.
    expect(screen.queryByTestId('save-favourite')).toBeNull();
  });

  it('reads in Spanish (FR-I18N-2)', () => {
    set({ observer: cipolletti, favourites: [saved(paris)] });
    show('es');
    expect(screen.getByText('Lugares guardados')).toBeInTheDocument();
    expect(screen.getByTestId('save-favourite')).toHaveTextContent('Guardar este lugar');
    expect(screen.getByRole('button', { name: 'Quitar Paris' })).toBeInTheDocument();
    expect(screen.getByText(/Hasta 8 lugares/)).toBeInTheDocument();
  });
});
