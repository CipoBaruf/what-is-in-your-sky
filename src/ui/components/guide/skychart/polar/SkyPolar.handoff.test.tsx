/**
 * R160 (FR-PHONE-9, FR-PHONE-10; US-46 AC3, AC4; PLAN D-970, D-992): the
 * polar chart's side of the pinch across the limit, and the outline while the
 * page follows the phone. `skyAt` is `toPolar` run backwards in either
 * convention; a pinch on the drawing that narrows by more than
 * `PINCH_HANDOFF_RATIO` calls `onFieldHandoff` once, at its release, with the
 * sky under the pinch's midpoint; one that stops short, a cancel, a third
 * finger or a chart with no prop calls nothing. With `follow` the outline is
 * written from the sensor's readings on the window's own rotation channel,
 * and from the hand camera again when following ends.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { declinationDeg } from '../../../../../lib/declination';
import { PINCH_HANDOFF_RATIO } from '../../../../../lib/layout';
import { toPolar } from '../../../../../lib/skyGeometry';
import type { ChartOrientation, Observer } from '../../../../../model';
import { appStore } from '../../../../../state';
import { createHandCamera } from '../window/camera';
import { resetOrientationAccess } from '../window/orientationAccess';
import { uprightRotation } from '../window/projection';
import { fieldOutline } from './fieldOutline';
import { HORIZON_R, SkyPolar, skyAt } from './SkyPolar';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

/** The star group is a lazy chunk (D-813): the outline is in it, so its first render waits for the import. */
const settle = (): Promise<void> =>
  act(async () => {
    await import('./PolarStars');
  });

/** The drawing's box as the browser would lay it out: a square of `side` px at the origin, so client px are user units × side / 250. */
function laidOut(svg: SVGSVGElement, side: number): void {
  svg.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: side, height: side, right: side, bottom: side, toJSON: () => ({}) }) as DOMRect;
  svg.setPointerCapture = vi.fn();
  svg.releasePointerCapture = vi.fn();
}

/** Two touches on the drawing about `centre` (client px), `fromPx` apart, closed to `toPx`, lifted or cancelled. */
function pinch(svg: SVGSVGElement, centre: { x: number; y: number }, fromPx: number, toPx: number, { end = 'up' as 'up' | 'cancel', ids = [1, 2] as [number, number] } = {}): void {
  const [a, b] = ids;
  fireEvent.pointerDown(svg, { pointerId: a, pointerType: 'touch', isPrimary: true, clientX: centre.x - fromPx / 2, clientY: centre.y });
  fireEvent.pointerDown(svg, { pointerId: b, pointerType: 'touch', isPrimary: false, clientX: centre.x + fromPx / 2, clientY: centre.y });
  for (const d of [fromPx + (toPx - fromPx) / 2, toPx]) {
    fireEvent.pointerMove(svg, { pointerId: a, pointerType: 'touch', clientX: centre.x - d / 2, clientY: centre.y });
    fireEvent.pointerMove(svg, { pointerId: b, pointerType: 'touch', clientX: centre.x + d / 2, clientY: centre.y });
  }
  if (end === 'cancel') {
    fireEvent.pointerCancel(svg, { pointerId: a, pointerType: 'touch' });
    fireEvent.pointerCancel(svg, { pointerId: b, pointerType: 'touch' });
    return;
  }
  fireEvent.pointerUp(svg, { pointerId: a, pointerType: 'touch', clientX: centre.x - toPx / 2, clientY: centre.y });
  fireEvent.pointerUp(svg, { pointerId: b, pointerType: 'touch', clientX: centre.x + toPx / 2, clientY: centre.y });
}

describe('skyAt: toPolar run backwards (FR-PHONE-10, D-970)', () => {
  it.each<ChartOrientation>(['looking-up', 'map'])('returns the direction toPolar projected, in %s', (orientation) => {
    for (const { azDeg, elDeg } of [
      { azDeg: 0, elDeg: 0 },
      { azDeg: 90, elDeg: 30 },
      { azDeg: 180, elDeg: 35 },
      { azDeg: 225, elDeg: 80 },
      { azDeg: 300, elDeg: 10 },
      { azDeg: 359.5, elDeg: 45 },
    ]) {
      const p = toPolar(azDeg, elDeg, orientation);
      const back = skyAt({ x: p.x * HORIZON_R, y: p.y * HORIZON_R }, orientation);
      expect(back.altDeg).toBeCloseTo(elDeg, 6);
      expect(Math.min(Math.abs(back.azDeg - azDeg), 360 - Math.abs(back.azDeg - azDeg))).toBeLessThan(1e-6);
    }
    // The centre is the zenith; a point past the ring is under the horizon (the hand's tilt clamps it).
    expect(skyAt({ x: 0, y: 0 }, orientation)).toEqual({ azDeg: 0, altDeg: 90 });
    expect(skyAt({ x: 0, y: -1.2 * HORIZON_R }, orientation)).toEqual({ azDeg: 0, altDeg: -18 });
  });
});

describe('<SkyPolar> the pinch back to the window (FR-PHONE-10, D-970)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
  });

  it('hands the view back on the release of a pinch that narrowed by more than the ratio, aimed at the sky under its midpoint, in either convention', () => {
    const onFieldHandoff = vi.fn();
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} onFieldHandoff={onFieldHandoff} />);
    const svg = container.querySelector('[data-drawing="polar"]') as SVGSVGElement;
    laidOut(svg, 500);
    // Looking up: east on the left. A midpoint 25 px left of the centre at 500 px (two px a unit) is x = −12.5 user units: east, at 90 − 90 × 0.125 = 78.75°.
    pinch(svg, { x: 225, y: 250 }, 100, 40);
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
    const [aim] = onFieldHandoff.mock.calls[0] as [{ azDeg: number; altDeg: number }];
    expect(aim.azDeg).toBeCloseTo(90, 6);
    expect(aim.altDeg).toBeCloseTo(78.75, 6);
    expect(aim).toEqual(skyAt({ x: -12.5, y: 0 }, 'looking-up'));
    // On the map the same point is west.
    act(() => {
      appStore.getState().setChartOrientation('map');
    });
    pinch(svg, { x: 225, y: 250 }, 100, 40, { ids: [3, 4] });
    expect(onFieldHandoff).toHaveBeenCalledTimes(2);
    expect((onFieldHandoff.mock.calls[1] as [{ azDeg: number }])[0].azDeg).toBeCloseTo(270, 6);
    // Where the box is laid out off the origin the midpoint is still read in the drawing's own frame.
    svg.getBoundingClientRect = () => ({ x: 100, y: 300, left: 100, top: 300, width: 250, height: 250, right: 350, bottom: 550, toJSON: () => ({}) }) as DOMRect;
    pinch(svg, { x: 225, y: 425 }, 100, 40, { ids: [5, 6] });
    expect((onFieldHandoff.mock.calls[2] as [{ azDeg: number; altDeg: number }])[0]).toEqual({ azDeg: 0, altDeg: 90 });
  });

  it('stays for a pinch that stops short of the ratio, for a cancel, for a third finger and for an opening pinch; and calls nothing without the prop', () => {
    const onFieldHandoff = vi.fn();
    const { container, rerender } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} onFieldHandoff={onFieldHandoff} />);
    const svg = container.querySelector('[data-drawing="polar"]') as SVGSVGElement;
    laidOut(svg, 500);
    const centre = { x: 250, y: 250 };
    pinch(svg, centre, 100, 100 / PINCH_HANDOFF_RATIO);
    expect(onFieldHandoff).not.toHaveBeenCalled();
    pinch(svg, centre, 100, 100 / PINCH_HANDOFF_RATIO - 1, { end: 'cancel' });
    expect(onFieldHandoff).not.toHaveBeenCalled();
    // Opening the fingers is the other way: the whole sky has no narrower field to go to.
    pinch(svg, centre, 100, 200);
    expect(onFieldHandoff).not.toHaveBeenCalled();
    // A third finger lands: the first two are still the pinch, and the third is ignored.
    fireEvent.pointerDown(svg, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 250 });
    fireEvent.pointerDown(svg, { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 300, clientY: 250 });
    fireEvent.pointerDown(svg, { pointerId: 3, pointerType: 'touch', isPrimary: false, clientX: 250, clientY: 100 });
    fireEvent.pointerMove(svg, { pointerId: 3, pointerType: 'touch', clientX: 250, clientY: 110 });
    fireEvent.pointerMove(svg, { pointerId: 2, pointerType: 'touch', clientX: 230, clientY: 250 });
    fireEvent.pointerUp(svg, { pointerId: 3, pointerType: 'touch', clientX: 250, clientY: 110 });
    expect(onFieldHandoff).not.toHaveBeenCalled();
    fireEvent.pointerUp(svg, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 250 });
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(svg, { pointerId: 2, pointerType: 'touch', clientX: 230, clientY: 250 });
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
    // One finger alone is nothing, with or without a move.
    fireEvent.pointerDown(svg, { pointerId: 4, pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 250 });
    fireEvent.pointerMove(svg, { pointerId: 4, pointerType: 'touch', clientX: 260, clientY: 250 });
    fireEvent.pointerUp(svg, { pointerId: 4, pointerType: 'touch', clientX: 260, clientY: 250 });
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
    rerender(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    pinch(svg, centre, 100, 40, { ids: [5, 6] });
    expect(onFieldHandoff).toHaveBeenCalledTimes(1);
  });
});

describe('<SkyPolar> the outline while following (FR-PHONE-9, D-992)', () => {
  const polar = (orientation: ChartOrientation) => (p: { azDeg: number; elDeg: number }) => {
    const v = toPolar(p.azDeg, p.elDeg, orientation);
    return { x: v.x * HORIZON_R, y: v.y * HORIZON_R };
  };
  /** jsdom lays nothing out, so the outline's box is the square fallback. */
  const square = (fovDeg: number, screenAngleDeg = 0) => ({ fovDeg, width: 1, height: 1, screenAngleDeg });
  const DECLINATION = declinationDeg({ lat: observer.lat, lon: observer.lon, altM: observer.altM }, new Date());
  let frames: (() => void) | null = null;

  beforeEach(() => {
    resetOrientationAccess();
    vi.stubGlobal(
      'DeviceOrientationEvent',
      function DeviceOrientationEvent() {
        return undefined;
      },
    );
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
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
    frames = (): void => {
      for (let i = 0; i < 40; i += 1) {
        const callbacks = [...pending.values()];
        pending.clear();
        act(() => {
          for (const callback of callbacks) callback(16);
        });
      }
    };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    resetOrientationAccess();
    appStore.setState(initial, true);
  });

  it('draws the hand’s field until the first reading, then the phone’s pose with every reading, and the hand’s again when following ends', async () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container, rerender } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} follow />);
    await settle();
    const outline = (): Element | null => container.querySelector('[data-field-outline]');
    expect(outline()).toHaveAttribute('data-following');
    expect(outline()?.getAttribute('d')).toBe(fieldOutline({ azDeg: 180, altDeg: 35 }, square(60), polar('looking-up')));
    // The phone's back toward magnetic 120°, 30° up, held upright: the outline is of that pose, true north by the declination.
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: (360 - 120) % 360, beta: 120, gamma: 0, absolute: true }));
    });
    frames?.();
    const sensed = outline()?.getAttribute('d') ?? '';
    expect(sensed).toBe(fieldOutline(uprightRotation(120 + DECLINATION, 30), square(60), polar('looking-up')));
    expect(sensed).not.toBe(fieldOutline({ azDeg: 180, altDeg: 35 }, square(60), polar('looking-up')));
    // A zoom while following moves the field alone (FR-GYRO-4).
    act(() => {
      camera.zoomBy(1.5);
    });
    expect(outline()?.getAttribute('d')).toBe(fieldOutline(uprightRotation(120 + DECLINATION, 30), square(90), polar('looking-up')));
    // Following off: the hand's camera is the outline's again, where the page seeded it.
    act(() => {
      camera.open({ azDeg: 90, altDeg: 40, fovDeg: 60 });
    });
    rerender(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    expect(outline()).not.toHaveAttribute('data-following');
    expect(outline()?.getAttribute('d')).toBe(fieldOutline({ azDeg: 90, altDeg: 40 }, square(60), polar('looking-up')));
  });
});
