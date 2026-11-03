/**
 * D-1028: the when step's cloud rows — one row with one state all night or `Variable`, two rows (`Until 02:00`,
 * `From 02:00`) when the cloud changes once, each word in its own colour with its own tooltip.
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NightClouds } from '../../../lib/nightClouds';
import type { Observer, WeatherSnapshot } from '../../../model';
import { appStore } from '../../../state';
import type { Night } from './useNight';
import { WhenStep } from './WhenStep';

const T = Date.parse('2026-11-03T05:00:00Z'); // 02:00 in Neuquén
const observer: Observer = { lat: -38.9, lon: -68, altM: 0, label: 'Neuquén', source: 'coords', timeZone: 'America/Argentina/Salta' };
const snapshot: WeatherSnapshot = { provider: 'open-meteo', lat: -38.9, lon: -68, cellKey: '-38.9,-68.0', fetchedAt: T - 6 * 3_600_000, timeZone: 'America/Argentina/Salta', hourly: [] };

let clouds: NightClouds;
vi.mock('./useNight', () => ({
  useNight: (): Night => ({ bands: [], sampledFrom: T, now: T, dark: null, starsFrom: null, window: null, snapshot, clouds }),
  useMoonNote: () => null,
}));

afterEach(() => {
  appStore.setState(appStore.getInitialState(), true);
});

const rows = () => within(screen.getByTestId('when-sky')).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.querySelector('[data-state]')?.textContent]);

describe('the when step’s clouds (D-1028)', () => {
  it('is one row with one state all night', () => {
    clouds = { kind: 'steady', verdict: { state: 'clear', effectivePct: 8, at: T } };
    render(<WhenStep observer={observer} head={null} onNext={vi.fn()} focus={false} />);
    expect(rows()).toEqual([['Clouds tonight', 'Clear']]);
    expect(within(screen.getByTestId('when-sky')).getByRole('tooltip')).toHaveTextContent('8 % effective cloud across the dark band.');
  });

  it('is two rows, until and from the change, when it changes once', () => {
    clouds = { kind: 'change', at: T, before: { state: 'partly', effectivePct: 65.45, at: T - 4 * 3_600_000 }, after: { state: 'clear', effectivePct: 9, at: T } };
    render(<WhenStep observer={observer} head={null} onNext={vi.fn()} focus={false} />);
    expect(rows()).toEqual([
      ['Until 02:00', 'Partly cloudy'],
      ['From 02:00', 'Clear'],
    ]);
    const tips = within(screen.getByTestId('when-sky')).getAllByRole('tooltip');
    expect(tips[0]).toHaveTextContent('65 % effective cloud until 02:00.');
    expect(tips[1]).toHaveTextContent('9 % effective cloud from 02:00.');
    expect(screen.getByText('Partly cloudy')).toHaveAttribute('data-state', 'partly');
    expect(screen.getByText('Clear')).toHaveAttribute('data-state', 'clear');
  });

  it('says Variable in the one row when it changes more than once', () => {
    clouds = { kind: 'variable', verdict: { state: 'partly', effectivePct: 45, at: T } };
    render(<WhenStep observer={observer} head={null} onNext={vi.fn()} focus={false} />);
    expect(rows()).toEqual([['Clouds tonight', 'Variable']]);
  });
});
