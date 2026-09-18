/**
 * R81 (FR-FIRST-11, D-511): the Where reading's place and sentence — the place
 * with its coordinates, or the coordinates alone; the sentence by the
 * observer's source; `[ change ]` with `aria-expanded` over the input group.
 * FR-FIRST-6: every fact `LocationSummary`'s tests (R52, R76) pinned is pinned
 * here — the place's own name for a geocoded place, the device's accuracy (US-3
 * AC3) now in the sentence, `[ change ]` opening the group in place and never
 * `#settings` (FR-SET-3), and nothing with no observer.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { appStore } from '../../../state';
import { WherePlace } from './WherePlace';

/** The place as the Where reading hosts it: the open state is the host's, and the group it controls is the host's too. */
function Host() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <WherePlace
        open={open}
        controls="group"
        onToggle={() => {
          setOpen((o) => !o);
        }}
      />
      <div id="group" hidden={!open} data-testid="group" />
    </main>
  );
}

const coords: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const cipolletti: Observer = { lat: -38.9339, lon: -67.9903, altM: 0, label: 'Cipolletti, Río Negro, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const initial = appStore.getInitialState();

const set = (observer: Observer | null): void => {
  act(() => {
    appStore.setState({ observer });
  });
};

afterEach(() => {
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('<WherePlace> (FR-FIRST-11)', () => {
  it('a place picked by name: its own name and its coordinates, then the centre it uses', () => {
    set(cipolletti);
    render(<Host />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(/^Cipolletti \(−38\.93, −67\.99\)$/);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent('Using the centre of Cipolletti. Saved in this browser only. change');
  });

  it('typed coordinates: the coordinates alone, and says so', () => {
    set(coords);
    render(<Host />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(/^−38\.93, −67\.99$/);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Using these coordinates\. Saved in this browser only\./);
  });

  it('the device: the coordinates, and the accuracy in the sentence (US-3 AC3)', () => {
    set({ ...coords, source: 'device', accuracyM: 2987.4 });
    const { rerender } = render(<Host />);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Using your device's location \(±2987 m\)\./);
    set({ ...coords, source: 'device' });
    rerender(<Host />);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Using your device's location\. Saved/);
  });

  it('in Spanish, each sentence', () => {
    set(cipolletti);
    render(
      <I18nProvider locale="es">
        <Host />
      </I18nProvider>,
    );
    expect(screen.getByTestId('where-sentence')).toHaveTextContent('Con el centro de Cipolletti. Guardada solo en este navegador. cambiar');
    set(coords);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Con estas coordenadas\./);
    set({ ...coords, source: 'device', accuracyM: 40 });
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Con la ubicación del dispositivo \(±40 m\)\./);
  });

  it('[ change ] opens the input group in place and closes it again, never #settings (FR-FIRST-2, FR-SET-3)', async () => {
    set(coords);
    const { container } = render(<Host />);
    const change = screen.getByRole('button', { name: 'change' });
    expect(change).toBe(screen.getByTestId('location-summary-change'));
    expect(change).not.toHaveAttribute('href');
    expect(container.querySelector('a[href="#settings"]')).toBeNull();
    expect(change).toHaveAttribute('aria-expanded', 'false');
    const group = screen.getByTestId('group');
    expect(change).toHaveAttribute('aria-controls', group.id);
    expect(group).not.toBeVisible();
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'true');
    expect(group).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'false');
    expect(group).not.toBeVisible();
  });

  it('renders nothing with no observer: the cold open is the Where reading then (FR-FIRST-1)', () => {
    set(null);
    render(<Host />);
    expect(screen.queryByTestId('location-summary')).toBeNull();
    expect(screen.queryByRole('button', { name: 'change' })).toBeNull();
  });
});
