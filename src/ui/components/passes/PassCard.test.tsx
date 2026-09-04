import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MOON_FIXTURE, NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import type { Pass, WeatherSnapshot } from '../../../model';
import { PassCard } from './PassCard';

const samplePass: Pass = {
  id: '25544-1789120094063',
  noradId: 25544,
  name: 'ISS (Zarya)',
  start: { t: 1789120094063, azDeg: 46.44, elDeg: 10.0, rangeKm: 1513 },
  peak: { t: 1789120118376, azDeg: 53.33, elDeg: 10.16, rangeKm: 1505 },
  end: { t: 1789120142063, azDeg: 60.03, elDeg: 10.01, rangeKm: 1516 },
  startReason: 'horizon',
  endReason: 'horizon',
  durationS: 48,
  peakMagnitude: 0.48,
  sunAltAtPeakDeg: -10.6,
  twilight: true,
  track: [],
  elementsEpochMs: 1788291742677,
  ...NO_MOON_AT_PEAK, // the Moon reaches the card in R30 (FR-MOON-2)
};

const HOUR = 3_600_000;
const peakHour = Math.floor(samplePass.peak.t / HOUR) * HOUR;
const forecast: WeatherSnapshot = {
  provider: 'open-meteo',
  lat: -38.9,
  lon: -68,
  cellKey: '-38.9,-68.0',
  fetchedAt: samplePass.start.t - 2 * HOUR,
  timeZone: 'America/Argentina/Salta',
  hourly: [
    { t: peakHour, totalPct: 20, lowPct: 10, midPct: 10, highPct: 40 },
    { t: peakHour + HOUR, totalPct: 20, lowPct: 10, midPct: 10, highPct: 40 },
  ],
};

describe('<PassCard>', () => {
  it('shows name, start, max elevation, peak compass + degrees, duration and magnitude with its phrase (US-5 AC1, FR-GUIDE-3)', () => {
    render(<PassCard pass={samplePass} timeZone={null} />);
    const card = screen.getByRole('article', { name: 'ISS (Zarya)' });
    const field = (label: string): string => {
      const dt = within(card).getByText(label, { selector: 'dt' });
      return dt.nextElementSibling?.textContent ?? '';
    };
    expect(field('Start')).toBe('2026-09-11 09:48:14 UTC');
    expect(field('Max elevation')).toBe('10°');
    expect(field('Peak direction')).toBe('NE (53°)');
    expect(field('Duration')).toBe('48 s');
    expect(field('Magnitude')).toBe('+0.5, like a bright star');
  });

  it('formats the start in the observer zone when one is known', () => {
    render(<PassCard pass={samplePass} timeZone="America/Argentina/Buenos_Aires" />);
    expect(screen.getByRole('article')).toHaveTextContent('2026-09-11 06:48:14 GMT-3');
  });

  it('carries the "sky still bright" label only when the pass is a twilight one (FR-VIS-7)', () => {
    const { rerender } = render(<PassCard pass={samplePass} timeZone={null} />);
    expect(screen.getByRole('article')).toHaveTextContent('sky still bright');
    rerender(<PassCard pass={{ ...samplePass, twilight: false }} timeZone={null} />);
    expect(screen.getByRole('article')).not.toHaveTextContent('sky still bright');
  });

  it('carries the "[moon glare]" label only when the pass has the verdict (FR-MOON-2)', () => {
    const { rerender } = render(<PassCard pass={{ ...samplePass, moonAtPeak: MOON_FIXTURE, moonGlare: { glare: true, separationDeg: 8.2 } }} timeZone={null} />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('moon glare')).toHaveAccessibleDescription(/at least 50 % lit and closer than 30°/);
    rerender(<PassCard pass={samplePass} timeZone={null} />);
    expect(card).not.toHaveTextContent('moon glare');
  });

  it('wears the cloud verdict at the peak when given a forecast, "weather unknown" for null, and no row when omitted (FR-WX-3)', () => {
    const { rerender } = render(<PassCard pass={samplePass} timeZone="America/Argentina/Salta" weather={forecast} />);
    const card = screen.getByRole('article');
    // 0.6·10 + 0.3·10 + 0.1·40 = 13 %
    expect(within(card).getByText('Clear, 13 % cloud')).toHaveAttribute('data-state', 'clear');
    expect(within(card).getByRole('tooltip')).toHaveTextContent('fetched 2026-09-11 04:48:14 GMT-3');
    rerender(<PassCard pass={samplePass} timeZone={null} weather={null} />);
    expect(within(card).getByText('Weather unknown')).toHaveAttribute('data-state', 'unknown');
    rerender(<PassCard pass={samplePass} timeZone={null} />);
    expect(within(card).queryByText('Clouds', { selector: 'dt' })).toBeNull();
  });

  it('offers an "Open guide" control named after the pass only when it can open', async () => {
    const onOpen = vi.fn();
    const { rerender } = render(<PassCard pass={samplePass} timeZone={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<PassCard pass={samplePass} timeZone={null} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open guide → ISS (Zarya)' }));
    expect(onOpen).toHaveBeenCalledWith(samplePass.id);
  });
});
