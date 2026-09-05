/**
 * R32 (FR-LIVE-1, FR-LIVE-2, FR-LIVE-3, FR-LIVE-9, FR-LIVE-10): the live page
 * in jsdom, on the polar view (the dome's raster needs a real layout, and both
 * views implement the same props — the contract test holds them to it).
 *
 *   - the window: passes overlapping now … now + 24 h are drawn, in series
 *     colours by pass order, and nothing else is;
 *   - the marker and the count agree: one marker per pass containing `t`,
 *     and the strip's count is that number (D-160);
 *   - the instant: real time on the tick, or the link's `t`;
 *   - the strip's Sun-derived fields fill in once the astronomy chunk lands;
 *   - the share action builds the `#live?…` form (FR-SHARE-1);
 *   - the two inert states, and the two ways back.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { en } from '../../i18n/en';
import { isoInstant } from '../../lib/shareLinks';
import { skyBodiesAt } from '../../lib/skyBodies';
import type { Observer, Pass } from '../../model';
import type { NowItem, NowState } from '../../model';
import { appStore, setLiveNowClient, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { MOON_FIXTURE } from '../../../tests/support/moonFixtures';
import { LIVE_WINDOW_MS, LivePage, livePasses, TICK_MS, visibleCount } from './Live';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const HOUR = 3_600_000;

const shifted = (id: string, name: string, byMs: number): Pass => ({
  ...pass,
  id,
  name,
  start: { ...pass.start, t: pass.start.t + byMs },
  peak: { ...pass.peak, t: pass.peak.t + byMs },
  end: { ...pass.end, t: pass.end.t + byMs },
  track: pass.track.map((p) => ({ ...p, t: p.t + byMs })),
});
/** Later tonight, tomorrow just inside the window, one just past it, and one already over. */
const later = shifted('later', 'Tiangong', 3 * HOUR);
const tomorrow = shifted('tomorrow', 'Hubble', 23 * HOUR);
const beyond = shifted('beyond', 'Envisat', 25 * HOUR);
const over = shifted('over', 'Cosmos', -HOUR);
const all = [over, pass, later, tomorrow, beyond];

/** Ten seconds into the golden pass: the ISS is up and nothing else is. */
const T = pass.start.t + 10_000;

const withSky = (passes: Pass[] = all, elements: ElementsState = ready): void => {
  act(() => {
    appStore.getState().setChartView('polar');
    appStore.setState({ observer, nowMs: NOW, elements, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes, hasDarkness: true } });
  });
};

describe('livePasses / visibleCount (FR-LIVE-2, D-160)', () => {
  it('keeps every pass overlapping now … now + 24 h, in the list order, and drops the rest', () => {
    expect(livePasses(all, T).map((p) => p.id)).toEqual([pass.id, 'later', 'tomorrow']);
    // The edges are inclusive: a pass ending exactly now, or starting exactly 24 h out, is in.
    expect(livePasses([shifted('ends-now', 'x', T - pass.end.t)], T).map((p) => p.id)).toEqual(['ends-now']);
    expect(livePasses([shifted('at-edge', 'x', T + LIVE_WINDOW_MS - pass.start.t)], T).map((p) => p.id)).toEqual(['at-edge']);
    expect(livePasses([shifted('past-edge', 'x', T + LIVE_WINDOW_MS + 1 - pass.start.t)], T)).toEqual([]);
  });

  it('counts the passes whose interval contains the instant: the markers on the dome', () => {
    expect(visibleCount(all, T)).toBe(1);
    expect(visibleCount(all, pass.end.t + 1)).toBe(0);
    expect(visibleCount([pass, shifted('twin', 'y', 5_000)], T)).toBe(2);
  });
});

/** A hand-driven `requestAnimationFrame` in place of the window's: `frame(wall)` runs every pending callback. */
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
  return (wall: number): void => {
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => {
      for (const callback of callbacks) callback(wall);
    });
  };
}

describe('<LivePage>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(T);
  });
  /** The throttles run on `setTimeout`; faking it makes Testing Library's `findBy*` think jest is in charge, so only the tests that need it take it. */
  const withTimeouts = (): void => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(T);
  };
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setLiveNowClient(null);
    appStore.setState(initial, true);
    window.localStorage.clear();
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('is inert with one line and the return control when there is no observer (FR-LIVE-1)', async () => {
    const onLeave = vi.fn();
    const { container } = render(<LivePage link={null} onLeave={onLeave} />);
    const page = screen.getByTestId('live-page');
    expect(page).toHaveAttribute('data-state', 'inert');
    expect(screen.getByTestId('live-inert')).toHaveTextContent(en.live.noObserver);
    expect(screen.queryByTestId('sky-chart')).toBeNull();
    expect(screen.queryByTestId('status-strip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is inert with one line when the elements are not there yet, and names the place it would draw for', () => {
    withSky([], { status: 'loading' });
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-state', 'inert');
    expect(screen.getByTestId('live-inert')).toHaveTextContent(en.live.noElements);
    expect(screen.getByTestId('live-place')).toHaveTextContent('−38.93, −67.99');
    expect(screen.queryByTestId('sky-chart')).toBeNull();
  });

  it('draws the passes of the coming 24 h in series colours, marks the one under way, and counts it in the strip (FR-LIVE-2, FR-LIVE-3, FR-LIVE-10)', async () => {
    withSky();
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
    const figure = screen.getByRole('figure', { name: en.chart.liveLabel });
    expect(figure.querySelector('figcaption')).toBeNull();
    const drawn = [...container.querySelectorAll('[data-pass-id]')].map((el) => [el.getAttribute('data-pass-id'), el.getAttribute('data-series')]);
    expect(drawn).toEqual([
      [pass.id, '1'],
      ['later', '2'],
      ['tomorrow', '3'],
    ]);
    expect(container.querySelectorAll('[data-marker="now"]')).toHaveLength(1);
    expect(within(screen.getByTestId('live-count')).getByText('1 satellite')).toBeInTheDocument();
    expect(screen.getByTestId('live-time')).toHaveTextContent('2026-09-11 09:48:24 UTC');
    expect(screen.getByTestId('live-cloud')).toHaveTextContent('Weather unknown');
    // The Sun and the Moon arrive with the astronomy chunk; until then the two fields are pending.
    const expected = skyBodiesAt(T, observer);
    await within(screen.getByTestId('live-sky')).findByText(en.live.sky[expected.sky]);
    expect(screen.getByTestId('live-moon')).toHaveTextContent(`${en.moon.phase[expected.moon.phase]}, ${String(Math.round(expected.moon.illuminatedFraction * 100))} % lit`);
    expect(figure.querySelector('[data-anchor="sun"]') !== null).toBe(expected.sun.altDeg > -18 && expected.sun.altDeg < 0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('follows real time on the 10 s tick: past the end of the pass the marker is gone and the count is zero', () => {
    withSky();
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(container.querySelectorAll('[data-marker="now"]')).toHaveLength(1);
    act(() => {
      vi.setSystemTime(pass.end.t + 1_000);
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(container.querySelectorAll('[data-marker="now"]')).toHaveLength(0);
    expect(screen.getByTestId('live-count')).toHaveTextContent('0 satellites');
    // The window moved with real time: the golden pass is over and no longer drawn.
    expect(container.querySelector(`[data-pass-id="${pass.id}"]`)).toBeNull();
    expect(container.querySelector('[data-pass-id="later"]')).not.toBeNull();
  });

  it('shows the instant a #live?… link names instead of real time, and shares it back in the same form (FR-LIVE-9, FR-SHARE-1)', () => {
    withSky();
    const t = later.start.t + 30_000;
    render(<LivePage link={{ kind: 'live', observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t }} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-time')).toHaveTextContent('2026-09-11 12:48:44 UTC');
    // The marker is on the pass that contains the link's instant, not the one under way in real time.
    const marker = screen.getByTestId('live-dome').querySelector('[data-marker="now"]');
    expect(marker?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', 'later');
    expect(screen.getByTestId('live-count')).toHaveTextContent('1 satellite');
    expect(screen.getByRole('button', { name: 'Share this sky' })).toBeInTheDocument();
  });

  it('shares real time as a link without t, and the link the page was opened with as it was', () => {
    withSky();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share this sky' }));
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.href.split('#')[0] ?? ''}#live?lat=-38.93&lon=-67.99&alt=0`);
    unmount();
    render(<LivePage link={{ kind: 'live', observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: Date.UTC(2026, 8, 11, 12, 0, 0) }} onLeave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share this sky' }));
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.href.split('#')[0] ?? ''}#live?lat=-38.93&lon=-67.99&alt=0&t=2026-09-11T12:00:00Z`);
  });

  it('returns on Esc and on the return control (FR-LIVE-1)', () => {
    withSky();
    const onLeave = vi.fn();
    render(<LivePage link={null} onLeave={onLeave} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onLeave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(onLeave).toHaveBeenCalledTimes(2);
  });

  it('carries the language and the theme switches, since there is no header on this page', () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Chart view' })).toBeInTheDocument();
  });

  /** R33 (FR-LIVE-4, US-15 AC3): the stripe moves the instant and everything follows — the dome, the marker, the strip, the share link. */
  it('scrubbing the stripe sets the shown instant: the marker, the count, the strip and the share link follow', () => {
    withSky();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const stripe = screen.getByTestId('time-stripe');
    expect(stripe).toHaveAttribute('aria-valuemin', String(T));
    expect(stripe).toHaveAttribute('aria-valuemax', String(T + LIVE_WINDOW_MS));
    // The stripe carries the drawn passes as segments in the same series order as the dome.
    expect([...container.querySelectorAll('[data-pass-segment]')].map((el) => el.getAttribute('data-series'))).toEqual(['1', '2', '3']);
    // At jsdom's default 600 px, 75 px is three hours in: inside the `later` pass (which starts at 3 h).
    const threeHours = T + 3 * HOUR + 30_000;
    fireEvent.pointerDown(stripe, { button: 0, clientX: (600 * (threeHours - T)) / LIVE_WINDOW_MS, pointerId: 1 });
    fireEvent.pointerUp(stripe, { pointerId: 1 });
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBeCloseTo(threeHours, -3);
    const marker = screen.getByTestId('live-dome').querySelector('[data-marker="now"]');
    expect(marker?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', 'later');
    expect(screen.getByTestId('live-count')).toHaveTextContent('1 satellite');
    expect(screen.getByTestId('live-time')).toHaveTextContent(/2026-09-11 12:48:\d\d UTC/);
    expect(container.querySelector('[data-pass-segment="later"]')).toHaveAttribute('data-current', 'true');
    // The arrow keys step from there (FR-LIVE-4), and the share link now carries the instant (FR-LIVE-9).
    fireEvent.keyDown(stripe, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(stripe, { key: 'ArrowRight' });
    const shown = Number(stripe.getAttribute('aria-valuenow'));
    expect(shown).toBeCloseTo(threeHours - 9 * 60_000, -3);
    fireEvent.click(screen.getByRole('button', { name: 'Share this sky' }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining(`#live?lat=-38.93&lon=-67.99&alt=0&t=${isoInstant(shown)}`));
  });

  /** R33 (FR-LIVE-5, US-15 AC4, D-81): play advances the instant by wall time × speed and `now` comes back to the tick. */
  it('plays at the chosen speed, shows the speed in the strip, stops at the end of the span, and `now` returns to real time', () => {
    const frame = scriptedFrames();
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    const stripe = screen.getByTestId('time-stripe');
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
    expect(screen.queryByTestId('live-speed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '600×' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByTestId('live-speed')).toHaveTextContent('600×');
    frame(1000);
    frame(1500);
    // Half a second at 600× is five minutes.
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 300_000);
    frame(1700); // a dropped frame: the gap is still simulated time
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 420_000);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.queryByTestId('live-speed')).toBeNull();
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 420_000);
    // The `now` action: back to the tick, which keeps moving.
    fireEvent.click(screen.getByRole('button', { name: 'Now' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T);
    act(() => {
      vi.advanceTimersByTime(TICK_MS); // the fake Date moves with the timers
    });
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + TICK_MS);
    // At 3600× the whole span runs in 24 s and stops at its end.
    fireEvent.click(screen.getByRole('button', { name: '3600×' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    frame(2000);
    frame(30_000);
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + TICK_MS + LIVE_WINDOW_MS);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByTestId('live-speed')).toBeNull();
  });

  /** D-171: the hash is written at most twice a second while scrubbing and never while playing. */
  it('writes the hash at most twice a second while scrubbing, never while playing, and once on pause', () => {
    withTimeouts();
    const frame = scriptedFrames();
    withSky();
    window.location.hash = '#live';
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render(<LivePage link={null} onLeave={() => undefined} />);
    // Real time under the bare route: nothing to write.
    expect(replaceState).not.toHaveBeenCalled();
    const stripe = screen.getByTestId('time-stripe');
    // The first scrub writes at once; twenty more steps inside the next 400 ms write nothing; the 500 ms mark writes the last instant.
    fireEvent.keyDown(stripe, { key: 'ArrowRight' });
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe(`#live?lat=-38.93&lon=-67.99&alt=0&t=${new Date(T + 60_000).toISOString().replace('.000Z', 'Z')}`);
    for (let i = 1; i <= 20; i++) {
      fireEvent.keyDown(stripe, { key: 'ArrowRight' });
      act(() => {
        vi.advanceTimersByTime(20);
      });
    }
    expect(replaceState).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(replaceState).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe(`#live?lat=-38.93&lon=-67.99&alt=0&t=${new Date(T + 21 * 60_000).toISOString().replace('.000Z', 'Z')}`);
    replaceState.mockClear();
    // Playing: frames move the instant and nothing is written.
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    for (let wall = 0; wall <= 3000; wall += 100) {
      frame(wall);
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(replaceState).not.toHaveBeenCalled();
    // Pause: the instant it stopped at is written (the last write was over half a second ago).
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe(`#live?lat=-38.93&lon=-67.99&alt=0&t=${new Date(T + 21 * 60_000 + 3000 * 60).toISOString().replace('.000Z', 'Z')}`);
    // `Now`: back to the bare route.
    fireEvent.click(screen.getByRole('button', { name: 'Now' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(window.location.hash).toBe('#live');
  });

  /** R34 (FR-LIVE-8, US-10, US-15 AC8): on the dome view, the phone's heading turns the dome; a drag turns following off; the control turns it back on. */
  it('follows the phone: a heading turns the dome, a drag turns following off, and the control turns it on again', async () => {
    const frame = scriptedFrames();
    vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
      return undefined;
    });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    withSky();
    act(() => {
      appStore.getState().setChartView('dome');
    });
    render(<LivePage link={null} onLeave={() => undefined} />);
    // The dome is a lazy chunk; it lands with a readout that faces north (the page's initial facing).
    const stage = await screen.findByRole('group', { name: 'Sky dome' }, { timeout: 10_000 });
    const facing = () => Number(screen.getByTestId('live-dome').querySelector('[data-facing-az]')?.getAttribute('data-facing-az'));
    expect(facing()).toBe(0);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    const heading = (alpha: number) => {
      act(() => {
        window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha, absolute: true }));
      });
      frame(16);
    };
    fireEvent.click(toggle);
    // R39 (F-42): the click arms the sensor; the first reading is what says the dome is following.
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    heading(270);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(facing()).toBe(90);
    heading(180);
    expect(facing()).toBe(180);
    // A drag on the dome: following off, the dome stays where the drag left it, headings are ignored.
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: 'touch' });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 140, clientY: 100 });
    frame(32);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(facing()).toBe(170);
    heading(0);
    expect(facing()).toBe(170);
    // The control turns it back on and the next heading turns the dome.
    fireEvent.click(toggle);
    heading(90);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(facing()).toBe(270);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /**
   * R39 (F-40, FR-LIVE-8 as amended): the facing is the dome's. The polar view
   * draws the whole sky at once and takes no facing, so the control was a
   * toggle that did nothing there; it is not shown, and a view change while
   * following stops it rather than leaving the sensor on with no way off.
   */
  it('shows no follow control on the polar view and stops following when the view changes (F-40)', async () => {
    const frame = scriptedFrames();
    vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
      return undefined;
    });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    withSky(); // the polar view, as every test here draws it
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.queryByTestId('follow-phone')).toBeNull();

    // On the dome it is there, and it follows.
    act(() => {
      appStore.getState().setChartView('dome');
    });
    await screen.findByRole('group', { name: 'Sky dome' }, { timeout: 10_000 });
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 270, absolute: true }));
    });
    frame(16);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(Number(screen.getByTestId('live-dome').querySelector('[data-facing-az]')?.getAttribute('data-facing-az'))).toBe(90);

    // Back to polar: no control, and nothing left following behind it.
    act(() => {
      appStore.getState().setChartView('polar');
    });
    expect(screen.queryByTestId('follow-phone')).toBeNull();
    act(() => {
      appStore.getState().setChartView('dome');
    });
    expect(screen.getByRole('button', { name: en.live.follow })).toHaveAttribute('aria-pressed', 'false');
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /** R33 (FR-LIVE-6, US-15 AC6, D-102): the toggle asks the worker for the dimmed set and draws it, minus what is already on an arc. */
  it('draws the hidden objects dimmed with their reasons when the toggle is on, skips what an arc already draws, and remembers the toggle', async () => {
    withSky();
    const item = (over: Partial<NowItem>): NowItem => ({ noradId: 1, name: 'x', azDeg: 40, elDeg: 20, rangeKm: 900, magnitude: 5.2, lit: true, aboveMinElevation: true, visible: false, ...over });
    const hidden: NowItem[] = [
      item({ noradId: pass.noradId, name: pass.name }), // the ISS: on its arc at T, so not dimmed as well (D-102)
      item({ noradId: 2, name: 'Envisat', lit: false, azDeg: 200, elDeg: 5 }),
      item({ noradId: 3, name: 'Tiangong', azDeg: 300, elDeg: 45 }),
    ];
    const computeNow = vi.fn((_observer: unknown, t: number) => Promise.resolve<NowState>({ t, sunAltDeg: -30, sky: 'dark', items: [], hidden, moon: MOON_FIXTURE }));
    setLiveNowClient({ computeNow });
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(container.querySelectorAll('[data-marker="hidden"]')).toHaveLength(0);
    expect(computeNow).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', { name: 'Hidden objects' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(computeNow).toHaveBeenCalledWith(observer, T, expect.anything(), { includeHidden: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(within(screen.getByTestId('live-dome')).getByText('Envisat · in shadow')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-marker="hidden"]')).toHaveLength(2);
    expect(container.querySelector('[data-hidden-id="hidden-3"] [data-anchor="hidden"]')?.textContent).toBe('Tiangong · too faint');
    expect(container.querySelector(`[data-hidden-id="hidden-${String(pass.noradId)}"]`)).toBeNull();
    // Remembered (FR-LIVE-6 "off by default and remembered").
    expect(appStore.getState().liveHidden).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ liveHidden: true });
    fireEvent.click(toggle);
    expect(container.querySelectorAll('[data-marker="hidden"]')).toHaveLength(0);
    expect(appStore.getState().liveHidden).toBe(false);
  });
});
