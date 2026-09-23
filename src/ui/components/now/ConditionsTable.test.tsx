/**
 * R81 (FR-FIRST-9, D-509): the conditions table's rows in order, the `Up now`
 * row present with a visible item and absent without, and the no-darkness
 * value. FR-FIRST-6: every fact the Now panel's (R7, R8, R30) and the dark
 * window's (R76) tests pinned is pinned here, on the row that now carries it —
 * the visible item's name and time left, the highest first and the count of
 * the rest; the re-render in place on a 10 s update; the current cloud cover
 * interpolated to the instant of the check, and "weather unknown" when there is
 * no forecast for this observer; the Moon's phase, illumination and direction,
 * and none before the first state; the dark window in both languages, and the
 * polar winter's end alone. The panel's sentences about why nothing is up
 * (daylight, nothing above 10°, all in shadow, no darkness, a failed check)
 * are the row's absence now (US-4 AC1 as amended v2.0.2); the live page keeps
 * the full statement.
 */
import { act, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { SkyBand } from '../../../lib/timeStripe';
import type { NowItem, NowState, Observer, WeatherSnapshot } from '../../../model';
import { appStore, type AppState } from '../../../state';
import { ConditionsTable, darkWindowText, upNowText, visibleNow } from './ConditionsTable';

const T = 1_789_120_104_063; // inside the R1 golden pass, 10 s after its start
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: 'UTC' };
const other: Observer = { ...observer, lat: 48.86, lon: 2.35, label: '48.86, 2.35' };
const initial = appStore.getInitialState();
const H = 3_600_000;

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
const hourBefore = Math.floor(T / H) * H;
const forecast: WeatherSnapshot = {
  provider: 'open-meteo',
  lat: -38.9,
  lon: -68,
  cellKey: '-38.9,-68.0',
  fetchedAt: T - H,
  timeZone: 'America/Argentina/Salta',
  hourly: [
    { t: hourBefore, totalPct: 40, lowPct: 40, midPct: 40, highPct: 40 },
    { t: hourBefore + H, totalPct: 60, lowPct: 60, midPct: 60, highPct: 60 },
  ],
};

/** Midnight UTC, so the clocks read as the numbers below. */
const MIDNIGHT = Date.UTC(2026, 8, 18, 0, 0, 0);
const at = (hours: number) => MIDNIGHT + hours * H;
const band = (fromH: number, toH: number, sky: SkyBand['sky']): SkyBand => ({ from: at(fromH), to: at(toH), sky });
/** A day sampled from noon yesterday: last night's dark window, the day, and tonight's. */
const DAY: readonly SkyBand[] = [band(-12, -10, 'bright-twilight'), band(-10, -3.75, 'dark'), band(-3.75, -2, 'bright-twilight'), band(-2, 8.25, 'day'), band(8.25, 10, 'bright-twilight'), band(10, 17.5, 'dark')];

const table = (props: Partial<Parameters<typeof ConditionsTable>[0]> = {}) => <ConditionsTable observer={observer} bands={DAY} sampledFrom={at(-12)} now={at(3)} {...props} />;
const rows = (): string[] => [...screen.getByTestId('conditions').querySelectorAll('dt')].map((dt) => dt.textContent);
const value = (label: string): HTMLElement => {
  const dt = [...screen.getByTestId('conditions').querySelectorAll('dt')].find((d) => d.textContent === label);
  if (!dt?.nextElementSibling) throw new Error(`no ${label} row`);
  return dt.nextElementSibling as HTMLElement;
};

describe('<ConditionsTable> (FR-FIRST-9)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
  });

  it('is a description list: Dark, Clouds now, Moon and Up now, in that order', async () => {
    set({ observer, now: { observer, state: state({ items: [item({ visibleUntil: T + 192_000, endReason: 'horizon' })] }), error: null } });
    const { container } = render(table());
    expect(screen.getByTestId('conditions').tagName).toBe('DL');
    expect(screen.getByTestId('conditions')).toHaveAttribute('aria-label', 'Tonight’s conditions');
    expect(rows()).toEqual(['Dark', 'Clouds now', 'Moon', 'Up now']);
    expect(value('Dark')).toHaveTextContent('10:00 → 17:30');
    expect(value('Up now')).toHaveTextContent('ISS (Zarya) · 3:12 left');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no Up now row with nothing visible — daylight, nothing up, all in shadow, a failed check', () => {
    set({ observer, now: { observer, state: state({ sky: 'day', sunAltDeg: 41.6, items: [item({ visible: false })] }), error: null } });
    const { rerender } = render(table());
    expect(rows()).toEqual(['Dark', 'Clouds now', 'Moon']);
    set({ now: { observer, state: state({ items: [item({ elDeg: -20, aboveMinElevation: false, visible: false })] }), error: null } });
    rerender(table());
    expect(screen.queryByTestId('up-now')).toBeNull();
    set({ now: { observer, state: state({ items: [item({ lit: false, visible: false })] }), error: null } });
    rerender(table());
    expect(screen.queryByTestId('up-now')).toBeNull();
    set({ now: { observer, state: null, error: 'NO_ELEMENTS: nothing loaded' } });
    rerender(table());
    expect(rows()).toEqual(['Dark', 'Clouds now']);
  });

  it('names the highest visible satellite first, its time left by its end, and counts the rest; the invisible are not counted', () => {
    const low = item({ noradId: 1, name: 'Low one', elDeg: 12, visibleUntil: T + 5_000, endReason: 'shadow' });
    const high = item({ noradId: 2, name: 'High one', elDeg: 70, visibleUntil: T + 90_000, endReason: 'horizon' });
    const hidden = item({ noradId: 3, name: 'Shadowed', lit: false, visible: false });
    set({ observer, now: { observer, state: state({ items: [low, hidden, high] }), error: null } });
    render(table());
    expect(value('Up now')).toHaveTextContent(/^High one · 1:30 left \+1$/);
    expect(screen.queryByText(/Shadowed/)).toBeNull();
  });

  it('upNowText: an unknown end has no time left, and Spanish words it', () => {
    expect(upNowText(visibleNow([item()]), T, en)).toBe('ISS (Zarya)');
    expect(upNowText(visibleNow([item({ visibleUntil: T + 192_000 }), item({ noradId: 2, elDeg: 10 })]), T, es)).toBe('ISS (Zarya) · quedan 3:12 +1');
    expect(upNowText([], T, en)).toBe('');
  });

  it('re-renders in place on every 10 s update, without remounting the table', () => {
    set({ observer, now: { observer, state: state({ items: [item({ visibleUntil: T + 192_000, endReason: 'horizon' })] }), error: null } });
    render(table());
    const dl = screen.getByTestId('conditions');
    set({ now: { observer, state: state({ t: T + 10_000, items: [item({ elDeg: 40, visibleUntil: T + 192_000, endReason: 'horizon' })] }), error: null } });
    expect(screen.getByTestId('conditions')).toBe(dl);
    expect(value('Up now')).toHaveTextContent('ISS (Zarya) · 3:02 left');
  });

  it('shows the current cloud cover as its word, from the forecast interpolated to the instant of the check (FR-WX-3)', () => {
    set({ observer, now: { observer, state: state(), error: null }, weather: { observer, status: 'ready', snapshot: forecast, error: null } });
    render(table());
    // T is 48 min 24 s past the hour: 40 + 20·(2904/3600) ≈ 56 %, partly cloudy.
    const word = within(value('Clouds now')).getByText('Partly cloudy');
    expect(word).toHaveAttribute('data-state', 'partly');
    expect(within(value('Clouds now')).getByRole('tooltip')).toHaveTextContent('56 % effective cloud right now.');
    expect(within(value('Clouds now')).getByRole('tooltip')).toHaveTextContent('Forecast by Open-Meteo');
  });

  it('says "weather unknown" when the forecast failed, is still loading, or belongs to another observer (US-7 AC4)', () => {
    set({ observer, now: { observer, state: state(), error: null }, weather: { observer, status: 'error', snapshot: null, error: { kind: 'server', detail: 'HTTP 503' } } });
    const { rerender } = render(table());
    expect(within(value('Clouds now')).getByText('Weather unknown')).toHaveAttribute('data-state', 'unknown');
    set({ weather: { observer, status: 'loading', snapshot: null, error: null } });
    rerender(table());
    expect(within(value('Clouds now')).getByText('Weather unknown')).toBeInTheDocument();
    set({ weather: { observer: other, status: 'ready', snapshot: forecast, error: null } });
    rerender(table());
    expect(within(value('Clouds now')).getByText('Weather unknown')).toBeInTheDocument();
  });

  it('names the Moon’s phase, illumination and, while it is up, its direction (FR-MOON-3)', () => {
    set({ observer, now: { observer, state: state(), error: null } });
    const { rerender } = render(table());
    expect(value('Moon')).toHaveTextContent(/^waning gibbous, 72 %, N$/);
    set({ now: { observer, state: state({ moon: MOON_DOWN }), error: null } });
    rerender(table());
    expect(value('Moon')).toHaveTextContent(/^waning gibbous, 72 %$/);
    // No tradition text in the row (FR-MOON-5): that is its own line under the table.
    expect(screen.getByTestId('conditions')).not.toHaveTextContent('lore');
  });

  it('has no Moon row before the first state for this observer arrives, and ignores another observer’s', () => {
    set({ observer, now: { observer: other, state: state(), error: null } });
    render(table());
    expect(screen.queryByTestId('moon-row')).toBeNull();
    expect(screen.queryByTestId('up-now')).toBeNull();
  });

  it('says nothing about darkness until the bands have arrived', () => {
    render(table({ bands: [] }));
    expect(screen.queryByTestId('dark-window')).toBeNull();
  });

  it('is Spanish under a Spanish provider', () => {
    set({ observer, now: { observer, state: state(), error: null } });
    render(<I18nProvider locale="es">{table()}</I18nProvider>);
    expect(rows()).toEqual(['Oscuro', 'Nubes ahora', 'Luna']);
    expect(value('Luna')).toHaveTextContent('gibosa menguante, 72 %, N');
  });
});

describe('darkWindowText (FR-FIRST-9, D-470)', () => {
  const sampledFrom = at(-12);

  it('names both ends, in the observer’s zone', () => {
    expect(darkWindowText(band(10, 17.5, 'dark'), sampledFrom, 'UTC', 'en', en)).toBe('10:00 → 17:30');
    expect(darkWindowText(band(10, 17.5, 'dark'), sampledFrom, 'America/Argentina/Salta', 'es', es)).toBe('07:00 → 14:30');
  });

  it('with no zone known yet, says the digits are UTC', () => {
    expect(darkWindowText(band(10, 17.5, 'dark'), sampledFrom, null, 'en', en)).toBe('10:00 → 17:30 UTC');
  });

  it('says there is none when there is none', () => {
    expect(darkWindowText(null, sampledFrom, 'UTC', 'en', en)).toBe('No full darkness tonight.');
    expect(darkWindowText(null, sampledFrom, 'UTC', 'es', es)).toBe(es.home.noDarkWindow);
  });

  it('names only the end when the darkness began before anything sampled (a polar winter)', () => {
    const openAllDay = band(-12, 6, 'dark');
    expect(darkWindowText(openAllDay, sampledFrom, 'UTC', 'en', en)).toBe('until 06:00');
    expect(darkWindowText(openAllDay, sampledFrom, 'UTC', 'es', es)).toBe('hasta las 06:00');
  });
});
