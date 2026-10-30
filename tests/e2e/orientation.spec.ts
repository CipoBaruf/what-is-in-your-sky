/**
 * R151 (FR-GYRO-9; PLAN D-946): `stubOrientation` itself, on a blank page, so the specs that tap
 * `[ follow the phone ]` (R152's) stand on a stub that is known to answer as told: it asks nothing on its own,
 * a grant starts the readings on the event the app listens for and holds the last, a refusal sends none, and
 * where the window has no absolute event the readings come as iOS sends them, with the compass heading.
 */
import { expect, test, type Page } from '@playwright/test';
import { aimedAt, orientationAsks, setReadings, stubOrientation } from './orientation';

const BLANK = '/__orientation-stub';

interface Seen {
  type: string;
  alpha: number | null;
  beta: number | null;
  absolute: boolean;
  webkitCompassHeading: number | null;
  webkitCompassAccuracy: number | null;
}

/** A page with nothing in it, served by the route, that records every orientation event it is sent. */
async function blank(page: Page): Promise<void> {
  await page.route(`**${BLANK}`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title>' }));
  await page.addInitScript(() => {
    const w = window as unknown as { __seen: unknown[] };
    w.__seen = [];
    for (const type of ['deviceorientation', 'deviceorientationabsolute']) {
      window.addEventListener(type, (event) => {
        const e = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
        w.__seen.push({ type, alpha: e.alpha, beta: e.beta, absolute: e.absolute, webkitCompassHeading: e.webkitCompassHeading ?? null, webkitCompassAccuracy: e.webkitCompassAccuracy ?? null });
      });
    }
  });
}

const seen = (page: Page): Promise<Seen[]> => page.evaluate(() => (window as unknown as { __seen: Seen[] }).__seen);
const ask = (page: Page): Promise<string> => page.evaluate(() => (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission());

test.describe('stubOrientation (D-946)', () => {
  test('a grant starts the readings on the absolute event, in order, the last one held; nothing before the ask', async ({ page }) => {
    await blank(page);
    await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 10), aimedAt(180, 20)], intervalMs: 20 });
    await page.goto(BLANK);
    await page.waitForTimeout(100);
    expect(await seen(page)).toEqual([]);
    expect(await orientationAsks(page)).toBe(0);

    expect(await ask(page)).toBe('granted');
    expect(await orientationAsks(page)).toBe(1);
    await expect.poll(async () => (await seen(page)).length).toBeGreaterThanOrEqual(4);
    const events = await seen(page);
    expect(new Set(events.map((e) => e.type))).toEqual(new Set(['deviceorientationabsolute']));
    expect(events.slice(0, 3).map((e) => [e.alpha, e.beta, e.absolute])).toEqual([
      [270, 100, true],
      [180, 110, true],
      [180, 110, true],
    ]);

    // The phone turned: the new readings from the next tick.
    await setReadings(page, [aimedAt(0, 45)]);
    await expect.poll(async () => (await seen(page)).at(-1)?.beta).toBe(135);
    expect((await seen(page)).at(-1)?.alpha).toBe(0);
  });

  test('a refusal answers as told and sends nothing', async ({ page }) => {
    await blank(page);
    await stubOrientation(page, { answer: 'denied', readings: [aimedAt(90, 10)], intervalMs: 20 });
    await page.goto(BLANK);
    expect(await ask(page)).toBe('denied');
    await page.waitForTimeout(150);
    expect(await seen(page)).toEqual([]);
  });

  test('without the absolute event the readings come as iOS sends them, with the compass heading', async ({ page }) => {
    await blank(page);
    // A window with no `ondeviceorientationabsolute`: where the app listens to the plain event (`orientationEventName`).
    await page.addInitScript(() => {
      delete (Window.prototype as unknown as Record<string, unknown>)['ondeviceorientationabsolute'];
      delete (window as unknown as Record<string, unknown>)['ondeviceorientationabsolute'];
    });
    await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 10), { alpha: 0, beta: 90, webkitCompassHeading: 45 }], intervalMs: 20 });
    await page.goto(BLANK);
    expect(await page.evaluate(() => 'ondeviceorientationabsolute' in window)).toBe(false);
    expect(await ask(page)).toBe('granted');
    await expect.poll(async () => (await seen(page)).length).toBeGreaterThanOrEqual(2);
    const [first, second] = await seen(page);
    expect(first).toEqual({ type: 'deviceorientation', alpha: 270, beta: 100, absolute: false, webkitCompassHeading: 90, webkitCompassAccuracy: 10 });
    expect(second).toMatchObject({ type: 'deviceorientation', webkitCompassHeading: 45 });
  });
});
