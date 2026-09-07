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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../../../tests/support/moonFixtures';
import { en } from '../../../../../i18n/en';
import { es } from '../../../../../i18n/es';
import { I18nProvider } from '../../../../../i18n/useT';
import type { Observer } from '../../../../../model';
import { appStore } from '../../../../../state';
import { SkyChart } from '../SkyChart';
import type { HiddenMarker } from '../SkyChart.types';
import { resetOrientationAccess } from './orientationAccess';
import { placeholderAltDeg, SkyWindow } from './SkyWindow';

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
    expect(readout).toHaveTextContent(`Looking N (${String(trueAz(0))}°) · up 0°`);
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
    expect(readout).toHaveTextContent(`Looking E (${String(trueAz(90))}°) · up 30°`);
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

  describe('the gate and the notes (FR-WIN-4, FR-WIN-5)', () => {
    it('shows [ point at the sky ] in the window where a tap is needed, asks on the tap only, and draws once granted', async () => {
      const frame = scriptedFrames();
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      const gate = screen.getByTestId('window-gate');
      expect(gate).toHaveTextContent(en.window.pointAtSky);
      expect(container.querySelector('[data-testid="chart-box"]')).toContainElement(gate);
      expect(requestPermission).not.toHaveBeenCalled();
      expect(screen.queryByTestId('window-note')).toBeNull();
      // The picture is there behind the control, and a reading before the tap changes nothing.
      reading(aim(0, 0));
      frame();
      expect(wrapper(container)).toHaveAttribute('data-state', 'idle');

      fireEvent.click(gate);
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('window-gate')).toBeNull();
      expect(screen.getByTestId('window-note')).toHaveTextContent(en.window.waiting);
      await flush();
      reading(aim(0, 0));
      frame();
      expect(wrapper(container)).toHaveAttribute('data-state', 'on');
      expect(screen.queryByTestId('window-gate')).toBeNull();
    });

    it('through SkyChart: a refusal leaves the dome as the view with the note, and the option stays; a compass-less phone loses it', async () => {
      const frame = scriptedFrames();
      withPhone(() => Promise.resolve('denied'));
      appStore.getState().setChartView('window');
      render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      const figure = screen.getByRole('figure');
      expect(figure).toHaveAttribute('data-view', 'window');
      fireEvent.click(await screen.findByTestId('window-gate'));
      await waitFor(() => {
        expect(figure).toHaveAttribute('data-view', 'dome');
      });
      expect(screen.getByTestId('chart-view-note')).toHaveTextContent(en.window.denied);
      expect(appStore.getState().chartView).toBe('dome');
      // R58 review (D-277, FR-WIN-5 as amended): the refusal ends the view, it does not rewrite the preference — this
      // reader saved the window, and R59's follow control opens it over whatever they saved on top of that.
      expect(appStore.getState().savedChartView).toBe('window');
      expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ chartView: 'window' });
      const toggle = screen.getByRole('group', { name: 'Chart view' });
      expect(within(toggle).getByRole('button', { name: 'Window' })).toBeInTheDocument();
      // Choosing another view clears the note.
      fireEvent.click(within(toggle).getByRole('button', { name: 'Polar' }));
      expect(screen.queryByTestId('chart-view-note')).toBeNull();

      // A phone with no north in its readings: the note, the dome, and no window option for the session.
      withPhone();
      resetOrientationAccess();
      fireEvent.click(within(toggle).getByRole('button', { name: 'Window' }));
      await screen.findByTestId('window-note');
      reading({ alpha: 30, beta: 90, absolute: false });
      frame();
      expect(figure).toHaveAttribute('data-view', 'dome');
      expect(screen.getByTestId('chart-view-note')).toHaveTextContent(en.window.relative);
      expect(within(screen.getByRole('group', { name: 'Chart view' })).queryByRole('button', { name: 'Window' })).toBeNull();
    });

    it('asks for the permission inside the tap that chooses the view (FR-WIN-4), before the window mounts', async () => {
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      appStore.getState().setChartView('dome');
      render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      expect(requestPermission).not.toHaveBeenCalled();
      fireEvent.click(within(screen.getByRole('group', { name: 'Chart view' })).getByRole('button', { name: 'Window' }));
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'window');
      await flush();
      await screen.findByTestId('window-note');
      // Granted from the toggle's tap: no gate, the window waits for its first reading.
      expect(screen.queryByTestId('window-gate')).toBeNull();
      expect(requestPermission).toHaveBeenCalledTimes(1);
    });
  });
});
