/**
 * TASKS R9 (US-1, FR-LOC-1 (a), FR-LOC-2, FR-LOC-3, FR-LOC-6): typing is
 * debounced 500 ms into one search; the pick list shows name and region and
 * is keyboard-navigable; picking sets a `geocode` observer with the label
 * and the result's zone and shows the "Using the centre of" line; no match
 * and a failed search both point at the coordinates input and leave the
 * field usable.
 *
 * The timing tests fake `setTimeout` and drive the input with `fireEvent`:
 * testing-library's async wrapper waits on a real timer, so user-event
 * cannot run under fake timers here. The interaction tests use user-event
 * with real timers and press Enter, which searches at once.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Observer, Place } from '../../../model';
import { DEBOUNCE_MS, PlacePicker, type PlaceSearchFn } from './PlacePicker';

const CIPOLLETTI: Place = { name: 'Cipolletti', admin1: 'Rio Negro', country: 'Argentina', lat: -38.93392, lon: -67.99032, elevationM: 267, timeZone: 'America/Argentina/Salta' };
const ROSARIO_AR: Place = { name: 'Rosario', admin1: 'Santa Fe', country: 'Argentina', lat: -32.94682, lon: -60.63932, elevationM: 38, timeZone: 'America/Argentina/Cordoba' };
const ROSARIO_PH: Place = { name: 'Rosario', admin1: 'Calabarzon', country: 'Philippines', lat: 13.6323, lon: 121.2207, elevationM: 13, timeZone: 'Asia/Manila' };
const SINGAPORE: Place = { name: 'Singapore', country: 'Singapore', lat: 1.28967, lon: 103.85007, elevationM: 23, timeZone: 'Asia/Singapore' };

const CIPOLLETTI_OBSERVER: Observer = { lat: -38.93392, lon: -67.99032, altM: 267, label: 'Cipolletti, Rio Negro, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };

function picker(search: PlaceSearchFn, onObserver: (o: Observer) => void, observer: Observer | null = null) {
  return (
    <>
      <PlacePicker search={search} onObserver={onObserver} observer={observer} coordsInputId="coords" />
      <input id="coords" aria-label="Coordinates (lat, lon)" />
    </>
  );
}

function setup(search: PlaceSearchFn, observer: Observer | null = null) {
  const onObserver = vi.fn();
  const view = render(picker(search, onObserver, observer));
  return { onObserver, ...view, input: screen.getByRole('combobox', { name: 'Place name' }) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('<PlacePicker> debounce (FR-LOC-2)', () => {
  const type = (input: HTMLElement, value: string): void => {
    fireEvent.change(input, { target: { value } });
  };
  /** Advances the faked clock inside `act` so state set from the timer callback is flushed before the next assertion. */
  const advance = (ms: number): Promise<void> =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it('typing "Ros", "Rosa", "Rosar" within 400 ms results in one search, 500 ms after the last keystroke', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([ROSARIO_AR, ROSARIO_PH]);
    const { input } = setup(search);
    type(input, 'Ros');
    await advance(200);
    type(input, 'Rosa');
    await advance(200);
    type(input, 'Rosar');
    expect(search).not.toHaveBeenCalled();
    await advance(DEBOUNCE_MS - 1);
    expect(search).not.toHaveBeenCalled();
    await advance(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('Rosar', { signal: expect.any(AbortSignal) as AbortSignal });
    expect(DEBOUNCE_MS).toBeGreaterThanOrEqual(500);
    await advance(0);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Rosario');
    expect(options[0]).toHaveTextContent('Santa Fe, Argentina');
    expect(options[1]).toHaveTextContent('Calabarzon, Philippines');
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not search for one character or blanks', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([ROSARIO_AR]);
    const { input } = setup(search);
    type(input, 'R');
    await advance(DEBOUNCE_MS + 10);
    type(input, '  ');
    await advance(DEBOUNCE_MS + 10);
    expect(search).not.toHaveBeenCalled();
    type(input, 'Ro');
    await advance(DEBOUNCE_MS);
    expect(search).toHaveBeenCalledWith('Ro', expect.anything());
  });

  it('drops a late answer for text the user has since changed and aborts the superseded search', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let resolveFirst: ((places: Place[]) => void) | null = null;
    const signals: AbortSignal[] = [];
    const search = vi.fn<PlaceSearchFn>((_q, { signal }) => {
      signals.push(signal);
      return signals.length === 1 ? new Promise<Place[]>((r) => (resolveFirst = r)) : Promise.resolve([SINGAPORE]);
    });
    const { input } = setup(search);
    type(input, 'Rosario');
    await advance(DEBOUNCE_MS);
    expect(screen.getByRole('status')).toHaveTextContent('Searching for “Rosario”…');
    type(input, 'Singapore');
    expect(signals[0]?.aborted).toBe(true);
    await advance(DEBOUNCE_MS);
    (resolveFirst as unknown as (places: Place[]) => void)([ROSARIO_AR, ROSARIO_PH]);
    await advance(0);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Singapore');
  });
});

describe('<PlacePicker>', () => {
  it('Enter searches at once; selecting a result by click sets a geocode observer with label "name, admin1, country" and the returned zone, and shows the confirmation', async () => {
    const user = userEvent.setup();
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([CIPOLLETTI]);
    const { input, onObserver, rerender } = setup(search);
    await user.type(input, 'Cipolletti{Enter}');
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('Cipolletti', { signal: expect.any(AbortSignal) as AbortSignal });
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Cipolletti');
    expect(options[0]).toHaveTextContent('Rio Negro, Argentina');
    await user.click(options[0] as HTMLElement);
    expect(onObserver).toHaveBeenCalledTimes(1);
    expect(onObserver).toHaveBeenCalledWith(CIPOLLETTI_OBSERVER);
    expect(screen.queryByRole('option')).toBeNull();
    expect(input).toHaveValue('Cipolletti, Rio Negro, Argentina');
    expect(input).toHaveFocus();
    // The app writes the observer to the store; the picker shows the confirmation for it (US-1 AC2/AC4, FR-LOC-6).
    rerender(picker(search, onObserver, CIPOLLETTI_OBSERVER));
    expect(screen.getByTestId('place-confirmation')).toHaveTextContent('Using the centre of Cipolletti, Rio Negro, Argentina (−38.93, −67.99).');
    expect(input).toHaveAccessibleDescription('Using the centre of Cipolletti, Rio Negro, Argentina (−38.93, −67.99).');
  });

  it('walks the list with the arrow keys and picks with Enter; Escape closes it', async () => {
    const user = userEvent.setup();
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([ROSARIO_AR, ROSARIO_PH, SINGAPORE]);
    const { input, onObserver } = setup(search);
    await user.type(input, 'Rosario{Enter}');
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false']);
    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    await user.keyboard('{ArrowUp}{ArrowUp}'); // wraps to the last
    expect(options[2]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option')).toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onObserver).not.toHaveBeenCalled();
    // Enter with the list closed searches again (the app answers from its cache); pick the Philippines row.
    await user.keyboard('{Enter}');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onObserver).toHaveBeenCalledWith(expect.objectContaining({ label: 'Rosario, Calabarzon, Philippines', timeZone: 'Asia/Manila', source: 'geocode' }));
  });

  it('Enter with the list open and nothing highlighted picks the first result', async () => {
    const user = userEvent.setup();
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([CIPOLLETTI, ROSARIO_AR]);
    const { input, onObserver } = setup(search);
    await user.type(input, 'Cipo{Enter}');
    await screen.findAllByRole('option');
    await user.keyboard('{Enter}');
    expect(onObserver).toHaveBeenCalledWith(CIPOLLETTI_OBSERVER);
  });

  it('shows a row without a region when the provider gave none', async () => {
    const user = userEvent.setup();
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([SINGAPORE]);
    const { input } = setup(search);
    await user.type(input, 'Singapore{Enter}');
    const [option] = await screen.findAllByRole('option');
    expect(option).toHaveTextContent(/^Singapore\s*Singapore$/);
  });

  it('zero results show the message with a link to the coordinates input (US-1 AC3)', async () => {
    const user = userEvent.setup();
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([]);
    const { input, onObserver } = setup(search);
    await user.type(input, 'Zzzzqqqq{Enter}');
    const status = screen.getByRole('status');
    await within(status).findByRole('link');
    expect(status).toHaveTextContent('No place matches “Zzzzqqqq”. Try another spelling, or enter coordinates instead.');
    const link = within(status).getByRole('link', { name: 'enter coordinates instead' });
    expect(link).toHaveAttribute('href', '#coords');
    await user.click(link);
    expect(screen.getByLabelText('Coordinates (lat, lon)')).toHaveFocus();
    expect(onObserver).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('a network error shows an alert with the coordinates link and leaves the field usable', async () => {
    const user = userEvent.setup();
    const search = vi.fn<PlaceSearchFn>().mockRejectedValueOnce(new Error('Open-Meteo geocoding: HTTP 503')).mockResolvedValueOnce([CIPOLLETTI]);
    const { input, onObserver } = setup(search);
    await user.type(input, 'Cipolletti{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not search for places (Open-Meteo geocoding: HTTP 503). Try again, or enter coordinates instead.');
    expect(within(alert).getByRole('link')).toHaveAttribute('href', '#coords');
    expect(input).not.toBeDisabled();
    expect(input).toHaveValue('Cipolletti');
    expect(input).toHaveFocus();
    await user.type(input, ' rio negro{Enter}');
    expect(await screen.findAllByRole('option')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    await user.keyboard('{Enter}');
    expect(onObserver).toHaveBeenCalledWith(CIPOLLETTI_OBSERVER);
  });

  /**
   * R27 (FR-OFF-8). `navigator.onLine` is read through `useOnline`, so the
   * tests move it and fire the event the hook subscribes to, exactly as the
   * browser does.
   */
  describe('with no connection', () => {
    const setOnline = (value: boolean): void => {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
      act(() => {
        window.dispatchEvent(new Event(value ? 'online' : 'offline'));
      });
    };

    afterEach(() => {
      setOnline(true);
    });

    it('says it is offline instead of searching, and never asks the provider', async () => {
      const user = userEvent.setup();
      const search = vi.fn<PlaceSearchFn>().mockResolvedValue([CIPOLLETTI]);
      const { input } = setup(search);
      setOnline(false);
      await user.type(input, 'Cipolletti{Enter}');
      expect(search).not.toHaveBeenCalled();
      const status = screen.getByTestId('place-search-status');
      expect(status).toHaveTextContent('No connection, so places cannot be searched. The device location button still works, or enter coordinates instead.');
      expect(within(status).getByRole('link')).toHaveAttribute('href', '#coords');
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('option')).toBeNull();
      expect(input).not.toBeDisabled(); // the field stays usable; it is the provider that is gone
    });

    it('says nothing while the field is empty or too short to be a query', async () => {
      const user = userEvent.setup();
      const { input } = setup(vi.fn<PlaceSearchFn>().mockResolvedValue([]));
      setOnline(false);
      expect(screen.getByTestId('place-search-status')).toBeEmptyDOMElement();
      await user.type(input, 'C');
      expect(screen.getByTestId('place-search-status')).toBeEmptyDOMElement();
    });

    it('the message goes when the connection returns, and the next Enter searches', async () => {
      const user = userEvent.setup();
      const search = vi.fn<PlaceSearchFn>().mockResolvedValue([CIPOLLETTI]);
      const { input } = setup(search);
      setOnline(false);
      await user.type(input, 'Cipolletti{Enter}');
      expect(screen.getByTestId('place-search-status')).toHaveTextContent('No connection');
      setOnline(true);
      expect(screen.getByTestId('place-search-status')).toBeEmptyDOMElement();
      await user.type(input, '{Enter}');
      expect(await screen.findAllByRole('option')).toHaveLength(1);
      expect(search).toHaveBeenCalledTimes(1);
    });
  });

  it('shows no confirmation for a coordinates observer and has no axe violations with the list open', async () => {
    const user = userEvent.setup();
    const search = vi.fn<PlaceSearchFn>().mockResolvedValue([ROSARIO_AR, SINGAPORE]);
    const coords: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
    const { container, input } = setup(search, coords);
    expect(screen.queryByTestId('place-confirmation')).toBeNull();
    expect(input).not.toHaveAttribute('aria-describedby');
    await user.type(input, 'Rosario{Enter}');
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
  });
});
