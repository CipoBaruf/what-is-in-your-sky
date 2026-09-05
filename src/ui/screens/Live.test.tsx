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
import { skyBodiesAt } from '../../lib/skyBodies';
import type { Observer, Pass } from '../../model';
import { appStore, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
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

describe('<LivePage>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(T);
  });
  afterEach(() => {
    vi.useRealTimers();
    appStore.setState(initial, true);
    window.localStorage.clear();
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
});
