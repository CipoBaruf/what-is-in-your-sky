/**
 * R97 (FR-FAINT-2, FR-FAINT-3, FR-FAINT-4, US-34 AC2..AC3): the count line
 * in both states and both languages, the control that switches them and the
 * preference it stores, the dimmed and tagged card, and the night left with
 * only faint passes. The clock is the store's (D-535), set by every test.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords } from '../../../../tests/support/catalogFixtures';
import { MOON_FIXTURE, NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { PREFS_KEY } from '../../../data/localPrefs';
import type { Observer, Pass } from '../../../model';
import { appStore, type AppState, type ElementsState } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { PassList } from './PassList';

const HOUR = 3_600_000;
// 00:51 on 2026-09-11 in Salta (UTC−3): tonight is the night that began on the 10th, and it ends at noon.
const NOW = Date.UTC(2026, 8, 11, 3, 51);
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquén', source: 'coords', timeZone: 'America/Argentina/Salta' };
const initial = appStore.getInitialState();

function pass(id: string, noradId: number, name: string, hours: number, peakMagnitude: number): Pass {
  const t = NOW + hours * HOUR;
  return {
    id,
    noradId,
    name,
    start: { t, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: t + 150_000, azDeg: 250, elDeg: 60, rangeKm: 800 },
    end: { t: t + 300_000, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 300,
    peakMagnitude,
    sunAltAtPeakDeg: -20,
    twilight: false,
    track: [],
    elementsEpochMs: NOW,
    ...NO_MOON_AT_PEAK,
  };
}

// Tonight: two bright passes and two faint ones, one of them faint only because of the Moon. Tomorrow night: two faint.
const brightFirst = pass('bright-first', 2, 'Bright first', 1, 1.0);
const faintTonight = pass('faint-tonight', 3, 'Faint tonight', 2, 4.0);
const glareTonight: Pass = { ...pass('glare-tonight', 4, 'Glare tonight', 3, 3.0), moonAtPeak: MOON_FIXTURE, moonGlare: { glare: true, separationDeg: 12 } };
const brightLast = pass('bright-last', 5, 'Bright last', 4, 2.0);
const faintTomorrow = pass('faint-tomorrow', 6, 'Faint tomorrow', 20, 4.2);
const faintTomorrowToo = pass('faint-tomorrow-too', 7, 'Faint tomorrow too', 21, 3.9);
const run = [brightFirst, faintTonight, glareTonight, brightLast, faintTomorrow, faintTomorrowToo];
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };

const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};
const withRun = (passes: readonly Pass[] = run): void => {
  set({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [...passes], hasDarkness: true } });
};
const renderIn = (locale: Locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <PassList />
    </I18nProvider>,
  );
const cardNames = (): string[] => screen.getAllByRole('article').filter((card) => card.closest('[hidden]') === null).map((card) => within(card).getByRole('heading').textContent ?? '');
const toggles = (): string[] => screen.getAllByTestId('night-toggle').map((toggle) => toggle.textContent ?? '');

describe('<PassList> faint passes (FR-FAINT-2)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  it('leaves faint passes out by default and says both numbers on the count line', () => {
    withRun();
    renderIn();
    const line = screen.getByTestId('count-line');
    expect(screen.getByRole('status')).toHaveTextContent(/^2 visible passes in 72 h$/);
    expect(line).toHaveTextContent(/^2 visible passes in 72 h · show 4 faint · Sort:SoonestBest$/);
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^show 4 faint$/);
    expect(cardNames()).toEqual(['Bright first', 'Bright last']);
    // A night with only faint passes keeps its toggle, and says what it holds.
    expect(toggles()).toEqual(['Tonight 2 passes', 'Tomorrow night 0 passes · 2 faint']);
  });

  it('shows them in place, dimmed and tagged, and hides them again; the choice is stored (US-34 AC2, AC3)', () => {
    withRun();
    renderIn();
    fireEvent.click(screen.getByTestId('faint-toggle'));
    expect(screen.getByRole('status')).toHaveTextContent(/^6 visible passes in 72 h$/);
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^hide 4 faint$/);
    expect(cardNames()).toEqual(['Bright first', 'Faint tonight', 'Glare tonight', 'Bright last']);
    expect(toggles()).toEqual(['Tonight 4 passes', 'Tomorrow night 2 passes']);
    const faintCard = screen.getAllByRole('article').find((card) => card.dataset.passId === 'faint-tonight');
    expect(within(faintCard as HTMLElement).getByTestId('card-faint')).toHaveTextContent(/^faint$/);
    const brightCard = screen.getAllByRole('article').find((card) => card.dataset.passId === 'bright-first');
    expect(within(brightCard as HTMLElement).queryByTestId('card-faint')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}')).toMatchObject({ showFaint: true });

    fireEvent.click(screen.getByTestId('faint-toggle'));
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^show 4 faint$/);
    expect(cardNames()).toEqual(['Bright first', 'Bright last']);
    expect(appStore.getState().showFaint).toBe(false);
  });

  it('words the line and the control in Spanish in both states', () => {
    withRun();
    renderIn('es');
    expect(screen.getByRole('status')).toHaveTextContent(/^2 pases visibles en 72 h$/);
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^ver 4 tenues$/);
    expect(toggles()).toEqual(['Esta noche 2 pases', 'Mañana a la noche 0 pases · 2 tenues']);
    fireEvent.click(screen.getByTestId('faint-toggle'));
    expect(screen.getByRole('status')).toHaveTextContent(/^6 pases visibles en 72 h$/);
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^ocultar 4 tenues$/);
    const faintCard = screen.getAllByRole('article').find((card) => card.dataset.passId === 'faint-tonight');
    expect(within(faintCard as HTMLElement).getByTestId('card-faint')).toHaveTextContent(/^tenue$/);
  });

  it('draws no control when nothing is faint', () => {
    withRun([brightFirst, brightLast]);
    renderIn();
    expect(screen.queryByTestId('faint-toggle')).toBeNull();
    expect(screen.getByTestId('count-line')).toHaveTextContent(/^2 visible passes in 72 h · Sort:SoonestBest$/);
  });

  it('never leaves out the ISS, or the pass the next-event block names', () => {
    const faintIss = pass('iss', 25544, 'ISS (Zarya)', 2, 4.5);
    const faintNext = pass('faint-next', 8, 'Faint next', 0.5, 4.5);
    withRun([faintNext, faintIss, brightLast, faintTomorrow]);
    renderIn();
    expect(cardNames()).toEqual(['Faint next', 'ISS (Zarya)', 'Bright last']);
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^show 1 faint$/);
  });

  it('keeps the open pass, faint or not', () => {
    withRun();
    render(<PassList selectedPassId="faint-tonight" />);
    expect(cardNames()).toEqual(['Bright first', 'Faint tonight', 'Bright last']);
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^show 3 faint$/);
  });

  it('reads a stored preference: with showFaint set, the list opens with them shown', () => {
    set({ showFaint: true });
    withRun();
    renderIn();
    expect(screen.getByTestId('faint-toggle')).toHaveTextContent(/^hide 4 faint$/);
    expect(cardNames()).toHaveLength(4);
  });
});
