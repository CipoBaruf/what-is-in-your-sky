import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../../../tests/support/catalogFixtures';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
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
    vi.restoreAllMocks();
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

  it('renders cards as passes stream in, chronologically, with progress in the status line; the next featured pass is tagged in its place (R12, FR-FIRST-10)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW); // F-68: the tag's choice reads the wall clock
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

    expect(screen.queryByTestId('next-tag')).toBeNull(); // a non-featured object gets no tag

    act(() => {
      appStore.getState().addPasses('job-1', [goldenPass, average]);
      appStore.getState().setProgress('job-1', 2, 31);
    });
    // The ISS pass stays in the list, in its chronological place, and carries the tag the hero card was.
    expect(cardNames()).toEqual(['ISS (Zarya)', 'Later object', 'Average']);
    const iss = screen.getByRole('article', { name: 'ISS (Zarya)' });
    expect(iss).toHaveAttribute('data-pass-id', goldenPass.id);
    expect(within(iss).getByTestId('next-tag')).toHaveTextContent('Next ISS');
    expect(screen.getAllByTestId('next-tag')).toHaveLength(1);
    expect(within(iss).getByTestId('card-first-line')).toHaveTextContent(`${hhmmss(golden.start.t).slice(0, 5)} UTC`);
    expect(within(iss).getByTestId('card-detail')).toHaveTextContent(`peak ${String(Math.round(golden.peak.elDeg))}° ${compassPoint(golden.peak.azDeg)}`);

    act(() => {
      appStore.getState().finishJob('job-1', { cancelled: false, elapsedMs: 300, hasDarkness: true });
    });
    expect(screen.getByRole('status')).toHaveTextContent('3 visible passes in 72 h');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
  });

  it('the count and the sort share one line (FR-FIRST-10)', () => {
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [average, later], hasDarkness: true } });
    render(<PassList />);
    const line = screen.getByTestId('count-line');
    expect(line).toContainElement(screen.getByRole('status'));
    expect(line).toContainElement(screen.getByRole('group', { name: 'Sort passes' }));
    // R84 (F-78): the separator is a rendered node on the sort's side, not the count's `::after`, and is not read.
    expect(line).toHaveTextContent(/^2 visible passes in 72 h · Sort:SoonestBest$/);
    const separator = within(line).getByTestId('count-separator');
    expect(separator).toHaveAttribute('aria-hidden', 'true');
    expect(separator.nextElementSibling).toBe(screen.getByRole('group', { name: 'Sort passes' }));
    expect(screen.getByRole('status')).toHaveTextContent(/^2 visible passes in 72 h$/);
  });

  it('tags only the featured pass that has not ended, and only one (spec §8 rank 1 as amended)', () => {
    // The choice reads the wall clock, pinned at NOW (F-68); this copy ends two hours before it and the golden fixture itself is in its future.
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const wall = Date.now() - 2 * HOUR;
    const ended = { ...goldenPass, id: 'ended', start: { ...goldenPass.start, t: wall }, peak: { ...goldenPass.peak, t: wall + 60_000 }, end: { ...goldenPass.end, t: wall + 120_000 } };
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [average, later] } });
    render(<PassList />);
    expect(screen.queryByTestId('next-tag')).toBeNull();
    expect(cardNames()).toEqual(['Later object', 'Average']);

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [ended, average, later] } });
    expect(screen.queryByTestId('next-tag')).toBeNull(); // ended: no tag, the pass stays in the list
    expect(cardNames()).toEqual(['ISS (Zarya)', 'Later object', 'Average']);

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [ended, goldenPass, average, later] } });
    expect(cardNames()).toEqual(['ISS (Zarya)', 'ISS (Zarya)', 'Later object', 'Average']);
    expect(screen.getAllByTestId('next-tag')).toHaveLength(1);
    expect(screen.getByTestId('next-tag').closest('article')).toHaveAttribute('data-pass-id', goldenPass.id);
  });

  it('words the tag "Next ISS" for the station and "Next <name>" otherwise, the name untranslated (FR-I18N-6)', () => {
    expect(en.passes.nextTag({ name: 'ISS (Zarya)', iss: true })).toBe('Next ISS');
    expect(en.passes.nextTag({ name: 'Tiangong (Tianhe)', iss: false })).toBe('Next Tiangong (Tianhe)');
    expect(es.passes.nextTag({ name: 'ISS (Zarya)', iss: true })).toBe('Próxima ISS');
    expect(es.passes.nextTag({ name: 'Tiangong (Tianhe)', iss: false })).toBe('Próximo Tiangong (Tianhe)');
  });

  // R52: jsdom without a `matchMedia` stub is the compact layout, where the two orders carry their short names (US-5 AC2 as amended, FR-COMP-4). The order they produce is the same.
  it('sorts the list best first on request, persists the order in wiys:prefs:v1, and restores it (US-5 AC2)', async () => {
    set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [average, faintHigh, brightLow], hasDarkness: true } });
    const { unmount, container } = render(<PassList onOpenPass={() => undefined} />);
    expect(cardNames()).toEqual(['Faint high', 'Bright low', 'Average']);
    expect(screen.getByRole('button', { name: 'Soonest' })).toHaveAttribute('aria-pressed', 'true');
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole('button', { name: 'Best' }));
    expect(cardNames()).toEqual(['Bright low', 'Average', 'Faint high']);
    expect(screen.getByRole('button', { name: 'Best' })).toHaveAttribute('aria-pressed', 'true');
    expect(appStore.getState().sort).toBe('best');
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ sort: 'best' });

    unmount();
    render(<PassList />);
    expect(cardNames()).toEqual(['Bright low', 'Average', 'Faint high']);
    await userEvent.click(screen.getByRole('button', { name: 'Soonest' }));
    expect(cardNames()).toEqual(['Faint high', 'Bright low', 'Average']);
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ sort: 'chronological' });
  });

  it('shows the empty states: no elements, no passes, no darkness, and a failed job', () => {
    set({ observer, nowMs: NOW, elements: { ...ready, records: [] } });
    render(<PassList />);
    expect(screen.getByRole('status')).toHaveTextContent('No catalog objects have orbital elements');

    set({ elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, hasDarkness: true } });
    expect(screen.getByRole('status')).toHaveTextContent('No visible passes in the next 72 h from −38.93, −67.99.');
    expect(screen.queryByRole('list')).toBeNull();

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, hasDarkness: false } });
    expect(screen.getByRole('status')).toHaveTextContent('No darkness tonight at this latitude');

    set({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'error', observer, error: 'INTERNAL: boom' } });
    expect(screen.getByRole('status')).toHaveTextContent('Could not compute passes: INTERNAL: boom');
  });
  /**
   * R27 (US-16 AC5, FR-OFF-2). The window is the run's, so the nights are the
   * ones the worker searched; the observer here has no zone, so every date is
   * UTC and "tonight" is decided on the UTC calendar.
   */
  describe('the three nights', () => {
    const NIGHT = 24 * HOUR;
    const window = { startMs: NOW, endMs: NOW + 3 * NIGHT };
    // Three plain passes, one per night, none of them featured, all in the future of the golden window.
    const first = shifted(goldenPass, 'first', 2, 'First night', 1, 40, 1.0);
    const second = shifted(goldenPass, 'second', 3, 'Second night', 25, 40, 1.0);
    const third = shifted(goldenPass, 'third', 4, 'Third night', 49, 40, 1.0);
    const threeNights = (): void => {
      set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, window, passes: [first, second, third], hasDarkness: true } });
    };
    const groups = () => screen.getAllByTestId('night-group');
    const toggles = () => screen.getAllByTestId('night-toggle');
    const opened = () => groups().map((group) => !group.hidden);

    it('groups the list by night, the first open and the rest closed, with the toggles on one row under the cards', async () => {
      threeNights();
      const { container } = render(<PassList />);
      expect(groups()).toHaveLength(3);
      expect(opened()).toEqual([true, false, false]);
      expect(toggles().map((toggle) => toggle.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false']);
      // The row follows every night's cards in the document (FR-FIRST-10).
      const row = screen.getByRole('group', { name: 'Nights' });
      for (const group of groups()) expect(group.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Each night holds its own pass, and its toggle counts it and controls it.
      for (const [i, name] of ['First night', 'Second night', 'Third night'].entries()) {
        const group = groups()[i] as HTMLElement;
        // `hidden: true`: a closed night's cards are still in the document, which is what the collapse is.
        expect(within(group).getByRole('article', { hidden: true })).toHaveAccessibleName(name);
        expect(toggles()[i]).toHaveTextContent('1 pass');
        expect(toggles()[i]).toHaveAttribute('aria-controls', group.id);
      }
      expect(await axe(container)).toHaveNoViolations();
    });

    /**
     * F-67: the reader's clock is pinned, because the labels are a function of
     * it. `nightLabel` has three branches — tonight, tomorrow night, the date
     * — and the run-time clock decides which one each night gets, so an
     * assertion that reads `Date.now()` is asserting whatever day CI runs on.
     * The old hedge had two branches for three, and was red for the whole
     * calendar day before the golden window's date, where the first night is
     * "tomorrow". With the clock at `NOW` the three labels are literals, and
     * the test says what it is named for.
     */
    it('names the nights from the reader’s own clock: tonight, tomorrow night, then the date', () => {
      vi.spyOn(Date, 'now').mockReturnValue(NOW);
      threeNights();
      render(<PassList />);
      const day = (t: number): string => new Date(t).toISOString().slice(0, 10);
      expect(toggles()[0]).toHaveTextContent('Tonight');
      expect(toggles()[1]).toHaveTextContent('Tomorrow night');
      expect(toggles()[2]).toHaveTextContent(`Night of ${day(NOW + 2 * NIGHT)}`);
      // Each night's cards are named by their night for whoever hears them rather than sees the row.
      expect(groups()[0]).toHaveAccessibleName('Tonight');
    });

    it('a night with nothing in it keeps its toggle and says so', () => {
      set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, window, passes: [first, third], hasDarkness: true } });
      render(<PassList />);
      expect(toggles()[1]).toHaveTextContent('0 passes');
      expect(groups()[1]).toHaveTextContent('No visible passes.');
    });

    it('F-25: the toggle counts the cards under it, the tagged pass among them now that it stays in the list', () => {
      vi.spyOn(Date, 'now').mockReturnValue(NOW);
      const iss = shifted(goldenPass, 'iss', 25544, 'ISS (Zarya)', 3, 40, 1.0);
      set({
        observer,
        nowMs: NOW,
        elements: ready,
        passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, window, passes: [first, iss, shifted(goldenPass, 'other', 5, 'Other', 5, 40, 1.0)], hasDarkness: true },
      });
      render(<PassList />);
      expect(within(groups()[0] as HTMLElement).getByTestId('next-tag')).toBeInTheDocument();
      expect(within(groups()[0] as HTMLElement).getAllByRole('article', { hidden: true })).toHaveLength(3);
      expect(toggles()[0]).toHaveTextContent('3 passes');
    });

    it('F-24: a location change forgets which nights the reader closed, so the new list opens on one', async () => {
      threeNights();
      const { rerender } = render(<PassList />);
      await userEvent.click(toggles()[0] as HTMLElement);
      expect(opened()).toEqual([false, false, false]);
      // Somewhere else: the same three night indexes, but nights the reader has never seen.
      const elsewhere: Observer = { ...observer, lat: 40.42, lon: -3.7, label: 'Madrid' };
      set({
        observer: elsewhere,
        passes: { ...IDLE_PASSES, jobId: 'job-2', status: 'done', observer: elsewhere, window, passes: [first, second, third], hasDarkness: true },
      });
      rerender(<PassList />);
      expect(opened()).toEqual([true, false, false]);
    });

    it('F-26: tomorrow night is the next date on the observer’s calendar, not now + 24 h', () => {
      // Santiago moves its clocks forward at midnight into 2026-09-06, so that day is 23 h long.
      // The run starts at 23:30 on the 5th; 24 h of clock later is 00:30 on the *7th*, and the
      // second night — which is the 7th's — used to be labelled "tomorrow night" from that sum.
      const zoned: Observer = { ...observer, timeZone: 'America/Santiago' };
      const start = Date.UTC(2026, 8, 6, 3, 30, 0);
      const dstWindow = { startMs: start, endMs: start + 2 * NIGHT };
      const at = (t: number, id: string) => ({ ...first, id, start: { ...first.start, t }, peak: { ...first.peak, t }, end: { ...first.end, t: t + 60_000 } });
      set({
        observer: zoned,
        nowMs: start,
        elements: ready,
        passes: { ...IDLE_PASSES, jobId: 'job-3', status: 'done', observer: zoned, window: dstWindow, passes: [at(start + HOUR, 'n0'), at(start + NIGHT + HOUR, 'n1')], hasDarkness: true },
      });
      vi.spyOn(Date, 'now').mockReturnValue(start);
      render(<PassList />);
      expect(toggles()[0]).toHaveTextContent('Tonight');
      expect(toggles()[1]).toHaveTextContent('Night of 2026-09-07');
      expect(screen.queryByText('Tomorrow night')).toBeNull();
    });

    it('the reader can open and close nights, and the choice sticks', async () => {
      threeNights();
      render(<PassList />);
      await userEvent.click(toggles()[1] as HTMLElement);
      expect(opened()).toEqual([true, true, false]);
      expect(toggles()[1]).toHaveAttribute('aria-expanded', 'true');
      await userEvent.click(toggles()[0] as HTMLElement);
      expect(opened()).toEqual([false, true, false]);
    });

    it('one night is no grouping at all: a 24 h window renders the plain list', () => {
      set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, window: { startMs: NOW, endMs: NOW + NIGHT }, passes: [first], hasDarkness: true } });
      render(<PassList />);
      expect(screen.queryAllByTestId('night-group')).toHaveLength(0);
      expect(screen.queryByTestId('night-toggles')).toBeNull();
      expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    });
  });

  it('words every card with the verdict from this observer’s forecast, and "weather unknown" until it arrives (FR-WX-3)', () => {
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
    const badges = screen.getAllByText('Likely obscured');
    expect(badges).toHaveLength(2);
    for (const badge of badges) expect(badge).toHaveAttribute('data-state', 'obscured');
    // Another observer's forecast is not used.
    set({ weather: { observer: { ...observer, lat: 0 }, status: 'ready', snapshot: forecast, error: null } });
    expect(screen.getAllByText('Weather unknown')).toHaveLength(2);
  });
});
