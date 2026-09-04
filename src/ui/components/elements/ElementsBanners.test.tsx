import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords } from '../../../../tests/support/catalogFixtures';
import { EPOCH_WARN_MS, newestEpoch } from '../../../lib/elementsAge';
import type { Observer } from '../../../model';
import { appStore, type AppState, type ElementsState } from '../../../state';
import { ElementsBanners } from './ElementsBanners';

const records = fixtureRecords();
const NEWEST = newestEpoch(records);
if (NEWEST === null) throw new Error('fixture has no records');
const FETCHED_AT = NEWEST + 3_600_000;
const initial = appStore.getInitialState();
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

describe('ElementsBanners (R11: FR-SAT-4, FR-SAT-6, FR-X-4)', () => {
  it('renders nothing while the elements are not loaded', () => {
    set({ elements: { status: 'loading' } });
    render(<ElementsBanners now={FETCHED_AT} />);
    expect(screen.queryByTestId('elements-banners')).toBeNull();
    set({ elements: { status: 'error', message: 'HTTP 503' } });
    expect(screen.queryByTestId('elements-banners')).toBeNull();
  });

  it('always states the newest epoch age and when the set was confirmed with CelesTrak (FR-SAT-4), in UTC without a zone', async () => {
    set({ elements: ready() });
    const { container } = render(<ElementsBanners now={NEWEST + 3 * 3_600_000 + 12 * 60_000} />);
    const utc = (t: number): string => `${new Date(t).toISOString().slice(0, 10)} ${new Date(t).toISOString().slice(11, 19)} UTC`;
    expect(screen.getByTestId('elements-age')).toHaveTextContent(`Orbital elements: newest epoch 3 h 12 min old (${utc(NEWEST)}), confirmed with CelesTrak ${utc(FETCHED_AT)}.`);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses the observer’s zone for the times once it is known', () => {
    const observer: Observer = { lat: -38.9, lon: -68, altM: 0, label: 'x', source: 'coords', timeZone: 'America/Argentina/Salta' };
    set({ observer, elements: ready() });
    render(<ElementsBanners now={FETCHED_AT} />);
    expect(screen.getByTestId('elements-age')).toHaveTextContent('GMT-3');
    expect(screen.getByTestId('elements-age')).not.toHaveTextContent('UTC');
  });

  it('warns when the newest epoch is 5 days + 1 s old and not at 5 days − 1 s', async () => {
    set({ elements: ready() });
    const { rerender, container } = render(<ElementsBanners now={NEWEST + EPOCH_WARN_MS - 1000} />);
    expect(screen.queryByTestId('epoch-banner')).toBeNull();
    rerender(<ElementsBanners now={NEWEST + EPOCH_WARN_MS + 1000} />);
    const banner = screen.getByTestId('epoch-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent('[Warning] The orbital elements are 5 d old. Predictions lose accuracy after 5 days, and the ISS in particular changes orbit often');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('warns when the loader reports stale, quoting the fetch time (FR-SAT-6)', async () => {
    set({ elements: ready({ stale: true }) });
    const { container } = render(<ElementsBanners now={FETCHED_AT + 3 * 3_600_000} />);
    const banner = screen.getByTestId('stale-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent(`[Warning] CelesTrak could not be reached, so the elements fetched ${new Date(FETCHED_AT).toISOString().slice(0, 10)}`);
    expect(banner).toHaveTextContent('passes may be off by a few minutes');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('notes a memory-only copy and the catalog objects without elements, by name', async () => {
    set({ elements: ready({ persistent: false, unavailable: [25544, 999999] }) });
    const { container } = render(<ElementsBanners now={FETCHED_AT} />);
    expect(screen.getByTestId('not-cached-banner')).toHaveTextContent('[Note] The elements could not be saved in this browser');
    expect(screen.getByTestId('not-cached-banner')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('unavailable-banner')).toHaveTextContent('[Note] No current elements from CelesTrak for 2 catalog objects: ISS (Zarya) and NORAD 999999. Left out of the list.');
    expect(screen.queryByTestId('stale-banner')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
