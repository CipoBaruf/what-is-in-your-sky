import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Pass } from '../../../model';
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

  it('offers an "Open guide" control named after the pass only when it can open', async () => {
    const onOpen = vi.fn();
    const { rerender } = render(<PassCard pass={samplePass} timeZone={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<PassCard pass={samplePass} timeZone={null} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open guide → ISS (Zarya)' }));
    expect(onOpen).toHaveBeenCalledWith(samplePass.id);
  });
});
