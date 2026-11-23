/**
 * R215 (FR-LAND-4, FR-OPEN-5 as amended; D-1238): the place dialog sets a place each of three ways — a searched
 * name, the device, a typed pair on `continue` — and closes; `Esc` and `×` leave it with nothing set; it counts
 * `where_shown` as it opens, and the page behind is inert while it is up.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Observer, Place } from '../../../model';
import { appStore } from '../../../state';
import { count } from '../../../state/measure';
import { PlaceDialog, PlaceDialogHost } from './PlaceDialog';
import type { PlaceSearchFn } from './PlacePicker';
import type { GeolocationEnv } from './UseMyLocation';
import { requestPlace } from '../../screens/home/placeRequest';

vi.mock('../../../state/measure', () => ({ count: vi.fn() }));

const CIPOLLETTI: Place = { name: 'Cipolletti', admin1: 'Rio Negro', country: 'Argentina', lat: -38.93392, lon: -67.99032, elevationM: 267, timeZone: 'America/Argentina/Salta' };
const search = vi.fn<PlaceSearchFn>().mockResolvedValue([CIPOLLETTI]);
const geo: GeolocationEnv = {
  geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 40.4168, longitude: -3.7038, altitude: null, accuracy: 20 }, timestamp: 0 } as unknown as GeolocationPosition) } as unknown as Geolocation,
  secure: true,
};
const SALTA: Observer = { lat: -24.79, lon: -65.41, altM: 0, label: 'Salta', source: 'example', timeZone: 'America/Argentina/Salta' };
const initial = appStore.getInitialState();

beforeEach(() => {
  vi.mocked(count).mockClear();
  appStore.setState({ example: SALTA, exampleOutcome: 'pending' });
});

afterEach(() => {
  appStore.setState(initial, true);
});

function open() {
  const onClose = vi.fn();
  const page = document.createElement('main');
  page.append(Object.assign(document.createElement('button'), { textContent: 'change' }));
  document.body.append(page);
  const opener = page.querySelector('button') as HTMLButtonElement;
  opener.focus();
  const view = render(<PlaceDialog onClose={onClose} search={search} geolocation={geo} />);
  return { onClose, page, opener, ...view };
}

describe('<PlaceDialog> (FR-LAND-4, D-1238)', () => {
  it('opens over an inert page with the focus in the group, and counts where_shown for the example', async () => {
    const { page, unmount, opener } = open();
    const dialog = screen.getByRole('dialog', { name: 'Where will you be looking from?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(page).toHaveAttribute('inert');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(count).toHaveBeenCalledWith('where_shown', 'example');
    expect(await axe(dialog)).toHaveNoViolations();
    unmount();
    expect(page).not.toHaveAttribute('inert');
    expect(document.activeElement).toBe(opener);
    page.remove();
  });

  it('a searched name sets the place and closes', async () => {
    const user = userEvent.setup();
    const { onClose, page } = open();
    await user.type(screen.getByRole('combobox', { name: 'Place name' }), 'Cipolletti{Enter}');
    await screen.findByRole('option');
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(appStore.getState().observer).toMatchObject({ source: 'geocode', lat: CIPOLLETTI.lat });
    expect(onClose).toHaveBeenCalled();
    page.remove();
  });

  it('use my location sets the device’s place and closes', async () => {
    const user = userEvent.setup();
    const { onClose, page } = open();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(appStore.getState().observer).toMatchObject({ source: 'device', lat: 40.4168 });
    expect(onClose).toHaveBeenCalled();
    page.remove();
  });

  it('a typed pair is held until continue, then sets the place and closes', async () => {
    const user = userEvent.setup();
    const { onClose, page } = open();
    const go = screen.getByTestId('place-dialog-continue');
    expect(go).toBeDisabled();
    await user.type(screen.getByLabelText('Coordinates · e.g. -38.93, -67.99'), '-38.9, -67.99');
    expect(appStore.getState().observer).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(go);
    expect(appStore.getState().observer).toMatchObject({ source: 'coords', lat: -38.9, lon: -67.99 });
    expect(onClose).toHaveBeenCalled();
    page.remove();
  });

  it('Esc and × leave it with nothing set', () => {
    const { onClose, page } = open();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Place name' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('place-dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(appStore.getState().observer).toBeNull();
    page.remove();
  });
});

describe('requestPlace() (D-1238)', () => {
  it('opens the host’s dialog, and × closes it', async () => {
    const user = userEvent.setup();
    render(<PlaceDialogHost />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      requestPlace();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('place-dialog-close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
