/**
 * R160 (FR-PHONE-10; US-46 AC4; PLAN D-970, D-991): the window's side of the
 * pinch across the limit. A pinch whose fingers ask for a field wider than
 * `WINDOW_FOV_MAX_DEG` by more than `PINCH_HANDOFF_RATIO` calls `onFieldHandoff`
 * once, at its release, with the camera at the end it reached; one that stops
 * at the end, or short of the ratio, stays at the end and calls nothing; a
 * cancelled pinch calls nothing; without the prop nothing is called. And the
 * way back: `opening` — the aim under a pinch on the whole sky — opens the hand
 * camera at it at the widest field, once per aim, and ends following where the
 * page was following.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { PINCH_HANDOFF_RATIO } from '../../../../../lib/layout';
import type { Observer } from '../../../../../model';
import { createHandCamera, type HandCamera } from './camera';
import { resetOrientationAccess } from './orientationAccess';
import { WINDOW_FOV, WINDOW_FOV_MAX_DEG } from './projection';
import { SkyWindow, type SkyWindowProps } from './SkyWindow';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };

function scriptedFrames(): () => void {
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
  return (): void => {
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => {
      for (const callback of callbacks) callback(16);
    });
  };
}

const root = (container: HTMLElement): Element => container.querySelector('[data-look-az]') as Element;
const boxOf = (container: HTMLElement): HTMLElement => {
  const box = container.querySelector('[tabindex="0"]') as HTMLElement;
  box.setPointerCapture = vi.fn();
  box.releasePointerCapture = vi.fn();
  return box;
};

function draw(camera: HandCamera, props: Partial<SkyWindowProps> = {}) {
  const onFieldHandoff = vi.fn();
  const view = (more: Partial<SkyWindowProps>) => <SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} onFieldHandoff={onFieldHandoff} {...props} {...more} />;
  const rendered = render(view({}));
  return { ...rendered, onFieldHandoff, rerender: (more: Partial<SkyWindowProps>) => rendered.rerender(view(more)) };
}

/** Two touches `fromPx` apart on the box, closed or opened to `toPx` in `steps`, lifted (or cancelled) at the end. */
function pinch(box: HTMLElement, fromPx: number, toPx: number, { steps = 4, end = 'up' as 'up' | 'cancel', ids = [1, 2] as [number, number] } = {}): void {
  const cy = 100;
  const cx = 200;
  const [a, b] = ids;
  fireEvent.pointerDown(box, { button: 0, pointerId: a, pointerType: 'touch', isPrimary: true, clientX: cx - fromPx / 2, clientY: cy });
  fireEvent.pointerDown(box, { button: 0, pointerId: b, pointerType: 'touch', isPrimary: false, clientX: cx + fromPx / 2, clientY: cy });
  for (let i = 1; i <= steps; i += 1) {
    const d = fromPx + ((toPx - fromPx) * i) / steps;
    fireEvent.pointerMove(box, { pointerId: a, pointerType: 'touch', clientX: cx - d / 2, clientY: cy });
    fireEvent.pointerMove(box, { pointerId: b, pointerType: 'touch', clientX: cx + d / 2, clientY: cy });
  }
  if (end === 'cancel') {
    fireEvent.pointerCancel(box, { pointerId: a, pointerType: 'touch' });
    fireEvent.pointerCancel(box, { pointerId: b, pointerType: 'touch' });
    return;
  }
  fireEvent.pointerUp(box, { pointerId: a, pointerType: 'touch', clientX: cx - toPx / 2, clientY: cy });
  fireEvent.pointerUp(box, { pointerId: b, pointerType: 'touch', clientX: cx + toPx / 2, clientY: cy });
}

describe('<SkyWindow> the pinch across the limit (FR-PHONE-10, D-970)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetOrientationAccess();
  });

  it('hands the view over on the release of a pinch that asks for more than the widest field by the ratio, with the camera at the end', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, onFieldHandoff } = draw(camera);
    const box = boxOf(container);
    // From 60°: fingers closing from 200 px to 100 px ask for 120°, past 90 × 1.15 = 103.5°.
    pinch(box, 200, 100);
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
    expect(onFieldHandoff).toHaveBeenCalledWith();
    // The pending zoom landed before the handoff: the camera is at the end the fingers reached, not a frame behind.
    expect(camera.get()).toMatchObject({ azDeg: 180, altDeg: 35, fovDeg: WINDOW_FOV_MAX_DEG });
    frame();
    expect(camera.get().fovDeg).toBe(WINDOW_FOV_MAX_DEG);
    expect(root(container)).toHaveAttribute('data-fov', String(WINDOW_FOV_MAX_DEG));
  });

  it('stays at the end for a pinch that stops there, or that goes on by less than the ratio; a cancelled pinch hands nothing over', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, onFieldHandoff } = draw(camera);
    const box = boxOf(container);
    // Exactly to 90°: 60 × (150 / 100).
    pinch(box, 150, 100);
    frame();
    expect(camera.get().fovDeg).toBeCloseTo(WINDOW_FOV_MAX_DEG, 9);
    expect(onFieldHandoff).not.toHaveBeenCalled();
    // From 90°, 10 % past it — under the ratio: the end holds.
    pinch(box, 110, 100, { ids: [3, 4] });
    frame();
    expect(camera.get().fovDeg).toBe(WINDOW_FOV_MAX_DEG);
    expect(onFieldHandoff).not.toHaveBeenCalled();
    // Just under the ratio is not past it; just over is, unless the pinch is cancelled.
    pinch(box, 1000 * (PINCH_HANDOFF_RATIO - 0.01), 1000, { ids: [5, 6] });
    expect(onFieldHandoff).not.toHaveBeenCalled();
    pinch(box, 1000 * (PINCH_HANDOFF_RATIO + 0.01), 1000, { ids: [7, 8], end: 'cancel' });
    expect(onFieldHandoff).not.toHaveBeenCalled();
    pinch(box, 1000 * (PINCH_HANDOFF_RATIO + 0.01), 1000, { ids: [9, 10] });
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
  });

  it('counts the whole pinch, so a pinch that widens past the end and comes back under the ratio stays; and the other end hands nothing over', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { onFieldHandoff } = draw(camera);
    const box = boxOf(document.body);
    // 60° → asks 240° on the way out, then back to 90°: the release is at the end, not past it.
    pinch(box, 400, 100, { steps: 2 });
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
    frame();
    onFieldHandoff.mockClear();
    const camera2 = createHandCamera({ azDeg: 180, altDeg: 35 });
    const second = draw(camera2);
    const box2 = boxOf(second.container);
    fireEvent.pointerDown(box2, { button: 0, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 100 });
    fireEvent.pointerDown(box2, { button: 0, pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 400, clientY: 100 });
    fireEvent.pointerMove(box2, { pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box2, { pointerId: 2, pointerType: 'touch', clientX: 267, clientY: 100 });
    fireEvent.pointerUp(box2, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 100 });
    fireEvent.pointerUp(box2, { pointerId: 2, pointerType: 'touch', clientX: 267, clientY: 100 });
    expect(second.onFieldHandoff).not.toHaveBeenCalled();
    // Narrowing past 20° is the other end: the field stops there and nothing is handed over.
    pinch(box2, 100, 1000, { ids: [3, 4] });
    frame();
    expect(camera2.get().fovDeg).toBe(20);
    expect(second.onFieldHandoff).not.toHaveBeenCalled();
  });

  it('does nothing without the prop, and keeps the pinch a zoom', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    pinch(boxOf(container), 200, 100);
    frame();
    expect(camera.get().fovDeg).toBe(WINDOW_FOV_MAX_DEG);
  });

  it('opens the hand camera at `opening` at the widest field, once per aim, and ends following from it (D-991)', () => {
    scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const onFollowEnd = vi.fn();
    const aim = { azDeg: 123.4, altDeg: 56.7 };
    const { container, rerender } = draw(camera, { opening: aim, onFollowEnd });
    expect(camera.get()).toEqual({ azDeg: 123.4, altDeg: 56.7, fovDeg: WINDOW_FOV_MAX_DEG });
    expect(root(container)).toHaveAttribute('data-look-az', '123');
    expect(onFollowEnd).not.toHaveBeenCalled();
    // The reader moves on; a re-render with the same aim (the dome and back would be a remount) opens nothing again.
    act(() => {
      camera.open({ azDeg: 10, altDeg: 20, fovDeg: WINDOW_FOV });
    });
    rerender({ opening: aim, onFollowEnd });
    expect(camera.get()).toEqual({ azDeg: 10, altDeg: 20, fovDeg: WINDOW_FOV });
    // A new aim opens again.
    rerender({ opening: { azDeg: 200, altDeg: 30 }, onFollowEnd });
    expect(camera.get()).toEqual({ azDeg: 200, altDeg: 30, fovDeg: WINDOW_FOV_MAX_DEG });
  });

  it('ends following at the aim where the page was following, and makes the slot’s camera at the aim where there is none', () => {
    scriptedFrames();
    vi.stubGlobal(
      'DeviceOrientationEvent',
      function DeviceOrientationEvent() {
        return undefined;
      },
    );
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const onFollowEnd = vi.fn();
    const { container } = draw(camera, { follow: true, opening: { azDeg: 90, altDeg: 40 }, onFollowEnd });
    expect(onFollowEnd).toHaveBeenCalledTimes(1);
    expect(onFollowEnd).toHaveBeenCalledWith({ azDeg: 90, altDeg: 40, fovDeg: WINDOW_FOV_MAX_DEG });
    expect(camera.get()).toEqual({ azDeg: 90, altDeg: 40, fovDeg: WINDOW_FOV_MAX_DEG });
    expect(root(container)).toHaveAttribute('data-look-az', '90');
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });

    // The chart's slot, empty: the window makes its camera at the aim rather than at the opening facing, and keeps it there.
    let kept: HandCamera | null = null;
    const hand = { get: () => kept, keep: (made: HandCamera) => void (kept = made), gesture: () => undefined };
    const second = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} hand={hand} opening={{ azDeg: 270, altDeg: 10 }} />);
    expect(root(second.container)).toHaveAttribute('data-look-az', '270');
    expect(root(second.container)).toHaveAttribute('data-look-alt', '10');
    expect(root(second.container)).toHaveAttribute('data-fov', String(WINDOW_FOV_MAX_DEG));
    expect(kept).not.toBeNull();
  });
});
