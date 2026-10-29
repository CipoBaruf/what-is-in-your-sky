/**
 * R47 (FR-WIN-2, FR-WIN-4, FR-WIN-5; US-21 AC1, AC2, AC4, AC7): the window
 * with the API stubbed — the `[ point at the sky ]` gate where a tap is
 * needed, asked only on the tap; the picture turning with a reading and the
 * readout naming where it looks and the true-north correction; the compass
 * names, markers and key placed and marked in or out of view; the Sun, the
 * Moon and the hidden objects; the arc states; and, through `SkyChart`, the
 * refusal's note with the dome as the view and the compass-less phone losing
 * the option.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { stubMatchMedia, type MatchMediaStub } from '../../../../../../tests/support/matchMedia';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../../../tests/support/moonFixtures';
import { en } from '../../../../../i18n/en';
import { es } from '../../../../../i18n/es';
import { I18nProvider } from '../../../../../i18n/useT';
import type { Observer } from '../../../../../model';
import { appStore } from '../../../../../state';
import { ScreenTurnProvider } from '../../../screen/screenTurn';
import { SkyChart } from '../SkyChart';
import type { HiddenMarker } from '../SkyChart.types';
import { createHandCamera, SENSOR_CAMERA } from './camera';
import { requestOrientationAccess, resetOrientationAccess } from './orientationAccess';
import { turnTo } from './gutter';
import * as projection from './projection';
import type { StarField as StarFieldData } from './scene';
import type { Quarter } from './screenTurn';
import { placeholderAltDeg, SkyWindow } from './SkyWindow';
import { StarField } from './StarField';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

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

function reading(fields: { alpha: number; beta: number; gamma?: number; absolute?: boolean }): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 0, absolute: true, ...fields }));
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

/** The heading of the phone's back as the W3C alpha: 360 − azimuth. Beta 90 + altitude tilts it up. */
const aim = (azDeg: number, altDeg: number): { alpha: number; beta: number } => ({ alpha: (360 - azDeg) % 360, beta: 90 + altDeg });

const inView = (el: Element | null): boolean => el?.getAttribute('data-in-view') === 'true';

/**
 * R73 (D-427): the measured box. jsdom measures nothing, so the window falls
 * back to its square `UNMEASURED`; this is the `ResizeObserver` reporting one
 * size the moment it is asked to observe, which is what a real layout does
 * before the first paint. It is the box and not the viewport that decides the
 * field, the ground states and the advice now, so a test that wants an upright
 * picture asks for an upright box.
 */
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

/** Is the point inside the closed `M … L … Z` polygon? A ray cast to the right, for the ground clip (R56). */
function encloses(d: string, x: number, y: number): boolean {
  const points = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])] as const);
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i] ?? [0, 0];
    const [xj, yj] = points[j] ?? [0, 0];
    if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
  }
  return inside;
}
const wrapper = (container: HTMLElement): Element => container.querySelector('[data-look-az]') as Element;

describe('<SkyWindow>', () => {
  beforeEach(() => {
    resetOrientationAccess();
    withPhone();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  it('the placeholder looks 20° up, or as high as the peak needs to keep 8° inside the top of the box', () => {
    const square = { fovDeg: 60, width: 390, height: 390, screenAngleDeg: 0 };
    expect(placeholderAltDeg(undefined, square)).toBe(20);
    expect(placeholderAltDeg(10, square)).toBe(20);
    expect(placeholderAltDeg(42, square)).toBeCloseTo(20, 6);
    // 61 − 30 + 8: the half-field of a square 60° box is 30°.
    expect(placeholderAltDeg(61, square)).toBeCloseTo(39, 6);
    expect(placeholderAltDeg(90, square)).toBeCloseTo(68, 6);
    // A taller box sees further up (56° above the centre at twice the width), so the same peak asks for nothing.
    const tall = { ...square, height: 780 };
    expect(placeholderAltDeg(61, tall)).toBe(20);
    expect(placeholderAltDeg(85, tall)).toBeCloseTo(85 - 2 * Math.atan(390 / (195 / Math.tan(Math.PI / 12))) * (180 / Math.PI) + 8, 6);
  });

  it('before a reading points at the peak 20° up, keeps every name and marker in the DOM marked in or out of view, and lists nothing in words but names and keys', () => {
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} legendKeys={{ [pass.id]: 'A' }} />);
    const w = wrapper(container);
    expect(w).toHaveAttribute('data-look-az', String(Math.round(pass.peak.azDeg)));
    expect(w).toHaveAttribute('data-look-alt', '20');
    expect(w).toHaveAttribute('data-state', 'idle');
    expect(screen.getByTestId('window-note')).toHaveTextContent(en.window.waiting);
    const svg = container.querySelector('[data-drawing="window"]');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    for (const name of ['N', 'E', 'S', 'W']) expect(container.querySelector(`[data-anchor="${name}"]`)).toHaveTextContent(name);
    // The peak is where the window points, so its marker and key are in view; the rise and the end, near the horizon 40°+ away, may not be.
    expect(inView(container.querySelector('[data-marker="peak"]'))).toBe(true);
    expect(inView(container.querySelector('[data-anchor="key"]'))).toBe(true);
    expect(container.querySelector('[data-marker="arrow"]')).not.toBeNull();
    expect(container.querySelector('[data-marker="rise"]')).not.toBeNull();
    expect(container.querySelector('[data-marker="end"]')).not.toBeNull();
    expect(container.querySelector('[data-horizon]')?.getAttribute('d')).toMatch(/^M/);
    expect(container.querySelectorAll('[data-tick]')).toHaveLength(12);
    const outOfView = container.querySelectorAll('[data-in-view="false"]');
    expect(outOfView.length).toBeGreaterThan(0);
    for (const el of outOfView) expect(el).toHaveAttribute('visibility', 'hidden');
    const written = [...container.querySelectorAll('[data-drawing] text')].map((el) => el.textContent ?? '');
    expect(written.filter((text) => !/^(N|NE|E|SE|S|SW|W|NW|[A-Z]\d?)$/.test(text))).toEqual([]);
  });

  it('turns with the phone, smoothed, and the readout names where it looks and the true-north correction', () => {
    const frame = scriptedFrames();
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} legendKeys={{ [pass.id]: 'A' }} />);
    const w = wrapper(container);
    expect(screen.queryByTestId('window-readout')).toBeNull();
    // Aim magnetic north on the horizon: N in view, S not.
    reading(aim(0, 0));
    frame();
    settle(frame);
    expect(w).toHaveAttribute('data-state', 'on');
    // The observer is at Neuquén, where the declination is about +1°: the sensor's magnetic north is a true 1°
    // (US-21 AC6), and the correction is named with the sign and a tenth of a degree, as the live strip names it.
    const heading = screen.getByTestId('window-heading');
    expect(heading.textContent).toMatch(/^true north, declination [+−-]\d+\.\d°$/);
    expect(heading).toHaveAttribute('data-declination', expect.stringMatching(/^-?\d+\.\d$/));
    const declination = Number(heading.getAttribute('data-declination'));
    expect(Math.abs(declination)).toBeGreaterThan(0.5);
    const trueAz = (magnetic: number): number => (Math.round(magnetic + declination) + 360) % 360;
    expect(w).toHaveAttribute('data-look-az', String(trueAz(0)));
    expect(w).toHaveAttribute('data-look-alt', '0');
    expect(inView(container.querySelector('[data-anchor="N"]'))).toBe(true);
    expect(inView(container.querySelector('[data-anchor="S"]'))).toBe(false);
    const readout = screen.getByTestId('window-readout');
    expect(readout).toHaveTextContent(`Facing N (${String(trueAz(0))}°) · up 0°`);
    // A quarter turn to the east: part of the way after one frame, there after the smoothing settles.
    reading(aim(90, 30));
    frame();
    const partWay = Number(w.getAttribute('data-look-az'));
    expect(partWay).toBeGreaterThan(5);
    expect(partWay).toBeLessThan(85);
    settle(frame);
    expect(w).toHaveAttribute('data-look-az', String(trueAz(90)));
    expect(w).toHaveAttribute('data-look-alt', '30');
    expect(inView(container.querySelector('[data-anchor="N"]'))).toBe(false);
    expect(readout).toHaveTextContent(`Facing E (${String(trueAz(90))}°) · up 30°`);
  });

  it('draws the Sun on the horizon and the Moon where it is, and the hidden objects with their keys', () => {
    const sun = { t: MOON_FIXTURE.t, azDeg: 285, altDeg: -8 };
    const hidden: HiddenMarker[] = [{ id: 'hidden-1', azDeg: pass.peak.azDeg + 10, elDeg: 35, label: 'Cosmos · in shadow' }];
    const { container, rerender } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={sun} moon={MOON_FIXTURE} hidden={hidden} legendKeys={{ [pass.id]: 'A', 'hidden-1': 'B' }} />);
    expect(container.querySelector('[data-body="sun"] path')?.getAttribute('stroke-width')).toMatch(/^\d+\.\d$/);
    expect(container.querySelector('[data-body="moon"] [data-marker="moon"]')).not.toBeNull();
    expect(container.querySelector('[data-hidden-id="hidden-1"] [data-marker="hidden"]')).not.toBeNull();
    expect(container.querySelector('[data-hidden-id="hidden-1"] [data-anchor="key"]')).toHaveTextContent('B');
    expect(inView(container.querySelector('[data-hidden-id="hidden-1"] [data-marker="hidden"]'))).toBe(true);
    rerender(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={{ ...sun, altDeg: -30 }} moon={MOON_DOWN} />);
    expect(container.querySelector('[data-body="sun"]')).toBeNull();
    expect(container.querySelector('[data-body="moon"]')).toBeNull();
  });

  it('draws each arc in its state: the live cut with the marker, ahead dotted with the rise, linger thin, hidden not at all, and the series colour by pass', () => {
    const mid = pass.start.t + (pass.end.t - pass.start.t) / 2;
    const live = { ...pass, id: 'live', arc: 'live' as const };
    const ahead = { ...pass, id: 'ahead', arc: 'ahead' as const };
    const linger = { ...pass, id: 'linger', arc: 'linger' as const };
    const gone = { ...pass, id: 'gone', arc: 'hidden' as const };
    const { container } = render(<SkyWindow passes={[live, ahead, linger, gone]} observer={observer} highlightedPassId={null} now={mid} colorBy="pass" />);
    const group = (id: string) => container.querySelector(`[data-pass-id="${id}"]`);
    expect(group('live')).toHaveAttribute('data-series', '1');
    expect(group('live')?.querySelector('[data-marker="live"]')).not.toBeNull();
    expect(group('live')?.querySelector('[data-marker="now"]')).not.toBeNull();
    expect(group('live')?.querySelector('[data-marker="arrow"]')).toBeNull();
    expect(group('ahead')?.querySelector('[data-marker="ahead"]')).not.toBeNull();
    expect(group('ahead')?.querySelector('[data-marker="rise"]')).not.toBeNull();
    expect(group('ahead')?.querySelector('[data-marker="peak"]')).toBeNull();
    expect(group('linger')?.querySelector('[data-marker="linger"]')).not.toBeNull();
    expect(group('linger')?.querySelector('[data-marker]:not([data-marker="linger"])')).toBeNull();
    expect(group('gone')).toBeNull();
    // The full arc at `now` inside it: the flown part and the marker.
    const { container: full } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} now={mid} />);
    expect(full.querySelector('[data-marker="flown"]')).not.toBeNull();
    expect(full.querySelector('[data-marker="now"]')).not.toBeNull();
  });

  it('reports the pass through onSelectPass', () => {
    const onSelectPass = vi.fn();
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} onSelectPass={onSelectPass} />);
    fireEvent.click(container.querySelector(`[data-pass-id="${pass.id}"]`) as Element);
    expect(onSelectPass).toHaveBeenCalledWith(pass.id);
  });

  /**
   * R56 (FR-FOL-4, FR-FOL-5; US-21 AC9, AC10): the phone swept down out of the
   * sky. The golden pass sits about 10° up around the north-east, so a phone
   * pointed 10° *below* the horizon there still holds it in the top of a 60°
   * field: that is the `ground` state, hatch below and picture above.
   */
  describe('pointing at the ground (FR-FOL-5)', () => {
    const sun = { t: MOON_FIXTURE.t, azDeg: 285, altDeg: -8 };
    const aimAt = (frame: () => void, altDeg: number): void => {
      reading(aim(pass.peak.azDeg, altDeg));
      frame();
      settle(frame);
    };

    it('takes the star field out of the drawing at buried, though its marks were written visible (R114)', () => {
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} scene={{ stars: field }} />);
      reading(aim(185, 35));
      frame();
      settle(frame);
      const group = container.querySelector('[data-layer="stars"]') as SVGGElement;
      expect(container.querySelector('[data-star="0"]')).toHaveAttribute('visibility', 'visible');
      reading(aim(185, -80));
      frame();
      settle(frame);
      expect(wrapper(container)).toHaveAttribute('data-ground', 'buried');
      // A child's own `visible` beats an inherited `hidden` in SVG, so the group is `display: none` as well.
      expect(group).toHaveAttribute('visibility', 'hidden');
      expect(group).toHaveAttribute('display', 'none');
      reading(aim(185, 35));
      frame();
      settle(frame);
      expect(group).toHaveAttribute('visibility', 'visible');
      expect(group).not.toHaveAttribute('display');
    });

    it('hatches the field below the horizon with a spoken note, and keeps drawing everything above it', () => {
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={sun} moon={MOON_FIXTURE} legendKeys={{ [pass.id]: 'A' }} />);
      expect(wrapper(container)).toHaveAttribute('data-ground', 'sky');
      expect(container.querySelector('[data-ground-veil]')).toBeNull();
      expect(screen.queryByTestId('window-ground-note')).toBeNull();

      aimAt(frame, -10);
      expect(wrapper(container)).toHaveAttribute('data-ground', 'ground');
      // The veil is a pattern and not a colour (FR-X-5), clipped to the closed horizon the picture computes.
      const veil = container.querySelector('[data-ground-veil="ground"]');
      expect(veil).toHaveAttribute('fill', expect.stringMatching(/^url\(#.+-hatch\)$/));
      const clip = veil?.getAttribute('clip-path') ?? '';
      expect(clip).toMatch(/^url\(#.+-ground\)$/);
      const clipPath = container.querySelector(`clipPath[id="${clip.slice(5, -1)}"] path`);
      const region = clipPath?.getAttribute('d') ?? '';
      expect(region).toMatch(/^M[-\d. L]+Z$/);
      // The clip is the ground and not the sky: the bottom of the box is inside it, the top — where the arc is — outside.
      expect(encloses(region, 195, 330)).toBe(true);
      expect(encloses(region, 195, 40)).toBe(false);
      expect(container.querySelector('[data-pattern="ground"]')).not.toBeNull();
      const note = screen.getByTestId('window-ground-note');
      expect(note).toHaveAttribute('role', 'status');
      expect(note).toHaveTextContent(en.window.ground);
      // Above the horizon nothing changes: the arc, its markers, the horizon, the Sun and the Moon are all still drawn.
      expect(container.querySelector(`[data-pass-id="${pass.id}"] path`)?.getAttribute('d')).toMatch(/^M/);
      expect(container.querySelector('[data-horizon]')?.getAttribute('d')).toMatch(/^M/);
      expect(inView(container.querySelector('[data-marker="peak"]'))).toBe(true);
      expect(container.querySelector('[data-body="sun"]')).not.toBeNull();
      expect(container.querySelector('[data-body="moon"]')).not.toBeNull();
    });

    it('projects the horizon once per render, not twice, and reads lookDirection once (F-57, F-58)', () => {
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow passes={[]} observer={observer} highlightedPassId={null} />);
      reading(aim(0, -10));
      frame();
      settle(frame);
      expect(wrapper(container)).toHaveAttribute('data-ground', 'ground');

      const projectSpy = vi.spyOn(projection, 'project');
      const lookSpy = vi.spyOn(projection, 'lookDirection');
      // Nothing restores mocks between tests in this file, and these two call through: restore them here.
      onTestFinished(() => {
        projectSpy.mockRestore();
        lookSpy.mockRestore();
      });
      // One more render, still `ground`: the smoothing keeps every earlier frame's rotation, so this one alone is measured.
      reading(aim(0, -12));
      frame();
      expect(wrapper(container)).toHaveAttribute('data-ground', 'ground');

      // Every azimuth tick projects one point at elDeg 0 too (12, one every 30°, unaffected by the fix);
      // the rest of the elDeg-0 calls are the horizon's — 181 with the grid path and the ground clip
      // sharing one projection (F-57), 362 when `groundClipPath` re-projects them itself (the old code).
      const elevationZeroCalls = projectSpy.mock.calls.filter(([, , elDeg]) => elDeg === 0).length;
      expect(elevationZeroCalls - 12).toBe(181);
      expect(lookSpy).toHaveBeenCalledTimes(1);
    });

    it('at buried is the ground panel and its note, and nothing else', () => {
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={sun} moon={MOON_FIXTURE} legendKeys={{ [pass.id]: 'A' }} />);
      aimAt(frame, -80);
      expect(wrapper(container)).toHaveAttribute('data-ground', 'buried');
      const veil = container.querySelector('[data-ground-veil="buried"]');
      expect(veil).toHaveAttribute('fill', expect.stringMatching(/^url\(#.+-hatch\)$/));
      // The whole box is the ground: no clip, and the box's own width and height.
      expect(veil?.getAttribute('clip-path')).toBeNull();
      expect(veil).toHaveAttribute('width', '390');
      const note = screen.getByTestId('window-ground-note');
      expect(note).toHaveAttribute('role', 'status');
      expect(note).toHaveTextContent(en.window.buried);
      for (const selector of ['[data-pass-id]', '[data-marker]', '[data-body="sun"]', '[data-body="moon"]', '[data-horizon]', '[data-anchor="N"]', '[data-tick]']) {
        expect(container.querySelector(selector)).toBeNull();
      }
      // Neither state is modal and neither needs a tap: raising the phone is what leaves it.
      aimAt(frame, 20);
      expect(wrapper(container)).toHaveAttribute('data-ground', 'sky');
      expect(screen.queryByTestId('window-ground-note')).toBeNull();
      expect(container.querySelector(`[data-pass-id="${pass.id}"]`)).not.toBeNull();
    });

    it('speaks both notes in Spanish (FR-I18N-2)', () => {
      const frame = scriptedFrames();
      render(
        <I18nProvider locale="es">
          <SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} />
        </I18nProvider>,
      );
      aimAt(frame, -10);
      expect(screen.getByTestId('window-ground-note')).toHaveTextContent(es.window.ground);
      aimAt(frame, -80);
      expect(screen.getByTestId('window-ground-note')).toHaveTextContent(es.window.buried);
      expect(es.window.ground).not.toBe(en.window.ground);
    });

    it('is swept through and back — sky, ground, buried, ground, sky — with the smoothing never reset (FR-FOL-4, US-21 AC9)', () => {
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      const w = wrapper(container);
      const sweep: number[] = [];
      for (let altDeg = 80; altDeg >= -80; altDeg -= 5) sweep.push(altDeg);
      for (let altDeg = -75; altDeg <= 80; altDeg += 5) sweep.push(altDeg);

      const states: (string | null)[] = [];
      let previous: number | null = null;
      for (const altDeg of sweep) {
        reading(aim(pass.peak.azDeg, altDeg));
        frame();
        // One frame is a step *from where the picture was*, never a jump to the reading: the smoothing kept the
        // previous rotation, which is what "no reset" means (FR-WIN-3), and nothing is clipped to a region.
        const partWay = Number(w.getAttribute('data-look-alt'));
        if (previous !== null) {
          expect(Math.abs(partWay - previous)).toBeGreaterThan(0);
          expect(Math.abs(partWay - previous)).toBeLessThan(5);
        }
        settle(frame);
        expect(w).toHaveAttribute('data-state', 'on');
        expect(Number(w.getAttribute('data-look-alt'))).toBe(altDeg);
        states.push(w.getAttribute('data-ground'));
        previous = altDeg;
      }
      expect(states.filter((state, index) => state !== states[index - 1])).toEqual(['sky', 'ground', 'buried', 'ground', 'sky']);
    });
  });

  describe('the notes (FR-WIN-4, FR-WIN-5 as amended v1.3.1)', () => {
    /**
     * R66 (V13-8, D-350): there is no `[ point at the sky ]` any more. The
     * window is only mounted on the sky screen, and the tap that opened the
     * screen is the tap that asked, so what a mount finds is a grant already
     * given: the window waits for its first reading and then draws, and it
     * never asks for anything itself.
     */
    it('asks for nothing on mount and draws from the grant the tap already had', async () => {
      const frame = scriptedFrames();
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      // What the entry made: the permission asked and granted inside the tap (D-350).
      await requestOrientationAccess();
      requestPermission.mockClear();
      const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      expect(screen.queryByTestId('window-gate')).toBeNull();
      expect(requestPermission).not.toHaveBeenCalled();
      await flush();
      reading(aim(0, 0));
      frame();
      expect(wrapper(container)).toHaveAttribute('data-state', 'on');
    });

    /**
     * R136 (FR-FLOW-14, FR-FLOW-15; V26-11, V26-12): the window is a saved view on a phone too, and the permission
     * is asked for by `[ hold up to the sky ]` beside its picker, never by the view option.
     */
    it('through SkyChart: a refusal at [ hold up to the sky ] keeps the page on the window with the note; a compass-less phone keeps the option too', async () => {
      const frame = scriptedFrames();
      withPhone(() => Promise.resolve('denied'));
      appStore.getState().setChartView('window');
      render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      const figure = screen.getByRole('figure');
      const toggle = screen.getByRole('group', { name: 'Chart view' });
      fireEvent.click(await screen.findByTestId('window-hold-up'));
      await flush();
      // FR-FOL-2: nothing opened, the page is on the view it was on, and the note says why.
      expect(appStore.getState().skyScreen).toBe(false);
      expect(figure).toHaveAttribute('data-view', 'window');
      expect(screen.getByTestId('chart-view-note')).toHaveTextContent(en.window.denied);
      expect(appStore.getState().chartView).toBe('window');
      expect(within(toggle).getByRole('button', { name: 'Window' })).toBeInTheDocument();
      // Choosing another view clears the note.
      fireEvent.click(within(toggle).getByRole('button', { name: 'Polar' }));
      expect(screen.queryByTestId('chart-view-note')).toBeNull();

      // A phone with no north in its readings: the note, no screen, and (FR-WIN-4 as amended v2.5) the option kept.
      withPhone();
      resetOrientationAccess();
      fireEvent.click(within(toggle).getByRole('button', { name: 'Window' }));
      expect(appStore.getState().skyScreen).toBe(false);
      fireEvent.click(await screen.findByTestId('window-hold-up'));
      reading({ alpha: 30, beta: 90, absolute: false });
      frame();
      expect(appStore.getState().skyScreen).toBe(false);
      expect(figure).toHaveAttribute('data-view', 'window');
      expect(screen.getByTestId('chart-view-note')).toHaveTextContent(en.window.relative);
      expect(appStore.getState().windowLost).toBe(true);
      expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ chartView: 'window' });
    });

    it('asks for the permission inside the tap on [ hold up to the sky ], not on the view option (FR-WIN-4), and opens the screen on the first reading', async () => {
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      appStore.getState().setChartView('dome');
      render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      fireEvent.click(within(screen.getByRole('group', { name: 'Chart view' })).getByRole('button', { name: 'Window' }));
      expect(requestPermission).not.toHaveBeenCalled();
      fireEvent.click(await screen.findByTestId('window-hold-up'));
      expect(requestPermission).toHaveBeenCalledTimes(1);
      // Granted, but not yet open: the reading with a heading is what decides (F-42, D-350).
      await flush();
      expect(appStore.getState().skyScreen).toBe(false);
      expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'window');
      reading({ alpha: 30, beta: 90, absolute: true });
      expect(appStore.getState().skyScreen).toBe(true);
      // One prompt in total: the window the screen mounts inherits the grant (D-350).
      expect(requestPermission).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * R63 (FR-FSC-1; US-21 AC11; D-323) and R73 (FR-FSC-4 as rewritten,
   * FR-FSC-10, FR-FSC-11; US-21 AC12 as amended, AC15; D-427, D-428, D-429):
   * the window on the sky screen. `screen` reaches `SkyChartProps` with R62,
   * so the tests ask for it the way the component reads it — through a cast —
   * and the screen's own layout (the overlays, the `×`, the turned layer) is
   * `SkyScreen.test.tsx`'s to test.
   *
   * What R73 deleted was the veil: held upright the box was one note with no
   * drawing in it, which on a rotation-locked phone was the whole screen and
   * the reader's only move was a system setting the app has no business asking
   * for. These assert the opposite, so they fail on `origin/main`.
   */
  describe('on the sky screen (FR-FSC-4 as rewritten)', () => {
    /** D-322's prop, before the type carries it. */
    const asScreen = { screen: true } as { screen?: boolean };
    const legend = <p data-testid="window-legend">A · ISS</p>;
    const viewControl = <span data-testid="view-control">Chart view</span>;
    /** 844 × 390 is the sky screen's landscape phone (D-326); 390 × 844 the same phone upright. */
    const LANDSCAPE = [844, 390] as const;
    const PORTRAIT = [390, 844] as const;
    let media: MatchMediaStub | null = null;

    afterEach(() => {
      media?.restore();
      media = null;
    });

    const paint = (container: HTMLElement): number => container.querySelectorAll('[data-drawing="window"] *').length;

    it('held upright lays out the readout, the next event with the advice on its peak line, the band, the legend and the gutter (FR-GUT-7)', () => {
      // The viewport says landscape and the box is upright: on a rotation-locked phone that is the true pair,
      // and D-427 makes the box the one that is believed.
      media = stubMatchMedia(...LANDSCAPE);
      stubBox(...PORTRAIT);
      const detach = vi.spyOn(window, 'removeEventListener');
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} now={pass.start.t - 60_000} legend={legend} controls={viewControl} legendKeys={{ [pass.id]: 'A' }} />);
      const w = wrapper(container);
      expect(w).toHaveAttribute('data-orientation', 'portrait');
      // D-451: the frame lays out upright from the same reading — five rows, in order, the `×`'s overlay over them.
      const frameEl = screen.getByTestId('chart-frame');
      expect(frameEl).toHaveAttribute('data-orientation', 'portrait');
      expect([...frameEl.children].map((el) => el.getAttribute('data-row')).filter(Boolean)).toEqual(['readout', 'headline', 'band', 'legend', 'gutter']);

      reading(aim(pass.peak.azDeg, 20));
      frame();
      settle(frame);
      expect(w).toHaveAttribute('data-state', 'on');

      // FR-FSC-4: the drawing, the readout and the legend are all there upright — nothing waits for the turn.
      expect(paint(container)).toBeGreaterThan(0);
      expect(container.querySelector(`[data-pass-id="${pass.id}"] [data-marker]`)).not.toBeNull();
      expect(container.querySelector('[data-horizon]')?.getAttribute('d')).toMatch(/^M/);
      expect(inView(container.querySelector('[data-marker="peak"]'))).toBe(true);
      expect(screen.getByTestId('window-readout')).toHaveTextContent('Facing');
      expect(screen.getByTestId('window-legend')).toBeInTheDocument();
      expect(screen.getByTestId('chart-legend-slot')).toBeInTheDocument();
      expect(screen.queryByTestId('window-gate')).toBeNull();

      // FR-GUT-7 (D-451): the advice is secondary copy under the countdown's block — not a note over the picture,
      // and not spoken as a status. FR-FSC-11's `role="status"` line is gone. R81 (D-508) re-cut the block to the
      // countdown label, the time and the path line, which names the pass.
      expect(screen.queryByTestId('window-turn-note')).toBeNull();
      const headline = screen.getByTestId('window-headline');
      expect(within(headline).getByTestId('next-event-label')).toBeInTheDocument();
      const peakLine = within(headline).getByTestId('next-event-path');
      expect(peakLine).toHaveTextContent('ISS (Zarya)');
      const advice = within(headline).getByTestId('window-turn-advice');
      expect(advice).toHaveTextContent(en.window.turnAdvice);
      expect(advice).not.toHaveAttribute('role');
      expect(peakLine.compareDocumentPosition(advice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByTestId('chart-box')).not.toContainElement(advice);
      expect(screen.queryByTestId('window-ground-note')).toBeNull();
      expect(screen.getByTestId('chart-gutter-slot')).toContainElement(screen.getByTestId('compass-gutter'));

      // FR-FOL-2: nothing detached the sensor, so nothing has to be asked again on the turn.
      const dropped = detach.mock.calls.filter(([type]) => String(type).startsWith('deviceorientation'));
      expect(dropped).toEqual([]);
    });

    it('drops the advice and the legend for the gutter once the box is wide, whatever the viewport says (FR-GUT-1, D-451)', () => {
      // The other true pair on a locked phone: a portrait viewport with a box the turned layer made wide.
      media = stubMatchMedia(...PORTRAIT);
      stubBox(...LANDSCAPE);
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} legend={legend} legendKeys={{ [pass.id]: 'A' }} />);
      reading(aim(pass.peak.azDeg, 20));
      frame();
      settle(frame);
      expect(wrapper(container)).toHaveAttribute('data-orientation', 'landscape');
      expect(screen.queryByTestId('window-turn-advice')).toBeNull();
      expect(screen.queryByTestId('window-headline')).toBeNull();
      // FR-GUT-1: sideways the bottom slot is the gutter, and the legend strip is not rendered at all.
      expect(screen.getByTestId('chart-gutter-slot')).toContainElement(screen.getByTestId('compass-gutter'));
      expect(screen.queryByTestId('chart-legend-slot')).toBeNull();
      expect(screen.queryByTestId('window-legend')).toBeNull();
      expect(paint(container)).toBeGreaterThan(0);
      expect(screen.getByTestId('window-readout')).toBeInTheDocument();
    });

    it('reports the quarter it read from the pose, once per turn of the hand (FR-FSC-10, D-429)', () => {
      stubBox(...PORTRAIT);
      const frame = scriptedFrames();
      const reported: Quarter[] = [];
      const report = (quarter: Quarter): void => {
        reported.push(quarter);
      };
      render(
        <ScreenTurnProvider value={{ quarter: 0, report }}>
          <SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} />
        </ScreenTurnProvider>,
      );
      // Before the first reading the browser's own angle stands, so the layer turns by nothing.
      expect(reported).toEqual([0]);

      // The phone held sideways, its top to the reader's left: the pose is a quarter the viewport never reported.
      reading({ alpha: 0, beta: 0, gamma: -90 });
      frame();
      settle(frame);
      expect(reported.at(-1)).toBe(90);
      // Forty settling frames, one report: the quarter is a thing that changes when a hand turns.
      expect(reported).toEqual([0, 90]);

      // Back upright, and back to 0.
      reading(aim(pass.peak.azDeg, 20));
      frame();
      settle(frame);
      expect(reported.at(-1)).toBe(0);
    });

    it('reports nothing and turns nothing off a screen, where there is no provider at all', () => {
      stubBox(...PORTRAIT);
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow fill passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      reading({ alpha: 0, beta: 0, gamma: -90 });
      frame();
      settle(frame);
      // No provider, no throw, no advice, no gutter, and the projection is still the browser's own angle (D-425).
      expect(screen.queryByTestId('window-turn-advice')).toBeNull();
      expect(screen.queryByTestId('compass-gutter')).toBeNull();
      expect(paint(container)).toBeGreaterThan(0);
    });

    it('says the advice in Spanish', () => {
      stubBox(...PORTRAIT);
      render(
        <I18nProvider locale="es">
          <SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} />
        </I18nProvider>,
      );
      expect(screen.getByTestId('window-turn-advice')).toHaveTextContent(es.window.turnAdvice);
      expect(es.window.turnAdvice).not.toBe(en.window.turnAdvice);
    });

    it('keeps the ground note the only line over the drawing upright, the advice staying on the peak line (FR-GUT-7, FR-FOL-5)', () => {
      stubBox(...PORTRAIT);
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} now={pass.start.t + 1_000} />);
      const box = screen.getByTestId('chart-box');
      reading(aim(pass.peak.azDeg, 20));
      frame();
      settle(frame);
      expect(within(box).queryAllByRole('status')).toEqual([]);

      // Pointed below the horizon: the ground note is the line over the drawing, and it is the only one.
      reading(aim(pass.peak.azDeg, -20));
      frame();
      settle(frame);
      expect(wrapper(container)).toHaveAttribute('data-ground', 'ground');
      expect(within(box).getAllByRole('status')).toEqual([screen.getByTestId('window-ground-note')]);
      expect(screen.getByTestId('window-ground-note')).toHaveTextContent(en.window.ground);
      expect(screen.getByTestId('window-turn-advice')).toBeInTheDocument();

      // Raising the phone takes the note away with no tap.
      reading(aim(pass.peak.azDeg, 20));
      frame();
      settle(frame);
      expect(screen.queryByTestId('window-ground-note')).toBeNull();
    });

    it('sweeps the ground states in an upright box too, which D-323 had made landscape-only (FR-FOL-5)', () => {
      stubBox(...PORTRAIT);
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      const w = wrapper(container);
      const states: (string | null)[] = [];
      for (let altDeg = 80; altDeg >= -80; altDeg -= 5) {
        reading(aim(pass.peak.azDeg, altDeg));
        frame();
        settle(frame);
        states.push(w.getAttribute('data-ground'));
      }
      expect(states.filter((state, index) => state !== states[index - 1])).toEqual(['sky', 'ground', 'buried']);
      expect(screen.getByTestId('window-ground-note')).toHaveTextContent(en.window.buried);
      expect(container.querySelector('[data-ground-veil="buried"]')).not.toBeNull();
    });

    it('sweeps the ground states in landscape as R56 left them (FR-FOL-5)', () => {
      media = stubMatchMedia(...LANDSCAPE);
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      const w = wrapper(container);
      const states: (string | null)[] = [];
      for (let altDeg = 80; altDeg >= -80; altDeg -= 5) {
        reading(aim(pass.peak.azDeg, altDeg));
        frame();
        settle(frame);
        states.push(w.getAttribute('data-ground'));
      }
      expect(states.filter((state, index) => state !== states[index - 1])).toEqual(['sky', 'ground', 'buried']);
      expect(screen.getByTestId('window-ground-note')).toHaveTextContent(en.window.buried);
    });

    it('shows no [ point at the sky ] anywhere, and asks for nothing itself (FR-WIN-5 as amended v1.3.1, FR-FOL-2)', () => {
      media = stubMatchMedia(...LANDSCAPE);
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      const { container: onScreenBox } = render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      expect(within(onScreenBox).queryByTestId('window-gate')).toBeNull();
      expect(requestPermission).not.toHaveBeenCalled();

      // R66 (V13-8): off a screen either — the gate is gone with the saved view it guarded.
      const { container: page } = render(<SkyWindow fill passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      expect(within(page).queryByTestId('window-gate')).toBeNull();
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('carries no view control and no hint; the pass detail’s window carries both', () => {
      media = stubMatchMedia(...LANDSCAPE);
      const { container: onScreenBox } = render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} controls={viewControl} />);
      expect(within(onScreenBox).queryByTestId('view-control')).toBeNull();
      expect(within(onScreenBox).queryByText(en.window.hint)).toBeNull();

      const { container: page } = render(<SkyWindow fill passes={[pass]} observer={observer} highlightedPassId={pass.id} controls={viewControl} />);
      expect(within(page).getByTestId('view-control')).toBeInTheDocument();
      expect(within(page).getByText(en.window.hint)).toBeInTheDocument();
    });

    /** R79 (FR-GUT-6, US-28 AC4): one line over an empty field, never over a ground note, gone when a pass is in the field. */
    describe('the empty-field chip (FR-GUT-6)', () => {
      const before = pass.start.t - 60_000;
      // The golden pass is a short low arc in the north-east; facing west-south-west, nothing of it is in the field.
      const away = (pass.start.azDeg + 210) % 360;

      it('names the next pass, the shorter turn to where it rises and the countdown, and goes when the pass is in the field', () => {
        stubBox(...LANDSCAPE);
        const frame = scriptedFrames();
        render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} now={before} legendKeys={{ [pass.id]: 'A' }} />);
        reading(aim(pass.peak.azDeg, 20));
        frame();
        settle(frame);
        expect(screen.queryByTestId('window-chip')).toBeNull();

        reading(aim(away, 20));
        frame();
        settle(frame);
        const chip = screen.getByTestId('window-chip');
        expect(chip).toHaveAttribute('role', 'status');
        expect(chip.textContent).toMatch(/^Nothing in this part of the sky\. ISS \(Zarya\) is \d+° (left|right), up in 1:00\.$/);
        const [, angle, side] = /is (\d+)° (left|right)/.exec(chip.textContent ?? '') ?? [];
        const turn = turnTo(pass.start.azDeg, away);
        expect(side).toBe(turn.side);
        expect(Math.abs(Number(angle) - turn.angleDeg)).toBeLessThanOrEqual(1);
        // The gutter says the same thing: the pass is off the band, at the end the chip turns towards.
        expect(screen.getByTestId('compass-gutter').querySelector(`[data-edge="${turn.side}"]`)).toHaveTextContent('A');

        // Turning back brings the pass into the field, and the chip goes with no tap.
        reading(aim(pass.peak.azDeg, 20));
        frame();
        settle(frame);
        expect(screen.queryByTestId('window-chip')).toBeNull();
      });

      it('is never drawn over a ground note', () => {
        stubBox(...LANDSCAPE);
        const frame = scriptedFrames();
        render(<SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} now={before} />);
        reading(aim(away, -20));
        frame();
        settle(frame);
        expect(screen.getByTestId('window-ground-note')).toBeInTheDocument();
        expect(screen.queryByTestId('window-chip')).toBeNull();
      });

      it('names no direction with nothing in the span, and speaks Spanish', () => {
        stubBox(...LANDSCAPE);
        const { unmount } = render(<SkyWindow {...asScreen} fill passes={[]} observer={observer} highlightedPassId={null} now={before} />);
        expect(screen.getByTestId('window-chip')).toHaveTextContent(en.window.emptySky);
        unmount();
        render(
          <I18nProvider locale="es">
            <SkyWindow {...asScreen} fill passes={[pass]} observer={observer} highlightedPassId={pass.id} now={before} initialFacingAzDeg={away} />
          </I18nProvider>,
        );
        expect(screen.getByTestId('window-chip').textContent).toMatch(/^Nada en esta parte del cielo\. ISS \(Zarya\) está \d+° a la (izquierda|derecha), sale en 1:00\.$/);
      });

      it('is the screen’s: the pass detail’s window off a screen has none', () => {
        stubBox(...LANDSCAPE);
        render(<SkyWindow fill passes={[pass]} observer={observer} highlightedPassId={pass.id} now={before} initialFacingAzDeg={away} />);
        expect(screen.queryByTestId('window-chip')).toBeNull();
      });
    });

    it('leaves the window without `screen` drawing in portrait, as R47 built it', () => {
      media = stubMatchMedia(...PORTRAIT);
      stubBox(...PORTRAIT);
      const frame = scriptedFrames();
      const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} legend={legend} legendKeys={{ [pass.id]: 'A' }} />);
      reading(aim(pass.peak.azDeg, 20));
      frame();
      settle(frame);
      const w = wrapper(container);
      expect(w).not.toHaveAttribute('data-orientation');
      // FR-GUT-7 is the screen's: the pass detail's window is a box in a sheet, not the picture in the hand.
      expect(screen.queryByTestId('window-turn-advice')).toBeNull();
      expect(screen.queryByTestId('compass-gutter')).toBeNull();
      expect(paint(container)).toBeGreaterThan(0);
      expect(inView(container.querySelector('[data-marker="peak"]'))).toBe(true);
      expect(screen.getByTestId('window-readout')).toBeInTheDocument();
      expect(screen.getByTestId('window-legend')).toBeInTheDocument();
    });
  });
});

/**
 * R73 → R79: where the notes stand on a screen. Sideways the bottom of the box
 * is the compass gutter, `--gutter` over the drawing (FR-GUT-1), and the notes'
 * own place — `bottom: var(--row)` — is inside it, so on a sideways screen
 * they clear it by half a row. Upright the gutter is a row of its own under
 * the band and the box's bottom is free. jsdom applies none of this, so the
 * rule is read rather than measured, as `SkyScreen.test.tsx` reads the
 * layer's own two.
 */
/** A two-star field with one figure, in the catalogue's columns (D-748, D-749), as the stars page would hand it. */
const field: StarFieldData = {
  catalog: { ra: [88.8, 78.6], dec: [7.4, -8.2], mag: [0.5, 0.18], name: ['Betelgeuse', 'Rigel'], desig: ['α Ori', 'β Ori'], con: ['Ori', 'Ori'], figures: [{ con: 'Ori', part: '', segments: [[0, 1]] }] },
  positions: { altDeg: [40, 30], azDeg: [180, 190], planets: [{ body: 'Jupiter', azDeg: 200, altDeg: 50, mag: -2.3 }] },
  layers: { stars: true, figures: true, planets: true, names: false },
};

/** Where `uprightRotation(az, alt)` looks, rounded as the wrapper's attributes are. */
const looks = (azDeg: number, altDeg: number): { az: string; alt: string } => {
  const look = projection.lookDirection(projection.uprightRotation(azDeg, altDeg));
  return { az: String(quantiseAz(look.azDeg)), alt: String(Math.round(look.altDeg)) };
};
const quantiseAz = (azDeg: number): number => Math.round(azDeg) % 360;
const expectLook = (w: Element, azDeg: number, altDeg: number): void => {
  const at = looks(azDeg, altDeg);
  expect(w).toHaveAttribute('data-look-az', at.az);
  expect(w).toHaveAttribute('data-look-alt', at.alt);
};

describe('the hand camera and the rotation channel (FR-STAR-4, FR-STAR-9, FR-STAR-11; D-750, D-751)', () => {
  beforeEach(() => {
    resetOrientationAccess();
    withPhone();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  it('a hand camera drives the window: the box is focusable, the readout is the one line, the sensor is never armed', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    expect(w).toHaveAttribute('data-state', 'hand');
    expectLook(w, 180, 35);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.querySelector('[data-drawing="window"]')).not.toBeNull();
    const readout = screen.getByTestId('window-readout');
    expect(readout).toHaveTextContent('Facing S (180°) · up 35°');
    expect(box).toHaveAttribute('aria-describedby', readout.id);
    // D-757: the hand points at true bearings; there is no declination line, no waiting note and no "hold the phone up" hint.
    expect(screen.queryByTestId('window-heading')).toBeNull();
    expect(screen.queryByTestId('window-note')).toBeNull();
    expect(container.textContent).not.toContain(en.window.hint);
    // The phone's sensor is present (`withPhone`) and would arm itself on mount under the sensor camera; under the hand it is not listening.
    reading(aim(90, 0));
    frame();
    settle(frame);
    expect(w).toHaveAttribute('data-state', 'hand');
    expectLook(w, 180, 35);
  });

  it('a pointer drag moves the camera at 4 px per degree, captured, one move per animation frame', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const moves = vi.fn();
    camera.subscribe(moves);
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    const capture = vi.fn();
    box.setPointerCapture = capture;
    box.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(box, { button: 0, pointerId: 7, clientX: 100, clientY: 100 });
    expect(capture).toHaveBeenCalledWith(7);
    expect(box).toHaveAttribute('data-dragging', 'true');
    // Two moves before the frame fold into one camera move: 40 px right and 20 px down together.
    fireEvent.pointerMove(box, { pointerId: 7, clientX: 120, clientY: 110 });
    fireEvent.pointerMove(box, { pointerId: 7, clientX: 140, clientY: 120 });
    expect(moves).not.toHaveBeenCalled();
    expectLook(w, 180, 35);
    frame();
    expect(moves).toHaveBeenCalledTimes(1);
    expect(camera.get()).toEqual({ azDeg: 170, altDeg: 40, fovDeg: projection.WINDOW_FOV });
    expectLook(w, 170, 40);
    // Another pointer's move is not this drag's.
    fireEvent.pointerMove(box, { pointerId: 8, clientX: 0, clientY: 0 });
    frame();
    expect(moves).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(box, { pointerId: 7, clientX: 140, clientY: 120 });
    expect(box).toHaveAttribute('data-dragging', 'false');
    // After the pointer is up a move is nothing.
    fireEvent.pointerMove(box, { pointerId: 7, clientX: 200, clientY: 200 });
    frame();
    expect(moves).toHaveBeenCalledTimes(1);
    expect(camera.get()).toEqual({ azDeg: 170, altDeg: 40, fovDeg: projection.WINDOW_FOV });
    // The readout follows the rotation `uprightRotation` gives for the hand.
    expect(screen.getByTestId('window-readout')).toHaveTextContent('Facing S (170°) · up 40°');
  });

  it('a lost capture ends the drag, and a later move of that pointer is nothing', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    box.setPointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 140, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 170, altDeg: 35, fovDeg: projection.WINDOW_FOV });
    // Capture lost with no up or cancel: the drag is over, and a later move of that pointer is nothing.
    fireEvent.lostPointerCapture(box, { pointerId: 1 });
    expect(box).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 200, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 170, altDeg: 35, fovDeg: projection.WINDOW_FOV });
  });

  /**
   * R125 (FR-SKY-14; D-798, D-821): the pinch. Two pointers are the zoom and not a drag: the second finger ends
   * the drag where it is, the field scales by the inverse of the change in the two fingers' distance — one
   * update per frame, about the centre, the aim untouched — and the finger left on the box after the pinch does
   * not take up the drag.
   */
  it('a second finger makes the pinch: fingers apart narrow the field, together widen it, one update per frame, the aim untouched', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const moves = vi.fn();
    camera.subscribe(moves);
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    const capture = vi.fn();
    box.setPointerCapture = capture;
    box.releasePointerCapture = vi.fn();
    expect(w).toHaveAttribute('data-fov', '60');
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 120, clientY: 100 });
    expect(box).toHaveAttribute('data-dragging', 'true');
    // The second finger, 100 px from the first: both captured, the drag over and its 20 px dropped.
    fireEvent.pointerDown(box, { button: 0, pointerId: 2, pointerType: 'touch', clientX: 220, clientY: 100 });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(box).toHaveAttribute('data-dragging', 'false');
    frame();
    expect(moves).not.toHaveBeenCalled();
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 35, fovDeg: 60 });
    // Apart to 200 px: the field halves to 30°, in the one frame, whichever finger moved and however many moves.
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 270, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 70, clientY: 100 });
    expect(moves).not.toHaveBeenCalled();
    frame();
    expect(moves).toHaveBeenCalledTimes(1);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 35, fovDeg: 30 });
    expect(w).toHaveAttribute('data-fov', '30');
    expectLook(w, 180, 35);
    // Together to 50 px: four times wider, held at the range's end.
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 220, clientY: 100 });
    frame();
    expect(camera.get().fovDeg).toBe(projection.WINDOW_FOV_MAX_DEG);
    expect(w).toHaveAttribute('data-fov', '90');
    // A third finger is nothing.
    fireEvent.pointerDown(box, { button: 0, pointerId: 3, pointerType: 'touch', clientX: 0, clientY: 0 });
    fireEvent.pointerMove(box, { pointerId: 3, clientX: 300, clientY: 300 });
    frame();
    expect(camera.get().fovDeg).toBe(projection.WINDOW_FOV_MAX_DEG);
    fireEvent.pointerUp(box, { pointerId: 3, clientX: 300, clientY: 300 });
    // One finger lifts: the pinch is over, and the finger left does not drag from where it now is.
    fireEvent.pointerUp(box, { pointerId: 2, clientX: 220, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 300, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 35, fovDeg: projection.WINDOW_FOV_MAX_DEG });
    expect(box).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerUp(box, { pointerId: 1, clientX: 300, clientY: 100 });
    // Lifted, a new finger drags again, at the dome's rate whatever the field.
    fireEvent.pointerDown(box, { button: 0, pointerId: 4, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 4, clientX: 140, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 170, altDeg: 35, fovDeg: projection.WINDOW_FOV_MAX_DEG });
  });

  /** R125 review: two fingers that land on one point pinch from where they first part. */
  it('a pinch that starts at no distance zooms from where the fingers first part', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    box.setPointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerDown(box, { button: 0, pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 100 });
    // Apart to 50 px: the pinch's start, no zoom yet; then to 100 px, which halves the field.
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 150, clientY: 100 });
    frame();
    expect(camera.get().fovDeg).toBe(60);
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 200, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 35, fovDeg: 30 });
  });

  /**
   * R125 review: a pointer the box could not capture and whose up never reached it (lifted outside) is forgotten —
   * when it leaves the box, and in any case when a new primary pointer of its type lands — so the next one-finger
   * touch drags instead of pinching with a ghost.
   */
  it('forgets a finger whose up never reached the box, so the next touch drags', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    box.setPointerCapture = vi.fn(() => {
      throw new Error('no capture');
    });
    box.releasePointerCapture = vi.fn();
    box.hasPointerCapture = vi.fn(() => false);
    // Left the box with no up: gone.
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerLeave(box, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 100 });
    expect(box).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerDown(box, { button: 0, pointerId: 2, pointerType: 'touch', isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 140, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 170, altDeg: 35, fovDeg: 60 });
    // No up and no leave reached the box: the next primary touch says every earlier one has lifted.
    fireEvent.pointerDown(box, { button: 0, pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 3, clientX: 140, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 160, altDeg: 35, fovDeg: 60 });
    expect(box).toHaveAttribute('data-dragging', 'true');
    // A second finger of the same touch (not primary) still makes the pinch.
    fireEvent.pointerDown(box, { button: 0, pointerId: 4, pointerType: 'touch', isPrimary: false, clientX: 240, clientY: 100 });
    expect(box).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerMove(box, { pointerId: 4, clientX: 340, clientY: 100 });
    frame();
    expect(camera.get()).toEqual({ azDeg: 160, altDeg: 35, fovDeg: 30 });
  });

  /** R125 (FR-SKY-14): ctrl + wheel at `ZOOM_WHEEL_RATE`, taken from the browser; a plain wheel left to it. */
  it('ctrl + wheel scales the field by exp(deltaY × 0.002) and is prevented; a plain wheel is neither', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    // A plain wheel scrolls the page: not prevented, and the field unchanged.
    expect(fireEvent.wheel(box, { deltaY: 100 })).toBe(true);
    frame();
    expect(camera.get().fovDeg).toBe(60);
    // One mouse notch down with ctrl: about a fifth wider, prevented, applied on the frame.
    expect(fireEvent.wheel(box, { deltaY: 100, ctrlKey: true })).toBe(false);
    expect(camera.get().fovDeg).toBe(60);
    frame();
    expect(camera.get().fovDeg).toBeCloseTo(60 * Math.exp(0.2), 6);
    expect(w).toHaveAttribute('data-fov', '73');
    // Two notches up in one frame fold into one zoom: exp(−0.4) of that.
    fireEvent.wheel(box, { deltaY: -100, ctrlKey: true });
    fireEvent.wheel(box, { deltaY: -100, ctrlKey: true });
    frame();
    expect(camera.get().fovDeg).toBeCloseTo(60 * Math.exp(-0.2), 6);
    // The aim is untouched by any of it.
    expectLook(w, 180, 35);
  });

  /** R125 (FR-SKY-14): `+`/`=`/`-` at `ZOOM_KEY_FACTOR` and `0`, box keys beside the arrows; with a modifier the press is the browser's. */
  it('+ and = narrow the field by 1.25, − widens it, 0 restores 60°, while the box has focus; ctrl + + is left to the browser', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    expect(fireEvent.keyDown(box, { key: '+' })).toBe(false);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 35, fovDeg: 48 });
    fireEvent.keyDown(box, { key: '=' });
    fireEvent.keyDown(box, { key: '+' });
    // Three narrowings from 60°: 30.72°, which the readout rounds to 30° and `data-fov` to 31.
    expect(camera.get().fovDeg).toBeCloseTo(30.72, 6);
    expect(w).toHaveAttribute('data-fov', '31');
    expectLook(w, 180, 35);
    fireEvent.keyDown(box, { key: '-' });
    expect(camera.get().fovDeg).toBeCloseTo(38.4, 6);
    expect(fireEvent.keyDown(box, { key: '0' })).toBe(false);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 35, fovDeg: 60 });
    expect(w).toHaveAttribute('data-fov', '60');
    // To the ends: `-` twice from 60° is 93.75°, held at 90°; many `+` hold at 20°.
    fireEvent.keyDown(box, { key: '-' });
    fireEvent.keyDown(box, { key: '-' });
    expect(camera.get().fovDeg).toBe(projection.WINDOW_FOV_MAX_DEG);
    for (let i = 0; i < 12; i += 1) fireEvent.keyDown(box, { key: '+' });
    expect(camera.get().fovDeg).toBe(projection.WINDOW_FOV_MIN_DEG);
    // The browser's own ctrl + `+` (and cmd on a Mac) is not the box's: not prevented, and nothing moves.
    expect(fireEvent.keyDown(box, { key: '+', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(box, { key: '0', metaKey: true })).toBe(true);
    expect(camera.get().fovDeg).toBe(projection.WINDOW_FOV_MIN_DEG);
    // The arrows still step at any field, and with a modifier too: only the zoom keys are the browser's with ctrl or cmd.
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: 35, fovDeg: projection.WINDOW_FOV_MIN_DEG });
    expect(fireEvent.keyDown(box, { key: 'ArrowRight', ctrlKey: true })).toBe(false);
    fireEvent.keyDown(box, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyDown(box, { key: 'ArrowLeft', altKey: true });
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: 40, fovDeg: projection.WINDOW_FOV_MIN_DEG });
  });

  /** R125 review (FR-SKY-14): in and back out by the same amount is the default field again, so the readout names none. */
  it('ctrl + wheel in and back out lands on 60° exactly, and the readout draws no field', () => {
    const frame = scriptedFrames();
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    for (const deltaY of [-70, -70, 70, 70]) {
      fireEvent.wheel(box, { deltaY, ctrlKey: true });
      frame();
    }
    expect(camera.get().fovDeg).toBe(projection.WINDOW_FOV);
    expect(screen.getByTestId('window-readout')).toHaveTextContent(/^Facing S \(180°\) · up 35°$/);
  });

  /**
   * R125 (FR-SKY-14, FR-GUT-3 as amended, FR-FOL-5): what the field feeds follows it — the readout's suffix, the
   * projection's scale (the same star further from the centre zoomed in), and the ground thresholds. The suffix is
   * R123's `window.field` (D-822): ` · field 30°`, rounded to 5°.
   */
  it('zooming scales the drawing about the centre, moves the ground threshold, and names the field in the readout', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    const readout = screen.getByTestId('window-readout');
    const zenithX = (): number => Number(/translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(container.querySelector('[data-marker="zenith"]')?.getAttribute('transform') ?? '')?.[2]);
    const atDefault = zenithX();
    // Zoomed: the readout names the field, rounded to 5°, and the root carries it in whole degrees.
    fireEvent.keyDown(box, { key: '+' });
    fireEvent.keyDown(box, { key: '+' });
    fireEvent.keyDown(box, { key: '+' });
    expect(readout).toHaveTextContent(/^Facing S \(180°\) · up 35° · field 30°$/);
    expect(w).toHaveAttribute('data-fov', '31');
    // The zenith, 55° above the centre, is further up the drawing at 30° than at 60° (and off the box: the drawing is 390 px).
    expect(zenithX()).toBeLessThan(atDefault);
    // Pointed at the ground as far as the hand goes (−10°): sky still in a 30° field, none at all in a 20° one, whose top edge is the horizon.
    act(() => {
      camera.stepPitch(-10);
    });
    expect(camera.get().altDeg).toBe(-10);
    expect(w).toHaveAttribute('data-ground', 'ground');
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(box, { key: '+' });
    expect(camera.get().fovDeg).toBe(projection.WINDOW_FOV_MIN_DEG);
    expect(w).toHaveAttribute('data-ground', 'buried');
    fireEvent.keyDown(box, { key: '0' });
    expect(w).toHaveAttribute('data-ground', 'ground');
    // The suffix, rounded to 5°, and none at the default field.
    act(() => {
      camera.up();
    });
    fireEvent.keyDown(box, { key: '+' });
    expect(readout).toHaveTextContent(/^Facing S \(180°\) · up 90° · field 50°$/);
    fireEvent.keyDown(box, { key: '+' });
    fireEvent.keyDown(box, { key: '+' });
    expect(readout).toHaveTextContent(/^Facing S \(180°\) · up 90° · field 30°$/);
    fireEvent.keyDown(box, { key: '0' });
    expect(readout).toHaveTextContent(/^Facing S \(180°\) · up 90°$/);
  });

  /** R123 (FR-SKY-14, D-822): the readout's field suffix is the catalog's, in Spanish too. */
  it('names the zoomed field in Spanish', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(
      <I18nProvider locale="es">
        <SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />
      </I18nProvider>,
    );
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    // FR-FLOW-5 (D-847): the dome's first word, "Hacia el".
    expect(screen.getByTestId('window-readout')).toHaveTextContent(/^Hacia el S \(180°\) · 35° de altura$/);
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(box, { key: '+' });
    expect(screen.getByTestId('window-readout')).toHaveTextContent(/^Hacia el S \(180°\) · 35° de altura · campo 30°$/);
    fireEvent.keyDown(box, { key: '0' });
    expect(screen.getByTestId('window-readout')).not.toHaveTextContent(/campo/);
  });

  /** R125 (FR-SKY-14): under the sensor — the screen — the pinch is the window's own field state, `WINDOW_FOV` at every mount. */
  it('under the sensor the pinch zooms the window’s own field, which every mount opens at 60°', () => {
    const frame = scriptedFrames();
    const { container, unmount } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const w = wrapper(container);
    reading(aim(90, 0));
    frame();
    settle(frame);
    expect(w).toHaveAttribute('data-state', 'on');
    expect(w).toHaveAttribute('data-fov', '60');
    const box = container.querySelector('[data-drawing="window"]')?.parentElement as HTMLElement;
    expect(box).not.toHaveAttribute('tabindex');
    box.setPointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
    // The sensor's aim (east, corrected to true north by the observer's declination, R44) is what the pinch must leave alone.
    const sensed = { az: w.getAttribute('data-look-az'), alt: w.getAttribute('data-look-alt') };
    expect(sensed.alt).toBe('0');
    // One finger under the sensor drags nothing; two pinch.
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 140, clientY: 100 });
    frame();
    expect(w).toHaveAttribute('data-look-az', sensed.az ?? '');
    expect(box).not.toHaveAttribute('data-dragging');
    fireEvent.pointerDown(box, { button: 0, pointerId: 2, pointerType: 'touch', clientX: 240, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 340, clientY: 100 });
    frame();
    expect(w).toHaveAttribute('data-fov', '30');
    expect(w).toHaveAttribute('data-look-az', sensed.az ?? '');
    expect(w).toHaveAttribute('data-look-alt', '0');
    // The sensor keeps driving the aim under the zoom.
    fireEvent.pointerUp(box, { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(box, { pointerId: 2, clientX: 340, clientY: 100 });
    reading(aim(120, 10));
    frame();
    settle(frame);
    expect(w).toHaveAttribute('data-look-alt', '10');
    expect(Number(w.getAttribute('data-look-az'))).toBeGreaterThan(Number(sensed.az) + 20);
    expect(w).toHaveAttribute('data-fov', '30');
    // Never saved: a new mount is at the default.
    unmount();
    const again = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(wrapper(again.container)).toHaveAttribute('data-fov', '60');
  });

  /** R125 review: the sensor's box takes the pointers for the pinch, and the desk's hover label stays the hand's. */
  it('under the sensor a mouse over a mark shows no label; under the hand it does', () => {
    const frame = scriptedFrames();
    const star = (azDeg: number, altDeg: number): StarFieldData => ({
      catalog: { ra: [0], dec: [0], mag: [-0.7], name: ['Canopus'], desig: ['α Car'], con: ['Car'], figures: [] },
      positions: { altDeg: [altDeg], azDeg: [azDeg], planets: [] },
      layers: { stars: true, figures: false, planets: false, names: true },
    });
    const { container, rerender } = render(<SkyWindow passes={[]} observer={observer} highlightedPassId={null} scene={{ stars: star(0, -80) }} />);
    const w = wrapper(container);
    reading(aim(90, 20));
    frame();
    settle(frame);
    expect(w).toHaveAttribute('data-state', 'on');
    // The star where the sensor looks, so it is drawn at the drawing's centre, under the pointer.
    rerender(<SkyWindow passes={[]} observer={observer} highlightedPassId={null} scene={{ stars: star(Number(w.getAttribute('data-look-az')), Number(w.getAttribute('data-look-alt'))) }} />);
    settle(frame);
    const box = container.querySelector('[data-drawing="window"]')?.parentElement as HTMLElement;
    const label = (): Element | null => container.querySelector('[data-star-label]');
    fireEvent.pointerMove(box, { pointerType: 'mouse', pointerId: 1, clientX: 195, clientY: 195 });
    expect(label()).not.toHaveAttribute('visibility', 'visible');
    // The same mark under the hand is labelled by the hover.
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    rerender(<SkyWindow passes={[]} observer={observer} highlightedPassId={null} camera={camera} scene={{ stars: star(180, 35) }} />);
    const handBox = container.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.pointerMove(handBox, { pointerType: 'mouse', pointerId: 1, clientX: 195, clientY: 195 });
    expect(label()).toHaveAttribute('visibility', 'visible');
  });

  it('the arrow keys step the camera by 15° and 5° while the box has focus, inside the page’s tilt range', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(box, { key: 'ArrowLeft' });
    expect(camera.get()).toEqual({ azDeg: 165, altDeg: 35, fovDeg: projection.WINDOW_FOV });
    expectLook(w, 165, 35);
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: 35, fovDeg: projection.WINDOW_FOV });
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: 40, fovDeg: projection.WINDOW_FOV });
    expectLook(w, 195, 40);
    for (let i = 0; i < 12; i += 1) fireEvent.keyDown(box, { key: 'ArrowDown' });
    // 40 − 60 would be −20: the clamp holds at −10, and the field is pointed at the ground with sky still in it (FR-FOL-5).
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: -10, fovDeg: projection.WINDOW_FOV });
    expectLook(w, 195, -10);
    expect(w).toHaveAttribute('data-ground', 'ground');
    expect(screen.getByTestId('window-ground-note')).toHaveTextContent(en.window.ground);
    for (let i = 0; i < 25; i += 1) fireEvent.keyDown(box, { key: 'ArrowUp' });
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: 90, fovDeg: projection.WINDOW_FOV });
    expect(w).toHaveAttribute('data-ground', 'sky');
    // A key that is not an arrow is left alone.
    const other = fireEvent.keyDown(box, { key: 'a' });
    expect(other).toBe(true);
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: 90, fovDeg: projection.WINDOW_FOV });
  });

  it('the page’s picker reaches the window through the same store: `face` and `up` turn the picture', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    const w = wrapper(container);
    act(() => {
      camera.face('NE');
    });
    expectLook(w, 45, 35);
    expect(screen.getByTestId('window-readout')).toHaveTextContent('Facing NE (45°) · up 35°');
    act(() => {
      camera.up();
    });
    expectLook(w, 45, 90);
  });

  it('the star field group is mounted only when the scene carries stars, stays mounted across the ground states, and is written once per published rotation without re-rendering', () => {
    const memoed = StarField as unknown as { type: (props: unknown) => unknown };
    const renderImpl = memoed.type;
    const renders = vi.fn(renderImpl);
    memoed.type = renders;
    onTestFinished(() => {
      memoed.type = renderImpl;
    });
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const noScene = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} />);
    expect(noScene.container.querySelector('[data-layer="stars"]')).toBeNull();
    noScene.unmount();
    const noStars = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: null }} />);
    expect(noStars.container.querySelector('[data-layer="stars"]')).toBeNull();
    noStars.unmount();
    expect(renders).not.toHaveBeenCalled();

    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: field }} />);
    const group = container.querySelector('[data-layer="stars"]') as SVGGElement;
    expect(group).not.toBeNull();
    expect(group).toHaveAttribute('data-stars', '2');
    expect(group).toHaveAttribute('data-planets', '1');
    // R114 (D-754): the clip, the ground, the figures, the marks and the planets, in that order; R116 the names and the label over them; R127 the landmark's ring over the marks and its name before the label. What they draw is `SkyWindow.stars.test.tsx`'s.
    expect([...group.children].map((child) => child.tagName)).toEqual(['defs', 'path', 'g', 'g', 'g', 'circle', 'g', 'text', 'text']);
    // Under the horizon and the rings: the group comes before the grid in the tree.
    const grid = container.querySelector('[data-horizon]') as Element;
    expect(group.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(renders).toHaveBeenCalledTimes(1);
    // The mount's publish reached it: the one write, the group's visibility for this rotation.
    expect(group).toHaveAttribute('visibility', 'visible');
    const writes = vi.spyOn(group, 'setAttribute');
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(writes).toHaveBeenCalledTimes(5);
    for (const call of writes.mock.calls) expect(call).toEqual(['visibility', 'visible']);
    // Pointed at the ground with sky still in the field: visible; the group is still the same node.
    for (let i = 0; i < 9; i += 1) fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(camera.get().altDeg).toBe(-10);
    expect(wrapper(container)).toHaveAttribute('data-ground', 'ground');
    expect(container.querySelector('[data-layer="stars"]')).toBe(group);
    expect(writes).toHaveBeenCalledTimes(14);
    // A key at the clamp changes no rotation and publishes nothing.
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(writes).toHaveBeenCalledTimes(14);
    // Fourteen rotations drawn, and the window re-rendered for each; the field did not.
    expect(renders).toHaveBeenCalledTimes(1);
  });

  it('under the sensor, a window given a scene with no stars is the same DOM as one given none, and `SENSOR_CAMERA` is the default', () => {
    const plain = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} legendKeys={{ [pass.id]: 'A' }} />);
    const html = plain.container.innerHTML;
    plain.unmount();
    const withScene = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} legendKeys={{ [pass.id]: 'A' }} scene={{ stars: null }} camera={SENSOR_CAMERA} />);
    expect(withScene.container.innerHTML).toBe(html);
    expect(wrapper(withScene.container)).toHaveAttribute('data-state', 'idle');
    expect(withScene.container.querySelector('[tabindex]')).toBeNull();
  });
});

describe('the notes clear the gutter on a screen (FR-GUT-1, FR-GUT-6, FR-FOL-5)', () => {
  it('stands the chip and the ground note above the gutter sideways, and at their own place otherwise', () => {
    const css = readFileSync(join(process.cwd(), 'src/ui/components/guide/skychart/window/SkyWindow.module.css'), 'utf8');
    expect(css).toMatch(/\.groundNote,\s*\.chip \{\s*bottom: var\(--row\);/);
    expect(css).toMatch(
      /\.window\[data-screen='true'\]\[data-orientation='landscape'\] \.groundNote,\s*\.window\[data-screen='true'\]\[data-orientation='landscape'\] \.chip \{\s*bottom: calc\(var\(--gutter\) \+ var\(--row\) \/ 2\);/,
    );
    expect(css).not.toContain('.turnNote');
  });
});

/**
 * R137 (FR-FLOW-14 as amended, V26-16; D-883): a cold load of `#live` draws the window before the worker's
 * passes. It opens at the pole side, turns once to the pass when they arrive, and never turns a camera the
 * reader has moved, nor again on a later pass update.
 */
describe('the turn when the passes arrive (FR-FLOW-14 as amended, D-883)', () => {
  beforeEach(() => {
    resetOrientationAccess();
    withPhone();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  type Camera = ReturnType<typeof createHandCamera>;
  const slot = () => {
    let kept: Camera | null = null;
    return {
      get: () => kept,
      keep: (camera: Camera) => {
        kept = camera;
      },
      gesture: vi.fn(),
    };
  };
  const now = pass.start.t - 60_000;
  const later = { ...pass, id: `${pass.id}-later`, start: { ...pass.start, t: pass.start.t + 3_600_000 } };
  const keys = { [pass.id]: 'A', [later.id]: 'B' };
  const view = (hand: ReturnType<typeof slot>, passes: (typeof pass)[], id: string | null) => (
    <SkyWindow passes={passes} observer={observer} highlightedPassId={null} facingPassId={id} now={now} legendKeys={passes.length === 0 ? {} : keys} hand={hand} />
  );

  for (const [locale, following, facing] of [
    ['en', 'Following A', 'Facing S (180°) · up 35°'],
    ['es', 'Siguiendo A', 'Hacia el S (180°) · 35° de altura'],
  ] as const) {
    it(`mounted with no passes it faces the pole side, then follows the highlighted pass once they arrive (${locale})`, () => {
      const hand = slot();
      const { rerender } = render(<I18nProvider locale={locale}>{view(hand, [], null)}</I18nProvider>);
      expect(screen.getByTestId('window-readout')).toHaveTextContent(facing);
      expect(screen.getByTestId('window-readout')).not.toHaveTextContent(following);
      rerender(<I18nProvider locale={locale}>{view(hand, [pass], pass.id)}</I18nProvider>);
      expect(screen.getByTestId('window-readout')).toHaveTextContent(following);
      expect(hand.get()?.get().follow).toBe(pass.id);
    });
  }

  it('a camera moved before the passes arrive keeps its facing', () => {
    const hand = slot();
    const { container, rerender } = render(view(hand, [], null));
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(box, { key: 'ArrowLeft' });
    const moved = hand.get()?.get();
    const readout = screen.getByTestId('window-readout').textContent;
    rerender(view(hand, [pass], pass.id));
    expect(hand.get()?.get()).toEqual(moved);
    expect(screen.getByTestId('window-readout').textContent).toBe(readout);
    expect(screen.getByTestId('window-readout')).not.toHaveTextContent('Following');
  });

  it('with the highlighted pass not offered yet (no arc, no key) it faces the next rise and does not follow', () => {
    const hand = slot();
    const quiet = (passes: (typeof pass)[], id: string | null) => (
      <SkyWindow passes={passes} observer={observer} highlightedPassId={null} facingPassId={id} now={now} legendKeys={{}} hand={hand} />
    );
    const { rerender } = render(quiet([], null));
    rerender(quiet([pass], pass.id));
    expect(hand.get()?.get().follow).toBeUndefined();
    expect(screen.getByTestId('window-readout')).not.toHaveTextContent('Following');
    expect(hand.get()?.get().azDeg).toBeCloseTo(pass.start.azDeg, 0);
  });

  it('with no highlighted pass it turns to the next rise', () => {
    const hand = slot();
    const { rerender } = render(view(hand, [], null));
    rerender(view(hand, [pass], null));
    expect(hand.get()?.get().follow).toBeUndefined();
    expect(hand.get()?.get().azDeg).toBeCloseTo(pass.start.azDeg, 0);
  });

  it('a camera kept in the slot and remounted before the passes arrive still turns', () => {
    const hand = slot();
    const first = render(view(hand, [], null));
    first.unmount();
    const { rerender } = render(view(hand, [], null));
    rerender(view(hand, [pass], pass.id));
    expect(screen.getByTestId('window-readout')).toHaveTextContent('Following A');
  });

  it('turns at most once: after the turn and a move, later pass updates leave the camera where the reader put it', () => {
    const hand = slot();
    const { container, rerender } = render(view(hand, [], null));
    rerender(view(hand, [pass], pass.id));
    expect(screen.getByTestId('window-readout')).toHaveTextContent('Following A');
    // A key step ends the following (D-797); the camera is now the reader's.
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(box, { key: 'ArrowLeft' });
    const moved = hand.get()?.get();
    expect(moved?.follow).toBeUndefined();
    rerender(view(hand, [pass, later], later.id));
    rerender(view(hand, [later, pass], pass.id));
    expect(hand.get()?.get()).toEqual(moved);
    expect(screen.getByTestId('window-readout')).not.toHaveTextContent('Following');
  });
});
