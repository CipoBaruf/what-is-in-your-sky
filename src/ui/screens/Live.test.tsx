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
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { en } from '../../i18n/en';
import { WIDE_MIN_PX } from '../../lib/layout';
import { isoInstant } from '../../lib/shareLinks';
import { skyBodiesAt } from '../../lib/skyBodies';
import type { Observer, Pass } from '../../model';
import type { NowItem, NowState } from '../../model';
import { appStore, setLiveNowClient, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { stubMatchMedia, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { MOON_FIXTURE } from '../../../tests/support/moonFixtures';
import { LIVE_WINDOW_MS, LivePage, livePasses, TICK_MS, visibleCount } from './Live';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();

/** R66 (V13-6, D-350): the way into the sky screen — the view control's "window" option, on this page as on the pass detail. */
const windowOption = (): HTMLElement => within(screen.getByRole('group', { name: en.chart.viewGroup })).getByRole('button', { name: en.chart.view.window });
const HOUR = 3_600_000;

/**
 * R71 (FR-LEG-7): jsdom is the compact shell, where the legend is behind
 * `[ list (n) ]` and is not in the tree until it is tapped. A test that reads a
 * legend row opens the panel first; what the control itself does is its own
 * test below.
 */
const openList = (): void => {
  fireEvent.click(screen.getByTestId('live-legend-toggle'));
};

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
  /** R61 (D-314): the wide tests stub `matchMedia` with a size, since the dome ladder asks the height as well as the width. */
  let media: MatchMediaStub | null = null;
  afterEach(() => {
    media?.restore();
    media = null;
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
    openList();
    // R45: the legend's rows carry the pass id too, so the drawing's are read inside the drawing.
    // R48 (FR-TRAJ-1): at the shown instant only the pass under way is drawn — `later` (3 h on) and
    // `tomorrow` are hidden until their rise is within ARC_LOOKAHEAD — and it keeps its series colour.
    const drawn = [...container.querySelectorAll('[data-drawing] [data-pass-id]')].map((el) => [el.getAttribute('data-pass-id'), el.getAttribute('data-series'), el.getAttribute('data-arc')]);
    expect(drawn).toEqual([[pass.id, '1', 'live']]);
    expect(container.querySelectorAll('[data-testid="chart-legend"] [data-pass-id]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-marker="now"]')).toHaveLength(1);
    // R70 (FR-SPAN-1, FR-SPAN-2): the overview carries every pass of the coming 24 h as a mark, and the stripe
    // the ones inside the four hours it draws — here the pass under way, which is what `t` is inside.
    expect([...container.querySelectorAll('[data-pass-mark]')].map((el) => el.getAttribute('data-pass-mark'))).toEqual([pass.id, 'later', 'tomorrow']);
    expect([...container.querySelectorAll('[data-pass-segment]')].map((el) => el.getAttribute('data-pass-segment'))).toEqual([pass.id]);
    // R48 (D-246): jsdom is the compact shell, where the strip is the two-line form — the numbers, and no date.
    expect(screen.getByTestId('live-count')).toHaveTextContent(/^Visible 1$/);
    expect(screen.getByTestId('live-time')).toHaveTextContent(/^Time 09:48:24 UTC$/);
    expect(screen.getByTestId('live-cloud')).toHaveTextContent(/^Clouds n\/a$/);
    // The Sun and the Moon arrive with the astronomy chunk; until then the two fields are pending.
    const expected = skyBodiesAt(T, observer);
    await within(screen.getByTestId('live-sky')).findByText(en.live.sky[expected.sky]);
    expect(screen.getByTestId('live-moon')).toHaveTextContent(`Moon ${String(Math.round(expected.moon.illuminatedFraction * 100))} %`);
    // R45 (FR-DOME-6 as amended): the Sun is a glow in the raster and a legend line, not a caption in the drawing.
    expect(figure.querySelector('[data-testid="chart-legend"] [data-body="sun"]') !== null).toBe(expected.sun.altDeg > -18 && expected.sun.altDeg < 0);
    expect(figure.querySelector('[data-anchor="sun"]')).toBeNull();
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
    expect(screen.getByTestId('live-count')).toHaveTextContent(/^Visible 0$/);
    // The window moved with real time: the golden pass is over and no longer drawn. `later` is in the
    // window — a mark on the overview — and, three hours from its rise, not yet on the chart (FR-TRAJ-1)
    // nor inside the four hours the stripe draws (FR-SPAN-1).
    expect(container.querySelector(`[data-pass-id="${pass.id}"]`)).toBeNull();
    expect(container.querySelector('[data-pass-mark="later"]')).not.toBeNull();
    expect(container.querySelector('[data-drawing] [data-pass-id="later"]')).toBeNull();
  });

  it('shows the instant a #live?… link names instead of real time, and shares it back in the same form (FR-LIVE-9, FR-SHARE-1)', () => {
    withSky();
    const t = later.start.t + 30_000;
    render(<LivePage link={{ kind: 'live', observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t }} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-time')).toHaveTextContent(/^Time 12:48:44 UTC$/);
    // The marker is on the pass that contains the link's instant, not the one under way in real time.
    const marker = screen.getByTestId('live-dome').querySelector('[data-marker="now"]');
    expect(marker?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', 'later');
    expect(screen.getByTestId('live-count')).toHaveTextContent(/^Visible 1$/);
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

  /**
   * R62 (FR-FSC-6, FR-WIN-4 and FR-WIN-5 as amended v1.3; D-324): on a phone —
   * where the window's presence test passes and the option used to be a third
   * one — the live page's control offers the dome and the polar chart only. The
   * window is reached here by `[ follow phone ]`, and a `window` this device
   * R66 (FR-FSC-6 as amended v1.3.1, V13-6): the control offers all three
   * again — the live page is no longer the exception — and "Window" is a mode
   * the tap opens rather than a view the page switches to.
   */
  it('offers all three views in the control on a phone, and draws the one the reader picked (FR-FSC-6 as amended v1.3.1)', () => {
    withSky();
    vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
      return undefined;
    });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    appStore.getState().setChartView('dome');
    try {
      render(<LivePage link={null} onLeave={() => undefined} />);
      expect(
        within(screen.getByRole('group', { name: 'Chart view' }))
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Polar', 'Dome', 'Window']);
      // The option is a mode: until it is tapped the page is the dome, with every row it has.
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
      expect(screen.queryByTestId('sky-screen')).toBeNull();
      expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
      expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    }
  });

  it('carries the language and the theme switches on wide, since there is no header on this page; compact keeps one top row without them (D-244)', () => {
    withSky();
    // jsdom has no `matchMedia`: the compact shell. The top row is the return control and the place.
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'true');
    expect(screen.queryByRole('group', { name: 'Language' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Theme' })).toBeNull();
    expect(within(screen.getByTestId('live-top-row')).getByTestId('live-place')).toHaveTextContent(observer.label);
    expect(screen.getByRole('group', { name: 'Chart view' })).toBeInTheDocument();
    // R48 (FR-LIVE-7 as amended): no "drag the dome" hint on this page, whichever view.
    expect(screen.queryByText(en.chart.domeHint)).toBeNull();
    unmount();
    media = stubMatchMedia(1280, 800);
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'false');
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share this sky' })).toHaveTextContent('Share this sky');
  });

  /**
   * R61 (FR-LIVE-7 as amended v1.2, D-312, F-59): on wide the side column is
   * the chart's rail — the column beside the drawing, under the legend — and
   * not a row under the box, so the box keeps the page's whole height. The
   * placement is React's and asserted here; the width the rail takes is the
   * stylesheet's, read from the file because jsdom lays nothing out.
   *
   * R71 (FR-LEG-6, V14-4, D-386): at *every* wide width. The one-column page
   * under `LIVE_TWO_COLUMN_MIN_PX` is withdrawn with the constant, so the
   * narrowest wide viewport (964 px, FR-DESK-1's 100 cells) has the rail too,
   * and the page carries no column count at all. This fails on the old rule at
   * 964 and 1280, where the frame stacked and the page kept its own row.
   */
  it('gives the side column to the chart at every wide width, and keeps it in the page on compact', () => {
    withSky();
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByTestId('live-page')).not.toHaveAttribute('data-columns');
    expect(screen.getByTestId('live-side').closest('[data-testid="chart-aside"]')).toBeNull();
    expect(screen.getByTestId('live-side').parentElement).toBe(screen.getByTestId('live-page'));
    unmount();
    // D-386: 964, 1280 and 1660 are one layout — the rail beside the cut box, the page two rows.
    for (const [width, height] of [
      [WIDE_MIN_PX, 700],
      [1280, 800],
      [1660, 1080],
    ] as const) {
      media?.restore();
      media = stubMatchMedia(width, height);
      const wide = render(<LivePage link={null} onLeave={() => undefined} />);
      expect(screen.getByTestId('live-page'), `${String(width)} px carries no column count`).not.toHaveAttribute('data-columns');
      expect(screen.getByTestId('live-dome')).not.toHaveAttribute('data-columns');
      expect(screen.getByTestId('live-side').closest('[data-testid="chart-aside"]'), `the rail at ${String(width)} px`).not.toBeNull();
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-aside', 'true');
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stacked', 'false');
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'true');
      wide.unmount();
    }
    // …and the one-column block is out of the stylesheet with the rule it drew (D-386).
    expect(readFileSync('src/ui/screens/Live.module.css', 'utf8')).not.toMatch(/\.page\[data-compact='false'\]\[data-columns='one'\]/);
    media?.restore();
    media = stubMatchMedia(1660, 1080);
    render(<LivePage link={null} onLeave={() => undefined} />);
    // The fluid rail is 26 % of the frame between 44 and 60 cells, so its share falls as the page grows (D-313); the page's third row goes with the rows that moved.
    expect(readFileSync('src/ui/components/guide/skychart/ChartFrame.module.css', 'utf8')).toMatch(
      /\[data-aside='true'\] \{\n\s+grid-template-columns: auto minmax\(0, 1fr\) clamp\(calc\(44 \* var\(--cell\)\), 26%, calc\(60 \* var\(--cell\)\)\);/,
    );
    expect(readFileSync('src/ui/screens/Live.module.css', 'utf8')).toMatch(/\.page\[data-compact='false'\] \{\n\s+grid-template-areas:\n\s+'top'\n\s+'dome';/);
    // R61 (D-314, D-315): the box is cut to the dome's aspect, and the stripe block is the frame's row under it.
    expect(screen.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'true');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'true');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'true');
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('chart-stripe'));
  });

  /**
   * R61 (FR-LIVE-7 and FR-TRAJ-4 as amended v1.2.1, D-314, D-315, V12-12): on every wide page the stripe block
   * is the frame's row under the box rather than a row of the rail — the same element, placed there — and the
   * chart is handed the dome's aspect so the frame cuts the box to it. Compact keeps both in the page: a phone
   * never has a cut box, and its stripe is a row of the page under the drawing as it has been since R48.
   */
  it('puts the stripe block under the box on wide at every width, hands the chart the dome\'s aspect there, and keeps both in the page on compact', () => {
    withSky();
    media = stubMatchMedia(1920, 1080);
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'true');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'true');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'true');
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('chart-stripe'));
    expect([...screen.getByTestId('live-side').children].map((el) => el.getAttribute('data-testid'))).toEqual(['status-strip', 'live-actions']);
    // The narrowest wide page: the same stripe row, the same rail (R71, D-386).
    act(() => {
      media?.setSize(WIDE_MIN_PX, 700);
    });
    expect(screen.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'true');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stacked', 'false');
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('chart-stripe'));
    expect(screen.getByTestId('live-side').closest('[data-testid="chart-aside"]')).not.toBeNull();
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'true');
    // Compact: no cut box, no stripe row; the block is a row of the page's own side column.
    act(() => {
      media?.setSize(390, 3000);
    });
    expect(screen.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'false');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'false');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'false');
    expect(screen.getByTestId('stripe-block').closest('[data-testid="live-side"]')).not.toBeNull();
  });

  /**
   * R54 (FR-LIVE-7 as amended v1.1.1, FR-TRAJ-5, D-268) and R61 (V12-13, D-318): the wide rows — the playback
   * controls on the clock's row above the stripe, the hidden-objects toggle with the actions in the rail.
   * R70 (FR-SPAN-2, FR-TRAJ-5 as amended v1.4; V14-6, D-389): the block gains the overview row above the
   * stripe, and the stepping row is drawn wherever the stripe is — the `touch` guard is gone.
   */
  it('on wide puts the playback controls on the time row above the stripe, the hidden-objects toggle with the actions, and draws the stepping row with or without touch', () => {
    withSky();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    // Compact, no touch: the toggle is on the actions row, the playback row is the page's own, and the block is four rows.
    expect(within(screen.getByTestId('live-actions')).getByTestId('live-hidden-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('playback-row').parentElement).toBe(screen.getByTestId('live-side'));
    expect([...screen.getByTestId('stripe-block').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-readout', 'overview-row', 'time-stripe', 'step-controls']);
    unmount();
    media = stubMatchMedia(1280, 800);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'false');
    // The side row (the page's own at 1280, the rail from 1660) is the strip and the actions, the toggle among them.
    expect([...screen.getByTestId('live-side').children].map((el) => el.getAttribute('data-testid'))).toEqual(['status-strip', 'live-actions']);
    expect(within(screen.getByTestId('live-actions')).getByTestId('live-hidden-toggle')).toBeInTheDocument();
    // The stripe block is the frame's row under the box (D-315): the time row — the readout and the playback row — the overview, the stripe, the stepping row.
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('chart-stripe'));
    expect([...screen.getByTestId('stripe-block').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-row', 'overview-row', 'time-stripe', 'step-controls']);
    expect([...screen.getByTestId('time-row').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-readout', 'playback-row']);
    expect(within(screen.getByTestId('playback-row')).getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  /** R48 (FR-TRAJ-1, FR-TRAJ-3, US-22 AC1..AC3, D-189): the arcs appear, grow and fade with the shown instant, and the legend says the same. */
  it('scrubs a pass through ahead, live, linger and gone, with the drawn arc and the legend state following (FR-TRAJ-1)', () => {
    withSky();
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    openList();
    const stripe = screen.getByTestId('time-stripe');
    const arc = (): string | null => container.querySelector('[data-drawing] [data-pass-id="later"]')?.getAttribute('data-arc') ?? null;
    const legendState = (): string | null => container.querySelector('[data-testid="chart-legend"] [data-pass-id="later"]')?.getAttribute('data-state') ?? null;
    // Three hours before its rise, `later` is not drawn and not listed.
    expect(arc()).toBeNull();
    expect(legendState()).toBeNull();
    // `pass ▶|`: one tap lands on the rise (US-22 AC6 as amended, FR-SPAN-4) — the arc is live from its rise, with the marker.
    fireEvent.click(screen.getByRole('button', { name: 'Next pass' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(later.start.t);
    expect(arc()).toBe('live');
    expect(legendState()).toBe('live');
    expect(container.querySelector('[data-drawing] [data-pass-id="later"] [data-marker="now"]')).not.toBeNull();
    // A minute before the rise: the whole arc faint and dotted, the rise marked, no marker.
    fireEvent.click(screen.getByRole('button', { name: 'Back one minute' }));
    expect(arc()).toBe('ahead');
    expect(legendState()).toBe('ahead');
    expect(container.querySelector('[data-drawing] [data-pass-id="later"] [data-marker="ahead"]')).not.toBeNull();
    expect(container.querySelector('[data-drawing] [data-pass-id="later"] [data-marker="now"]')).toBeNull();
    // Ten minutes at a time past its end: the arc lingers, faint, without a marker…
    for (let steps = 0; steps < 20 && Number(stripe.getAttribute('aria-valuenow')) <= later.end.t; steps++) {
      fireEvent.keyDown(stripe, { key: 'ArrowRight', shiftKey: true });
    }
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBeGreaterThan(later.end.t);
    expect(arc()).toBe('linger');
    expect(legendState()).toBe('linger');
    expect(container.querySelector('[data-drawing] [data-pass-id="later"] [data-marker="now"]')).toBeNull();
    // …and ten minutes on it is gone from the drawing and the legend.
    fireEvent.keyDown(stripe, { key: 'ArrowRight', shiftKey: true });
    expect(arc()).toBeNull();
    expect(legendState()).toBeNull();
  });

  /**
   * R48 (FR-TRAJ-4, FR-TRAJ-5, US-22 AC5, AC6), re-cut by R70 (FR-SPAN-3, FR-SPAN-4, US-24 AC3, AC4): the
   * readout above the stripe, the overview between them, and the row of six under them — the pass jumps in
   * one tap, the chunk arrows four hours, the minute steps a minute.
   */
  it('shows the readout above the stripe with the weekday past midnight, and the stepping row lands on passes, chunks and minutes', () => {
    withSky();
    // R70 (V14-6): no touch, and the row is still there.
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    render(<LivePage link={null} onLeave={() => undefined} />);
    const stripe = screen.getByTestId('time-stripe');
    const block = screen.getByTestId('stripe-block');
    const readout = within(block).getByTestId('time-readout');
    // The block's order (D-389): the readout, the overview, the stripe, the stepping row.
    expect([...block.children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-readout', 'overview-row', 'time-stripe', 'step-controls']);
    expect(readout).toHaveTextContent(/^09:48$/);
    expect(readout).toHaveAttribute('data-today', 'true');
    // Four hours on, and back to the minute: the chunk arrows and the fine step.
    fireEvent.click(screen.getByRole('button', { name: 'Forward four hours' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 4 * 3_600_000);
    expect(readout).toHaveTextContent(/^13:48$/);
    fireEvent.click(screen.getByRole('button', { name: 'Back four hours' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward one minute' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back one minute' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T);
    // The next pass is `later`, then `tomorrow`; from there nothing ahead, and `later` is behind.
    fireEvent.click(screen.getByRole('button', { name: 'Next pass' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(later.start.t);
    // FR-SPAN-4: the tap that finds the pass is the tap that draws it — the stripe's window moved with the instant.
    expect(Number(stripe.getAttribute('data-drawn-start'))).toBeLessThanOrEqual(later.start.t);
    expect(Number(stripe.getAttribute('data-drawn-end'))).toBeGreaterThanOrEqual(later.start.t);
    fireEvent.click(screen.getByRole('button', { name: 'Next pass' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(tomorrow.start.t);
    expect(screen.getByRole('button', { name: 'Next pass' })).toBeDisabled();
    // Past midnight UTC (the zone is unknown here): the weekday is in front of the clock.
    expect(readout).toHaveTextContent(/^Sat \d\d:\d\d$/);
    expect(readout).toHaveAttribute('data-today', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Previous pass' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(later.start.t);
  });

  /**
   * R48 (FR-WIN-6, US-21 AC5) → R64 (D-321) → R66 (FR-FSC-8, FR-WIN-6 and
   * FR-FOL-3 as amended v1.3.1; V13-7, D-353): the screen replaces the page,
   * and it shows **the instant the page was showing**. R48's reset to real time
   * is gone: it is what stopped a reader watching a pass that has not happened
   * yet through the phone, which is the whole point of the window.
   */
  it('the sky screen replaces the page at the instant the page was showing, and closing brings the rows back there (FR-FSC-1, FR-FSC-8)', () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next pass' }));
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(later.start.t);
    expect(screen.getByRole('button', { name: 'Now' })).toBeEnabled();
    act(() => {
      appStore.getState().openSkyScreen();
    });
    expect(screen.getByTestId('sky-screen')).toBeInTheDocument();
    for (const testid of ['live-side', 'stripe-block', 'time-stripe', 'playback-controls', 'playback-row', 'live-actions', 'live-time']) expect(screen.queryByTestId(testid)).toBeNull();
    // The page's one-row header is covered rather than unmounted, and out of the accessible tree with it.
    expect(screen.getByTestId('live-top-row')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: en.live.back })).toBeNull();
    // Leaving the screen: the whole page is back, at the instant it was left at — not at now.
    act(() => {
      appStore.getState().closeSkyScreen();
    });
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    expect(screen.getByTestId('live-top-row')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(later.start.t);
    expect(screen.getByRole('button', { name: 'Now' })).toBeEnabled();
  });

  /**
   * R33 (FR-LIVE-4, US-15 AC3): scrubbing moves the instant and everything follows — the dome, the marker, the
   * strip, the share link. R70 (FR-SPAN-2, US-24 AC2): the whole span is the overview's row now, so a drag
   * across the night is a drag on it; the stripe below redraws around wherever it lands.
   */
  it('scrubbing the overview sets the shown instant: the stripe, the marker, the count, the strip and the share link follow', () => {
    withSky();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const stripe = screen.getByTestId('time-stripe');
    const overview = screen.getByTestId('stripe-overview');
    expect(stripe).toHaveAttribute('aria-valuemin', String(T));
    expect(stripe).toHaveAttribute('aria-valuemax', String(T + LIVE_WINDOW_MS));
    // The overview carries the drawn passes as marks in the same series order as the dome.
    expect([...container.querySelectorAll('[data-pass-mark]')].map((el) => el.getAttribute('data-series'))).toEqual(['1', '2', '3']);
    // At jsdom's default 600 px, 75 px of the overview is three hours in: inside the `later` pass (which starts at 3 h).
    const threeHours = T + 3 * HOUR + 30_000;
    fireEvent.pointerDown(overview, { button: 0, clientX: (600 * (threeHours - T)) / LIVE_WINDOW_MS, pointerId: 1 });
    fireEvent.pointerUp(overview, { pointerId: 1 });
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBeCloseTo(threeHours, -3);
    // FR-SPAN-1: the stripe is drawing the four hours that hold it, and the overview brackets the same four.
    expect(Number(stripe.getAttribute('data-drawn-start'))).toBeLessThanOrEqual(threeHours);
    expect(Number(stripe.getAttribute('data-drawn-end'))).toBeGreaterThanOrEqual(threeHours);
    expect(overview.getAttribute('data-chunk-start')).toBe(stripe.getAttribute('data-drawn-start'));
    const marker = screen.getByTestId('live-dome').querySelector('[data-marker="now"]');
    expect(marker?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', 'later');
    expect(screen.getByTestId('live-count')).toHaveTextContent(/^Visible 1$/);
    expect(screen.getByTestId('live-time')).toHaveTextContent(/^Time 12:48:\d\d UTC$/);
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

  /**
   * R59 (FR-FOL-1, FR-FOL-3, US-10, US-21 AC8), amended by R64 (FR-FSC-1,
   * FR-FSC-2, D-321): the control opens the follow *screen* — a layer over the
   * whole viewport — rather than switching the page's view. Entering is
   * FR-WIN-6's route by any other name (the instant goes back to real time),
   * and the screen's `×` is what the second press was: the control is not on
   * the screen. The page's `data-view` never moves, because the page is not
   * what draws the window any more.
   */
  const withPhone = (requestPermission?: () => Promise<'granted' | 'denied'>): void => {
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
  };
  /** A reading with a north in it: what the press waits for before it opens anything. */
  const reading = (absolute: boolean): void => {
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 270, absolute }));
    });
  };

  it.each(['polar', 'dome'] as const)('the window option mounts the screen over the %s at the page\'s instant, and its × gives the page back there (FR-FSC-1, FR-FSC-2, FR-FSC-8)', (from) => {
    withPhone();
    withSky();
    act(() => {
      appStore.getState().setChartView(from);
    });
    render(<LivePage link={null} onLeave={() => undefined} />);
    // Somewhere other than now: FR-FSC-8's case, the pass the reader wants to watch through the phone before it happens.
    fireEvent.click(screen.getByRole('button', { name: 'Next pass' }));
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(later.start.t);

    fireEvent.click(windowOption());
    // The tap arms the sensor; the reading is what opens the screen (F-42's lesson, D-350).
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    // The page's own chart never switches to the window: the option opens a layer, not a view (D-321, D-352).
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', from);
    reading(true);
    // FR-WIN-5 as amended v1.3.1: nothing is written, and the preference is still the view the reader picked.
    expect(appStore.getState()).toMatchObject({ chartView: from, skyScreen: true });
    const layer = screen.getByTestId('sky-screen');
    expect(layer).toHaveAttribute('role', 'dialog');
    expect(layer).toHaveAttribute('aria-modal', 'true');
    // FR-FSC-1: none of the page is on it — the view control that opened it included, so the `×` is the way back.
    for (const testid of ['live-side', 'stripe-block', 'playback-controls', 'live-actions', 'live-time']) expect(screen.queryByTestId(testid)).toBeNull();
    expect(screen.queryByRole('group', { name: en.chart.viewGroup })).toBeNull();

    // FR-FSC-2: the `×` closes, and the page comes back as it was — the view it had, and the instant it was at.
    const close = screen.getByRole('button', { name: en.chart.screenClose });
    expect(close).toHaveTextContent('×');
    fireEvent.click(close);
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    expect(appStore.getState()).toMatchObject({ chartView: from, skyScreen: false });
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', from);
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(later.start.t);
    // R64 (FR-WIN-6 as amended v1.3): the declination is the screen's readout line; the strip does not carry it any more.
    expect(screen.queryByTestId('live-heading')).toBeNull();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /** FR-FSC-2 / D-321: `Esc` closes the screen before it can leave the page, and the next one leaves as it always did. */
  it('closes the screen on Esc, and only then leaves the live page (FR-FSC-2)', () => {
    withPhone();
    withSky();
    const onLeave = vi.fn();
    render(<LivePage link={null} onLeave={onLeave} />);
    fireEvent.click(windowOption());
    reading(true);
    expect(screen.getByTestId('sky-screen')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    expect(appStore.getState().skyScreen).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onLeave).toHaveBeenCalledTimes(1);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /** D-321: focus goes to the `×` on open and back to the control that opened it on close — a new element by then. */
  it('moves focus to the × and back to the follow control (FR-FSC-2)', () => {
    withPhone();
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(windowOption());
    reading(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: en.chart.screenClose }));
    fireEvent.click(screen.getByRole('button', { name: en.chart.screenClose }));
    expect(document.activeElement).toBe(windowOption());
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /**
   * FR-FSC-5 (D-325): the toggle's saved state does not follow the reader onto
   * the screen. The hook is what holds it off — no `computeAt` request leaves
   * the page while following — so the screen cannot draw a dimmed mark even
   * from a cache the page filled a moment earlier.
   */
  it('asks the worker for no hidden objects while the screen is up, whatever the toggle says (FR-FSC-5)', async () => {
    withPhone();
    withSky();
    const computeNow = vi.fn((_observer: unknown, t: number) => Promise.resolve<NowState>({ t, sunAltDeg: -30, sky: 'dark', items: [], hidden: [], moon: MOON_FIXTURE }));
    setLiveNowClient({ computeNow });
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hidden objects' }));
    expect(computeNow).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(windowOption());
    reading(true);
    expect(screen.getByTestId('sky-screen')).toBeInTheDocument();
    expect(appStore.getState().liveHidden).toBe(true);
    // Nothing more was asked for, and the screen draws nothing dimmed.
    expect(computeNow).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-marker="hidden"]')).toHaveLength(0);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /**
   * R59 (FR-FOL-2): a relative-only device has no north to point the window at,
   * so nothing opens: the note, the view where it was, and the control
   * unpressed. R39's F-40 rule is gone with the dome's following — the control
   * belongs to both drawn views now — but its shape survives here: the state
   * says what the chart is doing and nothing else.
   */
  it('leaves the page alone with a note where the phone gives no heading, and drops the option for the session (FR-FOL-2, FR-WIN-4)', () => {
    withPhone();
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(windowOption());
    reading(false);
    expect(screen.getByTestId('chart-view-note')).toHaveTextContent(en.window.relative);
    expect(appStore.getState()).toMatchObject({ chartView: 'polar', skyScreen: false });
    // FR-FOL-2: nothing opened, so the page is untouched — the layer is not there and the rows still are.
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();

    // FR-WIN-4: and this phone is not offered the window again for the rest of the session.
    expect(
      within(screen.getByRole('group', { name: en.chart.viewGroup }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Polar', 'Dome']);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /** FR-FOL-2: a refusal opens nothing either — the note, the page as it was, and the control unpressed. */
  it('leaves the page alone with a note when the permission is refused (FR-FOL-2)', async () => {
    withPhone(() => Promise.resolve('denied'));
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(windowOption());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('chart-view-note')).toHaveTextContent(en.window.denied);
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(appStore.getState().skyScreen).toBe(false);
    // FR-FOL-2: a refusal keeps the option — the next tap asks again.
    expect(windowOption()).toBeInTheDocument();
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
    // R45 (FR-LEG-1): the reason is a legend row; the drawing carries the dimmed position and the row's key.
    openList();
    const legend = within(screen.getByTestId('live-dome')).getByTestId('chart-legend');
    expect(within(legend).getByText('Envisat · in shadow')).toBeInTheDocument();
    const tiangongKey = within(legend).getByText('Tiangong · too faint').closest('button')?.getAttribute('data-key');
    expect(tiangongKey).toMatch(/^[A-Z]$/);
    expect(container.querySelectorAll('[data-marker="hidden"]')).toHaveLength(2);
    expect(container.querySelector('[data-hidden-id="hidden-3"] [data-anchor="key"]')?.textContent).toBe(tiangongKey);
    expect(container.querySelector('[data-hidden-id="hidden-3"]')?.textContent).not.toContain('Tiangong');
    expect(container.querySelector(`[data-hidden-id="hidden-${String(pass.noradId)}"]`)).toBeNull();
    // Remembered (FR-LIVE-6 "off by default and remembered").
    expect(appStore.getState().liveHidden).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ liveHidden: true });
    fireEvent.click(toggle);
    expect(container.querySelectorAll('[data-marker="hidden"]')).toHaveLength(0);
    expect(appStore.getState().liveHidden).toBe(false);
  });
});
