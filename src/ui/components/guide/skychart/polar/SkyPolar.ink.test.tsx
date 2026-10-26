/**
 * R122 (FR-STAR-6 as amended, FR-SKY-4; D-813): the polar chart's glyphs take
 * the window's ink offsets, so a `.`'s ink and not its em box sits on its
 * point, and the placement runs again only when what moves it changes. jsdom
 * has no text metrics, so the offsets are stubbed here with the browser's
 * measured shape (`inkOffsets.integration.test.ts`): a `.` far below its box's
 * centre, a `*` a little above.
 */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import type { Observer } from '../../../../../model';
import { appStore } from '../../../../../state';
import type { SkyScene } from '../window/scene';
import { SkyPolar } from './SkyPolar';

const ink = vi.hoisted(() => ({ measured: false, ready: Promise.resolve(false) }));

vi.mock('../window/inkOffsets', () => ({
  inkMeasured: () => ink.measured,
  inkOffsetsReady: () => ink.ready,
  inkOffset: (glyph: string) => (!ink.measured ? { dx: 0, dy: 0 } : glyph === '.' ? { dx: 0.3, dy: -1.9 } : glyph === '*' ? { dx: 0, dy: 0.7 } : { dx: 0.1, dy: 0 }),
}));

vi.mock('../window/starGlyphs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../window/starGlyphs')>();
  return { ...actual, collide: vi.fn(actual.collide) };
});

const { collide } = await import('../window/starGlyphs');

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

/** The star group is a lazy chunk (D-813): its first render waits for the import, as the page's does. */
const settle = (): Promise<void> =>
  act(async () => {
    await import('./PolarStars');
  });

function scene(altDeg: readonly number[]): SkyScene {
  return {
    stars: {
      catalog: { ra: [0, 0], dec: [0, 0], mag: [1, 3], name: ['', ''], desig: ['a', 'b'], con: ['Ori', 'Ori'], figures: [] },
      positions: { altDeg, azDeg: [90, 200], planets: [] },
      layers: { stars: true, figures: true, planets: true, names: true },
    },
  };
}

describe('<SkyPolar> glyph ink and placement (D-813)', () => {
  afterEach(() => {
    ink.measured = false;
    ink.ready = Promise.resolve(false);
    vi.mocked(collide).mockClear();
    appStore.setState(initial, true);
  });

  it('writes each glyph’s measured ink offset as dx/dy, once the measurement lands after the first draw', async () => {
    let land: (measured: boolean) => void = () => undefined;
    ink.ready = new Promise((resolve) => {
      land = resolve;
    });
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} scene={scene([30, 40])} />);
    await settle();
    const star = (i: number): Element | null => container.querySelector(`[data-star="${String(i)}"]`);
    expect(star(1)).toHaveAttribute('dy', '0');
    ink.measured = true;
    await act(async () => {
      land(true);
      await ink.ready;
    });
    expect(star(0)).toHaveAttribute('data-glyph', '*');
    expect(star(0)).toHaveAttribute('dx', '0');
    expect(star(0)).toHaveAttribute('dy', '0.7');
    expect(star(1)).toHaveAttribute('data-glyph', '.');
    expect(star(1)).toHaveAttribute('dx', '0.3');
    expect(star(1)).toHaveAttribute('dy', '-1.9');
  });

  it('places again for new positions or a new orientation, not for a scene rebuilt around the same positions', async () => {
    const first = scene([30, 40]);
    const { rerender } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} now={1} scene={first} />);
    await settle();
    expect(collide).toHaveBeenCalledTimes(1);
    // A tick that rebuilt the scene object and moved the clock, with `starsAt`'s memo handing back the same positions.
    rerender(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} now={2} scene={{ stars: first.stars && { ...first.stars } }} />);
    expect(collide).toHaveBeenCalledTimes(1);
    rerender(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} now={3} scene={scene([31, 40])} />);
    expect(collide).toHaveBeenCalledTimes(2);
    act(() => {
      appStore.getState().setChartOrientation(appStore.getState().chartOrientation === 'map' ? 'looking-up' : 'map');
    });
    expect(collide).toHaveBeenCalledTimes(3);
  });
});
