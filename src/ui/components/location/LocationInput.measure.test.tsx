/**
 * FR-MEAS-2 (D-1154): `place_set` is the store's to send. Each of the group's three methods reaches it through
 * `setObserver` and the observer's `source` — a picked name `search`, a typed pair `coords`, the device `device` —
 * and once per load; the components themselves count no `place_set`, so nothing is counted twice.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Count } from '../../../data/measure';
import type { Place } from '../../../model';
import { appStore, useAppStore } from '../../../state';
import { count } from '../../../state/measure';
import { startMeasureEffects } from '../../../state/measureEffects';
import { LocationInput } from './LocationInput';
import type { PlaceSearchFn } from './PlacePicker';
import type { GeolocationEnv } from './UseMyLocation';

vi.mock('../../../state/measure', () => ({ count: vi.fn() }));

const CIPOLLETTI: Place = { name: 'Cipolletti', admin1: 'Rio Negro', country: 'Argentina', lat: -38.93392, lon: -67.99032, elevationM: 267, timeZone: 'America/Argentina/Salta' };
const search = vi.fn<PlaceSearchFn>().mockResolvedValue([CIPOLLETTI]);
const geo: GeolocationEnv = {
  geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 40.4168, longitude: -3.7038, altitude: null, accuracy: 20 }, timestamp: 0 } as unknown as GeolocationPosition) } as unknown as Geolocation,
  secure: true,
};
const initial = appStore.getInitialState();
let sent: string[];
let stop: () => void;

function Wired() {
  const observer = useAppStore((s) => s.observer);
  const setObserver = useAppStore((s) => s.setObserver);
  return <LocationInput observer={observer} onObserver={setObserver} onClear={() => undefined} search={search} geolocation={geo} />;
}

beforeEach(() => {
  sent = [];
  vi.mocked(count).mockClear();
  stop = startMeasureEffects(appStore, ((name: string, detail?: string) => void sent.push(`${name}:${detail ?? ''}`)) as Count);
});

afterEach(() => {
  stop();
  appStore.setState(initial, true);
});

describe('the place group reaches place_set through the store (FR-MEAS-2, D-1154)', () => {
  it('a picked name is place_set:search, and only once it is picked', async () => {
    const user = userEvent.setup();
    render(<Wired />);
    await user.type(screen.getByRole('combobox', { name: 'Place name' }), 'Cipolletti{Enter}');
    await screen.findByRole('option');
    expect(sent).toEqual([]);
    await user.keyboard('{Enter}');
    expect(sent).toEqual(['place_set:search']);
    expect(count).not.toHaveBeenCalled();
  });

  it('a typed pair is place_set:coords at its first valid keystroke, and every later one is the same place set', async () => {
    const user = userEvent.setup();
    render(<Wired />);
    await user.type(screen.getByLabelText('Coordinates · e.g. -38.93, -67.99'), '-38.9');
    expect(sent).toEqual([]);
    await user.type(screen.getByLabelText('Coordinates · e.g. -38.93, -67.99'), ', -67.99');
    expect(sent[0]).toBe('place_set:coords');
    expect(new Set(sent)).toEqual(new Set(['place_set:coords']));
    expect(count).not.toHaveBeenCalled();
  });

  it('the device is place_set:device', async () => {
    const user = userEvent.setup();
    render(<Wired />);
    expect(sent).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(sent).toEqual(['place_set:device']);
    expect(count).not.toHaveBeenCalled();
  });
});
