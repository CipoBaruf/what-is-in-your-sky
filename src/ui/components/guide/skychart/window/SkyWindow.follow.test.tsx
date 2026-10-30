/**
 * R151 (FR-GYRO-2, FR-GYRO-4, FR-GYRO-5; US-44 AC2, AC3; PLAN D-941, D-942, D-955, §9.11): the page's own window
 * following the phone. With a stubbed grant and readings: the sensor drives the facing and the tilt from its first
 * reading at the hand's field, nothing is drawn over the drawing but FR-FOL-5's ground notes, the picture turns
 * upright inside the window's own box (FR-FSC-10); a drag past the tap's slop and a box key hand the camera back to
 * the finger from the phone's last pose through `onFollowEnd`, a tap and a pinch do not, and turning following off
 * leaves the camera where the phone last pointed.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { en } from '../../../../../i18n/en';
import { declinationDeg } from '../../../../../lib/declination';
import type { Observer } from '../../../../../model';
import { YAW_STEP_DEG } from '../dome/camera';
import { createHandCamera, type HandCamera } from './camera';
import { resetOrientationAccess } from './orientationAccess';
import * as projection from './projection';
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

/** Frames until the smoothing has settled. */
const settle = (frame: () => void): void => {
  for (let i = 0; i < 40; i += 1) frame();
};

/** A touch screen with the constructor and no request to make (Android): the grant is the toggle's, already given. */
function withPhone(): void {
  vi.stubGlobal(
    'DeviceOrientationEvent',
    function DeviceOrientationEvent() {
      return undefined;
    },
  );
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
}

function reading(fields: { alpha: number; beta: number; gamma?: number }): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 0, absolute: true, ...fields }));
  });
}

/** The back of the phone at this azimuth and altitude, held upright: W3C alpha 360 − azimuth, beta 90 + altitude. */
const aim = (azDeg: number, altDeg: number): { alpha: number; beta: number } => ({ alpha: (360 - azDeg) % 360, beta: 90 + altDeg });

/** The measured box, reported the moment it is observed. */
function stubBox(width: number, height: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve(): void {
        /* nothing to detach */
      }
      disconnect(): void {
        /* nothing to detach */
      }
    },
  );
}

/**
 * R44: the window turns every magnetic reading to true north by the observer's declination, so the phone aimed at
 * magnetic `az` looks at true `az + DECLINATION`; the hand points at true bearings.
 */
const DECLINATION = declinationDeg({ lat: observer.lat, lon: observer.lon, altM: observer.altM }, new Date());
const north = (azDeg: number): number => azDeg + DECLINATION;
/** As the root's `data-look-az` carries it: whole degrees. */
const shown = (azDeg: number): number => Math.round(north(azDeg)) % 360;

const root = (container: HTMLElement): Element => container.querySelector('[data-look-az]') as Element;
const look = (container: HTMLElement): { az: number; alt: number } => ({ az: Number(root(container).getAttribute('data-look-az')), alt: Number(root(container).getAttribute('data-look-alt')) });
const boxOf = (container: HTMLElement): HTMLElement => {
  const box = container.querySelector('[tabindex="0"]') as HTMLElement;
  box.setPointerCapture = vi.fn();
  box.releasePointerCapture = vi.fn();
  return box;
};

function follow(camera: HandCamera, props: Partial<SkyWindowProps> = {}) {
  const onFollowEnd = vi.fn();
  const view = (more: Partial<SkyWindowProps>) => <SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} follow onFollowEnd={onFollowEnd} {...props} {...more} />;
  const rendered = render(view({}));
  return { ...rendered, onFollowEnd, rerender: (more: Partial<SkyWindowProps>) => rendered.rerender(view(more)) };
}

describe('<SkyWindow follow> (FR-GYRO-2, FR-GYRO-4, FR-GYRO-5)', () => {
  beforeEach(() => {
    resetOrientationAccess();
    withPhone();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    resetOrientationAccess();
  });

  it('keeps the hand’s picture until the first reading, then the facing and the tilt are the phone’s, at the hand’s field', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35, fovDeg: 40 });
    const { container } = follow(camera);
    const w = root(container);
    expect(w).toHaveAttribute('data-follow', 'true');
    // Armed, nothing read yet: the hand's facing stands, so turning following on moves nothing.
    expect(look(container)).toEqual({ az: 180, alt: 35 });
    expect(w).toHaveAttribute('data-fov', '40');

    reading(aim(120, 30));
    frame();
    settle(frame);
    expect(w).toHaveAttribute('data-state', 'on');
    expect(look(container)).toEqual({ az: shown(120), alt: 30 });
    // The field is still the hand's, and the hand itself has not moved.
    expect(w).toHaveAttribute('data-fov', '40');
    expect(camera.get()).toMatchObject({ azDeg: 180, altDeg: 35, fovDeg: 40 });

    reading(aim(200, 55));
    frame();
    settle(frame);
    expect(look(container)).toEqual({ az: shown(200), alt: 55 });
  });

  it('draws nothing over the drawing — no readout, no note, no hint — but the ground notes (FR-GYRO-5, FR-FOL-5)', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = follow(camera, { legendKeys: { [pass.id]: 'A' } });
    // Before a reading: no "waiting" note either.
    expect(screen.queryByTestId('window-readout')).toBeNull();
    expect(screen.queryByTestId('window-note')).toBeNull();
    reading(aim(120, 30));
    frame();
    settle(frame);
    expect(screen.queryByTestId('window-readout')).toBeNull();
    expect(screen.queryByTestId('window-heading')).toBeNull();
    expect(screen.queryByTestId('window-chip')).toBeNull();
    expect(screen.queryByTestId('window-turn-advice')).toBeNull();
    expect(screen.queryByTestId('compass-gutter')).toBeNull();
    expect(container.textContent).not.toContain(en.window.hint);
    expect(screen.queryAllByRole('status')).toEqual([]);
    // The box is not described by a readout it does not draw.
    expect(boxOf(container)).not.toHaveAttribute('aria-describedby');

    // Pointed below the horizon: the ground note is the one line over the drawing.
    reading(aim(120, -20));
    frame();
    settle(frame);
    expect(screen.getAllByRole('status')).toEqual([screen.getByTestId('window-ground-note')]);
    expect(screen.getByTestId('window-ground-note')).toHaveTextContent(en.window.ground);
    reading(aim(120, -80));
    frame();
    settle(frame);
    expect(screen.getByTestId('window-ground-note')).toHaveTextContent(en.window.buried);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('turns the picture upright to the reader inside its own box when the pose is a quarter the browser did not report (FR-FSC-10)', () => {
    stubBox(390, 844);
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, rerender } = follow(camera);
    const turn = (): HTMLElement => container.querySelector('[data-turn]') as HTMLElement;
    const svg = (): Element => container.querySelector('[data-drawing="window"]') as Element;
    // Before a reading the browser's angle stands: nothing turns, and the drawing is the box's.
    expect(turn()).toHaveAttribute('data-turn', '0');
    expect(svg()).toHaveAttribute('viewBox', '0 0 390 844');

    // The phone held sideways, its top to the reader's left, on a viewport that stayed upright (a rotation lock).
    reading({ alpha: 0, beta: 0, gamma: -90 });
    frame();
    settle(frame);
    expect(turn()).toHaveAttribute('data-turn', '90');
    expect(turn().style.width).toBe('844px');
    expect(turn().style.height).toBe('390px');
    expect(turn().style.getPropertyValue('--window-turn')).toBe('90deg');
    // The drawing is laid out wide, as the reader sees it, and the notes turn with it.
    expect(svg()).toHaveAttribute('viewBox', '0 0 844 390');
    expect(turn()).toContainElement(svg() as HTMLElement);

    // Back upright, and nothing turns.
    reading(aim(120, 20));
    frame();
    settle(frame);
    expect(turn()).toHaveAttribute('data-turn', '0');
    expect(turn().style.width).toBe('');
    expect(turn().style.getPropertyValue('--window-turn')).toBe('');

    // Off, there is no turn at all: the hand's view is laid out upright on the box.
    rerender({ follow: false });
    expect(turn()).toBeNull();
    expect(svg()).toHaveAttribute('viewBox', '0 0 390 844');
  });

  it('a drag past the tap’s slop hands the camera to the finger from the phone’s last pose, once (FR-GYRO-4, D-942, D-955)', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, onFollowEnd, rerender } = follow(camera);
    reading(aim(120, 30));
    frame();
    settle(frame);
    const box = boxOf(container);

    // A tap's wobble is not a drag: following holds, and nothing moves.
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 105, clientY: 100 });
    frame();
    fireEvent.pointerUp(box, { pointerId: 1, clientX: 105, clientY: 100 });
    expect(onFollowEnd).not.toHaveBeenCalled();
    expect(camera.get()).toMatchObject({ azDeg: 180, altDeg: 35 });

    // A drag: the hand is seeded with the phone's pose and the page told, before anything moves.
    fireEvent.pointerDown(box, { button: 0, pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 106, clientY: 100 });
    expect(onFollowEnd).not.toHaveBeenCalled();
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 140, clientY: 100 });
    expect(onFollowEnd).toHaveBeenCalledTimes(1);
    const pose = onFollowEnd.mock.calls[0]?.[0] as { azDeg: number; altDeg: number; fovDeg: number };
    expect(pose.azDeg).toBeCloseTo(north(120), 1);
    expect(pose.altDeg).toBeCloseTo(30, 1);
    expect(pose.fovDeg).toBe(projection.WINDOW_FOV);
    expect(camera.get().azDeg).toBeCloseTo(north(120), 1);
    // The page turns following off; the picture does not jump, and the drag then moves the hand as it always did.
    rerender({ follow: false });
    expect(root(container)).not.toHaveAttribute('data-follow');
    expect(look(container)).toEqual({ az: shown(120), alt: 30 });
    frame();
    // 40 px right at 4 px a degree: 10° to the left.
    expect(camera.get().azDeg).toBeCloseTo(north(110), 1);
    expect(look(container)).toEqual({ az: shown(110), alt: 30 });
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 180, clientY: 100 });
    frame();
    expect(onFollowEnd).toHaveBeenCalledTimes(1);
    expect(camera.get().azDeg).toBeCloseTo(north(100), 1);
  });

  it('a pinch zooms the hand’s field and keeps following (FR-GYRO-4)', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, onFollowEnd } = follow(camera);
    reading(aim(120, 30));
    frame();
    settle(frame);
    const box = boxOf(container);
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerDown(box, { button: 0, pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 });
    // Apart from 100 px to 200 px: the field halves.
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 300, clientY: 100 });
    frame();
    expect(onFollowEnd).not.toHaveBeenCalled();
    expect(camera.get().fovDeg).toBe(30);
    expect(root(container)).toHaveAttribute('data-fov', '30');
    expect(root(container)).toHaveAttribute('data-follow', 'true');
    // Still the phone's facing, and still following it.
    expect(look(container)).toEqual({ az: shown(120), alt: 30 });
    reading(aim(150, 40));
    frame();
    settle(frame);
    expect(look(container)).toEqual({ az: shown(150), alt: 40 });
  });

  it('a box key ends following as a drag does, then moves the hand from the phone’s pose (FR-GYRO-4)', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, onFollowEnd } = follow(camera);
    reading(aim(120, 30));
    frame();
    settle(frame);
    const box = boxOf(container);
    // A key that is not the box's is nothing.
    fireEvent.keyDown(box, { key: 'x' });
    expect(onFollowEnd).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(onFollowEnd).toHaveBeenCalledTimes(1);
    expect(camera.get().azDeg).toBeCloseTo(north(120) + YAW_STEP_DEG, 1);
    expect(camera.get().altDeg).toBeCloseTo(30, 1);
    // A zoom key is one of FR-SKY-14's too.
    const second = follow(createHandCamera({ azDeg: 180, altDeg: 35 }));
    reading(aim(120, 30));
    frame();
    settle(frame);
    fireEvent.keyDown(boxOf(second.container), { key: '+' });
    expect(second.onFollowEnd).toHaveBeenCalledTimes(1);
  });

  it('turned off by the page, leaves the camera where the phone last pointed (FR-GYRO-2)', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, onFollowEnd, rerender } = follow(camera);
    reading(aim(250, 45));
    frame();
    settle(frame);
    rerender({ follow: false });
    expect(onFollowEnd).not.toHaveBeenCalled();
    expect(camera.get().azDeg).toBeCloseTo(north(250), 1);
    expect(camera.get().altDeg).toBeCloseTo(45, 1);
    expect(look(container)).toEqual({ az: shown(250), alt: 45 });
    // The hand drives again: the readout is back, and a reading moves nothing.
    expect(screen.getByTestId('window-readout')).toBeInTheDocument();
    reading(aim(10, 10));
    frame();
    settle(frame);
    expect(look(container)).toEqual({ az: shown(250), alt: 45 });
  });

  it('turned off before any reading, leaves the hand where it was', () => {
    scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, rerender } = follow(camera);
    rerender({ follow: false });
    expect(camera.get()).toMatchObject({ azDeg: 180, altDeg: 35 });
    expect(look(container)).toEqual({ az: 180, alt: 35 });
  });
});
