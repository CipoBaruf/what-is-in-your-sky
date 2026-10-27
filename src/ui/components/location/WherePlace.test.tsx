/**
 * R81 (FR-FIRST-11, D-511): the Where reading's place and sentence — the place
 * with its coordinates, or the coordinates alone; the sentence by the
 * observer's source; `[ change ]` with `aria-expanded` over the input group.
 * FR-FIRST-6: every fact `LocationSummary`'s tests (R52, R76) pinned is pinned
 * here — the place's own name for a geocoded place, the device's accuracy (US-3
 * AC3) now in the sentence, `[ change ]` opening the group in place and never
 * `#settings` (FR-SET-3), and nothing with no observer.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords } from '../../../../tests/support/catalogFixtures';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import type { Observer, Pass, WeatherSnapshot } from '../../../model';
import { appStore, type AppState, type ElementsState } from '../../../state';
import { WherePlace } from './WherePlace';

/** The place as the Where reading hosts it: the open state is the host's, and the group it controls is the host's too. */
function Host() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <WherePlace
        open={open}
        controls="group"
        onToggle={() => {
          setOpen((o) => !o);
        }}
      />
      <div id="group" hidden={!open} data-testid="group" />
    </main>
  );
}

const coords: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const cipolletti: Observer = { lat: -38.9339, lon: -67.9903, altM: 0, label: 'Cipolletti, Río Negro, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const initial = appStore.getInitialState();

const set = (observer: Observer | null): void => {
  act(() => {
    appStore.setState({ observer });
  });
};

afterEach(() => {
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('<WherePlace> (FR-FIRST-11)', () => {
  it('a place picked by name: its own name and its coordinates, then the centre it uses', () => {
    set(cipolletti);
    render(<Host />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(/^Cipolletti \(−38\.93, −67\.99\)$/);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent('Using the centre of Cipolletti. Saved in this browser only. change');
  });

  it('typed coordinates: the coordinates alone, and says so', () => {
    set(coords);
    render(<Host />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(/^−38\.93, −67\.99$/);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Using these coordinates\. Saved in this browser only\./);
  });

  it('the device: the coordinates, and the accuracy in the sentence (US-3 AC3)', () => {
    set({ ...coords, source: 'device', accuracyM: 2987.4 });
    const { rerender } = render(<Host />);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Using your device's location \(±2987 m\)\./);
    set({ ...coords, source: 'device' });
    rerender(<Host />);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Using your device's location\. Saved/);
  });

  it('in Spanish, each sentence', () => {
    set(cipolletti);
    render(
      <I18nProvider locale="es">
        <Host />
      </I18nProvider>,
    );
    expect(screen.getByTestId('where-sentence')).toHaveTextContent('Con el centro de Cipolletti. Guardada solo en este navegador. cambiar');
    set(coords);
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Con estas coordenadas\./);
    set({ ...coords, source: 'device', accuracyM: 40 });
    expect(screen.getByTestId('where-sentence')).toHaveTextContent(/^Con la ubicación del dispositivo \(±40 m\)\./);
  });

  it('[ change ] opens the input group in place and closes it again, never #settings (FR-FIRST-2, FR-SET-3)', async () => {
    set(coords);
    const { container } = render(<Host />);
    const change = screen.getByRole('button', { name: 'change' });
    expect(change).toBe(screen.getByTestId('location-summary-change'));
    expect(change).not.toHaveAttribute('href');
    expect(container.querySelector('a[href="#settings"]')).toBeNull();
    expect(change).toHaveAttribute('aria-expanded', 'false');
    const group = screen.getByTestId('group');
    expect(change).toHaveAttribute('aria-controls', group.id);
    expect(group).not.toBeVisible();
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'true');
    expect(group).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'false');
    expect(group).not.toBeVisible();
  });

  it('renders nothing with no observer: the cold open is the Where reading then (FR-FIRST-1)', () => {
    set(null);
    render(<Host />);
    expect(screen.queryByTestId('location-summary')).toBeNull();
    expect(screen.queryByRole('button', { name: 'change' })).toBeNull();
  });
});

/**
 * R130 (FR-FLOW-2, D-844): the folded Where on compact — the place with `[ change ]`, one status line ending in
 * `[ details ]` that opens the sentence and the rest in FR-FIRST-11's order, and each fault taking the line whole.
 */
describe('WherePlace folded (R130: FR-FLOW-2)', () => {
  const T0 = Date.UTC(2026, 8, 11, 21, 0, 0);
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const observer = cipolletti;
  const fresh: ElementsState = { status: 'ready', records: fixtureRecords().map((r) => ({ ...r, epochMs: T0 - 4 * DAY })), unavailable: [], rejected: [], fetchedAt: T0, stale: false, persistent: true };
  const snapshot: WeatherSnapshot = {
    provider: 'open-meteo',
    lat: observer.lat,
    lon: observer.lon,
    cellKey: '-38.9,-68.0',
    fetchedAt: T0,
    timeZone: 'America/Argentina/Salta',
    hourly: Array.from({ length: 96 }, (_, i) => ({ t: T0 + i * HOUR, totalPct: 20 })),
  };
  const pass = (startH: number): Pass => ({
    id: `p${String(startH)}`,
    noradId: 25544,
    name: 'ISS (Zarya)',
    start: { t: T0 + startH * HOUR, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: T0 + startH * HOUR + 120_000, azDeg: 250, elDeg: 60, rangeKm: 800 },
    end: { t: T0 + startH * HOUR + 240_000, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 240,
    peakMagnitude: -1.8,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: T0,
    ...NO_MOON_AT_PEAK,
  });
  const ready = (patch: Partial<AppState> = {}): void => {
    act(() => {
      appStore.setState({
        observer,
        elements: fresh,
        weather: { observer, status: 'ready', snapshot, error: null },
        passes: { ...initial.passes, status: 'done', observer, window: { startMs: T0, endMs: T0 + 72 * HOUR }, passes: [pass(4), pass(68)], hasDarkness: true, storedAt: null },
        ...patch,
      });
    });
  };

  function Folded({ locale = 'en' as const }: { locale?: 'en' | 'es' }) {
    const [open, setOpen] = useState(false);
    return (
      <I18nProvider locale={locale}>
        <main>
          <WherePlace
            folded
            open={open}
            controls="group"
            onToggle={() => {
              setOpen((o) => !o);
            }}
            details={<p data-testid="rest">the readiness line, the elements line, the saved places</p>}
          />
          <div id="group" hidden={!open} data-testid="group" />
        </main>
      </I18nProvider>
    );
  }

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(T0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('folded: the place with [ change ] on its row, and "Ready offline · elements 4 d old · [ details ]"; the rest hidden', async () => {
    ready();
    const { container } = render(<Folded />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent('Cipolletti (−38.93, −67.99)');
    expect(screen.getByTestId('location-summary').parentElement).toContainElement(screen.getByTestId('location-summary-change'));
    const status = screen.getByTestId('where-status');
    expect(status).toHaveTextContent(/^Ready offline · elements 4 d old/);
    expect(status).not.toHaveAttribute('data-fault');
    const details = screen.getByTestId('where-details');
    expect(status).toContainElement(details);
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('where-details-panel')).not.toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opened: [ details ] shows the sentence first and then the rest, in place; [ change ] still opens the group', () => {
    ready();
    render(<Folded />);
    fireEvent.click(screen.getByTestId('where-details'));
    expect(screen.getByTestId('where-details')).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByTestId('where-details-panel');
    expect(panel).toBeVisible();
    expect(screen.getByTestId('where-details')).toHaveAttribute('aria-controls', panel.id);
    const [first, second] = Array.from(panel.children);
    expect(first).toHaveTextContent('Using the centre of Cipolletti. Saved in this browser only.');
    expect(second).toBe(screen.getByTestId('rest'));
    fireEvent.click(screen.getByTestId('location-summary-change'));
    expect(screen.getByTestId('group')).toBeVisible();
  });

  it('Spanish: the status line in Spanish', () => {
    ready();
    render(<Folded locale="es" />);
    expect(screen.getByTestId('where-status')).toHaveTextContent(/^Listo sin red · elementos de 4 d/);
    expect(screen.getByTestId('where-details')).toHaveTextContent('detalles');
  });

  it('a not-ready state takes the line whole', () => {
    ready({ weather: { observer, status: 'error', snapshot: null, error: { kind: 'offline', detail: 'offline' } } });
    render(<Folded />);
    const status = screen.getByTestId('where-status');
    expect(status).toHaveAttribute('data-fault', 'not-ready');
    expect(status).toHaveTextContent(/^Not ready offline: no cloud forecast stored yet\./);
    expect(status).toContainElement(screen.getByTestId('where-details'));
  });

  it('an elements warning takes the line whole, in the warning ink', () => {
    ready({ elements: { ...fresh, stale: true } });
    render(<Folded />);
    const status = screen.getByTestId('where-status');
    expect(status).toHaveAttribute('data-fault', 'elements-warning');
    expect(status).toHaveTextContent(/^Elements 4 d old/);
  });

  it('a failure takes the line whole, with its [ retry ]', () => {
    const retryElements = vi.fn();
    act(() => {
      appStore.setState({
        observer,
        retryElements,
        elements: { status: 'error', failure: { kind: 'offline', detail: 'offline' } },
        weather: { observer, status: 'ready', snapshot, error: null },
        passes: { ...initial.passes, status: 'idle', observer },
      });
    });
    render(<Folded />);
    const status = screen.getByTestId('where-status');
    expect(status).toHaveTextContent(/^Could not load the orbital elements: this device is offline\./);
    // D-858: the readiness line is not ready too (no elements, no job), and the failure, with its retry, goes first.
    expect(status).toHaveAttribute('data-fault', 'failure');
    fireEvent.click(screen.getByTestId('where-retry'));
    expect(retryElements).toHaveBeenCalledOnce();
  });
});
