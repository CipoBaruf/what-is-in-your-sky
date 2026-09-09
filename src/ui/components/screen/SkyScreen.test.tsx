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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../../tests/support/catalogFixtures';
import { stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { en } from '../../../i18n/en';
import type { NowState, Observer, SavedChartView } from '../../../model';
import { appStore, setLiveNowClient, type ElementsState } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { SCREEN_STATUS_ID } from '../guide/skychart/ChartFrame';
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

const withSky = (view: SavedChartView = 'polar'): void => {
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

/** R73: the same event by its three angles, for the poses the quarter turn is read from (FR-FSC-10). */
function pose(angles: { alpha: number; beta: number; gamma: number }): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { absolute: true, ...angles }));
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
    fireEvent.click(screen.getByRole('button', { name: en.chart.view.window }));
    reading();
    // Real turns of the event loop and not microtasks: the first mount in a file is the one that really fetches
    // the chunk, and the loader reads and transforms a file to do it. `setTimeout` is not among the faked timers
    // for exactly this; `waitFor` cannot be used, since the fake `setInterval` it polls on never fires.
    for (let i = 0; i < 50 && screen.getByTestId('sky-screen').querySelector('[data-look-az]') === null; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    reading();
    settle();
    return screen.getByTestId('sky-screen');
  };

  it('is the drawing, the ×, the readout and the legend, and nothing of the page (FR-FSC-1, US-21 AC11)', async () => {
    withSky();
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const layer = await open();

    // The four things on it (FR-FSC-1).
    expect(within(layer).getByTestId('sky-chart')).toHaveAttribute('data-screen', 'true');
    expect(layer.querySelector('[data-drawing="window"]')).not.toBeNull();
    expect(within(layer).getByTestId('sky-screen-close')).toHaveTextContent('×');
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
    expect(within(layer).getByRole('button', { name: en.chart.screenClose })).toBeInTheDocument();
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

  /**
   * FR-FSC-8 (V13-7, D-353): the screen draws the instant its page is showing.
   * The page is scrubbed forward before the screen opens — a pass that has not
   * happened yet, which is the case the requirement exists for — and what the
   * chart is handed is that instant, not real time.
   */
  it('draws the instant the page was showing, not now (FR-FSC-8, US-21 AC5)', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next pass' }));
    const scrubbed = Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'));
    expect(scrubbed).toBeGreaterThan(NOW);
    recorded.props.length = 0;
    await open();
    const screens = recorded.props.filter((props) => props.screen === true);
    expect(screens.length).toBeGreaterThan(0);
    for (const props of screens) expect(props.now).toBe(scrubbed);
  });

  /** FR-FSC-2 / FR-FOL-1: three ways out, and each gives back the view the press came from with the rows at real time. */
  it.each(['dome', 'polar'] as const)('closes back to the %s with the stripe block and the playback row at real time', async (from) => {
    withSky(from);
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);

    // The `×`.
    await open();
    fireEvent.click(screen.getByTestId('sky-screen-close'));
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', from);
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
    expect(appStore.getState()).toMatchObject({ chartView: from, skyScreen: false });

    // `Esc`, which closes the screen before it can leave the page (D-321).
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', from);
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(appStore.getState()).toMatchObject({ chartView: from, skyScreen: false });

    // And leaving the live page altogether (FR-FOL-1's "leaving the live page").
    await open();
    unmount();
    expect(appStore.getState()).toMatchObject({ chartView: from, skyScreen: false });
  });

  /** D-321: focus lands on the way out, and comes back to the control that opened the screen — a new element by then. */
  it('moves focus to the × and gives it back to the window option', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    await open();
    const close = screen.getByTestId('sky-screen-close');
    expect(document.activeElement).toBe(close);
    /*
     * D-321: `Tab` wraps inside the layer. The frame stacks the `×` over the legend, so in document order it
     * is the *last* stop and the legend's first row is the first — the reader arrives on the way out and
     * tabs forward into the sky, or straight back out of it, and neither direction reaches the covered page.
     */
    const stops = [...screen.getByTestId('sky-screen').querySelectorAll<HTMLElement>('button')];
    const first = stops[0];
    expect(stops.at(-1)).toBe(close);
    expect(first).toBeDefined();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first ?? close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);
    // R66 (D-351): back to the option that opened it — the view control's "Window", a new element by now.
    expect(document.activeElement).toBe(within(screen.getByRole('group', { name: en.chart.viewGroup })).getByRole('button', { name: en.chart.view.window }));
  });

  /**
   * R73 (FR-FSC-4 as rewritten, FR-FSC-10; US-21 AC12 as amended, AC15; D-426,
   * D-429): the picture is there in either orientation, and the layer turns
   * itself by the quarter the window reports. R63's portrait state — the note,
   * the `×` and nothing else — is what this replaces: it was the whole screen
   * on a phone whose rotation is locked, which is the pose FR-FSC-10 exists
   * for.
   */
  it('draws in either orientation, with no note in the picture’s place (US-21 AC12 as amended)', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    const layer = await open();
    expect(layer.querySelector('[data-look-az]')).toHaveAttribute('data-state', 'on');
    expect(screen.getByTestId('window-readout')).toBeInTheDocument();
    expect(layer.querySelectorAll('[data-pass-id]').length).toBeGreaterThan(0);

    act(() => {
      media?.setSize(...PORTRAIT);
    });
    settle();
    // The viewport went upright and nothing was veiled: the drawing, the readout and the `×` are all still here.
    expect(screen.getByTestId('sky-screen-close')).toBeInTheDocument();
    expect(screen.getByTestId('window-readout')).toBeInTheDocument();
    expect(layer.querySelectorAll('[data-pass-id]').length).toBeGreaterThan(0);
    expect(layer.querySelector('[data-look-az]')).toHaveAttribute('data-state', 'on');
  });

  it('is named by the readout, in either orientation (FR-FSC-2, D-427)', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    const layer = await open();
    const named = (): void => {
      expect(layer).toHaveAttribute('aria-labelledby', SCREEN_STATUS_ID);
      expect(layer).not.toHaveAttribute('aria-label');
      expect(document.getElementById(SCREEN_STATUS_ID)).toHaveTextContent('Looking');
    };
    named();
    act(() => {
      media?.setSize(...PORTRAIT);
    });
    settle();
    named();
  });

  it('turns the layer by the quarter the window reports, and by nothing on a phone that reflowed (FR-FSC-10)', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    const layer = await open();
    // The opening reading is an upright phone, and jsdom's `screen.orientation.angle` is 0: nothing to turn.
    expect(layer).toHaveAttribute('data-turn', '0');
    expect(layer.style.getPropertyValue('--screen-turn')).toBe('0deg');

    // The same phone with its rotation locked, turned on its side: its top to the reader's left, and the
    // viewport still saying portrait. The quarter comes from the pose, so the layer turns by a quarter.
    pose({ alpha: 0, beta: 0, gamma: -90 });
    settle();
    expect(layer).toHaveAttribute('data-turn', '90');
    expect(layer.style.getPropertyValue('--screen-turn')).toBe('90deg');

    // And upside down, where the two sides are not swapped because a half turn covers the viewport as it is.
    pose({ alpha: 0, beta: -90, gamma: 0 });
    settle();
    expect(layer).toHaveAttribute('data-turn', '180');

    pose({ alpha: 0, beta: 110, gamma: 0 });
    settle();
    expect(layer).toHaveAttribute('data-turn', '0');
  });

  it('adds no second sensor listener for the turn (FR-FSC-10, D-429; F-57, F-58’s lesson)', async () => {
    const attached: string[] = [];
    const detached: string[] = [];
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type: string, ...rest: unknown[]) => {
      if (type.startsWith('deviceorientation')) attached.push(type);
      add(...([type, ...rest] as unknown as Parameters<Window['addEventListener']>));
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type: string, ...rest: unknown[]) => {
      if (type.startsWith('deviceorientation')) detached.push(type);
      remove(...([type, ...rest] as unknown as Parameters<Window['removeEventListener']>));
    });

    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    await open();
    pose({ alpha: 0, beta: 0, gamma: -90 });
    settle();
    // The tap's own listener (`useSkyScreen`) went as soon as the reading with a north arrived, and the
    // window's is the one that is left: the layer reads the pose only through what the window reports.
    expect(attached.length - detached.length).toBe(1);
  });

  /** R73 (D-426): the turned layer's two rules, which jsdom applies to nothing and CI has no phone for. */
  it('swaps the layer’s two sides for a quarter turn and leaves them for a half one (FR-FSC-9, FR-FSC-10)', () => {
    const css = readFileSync(join(process.cwd(), 'src/ui/components/screen/SkyScreen.module.css'), 'utf8');
    // Turned: centred on the viewport and rotated by the difference, as one layer.
    expect(css).toMatch(/\.screen\[data-turn\]:not\(\[data-turn='0'\]\) \{[^}]*transform: translate\(-50%, -50%\) rotate\(var\(--screen-turn\)\);/);
    expect(css).toMatch(/\.screen\[data-turn\]:not\(\[data-turn='0'\]\) \{[^}]*transform-origin: center;/);
    // A quarter turn takes the viewport's two sides swapped, so the layer still covers the screen exactly; a
    // half turn is excluded, and the `:not` chain is what gives the rule the specificity to beat the one above.
    expect(css).toMatch(/\.screen\[data-turn\]:not\(\[data-turn='0'\]\):not\(\[data-turn='180'\]\) \{\s*width: 100dvh;\s*height: 100dvw;/);
    expect(css).toMatch(/\.screen\[data-turn\]:not\(\[data-turn='0'\]\) \{[^}]*width: 100dvw;\s*height: 100dvh;/);
    // And it is still the fixed layer FR-FSC-9 rests on: nothing here can scroll.
    expect(css).toMatch(/\.screen \{[^}]*position: fixed;/);
    expect(css).toMatch(/\.screen \{[^}]*overscroll-behavior: contain;/);
  });
});
