/**
 * R151 (FR-GYRO-9; PLAN D-946): the specs bring their own motion permission.
 *
 * `[ follow the phone ]` asks `DeviceOrientationEvent.requestPermission()` inside its tap where the browser defines
 * it (iOS), and a Chromium that implements the request answers it by itself — Chrome for Testing 151 says
 * `'prompt'`, which the app reads as a refusal — so a spec that relied on the browser would shoot a different set
 * on a different Chromium. Every spec or capture that taps the toggle installs this first: an init script that
 * defines `requestPermission` returning `answer`, and, once it has granted, dispatches `readings` one per
 * `intervalMs` on a timer, holding the last one (a phone held still keeps reporting). A refusal dispatches nothing.
 *
 * The readings go to the event the app listens for (`orientationEventName` in `components/live/compassHeading.ts`):
 * Chrome's `deviceorientationabsolute`, with the W3C `alpha` and `absolute: true`, where the window has it; the
 * plain `deviceorientation` elsewhere, as iOS sends it, with `webkitCompassHeading` (the reading's own, or
 * `360 − alpha`) and a compass accuracy of 10°, so it is a reading and not iOS's settling. The timer is the page's
 * `setInterval`, so under `page.clock` the readings arrive as the spec runs the clock. R152: the browser's own
 * (trusted) orientation events are stopped before the app sees them, as `stubCompass` stopped them for the screen.
 */
import type { Page } from '@playwright/test';

/** One reading: the W3C angles, degrees, and iOS's compass heading where the spec wants to name it. */
export interface OrientationReading {
  alpha: number;
  beta: number;
  gamma?: number;
  webkitCompassHeading?: number;
}

export interface OrientationStub {
  /** What `requestPermission()` resolves to. */
  answer: 'granted' | 'denied';
  /** What the phone reports after a grant, in order; the last one repeats. */
  readings: readonly OrientationReading[];
  /** The timer's period; 100 ms is iOS Chrome's ten readings a second (R38). */
  intervalMs?: number;
}

/** The phone's back toward `azDeg`, `altDeg` up, held upright: the W3C alpha and beta for it. */
export const aimedAt = (azDeg: number, altDeg: number): OrientationReading => ({ alpha: (360 - azDeg + 360) % 360, beta: 90 + altDeg, gamma: 0 });

export async function stubOrientation(page: Page, { answer, readings, intervalMs = 100 }: OrientationStub): Promise<void> {
  await page.addInitScript(
    ({ answer, readings, intervalMs }) => {
      const w = window as unknown as Window & { __orientationReadings: OrientationReading[]; __orientationNext: number; __orientationAsks: number; DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } };
      w.__orientationReadings = [...readings];
      w.__orientationNext = 0;
      w.__orientationAsks = 0;
      // Chromium on a desk fires one `deviceorientation` of its own, every angle `null`, when a listener is added
      // — the app would read it as a phone with no north (FR-WIN-4) and leave its note. The browser's own events
      // are trusted and the stub's are not, so a capturing listener ahead of the app's stops the trusted ones
      // (`liveHelpers.ts`'s `stubCompass`, which the retired screen specs used for the same reason).
      for (const name of ['deviceorientationabsolute', 'deviceorientation']) {
        window.addEventListener(
          name,
          (event) => {
            if (event.isTrusted) event.stopImmediatePropagation();
          },
          true,
        );
      }
      const ctor = w.DeviceOrientationEvent;
      if (ctor === undefined) return;
      let timer: number | null = null;
      const dispatch = (): void => {
        const queue = w.__orientationReadings;
        const reading = queue[Math.min(w.__orientationNext, queue.length - 1)];
        w.__orientationNext += 1;
        if (reading === undefined) return;
        const absolute = 'ondeviceorientationabsolute' in window;
        const event = new DeviceOrientationEvent(absolute ? 'deviceorientationabsolute' : 'deviceorientation', { alpha: reading.alpha, beta: reading.beta, gamma: reading.gamma ?? 0, absolute });
        if (!absolute) {
          Object.defineProperty(event, 'webkitCompassHeading', { value: reading.webkitCompassHeading ?? (360 - reading.alpha + 360) % 360 });
          Object.defineProperty(event, 'webkitCompassAccuracy', { value: 10 });
        }
        window.dispatchEvent(event);
      };
      ctor.requestPermission = () => {
        w.__orientationAsks += 1;
        if (answer === 'granted' && timer === null) timer = window.setInterval(dispatch, intervalMs);
        return Promise.resolve(answer);
      };
    },
    { answer, readings: [...readings], intervalMs },
  );
}

/** How many times the page has called `requestPermission()` — the toggle's tap, and nothing else (FR-GYRO-2). */
export const orientationAsks = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __orientationAsks: number }).__orientationAsks);

/** The phone turned: these readings from the next tick on, from the first, the last one held. */
export async function setReadings(page: Page, readings: readonly OrientationReading[]): Promise<void> {
  await page.evaluate((queue) => {
    const w = window as unknown as { __orientationReadings: unknown[]; __orientationNext: number };
    w.__orientationReadings = queue;
    w.__orientationNext = 0;
  }, [...readings]);
}
