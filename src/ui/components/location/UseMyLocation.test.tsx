/**
 * TASKS R10 (US-3, FR-LOC-1 (c)): the button exists only with the API in a
 * secure context (absent in jsdom, which has no `navigator.geolocation`); a
 * position becomes a `device` observer with the accuracy; denial shows the
 * message and leaves the inputs enabled; accuracy text only above 1 km.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { accuracyText, observerFromPosition, UseMyLocation, type GeolocationEnv } from './UseMyLocation';

type Success = (position: { coords: { latitude: number; longitude: number; altitude: number | null; accuracy: number } }) => void;
type Failure = (error: { code: number; message: string }) => void;

function fakeGeolocation(respond: (success: Success, failure: Failure) => void): Geolocation {
  return { getCurrentPosition: vi.fn((s: PositionCallback, f?: PositionErrorCallback | null) => respond(s as unknown as Success, f as unknown as Failure)), watchPosition: vi.fn(), clearWatch: vi.fn() } as unknown as Geolocation;
}

describe('accuracyText (US-3 AC3)', () => {
  it('is null at or below 1 km and rounds above', () => {
    expect(accuracyText(undefined)).toBeNull();
    expect(accuracyText(300)).toBeNull();
    expect(accuracyText(1000)).toBeNull();
    expect(accuracyText(1500)).toBe('about 1.5 km');
    expect(accuracyText(2000)).toBe('about 2 km');
    expect(accuracyText(12_345)).toBe('about 12 km');
  });
});

describe('observerFromPosition', () => {
  it('builds a device observer with rounded altitude and accuracy and the coordinates label', () => {
    expect(observerFromPosition({ latitude: -38.9339, longitude: -67.9903, altitude: 269.6, accuracy: 1999.6 })).toEqual({
      lat: -38.9339,
      lon: -67.9903,
      altM: 270,
      label: '−38.93, −67.99',
      source: 'device',
      timeZone: null,
      accuracyM: 2000,
    });
    expect(observerFromPosition({ latitude: 1, longitude: 2, altitude: null, accuracy: 30 }).altM).toBe(0);
  });
});

describe('<UseMyLocation>', () => {
  it('is absent when navigator.geolocation is undefined (jsdom) and when the context is insecure (US-3 AC1)', () => {
    expect((navigator as { geolocation?: Geolocation }).geolocation).toBeUndefined();
    const { container, rerender } = render(<UseMyLocation onObserver={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    const insecure: GeolocationEnv = { geolocation: fakeGeolocation(() => undefined), secure: false };
    rerender(<UseMyLocation onObserver={vi.fn()} env={insecure} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('a position becomes a device observer carrying the accuracy', async () => {
    const user = userEvent.setup();
    const onObserver = vi.fn();
    const env: GeolocationEnv = { geolocation: fakeGeolocation((success) => success({ coords: { latitude: -38.93, longitude: -67.99, altitude: null, accuracy: 2000 } })), secure: true };
    render(<UseMyLocation onObserver={onObserver} env={env} />);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(env.geolocation?.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(onObserver).toHaveBeenCalledWith({ lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'device', timeZone: null, accuracyM: 2000 });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  });

  it('denial renders the message, leaves the inputs enabled and the button usable again (US-3 AC2)', async () => {
    const user = userEvent.setup();
    const onObserver = vi.fn();
    const env: GeolocationEnv = { geolocation: fakeGeolocation((_s, failure) => failure({ code: 1, message: 'User denied Geolocation' })), secure: true };
    render(
      <>
        <input aria-label="Coordinates (lat, lon)" />
        <UseMyLocation onObserver={onObserver} env={env} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Location permission was denied. You can still enter a place name or coordinates.');
    expect(onObserver).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Coordinates (lat, lon)')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  });

  it('shows the busy state while the device answers', async () => {
    const user = userEvent.setup();
    let answer: Success | null = null;
    const env: GeolocationEnv = { geolocation: fakeGeolocation((success) => (answer = success)), secure: true };
    render(<UseMyLocation onObserver={vi.fn()} env={env} />);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    const busy = screen.getByRole('button', { name: 'Finding your location…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    (answer as unknown as Success)({ coords: { latitude: 1, longitude: 2, altitude: null, accuracy: 10 } });
    expect(await screen.findByRole('button', { name: 'Use my location' })).toBeEnabled();
  });
});
