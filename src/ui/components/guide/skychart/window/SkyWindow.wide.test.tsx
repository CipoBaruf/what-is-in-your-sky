/**
 * R185 (FR-WIDE-7, FR-NAME-3; D-1099): the window on wide — the highlighted arc's minute ticks and its arrow, the
 * hover on an arc within 8 px reported through `onPassHover`, and the planets as discs named with `names` off.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../../../tests/support/matchMedia';
import type { Observer } from '../../../../../model';
import { guideTimes } from '../globe/arcs';
import { PLANET_MARK_PX } from '../globe/constants';
import { createHandCamera } from './camera';
import { resetOrientationAccess } from './orientationAccess';
import type { StarField as StarFieldData } from './scene';
import { SkyWindow } from './SkyWindow';

/** A five-minute pass from SE through 50° to SW, every 10 s, on the golden fixture's other fields. */
const golden = goldenPassFixture();
const track = Array.from({ length: 31 }, (_, k) => ({ t: golden.start.t + k * 10_000, azDeg: 120 + 4 * k, elDeg: 10 + 40 * Math.sin((Math.PI * k) / 30), rangeKm: 1000 }));
const pass = { ...golden, track, start: track[0] as (typeof track)[0], peak: track[15] as (typeof track)[0], end: track[30] as (typeof track)[0] };
const other = { ...pass, id: `${pass.id}-b`, track: pass.track.map((p) => ({ ...p, azDeg: (p.azDeg + 180) % 360 })) };
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };

const stars: StarFieldData = {
  catalog: { ra: [0], dec: [0], mag: [0.5], name: ['Alpha'], desig: ['α Car'], con: ['Car'], figures: [] },
  positions: { altDeg: [35], azDeg: [180], planets: [{ body: 'Jupiter', azDeg: 200, altDeg: 20, mag: -2.3 }] },
  layers: { stars: true, figures: false, planets: true, names: false },
};

let media: MatchMediaStub;
beforeEach(() => {
  resetOrientationAccess();
});
afterEach(() => {
  media.restore();
});

function mount(widthPx: number, onPassHover = vi.fn<(id: string | null) => void>()) {
  media = stubMatchMedia(widthPx);
  const camera = createHandCamera({ azDeg: 180, altDeg: 30 });
  const utils = render(<SkyWindow passes={[pass, other]} observer={observer} highlightedPassId={pass.id} camera={camera} onPassHover={onPassHover} scene={{ stars }} />);
  const box = utils.container.querySelector('[tabindex="0"]') as HTMLElement;
  return { ...utils, box, onPassHover };
}

const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe('the window on wide (FR-WIDE-7)', () => {
  it('ticks the highlighted arc at every whole minute in view and draws its arrow there; the 80 % arrow gives way', () => {
    const { container } = mount(WIDE_PX);
    const arc = container.querySelector(`[data-pass-id="${pass.id}"]`) as SVGGElement;
    const ticks = arc.querySelector('[data-arc-ticks]') as SVGPathElement;
    const count = Number(ticks.getAttribute('data-arc-ticks'));
    const all = guideTimes(pass, pass.end.t, 'full')?.ticks.length ?? 0;
    expect(all).toBe(4);
    // The whole arc is in this field: every tick is drawn.
    expect(count).toBe(all);
    // One `M…L…` per tick, each 8 px across the line.
    const strokes = [...(ticks.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)];
    expect(strokes).toHaveLength(count);
    for (const [, x1, y1, x2, y2] of strokes) expect(Math.hypot(Number(x2) - Number(x1), Number(y2) - Number(y1))).toBeCloseTo(8, 0);
    expect(arc.querySelector('[data-arc-arrow]')?.getAttribute('d')).toMatch(/^M.+Z$/);
    expect(arc.querySelector('[data-marker="arrow"]')).toHaveAttribute('visibility', 'hidden');
    // Only the highlighted arc carries them.
    expect(container.querySelector(`[data-pass-id="${other.id}"] [data-arc-ticks]`)).toBeNull();
  });

  it('draws no ticks or arrow on compact, and keeps the 80 % arrow', () => {
    const { container } = mount(COMPACT_PX);
    expect(container.querySelector('[data-arc-ticks]')).toBeNull();
    expect(container.querySelector('[data-arc-arrow]')).toBeNull();
  });

  it('reports the arc within 8 px of the mouse with its id, once, and null on moving off it or leaving', async () => {
    const { container, box, onPassHover } = mount(WIDE_PX);
    const d = container.querySelector(`[data-pass-id="${pass.id}"] path`)?.getAttribute('d') ?? '';
    const points = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
    const on = points[Math.floor(points.length / 2)] as { x: number; y: number };
    expect(on).toBeDefined();
    fireEvent.pointerMove(box, { pointerType: 'mouse', pointerId: 1, clientX: on.x + 6, clientY: on.y });
    await frame();
    expect(onPassHover).toHaveBeenLastCalledWith(pass.id);
    fireEvent.pointerMove(box, { pointerType: 'mouse', pointerId: 1, clientX: on.x + 5, clientY: on.y });
    await frame();
    expect(onPassHover).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(box, { pointerType: 'mouse', pointerId: 1, clientX: 2, clientY: 2 });
    await frame();
    expect(onPassHover).toHaveBeenLastCalledWith(null);
    fireEvent.pointerMove(box, { pointerType: 'mouse', pointerId: 1, clientX: on.x, clientY: on.y });
    await frame();
    expect(onPassHover).toHaveBeenLastCalledWith(pass.id);
    fireEvent.pointerLeave(box, { pointerType: 'mouse', pointerId: 1 });
    expect(onPassHover).toHaveBeenLastCalledWith(null);
  });

  it('reports nothing on compact', async () => {
    const { container, box, onPassHover } = mount(COMPACT_PX);
    const d = container.querySelector(`[data-pass-id="${pass.id}"] path`)?.getAttribute('d') ?? '';
    const [, x, y] = /M(-?[\d.]+) (-?[\d.]+)/.exec(d) ?? [];
    fireEvent.pointerMove(box, { pointerType: 'mouse', pointerId: 1, clientX: Number(x), clientY: Number(y) });
    await frame();
    expect(onPassHover).not.toHaveBeenCalled();
  });
});

describe('the planets on wide (FR-NAME-3)', () => {
  it('draws each planet as a disc of PLANET_MARK_PX in its own token, named in --fg with names off', () => {
    const { container } = mount(WIDE_PX);
    const disc = container.querySelector('[data-planet-marks] [data-planet="Jupiter"]');
    expect(disc?.tagName).toBe('circle');
    expect(disc).toHaveAttribute('r', String(PLANET_MARK_PX));
    expect(disc).toHaveAttribute('data-tone', 'chart-planet-jupiter');
    const name = container.querySelector('[data-planet-name="0"]');
    expect(name).toHaveTextContent('Jupiter');
    expect(name).toHaveAttribute('visibility', 'visible');
    expect(name?.getAttribute('class')).toMatch(/planetName/);
    // The names layer is off: no star name.
    expect(container.querySelector('[data-names]')).toHaveAttribute('display', 'none');
  });

  it('keeps the glyph on compact', () => {
    const { container } = mount(COMPACT_PX);
    expect(container.querySelector('[data-planet-marks] [data-planet="Jupiter"]')?.tagName).toBe('text');
    expect(container.querySelector('[data-planet-name]')).toBeNull();
  });
});
