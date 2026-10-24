/**
 * R113 (FR-STAR-4, FR-STAR-9 as amended, FR-STAR-11; PLAN D-750, D-751): one
 * rotation from either source, published to the render and to the
 * subscribers in the same commit — once per rotation, the current one to a
 * late subscriber, nothing after unsubscribing — and the sensor left unarmed
 * under the hand.
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandCamera, SENSOR_CAMERA, type SkyCamera } from './camera';
import { resetOrientationAccess } from './orientationAccess';
import { lookDirection, uprightRotation, type Mat3 } from './projection';
import { useViewRotation, type ViewRotation } from './useViewRotation';

const FALLBACK = uprightRotation(45, 20);

function withPhone(): void {
  vi.stubGlobal(
    'DeviceOrientationEvent',
    function DeviceOrientationEvent() {
      return undefined;
    },
  );
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
}

function scriptedFrames() {
  const pending: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => pending.push(callback));
  vi.stubGlobal('cancelAnimationFrame', (): void => undefined);
  return (): void => {
    const callbacks = pending.splice(0);
    act(() => {
      for (const callback of callbacks) callback(16);
    });
  };
}

/** Mounts the hook and hands back what it returned on the last render, plus the number of renders. */
function mount(camera: SkyCamera, fallback: Mat3 = FALLBACK) {
  const last: { value: ViewRotation | null; renders: number } = { value: null, renders: 0 };
  function Probe() {
    last.value = useViewRotation(camera, 0, fallback);
    last.renders += 1;
    return <output data-az={Math.round(lookDirection(last.value.rotation).azDeg)} data-alt={Math.round(lookDirection(last.value.rotation).altDeg)} />;
  }
  const utils = render(<Probe />);
  return { ...utils, last, output: () => utils.container.querySelector('output') as HTMLElement };
}

describe('useViewRotation', () => {
  beforeEach(() => {
    resetOrientationAccess();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  it('under the hand the rotation is `uprightRotation` of the camera’s state, and each move is one render and one publish', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { last, output } = mount(camera);
    expect(last.value?.rotation).toEqual(uprightRotation(180, 35));
    expect(output()).toHaveAttribute('data-az', '180');
    expect(output()).toHaveAttribute('data-alt', '35');
    const listener = vi.fn();
    const stop = (last.value as ViewRotation).subscribe(listener);
    // A subscriber is given the current rotation at once.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(uprightRotation(180, 35));
    const renders = last.renders;
    act(() => {
      camera.dragTo(40, 20);
    });
    expect(last.renders).toBe(renders + 1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(uprightRotation(170, 40));
    expect(output()).toHaveAttribute('data-az', '170');
    expect(output()).toHaveAttribute('data-alt', '40');
    act(() => {
      camera.stepYaw(1);
      camera.stepPitch(-1);
    });
    // Two moves in one act are one batched render and so one publish, of the rotation that render drew.
    expect(last.renders).toBe(renders + 2);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith(uprightRotation(185, 35));
    // A move that changes nothing publishes nothing.
    act(() => {
      camera.up();
      camera.up();
    });
    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener).toHaveBeenLastCalledWith(uprightRotation(185, 90));
    stop();
    act(() => {
      camera.face('N');
    });
    expect(listener).toHaveBeenCalledTimes(4);
    expect(last.value?.rotation).toEqual(uprightRotation(0, 90));
  });

  it('the subscribers are told in the commit that draws the rotation, after the DOM is written', () => {
    const camera = createHandCamera({ azDeg: 90, altDeg: 10 });
    const { last, output } = mount(camera);
    const seen: string[] = [];
    (last.value as ViewRotation).subscribe((rotation) => {
      // What the DOM says when the subscriber runs is what this rotation projects: the two never disagree.
      seen.push(`${output().getAttribute('data-az') ?? ''}/${String(Math.round(lookDirection(rotation).azDeg))}`);
    });
    act(() => {
      camera.face('S');
    });
    act(() => {
      camera.face('W');
    });
    expect(seen).toEqual(['90/90', '180/180', '270/270']);
  });

  it('under the sensor the rotation is the fallback until a reading, then the sensor’s, published once per frame', () => {
    withPhone();
    const frame = scriptedFrames();
    const { last } = mount(SENSOR_CAMERA);
    expect(last.value?.rotation).toBe(FALLBACK);
    expect(last.value?.orientation.state).toBe('idle');
    const listener = vi.fn();
    (last.value as ViewRotation).subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(FALLBACK);
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 270, beta: 120, gamma: 0, absolute: true }));
    });
    // The reading is kept; the picture is computed in the frame.
    expect(listener).toHaveBeenCalledTimes(1);
    frame();
    expect(last.value?.orientation.state).toBe('on');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(last.value?.rotation);
    expect(last.value?.rotation).not.toBe(FALLBACK);
    // The first reading lands whole (nothing to smooth from), so the frame after it has nothing to publish.
    frame();
    expect(listener).toHaveBeenCalledTimes(2);
    const first = lookDirection(last.value?.rotation as Mat3);
    expect(first.azDeg).toBeCloseTo(90, 6);
    expect(first.altDeg).toBeCloseTo(30, 6);
    // A second reading is eased toward, one publish per frame, until it has converged — then the frames stop.
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 180, beta: 100, gamma: 0, absolute: true }));
    });
    frame();
    expect(listener).toHaveBeenCalledTimes(3);
    frame();
    expect(listener).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 40; i += 1) frame();
    const settled = listener.mock.calls.length;
    frame();
    expect(listener).toHaveBeenCalledTimes(settled);
    expect(listener).toHaveBeenLastCalledWith(last.value?.rotation);
    const look = lookDirection(last.value?.rotation as Mat3);
    expect(look.azDeg).toBeCloseTo(180, 0);
    expect(look.altDeg).toBeCloseTo(10, 0);
  });

  it('under the hand the sensor is not armed: a reading moves nothing and the handle reads as no device', () => {
    withPhone();
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { last } = mount(camera);
    expect(last.value?.orientation.available).toBe(false);
    const listener = vi.fn();
    (last.value as ViewRotation).subscribe(listener);
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 270, beta: 120, gamma: 0, absolute: true }));
    });
    frame();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(last.value?.orientation.state).toBe('idle');
    expect(last.value?.rotation).toEqual(uprightRotation(180, 35));
  });
});
