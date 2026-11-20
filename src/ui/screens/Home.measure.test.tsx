/**
 * FR-MEAS-2 as amended v2.16 (FR-OPEN-10, D-1182): `where_shown` is counted when the place group shows on a first
 * visit — `example` when the action opens it, `fallback` when the page is the question — and not before; a visit
 * with a place counts nothing here.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { en } from '../../i18n/en';
import type { Observer } from '../../model';
import { appStore, type ElementsState } from '../../state';
import { count } from '../../state/measure';
import { IDLE_PASSES } from '../../state/slices/passes';
import { Home } from './Home';
import { usePlaceOpen } from './home/usePlaceOpen';

vi.mock('../../state/measure', () => ({ count: vi.fn() }));

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const example: Observer = { lat: -34.6, lon: -58.45, altM: 0, label: 'Buenos Aires', source: 'example', timeZone: 'America/Argentina/Buenos_Aires' };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
let media: MatchMediaStub;

afterEach(() => {
  vi.restoreAllMocks();
  media.restore();
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('where_shown is counted when the place group shows (FR-OPEN-10)', () => {
  const finds = {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback) => {
        ok({ coords: { latitude: -38.93, longitude: -67.99, altitude: null, accuracy: 30 }, timestamp: 0 } as unknown as GeolocationPosition);
      },
    } as unknown as Geolocation,
    secure: true,
  };
  function Host() {
    const place = usePlaceOpen();
    return <Home offersInert={false} guide="closed" shareNotice={null} selectedPassId={null} onOpenPass={vi.fn()} passDetail={null} MoonLore={undefined} geolocation={finds} place={place} />;
  }
  const counted = () => vi.mocked(count).mock.calls.map((call) => call.join(':'));
  const run = (of: Observer | null) => ({ ...IDLE_PASSES, jobId: 'job-1', status: 'done' as const, observer: of, passes: [pass], hasDarkness: true });
  const withExample = () => {
    act(() => {
      appStore.setState({ example, exampleStartedMs: NOW, exampleOutcome: 'pass', elements: ready, passes: run(example) });
    });
  };

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(pass.start.t - 12 * 60_000);
    vi.mocked(count).mockClear();
  });

  it.each([
    ['compact', COMPACT_PX, 'example-band'],
    ['wide', WIDE_PX, 'reading-where'],
  ] as const)('on %s, the example counts nothing until the action opens the group: where_shown:example, and setting a place adds nothing', (_mode, width, host) => {
    media = stubMatchMedia(width);
    withExample();
    render(<Host />);
    expect(counted()).toEqual([]);
    fireEvent.click(within(screen.getByTestId(host)).getByRole('button', { name: en.example.setPlace }));
    expect(counted()).toEqual(['where_shown:example']);
    fireEvent.click(screen.getByRole('button', { name: en.location.useMyLocation }));
    act(() => {
      appStore.setState({ passes: run(appStore.getState().observer) });
    });
    expect(screen.getByTestId('location-summary')).toBeInTheDocument();
    expect(counted()).toEqual(['where_shown:example']);
  });

  it.each([
    ['compact', COMPACT_PX],
    ['wide', WIDE_PX],
  ] as const)('on %s, the question with no example is where_shown:fallback, and the page a place lights counts nothing', (_mode, width) => {
    media = stubMatchMedia(width);
    act(() => {
      appStore.setState({ exampleOutcome: 'no_city' });
    });
    render(<Host />);
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();
    expect(counted()).toEqual(['where_shown:fallback']);
    act(() => {
      appStore.getState().setObserver(observer);
    });
    act(() => {
      appStore.setState({ elements: ready, passes: run(appStore.getState().observer) });
    });
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(counted()).toEqual(['where_shown:fallback']);
  });

  it('the wait counts nothing: the question is not on screen while the example is pending', () => {
    media = stubMatchMedia(COMPACT_PX);
    act(() => {
      appStore.setState({ example, exampleStartedMs: NOW, exampleOutcome: 'pending', elements: ready });
    });
    render(<Host />);
    expect(counted()).toEqual([]);
    // The wait runs out (D-1188): the question shows, as the fallback.
    act(() => {
      appStore.setState({ exampleOutcome: 'slow' });
    });
    expect(counted()).toEqual(['where_shown:fallback']);
  });

  it('a later visit’s page, and its [ change ], count nothing', () => {
    media = stubMatchMedia(COMPACT_PX);
    act(() => {
      appStore.setState({ observer, elements: ready, passes: run(observer) });
    });
    render(<Host />);
    fireEvent.click(screen.getByTestId('location-summary-change'));
    expect(counted()).toEqual([]);
  });
});
