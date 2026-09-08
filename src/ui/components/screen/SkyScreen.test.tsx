/**
 * R64 (FR-FSC-1, FR-FSC-2, FR-FSC-5; FR-FOL-1, FR-FOL-3; US-21 AC11..AC13;
 * D-321, D-325, D-326): the follow screen, in the page that opens it.
 *
 * The layer is only ever reached through `[ follow phone ]`, and closing it has
 * to give the live page back exactly as it was, so this file renders the whole
 * page and drives it the way a reader would: the press, the reading that says
 * this phone has a north (D-276), and then the `×`, `Esc` or leaving.
 *
 * jsdom, with `matchMedia` stubbed at the size — the screen's own query is
 * `(orientation: landscape)` (D-323) — and the synthetic orientation events and
 * scripted frames of `SkyWindow.test.tsx`, which is the only way the window
 * reaches its `on` state and draws a readout in here.
 *
 * `SkyChart` is wrapped rather than replaced: the real chart renders, and the
 * props it was handed are recorded, so "no `hidden` prop reaches the chart"
 * (FR-FSC-5) is checked at the prop and not by looking for a mark that a
 * missing worker answer would have left out anyway.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../../tests/support/catalogFixtures';
import { stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { en } from '../../../i18n/en';
import type { ChartView, NowState, Observer } from '../../../model';
import { appStore, setLiveNowClient, type ElementsState } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import type { SkyChartProps } from '../guide/skychart/SkyChart.types';
import { LivePage } from '../../screens/Live';

/** The props every `SkyChart` on the page was rendered with, in order (D-326's FR-FSC-5 check). */
const recorded = vi.hoisted(() => ({ props: [] as SkyChartProps[] }));
vi.mock('../guide/skychart/SkyChart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../guide/skychart/SkyChart')>();
  return {
    ...actual,
    SkyChart: function SkyChartSpy(props: SkyChartProps) {
      recorded.props.push(props);
      return actual.SkyChart(props);
    },
  };
});

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const T = pass.start.t + 10_000;
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();

/** A landscape phone: 844 × 390, the size FR-FSC-7 captures the screen at. */
const LANDSCAPE = [844, 390] as const;
const PORTRAIT = [390, 844] as const;

const withSky = (view: ChartView = 'polar'): void => {
  act(() => {
    appStore.getState().setChartView(view);
    appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true } });
  });
};

function withPhone(): void {
  vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
    return undefined;
  });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
}

/** A hand-driven `requestAnimationFrame`: the window eases toward each reading a frame at a time. */
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
    for (let i = 0; i < 40; i += 1) {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(16);
      });
    }
  };
}

/** A reading with a north in it: what the press waits for, and what the window then points at. */
function reading(azDeg = 270, altDeg = 20): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: (360 - azDeg) % 360, beta: 90 + altDeg, gamma: 0, absolute: true }));
  });
}

describe('the follow screen (FR-FSC-1, FR-FSC-2, D-321)', () => {
  let media: MatchMediaStub | null = null;
  let settle: () => void = () => undefined;

  beforeEach(() => {
    recorded.props.length = 0;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(T);
    media = stubMatchMedia(...LANDSCAPE);
    settle = scriptedFrames();
    withPhone();
  });
  afterEach(() => {
    media?.restore();
    media = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    setLiveNowClient(null);
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  /**
   * The press, the reading it waits for (D-276), the microtasks the window's
   * lazy chunk resolves in (PLAN §11 — until they run, the layer is holding the
   * Suspense fallback), and the frames the smoothing needs to be pointing
   * somewhere.
   */
  const open = async (): Promise<HTMLElement> => {
    fireEvent.click(screen.getByRole('button', { name: en.live.follow }));
    reading();
    // Real turns of the event loop and not microtasks: the first mount in a file is the one that really fetches
    // the chunk, and the loader reads and transforms a file to do it. `setTimeout` is not among the faked timers
    // for exactly this; `waitFor` cannot be used, since the fake `setInterval` it polls on never fires.
    for (let i = 0; i < 50 && screen.getByTestId('follow-screen').querySelector('[data-look-az]') === null; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    reading();
    settle();
    return screen.getByTestId('follow-screen');
  };

  it('is the drawing, the ×, the readout and the legend, and nothing of the page (FR-FSC-1, US-21 AC11)', async () => {
    withSky();
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const layer = await open();

    // The four things on it (FR-FSC-1).
    expect(within(layer).getByTestId('sky-chart')).toHaveAttribute('data-screen', 'true');
    expect(layer.querySelector('[data-drawing="window"]')).not.toBeNull();
    expect(within(layer).getByTestId('follow-close')).toHaveTextContent('×');
    expect(within(layer).getByTestId('window-readout')).toBeInTheDocument();
    expect(within(layer).getByTestId('chart-legend')).toBeInTheDocument();

    // And nothing else of the page: not its rows, not its controls, not its one-row header.
    for (const testid of ['live-side', 'stripe-block', 'time-row', 'playback-row', 'playback-controls', 'live-actions', 'live-hidden-toggle', 'follow-phone', 'chart-view-note']) {
      expect(screen.queryByTestId(testid), testid).toBeNull();
    }
    expect(screen.queryByRole('group', { name: en.chart.viewGroup })).toBeNull();
    expect(screen.getByTestId('live-top-row')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: en.live.back })).toBeNull();

    // FR-FSC-2: the `×` is the one icon in the app, named rather than bracketed, and the layer is a modal dialog.
    expect(layer).toHaveAttribute('role', 'dialog');
    expect(layer).toHaveAttribute('aria-modal', 'true');
    expect(within(layer).getByRole('button', { name: en.live.followClose })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  /** FR-FSC-5 / D-325: the screen is for what can be seen now, so the chart is not even offered the dimmed set. */
  it('hands the chart no hidden objects, whatever the toggle has saved (FR-FSC-5, US-21 AC13)', async () => {
    withSky();
    const computeNow = vi.fn((_observer: unknown, t: number) => Promise.resolve<NowState>({ t, sunAltDeg: -30, sky: 'dark', items: [], hidden: [], moon: MOON_FIXTURE }));
    setLiveNowClient({ computeNow });
    act(() => {
      appStore.getState().setLiveHidden(true);
    });
    render(<LivePage link={null} onLeave={() => undefined} />);
    // The page asks while it is the page (FR-LIVE-6)…
    expect(computeNow).toHaveBeenCalledTimes(1);
    recorded.props.length = 0;
    await open();
    // …and not once the screen is up: no `computeAt` message leaves the page while following (D-325).
    expect(computeNow).toHaveBeenCalledTimes(1);
    const screens = recorded.props.filter((props) => props.screen === true);
    expect(screens.length).toBeGreaterThan(0);
    for (const props of screens) {
      expect('hidden' in props).toBe(false);
      expect(props.colorBy).toBe('pass');
      expect(props.observer).toBe(observer);
    }
    expect(appStore.getState().liveHidden).toBe(true);
  });

  /** FR-FSC-2 / FR-FOL-1: three ways out, and each gives back the view the press came from with the rows at real time. */
  it.each(['dome', 'polar'] as const)('closes back to the %s with the stripe block and the playback row at real time', async (from) => {
    withSky(from);
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);

    // The `×`.
    await open();
    fireEvent.click(screen.getByTestId('follow-close'));
    expect(screen.queryByTestId('follow-screen')).toBeNull();
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', from);
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
    expect(appStore.getState()).toMatchObject({ chartView: from, savedChartView: from, viewOverride: null });

    // `Esc`, which closes the screen before it can leave the page (D-321).
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('follow-screen')).toBeNull();
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', from);
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(appStore.getState()).toMatchObject({ chartView: from, viewOverride: null });

    // And leaving the live page altogether (FR-FOL-1's "leaving the live page").
    await open();
    unmount();
    expect(appStore.getState()).toMatchObject({ chartView: from, savedChartView: from, viewOverride: null });
  });

  /** D-321: focus lands on the way out, and comes back to the control that opened the screen — a new element by then. */
  it('moves focus to the × and gives it back to the follow control', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    await open();
    const close = screen.getByTestId('follow-close');
    expect(document.activeElement).toBe(close);
    /*
     * D-321: `Tab` wraps inside the layer. The frame stacks the `×` over the legend, so in document order it
     * is the *last* stop and the legend's first row is the first — the reader arrives on the way out and
     * tabs forward into the sky, or straight back out of it, and neither direction reaches the covered page.
     */
    const stops = [...screen.getByTestId('follow-screen').querySelectorAll<HTMLElement>('button')];
    const first = stops[0];
    expect(stops.at(-1)).toBe(close);
    expect(first).toBeDefined();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first ?? close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);
    expect(document.activeElement).toBe(screen.getByTestId('follow-toggle'));
  });

  /**
   * FR-FSC-4 / US-21 AC12 (R63, D-323): held upright the screen is the note and
   * the `×` and nothing else, and turning the phone brings the picture back
   * with no tap — the sensor hook is never unmounted, so the window is still
   * `on` when the drawing returns.
   */
  it('is the note and the × while the phone is upright, and the drawing again when it is turned (US-21 AC12)', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    const layer = await open();
    const window_ = layer.querySelector('[data-look-az]');
    expect(window_).toHaveAttribute('data-orientation', 'landscape');
    expect(window_).toHaveAttribute('data-state', 'on');

    act(() => {
      media?.setSize(...PORTRAIT);
    });
    expect(screen.getByTestId('window-portrait-note')).toHaveTextContent(en.window.portrait);
    expect(screen.getByTestId('follow-close')).toBeInTheDocument();
    expect(layer.querySelector('[data-look-az]')).toHaveAttribute('data-orientation', 'portrait');
    // The note is the whole box: no readout, no legend, and no drawn sky under it.
    expect(screen.queryByTestId('window-readout')).toBeNull();
    expect(screen.queryByTestId('chart-legend')).toBeNull();
    expect(layer.querySelectorAll('[data-pass-id]')).toHaveLength(0);
    // The sensor stayed on through the turn: no second reading, no second permission prompt.
    expect(layer.querySelector('[data-look-az]')).toHaveAttribute('data-state', 'on');

    act(() => {
      media?.setSize(...LANDSCAPE);
    });
    settle();
    expect(screen.queryByTestId('window-portrait-note')).toBeNull();
    expect(screen.getByTestId('window-readout')).toBeInTheDocument();
    expect(layer.querySelector('[data-look-az]')).toHaveAttribute('data-state', 'on');
  });
});
