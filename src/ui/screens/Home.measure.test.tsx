/**
 * FR-MEAS-2 (D-1147): the first run's steps on compact, and the cold open and the lit panes on wide, are counted as
 * `where_shown`, `when_shown` and `what_shown` when they are on screen and not before.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { en } from '../../i18n/en';
import type { Observer } from '../../model';
import { appStore, useActiveObserver, type ElementsState } from '../../state';
import { count } from '../../state/measure';
import { IDLE_PASSES } from '../../state/slices/passes';
import { Home, useSteps } from './Home';

vi.mock('../../state/measure', () => ({ count: vi.fn() }));

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: true, persistent: true };
const initial = appStore.getInitialState();
let media: MatchMediaStub;

afterEach(() => {
  vi.restoreAllMocks();
  media.restore();
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('the readings count when they are on screen (FR-MEAS-2 as amended: where_shown only; when_shown and what_shown are gone)', () => {
  const finds = {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback) => {
        ok({ coords: { latitude: -38.93, longitude: -67.99, altitude: null, accuracy: 30 }, timestamp: 0 } as unknown as GeolocationPosition);
      },
    } as unknown as Geolocation,
    secure: true,
  };
  function Host() {
    const steps = useSteps(useActiveObserver());
    return <Home offersInert={false} guide="closed" shareNotice={null} selectedPassId={null} onOpenPass={vi.fn()} passDetail={null} MoonLore={undefined} geolocation={finds} steps={steps} />;
  }
  const counted = () => vi.mocked(count).mock.calls.map((call) => call.join(':'));
  const withTheRun = () => {
    act(() => {
      appStore.setState({ elements: { ...ready, stale: false }, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: appStore.getState().observer, passes: [pass], hasDarkness: true } });
    });
  };

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(pass.start.t - 12 * 60_000);
    vi.mocked(count).mockClear();
  });

  it('on compact, only the where step is counted; the when and what steps count nothing', () => {
    media = stubMatchMedia(COMPACT_PX);
    render(<Host />);
    expect(counted()).toEqual(['where_shown']);
    fireEvent.click(within(screen.getByTestId('cold-open')).getByRole('button', { name: en.location.useMyLocation }));
    withTheRun();
    expect(screen.getByTestId('step-when')).toBeInTheDocument();
    expect(counted()).toEqual(['where_shown']);
    fireEvent.click(within(screen.getByTestId('step-when')).getByRole('button', { name: en.home.whenStep.next }));
    expect(screen.getByTestId('step-what')).toBeInTheDocument();
    expect(counted()).toEqual(['where_shown']);
  });

  it('on compact, a later visit’s stacked page is no step and counts none of the three', () => {
    media = stubMatchMedia(COMPACT_PX);
    act(() => {
      appStore.setState({ observer });
    });
    withTheRun();
    render(<Host />);
    expect(screen.queryByTestId('step-line')).toBeNull();
    expect(counted()).toEqual([]);
  });

  it('on wide, the cold open is where_shown, and lighting the panes counts nothing', () => {
    media = stubMatchMedia(WIDE_PX);
    render(<Host />);
    expect(screen.getByTestId('ghost-when')).toBeInTheDocument();
    expect(counted()).toEqual(['where_shown']);
    act(() => {
      appStore.getState().setObserver(observer);
    });
    withTheRun();
    expect(screen.queryByTestId('ghost-when')).toBeNull();
    expect(counted()).toEqual(['where_shown']);
  });
});
