/**
 * R44 (FR-WIN-3, US-21 AC6; F-41, D-185): the declination is evaluated once
 * per observer, on the main thread, and kept until the observer moves — not
 * once per reading and not on the 10 s tick.
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { declinationDeg } from '../../../lib/declination';
import { useDeclination } from './useDeclination';

vi.mock('../../../lib/declination', { spy: true });

const NEUQUEN = { lat: -38.93, lon: -67.99, altM: 0 };
const SYDNEY = { lat: -33.8688, lon: 151.2093, altM: 0 };

function Probe({ observer }: { observer: { lat: number; lon: number; altM: number } }) {
  return <span data-testid="declination">{useDeclination(observer).toFixed(4)}</span>;
}

afterEach(() => {
  vi.mocked(declinationDeg).mockClear();
});

describe('useDeclination', () => {
  it('is the WMM value for the observer', () => {
    const { getByTestId } = render(<Probe observer={NEUQUEN} />);
    expect(Number(getByTestId('declination').textContent)).toBeCloseTo(1.12, 1);
  });

  it('evaluates once and again only when the observer moves', () => {
    const { rerender, getByTestId } = render(<Probe observer={NEUQUEN} />);
    expect(declinationDeg).toHaveBeenCalledTimes(1);

    // A re-render with the same place — a new object each time, as the store hands one out — is free.
    rerender(<Probe observer={{ ...NEUQUEN }} />);
    rerender(<Probe observer={{ ...NEUQUEN }} />);
    expect(declinationDeg).toHaveBeenCalledTimes(1);

    // Moving is what re-evaluates it, and the value follows.
    rerender(<Probe observer={SYDNEY} />);
    expect(declinationDeg).toHaveBeenCalledTimes(2);
    expect(Number(getByTestId('declination').textContent)).toBeCloseTo(12.8, 1);
  });
});
