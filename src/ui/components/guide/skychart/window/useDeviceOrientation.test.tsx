/**
 * R47 (FR-WIN-3, FR-WIN-4, FR-WIN-5): the orientation hook with the API
 * stubbed — the permission path (asked in the tap, never on mount; granted
 * arms, denied is the state; a request in flight from the toggle's tap is
 * awaited), the smoothing (one reading moves the rotation part of the way and
 * the frames keep easing until it has arrived), the rate (one state update per
 * frame however many readings land in it), the settling and relative-only
 * readings, the declination and the screen angle.
 */
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOrientationAccess, requestOrientationAccess } from './orientationAccess';
import { lookDirection } from './projection';
import { useDeviceOrientation } from './useDeviceOrientation';

let renders = 0;

function Harness({ declinationDeg = 0 }: { declinationDeg?: number }) {
  const o = useDeviceOrientation(declinationDeg);
  // Commits, counted after each: the rate test's "one update per frame".
  useEffect(() => {
    renders += 1;
  });
  const look = o.rotation ? lookDirection(o.rotation) : null;
  /** A tenth of a degree, with −0.0 read as 0.0. */
  const fmt = (v: number): string => (Math.round(v * 10) / 10 + 0).toFixed(1);
  return (
    <>
      <output data-testid="state">{o.state}</output>
      <output data-testid="gesture">{String(o.needsGesture)}</output>
      <output data-testid="available">{String(o.available)}</output>
      <output data-testid="look">{look ? `${fmt(look.azDeg)}/${fmt(look.altDeg)}` : 'none'}</output>
      <output data-testid="angle">{String(o.screenAngleDeg)}</output>
      <button type="button" onClick={o.start}>
        start
      </button>
    </>
  );
}

/** A hand-driven `requestAnimationFrame`: `frame()` runs every pending callback once. */
function scriptedFrames() {
  let next = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const id = next++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    pending.delete(id);
  });
  const frame = (): void => {
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => {
      for (const callback of callbacks) callback(16);
    });
  };
  return { frame, pending: () => pending.size };
}

interface Reading {
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  absolute?: boolean | undefined;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

function reading(fields: Reading, name = 'deviceorientation'): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event(name), { alpha: null, beta: null, gamma: null, absolute: false, ...fields }));
  });
}

function withPhone(requestPermission?: () => Promise<'granted' | 'denied'>): void {
  vi.stubGlobal(
    'DeviceOrientationEvent',
    Object.assign(
      function DeviceOrientationEvent() {
        return undefined;
      },
      requestPermission ? { requestPermission } : {},
    ),
  );
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
}

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useDeviceOrientation', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    resetOrientationAccess();
    renders = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'ondeviceorientationabsolute');
    Reflect.deleteProperty(window.screen, 'orientation');
  });

  it('is unavailable with no touch screen or no constructor, and never listens there', () => {
    const { frame } = scriptedFrames();
    render(<Harness />);
    expect(screen.getByTestId('available')).toHaveTextContent('false');
    expect(screen.getByTestId('gesture')).toHaveTextContent('false');
    reading({ alpha: 0, beta: 90, gamma: 0, absolute: true });
    frame();
    expect(screen.getByTestId('look')).toHaveTextContent('none');
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('arms on mount where no request exists (Android): the first reading with a heading turns it on, smoothed, one update per frame', () => {
    const { frame, pending } = scriptedFrames();
    withPhone();
    render(<Harness />);
    expect(screen.getByTestId('gesture')).toHaveTextContent('false');
    expect(screen.getByTestId('state')).toHaveTextContent('idle'); // F-42: armed is not on
    // Three readings in one frame: one state update, from the last of them.
    const before = renders;
    reading({ alpha: 270, beta: 90, gamma: 0, absolute: true });
    reading({ alpha: 275, beta: 90, gamma: 0, absolute: true });
    reading({ alpha: 300, beta: 90, gamma: 0, absolute: true });
    expect(renders).toBe(before);
    expect(pending()).toBe(1);
    frame();
    expect(screen.getByTestId('state')).toHaveTextContent('on');
    // The first reading is taken whole (nothing to smooth from): heading 360 − 300 = 60.
    expect(screen.getByTestId('look')).toHaveTextContent('60.0/0.0');
    const afterFirst = renders;
    expect(afterFirst - before).toBeLessThanOrEqual(2);
    // A turn to the east: the rotation moves part of the way, then keeps easing frame by frame without new readings.
    reading({ alpha: 270, beta: 90, gamma: 0, absolute: true });
    frame();
    const [az1] = (screen.getByTestId('look').textContent ?? '').split('/').map(Number);
    expect(az1).toBeGreaterThan(60);
    expect(az1).toBeLessThan(90);
    expect(pending()).toBe(1); // not converged: the next frame is scheduled
    let az = az1 ?? 0;
    for (let i = 0; i < 30 && pending() > 0; i += 1) {
      frame();
      const [now] = (screen.getByTestId('look').textContent ?? '').split('/').map(Number);
      expect(now).toBeGreaterThanOrEqual(az - 1e-6);
      az = now ?? az;
    }
    expect(az).toBeCloseTo(90, 0);
    expect(pending()).toBe(0); // converged: no frame runs for nothing
  });

  it('applies the declination to the heading and the three angles as one rotation', () => {
    const { frame } = scriptedFrames();
    withPhone();
    render(<Harness declinationDeg={1.1} />);
    // Magnetic heading 90 with +1.1° east declination: true 91.1. Tilted back 30°: 30° up.
    reading({ alpha: 270, beta: 120, gamma: 0, absolute: true });
    frame();
    expect(screen.getByTestId('look')).toHaveTextContent('91.1/30.0');
  });

  it("prefers Chrome's absolute event where the window has it", () => {
    const { frame } = scriptedFrames();
    withPhone();
    (window as Window & { ondeviceorientationabsolute?: unknown }).ondeviceorientationabsolute = null;
    render(<Harness />);
    reading({ alpha: 90, beta: 90, gamma: 0, absolute: true });
    frame();
    expect(screen.getByTestId('look')).toHaveTextContent('none');
    reading({ alpha: 90, beta: 90, gamma: 0, absolute: true }, 'deviceorientationabsolute');
    frame();
    expect(screen.getByTestId('look')).toHaveTextContent('270.0/0.0');
  });

  it('reads a heading-less reading as relative-only (FR-LIVE-8), and an iOS settling compass as waiting', () => {
    const { frame } = scriptedFrames();
    withPhone();
    render(<Harness />);
    reading({ alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: 0, webkitCompassAccuracy: -1 });
    frame();
    expect(screen.getByTestId('state')).toHaveTextContent('waiting');
    expect(screen.getByTestId('look')).toHaveTextContent('none');
    // The compass settles: 360 − 45 as alpha, so the look is 45°.
    reading({ alpha: 12, beta: 90, gamma: 0, webkitCompassHeading: 45, webkitCompassAccuracy: 15 });
    frame();
    expect(screen.getByTestId('state')).toHaveTextContent('on');
    expect(screen.getByTestId('look')).toHaveTextContent('45.0/0.0');
    // No north at all: relative.
    reading({ alpha: 30, beta: 90, gamma: 0, absolute: false });
    frame();
    expect(screen.getByTestId('state')).toHaveTextContent('relative');
  });

  it('needs a gesture where a request exists: start() asks inside the tap; granted arms, denied is the state, and the next tap asks again', async () => {
    const { frame } = scriptedFrames();
    const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValueOnce('denied').mockResolvedValueOnce('granted');
    withPhone(requestPermission);
    render(<Harness />);
    expect(screen.getByTestId('gesture')).toHaveTextContent('true');
    expect(requestPermission).not.toHaveBeenCalled(); // never on mount (FR-WIN-4)
    reading({ alpha: 0, beta: 90, gamma: 0, absolute: true });
    frame();
    expect(screen.getByTestId('look')).toHaveTextContent('none');

    act(() => {
      screen.getByRole('button', { name: 'start' }).click();
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('state')).toHaveTextContent('waiting');
    await flush();
    expect(screen.getByTestId('state')).toHaveTextContent('denied');
    expect(screen.getByTestId('gesture')).toHaveTextContent('true');
    reading({ alpha: 0, beta: 90, gamma: 0, absolute: true });
    frame();
    expect(screen.getByTestId('look')).toHaveTextContent('none');

    act(() => {
      screen.getByRole('button', { name: 'start' }).click();
    });
    expect(requestPermission).toHaveBeenCalledTimes(2);
    await flush();
    expect(screen.getByTestId('gesture')).toHaveTextContent('false');
    reading({ alpha: 0, beta: 90, gamma: 0, absolute: true });
    frame();
    expect(screen.getByTestId('state')).toHaveTextContent('on');
    expect(screen.getByTestId('look')).toHaveTextContent('0.0/0.0');
  });

  it('awaits a request the toggle made before it mounted, and reads a remembered refusal without asking again', async () => {
    const { frame } = scriptedFrames();
    const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValueOnce('granted').mockResolvedValueOnce('denied');
    withPhone(requestPermission);
    // The toggle's tap: the request is in flight when the window mounts.
    const pending = requestOrientationAccess();
    render(<Harness />);
    expect(screen.getByTestId('state')).toHaveTextContent('waiting');
    await pending;
    await flush();
    expect(screen.getByTestId('gesture')).toHaveTextContent('false');
    reading({ alpha: 180, beta: 90, gamma: 0, absolute: true });
    frame();
    expect(screen.getByTestId('state')).toHaveTextContent('on');
    expect(screen.getByTestId('look')).toHaveTextContent('180.0/0.0');
    expect(requestPermission).toHaveBeenCalledTimes(1);

    // A later refusal, remembered: a window mounted after it shows the state and does not prompt.
    resetOrientationAccess();
    await requestOrientationAccess();
    render(<Harness />);
    await flush();
    expect(screen.getAllByTestId('state')[1]).toHaveTextContent('denied');
    expect(requestPermission).toHaveBeenCalledTimes(2);
  });

  it('treats a request that throws (an insecure context) as denied', async () => {
    withPhone(() => Promise.reject(new Error('insecure')));
    render(<Harness />);
    act(() => {
      screen.getByRole('button', { name: 'start' }).click();
    });
    await flush();
    expect(screen.getByTestId('state')).toHaveTextContent('denied');
  });

  it('hands out the screen angle and follows its changes', () => {
    withPhone();
    const listeners = new Map<string, () => void>();
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {
        angle: 90,
        addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
        removeEventListener: (name: string) => listeners.delete(name),
      },
    });
    render(<Harness />);
    expect(screen.getByTestId('angle')).toHaveTextContent('90');
    (window.screen.orientation as { angle: number }).angle = 270;
    act(() => {
      listeners.get('change')?.();
    });
    expect(screen.getByTestId('angle')).toHaveTextContent('270');
  });
});
