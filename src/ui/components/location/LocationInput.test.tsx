/**
 * TASKS R10 container tests: the active observer as rounded coordinates
 * (accuracy 2 000 m shown, 300 m hidden), the clear action, the precision
 * note, pre-filling from a restored observer, Tab order and `jest-axe`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { Observer } from '../../../model';
import { LocationInput } from './LocationInput';
import type { PlaceSearchFn } from './PlacePicker';
import type { GeolocationEnv } from './UseMyLocation';

const search = vi.fn<PlaceSearchFn>().mockResolvedValue([]);
const geo: GeolocationEnv = { geolocation: { getCurrentPosition: vi.fn(), watchPosition: vi.fn(), clearWatch: vi.fn() } as unknown as Geolocation, secure: true };

const coords: Observer = { lat: -38.93, lon: -67.99, altM: 270, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const device: Observer = { lat: -38.9339, lon: -67.9903, altM: 0, label: '−38.93, −67.99', source: 'device', timeZone: null, accuracyM: 2000 };
const geocoded: Observer = { lat: -38.93392, lon: -67.99032, altM: 267, label: 'Cipolletti, Rio Negro, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };

function setup(observer: Observer | null, over: Partial<{ geolocation: GeolocationEnv }> = { geolocation: geo }) {
  const onObserver = vi.fn();
  const onClear = vi.fn();
  const view = render(<LocationInput observer={observer} onObserver={onObserver} onClear={onClear} search={search} {...over} />);
  return { onObserver, onClear, ...view };
}

describe('<LocationInput>', () => {
  it('without an observer: inputs, the device button and the precision note; no active line, no clear action', () => {
    setup(null);
    expect(screen.getByRole('region', { name: 'Location' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Place name' })).toHaveValue('');
    expect(screen.getByLabelText('Coordinates (lat, lon)')).toHaveValue('');
    expect(screen.getByLabelText('Altitude (m)')).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument();
    expect(screen.getByText(/Precision is city-level/)).toBeInTheDocument();
    expect(screen.queryByTestId('active-location')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear saved location' })).toBeNull();
  });

  it('shows a coordinates observer as rounded coordinates with its altitude, and the clear action', () => {
    setup(coords);
    expect(screen.getByTestId('active-location')).toHaveTextContent('Using −38.93, −67.99 at 270 m.');
    expect(screen.getByRole('button', { name: 'Clear saved location' })).toBeInTheDocument();
    expect(screen.getByText(/Saved in this browser only/)).toBeInTheDocument();
  });

  it('shows a device observer with the accuracy when worse than 1 km, hidden otherwise (US-3 AC3)', () => {
    const { rerender } = setup(device);
    expect(screen.getByTestId('active-location')).toHaveTextContent('Using −38.93, −67.99 from your device (accurate to about 2 km).');
    rerender(<LocationInput observer={{ ...device, accuracyM: 300 }} onObserver={vi.fn()} onClear={vi.fn()} search={search} geolocation={geo} />);
    expect(screen.getByTestId('active-location')).toHaveTextContent('Using −38.93, −67.99 from your device.');
  });

  it('leaves the coordinates line to the picker for a geocoded observer (US-1 AC4 already shows them)', () => {
    setup(geocoded);
    expect(screen.queryByTestId('active-location')).toBeNull();
    expect(screen.getByTestId('place-confirmation')).toHaveTextContent('Using the centre of Cipolletti, Rio Negro, Argentina (−38.93, −67.99).');
    expect(screen.getByRole('combobox', { name: 'Place name' })).toHaveValue('Cipolletti, Rio Negro, Argentina');
    expect(screen.getByRole('button', { name: 'Clear saved location' })).toBeInTheDocument();
  });

  it('pre-fills the coordinate fields from a restored coords observer without emitting (US-8)', () => {
    const { onObserver } = setup(coords);
    expect(screen.getByLabelText('Coordinates (lat, lon)')).toHaveValue('-38.93, -67.99');
    expect(screen.getByLabelText('Altitude (m)')).toHaveValue('270');
    expect(screen.getByRole('combobox', { name: 'Place name' })).toHaveValue('');
    expect(onObserver).not.toHaveBeenCalled();
  });

  it('the clear action calls onClear, empties the fields and moves focus to the place field (US-8 AC2)', async () => {
    const user = userEvent.setup();
    const { onClear, rerender } = setup(coords);
    await user.click(screen.getByRole('button', { name: 'Clear saved location' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    rerender(<LocationInput observer={null} onObserver={vi.fn()} onClear={onClear} search={search} geolocation={geo} />);
    expect(screen.getByLabelText('Coordinates (lat, lon)')).toHaveValue('');
    expect(screen.getByLabelText('Altitude (m)')).toHaveValue('0');
    expect(screen.getByRole('combobox', { name: 'Place name' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear saved location' })).toBeNull();
  });

  it('every control is reachable by Tab in order and the container has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = setup(device);
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Place name' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Coordinates (lat, lon)')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Altitude (m)')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Use my location' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Clear saved location' })).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no device button without the API (jsdom) and still passes axe', async () => {
    const { container } = setup(coords, {});
    expect(screen.queryByRole('button', { name: 'Use my location' })).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
