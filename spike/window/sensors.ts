/**
 * R38 (FR-WIN-3, FR-WIN-4, OQ-17): the sensor path of the spike, as plain
 * functions with no React. What it records is the answer to OQ-17: every
 * field of every event as the platform gives it, which event name fired, the
 * screen angle at the time, and how often the events come.
 *
 * `compassHeading.ts` in the product reads only the heading; this reads all
 * three angles and keeps the raw events, because the question here is what
 * the phone actually sends.
 */
import { orientationEventName, permissionRequest, screenAngle } from '../../src/ui/components/live/compassHeading';

export interface RawReading {
  /** Wall-clock milliseconds when the event arrived. */
  at: number;
  event: 'deviceorientation' | 'deviceorientationabsolute';
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  webkitCompassHeading: number | null;
  webkitCompassAccuracy: number | null;
  screenAngle: number;
  screenType: string | null;
}

export type PermissionState = 'not-needed' | 'pending' | 'granted' | 'denied' | 'absent';

export interface SensorStats {
  /** Events in the last second. */
  eventsPerSecond: number;
  /** Frames the page drew in the last second. */
  drawsPerSecond: number;
  /** Widest gap between two drawn frames in the last five seconds, ms. */
  longestGapMs: number;
  /** Events received since `start`. */
  events: number;
}

export function readRaw(event: DeviceOrientationEvent, name: RawReading['event']): RawReading {
  const any = event as DeviceOrientationEvent & { webkitCompassHeading?: unknown; webkitCompassAccuracy?: unknown };
  return {
    at: Date.now(),
    event: name,
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    absolute: event.absolute,
    webkitCompassHeading: typeof any.webkitCompassHeading === 'number' ? any.webkitCompassHeading : null,
    webkitCompassAccuracy: typeof any.webkitCompassAccuracy === 'number' ? any.webkitCompassAccuracy : null,
    screenAngle: screenAngle(),
    screenType: window.screen.orientation?.type ?? null,
  };
}

/** iOS 13+ needs the request from a tap; elsewhere the events just come (or never do). */
export async function requestOrientation(): Promise<PermissionState> {
  const request = permissionRequest();
  if (!request) return typeof DeviceOrientationEvent === 'function' ? 'not-needed' : 'absent';
  try {
    const result = await request();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Listens on both event names where both exist, so the page can say which
 * one carried what: Chrome fires `deviceorientationabsolute` with the
 * absolute reading and `deviceorientation` with the relative one; iOS fires
 * `deviceorientation` only.
 */
export function listen(onReading: (reading: RawReading) => void): () => void {
  const names: RawReading['event'][] = orientationEventName() === 'deviceorientationabsolute' ? ['deviceorientationabsolute', 'deviceorientation'] : ['deviceorientation'];
  const handlers = names.map((name) => {
    const handler = (event: Event): void => {
      onReading(readRaw(event as DeviceOrientationEvent, name));
    };
    window.addEventListener(name, handler);
    return { name, handler };
  });
  return () => {
    for (const { name, handler } of handlers) window.removeEventListener(name, handler);
  };
}

/** A rolling counter of events and draws for the rate readout (the D-62 method: what was actually drawn per second). */
export class RateMeter {
  private eventTimes: number[] = [];
  private drawTimes: number[] = [];
  private total = 0;

  event(at = performance.now()): void {
    this.total += 1;
    this.eventTimes.push(at);
    this.trim(this.eventTimes, at, 1000);
  }

  draw(at = performance.now()): void {
    this.drawTimes.push(at);
    this.trim(this.drawTimes, at, 5000);
  }

  stats(now = performance.now()): SensorStats {
    this.trim(this.eventTimes, now, 1000);
    this.trim(this.drawTimes, now, 5000);
    const lastSecond = this.drawTimes.filter((t) => now - t <= 1000).length;
    let gap = 0;
    for (let i = 1; i < this.drawTimes.length; i += 1) gap = Math.max(gap, (this.drawTimes[i] ?? 0) - (this.drawTimes[i - 1] ?? 0));
    return { eventsPerSecond: this.eventTimes.length, drawsPerSecond: lastSecond, longestGapMs: Math.round(gap), events: this.total };
  }

  reset(): void {
    this.eventTimes = [];
    this.drawTimes = [];
    this.total = 0;
  }

  private trim(list: number[], now: number, windowMs: number): void {
    while (list.length > 0 && now - (list[0] ?? 0) > windowMs) list.shift();
  }
}
