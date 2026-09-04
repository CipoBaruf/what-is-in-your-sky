import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../../../tests/support/catalogFixtures';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { compassPoint } from '../../../lib/compass';
import type { Observer, Pass, WeatherSnapshot } from '../../../model';
import { appStore, type AppState, type ElementsState } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { PassList } from './PassList';

const ref = loadReferenceValues();
const NOW = goldenWindowStart(ref);
const observer: Observer = { ...ref.observer, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);
const initial = appStore.getInitialState();
const golden = ref.firstGoldenPass;
if (!golden) throw new Error('reference-values.json has no firstGoldenPass');

const goldenPass: Pass = {
  id: `25544-${String(golden.start.t)}`,
  noradId: 25544,
  name: 'ISS (Zarya)',
  start: { ...golden.start, rangeKm: 1500 },
  peak: { ...golden.peak, rangeKm: 1500 },
  end: { ...golden.end, rangeKm: 1500 },
  startReason: 'horizon',
  endReason: 'horizon',
  durationS: (golden.end.t - golden.start.t) / 1000,
  peakMagnitude: golden.peakMagnitude,
  sunAltAtPeakDeg: -8,
  twilight: golden.twilight,
  track: [],
  elementsEpochMs: ref.t,
  ...NO_MOON_AT_PEAK, // the Moon reaches the list in R30 (FR-MOON-2)
};
const later: Pass = { ...goldenPass, id: 'later', noradId: 2, name: 'Later object', start: { ...goldenPass.start, t: golden.start.t + 3_600_000 } };
// R12: three non-featured passes for the sort toggle. Chronological: faint-high, bright-low, average. Best first: bright-low, average, faint-high.
const HOUR = 3_600_000;
const shifted = (base: Pass, id: string, noradId: number, name: string, hours: number, elDeg: number, peakMagnitude: number): Pass => ({
  ...base,
  id,
  noradId,
  name,
  start: { ...base.start, t: base.start.t + hours * HOUR },
  peak: { ...base.peak, t: base.peak.t + hours * HOUR, elDeg },
  end: { ...base.end, t: base.end.t + hours * HOUR },
  peakMagnitude,
});
const faintHigh = shifted(goldenPass, 'faint-high', 2, 'Faint high', 1, 80, 2.0);
const brightLow = shifted(goldenPass, 'bright-low', 3, 'Bright low', 2, 25, -1.5);
const average = shifted(goldenPass, 'average', 4, 'Average', 3, 45, 0.5);
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};

const cardNames = (): string[] => within(screen.getByRole('list')).getAllByRole('article').map((a) => within(a).getByRole('heading').textContent ?? '');

describe('<PassList>', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  it('asks for coordinates when there is no observer', () => {
    render(<PassList />);
    expect(screen.getByRole('status')).toHaveTextContent('Enter a place name or coordinates to see the visible passes.');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows loading and error states once an observer exists', () => {
    set({ observer, nowMs: NOW, elements: { status: 'loading' } });
    render(<PassList />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading orbital elements');
    set({ elements: { status: 'error', message: 'HTTP 503' } });
    expect(screen.getByRole('status')).toHaveTextContent('Could not load orbital elements: HTTP 503');
  });

  it('renders cards as passes stream in, chronologically, with progress in the status line; the featured pass moves to the hero card (R12)', () => {
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'computing', observer, total: 31 } });
    render(<PassList />);
    expect(screen.getByRole('status')).toHaveTextContent('Computing passes… 0 of 31, 0 visible so far');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('list')).toBeNull();

    act(() => {
      appStore.getState().addPasses('job-1', [later]);
      appStore.getState().setProgress('job-1', 1, 31);
    });
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 31, 1 visible so far');

    expect(screen.queryByTestId('iss-hero')).toBeNull(); // a non-featured object gets no hero card

    act(() => {
      appStore.getState().addPasses('job-1', [goldenPass, average]);
      appStore.getState().setProgress('job-1', 2, 31);
    });
    // The ISS pass is the hero, not repeated in the list; the list keeps chronological order.
    expect(cardNames()).toEqual(['Later object', 'Average']);
    const iss = screen.getByRole('article', { name: 'ISS (Zarya)' });
    expect(iss).toHaveAttribute('data-testid', 'iss-hero');
    expect(iss).toHaveAttribute('data-pass-id', goldenPass.id);
    expect(within(iss).getByText('Next ISS pass')).toBeInTheDocument();
    expect(iss).toHaveTextContent(`${hhmmss(golden.start.t)} UTC`);
    expect(iss).toHaveTextContent(`${String(Math.round(golden.peak.elDeg))}°`);
    expect(iss).toHaveTextContent(`${compassPoint(golden.peak.azDeg)} (${String(Math.round(golden.peak.azDeg))}°)`);

    act(() => {
      appStore.getState().finishJob('job-1', { cancelled: false, elapsedMs: 300, hasDarkness: true });
    });
    expect(screen.getByRole('status')).toHaveTextContent('3 visible passes in the next 24 h from −38.93, −67.99');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
  });

  it('shows the hero card only for a featured pass that has not ended, and never repeats it in the list (spec §8 rank 1)', () => {
    // The hero choice reads the wall clock, so this copy ends two hours before it (the golden fixture itself is in its future).
    const wall = Date.now() - 2 * HOUR;
    const ended = { ...goldenPass, id: 'ended', start: { ...goldenPass.start, t: wall }, peak: { ...goldenPass.peak, t: wall + 60_000 }, end: { ...goldenPass.end, t: wall + 120_000 } };
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [average, later] } });
    render(<PassList />);
    expect(screen.queryByTestId('iss-hero')).toBeNull();
    expect(cardNames()).toEqual(['Later object', 'Average']);

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [ended, average, later] } });
    expect(screen.queryByTestId('iss-hero')).toBeNull(); // ended: no hero, the pass stays in the list
    expect(cardNames()).toEqual(['ISS (Zarya)', 'Later object', 'Average']);

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [ended, goldenPass, average, later] } });
    expect(screen.getByTestId('iss-hero')).toHaveAttribute('data-pass-id', goldenPass.id);
    expect(cardNames()).toEqual(['ISS (Zarya)', 'Later object', 'Average']);
    expect(screen.getAllByRole('article', { name: 'ISS (Zarya)' })).toHaveLength(2); // the ended one in the list, the next one as hero
  });

  it('sorts the list best first on request, persists the order in wiys:prefs:v1, and restores it (US-5 AC2)', async () => {
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [average, faintHigh, brightLow], hasDarkness: true } });
    const { unmount, container } = render(<PassList onOpenPass={() => undefined} />);
    expect(cardNames()).toEqual(['Faint high', 'Bright low', 'Average']);
    expect(screen.getByRole('button', { name: 'Soonest first' })).toHaveAttribute('aria-pressed', 'true');
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole('button', { name: 'Best first' }));
    expect(cardNames()).toEqual(['Bright low', 'Average', 'Faint high']);
    expect(screen.getByRole('button', { name: 'Best first' })).toHaveAttribute('aria-pressed', 'true');
    expect(appStore.getState().sort).toBe('best');
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ sort: 'best' });

    unmount();
    render(<PassList />);
    expect(cardNames()).toEqual(['Bright low', 'Average', 'Faint high']);
    await userEvent.click(screen.getByRole('button', { name: 'Soonest first' }));
    expect(cardNames()).toEqual(['Faint high', 'Bright low', 'Average']);
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ sort: 'chronological' });
  });

  it('shows the empty states: no elements, no passes, no darkness, and a failed job', () => {
    set({ observer, nowMs: NOW, elements: { ...ready, records: [] } });
    render(<PassList />);
    expect(screen.getByRole('status')).toHaveTextContent('No catalog objects have orbital elements');

    set({ elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, hasDarkness: true } });
    expect(screen.getByRole('status')).toHaveTextContent('No visible passes in the next 24 h from −38.93, −67.99.');
    expect(screen.queryByRole('list')).toBeNull();

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, hasDarkness: false } });
    expect(screen.getByRole('status')).toHaveTextContent('No darkness tonight at this latitude');

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'error', observer, error: 'INTERNAL: boom' } });
    expect(screen.getByRole('status')).toHaveTextContent('Could not compute passes: INTERNAL: boom');
  });
  it('badges every card with the verdict from this observer’s forecast, and "weather unknown" until it arrives (FR-WX-3)', () => {
    const HOUR = 3_600_000;
    const hour = Math.floor(golden.peak.t / HOUR) * HOUR;
    const forecast: WeatherSnapshot = {
      provider: 'open-meteo',
      lat: -38.9,
      lon: -68,
      cellKey: '-38.9,-68.0',
      fetchedAt: NOW,
      timeZone: 'America/Argentina/Salta',
      hourly: [
        { t: hour, totalPct: 90, lowPct: 90, midPct: 90, highPct: 90 },
        { t: hour + 2 * HOUR, totalPct: 90, lowPct: 90, midPct: 90, highPct: 90 },
      ],
    };
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [goldenPass, later] }, weather: { observer, status: 'loading', snapshot: null, error: null } });
    render(<PassList />);
    expect(screen.getAllByText('Weather unknown')).toHaveLength(2);
    set({ weather: { observer, status: 'ready', snapshot: forecast, error: null } });
    const badges = screen.getAllByText('Likely obscured, 90 % cloud');
    expect(badges).toHaveLength(2);
    for (const badge of badges) expect(badge).toHaveAttribute('data-state', 'obscured');
    // Another observer's forecast is not used.
    set({ weather: { observer: { ...observer, lat: 0 }, status: 'ready', snapshot: forecast, error: null } });
    expect(screen.getAllByText('Weather unknown')).toHaveLength(2);
  });
});
