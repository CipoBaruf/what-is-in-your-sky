/**
 * TASKS R7 component tests: every panel state (one visible item, daylight,
 * nothing above 10°, everything in shadow, no darkness tonight), the
 * re-render without remount on a store update, the labelled region and
 * `jest-axe`.
 */
import { act, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import type { NowItem, NowState, Observer, WeatherSnapshot } from '../../../model';
import { appStore, type AppState } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { NowPanel, remainingText, summaryText } from './NowPanel';

const T = 1_789_120_104_063; // inside the R1 golden pass, 10 s after its start
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const other: Observer = { ...observer, lat: 48.86, lon: 2.35, label: '48.86, 2.35' };
const initial = appStore.getInitialState();

const item = (over: Partial<NowItem> = {}): NowItem => ({
  noradId: 25544,
  name: 'ISS (Zarya)',
  azDeg: 247.4,
  elDeg: 34.2,
  rangeKm: 700,
  magnitude: -2.1,
  lit: true,
  aboveMinElevation: true,
  visible: true,
  ...over,
});
const state = (over: Partial<NowState> = {}): NowState => ({ t: T, sunAltDeg: -30, sky: 'dark', items: [], moon: MOON_FIXTURE, ...over });
const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};
const HOUR = 3_600_000;
const hourBefore = Math.floor(T / HOUR) * HOUR;
const forecast: WeatherSnapshot = {
  provider: 'open-meteo',
  lat: -38.9,
  lon: -68,
  cellKey: '-38.9,-68.0',
  fetchedAt: T - HOUR,
  timeZone: 'America/Argentina/Salta',
  hourly: [
    { t: hourBefore, totalPct: 40, lowPct: 40, midPct: 40, highPct: 40 },
    { t: hourBefore + HOUR, totalPct: 60, lowPct: 60, midPct: 60, highPct: 60 },
  ],
};
/** A finished job for `observer`, so `hasDarkness` is known. */
const done = (hasDarkness: boolean) => ({ ...IDLE_PASSES, jobId: 'job-1', status: 'done' as const, observer, hasDarkness });

describe('remainingText', () => {
  it('words the end reason with a m:ss countdown', () => {
    expect(remainingText(item({ visibleUntil: T + 192_000, endReason: 'horizon' }), T, en)).toBe('sets in 3:12');
    expect(remainingText(item({ visibleUntil: T + 65_000, endReason: 'shadow' }), T, en)).toBe("enters Earth's shadow in 1:05");
    expect(remainingText(item({ visibleUntil: T + 40_000, endReason: 'twilight' }), T, en)).toBe('fades into the brightening sky in 0:40');
    expect(remainingText(item(), T, en)).toBe('visible for a while yet');
    expect(remainingText(item({ visibleUntil: T + 192_000, endReason: 'horizon' }), T, es)).toBe('se pone en 3:12');
  });
});

describe('<NowPanel>', () => {
  afterEach(() => {
    appStore.setState(initial, true);
  });

  it('is a labelled region that asks for coordinates when there is no observer', async () => {
    const { container } = render(<NowPanel />);
    const region = screen.getByRole('region', { name: 'Right now' });
    expect(region).toHaveTextContent('Enter a place name or coordinates to see what is overhead right now.');
    expect(screen.queryByRole('list')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says it is checking until the first state for this observer arrives, and ignores another observer’s state', () => {
    set({ observer, now: { observer: other, state: state(), error: null } });
    render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking the sky…');
    expect(screen.queryByText(/as of/)).toBeNull();
  });

  it('lists one visible item with compass + degrees azimuth, elevation and time remaining', async () => {
    const visible = item({ visibleUntil: T + 192_000, endReason: 'horizon' });
    set({ observer, passes: done(true), now: { observer, state: state({ sky: 'bright-twilight', items: [visible] }), error: null } });
    const { container } = render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('1 satellite visible right now');
    const [li] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(li).toHaveTextContent('ISS (Zarya)');
    expect(li).toHaveTextContent('WSW 247°');
    expect(li).toHaveTextContent('34° up');
    expect(li).toHaveTextContent('sets in 3:12');
    expect(screen.getByText('as of 09:48:24 UTC')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sorts several visible items by elevation, highest first, and hides the invisible ones', () => {
    const low = item({ noradId: 1, name: 'Low one', elDeg: 12, azDeg: 10, visibleUntil: T + 5_000, endReason: 'shadow' });
    const high = item({ noradId: 2, name: 'High one', elDeg: 70, azDeg: 180, visibleUntil: T + 90_000, endReason: 'horizon' });
    const hidden = item({ noradId: 3, name: 'Shadowed', lit: false, visible: false });
    set({ observer, passes: done(true), now: { observer, state: state({ items: [low, hidden, high] }), error: null } });
    render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('2 satellites visible right now');
    const names = within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(names[0]).toContain('High one');
    expect(names[1]).toContain('Low one');
    expect(screen.queryByText('Shadowed')).toBeNull();
    expect(names[0]).toContain('S 180°');
    expect(names[1]).toContain("enters Earth's shadow in 0:05");
  });

  it('explains daylight', async () => {
    set({ observer, passes: done(true), now: { observer, state: state({ sky: 'day', sunAltDeg: 41.6, items: [item({ visible: false })] }), error: null } });
    const { container } = render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Daylight: the sun is 42° above the horizon. Satellites are not visible until the sky is dark.');
    expect(screen.queryByRole('list')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('explains "nothing above 10°"', () => {
    const below = item({ elDeg: -20, aboveMinElevation: false, visible: false, magnitude: null });
    set({ observer, passes: done(true), now: { observer, state: state({ items: [below, { ...below, noradId: 2 }] }), error: null } });
    render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing visible right now: no catalog satellite is above 10°.');
  });

  it('explains "everything in shadow", singular and plural', () => {
    const shadowed = item({ lit: false, visible: false, magnitude: null });
    const below = item({ noradId: 9, elDeg: -5, aboveMinElevation: false, visible: false });
    set({ observer, passes: done(true), now: { observer, state: state({ items: [shadowed, below] }), error: null } });
    render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent("Nothing visible right now: 1 satellite is up but in Earth's shadow.");
    set({ now: { observer, state: state({ items: [shadowed, { ...shadowed, noradId: 2 }, below] }), error: null } });
    expect(screen.getByRole('status')).toHaveTextContent("Nothing visible right now: 2 satellites are up but all in Earth's shadow.");
  });

  it('explains "no darkness tonight" from the finished job, whatever the sky says', () => {
    set({ observer, passes: done(false), now: { observer, state: state({ sky: 'day', sunAltDeg: -3, items: [item({ visible: false })] }), error: null } });
    render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('No darkness tonight at this latitude');
    // A visible item still wins: darkness is decided by the sun altitude the worker measured.
    set({ now: { observer, state: state({ items: [item({ visibleUntil: T + 1_000, endReason: 'horizon' })] }), error: null } });
    expect(screen.getByRole('status')).toHaveTextContent('1 satellite visible right now');
  });

  it('reports a failed check but keeps the last good state visible', () => {
    set({ observer, passes: done(true), now: { observer, state: null, error: 'NO_ELEMENTS: nothing loaded' } });
    render(<NowPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Could not check the sky: NO_ELEMENTS: nothing loaded');
  });

  it('re-renders in place on every 10 s update, without remounting the region', () => {
    set({ observer, passes: done(true), now: { observer, state: state({ items: [item({ visibleUntil: T + 192_000, endReason: 'horizon' })] }), error: null } });
    render(<NowPanel />);
    const region = screen.getByRole('region', { name: 'Right now' });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('1 satellite visible');
    set({ now: { observer, state: state({ t: T + 10_000, items: [item({ elDeg: 40, azDeg: 250, visibleUntil: T + 192_000, endReason: 'horizon' })] }), error: null } });
    expect(screen.getByRole('region', { name: 'Right now' })).toBe(region);
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('1 satellite visible');
    expect(screen.getByRole('listitem')).toHaveTextContent('sets in 3:02');
    expect(screen.getByRole('listitem')).toHaveTextContent('40° up');
    expect(screen.getByText('as of 09:48:34 UTC')).toBeInTheDocument();
  });

  it('shows the current cloud cover from the forecast, interpolated to the instant of the check (FR-WX-3)', () => {
    set({ observer, passes: done(true), now: { observer, state: state(), error: null }, weather: { observer, status: 'ready', snapshot: forecast, error: null } });
    render(<NowPanel />);
    // T is 48 min 24 s past the hour: 40 + 20·(2904/3600) ≈ 56 %.
    const badge = screen.getByText('Partly cloudy, 56 % cloud');
    expect(badge).toHaveAttribute('data-state', 'partly');
    expect(screen.getByText(/Clouds now:/)).toContainElement(badge);
    expect(screen.getByRole('tooltip')).toHaveTextContent('right now');
  });

  it('says "weather unknown" when the forecast failed, is still loading, or belongs to another observer (US-7 AC4)', () => {
    set({ observer, passes: done(true), now: { observer, state: state(), error: null }, weather: { observer, status: 'error', snapshot: null, error: 'HTTP 503' } });
    render(<NowPanel />);
    expect(screen.getByText('Weather unknown')).toHaveAttribute('data-state', 'unknown');
    set({ weather: { observer, status: 'loading', snapshot: null, error: null } });
    expect(screen.getByText('Weather unknown')).toBeInTheDocument();
    set({ weather: { observer: other, status: 'ready', snapshot: forecast, error: null } });
    expect(screen.getByText('Weather unknown')).toBeInTheDocument();
  });

  it('summaryText covers every kind', () => {
    expect(summaryText({ kind: 'visible', items: [item(), item({ noradId: 2 })] }, en)).toBe('2 satellites visible right now');
    expect(summaryText({ kind: 'daylight', sunAltDeg: -2.6 }, en)).toContain('3° below the horizon');
    expect(summaryText({ kind: 'visible', items: [item()] }, es)).toBe('1 satélite visible ahora mismo');
    expect(summaryText({ kind: 'daylight', sunAltDeg: -2.6 }, es)).toContain('3° bajo el horizonte');
  });
});
