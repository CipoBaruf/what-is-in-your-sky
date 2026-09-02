import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REFERENCE_VALUES_PATH } from '../../../../tests/support/fixtures';
import { loadOmmFixture } from '../../../../tests/setup/msw';
import type { Observer, Pass } from '../../../model';
import { NextPassLine, passLine } from './NextPassLine';

interface Reference {
  t: number;
  observer: { lat: number; lon: number; altM: number };
  firstGoldenPass: { start: { t: number; azDeg: number }; peak: { elDeg: number }; end: { t: number } } | null;
}
const ref = JSON.parse(readFileSync(REFERENCE_VALUES_PATH, 'utf8')) as Reference;
const observer: Observer = { ...ref.observer, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);

const samplePass: Pass = {
  id: '25544-1789120094063',
  noradId: 25544,
  name: 'ISS (ZARYA)',
  start: { t: 1789120094063, azDeg: 46.44, elDeg: 10.0, rangeKm: 1513 },
  peak: { t: 1789120118376, azDeg: 53.33, elDeg: 10.16, rangeKm: 1505 },
  end: { t: 1789120142063, azDeg: 60.03, elDeg: 10.01, rangeKm: 1516 },
  startReason: 'horizon',
  endReason: 'horizon',
  durationS: 48,
  peakMagnitude: 1.18,
  sunAltAtPeakDeg: -10.6,
  twilight: true,
  track: [],
  elementsEpochMs: 1788291742677,
};

describe('passLine', () => {
  it('names the pass with UTC times, start azimuth and max elevation on one line', () => {
    expect(passLine(samplePass, null)).toBe('ISS (ZARYA) | 2026-09-11 | start 09:48:14 UTC az 46° | max 10° | end 09:49:02 UTC');
  });
});

describe('<NextPassLine>', () => {
  it('asks for coordinates when there is no observer', () => {
    render(<NextPassLine observer={null} elements={{ status: 'loading' }} nowMs={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Enter coordinates');
  });

  it('shows loading and error states once an observer exists', () => {
    const { rerender } = render(<NextPassLine observer={observer} elements={{ status: 'loading' }} nowMs={ref.t} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading orbital elements');
    rerender(<NextPassLine observer={observer} elements={{ status: 'error', message: 'HTTP 503' }} nowMs={ref.t} />);
    expect(screen.getByRole('status')).toHaveTextContent('Could not load orbital elements: HTTP 503');
  });

  it('renders the first golden pass from the fixture elements at capturedAt', () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
    render(<NextPassLine observer={observer} elements={{ status: 'ready', records: loadOmmFixture('stations') }} nowMs={ref.t} />);
    const line = screen.getByRole('status');
    expect(line).toHaveTextContent(`start ${hhmmss(golden.start.t)} UTC az ${String(Math.round(golden.start.azDeg))}°`);
    expect(line).toHaveTextContent(`max ${String(Math.round(golden.peak.elDeg))}°`);
    expect(line).toHaveTextContent(`end ${hhmmss(golden.end.t)} UTC`);
  });

  it('says so when the ISS is absent from the elements', () => {
    render(<NextPassLine observer={observer} elements={{ status: 'ready', records: [] }} nowMs={ref.t} />);
    expect(screen.getByRole('status')).toHaveTextContent('ISS elements are missing');
  });
});
