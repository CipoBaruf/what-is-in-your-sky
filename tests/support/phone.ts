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
