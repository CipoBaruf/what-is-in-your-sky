/**
 * R81 (FR-SAT-4 as amended v2.0.2, FR-FIRST-11, D-511): the elements as one
 * line — the age, in `--warn` past five days or while a stale copy is in use —
 * and `[ details ]`, a disclosure that holds every banner's text in place
 * (`ElementsBanners.test.tsx` pins each banner; here, that each one is behind
 * the line) and the stored run's storage time.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords } from '../../../../tests/support/catalogFixtures';
import { I18nProvider } from '../../../i18n/useT';
import { EPOCH_WARN_MS, newestEpoch } from '../../../lib/elementsAge';
import type { Observer } from '../../../model';
import { appStore, type AppState, type ElementsState } from '../../../state';
import { ElementsLine } from './ElementsLine';

const records = fixtureRecords();
const NEWEST = newestEpoch(records);
if (NEWEST === null) throw new Error('fixture has no records');
const FETCHED_AT = NEWEST + 3_600_000;
const initial = appStore.getInitialState();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready = (extra: Partial<Extract<ElementsState, { status: 'ready' }>> = {}): ElementsState => ({
  status: 'ready',
  records,
  unavailable: [],
  rejected: [],
  fetchedAt: FETCHED_AT,
  stale: false,
  persistent: true,
  ...extra,
});
const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};

afterEach(() => {
  appStore.setState(initial, true);
});

describe('<ElementsLine> (FR-SAT-4 as amended)', () => {
  it('renders nothing while the elements are not loaded', () => {
    set({ elements: { status: 'loading' } });
    render(<ElementsLine now={FETCHED_AT} />);
    expect(screen.queryByTestId('elements-line')).toBeNull();
  });

  it('is the age on one line, and [ details ] opens the full status in place', async () => {
    set({ elements: ready() });
    const { container } = render(
      <main>
        <ElementsLine now={NEWEST + 9 * 86_400_000 + 4 * 3_600_000} />
      </main>,
    );
    expect(screen.getByTestId('elements-line')).toHaveTextContent('Elements 9 d 4 h old · details');
    const details = screen.getByRole('button', { name: 'details' });
    const panel = document.getElementById(details.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
    fireEvent.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(within(panel).getByTestId('elements-age')).toHaveTextContent('Orbital elements: newest epoch 9 d 4 h old');
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(details);
    expect(panel).not.toBeVisible();
  });

  it('warns past five days, and not before (FR-SAT-4)', () => {
    set({ elements: ready() });
    const { rerender } = render(<ElementsLine now={NEWEST + EPOCH_WARN_MS - 1000} />);
    expect(screen.getByTestId('elements-line')).toHaveAttribute('data-warn', 'false');
    rerender(<ElementsLine now={NEWEST + EPOCH_WARN_MS + 1000} />);
    expect(screen.getByTestId('elements-line')).toHaveAttribute('data-warn', 'true');
  });

  it('the disclosure holds every banner’s text: the old epoch, the stale copy, the memory-only copy, the missing objects', () => {
    set({ elements: ready({ stale: true, persistent: false, unavailable: [25544] }) });
    render(<ElementsLine now={NEWEST + EPOCH_WARN_MS + 1000} />);
    // A stale copy is a warning on the line too (FR-SAT-6).
    expect(screen.getByTestId('elements-line')).toHaveAttribute('data-warn', 'true');
    const panel = document.getElementById(screen.getByTestId('elements-details').getAttribute('aria-controls') ?? '') as HTMLElement;
    for (const id of ['elements-age', 'stale-banner', 'epoch-banner', 'not-cached-banner', 'unavailable-banner']) expect(within(panel).getByTestId(id)).toBeInTheDocument();
    expect(within(panel).getByTestId('stale-banner')).toHaveTextContent('CelesTrak could not be reached');
    expect(within(panel).getByTestId('unavailable-banner')).toHaveTextContent('ISS (Zarya)');
  });

  it('carries the stored run’s storage time behind the line (FR-OFF-4 as amended)', () => {
    set({
      observer,
      elements: ready(),
      weather: { observer, status: 'error', snapshot: null, error: 'HTTP 503' },
      passes: { ...initial.passes, status: 'done', observer, passes: [], hasDarkness: true, storedAt: Date.UTC(2026, 8, 10, 22, 0) },
    });
    render(<ElementsLine now={FETCHED_AT} />);
    const panel = document.getElementById(screen.getByTestId('elements-details').getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(within(panel).getByTestId('readiness-stored')).toHaveTextContent('Stored 2026-09-10 22:00 UTC');
  });

  it('says there are none when no record has an epoch, and is Spanish under a Spanish provider', () => {
    set({ elements: ready({ records: [] }) });
    const { rerender } = render(<ElementsLine now={FETCHED_AT} />);
    expect(screen.getByTestId('elements-line')).toHaveTextContent('No orbital elements · details');
    set({ elements: ready() });
    rerender(
      <I18nProvider locale="es">
        <ElementsLine now={NEWEST + 2 * 86_400_000} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('elements-line')).toHaveTextContent('Elementos de hace 2 d · detalles');
  });
});
