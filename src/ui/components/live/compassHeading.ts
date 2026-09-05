import { normalizeAzimuthDeg } from '../../../lib/compass';

/**
 * R34 (FR-LIVE-8, US-10, D-175): the device's compass heading as the dome's
 * facing, pure. What a `DeviceOrientationEvent` carries differs by platform:
 *
 *   - iOS Safari adds `webkitCompassHeading`, degrees clockwise from magnetic
 *     north to the direction the top of the device points; `alpha` there is
 *     relative to where the device was when the page loaded, and `absolute`
 *     is false.
 *   - Android Chrome fires `deviceorientationabsolute` with `absolute: true`
 *     and `alpha` counter-clockwise from north (W3C: alpha 0 is the top of
 *     the device pointing north, and it grows as the device turns *left*), so
 *     the heading is `360 − alpha`.
 *   - Anything else — an `absolute: false` event with no WebKit heading — is
 *     a relative-only device: there is no north in the reading, and the page
 *     says so rather than turning the dome to a direction it made up.
 *
 * The heading is the device's top; what the viewer faces holding it up is that
 * turned by the screen's angle, so a phone held sideways (the FR-LIVE-7
 * layout) faces where the viewer looks and not 90° from it. This module does
 * not read the sensor; `useFollowPhone` does, and hands each reading here.
 */
export interface OrientationReading {
  alpha: number | null;
  absolute: boolean;
  /** iOS only. */
  webkitCompassHeading?: number | null;
}

/** The two fields and the WebKit one, off the event, whatever the platform's type says. */
export function readingFrom(event: DeviceOrientationEvent): OrientationReading {
  const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: unknown }).webkitCompassHeading;
  return { alpha: event.alpha, absolute: event.absolute, webkitCompassHeading: typeof webkit === 'number' ? webkit : null };
}

/** The compass heading of the top of the device, degrees clockwise from north, or `null` for a relative-only reading. */
export function deviceHeading(reading: OrientationReading): number | null {
  const webkit = reading.webkitCompassHeading;
  if (typeof webkit === 'number' && Number.isFinite(webkit)) return normalizeAzimuthDeg(webkit);
  if (reading.absolute && reading.alpha !== null && Number.isFinite(reading.alpha)) return normalizeAzimuthDeg(360 - reading.alpha);
  return null;
}

/** The azimuth the viewer faces: the device's heading turned by the screen's rotation from portrait. */
export function facingFrom(headingDeg: number, screenAngleDeg: number): number {
  return normalizeAzimuthDeg(headingDeg + screenAngleDeg);
}

/** Whole degrees: a sensor jitters by fractions, and a re-rasterisation per fraction is FR-LIVE-5's budget spent on nothing visible. */
export function quantise(facingDeg: number): number {
  const whole = Math.round(normalizeAzimuthDeg(facingDeg));
  return whole === 360 ? 0 : whole;
}

/** The screen's rotation from portrait, from `screen.orientation` or the older `window.orientation`. */
export function screenAngle(win: Window = window): number {
  const angle = win.screen.orientation?.angle;
  if (typeof angle === 'number' && Number.isFinite(angle)) return normalizeAzimuthDeg(angle);
  const legacy = (win as Window & { orientation?: unknown }).orientation;
  return typeof legacy === 'number' && Number.isFinite(legacy) ? normalizeAzimuthDeg(legacy) : 0;
}

/** Chrome's absolute event where it exists; the plain one elsewhere (iOS, which puts the heading on it). */
export function orientationEventName(win: Window = window): 'deviceorientationabsolute' | 'deviceorientation' {
  return 'ondeviceorientationabsolute' in win ? 'deviceorientationabsolute' : 'deviceorientation';
}

/**
 * D-175: whether there is a phone to follow. `DeviceOrientationEvent` alone
 * is not it — desktop Chromium and Firefox define the constructor and never
 * fire it — so the control is shown where the constructor exists *and* the
 * browser reports a touch screen, the cheapest sign that it is on something
 * held in the hand.
 */
export function orientationApiPresent(win: Window = window): boolean {
  return typeof (win as Window & { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent === 'function' && (win.navigator.maxTouchPoints ?? 0) > 0;
}

/** iOS 13+: the permission request, which must be made from a user gesture (FR-LIVE-8). Absent elsewhere. */
export function permissionRequest(win: Window = window): (() => Promise<'granted' | 'denied' | 'default'>) | null {
  const ctor = (win as Window & { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent;
  const request = ctor?.requestPermission;
  return typeof request === 'function' ? (request as () => Promise<'granted' | 'denied' | 'default'>).bind(ctor) : null;
}
