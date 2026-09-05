import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords } from '../../../../tests/support/catalogFixtures';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import type { Observer, Pass, WeatherSnapshot } from '../../../model';
import { appStore, type AppState, type ElementsState } from '../../../state';
import { I18nProvider } from '../../../i18n/useT';
import { ReadinessLine } from './ReadinessLine';

/**
 * TASKS R27 (FR-OFF-4, US-16 AC2): the line states a date and a time when the
 * device is ready, names what is missing when it is not, and says nothing at
 * all until one of the two is actually true.
 */
const T0 = Date.UTC(2026, 8, 11, 21, 0, 0);
const HOUR = 3_600_000;
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 270, label: 'Cipolletti', source: 'coords', timeZone: 'America/Argentina/Salta' };

function pass(id: string, startOffsetH: number): Pass {
  const start = T0 + startOffsetH * HOUR;
  const end = start + 5 * 60_000;
  return {
    id,
    noradId: 25544,
    name: 'ISS (Zarya)',
    start: { t: start, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: (start + end) / 2, azDeg: 250, elDeg: 60, rangeKm: 800 },
    end: { t: end, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 300,
    peakMagnitude: -1.8,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: T0,
    ...NO_MOON_AT_PEAK,
  };
}

const snapshot: WeatherSnapshot = {
  provider: 'open-meteo',
  lat: observer.lat,
  lon: observer.lon,
  cellKey: '-38.9,-68.0',
  fetchedAt: T0,
  timeZone: 'America/Argentina/Salta',
  hourly: Array.from({ length: 96 }, (_, i) => ({ t: T0 + i * HOUR, totalPct: 20 })),
};

/** The line asks whether an element set is in use, not what is in it; the real fixture set is the honest "yes". */
const withRecords: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: T0, stale: false, persistent: true };

const initial = appStore.getInitialState();
const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};

/** A finished run for `observer`, stored or this session's. */
const done = (passes: Pass[], storedAt: number | null): Partial<AppState> => ({
  observer,
  passes: { ...initial.passes, status: 'done', observer, window: { startMs: T0, endMs: T0 + 72 * HOUR }, passes, hasDarkness: true, storedAt },
});

const ready = (passes: Pass[], storedAt: number | null): Partial<AppState> => ({
  ...done(passes, storedAt),
  elements: withRecords,
  weather: { observer, status: 'ready', snapshot, error: null },
});

const show = () =>
  render(
    <I18nProvider locale="en">
      <ReadinessLine />
    </I18nProvider>,
  );

afterEach(() => {
  appStore.setState(initial, true);
});

describe('ReadinessLine (R27: FR-OFF-4)', () => {
  it('says nothing before there is an observer, and nothing while the first run is still computing', () => {
    show();
    expect(screen.queryByTestId('readiness')).toBeNull();
    set({ observer, elements: { status: 'loading' }, passes: { ...initial.passes, status: 'computing', observer } });
    expect(screen.queryByTestId('readiness')).toBeNull();
  });

  it('ready: states the earlier of the last pass end and the forecast end, as a date and a time in the observer’s zone', async () => {
    // Passes to 68 h, forecast to 95 h: the passes run out first. 68 h after 21:00 UTC on the 11th is
    // 17:05 UTC on the 14th, which is 14:05 in GMT-3.
    set(ready([pass('a', 4), pass('b', 68)], null));
    const { container } = show();
    expect(screen.getByTestId('readiness')).toHaveTextContent('Ready offline until 2026-09-14 14:05');
    expect(screen.queryByTestId('readiness-stored')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a stored run adds the storage time on its own row', () => {
    set(ready([pass('a', 4)], T0 - 20 * HOUR));
    show();
    expect(screen.getByTestId('readiness')).toHaveTextContent('Ready offline until');
    // T0 is 21:00 UTC, 18:00 in GMT-3; twenty hours before that is 22:00 the previous evening.
    expect(screen.getByTestId('readiness-stored')).toHaveTextContent('Stored 2026-09-10 22:00');
  });

  it('no forecast: the gap is named instead of a date', () => {
    set({ ...ready([pass('a', 4)], T0), weather: { observer, status: 'error', snapshot: null, error: 'offline' } });
    show();
    expect(screen.getByTestId('readiness')).toHaveTextContent('Not ready offline: no cloud forecast stored yet.');
  });

  it('no passes: the gap is named', () => {
    set(ready([], null));
    show();
    expect(screen.getByTestId('readiness')).toHaveTextContent('Not ready offline: no passes stored yet.');
  });

  it('a cold start with no signal names all three, and shows even though no job ever finished', () => {
    set({ observer, elements: { status: 'error', message: 'network error' } });
    show();
    expect(screen.getByTestId('readiness')).toHaveTextContent('Not ready offline: no orbital elements, cloud forecast and passes stored yet.');
  });

  it('the Spanish line says the same and is not English', () => {
    set(ready([pass('a', 4), pass('b', 68)], T0 - HOUR));
    render(
      <I18nProvider locale="es">
        <ReadinessLine />
      </I18nProvider>,
    );
    expect(screen.getByTestId('readiness')).toHaveTextContent('Sin conexión hasta 2026-09-14 14:05');
    expect(screen.getByTestId('readiness-stored')).toHaveTextContent('Guardado 2026-09-11 17:00');
  });
});
