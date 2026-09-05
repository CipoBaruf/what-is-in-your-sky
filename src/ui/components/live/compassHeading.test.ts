/**
 * R34 (FR-LIVE-8): the heading mapping, pure. iOS's `webkitCompassHeading`
 * is the heading; Android's absolute `alpha` is `360 − alpha`; a relative
 * reading has none; the screen's rotation turns the heading into the facing;
 * and the control shows where the constructor exists on a touch screen.
 */
import { describe, expect, it } from 'vitest';
import { deviceHeading, facingFrom, orientationApiPresent, orientationEventName, permissionRequest, quantise, screenAngle } from './compassHeading';

describe('deviceHeading', () => {
  it('takes the WebKit heading as it is, whatever alpha says', () => {
    expect(deviceHeading({ alpha: 123, absolute: false, webkitCompassHeading: 90 })).toBe(90);
    expect(deviceHeading({ alpha: null, absolute: false, webkitCompassHeading: 359.5 })).toBe(359.5);
    expect(deviceHeading({ alpha: 10, absolute: true, webkitCompassHeading: 0 })).toBe(0);
  });

  it('turns an absolute alpha into a clockwise heading', () => {
    expect(deviceHeading({ alpha: 0, absolute: true })).toBe(0);
    expect(deviceHeading({ alpha: 270, absolute: true })).toBe(90); // the device turned left to west… faces east
    expect(deviceHeading({ alpha: 90, absolute: true })).toBe(270);
    expect(deviceHeading({ alpha: 360, absolute: true })).toBe(0);
  });

  it('has no heading for a relative-only reading', () => {
    expect(deviceHeading({ alpha: 45, absolute: false })).toBeNull();
    expect(deviceHeading({ alpha: null, absolute: true })).toBeNull();
    expect(deviceHeading({ alpha: 45, absolute: false, webkitCompassHeading: null })).toBeNull();
    expect(deviceHeading({ alpha: 45, absolute: false, webkitCompassHeading: Number.NaN })).toBeNull();
  });
});

describe('facingFrom / quantise', () => {
  it('turns the heading by the screen angle: sideways, the viewer faces 90° from the top of the phone', () => {
    expect(facingFrom(30, 0)).toBe(30);
    expect(facingFrom(30, 90)).toBe(120);
    expect(facingFrom(30, 270)).toBe(300);
    expect(facingFrom(350, 90)).toBe(80);
  });

  it('rounds to whole degrees inside [0, 360)', () => {
    expect(quantise(12.4)).toBe(12);
    expect(quantise(12.6)).toBe(13);
    expect(quantise(359.7)).toBe(0);
    expect(quantise(-0.2)).toBe(0);
  });
});

describe('the platform probes', () => {
  const win = (over: Record<string, unknown>): Window => ({ navigator: { maxTouchPoints: 0 }, screen: {}, ...over }) as unknown as Window;

  it('reads the screen angle from screen.orientation, then window.orientation, then 0', () => {
    expect(screenAngle(win({ screen: { orientation: { angle: 90 } } }))).toBe(90);
    expect(screenAngle(win({ orientation: -90 }))).toBe(270);
    expect(screenAngle(win({}))).toBe(0);
  });

  it("prefers Chrome's absolute event where the window has it", () => {
    expect(orientationEventName(win({ ondeviceorientationabsolute: null }))).toBe('deviceorientationabsolute');
    expect(orientationEventName(win({}))).toBe('deviceorientation');
  });

  /** A stand-in for the platform's constructor: only its existence and its static `requestPermission` matter here. */
  const ctor = (requestPermission?: (this: unknown) => Promise<'granted' | 'denied'>) =>
    Object.assign(
      function DeviceOrientationEvent() {
        return undefined;
      },
      requestPermission ? { requestPermission } : {},
    );

  it('shows the control only with the constructor on a touch screen (D-175)', () => {
    expect(orientationApiPresent(win({ DeviceOrientationEvent: ctor(), navigator: { maxTouchPoints: 5 } }))).toBe(true);
    expect(orientationApiPresent(win({ DeviceOrientationEvent: ctor(), navigator: { maxTouchPoints: 0 } }))).toBe(false);
    expect(orientationApiPresent(win({ navigator: { maxTouchPoints: 5 } }))).toBe(false);
  });

  it('finds the iOS permission request on the constructor, bound to it, and nothing elsewhere', async () => {
    expect(permissionRequest(win({ DeviceOrientationEvent: ctor() }))).toBeNull();
    const withRequest = ctor(function (this: unknown) {
      return Promise.resolve(this === withRequest ? 'granted' : 'denied');
    });
    const request = permissionRequest(win({ DeviceOrientationEvent: withRequest }));
    expect(request).not.toBeNull();
    await expect(request?.()).resolves.toBe('granted');
  });
});
