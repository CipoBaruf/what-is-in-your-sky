import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Pass } from '../../../model';
import { PassCard, formatDuration, formatMagnitude } from './PassCard';

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

describe('formatDuration', () => {
  it('prints seconds only under a minute and minutes plus seconds above', () => {
    expect(formatDuration(48)).toBe('48 s');
    expect(formatDuration(272.4)).toBe('4 min 32 s');
    expect(formatDuration(60)).toBe('1 min 0 s');
  });
});

describe('formatMagnitude', () => {
  it('always carries a sign, one decimal, and a real minus sign', () => {
    expect(formatMagnitude(1.18)).toBe('+1.2');
    expect(formatMagnitude(-0.26)).toBe('−0.3');
    expect(formatMagnitude(0)).toBe('+0.0');
    expect(formatMagnitude(-0.04)).toBe('+0.0');
    expect(formatMagnitude(-4)).toBe('−4.0');
  });
});

describe('<PassCard>', () => {
  it('shows name, start, max elevation, peak compass + degrees, duration and magnitude (US-5 AC1)', () => {
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
    expect(field('Magnitude')).toBe('+0.5');
  });

  it('formats the start in the observer zone when one is known', () => {
    render(<PassCard pass={samplePass} timeZone="America/Argentina/Buenos_Aires" />);
    expect(screen.getByRole('article')).toHaveTextContent('2026-09-11 06:48:14 GMT-3');
  });
});
