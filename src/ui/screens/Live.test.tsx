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
import type { ChartView, Observer, Pass } from '../../model';
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
    // R45: the legend's rows carry the pass id too, so the drawing's are read inside the drawing.
    // R48 (FR-TRAJ-1): at the shown instant only the pass under way is drawn — `later` (3 h on) and
    // `tomorrow` are hidden until their rise is within ARC_LOOKAHEAD — and it keeps its series colour.
    const drawn = [...container.querySelectorAll('[data-drawing] [data-pass-id]')].map((el) => [el.getAttribute('data-pass-id'), el.getAttribute('data-series'), el.getAttribute('data-arc')]);
    expect(drawn).toEqual([[pass.id, '1', 'live']]);
    expect(container.querySelectorAll('[data-testid="chart-legend"] [data-pass-id]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-marker="now"]')).toHaveLength(1);
    // The stripe still carries every pass of the coming 24 h as a segment (FR-LIVE-4).
    expect([...container.querySelectorAll('[data-pass-segment]')].map((el) => el.getAttribute('data-pass-segment'))).toEqual([pass.id, 'later', 'tomorrow']);
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
    // window — a segment on the stripe — and, three hours from its rise, not yet on the chart (FR-TRAJ-1).
    expect(container.querySelector(`[data-pass-id="${pass.id}"]`)).toBeNull();
    expect(container.querySelector('[data-pass-segment="later"]')).not.toBeNull();
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
   */
  it('gives the side column to the chart on wide and keeps it in the page on compact', () => {
    withSky();
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByTestId('live-side').closest('[data-testid="chart-aside"]')).toBeNull();
    expect(screen.getByTestId('live-side').parentElement).toBe(screen.getByTestId('live-page'));
    unmount();
    media = stubMatchMedia(1280, 800);
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-side').closest('[data-testid="chart-aside"]')).not.toBeNull();
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-aside', 'true');
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
    expect([...screen.getByTestId('live-side').children].map((el) => el.getAttribute('data-testid'))).toEqual(['status-strip', 'playback-row', 'live-actions']);
    // The narrowest wide page: the same.
    act(() => {
      media?.setSize(WIDE_MIN_PX, 700);
    });
    expect(screen.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'true');
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

  /** R54 (FR-LIVE-7 as amended v1.1.1, FR-TRAJ-5, D-268): the wide rows, and the stepping row only with touch. */
  it('on wide puts the hidden-objects toggle on the playback row and draws the stepping row only where the page has touch', () => {
    withSky();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    // Compact, no touch: the toggle is on the actions row, and the block is the readout and the stripe alone.
    expect(within(screen.getByTestId('live-actions')).getByTestId('live-hidden-toggle')).toBeInTheDocument();
    expect(within(screen.getByTestId('playback-row')).queryByTestId('live-hidden-toggle')).toBeNull();
    expect([...screen.getByTestId('stripe-block').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-readout', 'time-stripe']);
    unmount();
    media = stubMatchMedia(1280, 800);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'false');
    expect(within(screen.getByTestId('playback-row')).getByTestId('live-hidden-toggle')).toBeInTheDocument();
    expect(within(screen.getByTestId('live-actions')).queryByTestId('live-hidden-toggle')).toBeNull();
    // The side column keeps the compact order less the stripe block, which is the frame's row under the box on wide (D-315).
    expect([...screen.getByTestId('live-side').children].map((el) => el.getAttribute('data-testid'))).toEqual(['status-strip', 'playback-row', 'live-actions']);
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('chart-stripe'));
    expect([...screen.getByTestId('stripe-block').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-readout', 'time-stripe', 'step-controls']);
  });

  /** R48 (FR-TRAJ-1, FR-TRAJ-3, US-22 AC1..AC3, D-189): the arcs appear, grow and fade with the shown instant, and the legend says the same. */
  it('scrubs a pass through ahead, live, linger and gone, with the drawn arc and the legend state following (FR-TRAJ-1)', () => {
    withSky();
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const stripe = screen.getByTestId('time-stripe');
    const arc = (): string | null => container.querySelector('[data-drawing] [data-pass-id="later"]')?.getAttribute('data-arc') ?? null;
    const legendState = (): string | null => container.querySelector('[data-testid="chart-legend"] [data-pass-id="later"]')?.getAttribute('data-state') ?? null;
    // Three hours before its rise, `later` is not drawn and not listed.
    expect(arc()).toBeNull();
    expect(legendState()).toBeNull();
    // `rise ▶|`: one tap lands on the rise (US-22 AC6) — the arc is live from its rise, with the marker.
    fireEvent.click(screen.getByRole('button', { name: 'Next rise' }));
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

  /** R48 (FR-TRAJ-4, FR-TRAJ-5, US-22 AC5, AC6): the readout above the stripe and the stepping row under it. */
  it('shows the readout above the stripe with the weekday past midnight, and the stepping row lands on rises and steps minutes', () => {
    withSky();
    // R54 (FR-TRAJ-5): the stepping row is drawn where the page has touch.
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    render(<LivePage link={null} onLeave={() => undefined} />);
    const stripe = screen.getByTestId('time-stripe');
    const block = screen.getByTestId('stripe-block');
    const readout = within(block).getByTestId('time-readout');
    // The block's order: the readout, the stripe, the stepping row.
    expect([...block.children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-readout', 'time-stripe', 'step-controls']);
    expect(readout).toHaveTextContent(/^09:48$/);
    expect(readout).toHaveAttribute('data-today', 'true');
    // Forward ten minutes, twice; back one.
    fireEvent.click(screen.getByRole('button', { name: 'Forward ten minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward ten minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back one minute' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 19 * 60_000);
    expect(readout).toHaveTextContent(/^10:07$/);
    // The next rise is `later`, then `tomorrow`; from there nothing ahead, and `later` is behind.
    fireEvent.click(screen.getByRole('button', { name: 'Next rise' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(later.start.t);
    fireEvent.click(screen.getByRole('button', { name: 'Next rise' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(tomorrow.start.t);
    expect(screen.getByRole('button', { name: 'Next rise' })).toBeDisabled();
    // Past midnight UTC (the zone is unknown here): the weekday is in front of the clock.
    expect(readout).toHaveTextContent(/^Sat \d\d:\d\d$/);
    expect(readout).toHaveAttribute('data-today', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Previous rise' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(later.start.t);
  });

  /** R48 (FR-WIN-6, US-21 AC5): the window shows real time, without the stripe block and the playback row. */
  it('window mode returns the instant to now and hides the stripe block and playback; leaving restores them (FR-WIN-6)', () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next rise' }));
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(later.start.t);
    expect(screen.getByRole('button', { name: 'Now' })).toBeEnabled();
    // R47 registers the view; the page reads the preference by name and needs nothing from it.
    act(() => {
      appStore.getState().setChartView('window' as unknown as ChartView);
    });
    expect(screen.getByTestId('live-side')).toHaveAttribute('data-window-mode', 'true');
    expect(screen.queryByTestId('stripe-block')).toBeNull();
    expect(screen.queryByTestId('time-stripe')).toBeNull();
    expect(screen.queryByTestId('playback-controls')).toBeNull();
    // The strip stays, at real time; so do the actions.
    expect(screen.getByTestId('live-time')).toHaveTextContent(/^Time 09:48:24 UTC$/);
    expect(screen.getByRole('button', { name: 'Hidden objects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share this sky' })).toBeInTheDocument();
    // Leaving the window: the block and the row are back, and the instant is still real time.
    act(() => {
      appStore.getState().setChartView('polar');
    });
    expect(screen.getByTestId('live-side')).toHaveAttribute('data-window-mode', 'false');
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(T);
    expect(screen.getByRole('button', { name: 'Now' })).toBeDisabled();
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
   * R59 (FR-FOL-1, FR-FOL-3, US-10, US-21 AC8): the control opens the sky
   * window over whatever view is showing. Entering it is FR-WIN-6's route by
   * any other name — the instant goes back to real time, the stripe block and
   * the playback row go — and the second press gives the view back with them.
   */
  const withPhone = (): void => {
    vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
      return undefined;
    });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
  };
  /** A reading with a north in it: what the press waits for before it opens anything. */
  const reading = (absolute: boolean): void => {
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 270, absolute }));
    });
  };

  it.each(['polar', 'dome'] as const)('the follow control opens the window over the %s at real time and the second press gives that view back (FR-FOL-1, FR-FOL-3)', (from) => {
    withPhone();
    withSky();
    act(() => {
      appStore.getState().setChartView(from);
    });
    render(<LivePage link={null} onLeave={() => undefined} />);
    // Somewhere other than now, so that entering the window is seen to bring it back (FR-WIN-6).
    fireEvent.click(screen.getByRole('button', { name: 'Next rise' }));
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(later.start.t);

    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    // The press arms the sensor; the reading is what opens the window (F-42's lesson, D-276).
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('live-side')).toHaveAttribute('data-window-mode', 'false');
    reading(true);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // FR-WIN-5 as amended (D-277): the window is the view, and the reader's own preference is untouched.
    expect(appStore.getState()).toMatchObject({ chartView: 'window', savedChartView: from, viewOverride: 'window' });
    expect(screen.getByTestId('live-side')).toHaveAttribute('data-window-mode', 'true');
    expect(screen.queryByTestId('stripe-block')).toBeNull();
    expect(screen.queryByTestId('playback-controls')).toBeNull();
    expect(screen.getByTestId('live-time')).toHaveTextContent(/^Time 09:48:24 UTC$/);
    // R44 (FR-WIN-3, US-21 AC6, D-185): the strip names the correction the window is applying.
    expect(screen.getByTestId('live-heading')).toHaveTextContent('Heading true north, declination +1.1°');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(appStore.getState()).toMatchObject({ chartView: from, savedChartView: from, viewOverride: null });
    expect(screen.getByTestId('live-side')).toHaveAttribute('data-window-mode', 'false');
    expect(screen.getByTestId('stripe-block')).toBeInTheDocument();
    expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(T);
    expect(screen.queryByTestId('live-heading')).toBeNull();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  /**
   * R59 (FR-FOL-2): a relative-only device has no north to point the window at,
   * so nothing opens: the note, the view where it was, and the control
   * unpressed. R39's F-40 rule is gone with the dome's following — the control
   * belongs to both drawn views now — but its shape survives here: the state
   * says what the chart is doing and nothing else.
   */
  it('leaves the view alone with a note where the phone gives no heading, and is not shown on the window the reader chose (FR-FOL-2, FR-LIVE-8 as amended)', () => {
    withPhone();
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    reading(false);
    expect(screen.getByTestId('follow-note')).toHaveTextContent(en.live.followRelative);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(appStore.getState()).toMatchObject({ chartView: 'polar', viewOverride: null });
    expect(screen.getByTestId('live-side')).toHaveAttribute('data-window-mode', 'false');

    // The window chosen from the view control: following is what the view is, so there is no control to press…
    act(() => {
      appStore.getState().setChartView('window');
    });
    expect(screen.queryByTestId('follow-phone')).toBeNull();
    // …and the strip's declination line follows the window being shown, whichever route opened it (D-276).
    expect(screen.getByTestId('live-heading')).toHaveTextContent('Heading true north, declination +1.1°');
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
