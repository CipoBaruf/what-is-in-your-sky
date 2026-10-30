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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { I18nProvider } from '../../i18n/useT';
import { WIDE_MIN_PX } from '../../lib/layout';
import { isoInstant, type LiveLink } from '../../lib/shareLinks';
import { formatClock } from '../../lib/timeFormat';
import { skyBodiesAt } from '../../lib/skyBodies';
import type { Observer, Pass } from '../../model';
import type { NowItem, NowState } from '../../model';
import { resetOrientationAccess } from '../components/guide/skychart/window/orientationAccess';
import { appStore, setLiveNowClient, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { stubMatchMedia, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { MOON_FIXTURE } from '../../../tests/support/moonFixtures';
import { LEGEND_OPEN_ROWS } from '../components/guide/skychart/ChartFrame';
import { LIVE_WINDOW_MS, livePasses } from '../../lib/livePasses';
import { TONIGHT_LEAD_MS } from '../../lib/tonightJump';
import { LivePage, TICK_MS, visibleCount } from './Live';
import { COMPACT_CONDITIONAL, LIVE_ROW_TEST_ID, LIVE_ROWS, rowsFor } from './liveRows';
import { clearPlaceRequest, placeRequested } from './home/placeRequest';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();

/** R66 (V13-6, D-350): the way into the sky screen — the view control's "window" option, on this page as on the pass detail. */
const HOUR = 3_600_000;

/**
 * R77 (FR-WATCH-1, FR-WATCH-4): the stripe, the step row and the playback row are the scrubbing state's, and
 * the page opens watching. A test that drives them enters scrubbing first, with `[ scrub ]` — which holds the
 * instant the page was showing, so nothing a test asserts about the instant moves.
 *
 * R144 (FR-WATCH-1 as amended v2.7): `[ scrub ]` is wide's alone now, so the tests that drive the stripe render
 * the wide page. On compact the way to hold the instant on screen is a key on the time track — `Home` lands on the
 * span's start, which is real time — and `hold()` is that.
 */
const scrub = (): void => {
  fireEvent.click(screen.getByTestId('live-scrub'));
};
const track = (): HTMLElement => screen.getByTestId('time-track-bar');
const hold = (): void => {
  fireEvent.keyDown(track(), { key: 'Home' });
};
/** The compact page's shown instant, as the track's slider says it. */
const shownAt = (): number => Number(track().getAttribute('aria-valuenow'));
/** The chip beside the shown time: `now`, or the offset (`ahead` / `behind`). */
const chip = (): HTMLElement => screen.getByTestId('shown-chip');
/** R144 (FR-TONIGHT-1, D-897): the page's lead before a rise, in ms. */
const LEAD = TONIGHT_LEAD_MS;

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

  /*
   * R89 (FR-LIVE-1 as amended v2.1, FR-FAIL-6, FR-OFF-8; F-92, F-75): the three states before the page can
   * draw are told apart, each with its own text and control, and a stored run is a sky to draw.
   */
  describe('before it can draw (R89)', () => {
    const failure = { kind: 'offline', detail: 'TypeError: Failed to fetch' } as const;

    it('says no place with [ set a place ], which goes home to set one (FR-FIRST-1, F-75)', async () => {
      const onLeave = vi.fn();
      const hashes: string[] = [];
      const onHash = (): void => {
        hashes.push(window.location.hash);
      };
      window.addEventListener('hashchange', onHash);
      window.history.replaceState(null, '', '#live');
      const { container } = render(<LivePage link={null} onLeave={onLeave} />);
      const page = screen.getByTestId('live-page');
      expect(page).toHaveAttribute('data-state', 'inert');
      const inert = screen.getByTestId('live-inert');
      expect(inert).toHaveAttribute('data-inert', 'no-place');
      expect(inert).toHaveTextContent(en.live.noPlace);
      expect(screen.queryByTestId('live-loading')).toBeNull();
      expect(screen.queryByTestId('failure-line')).toBeNull();
      expect(screen.queryByTestId('sky-chart')).toBeNull();
      expect(screen.queryByTestId('status-strip')).toBeNull();
      expect(await axe(container)).toHaveNoViolations();
      fireEvent.click(screen.getByRole('button', { name: en.live.setPlace }));
      window.removeEventListener('hashchange', onHash);
      expect(placeRequested()).toBe(true);
      clearPlaceRequest();
      expect(hashes).toEqual(['']);
      // The return control is still there, and still returns.
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('says loading, with the bead moving, while the elements load — and on a cold open, before the effects start', () => {
      for (const elements of [{ status: 'idle' }, { status: 'loading' }] as const) {
        withSky([], elements);
        const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
        const inert = screen.getByTestId('live-inert');
        expect(inert).toHaveAttribute('data-inert', 'loading');
        expect(screen.getByTestId('live-loading')).toHaveTextContent(en.live.loadingElements);
        expect(within(inert).getByTestId('mark')).toHaveAttribute('data-mark-running', 'true');
        // F-92: a cold `#live` does not flash the failed text.
        expect(screen.queryByTestId('failure-line')).toBeNull();
        expect(inert).not.toHaveTextContent(en.failure.offline(en.failure.what.elements));
        expect(screen.queryByRole('button', { name: en.failure.retry })).toBeNull();
        expect(screen.getByTestId('live-place')).toHaveTextContent('−38.93, −67.99');
        expect(screen.queryByTestId('sky-chart')).toBeNull();
        unmount();
      }
    });

    it('says failed with the failure line, and [ retry ] is retryElements (FR-FAIL-1, FR-FAIL-6)', async () => {
      withSky([], { status: 'error', failure });
      const retryElements = vi.fn(() => {
        appStore.setState({ elements: { status: 'loading' } });
      });
      act(() => {
        appStore.setState({ retryElements });
      });
      const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
      const inert = screen.getByTestId('live-inert');
      expect(inert).toHaveAttribute('data-inert', 'failed');
      expect(screen.getByTestId('failure-sentence')).toHaveTextContent(`${en.failure.offline(en.failure.what.elements)} ${en.live.failedInstead}`);
      expect(screen.getByTestId('failure-sentence').textContent).not.toMatch(/HTTP|\d{3}|Error:/);
      expect(screen.getByTestId('failure-detail')).toHaveTextContent(failure.detail);
      expect(screen.getByTestId('failure-detail')).not.toBeVisible();
      expect(screen.queryByTestId('live-loading')).toBeNull();
      expect(await axe(container)).toHaveNoViolations();
      fireEvent.click(screen.getByRole('button', { name: en.failure.retry }));
      expect(retryElements).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('live-inert')).toHaveAttribute('data-inert', 'loading');
      act(() => {
        appStore.setState({ elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-2', status: 'done', observer, passes: all, hasDarkness: true } });
      });
      expect(screen.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
    });

    it('opens on the stored passes with no usable elements (FR-OFF-8), by place and not by object', () => {
      const stored: Observer = { ...observer };
      act(() => {
        appStore.getState().setChartView('polar');
        appStore.setState({ observer, elements: { status: 'error', failure }, passes: { ...IDLE_PASSES, status: 'done', observer: stored, passes: all, hasDarkness: true, storedAt: NOW, standIn: true } });
      });
      const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
      expect(screen.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
      expect(screen.queryByTestId('live-inert')).toBeNull();
      expect(container.querySelector(`[data-drawing] [data-pass-id="${pass.id}"]`)).not.toBeNull();
    });

    it('stays failed for another place’s stored passes', () => {
      act(() => {
        appStore.setState({ observer, elements: { status: 'error', failure }, passes: { ...IDLE_PASSES, status: 'done', observer: { ...observer, lat: 10 }, passes: all, storedAt: NOW, standIn: true } });
      });
      render(<LivePage link={null} onLeave={() => undefined} />);
      expect(screen.getByTestId('live-inert')).toHaveAttribute('data-inert', 'failed');
    });
  });

  /* R89 (FR-VISIT-2, FR-VISIT-3): the visit notice and the link's moment notes head the live page too. */
  describe('links and visits (R89)', () => {
    const at = (t: number): LiveLink => ({ kind: 'live', observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t });

    it('opens a passed moment watching, with the note', () => {
      withSky();
      const link = at(T - 2 * HOUR);
      act(() => {
        appStore.setState({ linkResult: { kind: 'own', link, note: 'past' } });
      });
      render(<LivePage link={link} onLeave={() => undefined} />);
      // R144 (FR-TONIGHT-7): on compact the chip beside the shown time says the state.
      expect(chip()).toHaveAttribute('data-kind', 'now');
      expect(screen.getByTestId('link-note')).toHaveAttribute('data-note', 'past');
      expect(screen.getByTestId('link-note')).toHaveTextContent(/which has passed\. Showing now\./);
    });

    it('holds a moment 30 h ahead at the end of the span, with the note, and releases it when real time gets there', () => {
      withSky();
      const link = at(T + 30 * HOUR);
      act(() => {
        appStore.setState({ linkResult: { kind: 'own', link, note: 'far' } });
      });
      render(<LivePage link={link} onLeave={() => undefined} />);
      expect(chip()).toHaveAttribute('data-kind', 'ahead');
      expect(chip()).toHaveTextContent(/24 h 00 min/);
      expect(shownAt()).toBe(T + LIVE_WINDOW_MS);
      expect(screen.getByTestId('link-note')).toHaveAttribute('data-note', 'far');
      act(() => {
        vi.advanceTimersByTime(LIVE_WINDOW_MS + TICK_MS);
      });
      expect(chip()).toHaveAttribute('data-kind', 'now');
    });

    it('carries the visit notice under the top row while visiting', () => {
      withSky();
      act(() => {
        appStore.setState({ visiting: { ...observer, lat: 48.86, lon: 2.35, label: '48.86, 2.35' } });
      });
      render(<LivePage link={null} onLeave={() => undefined} />);
      const area = screen.getByTestId('live-top-area');
      expect(within(area).getByTestId('visit-notice')).toHaveAttribute('role', 'status');
      expect(within(area).getByRole('button', { name: en.visit.back })).toBeInTheDocument();
      expect(within(area).getByRole('button', { name: en.visit.keep })).toBeInTheDocument();
    });
  });

  it('draws the passes of the coming 24 h in series colours, marks the one under way, and counts it in the strip (FR-LIVE-2, FR-LIVE-3, FR-LIVE-10)', async () => {
    withSky();
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
    const figure = screen.getByRole('figure', { name: en.chart.liveLabel });
    expect(figure.querySelector('figcaption')).toBeNull();
    // R150 (FR-GYRO-10): jsdom is the compact shell, where the list stands open at the sheet's end.
    // R45: the legend's rows carry the pass id too, so the drawing's are read inside the drawing.
    // R48 (FR-TRAJ-1): at the shown instant only the pass under way is drawn — `later` (3 h on) and
    // `tomorrow` are hidden until their rise is within ARC_LOOKAHEAD — and it keeps its series colour.
    const drawn = [...container.querySelectorAll('[data-drawing] [data-pass-id]')].map((el) => [el.getAttribute('data-pass-id'), el.getAttribute('data-series'), el.getAttribute('data-arc')]);
    expect(drawn).toEqual([[pass.id, '1', 'live']]);
    expect(container.querySelectorAll('[data-testid="chart-legend"] [data-pass-id]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-marker="now"]')).toHaveLength(1);
    // R70 (FR-SPAN-1, FR-SPAN-2) → R144 (FR-TONIGHT-3): the time track carries every pass of the coming 24 h as a tick.
    expect([...container.querySelectorAll('[data-pass-tick]')].map((el) => el.getAttribute('data-pass-tick'))).toEqual([pass.id, 'later', 'tomorrow']);
    // R144 (FR-TONIGHT-7): jsdom is the compact shell — the headline is the shown time with the `now` chip, and the
    // context line, with the ISS up, is its name and what it does next; no conditions line and no clock field.
    expect(screen.getByTestId('shown-time')).toHaveTextContent(/^Shown time: 09:48:24 UTC now$/);
    expect(chip()).toHaveAttribute('data-kind', 'now');
    const context = screen.getByTestId('context-line');
    expect(context).toHaveAttribute('data-kind', 'up');
    expect(context.textContent?.startsWith(`${pass.name} · `)).toBe(true);
    expect(context.textContent).toMatch(/ · peaks [NESW]{1,3} \d+:\d\d$/);
    expect(screen.queryByTestId('status-strip')).toBeNull();
    expect(screen.queryByTestId('live-time')).toBeNull();
    // FR-MOON-3 as amended: the Moon's phase and illumination are the list panel's Moon line.
    const expected = skyBodiesAt(T, observer);
    expect(screen.queryByTestId('live-moon')).toBeNull();
    // R132 (D-842): the legend is the layout's `list` slot, outside the figure. The bodies arrive with the astronomy chunk.
    await act(async () => {
      await Promise.resolve();
    });
    const moonLine = container.querySelector('[data-testid="chart-legend"] [data-body="moon"]');
    if (moonLine !== null) expect(moonLine).toHaveTextContent(`${String(Math.round(expected.moon.illuminatedFraction * 100))} %`);
    // R45 (FR-DOME-6 as amended): the Sun is a glow in the raster and a legend line, not a caption in the drawing.
    expect(container.querySelector('[data-testid="chart-legend"] [data-body="sun"]') !== null).toBe(expected.sun.altDeg > -18 && expected.sun.altDeg < 0);
    expect(figure.querySelector('[data-anchor="sun"]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
    // R77 (FR-WATCH-4) → R144 (FR-TONIGHT-6): the stripe is wide's; the compact page has the track in both states.
    expect(container.querySelectorAll('[data-pass-segment]')).toHaveLength(0);
    hold();
    expect(chip()).not.toHaveAttribute('data-kind', 'now');
    expect(container.querySelectorAll('[data-pass-segment]')).toHaveLength(0);
    expect(screen.getByTestId('live-track')).toBeInTheDocument();
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
    // R144 (FR-TONIGHT-7): nothing up — the context line is the sky and the next rise, `later` at 12:48.
    const context = screen.getByTestId('context-line');
    expect(context).toHaveAttribute('data-kind', 'sky');
    expect(context).toHaveTextContent(/next 12:48$/);
    // The window moved with real time: the golden pass is over and no longer drawn. `later` is in the
    // window — a tick on the track — and, three hours from its rise, not yet on the chart (FR-TRAJ-1).
    expect(container.querySelector(`[data-pass-id="${pass.id}"]`)).toBeNull();
    expect(container.querySelector('[data-pass-tick="later"]')).not.toBeNull();
    expect(container.querySelector('[data-drawing] [data-pass-id="later"]')).toBeNull();
  });

  it('shows the instant a #live?… link names instead of real time, and shares it back in the same form (FR-LIVE-9, FR-SHARE-1)', () => {
    withSky();
    const t = later.start.t + 30_000;
    render(<LivePage link={{ kind: 'live', observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t }} onLeave={() => undefined} />);
    // R144 (FR-TONIGHT-7): the held instant is the headline, `12:48` with its offset, and the context line names the pass up at it.
    expect(screen.getByTestId('shown-time')).toHaveTextContent(/^Shown time: 12:48 UTC in 3 h 00 min$/);
    expect(shownAt()).toBe(t);
    // The marker is on the pass that contains the link's instant, not the one under way in real time.
    const marker = screen.getByTestId('live-dome').querySelector('[data-marker="now"]');
    expect(marker?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', 'later');
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^Tiangong · /);
    // R77 (FR-WATCH-1 c, D-446): a link with `t` opens scrubbing — the instant is held, so the page says so — and
    // the share action names the moment it carries. FR-TONIGHT-1: a link's `t` is never jumped from.
    expect(chip()).toHaveAttribute('data-kind', 'ahead');
    // R148 (FR-FULL-10): a link's `t` opens that instant with no card.
    expect(screen.queryByTestId('live-card')).toBeNull();
    expect(screen.getByRole('button', { name: 'Share this moment' })).toBeInTheDocument();
    expect(shownAt()).toBe(t);
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
    fireEvent.click(screen.getByRole('button', { name: 'Share this moment' }));
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.href.split('#')[0] ?? ''}#live?lat=-38.93&lon=-67.99&alt=0&t=2026-09-11T12:00:00Z`);
  });

  it('returns on Esc and on the return control (FR-LIVE-1)', () => {
    withSky();
    const onLeave = vi.fn();
    render(<LivePage link={null} onLeave={onLeave} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onLeave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onLeave).toHaveBeenCalledTimes(2);
  });

  /**
   * R85 (FR-COMP-7, D-549; F-82): on compact the return control draws `[ ← ]` and is named by the word, in
   * both languages, and on wide since R129 (FR-FLOW-3). R144 (FR-TONIGHT-4, FR-TONIGHT-6): the way back to real
   * time on compact is the taps row's `[ now ]` / `[ ahora ]`, disabled while the page is on real time. R148
   * (FR-FULL-2, D-920, D-934): the top row and the mark have left compact — `[ ← ]` heads the sky with the shown
   * time, in the page's banner, and the page's name with the place is the `h1`, visually hidden.
   */
  it.each([
    ['en', 'Back', 'now', 'live'],
    ['es', 'Volver', 'ahora', 'en vivo'],
  ] as const)('draws [ ← ] named %s on compact, and the way back to real time on the taps row (FR-COMP-7, FR-TONIGHT-4)', (locale, name, nowWord, pageName) => {
    withSky();
    const { unmount } = render(
      <I18nProvider locale={locale}>
        <LivePage link={null} onLeave={() => undefined} />
      </I18nProvider>,
    );
    const back = screen.getByRole('button', { name });
    expect(back).toHaveTextContent(/^←$/);
    const head = screen.getByTestId('live-head');
    expect(within(head).getByRole('button')).toBe(back);
    expect(within(head).getByTestId('shown-time')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toContainElement(head);
    expect(screen.queryByTestId('live-top-row')).toBeNull();
    expect(screen.queryByTestId('live-state-mark')).toBeNull();
    expect(screen.queryByTestId('header-page')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${pageName} · ${observer.label}`);
    const now = within(screen.getByTestId('live-taps')).getByRole('button', { name: nowWord });
    expect(now).toBeDisabled();
    hold();
    expect(now).toBeEnabled();
    expect(screen.queryByTestId('live-scrub')).toBeNull();
    expect(screen.queryByTestId('live-now')).toBeNull();
    unmount();
    media = stubMatchMedia(1280, 800);
    render(
      <I18nProvider locale={locale}>
        <LivePage link={null} onLeave={() => undefined} />
      </I18nProvider>,
    );
    // R129 (FR-FLOW-3, D-845): the wide row's way back is the header's `[ ← ]` too.
    expect(screen.getByRole('button', { name })).toHaveTextContent(/^←$/);
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
      ).toEqual(['Window', 'Polar', 'Dome']);
      // The option is a mode: until it is tapped the page is the dome, with every row its state has.
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
      expect(screen.queryByTestId('sky-screen')).toBeNull();
      expect(screen.getByTestId('live-track')).toBeInTheDocument();
      hold();
      expect(screen.getByTestId('live-track')).toBeInTheDocument();
      expect(screen.getByTestId('live-taps')).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    }
  });

  it('carries no language or theme switch at either width: the top row is the header, told it is the live page (R129, D-845, V26-10)', () => {
    withSky();
    // jsdom has no `matchMedia`: the compact shell. The top row is the return control and the place.
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'true');
    expect(screen.queryByRole('group', { name: 'Language' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Theme' })).toBeNull();
    // R148 (FR-FULL-4): the place is the sheet's head's.
    expect(screen.queryByTestId('live-top-row')).toBeNull();
    expect(within(screen.getByTestId('sheet-head')).getByTestId('sheet-place')).toHaveTextContent(observer.label);
    expect(screen.getByRole('group', { name: 'Chart view' })).toBeInTheDocument();
    // R48 (FR-LIVE-7 as amended): no "drag the dome" hint on this page, whichever view.
    expect(screen.queryByText(en.chart.domeHint)).toBeNull();
    unmount();
    media = stubMatchMedia(1280, 800);
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'false');
    expect(screen.queryByRole('group', { name: 'Language' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Theme' })).toBeNull();
    expect(within(screen.getByTestId('live-top-row')).getByTestId('live-link')).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByTestId('live-top-row')).getByTestId('live-place')).toHaveTextContent(observer.label);
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
  /**
   * R132 (FR-FLOW-4, D-842): the page is `SkyViewLayout`'s at every width — the column on compact, the box beside the
   * layout's own rail on wide, where the frame cuts the box inside the drawing slot (`stacked`, the dome's aspect)
   * and carries no aside of its own any more (R61's D-312 rail is the layout's).
   */
  it('is the layout’s full form on compact and its box and rail at every wide width, the frame cutting the box inside the slot', () => {
    withSky();
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'true');
    // R148 (FR-FULL-1, D-919): the full form — the drawing, the overlay and the sheet, and no row outside them.
    expect(screen.getByTestId('live-layout')).toHaveAttribute('data-shape', 'full');
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-form', 'full');
    // R92 (D-529): a cell of the page's grid, through the `display: contents` main.
    expect(screen.getByTestId('live-layout').parentElement).toBe(screen.getByRole('main'));
    expect(screen.getByRole('main').parentElement).toBe(screen.getByTestId('live-page'));
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'polar');
    expect([...screen.getByTestId('live-layout').querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot'))).toEqual(['drawing', 'overlay', 'sheet']);
    expect(screen.getByTestId('live-layout')).toHaveAttribute('data-readout', 'sheet');
    expect(screen.getByTestId('sky-readout-toggle').closest('[data-slot]')).toHaveAttribute('data-slot', 'sheet');
    const sheet = screen.getByTestId('live-layout').querySelector('[data-slot="sheet"]') as HTMLElement;
    for (const id of ['live-controls', 'live-sheet', 'live-actions', 'live-track', 'live-taps', 'live-context', 'live-view-row', 'live-facing']) expect(within(sheet).getByTestId(id), id).toBeInTheDocument();
    unmount();
    // D-386: 964, 1280 and 1660 are one layout — the rail beside the cut box.
    for (const [width, height] of [
      [WIDE_MIN_PX, 700],
      [1280, 800],
      [1660, 1080],
    ] as const) {
      media?.restore();
      media = stubMatchMedia(width, height);
      const wide = render(<LivePage link={null} onLeave={() => undefined} />);
      expect(screen.getByTestId('live-layout'), `the rail at ${String(width)} px`).toHaveAttribute('data-shape', 'rail');
      expect(screen.getByTestId('live-layout')).not.toHaveAttribute('data-readout');
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-aside', 'false');
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stacked', 'true');
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'true');
      // The rail's order: the answer, the view row, the facing row, the legend and the conditions, the foot (no hint on the polar chart).
      expect([...screen.getByTestId('live-layout').querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot'))).toEqual(['answer', 'viewRow', 'readout', 'drawing', 'picker', 'list', 'foot']);
      wide.unmount();
    }
    media?.restore();
    media = stubMatchMedia(1660, 1080);
    render(<LivePage link={null} onLeave={() => undefined} />);
    // R77 (FR-WATCH-4): watching there is no scrub block; scrubbing it is the rail's foot (FR-FLOW-4 wide: the stripe and the actions).
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'false');
    expect(screen.queryByTestId('stripe-block')).toBeNull();
    scrub();
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'false');
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('live-rail-foot'));
  });

  /**
   * R71 (FR-LEG-7, FR-LEG-8; D-388) → R150 (FR-GYRO-10, D-949, D-951): on compact the list stands open at the sheet's
   * end under "Satellites (n)", with no control to open it. `n` is the rows `lib/legend.ts` derives — the drawn
   * passes — and not the panel's lines: on an empty sky the heading reads `Satellites (0)` while the list still
   * carries a line, which is the number OQ-26 says it must not get wrong.
   */
  it.each([
    ['en', en],
    ['es', es],
  ] as const)('heads the open list “Satellites (n)” in %s, counting the drawn passes, not the panel’s lines (FR-GYRO-10, D-388)', (locale, m) => {
    withSky();
    render(
      <I18nProvider locale={locale}>
        <LivePage link={null} onLeave={() => undefined} />
      </I18nProvider>,
    );
    const word = locale === 'en' ? 'Satellites' : 'Satélites';
    expect(screen.queryByTestId('live-legend-toggle')).toBeNull();
    const satellites = screen.getByTestId('live-satellites');
    const heading = within(satellites).getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent(`${word} (1)`);
    expect(satellites).toHaveAccessibleName(`${word} (1)`);
    // The heading's row: the heading, then the hidden toggle at its end (D-905's place), then the list.
    const head = screen.getByTestId('live-satellites-head');
    expect([...head.children].map((el) => el.getAttribute('data-testid') ?? el.tagName.toLowerCase())).toEqual(['h2', 'live-hidden-toggle']);
    expect(within(head).getByTestId('live-hidden-toggle')).toHaveAccessibleName(m.live.hiddenToggle);
    expect([...satellites.children].map((el) => el.getAttribute('data-testid') ?? el.getAttribute('data-chart-slot'))).toEqual(['live-satellites-head', 'list']);
    // Open with no tap, and listing exactly the passes the drawing draws.
    const panel = screen.getByTestId('chart-legend-slot');
    expect(satellites).toContainElement(panel);
    expect(panel.querySelectorAll('[data-pass-id]')).toHaveLength(1);
    // Five passes up at once: the heading counts them all.
    act(() => {
      appStore.setState({ passes: { ...IDLE_PASSES, jobId: 'job-2', status: 'done', observer, passes: [pass, ...[1, 2, 3, 4].map((n) => shifted(`twin-${String(n)}`, `Twin ${String(n)}`, n * 1000))], hasDarkness: true } });
    });
    expect(heading).toHaveTextContent(`${word} (5)`);
    expect(screen.getByTestId('chart-legend-slot').querySelectorAll('[data-pass-id]')).toHaveLength(5);
    // An empty sky: `(0)`, and the list says so in a line of its own rather than standing blank.
    act(() => {
      appStore.setState({ passes: { ...IDLE_PASSES, jobId: 'job-3', status: 'done', observer, passes: [], hasDarkness: true } });
    });
    expect(heading).toHaveTextContent(`${word} (0)`);
    const empty = screen.getByTestId('legend-empty');
    expect(empty).toHaveTextContent(m.chart.legend.empty);
    expect(within(empty).getByRole('status')).toBeInTheDocument();
    expect(screen.getByTestId('chart-legend-slot').querySelectorAll('[data-pass-id]')).toHaveLength(0);
  });

  /**
   * R71 (FR-LEG-7, V14-5): the panel is exactly two `--tap` rows whatever it holds, and the box's height
   * changes on the reader's tap and on nothing the sky does. jsdom lays nothing out, so the fixed height is
   * read off the stylesheet — a `height`, not a `max-height`, with the four-row cap of the old layout undone —
   * and what is asserted here is that neither the panel nor the box is given anything of its own that varies
   * with the rows: the drawing's box keeps the same markup while the list goes from one row to five to none.
   * `live-compact.spec.ts` is where the pixels are measured.
   */
  it('gives the open panel a fixed height that the sky cannot change (FR-LEG-7, V14-5)', () => {
    const css = readFileSync('src/ui/components/guide/skychart/ChartFrame.module.css', 'utf8');
    expect(css).toMatch(/\.fill\[data-legend-open='true'\] \.legend \{[^}]*height: calc\(var\(--legend-open-rows, 2\) \* var\(--legend-row\)\);[^}]*max-height: none;[^}]*overflow-y: auto;/);
    expect(LEGEND_OPEN_ROWS).toBe(2);
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    // R150 (FR-GYRO-10): the list is open with no tap.
    expect(screen.getByTestId('chart-legend-slot')).toBeInTheDocument();
    // R71 review: the row count lives in `LEGEND_OPEN_ROWS` and reaches the stylesheet as `--legend-open-rows`,
    // so the constant and the declaration above cannot drift apart.
    expect(screen.getByTestId('chart-frame').style.getPropertyValue('--legend-open-rows')).toBe(String(LEGEND_OPEN_ROWS));
    const box = screen.getByTestId('chart-box');
    const shape = (): string => `${box.className}|${box.getAttribute('style') ?? ''}`;
    const panelShape = (): string => {
      const panel = screen.getByTestId('chart-legend-slot');
      return `${panel.className}|${panel.getAttribute('style') ?? ''}`;
    };
    const before = [shape(), panelShape()];
    for (const passes of [[pass, ...[1, 2, 3, 4].map((n) => shifted(`twin-${String(n)}`, `Twin ${String(n)}`, n * 1000))], []]) {
      act(() => {
        appStore.setState({ passes: { ...IDLE_PASSES, jobId: `job-${String(passes.length)}`, status: 'done', observer, passes, hasDarkness: true } });
      });
      expect([shape(), panelShape()], `${String(passes.length)} passes move neither the box nor the panel`).toEqual(before);
    }
  });

  /**
   * R61 (FR-LIVE-7 and FR-TRAJ-4 as amended v1.2.1, D-314, D-315, V12-12): on every wide page the stripe block
   * is the frame's row under the box rather than a row of the rail — the same element, placed there — and the
   * chart is handed the dome's aspect so the frame cuts the box to it. Compact keeps both in the page: a phone
   * never has a cut box, and its stripe is a row of the page under the drawing as it has been since R48.
   */
  it('puts the stripe block at the rail’s foot on wide at every width, hands the chart the dome’s aspect there, and keeps it in the column’s foot on compact', () => {
    withSky();
    media = stubMatchMedia(1920, 1080);
    render(<LivePage link={null} onLeave={() => undefined} />);
    scrub();
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'false');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'true');
    // R132 (FR-FLOW-4 wide): the rail's head is the answer — the indicator line and the headline; the conditions follow the legend in the list; the foot is the scrub block and the actions.
    expect(screen.getByTestId('live-rail-head').closest('[data-slot]')).toHaveAttribute('data-slot', 'answer');
    expect(screen.getByTestId('status-strip').closest('[data-slot]')).toHaveAttribute('data-slot', 'list');
    expect(screen.getByTestId('live-rail-foot').closest('[data-slot]')).toHaveAttribute('data-slot', 'foot');
    expect([...screen.getByTestId('live-rail-foot').children].map((el) => el.getAttribute('data-testid'))).toEqual(['stripe-block', 'live-actions']);
    // The narrowest wide page: the same foot, the same rail (R71, D-386).
    act(() => {
      media?.setSize(WIDE_MIN_PX, 700);
    });
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stacked', 'true');
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('live-rail-foot'));
    expect(screen.getByTestId('live-layout')).toHaveAttribute('data-shape', 'rail');
    // Compact: no cut box, and (R144, FR-TONIGHT-6) no stripe block at all — the track and the taps are the column's timeline slot.
    act(() => {
      media?.setSize(390, 3000);
    });
    // R148 (FR-FULL-4): the track and the taps are the sheet's.
    expect(screen.getByTestId('live-layout')).toHaveAttribute('data-shape', 'full');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'false');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'false');
    expect(screen.queryByTestId('stripe-block')).toBeNull();
    expect(screen.queryByTestId('time-stripe')).toBeNull();
    expect(screen.getByTestId('live-track').closest('[data-slot]')).toHaveAttribute('data-slot', 'sheet');
    expect(screen.getByTestId('live-layout').querySelector('[data-slot="foot"]')).toBeNull();
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
    hold();
    // Compact (R144, FR-TONIGHT-6, D-905): no playback row, no stepping row and no toggle on the actions row, held or
    // not; the hidden-objects toggle is the satellites' heading row's (R150, FR-GYRO-10) — the same saved state (FR-LIVE-6).
    expect(within(screen.getByTestId('live-actions')).queryByTestId('live-hidden-toggle')).toBeNull();
    expect(screen.queryByTestId('playback-row')).toBeNull();
    expect(screen.queryByTestId('step-controls')).toBeNull();
    expect(screen.queryByTestId('time-readout')).toBeNull();
    // R150 (FR-GYRO-10): the satellites are always on the page, the sheet's last group, after the actions.
    expect([...screen.getByTestId('live-satellites').children].map((el) => el.getAttribute('data-testid') ?? el.getAttribute('data-chart-slot'))).toEqual(['live-satellites-head', 'list']);
    expect(screen.getByTestId('live-satellites').previousElementSibling).toBe(screen.getByTestId('live-actions'));
    const toggle = within(screen.getByTestId('live-satellites-head')).getByTestId('live-hidden-toggle');
    expect(toggle).toHaveAccessibleName('Hidden objects');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(appStore.getState().liveHidden).toBe(true);
    unmount();
    media = stubMatchMedia(1280, 800);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    render(<LivePage link={null} onLeave={() => undefined} />);
    scrub();
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'false');
    // The rail is the sky's: the conditions after the legend in the list, the actions at its foot, the toggle among them.
    expect(screen.getByTestId('status-strip').closest('[data-slot]')).toHaveAttribute('data-slot', 'list');
    expect(within(screen.getByTestId('live-rail-foot')).getByTestId('live-actions')).toBeInTheDocument();
    expect(within(screen.getByTestId('live-actions')).getByTestId('live-hidden-toggle')).toBeInTheDocument();
    // R132: the stripe block is the rail's foot: the time row — the readout and the playback row — the overview, the stripe, the stepping row.
    expect(screen.getByTestId('stripe-block').parentElement).toBe(screen.getByTestId('live-rail-foot'));
    expect([...screen.getByTestId('stripe-block').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-row', 'overview-row', 'time-stripe', 'step-controls']);
    expect([...screen.getByTestId('time-row').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-readout', 'playback-row']);
    expect(within(screen.getByTestId('playback-row')).getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  /**
   * R123 (FR-SKY-3, FR-COMP-4, US-40 AC1; D-791, D-814): `[ stars ]` is on by default; on compact it is on the
   * chart's view row, after the control (the actions rows are full, FR-COMP-7), on wide on the actions row in both states;
   * a press turns the stars off and the prefs remember it.
   */
  it('offers [ stars ], on by default, at the end of the view row on compact and on wide, and remembers a press', () => {
    withSky();
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    const toggle = screen.getByTestId('stars-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAccessibleName(en.live.starsToggleName);
    expect(toggle).toHaveTextContent(en.live.starsToggle);
    // R132 (FR-FLOW-4, D-846): the view row is the layout's slot — the control in the picker's idiom, `[x] stars` last.
    // R148 (FR-FULL-4): on compact the row is the sheet's.
    const viewRow = toggle.closest('[data-testid="live-view-row"]') as HTMLElement;
    expect(viewRow).not.toBeNull();
    const control = within(viewRow).getByRole('group', { name: en.chart.viewGroup });
    expect(within(control).getAllByRole('button').map((b) => b.textContent)).toEqual(['Window', 'Polar', 'Dome']);
    expect(viewRow.lastElementChild).toBe(toggle);
    expect(within(screen.getByTestId('live-actions')).queryByTestId('stars-toggle')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('stars-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(appStore.getState().starsLayer).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ starsLayer: false });
    unmount();
    media = stubMatchMedia(1280, 800);
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('stars-toggle').closest('[data-slot]')).toHaveAttribute('data-slot', 'viewRow');
    expect(screen.getByTestId('stars-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByTestId('stars-toggle')).toHaveLength(1);
    expect(within(screen.getByTestId('live-actions')).queryByTestId('stars-toggle')).toBeNull();
    scrub();
    expect(screen.getByTestId('stars-toggle').closest('[data-slot]')).toHaveAttribute('data-slot', 'viewRow');
  });

  /** R48 (FR-TRAJ-1, FR-TRAJ-3, US-22 AC1..AC3, D-189): the arcs appear, grow and fade with the shown instant, and the legend says the same. R144: on wide, where the stripe and the step row are. */
  it('scrubs a pass through ahead, live, linger and gone, with the drawn arc and the legend state following (FR-TRAJ-1)', () => {
    withSky();
    media = stubMatchMedia(1280, 800);
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    scrub();
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
    // R70 (V14-6): no touch, and the row is still there. R144: on wide, the stripe's page.
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    media = stubMatchMedia(1280, 800);
    render(<LivePage link={null} onLeave={() => undefined} />);
    scrub();
    const stripe = screen.getByTestId('time-stripe');
    // R77 (FR-WATCH-2), R132 (FR-FLOW-4 wide): the readout heads the time row of the scrub block at the rail's foot,
    // over the overview, the stripe and the stepping row.
    const readout = within(screen.getByTestId('time-row')).getByTestId('time-readout');
    expect(screen.getByTestId('stripe-block').closest('[data-slot]')).toHaveAttribute('data-slot', 'foot');
    expect([...screen.getByTestId('stripe-block').children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-row', 'overview-row', 'time-stripe', 'step-controls']);
    expect(readout).toHaveTextContent(/^09:48 · \+0 min$/);
    expect(readout).toHaveAttribute('data-today', 'true');
    // Four hours on, and back to the minute: the chunk arrows and the fine step.
    fireEvent.click(screen.getByRole('button', { name: 'Forward four hours' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 4 * 3_600_000);
    expect(readout).toHaveTextContent(/^13:48 · \+4 h 00 min$/);
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
    expect(readout).toHaveTextContent(/^Sat \d\d:\d\d · \+\d+ h \d\d min$/);
    expect(readout).toHaveAttribute('data-today', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Previous pass' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(later.start.t);
  });

  /**
   * D-789 (R121 review): the window in the box is the page's, not its chart's. The live page mounts a different
   * chart for the landscape rail than for portrait; the hand's facing and the compact choice of the window outlive
   * both, and a trip to wide drops the choice for the saved view.
   */
  describe('the window in the box across the page’s charts (FR-SKY-2, D-789)', () => {
    const handBox = (): HTMLElement => document.querySelector<HTMLElement>('[data-state="hand"] [tabindex="0"]') as HTMLElement;
    const lookAz = (): string | null => document.querySelector('[data-look-az]')?.getAttribute('data-look-az') ?? null;
    const windowDrawn = async (): Promise<void> => {
      await waitFor(() => {
        expect(document.querySelector('[data-drawing="window"]')).not.toBeNull();
      });
    };

    /** R136 (FR-FLOW-14, FR-FLOW-15; D-876, D-877): the compact choice is saved, and a turn of the phone keeps the view and the facing. */
    it('saves the compact choice of the window and keeps it and the facing through a turn and a trip to wide', async () => {
      media = stubMatchMedia(390, 844);
      withSky();
      act(() => {
        appStore.getState().setChartView('dome');
      });
      render(<LivePage link={null} onLeave={() => undefined} />);
      fireEvent.click(screen.getByRole('button', { name: 'Window' }));
      expect(appStore.getState().chartView).toBe('window');
      await windowDrawn();
      fireEvent.keyDown(handBox(), { key: 'ArrowRight' });
      const turned = lookAz();
      // The landscape phone: the full form still (R148), the sheet the bottom sheet (R150, FR-GYRO-7), still the window and still facing where it was.
      act(() => {
        media?.setSize(844, 390);
      });
      expect(screen.getByTestId('live-layout')).toHaveAttribute('data-shape', 'full');
      expect(screen.getByTestId('live-sheet')).not.toHaveAttribute('data-form');
      await windowDrawn();
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
      expect(lookAz()).toBe(turned);
      // Wide and back: the saved view on both.
      act(() => {
        media?.setSize(1280, 800);
      });
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
      act(() => {
        media?.setSize(390, 844);
      });
      await windowDrawn();
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
      expect(lookAz()).toBe(turned);
    });

    /** R136 (FR-FLOW-14, D-876): a fresh profile opens the phone on the window, following the highlighted pass. */
    it('opens a fresh phone on the window, following the highlighted pass', async () => {
      media = stubMatchMedia(390, 844);
      withSky();
      // `withSky` saves the polar chart for the tests above; this one is a profile with nothing saved.
      act(() => {
        appStore.setState({ chartView: undefined });
      });
      render(<LivePage link={null} onLeave={() => undefined} />);
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
      await windowDrawn();
      expect(appStore.getState().chartView).toBeUndefined();
      expect(screen.getByTestId('window-readout')).toHaveTextContent(/^Following [A-Z]/);
    });
  });

  /**
   * R33 (FR-LIVE-4, US-15 AC3): scrubbing moves the instant and everything follows — the dome, the marker, the
   * strip, the share link. R70 (FR-SPAN-2, US-24 AC2): the whole span is the overview's row now, so a drag
   * across the night is a drag on it; the stripe below redraws around wherever it lands.
   */
  it('scrubbing the overview sets the shown instant: the stripe, the marker, the count, the strip and the share link follow', () => {
    withSky();
    // R144: the overview is wide's (FR-TONIGHT-6 gives compact the track; its own test is below).
    media = stubMatchMedia(1280, 800);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const overview = screen.getByTestId('stripe-overview');
    // The overview carries the drawn passes as marks in the same series order as the dome.
    expect([...container.querySelectorAll('[data-pass-mark]')].map((el) => el.getAttribute('data-series'))).toEqual(['1', '2', '3']);
    // R77 (FR-WATCH-1 b): watching, the overview is the page's only timeline, and a drag on it is what enters
    // scrubbing — the same element, which stays where it was, so the pointer it holds keeps working.
    expect(screen.queryByTestId('time-stripe')).toBeNull();
    // At jsdom's default 600 px, 75 px of the overview is three hours in: inside the `later` pass (which starts at 3 h).
    const threeHours = T + 3 * HOUR + 30_000;
    fireEvent.pointerDown(overview, { button: 0, clientX: (600 * (threeHours - T)) / LIVE_WINDOW_MS, pointerId: 1 });
    fireEvent.pointerUp(overview, { pointerId: 1 });
    // On wide the overview moves from the rail's foot to the head of the scrub block (a new element, which takes the focus back — the test above).
    expect(screen.getByTestId('stripe-overview').closest('[data-testid="stripe-block"]')).not.toBeNull();
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('held');
    const stripe = screen.getByTestId('time-stripe');
    expect(stripe).toHaveAttribute('aria-valuemin', String(T));
    expect(stripe).toHaveAttribute('aria-valuemax', String(T + LIVE_WINDOW_MS));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBeCloseTo(threeHours, -3);
    // FR-SPAN-1: the stripe is drawing the four hours that hold it, and the overview brackets the same four.
    expect(Number(stripe.getAttribute('data-drawn-start'))).toBeLessThanOrEqual(threeHours);
    expect(Number(stripe.getAttribute('data-drawn-end'))).toBeGreaterThanOrEqual(threeHours);
    expect(screen.getByTestId('stripe-overview').getAttribute('data-chunk-start')).toBe(stripe.getAttribute('data-drawn-start'));
    const marker = screen.getByTestId('live-dome').querySelector('[data-marker="now"]');
    expect(marker?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', 'later');
    expect(screen.getByTestId('live-count')).toHaveTextContent(/^Up 1$/);
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^12:48 · \+3 h 0[01] min$/);
    expect(container.querySelector('[data-pass-segment="later"]')).toHaveAttribute('data-current', 'true');
    // The arrow keys step from there (FR-LIVE-4), and the share link now carries the instant (FR-LIVE-9).
    fireEvent.keyDown(stripe, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(stripe, { key: 'ArrowRight' });
    const shown = Number(stripe.getAttribute('aria-valuenow'));
    expect(shown).toBeCloseTo(threeHours - 9 * 60_000, -3);
    fireEvent.click(screen.getByRole('button', { name: 'Share this moment' }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining(`#live?lat=-38.93&lon=-67.99&alt=0&t=${isoInstant(shown)}`));
  });

  /** R33 (FR-LIVE-5, US-15 AC4, D-81): play advances the instant by wall time × speed and `now` comes back to the tick. */
  it('plays at the chosen speed, shows the speed as the pressed control, stops at the end of the span, and `back to live` returns to real time', () => {
    const frame = scriptedFrames();
    withSky();
    // R144: the chosen speeds are wide's; compact plays at the automatic rate from the taps (below).
    media = stubMatchMedia(1280, 800);
    render(<LivePage link={null} onLeave={() => undefined} />);
    // R77 (FR-WATCH-4, FR-LIVE-5 as amended): playback is reachable only while scrubbing — watching renders no
    // play, no speeds and no `back to live`.
    for (const testid of ['live-play', 'playback-controls', 'live-now']) expect(screen.queryByTestId(testid)).toBeNull();
    scrub();
    const stripe = screen.getByTestId('time-stripe');
    expect(screen.queryByTestId('live-speed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '600×' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    // FR-WATCH-3: the speed is the pressed control on the playback row, and never a field of the conditions line.
    expect(screen.getByRole('button', { name: '600×' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('live-speed')).toBeNull();
    frame(1000);
    frame(1500);
    // Half a second at 600× is five minutes.
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 300_000);
    frame(1700); // a dropped frame: the gap is still simulated time
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 420_000);
    // Playing is still scrubbing: the instant is held, at a speed (FR-WATCH-1).
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('held');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(Number(stripe.getAttribute('aria-valuenow'))).toBe(T + 420_000);
    // `[ back to live ]`: back to the tick, which keeps moving — and the scrub block goes with the state.
    fireEvent.click(screen.getByRole('button', { name: 'back to live' }));
    expect(screen.queryByTestId('time-stripe')).toBeNull();
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('live');
    expect(screen.getByTestId('live-clock')).toHaveTextContent(/^09:48:24 UTC$/);
    act(() => {
      vi.advanceTimersByTime(TICK_MS); // the fake Date moves with the timers
    });
    expect(screen.getByTestId('live-clock')).toHaveTextContent(/^09:48:34 UTC$/);
    // At 3600× the whole span runs in 24 s and stops at its end — held from the instant real time had reached.
    scrub();
    fireEvent.click(screen.getByRole('button', { name: '3600×' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    frame(2000);
    frame(30_000);
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(T + TICK_MS + LIVE_WINDOW_MS);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByTestId('live-speed')).toBeNull();
  });

  /**
   * R77 (FR-WATCH-1, FR-WATCH-2, FR-WATCH-4, D-446, D-447; US-27 AC1..AC4): the two states, each rendering
   * exactly `rowsFor`'s inventory — every listed row present, every other row absent — with the headline and
   * the indicator's word, on both shells. `[ scrub ]` holds the instant of the tap; `[ back to live ]` returns
   * it to real time, which then advances again.
   */
  it('renders wide watching and scrubbing as rowsFor lists them, and moves between them on the reader’s tap (FR-WATCH-1..4)', () => {
    const mode = 'wide';
    withSky();
    media = stubMatchMedia(1280, 800);
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const inventory = (state: 'watching' | 'scrubbing'): void => {
      const listed = new Set(rowsFor(state, mode, 'tall'));
      for (const row of LIVE_ROWS) {
        const found = container.querySelector(`[data-testid="${LIVE_ROW_TEST_ID[row]}"]`);
        if (listed.has(row)) expect(found, `${mode} ${state}: ${row} is rendered`).not.toBeNull();
        else expect(found, `${mode} ${state}: ${row} is not in the DOM`).toBeNull();
      }
    };

    // Watching: the next event is the headline, the mark runs, and the word says `live`.
    inventory('watching');
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'false');
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('live');
    expect(within(screen.getByTestId('live-indicator')).getByTestId('mark')).toHaveAttribute('data-mark-running', 'true');
    expect(screen.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
    // Ten seconds into the golden pass: the ISS is up, and the block counts to its peak (FR-FIRST-3).
    expect(screen.getByTestId('next-event-label')).toHaveTextContent(/^Up now · peaks in \d+:\d\d$/);
    expect(screen.getByTestId('next-event-path').textContent?.startsWith(`${pass.name} · `)).toBe(true);
    // The live page is where the block's link goes, so the block here carries none.
    expect(screen.queryByTestId('now-live-link')).toBeNull();
    // On wide the indicator heads the rail with the clock.
    expect(within(screen.getByTestId('live-rail-head')).getByTestId('live-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('live-clock')).toHaveTextContent(/^09:48:24 UTC$/);
    expect(screen.getByTestId('live-scrub')).toHaveTextContent(en.live.scrubWide);
    expect(screen.getByRole('button', { name: en.live.share })).toBeInTheDocument();

    // `[ scrub ]` holds the instant of the tap: the real-time clock moves on, the shown instant does not.
    act(() => {
      vi.setSystemTime(T + 4_000);
    });
    scrub();
    inventory('scrubbing');
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('held');
    expect(within(screen.getByTestId('live-indicator')).getByTestId('mark')).toHaveAttribute('data-mark-running', 'false');
    const stripe = (): number => Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'));
    expect(stripe()).toBe(T);
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^09:48 · \+0 min$/);
    // The headline is the held instant and its offset from now (FR-WATCH-2): half an hour on is `+30 min`…
    fireEvent.keyDown(screen.getByTestId('time-stripe'), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(screen.getByTestId('time-stripe'), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(screen.getByTestId('time-stripe'), { key: 'ArrowRight', shiftKey: true });
    expect(stripe()).toBe(T + 30 * 60_000);
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^10:18 · \+30 min$/);
    // …and the tick moves real time under it, not the held instant: the offset counts down, the instant stays.
    act(() => {
      vi.setSystemTime(T + 6 * TICK_MS);
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(stripe()).toBe(T + 30 * 60_000);
    expect(screen.getByTestId('time-readout')).toHaveTextContent(/^10:18 · \+29 min$/);
    expect(screen.getByRole('button', { name: en.live.shareMoment })).toBeInTheDocument();

    // `[ back to live ]`: real time again, advancing on the tick, and the scrub block gone with the state.
    fireEvent.click(screen.getByRole('button', { name: en.live.backToLive }));
    inventory('watching');
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('live');
    const clock = (): HTMLElement => screen.getByTestId('live-clock');
    expect(clock()).toHaveTextContent(/09:49:34 UTC$/);
    act(() => {
      vi.setSystemTime(T + 7 * TICK_MS);
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(clock()).toHaveTextContent(/09:49:44 UTC$/);
  });

  /**
   * R144 (FR-TONIGHT-6, FR-TONIGHT-9, FR-WATCH-4 and FR-WATCH-5 as amended v2.7; US-42 AC5; D-902) → R148 (FR-FULL-3,
   * FR-FULL-4, FR-WATCH-4 as amended v2.8; D-928): the compact page renders one inventory in both states — split in
   * two. With the sheet closed the reachable rows are the overlay's (the box, the head, `[ controls ]`, and the hint
   * and the card on their own conditions); with it open the sheet's rows too, in FR-FULL-4's order. Every other
   * `LiveRow` is absent, identical before and after the instant leaves real time, in the portrait and the
   * landscape phone alike — both the full form (D-919). "Present" is in the DOM and not under `inert`: the sheet's
   * rows stay mounted while it is closed (D-932). The state is still a fact: the chip says `now` or the offset.
   */
  it.each([
    ['portrait', [390, 844], 'under'],
    ['landscape', [844, 390], 'rail'],
  ] as const)('renders the compact %s page as one inventory in both states and both sheet states, the chip saying which (FR-TONIGHT-6, FR-FULL-3, FR-FULL-4, FR-WATCH-4)', (_shape, size, placement) => {
    withSky();
    media = stubMatchMedia(size[0], size[1]);
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const reachable = (row: string): boolean => {
      const found = container.querySelector(`[data-testid="${LIVE_ROW_TEST_ID[row as keyof typeof LIVE_ROW_TEST_ID]}"]`);
      return found !== null && found.closest('[inert]') === null;
    };
    const present = (): string[] => LIVE_ROWS.filter(reachable);
    const inventory = (state: string, sheetOpen: boolean): void => {
      const listed = new Set(rowsFor('watching', 'compact', 'tall', sheetOpen));
      for (const row of LIVE_ROWS) {
        if (COMPACT_CONDITIONAL.includes(row)) continue;
        // D-905 → R150 (FR-GYRO-10): the hidden toggle is not a row of compact; it is the satellites' heading row's, so
        // it is reachable exactly when they are.
        if (row === 'hidden') {
          expect(reachable(row), `compact ${state}: the hidden toggle with the satellites`).toBe(reachable('satellites'));
          continue;
        }
        expect(reachable(row), `compact ${state}, sheet ${sheetOpen ? 'open' : 'closed'}: ${row} is ${listed.has(row) ? 'reachable' : 'not reachable'}`).toBe(listed.has(row));
      }
    };
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByTestId('live-page')).toHaveAttribute('data-scrub-placement', placement);
    expect(screen.getByTestId('live-layout')).toHaveAttribute('data-shape', 'full');
    // R150 (FR-GYRO-7): one form, the bottom sheet, in both shapes.
    expect(screen.getByTestId('live-sheet')).not.toHaveAttribute('data-form');
    // Watching: the ISS is up, so the page stays on real time (FR-TONIGHT-1's first case) with no card, and says `now`.
    inventory('watching', false);
    expect(screen.queryByTestId('live-card')).toBeNull();
    // The polar chart has no hint (D-864).
    expect(screen.queryByTestId('sky-hint')).toBeNull();
    const closed = present();
    expect(chip()).toHaveAttribute('data-kind', 'now');
    expect(screen.queryByTestId('live-state-mark')).toBeNull();
    expect(screen.queryByTestId('live-top-row')).toBeNull();
    // The sheet open: its rows in FR-GYRO-10's order under the head, the actions `[ Share ]` alone, the satellites last.
    fireEvent.click(screen.getByTestId('live-controls'));
    inventory('watching', true);
    const open = present();
    expect([...screen.getByTestId('sheet-body').children].map((el) => el.getAttribute('data-testid'))).toEqual(['live-context', 'live-timeline', 'live-view-row', 'live-facing', 'live-actions', 'live-satellites']);
    expect([...screen.getByTestId('live-actions').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Share']);
    expect(screen.getByRole('button', { name: en.live.share })).toBeInTheDocument();
    // Held: a key on the track holds the instant; nothing appears, nothing disappears.
    act(() => {
      vi.setSystemTime(T + 4_000);
    });
    hold();
    inventory('scrubbing', true);
    expect(present()).toEqual(open);
    expect(shownAt()).toBe(T);
    expect(chip()).not.toHaveAttribute('data-kind', 'now');
    expect(screen.getByRole('button', { name: en.live.shareMoment })).toBeInTheDocument();
    // A quarter hour on, and the tick moves real time under it, not the held instant (FR-WATCH-1).
    fireEvent.keyDown(track(), { key: 'ArrowRight' });
    expect(shownAt()).toBe(T + 15 * 60_000);
    act(() => {
      vi.setSystemTime(T + 6 * TICK_MS);
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(shownAt()).toBe(T + 15 * 60_000);
    expect(chip()).toHaveTextContent(/^in 14 min$/);
    // `[ now ]`: real time again, the same rows, and nothing marked (FR-TONIGHT-4 as amended, D-926).
    fireEvent.click(screen.getByTestId('live-tap-now'));
    inventory('watching', true);
    expect(present()).toEqual(open);
    expect(chip()).toHaveAttribute('data-kind', 'now');
    expect(screen.getByTestId('live-tap-now')).toBeDisabled();
    expect('stayOnNow' in appStore.getState()).toBe(false);
    // Closed again: the overlay's rows alone, held or not.
    fireEvent.click(screen.getByTestId('sheet-close'));
    inventory('watching', false);
    expect(present()).toEqual(closed);
    hold();
    inventory('scrubbing', false);
    expect(present()).toEqual(closed);
  });

  /**
   * R148 (FR-FULL-3): with the sheet closed the compact page renders exactly the box, the head, `[ controls ]` and,
   * until `skyHintSeen`, the hint — on the window, which has one — and nothing else reachable over the sky; the hint
   * stands in the row above the button, since the window's three clauses never fit beside it (D-924).
   */
  it('with the sheet closed renders the box, the head, [ controls ] and the hint over the sky, the hint above the button where it does not fit beside (FR-FULL-3, D-924)', () => {
    withSky();
    act(() => {
      appStore.getState().setChartView('window');
      appStore.getState().setSkyHintSeen(false);
    });
    media = stubMatchMedia(390, 844);
    const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
    const overlay = container.querySelector('[data-slot="overlay"]') as HTMLElement;
    const hint = within(overlay).getByTestId('sky-hint');
    // The window's three clauses (a mouse's here) never fit beside the button.
    expect(hint.parentElement).toHaveAttribute('data-beside', 'false');
    expect(within(overlay).queryByTestId('live-card')).toBeNull();
    const reachable = LIVE_ROWS.filter((row) => {
      const found = container.querySelector(`[data-testid="${LIVE_ROW_TEST_ID[row]}"]`);
      return found !== null && found.closest('[inert]') === null;
    });
    expect(reachable.sort()).toEqual(['box', 'controls', 'head', 'hint'].sort());
    // The dome's drag clause fits beside the button in English (`hintFitsBeside`: 35.75 cells with a mouse).
    act(() => {
      appStore.getState().setChartView('dome');
    });
    expect(within(overlay).getByTestId('sky-hint').parentElement).toHaveAttribute('data-beside', 'true');
    // Seen: gone for good.
    act(() => {
      appStore.getState().setSkyHintSeen(true);
    });
    expect(within(overlay).queryByTestId('sky-hint')).toBeNull();
  });

  /**
   * R148 (FR-FULL-4, D-923): the sheet's children in FR-FULL-4's order in every view, with the facing row the chart's
   * readout as a button that opens the picker under it on the window and the polar chart, and the readout alone on the
   * dome; a pick closes it, a second tap closes it, and `[ hold up to the sky ]` beside the points leaves it open.
   */
  it.each(['polar', 'window', 'dome'] as const)('holds the sheet’s rows in FR-FULL-4’s order on the %s, the facing row with its picker where the view has one', async (view) => {
    withSky();
    act(() => {
      appStore.getState().setChartView(view);
    });
    media = stubMatchMedia(390, 844);
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByTestId('live-controls'));
    const body = screen.getByTestId('sheet-body');
    // R150 (FR-GYRO-10, D-949): the satellites last, open, under their heading.
    expect([...body.children].map((el) => el.getAttribute('data-testid'))).toEqual(['live-context', 'live-timeline', 'live-view-row', 'live-facing', 'live-actions', 'live-satellites']);
    expect(within(screen.getByTestId('live-satellites')).getByRole('heading', { name: 'Satellites (1)' })).toBeInTheDocument();
    expect(within(screen.getByTestId('live-satellites')).getByTestId('chart-legend-slot')).toBeInTheDocument();
    // R150 (FR-GYRO-11, D-950): the window first in the view row.
    expect(
      within(within(screen.getByTestId('live-view-row')).getByRole('group', { name: en.chart.viewGroup }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([en.chart.view.window, en.chart.view.polar, en.chart.view.dome]);
    const timeline = screen.getByTestId('live-timeline');
    expect(timeline.children).toHaveLength(2);
    expect(timeline.children[0]).toBe(screen.getByTestId('live-track'));
    expect(timeline.children[1]).toContainElement(screen.getByTestId('live-taps'));
    expect(within(screen.getByTestId('live-view-row')).getByRole('group', { name: en.chart.viewGroup })).toBeInTheDocument();
    expect(screen.getByTestId('live-view-row').lastElementChild).toBe(screen.getByTestId('stars-toggle'));
    // Every group a group apart, the rows inside the timeline a row apart (FR-FLOW-10).
    for (const child of body.children) expect(child).toHaveAttribute('data-rhythm', 'group');
    for (const child of screen.getByTestId('live-timeline').children) expect(child).toHaveAttribute('data-rhythm', 'row');
    const facing = screen.getByTestId('live-facing');
    if (view === 'window') {
      await waitFor(() => {
        expect(document.querySelector('[data-drawing="window"]')).not.toBeNull();
      });
    }
    const readoutId = { polar: 'chart-convention', window: 'window-readout', dome: 'dome-readout' }[view];
    await waitFor(() => {
      expect(within(facing).getByTestId(readoutId)).toBeInTheDocument();
    });
    if (view === 'dome') {
      expect(within(facing).queryByTestId('sky-readout-toggle')).toBeNull();
      expect(screen.queryByTestId('live-facing-picker')).toBeNull();
      return;
    }
    const toggle = within(facing).getByTestId('sky-readout-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName(within(facing).getByTestId(readoutId).textContent ?? '');
    expect(screen.queryByTestId('live-facing-picker')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const picker = screen.getByTestId('live-facing-picker');
    expect(picker.previousElementSibling).toBe(toggle.parentElement);
    expect(toggle.getAttribute('aria-controls')).toBe(picker.id);
    await waitFor(() => {
      expect(within(picker).getAllByRole('button').length).toBeGreaterThan(0);
    });
    if (view === 'window') {
      // A point closes the row (D-904); `[ hold up to the sky ]` beside the points is `SkyViewLayout.test.tsx`'s case and the screen's own.
      fireEvent.click(within(picker).getByRole('button', { name: 'NE' }));
      expect(screen.queryByTestId('live-facing-picker')).toBeNull();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
    }
    // A second tap closes it.
    fireEvent.click(toggle);
    expect(screen.queryByTestId('live-facing-picker')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * R148 (FR-FULL-10, FR-TONIGHT-1 and FR-TONIGHT-2 as amended v2.8; D-925): the card, with a stored run and nothing
   * visible up at now. It appears with `t` on real time, not playing, with focus on its first button and the sentence
   * in a polite region; `[ see next pass ]` lands on the lead instant and plays — paused under reduced motion — with
   * the sheet closed; `[ see now ]` and `Esc` leave real time; when it goes, focus is on `[ controls ]`.
   */
  it('asks with the card when nothing is up, and [ see next pass ] lands a minute before the rise and plays, paused under reduced motion (FR-FULL-10, FR-TONIGHT-2)', () => {
    withSky([later, tomorrow]);
    media = stubMatchMedia(390, 844);
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    const card = screen.getByTestId('live-card');
    expect(card).toHaveAttribute('data-kind', 'ask');
    expect(card.closest('[data-slot]')).toHaveAttribute('data-slot', 'overlay');
    expect(within(card).getByText(en.live.opening.nothingUp)).toBeInTheDocument();
    expect(within(card).getByTestId('live-card-pass')).toHaveTextContent(/^Tiangong · 12:48 · in 3 h 00 min$/);
    expect(document.activeElement).toBe(screen.getByTestId('live-card-next'));
    expect(chip()).toHaveAttribute('data-kind', 'now');
    expect(screen.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    fireEvent.click(screen.getByTestId('live-card-next'));
    expect(screen.queryByTestId('live-card')).toBeNull();
    expect(shownAt()).toBe(later.start.t - LEAD);
    expect(screen.getByTestId('live-play')).toHaveAttribute('data-playing', 'true');
    expect(chip()).toHaveAttribute('data-kind', 'ahead');
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    expect(document.activeElement).toBe(screen.getByTestId('live-controls'));
    unmount();
    // Reduced motion: the landing, paused.
    media.setReducedMotion(true);
    render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByTestId('live-card-next'));
    expect(shownAt()).toBe(later.start.t - LEAD);
    expect(screen.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
  });

  it('[ see now ], Esc and the reader moving the time each put the card away on real time; a drag on the sky leaves it (FR-FULL-10, D-925, D-927)', () => {
    withSky([later, tomorrow]);
    media = stubMatchMedia(390, 844);
    const onLeave = vi.fn();
    const first = render(<LivePage link={null} onLeave={onLeave} />);
    expect(screen.getByTestId('live-card')).toBeInTheDocument();
    // A drag on the sky: the camera's, not the time's — the card stays.
    const dome = screen.getByTestId('live-dome');
    fireEvent.pointerDown(dome, { pointerId: 1, isPrimary: true, clientX: 100, clientY: 300 });
    fireEvent.pointerUp(dome, { pointerId: 1, isPrimary: true, clientX: 160, clientY: 330 });
    expect(screen.getByTestId('live-card')).toBeInTheDocument();
    // Opening the sheet leaves it standing.
    fireEvent.click(screen.getByTestId('live-controls'));
    expect(screen.getByTestId('live-card')).toBeInTheDocument();
    // `[ see now ]`: real time, the card gone.
    fireEvent.click(screen.getByTestId('live-card-now'));
    expect(screen.queryByTestId('live-card')).toBeNull();
    expect(chip()).toHaveAttribute('data-kind', 'now');
    expect(screen.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
    first.unmount();
    // `Esc` is `[ see now ]`, and does not leave the page.
    const second = render(<LivePage link={null} onLeave={onLeave} />);
    expect(screen.getByTestId('live-card')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('live-card')).toBeNull();
    expect(chip()).toHaveAttribute('data-kind', 'now');
    expect(onLeave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId('live-controls'));
    second.unmount();
    // The reader moving the time in the sheet is an answer: `[ next ]` here, the track and the play control alike.
    for (const answer of ['live-tap-next', 'live-play', 'track'] as const) {
      const run = render(<LivePage link={null} onLeave={onLeave} />);
      expect(screen.getByTestId('live-card')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('live-controls'));
      if (answer === 'track') fireEvent.keyDown(track(), { key: 'ArrowRight' });
      else fireEvent.click(screen.getByTestId(answer));
      expect(screen.queryByTestId('live-card'), answer).toBeNull();
      // Answered from the sheet: the focus stays with the control the reader used (D-934).
      expect(document.activeElement).not.toBe(screen.getByTestId('live-controls'));
      run.unmount();
    }
  });

  it('shows no card for a link’s t, for a pass up now, for a reader who moved first, or on wide; the advice with none in the span (FR-FULL-10)', () => {
    media = stubMatchMedia(390, 844);
    // A pass up now: no card (FR-TONIGHT-1's first case).
    withSky();
    const upNow = render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.queryByTestId('live-card')).toBeNull();
    upNow.unmount();
    // A link's `t`.
    withSky([later, tomorrow]);
    const linked = render(<LivePage link={{ kind: 'live', observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: T + HOUR }} onLeave={() => undefined} />);
    expect(screen.queryByTestId('live-card')).toBeNull();
    linked.unmount();
    // The reader moved first: the passes arrive after a key on the track.
    act(() => {
      appStore.setState({ passes: { ...IDLE_PASSES, jobId: 'job-0', status: 'computing', observer, passes: [], hasDarkness: true } });
    });
    const early = render(<LivePage link={null} onLeave={() => undefined} />);
    fireEvent.click(screen.getByTestId('live-controls'));
    fireEvent.keyDown(track(), { key: 'ArrowRight' });
    act(() => {
      appStore.setState({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [later, tomorrow], hasDarkness: true } });
    });
    expect(screen.queryByTestId('live-card')).toBeNull();
    early.unmount();
    // None in the span: the advice, over `[ see the sky now ]`.
    withSky([over, beyond]);
    const none = render(<LivePage link={null} onLeave={() => undefined} />);
    const card = screen.getByTestId('live-card');
    expect(card).toHaveAttribute('data-kind', 'advise');
    expect(within(card).getByText(en.live.opening.noPass)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('live-card-now'));
    expect(screen.queryByTestId('live-card')).toBeNull();
    expect(chip()).toHaveAttribute('data-kind', 'now');
    none.unmount();
    // Wide never asks (V27-1).
    media.restore();
    media = stubMatchMedia(1280, 800);
    withSky([later, tomorrow]);
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.queryByTestId('live-card')).toBeNull();
    expect(screen.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
  });

  /**
   * R150 (FR-GYRO-8, D-948; D-922 withdrawn): with the sheet open a tap on the sky is the sky's — its `pointerup` and
   * its `click` reach the drawing, in each view, and the sheet stays open; a drag does too. The ways to close are
   * the `×`, the swipe, `[ controls ]` and `Esc`.
   */
  it.each(['polar', 'dome', 'window'] as const)('on the %s a tap on the sky with the sheet open reaches the sky and leaves the sheet open', (view) => {
    withSky();
    act(() => {
      appStore.getState().setChartView(view);
    });
    media = stubMatchMedia(390, 844);
    render(<LivePage link={null} onLeave={() => undefined} />);
    const dome = screen.getByTestId('live-dome');
    const ups = vi.fn();
    const clicked = vi.fn();
    dome.addEventListener('pointerup', ups);
    dome.addEventListener('click', clicked);
    const press = (id: number, from: [number, number], to: [number, number]): void => {
      fireEvent.pointerDown(dome, { pointerId: id, isPrimary: true, clientX: from[0], clientY: from[1] });
      fireEvent.pointerUp(dome, { pointerId: id, isPrimary: true, clientX: to[0], clientY: to[1] });
      fireEvent.click(dome, { clientX: to[0], clientY: to[1] });
    };
    fireEvent.click(screen.getByTestId('live-controls'));
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    // A tap: the sheet stays open and the drawing gets both events.
    press(1, [100, 300], [101, 300]);
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    expect(ups).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);
    // A drag: the same.
    press(2, [100, 300], [160, 330]);
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    expect(clicked).toHaveBeenCalledTimes(2);
    // The `×` closes it, and gives the focus back to `[ controls ]`.
    fireEvent.click(screen.getByRole('button', { name: en.sheet.close }));
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    expect(document.activeElement).toBe(screen.getByTestId('live-controls'));
  });

  /**
   * R148 (FR-FULL-5, FR-FULL-10, FR-LIVE-1; D-927) → R152 (FR-GYRO-6, D-945): `Esc`'s three steps in order — the
   * card is answered, the sheet closes, the page is left (the sky screen's step is gone with the screen) — and the
   * sheet's state survives a turn of the phone (FR-FLOW-15).
   */
  it('takes Esc in three steps: the card, the sheet, then the page (D-927, D-945), and keeps the sheet and its list through a turn', () => {
    withSky([later, tomorrow]);
    media = stubMatchMedia(390, 844);
    const onLeave = vi.fn();
    render(<LivePage link={null} onLeave={onLeave} />);
    fireEvent.click(screen.getByTestId('live-controls'));
    expect(screen.getByTestId('live-card')).toBeInTheDocument();
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('live-card')).toBeNull();
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    expect(onLeave).not.toHaveBeenCalled();
    // The turn: the sheet and the list as they were, the bottom sheet still (FR-GYRO-7).
    expect(screen.getByTestId('live-satellites')).toBeInTheDocument();
    act(() => {
      media?.setSize(844, 390);
    });
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('live-sheet')).not.toHaveAttribute('data-form');
    expect(screen.getByTestId('live-satellites')).toBeInTheDocument();
    act(() => {
      media?.setSize(390, 844);
    });
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    expect(document.activeElement).toBe(screen.getByTestId('live-controls'));
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  /**
   * R144 review (FR-TONIGHT-3, FR-TONIGHT-7): on real time the headline reads a 1 s clock and the page a 10 s tick.
   * The track's value text says what the headline says, and `▶` plays from the second on screen — not from the tick
   * before it, which would move the shown instant back by up to ten seconds.
   */
  it('on compact speaks the headline’s second in the track’s value text, and ▶ from real time plays from it', () => {
    scriptedFrames();
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    // The ISS is up at T: the page stays on real time.
    expect(chip()).toHaveAttribute('data-kind', 'now');
    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    const second = formatClock(T + 7_000, null, 'en');
    expect(screen.getByTestId('shown-time')).toHaveTextContent(second.split(' ')[0] ?? '');
    expect(track().getAttribute('aria-valuetext')).toContain(second);
    // The 10 s tick has not moved: the page's own instant is still T.
    expect(shownAt()).toBe(T);
    fireEvent.click(screen.getByTestId('live-play'));
    expect(screen.getByTestId('live-play')).toHaveAttribute('data-playing', 'true');
    expect(shownAt()).toBe(T + 7_000);
  });

  /** R144 review (FR-TONIGHT-4): `[ tonight ]` has nowhere to land before the bands arrive, and is disabled until they do. */
  it('on compact disables [ tonight ] until the bands hold a night, as next and now are disabled', async () => {
    withSky();
    render(<LivePage link={null} onLeave={() => undefined} />);
    const tonight = (): HTMLElement => screen.getByTestId('live-tap-tonight');
    expect(tonight()).toBeDisabled();
    for (let i = 0; i < 500 && tonight().hasAttribute('disabled'); i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(tonight()).toBeEnabled();
  });

  /**
   * R78 (FR-WATCH-5, FR-WATCH-6, FR-WATCH-9 a; D-448, D-449): the two short shapes, each rendering `rowsFor`'s
   * short inventory. The landscape phone is a media query away. The short wide window is a measurement away:
   * jsdom lays nothing out, so the frame's own rect is stubbed to the 384 px a 1200 × 450 page leaves it, and
   * the frame's report of it — not the viewport — is what turns the block into the bar.
   */
  it.each([['wide', [1200, 450], 'overlay']] as const)('renders the short %s page as rowsFor lists it in both states, the scrub block placed by scrubPlacement (FR-WATCH-5, FR-WATCH-6)', (mode, size, placement) => {
    withSky();
    media = stubMatchMedia(size[0], size[1]);
    const realGetRect = HTMLElement.prototype.getBoundingClientRect;
    if (placement === 'overlay') {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe(): void {
            /* the frame measures once on mount, which is all this needs */
          }
          disconnect(): void {
            /* nothing to detach */
          }
        },
      );
      HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
        const rect = realGetRect.call(this);
        return this.dataset['testid'] === 'chart-frame' ? { ...rect, width: 1161, height: 384, right: 1161, bottom: 384, toJSON: () => ({}) } : rect;
      };
    }
    try {
      const { container } = render(<LivePage link={null} onLeave={() => undefined} />);
      const inventory = (state: 'watching' | 'scrubbing'): void => {
        const listed = new Set(rowsFor(state, mode, 'short'));
        for (const row of LIVE_ROWS) {
          const found = container.querySelector(`[data-testid="${LIVE_ROW_TEST_ID[row]}"]`);
          if (listed.has(row)) expect(found, `short ${mode} ${state}: ${row} is rendered`).not.toBeNull();
          else expect(found, `short ${mode} ${state}: ${row} is not in the DOM`).toBeNull();
        }
      };
      const page = screen.getByTestId('live-page');
      // The placement does not read the state: it is decided while watching already, so the box cannot move on the tap.
      expect(page).toHaveAttribute('data-scrub-placement', placement);
      inventory('watching');
      const head = within(screen.getByTestId('live-rail-head'));
      expect(head.getByTestId('live-indicator')).toBeInTheDocument();
      expect(head.getByTestId('live-clock')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-bottom-overlay')).toBeNull();
      if (placement === 'overlay') expect(page).toHaveAttribute('data-fold', 'controls actions');
      else expect(page).not.toHaveAttribute('data-fold');
      const fold = page.getAttribute('data-fold');

      scrub();
      inventory('scrubbing');
      expect(page).toHaveAttribute('data-scrub-placement', placement);
      expect(page.getAttribute('data-fold')).toBe(fold);
      // `[ back to live ]` is at the rail's head at both shapes, and the overview is the rail's, not the block's.
      expect(head.getByTestId('live-now')).toBeInTheDocument();
      const bar = within(within(screen.getByTestId('chart-box')).getByTestId('chart-bottom-overlay'));
      for (const id of ['time-row', 'playback-row', 'time-stripe', 'step-controls']) expect(bar.getByTestId(id)).toBeInTheDocument();
      expect(bar.queryByTestId('overview-row')).toBeNull();
      expect(within(screen.getByTestId('live-rail-foot')).getByTestId('overview-row')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-stripe')).toBeNull();
      expect(screen.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'false');

      // `[ back to live ]` dismisses the bar with the state.
      fireEvent.click(screen.getByRole('button', { name: en.live.backToLive }));
      inventory('watching');
      expect(screen.queryByTestId('chart-bottom-overlay')).toBeNull();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = realGetRect;
      vi.unstubAllGlobals();
    }
  });

  it('enters scrubbing on a key on the overview, and on wide keeps the focus on it as it moves under the box (FR-WATCH-1 b)', () => {
    withSky();
    media = stubMatchMedia(1280, 800);
    render(<LivePage link={null} onLeave={() => undefined} />);
    const before = screen.getByTestId('stripe-overview');
    expect(before.closest('[data-testid="live-rail-foot"]')).not.toBeNull();
    act(() => {
      before.focus();
    });
    fireEvent.keyDown(before, { key: 'ArrowRight' });
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('held');
    const after = screen.getByTestId('stripe-overview');
    expect(after.closest('[data-testid="stripe-block"]')).not.toBeNull();
    expect(document.activeElement).toBe(after);
    // The next key lands on it: 15 min more (FR-SPAN-2).
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(T + 30 * 60_000);
  });

  it('keeps the word beside a still mark under reduced motion on wide, and the chip beside it on compact (FR-MARK-5, FR-X-5)', () => {
    withSky();
    media = stubMatchMedia(1280, 800);
    media.setReducedMotion(true);
    const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
    const indicator = screen.getByTestId('live-indicator');
    const frameNow = (): string | null => indicator.querySelector('[data-mark-layer="bead"]')?.getAttribute('data-mark-frame') ?? null;
    const before = frameNow();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(frameNow()).toBe(before);
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('live');
    scrub();
    expect(screen.getByTestId('live-state-word')).toHaveTextContent('held');
    unmount();
    // R144 (FR-TONIGHT-6, FR-TONIGHT-7) → R148 (FR-FULL-2): on compact the word is the chip's — `now`, or the offset — and there is no mark at all.
    media.restore();
    media = stubMatchMedia(390, 844);
    media.setReducedMotion(true);
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.queryByTestId('live-state-mark')).toBeNull();
    expect(screen.queryByTestId('mark')).toBeNull();
    expect(chip()).toHaveTextContent(/^now$/);
    hold();
    expect(chip()).toHaveTextContent(/^<1 min ago$|^in <1 min$/);
  });

  /**
   * R101 (FR-JUMP-1, FR-JUMP-2; US-27 AC7; D-624): half an hour before the golden pass, the watching headline carries
   * `[ see this pass ]`; the tap holds the page at the rise — `pass ▶|`'s landing — which is scrubbing with the
   * stripe at that instant and the URL carrying it, and `[ back to live ]` returns. jsdom lays nothing out, so
   * the wide page's measured fit is its first answer, the path line, on both shells here; `shapes.spec.ts` walks
   * the placements in a browser.
   */
  it('wide: [ see this pass ] holds the page at the rise, and [ back to live ] returns (FR-JUMP-1, FR-JUMP-2)', () => {
    withTimeouts();
    const before = pass.start.t - HOUR / 2;
    vi.setSystemTime(before);
    withSky();
    // R144 (FR-TONIGHT-6): the next-event block and its control are wide's; the compact page jumps on its own (below).
    media = stubMatchMedia(1280, 800);
    window.location.hash = '#live';
    render(<LivePage link={null} onLeave={() => undefined} />);
    expect(screen.getByTestId('next-event-label')).toHaveTextContent('Next up · in 30:00');
    const control = screen.getByRole('button', { name: `See this pass: ${pass.name}, held at its rise` });
    expect(control.closest('[data-testid="next-event-path"]')).not.toBeNull();
    fireEvent.click(control);
    // Scrubbing, at the rise to the second — the instant `pass ▶|` lands on from real time — with the control gone.
    expect(screen.getByTestId('live-indicator')).toHaveAttribute('data-state', 'held');
    expect(Number(screen.getByTestId('time-stripe').getAttribute('aria-valuenow'))).toBe(pass.start.t);
    expect(screen.queryByTestId('next-event-see')).toBeNull();
    expect(screen.getByTestId('step-controls')).toBeInTheDocument();
    expect(window.location.hash).toBe(`#live?lat=-38.93&lon=-67.99&alt=0&t=${isoInstant(pass.start.t)}`);
    // The marker is on the dome at the rise.
    expect(screen.getByTestId('live-count')).toHaveTextContent(/^(Satellites 1 up|Up 1)$/);
    fireEvent.click(screen.getByRole('button', { name: en.live.backToLive }));
    expect(screen.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
    expect(screen.queryByTestId('time-stripe')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(window.location.hash).toBe('#live');
    expect(screen.getByTestId('next-event-see')).toBeInTheDocument();
  });

  /** D-171: the hash is written at most twice a second while scrubbing and never while playing. */
  it('writes the hash at most twice a second while scrubbing, never while playing, and once on pause', () => {
    withTimeouts();
    const frame = scriptedFrames();
    withSky();
    media = stubMatchMedia(1280, 800);
    window.location.hash = '#live';
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render(<LivePage link={null} onLeave={() => undefined} />);
    // Real time under the bare route: nothing to write.
    expect(replaceState).not.toHaveBeenCalled();
    // R77 (FR-WATCH-1, FR-LIVE-9): `[ scrub ]` holds the instant, and the URL carries it at once; half a second on
    // the throttle is clear again, and what follows is the scrub this test has always made.
    scrub();
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe(`#live?lat=-38.93&lon=-67.99&alt=0&t=${new Date(T).toISOString().replace('.000Z', 'Z')}`);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    replaceState.mockClear();
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
    // `[ back to live ]`: back to the bare route.
    fireEvent.click(screen.getByRole('button', { name: 'back to live' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(window.location.hash).toBe('#live');
  });

  /**
   * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-3, FR-GYRO-4, FR-GYRO-5, FR-GYRO-6; US-44 AC1..AC4; D-941, D-943..D-945):
   * `[ follow the phone ]` on this page. On a phone it is the sheet's own row after the view row (compact) and the
   * rail's `View` group's second line (wide); without the sensor there is no row at all. Its tap asks inside the
   * gesture; granted, the chart shows the window whatever the saved view is — the preference is not written — and
   * the window's facing and tilt follow the readings with nothing drawn over the sky; turned off, the window stays
   * where the phone last pointed. A refusal leaves it off with the one line under it. A drag on the sky ends
   * following and hands the camera to the finger. The sky screen the view control used to open is gone: nothing
   * renders `sky-screen` or `window-hold-up`, and `Esc` has three steps (above).
   */
  describe('[ follow the phone ] (FR-GYRO-1..6, US-44 AC1..AC4; D-943, D-944)', () => {
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
    /** The phone's back toward `azDeg`, `altDeg` up, as the W3C event the window listens for. */
    const reading = (azDeg: number, altDeg: number): void => {
      act(() => {
        window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: (360 - azDeg) % 360, beta: 90 + altDeg, gamma: 0, absolute: true }));
      });
    };
    const flush = async (): Promise<void> => {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
    };
    const windowDrawn = async (): Promise<void> => {
      await waitFor(() => {
        expect(document.querySelector('[data-follow="true"] [data-drawing="window"]')).not.toBeNull();
      });
    };
    const toggle = (): HTMLElement => screen.getByTestId('follow-toggle');
    const windowRoot = (): HTMLElement => document.querySelector('[data-look-az]') as HTMLElement;

    beforeEach(() => {
      resetOrientationAccess();
    });
    afterEach(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
      resetOrientationAccess();
    });

    it('stands in the sheet as its own row after the view row on a phone, and nowhere without the sensor (FR-GYRO-1, FR-GYRO-6)', () => {
      withSky();
      media = stubMatchMedia(390, 844);
      const { unmount } = render(<LivePage link={null} onLeave={() => undefined} />);
      expect(screen.queryByTestId('live-follow')).toBeNull();
      expect(screen.queryByTestId('follow-toggle')).toBeNull();
      expect(screen.queryByTestId('window-hold-up')).toBeNull();
      expect(screen.queryByTestId('sky-screen')).toBeNull();
      unmount();

      withPhone();
      render(<LivePage link={null} onLeave={() => undefined} />);
      const body = screen.getByTestId('sheet-body');
      expect([...body.children].map((el) => el.getAttribute('data-testid'))).toEqual(['live-context', 'live-timeline', 'live-view-row', 'live-follow', 'live-facing', 'live-actions', 'live-satellites']);
      expect(screen.getByTestId('live-follow')).toHaveAttribute('data-rhythm', 'group');
      expect(within(screen.getByTestId('live-follow')).getByTestId('follow-toggle')).toHaveTextContent(en.window.followToggle);
      expect(toggle()).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByTestId('window-hold-up')).toBeNull();
      expect(screen.queryByTestId('sky-screen')).toBeNull();
    });

    it('on wide stands in the rail’s View group, after [x] stars, and not in a sheet (FR-GYRO-1, D-944)', () => {
      withPhone();
      withSky();
      media = stubMatchMedia(1280, 800);
      render(<LivePage link={null} onLeave={() => undefined} />);
      const viewRow = screen.getByTestId('live-layout').querySelector('[data-slot="viewRow"]') as HTMLElement;
      const follow = within(viewRow).getByTestId('follow-toggle');
      expect(follow).toHaveTextContent(en.window.followToggle);
      expect(within(viewRow).getByTestId('stars-toggle').compareDocumentPosition(follow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByTestId('live-follow')).toBeNull();
    });

    it('asks inside the tap and, granted, shows the window following the phone without writing the view; off, the window stays where the phone pointed (FR-GYRO-2, FR-GYRO-5)', async () => {
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      withSky();
      media = stubMatchMedia(390, 844);
      act(() => {
        appStore.getState().setChartView('dome');
      });
      const frame = scriptedFrames();
      render(<LivePage link={null} onLeave={() => undefined} />);
      const chart = screen.getByTestId('sky-chart');
      expect(chart).toHaveAttribute('data-view', 'dome');
      expect(requestPermission).not.toHaveBeenCalled();

      fireEvent.click(toggle());
      // FR-WIN-4, FR-GYRO-2: the request is the gesture's, and nothing else asks.
      expect(requestPermission).toHaveBeenCalledTimes(1);
      await flush();
      expect(toggle()).toHaveAttribute('aria-pressed', 'true');
      expect(chart).toHaveAttribute('data-view', 'window');
      expect(chart).toHaveAttribute('data-follow', 'true');
      expect(appStore.getState().chartView).toBe('dome');
      expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ chartView: 'dome' });
      await windowDrawn();
      expect(windowRoot()).toHaveAttribute('data-follow', 'true');
      // FR-GYRO-5: nothing over the sky — the readout is not drawn, so the sheet's facing words are empty.
      expect(screen.queryByTestId('window-readout')).toBeNull();

      // The phone's readings turn the window: 30° up, facing east.
      reading(90, 30);
      frame(16);
      for (let i = 2; i <= 40; i += 1) frame(16 * i);
      expect(windowRoot()).toHaveAttribute('data-state', 'on');
      expect(windowRoot()).toHaveAttribute('data-look-alt', '30');
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('sky-screen')).toBeNull();

      // Off: the toggle asks nothing, the window stays the view, where the phone last pointed, and nothing is written.
      fireEvent.click(toggle());
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(toggle()).toHaveAttribute('aria-pressed', 'false');
      expect(chart).toHaveAttribute('data-view', 'window');
      expect(chart).not.toHaveAttribute('data-follow');
      expect(windowRoot()).not.toHaveAttribute('data-follow');
      expect(windowRoot()).toHaveAttribute('data-state', 'hand');
      expect(windowRoot()).toHaveAttribute('data-look-alt', '30');
      expect(appStore.getState().chartView).toBe('dome');
      expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ chartView: 'dome' });
    });

    it('a refusal leaves it off with the one line under it, and the page on its view (FR-GYRO-3)', async () => {
      withPhone(() => Promise.resolve('denied'));
      withSky();
      media = stubMatchMedia(390, 844);
      act(() => {
        appStore.getState().setChartView('dome');
      });
      render(<LivePage link={null} onLeave={() => undefined} />);
      fireEvent.click(toggle());
      await flush();
      expect(toggle()).toHaveAttribute('aria-pressed', 'false');
      expect(within(screen.getByTestId('live-follow')).getByTestId('follow-refused')).toHaveTextContent(en.window.followRefused);
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
      expect(screen.queryByTestId('chart-view-note')).toBeNull();
      expect(screen.queryByTestId('sky-screen')).toBeNull();
    });

    it('a drag on the sky ends following and hands the camera to the finger (FR-GYRO-4)', async () => {
      withPhone();
      withSky();
      media = stubMatchMedia(390, 844);
      scriptedFrames();
      render(<LivePage link={null} onLeave={() => undefined} />);
      fireEvent.click(toggle());
      await flush();
      expect(toggle()).toHaveAttribute('aria-pressed', 'true');
      await windowDrawn();
      const box = document.querySelector('[data-follow="true"] [tabindex="0"]') as HTMLElement;
      box.setPointerCapture = vi.fn();
      box.releasePointerCapture = vi.fn();
      fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
      fireEvent.pointerMove(box, { pointerId: 1, clientX: 140, clientY: 100 });
      // D-942, D-955: past the tap's slop the page is told, and following is off before the drag moves anything.
      expect(toggle()).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
      expect(screen.getByTestId('sky-chart')).not.toHaveAttribute('data-follow');
      fireEvent.pointerUp(box, { pointerId: 1, clientX: 140, clientY: 100 });
      expect(windowRoot()).toHaveAttribute('data-state', 'hand');
    });
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
    // R77 (FR-WATCH-4, V20-8) → R144 (D-905) → R150 (FR-GYRO-10): on compact the toggle is the satellites' heading row's.
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
    // R132 (D-842): the legend is the layout's `list` slot's, not the dome row's.
    const legend = screen.getByTestId('chart-legend');
    // R150 (FR-GYRO-10): on compact the list is the sheet's satellites, under the actions.
    expect(legend.closest('[data-testid="live-satellites"]')).not.toBeNull();
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
