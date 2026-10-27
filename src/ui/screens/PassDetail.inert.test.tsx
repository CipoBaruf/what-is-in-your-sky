import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../tests/support/catalogFixtures';
import { drawnMagLimit, drawnRungs } from '../../lib/skyStars';
import type { Observer } from '../../model';
import type { StarSource } from '../components/guide/skychart/useSkyScene';
import { PassDetail, TICK_MS } from './PassDetail';

/**
 * R123 review (FR-SKY-8; D-791): the pass detail's stars are placed at its own instant, which ticks every second
 * — but not while the sheet is `inert` behind another layer, where none of the drawing is seen. The source is
 * stubbed so the test counts the placements, not the catalogue.
 */
const positionsAt = vi.fn((_where: Pick<Observer, 'lat' | 'lon'>, _t: number): ReturnType<StarSource['positionsAt']> => ({ altDeg: [], azDeg: [], planets: [], sunAltDeg: -18 }));
const source: StarSource = { catalog: { ra: [], dec: [], mag: [], name: [], desig: [], con: [], figures: [] }, positionsAt, drawnRungs, drawnMagLimit };

vi.mock('../components/live/useStarSource', () => ({ useStarSource: () => source }));

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };

describe('<PassDetail> while inert (FR-SKY-8)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(pass.start.t - 754_000);
    positionsAt.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('places the stars every second while seen, holds them while inert, and catches up when the sheet is back', () => {
    const props = { pass, observer, onClose: () => undefined, onShowList: () => undefined };
    const { rerender } = render(<PassDetail {...props} />);
    const instants = (): number[] => positionsAt.mock.calls.map(([, t]) => t);
    expect(instants()).toEqual([pass.start.t - 754_000]);
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(instants()).toHaveLength(2);
    rerender(<PassDetail {...props} inert />);
    act(() => {
      vi.advanceTimersByTime(5 * TICK_MS);
    });
    expect(instants()).toHaveLength(2);
    rerender(<PassDetail {...props} />);
    expect(instants()).toHaveLength(3);
    expect(instants().at(-1)).toBe(pass.start.t - 754_000 + 6 * TICK_MS);
  });
});
