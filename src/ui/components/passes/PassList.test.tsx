import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../../../tests/support/catalogFixtures';
import { compassPoint } from '../../../lib/compass';
import type { Observer } from '../../../model';
import { PassList } from './PassList';

const ref = loadReferenceValues();
const GOLDEN_WINDOW_START = goldenWindowStart(ref);
const observer: Observer = { ...ref.observer, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);

describe('<PassList>', () => {
  it('asks for coordinates when there is no observer', () => {
    render(<PassList observer={null} elements={{ status: 'loading' }} nowMs={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Enter coordinates');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows loading and error states once an observer exists', () => {
    const { rerender } = render(<PassList observer={observer} elements={{ status: 'loading' }} nowMs={ref.t} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading orbital elements');
    rerender(<PassList observer={observer} elements={{ status: 'error', message: 'HTTP 503' }} nowMs={ref.t} />);
    expect(screen.getByRole('status')).toHaveTextContent('Could not load orbital elements: HTTP 503');
  });

  it('renders one card per visible pass, chronologically, with the golden ISS pass among them', () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
    render(<PassList observer={observer} elements={{ status: 'ready', records: fixtureRecords(), unavailable: [] }} nowMs={GOLDEN_WINDOW_START} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(1);
    expect(screen.getByRole('status')).toHaveTextContent(`${String(items.length)} visible passes in the next 24 h`);

    const starts = items.map((li) => within(li).getByText('Start', { selector: 'dt' }).nextElementSibling?.textContent ?? '');
    expect([...starts].sort()).toEqual(starts);

    const iss = screen.getByRole('article', { name: 'ISS (Zarya)' });
    expect(iss).toHaveTextContent(`${hhmmss(golden.start.t)} UTC`);
    expect(iss).toHaveTextContent(`${String(Math.round(golden.peak.elDeg))}°`);
    expect(iss).toHaveTextContent(`${compassPoint(golden.peak.azDeg)} (${String(Math.round(golden.peak.azDeg))}°)`);
  });

  it('shows the empty state when the catalog has no elements or no pass falls in the window', () => {
    const { rerender } = render(<PassList observer={observer} elements={{ status: 'ready', records: [], unavailable: [] }} nowMs={ref.t} />);
    expect(screen.getByRole('status')).toHaveTextContent('No catalog objects have orbital elements');
    // Only the ISS, whose single dark pass is nine days later: nothing in the first 24 h.
    const issOnly = fixtureRecords().filter((r) => r.catalog.noradId === 25544);
    rerender(<PassList observer={observer} elements={{ status: 'ready', records: issOnly, unavailable: [] }} nowMs={ref.t} />);
    expect(screen.getByRole('status')).toHaveTextContent('No visible passes in the next 24 h from −38.93, −67.99.');
    expect(screen.queryByRole('list')).toBeNull();
  });
});
