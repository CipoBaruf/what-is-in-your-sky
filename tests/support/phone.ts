import { act } from '@testing-library/react';
import { vi } from 'vitest';

export type PhoneAnswer = 'granted' | 'denied';

/**
 * FR-WIN-4's presence test for a component test: a touch screen with `DeviceOrientationEvent`, and iOS's request
 * where one is given. `undoPhone` takes both back.
 */
export function withPhone(requestPermission?: () => Promise<PhoneAnswer>, touchPoints = 5): void {
  vi.stubGlobal(
    'DeviceOrientationEvent',
    Object.assign(
      function DeviceOrientationEvent() {
        return undefined;
      },
      requestPermission ? { requestPermission } : {},
    ),
  );
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touchPoints });
}

export function undoPhone(): void {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
}

/** R159 (FR-PHONE-1): a reading with a north in it — Android's absolute event, the phone's back toward `azDeg`, `altDeg` up. */
export function northReading(azDeg = 0, altDeg = 30): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: (360 - azDeg) % 360, beta: 90 + altDeg, gamma: 0, absolute: true }));
  });
}

/** A desk Chromium's reading: every angle `null`, no north. */
export function nullReading(): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: null, beta: null, gamma: null, absolute: false }));
  });
}
