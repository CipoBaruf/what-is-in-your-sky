import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../../../tests/support/catalogFixtures';
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
};
const later: Pass = { ...goldenPass, id: 'later', noradId: 2, name: 'Later object', start: { ...goldenPass.start, t: golden.start.t + 3_600_000 } };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [] };
const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};

describe('<PassList>', () => {
  afterEach(() => {
    appStore.setState(initial, true);
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

  it('renders cards as passes stream in, chronologically, with progress in the status line', () => {
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'computing', observer, total: 31 } });
    render(<PassList />);
    expect(screen.getByRole('status')).toHaveTextContent('Computing passes… 0 of 31 objects, 0 visible so far');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('list')).toBeNull();

    act(() => {
      appStore.getState().addPasses('job-1', [later]);
      appStore.getState().setProgress('job-1', 1, 31);
    });
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 31 objects, 1 visible so far');

    act(() => {
      appStore.getState().addPasses('job-1', [goldenPass]);
      appStore.getState().setProgress('job-1', 2, 31);
    });
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const starts = items.map((li) => within(li).getByText('Start', { selector: 'dt' }).nextElementSibling?.textContent ?? '');
    expect([...starts].sort()).toEqual(starts);

    const iss = screen.getByRole('article', { name: 'ISS (Zarya)' });
    expect(iss).toHaveAttribute('data-pass-id', goldenPass.id);
    expect(iss).toHaveTextContent(`${hhmmss(golden.start.t)} UTC`);
    expect(iss).toHaveTextContent(`${String(Math.round(golden.peak.elDeg))}°`);
    expect(iss).toHaveTextContent(`${compassPoint(golden.peak.azDeg)} (${String(Math.round(golden.peak.azDeg))}°)`);

    act(() => {
      appStore.getState().finishJob('job-1', { cancelled: false, elapsedMs: 300, hasDarkness: true });
    });
    expect(screen.getByRole('status')).toHaveTextContent('2 visible passes in the next 24 h from −38.93, −67.99');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
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
