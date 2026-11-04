import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { starCatalog } from '../../../../../data/stars/catalog';
import { loadDeepChunk, parseDeepCatalog } from '../../../../../data/stars/deepChunk';
import { legendRows } from '../../../../../lib/legend';
import type { Observer, Pass, PassPoint } from '../../../../../model';
import { formatStarMag, STAR_LABEL_HOLD_S } from '../../../../screens/stars/field';
import { HIT_RADIUS_PX } from '../window/starGlyphs';
import { GLOBE_KEY_STEP_DEG, GLOBE_MAX_NODES, GLOBE_RADIUS_SHARE, GLOBE_ZOOM_MAX, GLOBE_ZOOM_MIN, GLOBE_ZOOM_STEP } from './constants';
import { readoutLine } from './GlobeRenderer';
import SkyGlobe, { type GlobePick, type SkyGlobeProps } from './SkyGlobe';

/**
 * R169 (FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-9, FR-GLOBE-10, FR-GLOBE-11; PLAN
 * D-1038, D-1042): the component — the keys, the wheel's bounds, a drag
 * keeping the grabbed point under the hand, the label's naming on hover and
 * press with the readout line, no frame without a change, the frame switch
 * keeping the centre, a new place re-opening the view, the faint stars'
 * fetch (the chunk mocked: off, no fetch; on, one; failed, told).
 */

vi.mock('../../../../../data/stars/deepChunk', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../../../data/stars/deepChunk')>()), loadDeepChunk: vi.fn() }));

const place = (lat: number, lon: number, timeZone: string | null = null): Observer => ({ lat, lon, altM: 0, label: `${String(lat)}, ${String(lon)}`, source: 'coords', timeZone });
const BUENOS_AIRES = place(-34.6, -58.38, 'America/Argentina/Buenos_Aires');
const LONDON = place(51.51, -0.13, 'Europe/London');
const T = Date.parse('2026-11-04T01:00:00Z');
const W = 1100;
const H = 700;
const R = H * GLOBE_RADIUS_SHARE;
const catalog = starCatalog();
const LAYERS = { stars: true, figures: true, planets: true, names: true };

const DEEP = parseDeepCatalog({
  ra: Array.from({ length: 40 }, (_, i) => Math.round(i * 9 * 100)),
  dec: Array.from({ length: 40 }, (_, i) => Math.round((-80 + ((i * 41) % 160)) * 100)),
  mag: Array.from({ length: 40 }, (_, i) => 46 + (i % 20)),
  bv: Array.from({ length: 40 }, (_, i) => -2 + (i % 14)),
});

function scriptedFrames(): { frame: () => void; calls: () => number } {
  let next = 1;
  let calls = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const id = next++;
    calls += 1;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    pending.delete(id);
  });
  return {
    frame: (): void => {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(16);
      });
    },
    calls: () => calls,
  };
}

/** jsdom has no `ResizeObserver`: one that reports the test's box once, on `observe`. */
class FakeResizeObserver {
  static boxes: { width: number; height: number } = { width: W, height: H };
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    this.callback([{ contentRect: FakeResizeObserver.boxes } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  disconnect(): void {
    // nothing to stop
  }
}

let frames: ReturnType<typeof scriptedFrames>;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  frames = scriptedFrames();
  vi.mocked(loadDeepChunk).mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mount(over: Partial<SkyGlobeProps> = {}) {
  const props: SkyGlobeProps = { place: BUENOS_AIRES, instant: T, turn: 'you', layers: LAYERS, faint: false, language: 'en', ...over };
  const result = render(<SkyGlobe {...props} />);
  frames.frame();
  const box = result.container.querySelector('[data-testid="globe-box"]') as HTMLDivElement;
  box.setPointerCapture = vi.fn();
  box.releasePointerCapture = vi.fn();
  const q = <T extends Element = Element>(selector: string): T => {
    const node = result.container.querySelector<T>(selector);
    if (!node) throw new Error(`no ${selector}`);
    return node;
  };
  const rerender = (next: Partial<SkyGlobeProps>): void => {
    result.rerender(<SkyGlobe {...props} {...next} />);
    frames.frame();
  };
  return { ...result, box, q, rerender, props };
}

const num = (node: Element, attr: string): number => Number(node.getAttribute(attr));
/** The drawn `*` star nearest the box's centre, with its point. */
function centreStar(container: Element): { index: number; x: number; y: number } {
  let best: { index: number; x: number; y: number; d: number } | null = null;
  for (const node of container.querySelectorAll<SVGTextElement>('[data-stars] text[visibility="visible"]')) {
    const x = num(node, 'x');
    const y = num(node, 'y');
    const d = Math.hypot(x - W / 2, y - H / 2);
    if (!best || d < best.d) best = { index: Number(node.dataset.star), x, y, d };
  }
  if (!best) throw new Error('no star drawn');
  return best;
}
const starNode = (container: Element, index: number): SVGTextElement => {
  const node = container.querySelector<SVGTextElement>(`[data-star="${String(index)}"]`);
  if (!node) throw new Error(`no star ${String(index)}`);
  return node;
};

describe('the box (FR-GLOBE-6, FR-GLOBE-14)', () => {
  it('mounts one SVG by ref, measured to the box, focusable and described by its readout line', () => {
    const { container, box, q } = mount();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(q('svg').getAttribute('viewBox')).toBe(`0 0 ${String(W)} ${String(H)}`);
    expect(q('svg')).toHaveAttribute('aria-label', 'The celestial globe: drag it, or use the arrow keys');
    expect(box).toHaveAttribute('tabindex', '0');
    expect(box).toHaveAttribute('data-dragging', 'false');
    const readout = q('[data-testid="globe-readout"]');
    expect(box.getAttribute('aria-describedby')).toBe(readout.id);
    expect(container.querySelector('[data-testid="globe-named"]')).toBeNull();
    expect(num(q('[data-disc]'), 'r')).toBeCloseTo(R, 1);
  });

  it('draws no frame without a change: the same props again schedule nothing', () => {
    const { rerender } = mount();
    const before = frames.calls();
    rerender({});
    rerender({ layers: { ...LAYERS }, place: { ...BUENOS_AIRES } });
    expect(frames.calls()).toBe(before);
    rerender({ instant: T + 60_000 });
    expect(frames.calls()).toBe(before + 1);
  });
});

describe('the keys (FR-GLOBE-6)', () => {
  it('turn the view by GLOBE_KEY_STEP_DEG, zoom by GLOBE_ZOOM_STEP, and Home restores the opening view at zoom 1', () => {
    const { container, box, q } = mount();
    const disc = q('[data-disc]');
    const star = centreStar(container);
    const node = starNode(container, star.index);
    box.focus();
    const right = fireEvent.keyDown(box, { key: 'ArrowRight' });
    frames.frame();
    expect(right).toBe(false); // prevented: the box's key, not the page's
    const afterRight = num(node, 'x');
    expect(Math.abs(afterRight - star.x)).toBeGreaterThan(R * Math.sin((GLOBE_KEY_STEP_DEG * Math.PI) / 180) * 0.5);
    fireEvent.keyDown(box, { key: 'ArrowLeft' });
    frames.frame();
    expect(num(node, 'x')).toBeCloseTo(star.x, 0);
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    frames.frame();
    expect(num(node, 'y')).not.toBeCloseTo(star.y, 0);
    fireEvent.keyDown(box, { key: '+' });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP, 0);
    fireEvent.keyDown(box, { key: '=' });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP * GLOBE_ZOOM_STEP, 0);
    fireEvent.keyDown(box, { key: '-' });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP, 0);
    fireEvent.keyDown(box, { key: 'Home' });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R, 0);
    expect(num(node, 'x')).toBeCloseTo(star.x, 0);
    expect(num(node, 'y')).toBeCloseTo(star.y, 0);
    // ctrl + '+' is the browser's own zoom: left to it.
    const ctrl = fireEvent.keyDown(box, { key: '+', ctrlKey: true });
    expect(ctrl).toBe(true);
    const other = fireEvent.keyDown(box, { key: 'j' });
    expect(other).toBe(true);
  });
});

describe('the zoom buttons (FR-GLOBE-6 as amended, V212-12, D-1055)', () => {
  it('zoom one GLOBE_ZOOM_STEP a press, named in both languages, disabled at each end of the range', () => {
    const { q, rerender } = mount();
    const disc = q('[data-disc]');
    const zoomIn = q<HTMLButtonElement>('[data-testid="globe-zoom-in"]');
    const zoomOut = q<HTMLButtonElement>('[data-testid="globe-zoom-out"]');
    expect(zoomIn.getAttribute('aria-label')).toBe('Zoom in');
    expect(zoomOut.getAttribute('aria-label')).toBe('Zoom out');
    expect(zoomIn.disabled).toBe(false);
    expect(zoomOut.disabled).toBe(false);
    fireEvent.click(zoomIn);
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP, 0);
    fireEvent.click(zoomOut);
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R, 0);
    for (let k = 0; k < 20 && !zoomIn.disabled; k += 1) fireEvent.click(zoomIn);
    frames.frame();
    expect(zoomIn.disabled).toBe(true);
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_MAX, 0);
    for (let k = 0; k < 30 && !zoomOut.disabled; k += 1) fireEvent.click(zoomOut);
    frames.frame();
    expect(zoomOut.disabled).toBe(true);
    expect(zoomIn.disabled).toBe(false);
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_MIN, 0);
    rerender({ language: 'es' });
    expect(zoomIn.getAttribute('aria-label')).toBe('Acercar');
    expect(zoomOut.getAttribute('aria-label')).toBe('Alejar');
  });
});

describe('the wheel and the pinch (FR-GLOBE-6)', () => {
  it('zooms one step per notch and stays between GLOBE_ZOOM_MIN and GLOBE_ZOOM_MAX', () => {
    const { box, q } = mount();
    const disc = q('[data-disc]');
    const prevented = fireEvent.wheel(box, { deltaY: -100 });
    frames.frame();
    expect(prevented).toBe(false);
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP, 0);
    for (let k = 0; k < 20; k += 1) fireEvent.wheel(box, { deltaY: -100 });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_MAX, 0);
    for (let k = 0; k < 30; k += 1) fireEvent.wheel(box, { deltaY: 100 });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_MIN, 0);
    fireEvent.wheel(box, { deltaY: 0 });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_MIN, 0);
  });

  it('a trackpad’s small deltas zoom their share of a notch, a line-mode notch is one, and ctrl or cmd + wheel is the browser’s', () => {
    const { box, q } = mount();
    const disc = q('[data-disc]');
    for (let k = 0; k < 10; k += 1) fireEvent.wheel(box, { deltaY: -10 });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP, 0);
    fireEvent.wheel(box, { deltaY: -3, deltaMode: 1 });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP ** 2, 0);
    // One event never zooms past a notch, whatever its size.
    fireEvent.wheel(box, { deltaY: -5000 });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP ** 3, 0);
    expect(fireEvent.wheel(box, { deltaY: -100, ctrlKey: true })).toBe(true);
    expect(fireEvent.wheel(box, { deltaY: -100, metaKey: true })).toBe(true);
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * GLOBE_ZOOM_STEP ** 3, 0);
  });

  it('a pinch zooms by the fingers’ distance, and ends the drag', () => {
    const { box, q } = mount();
    const disc = q('[data-disc]');
    fireEvent.pointerDown(box, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 500, clientY: 350 });
    expect(box).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerDown(box, { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 600, clientY: 350 });
    expect(box).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerMove(box, { pointerId: 2, pointerType: 'touch', clientX: 700, clientY: 350 });
    frames.frame();
    expect(num(disc, 'r')).toBeCloseTo(R * 2, 1);
    fireEvent.pointerUp(box, { pointerId: 2, pointerType: 'touch', clientX: 700, clientY: 350 });
    fireEvent.pointerUp(box, { pointerId: 1, pointerType: 'touch', clientX: 500, clientY: 350 });
    expect(box).toHaveAttribute('data-dragging', 'false');
  });
});

describe('the hand (FR-GLOBE-6)', () => {
  it('a drag turns the globe so the grabbed star stays under the pointer, one write per animation frame, captured', () => {
    const { container, box } = mount();
    const star = centreStar(container);
    const node = starNode(container, star.index);
    fireEvent.pointerDown(box, { button: 0, pointerId: 7, pointerType: 'mouse', isPrimary: true, clientX: star.x, clientY: star.y });
    expect(box.setPointerCapture).toHaveBeenCalledWith(7);
    expect(box).toHaveAttribute('data-dragging', 'true');
    // Two moves before the frame fold into one turn.
    fireEvent.pointerMove(box, { pointerId: 7, pointerType: 'mouse', clientX: star.x + 20, clientY: star.y + 10 });
    fireEvent.pointerMove(box, { pointerId: 7, pointerType: 'mouse', clientX: star.x + 40, clientY: star.y + 20 });
    expect(num(node, 'x')).toBeCloseTo(star.x, 0);
    frames.frame(); // the hand's frame: the turn is written
    frames.frame(); // the renderer's frame: it is drawn
    expect(Math.abs(num(node, 'x') - (star.x + 40))).toBeLessThan(0.6);
    expect(Math.abs(num(node, 'y') - (star.y + 20))).toBeLessThan(0.6);
    // Another pointer's move is not this drag's.
    fireEvent.pointerMove(box, { pointerId: 8, pointerType: 'mouse', clientX: 0, clientY: 0 });
    frames.frame();
    frames.frame();
    expect(Math.abs(num(node, 'x') - (star.x + 40))).toBeLessThan(0.6);
    fireEvent.pointerUp(box, { pointerId: 7, pointerType: 'mouse', clientX: star.x + 40, clientY: star.y + 20 });
    expect(box).toHaveAttribute('data-dragging', 'false');
    expect(box.releasePointerCapture).toHaveBeenCalledWith(7);
    // A drag names nothing, and after the pointer is up a move turns nothing.
    expect(container.querySelector('[data-testid="globe-named"]')).toBeNull();
    fireEvent.pointerMove(box, { pointerId: 7, pointerType: 'mouse', clientX: 5, clientY: 5 });
    frames.frame();
    frames.frame();
    expect(Math.abs(num(node, 'x') - (star.x + 40))).toBeLessThan(0.6);
  });

  it('a press that travels less than the hit radius turns nothing', () => {
    const { container, box } = mount();
    const star = centreStar(container);
    const node = starNode(container, star.index);
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(box, { pointerId: 1, pointerType: 'mouse', clientX: 300 + HIT_RADIUS_PX / 2, clientY: 300 });
    frames.frame();
    frames.frame();
    expect(num(node, 'x')).toBeCloseTo(star.x, 1);
    fireEvent.pointerUp(box, { pointerId: 1, pointerType: 'mouse', clientX: 300 + HIT_RADIUS_PX / 2, clientY: 300 });
  });
});

describe('naming (FR-GLOBE-11)', () => {
  it('a hover names the star under the mouse — the label beside it and the readout line — and leaving clears it', () => {
    const { container, box, q } = mount();
    const star = centreStar(container);
    fireEvent.pointerMove(box, { pointerId: 3, pointerType: 'mouse', clientX: star.x + 2, clientY: star.y - 3 });
    frames.frame();
    const label = q('[data-label]');
    expect(label).toHaveAttribute('visibility', 'visible');
    expect(label.textContent).toBe(`${catalog.name[star.index] || catalog.desig[star.index]} · mag ${formatStarMag(catalog.mag[star.index] ?? 0, 'en')}`);
    expect(q('[data-testid="globe-named"]').textContent).toBe(readoutLine(catalog, { place: BUENOS_AIRES, t: T, lang: 'en' }, { kind: 'star', index: star.index }));
    expect(q('[data-testid="globe-named"]').textContent).toMatch(/ · mag .* · \d+° up · /);
    fireEvent.pointerLeave(box, { pointerId: 3, pointerType: 'mouse' });
    frames.frame();
    expect(label).toHaveAttribute('visibility', 'hidden');
    expect(container.querySelector('[data-testid="globe-named"]')).toBeNull();
  });

  it('a click names, a second click on the same clears, a click elsewhere clears, and STAR_LABEL_HOLD_S clears', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { container, box, q } = mount();
    const star = centreStar(container);
    const click = (x: number, y: number): void => {
      fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
      fireEvent.pointerUp(box, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y });
      frames.frame();
    };
    click(star.x, star.y);
    expect(q('[data-label]')).toHaveAttribute('visibility', 'visible');
    expect(q('[data-testid="globe-named"]')).toBeInTheDocument();
    click(star.x, star.y);
    expect(container.querySelector('[data-testid="globe-named"]')).toBeNull();
    click(star.x, star.y);
    expect(q('[data-testid="globe-named"]')).toBeInTheDocument();
    click(5, 5);
    expect(container.querySelector('[data-testid="globe-named"]')).toBeNull();
    click(star.x, star.y);
    act(() => {
      vi.advanceTimersByTime(STAR_LABEL_HOLD_S * 1000 + 1);
    });
    expect(container.querySelector('[data-testid="globe-named"]')).toBeNull();
  });

  it('FR-GLOBE-12: a row the list names names its mark on the globe — a star, a planet past the catalogue — and none clears it', () => {
    const { container, rerender, q } = mount();
    const star = centreStar(container);
    rerender({ named: star.index });
    frames.frame();
    expect(q('[data-label]')).toHaveAttribute('visibility', 'visible');
    expect(q('[data-label]').textContent).toBe(`${catalog.name[star.index] || catalog.desig[star.index]} · mag ${formatStarMag(catalog.mag[star.index] ?? 0, 'en')}`);
    expect(q('[data-testid="globe-named"]').textContent).toBe(readoutLine(catalog, { place: BUENOS_AIRES, t: T, lang: 'en' }, { kind: 'star', index: star.index }));
    rerender({ named: catalog.size + 4 });
    frames.frame();
    expect(q('[data-testid="globe-named"]').textContent).toBe(readoutLine(catalog, { place: BUENOS_AIRES, t: T, lang: 'en' }, { kind: 'planet', body: 'Saturn' }));
    rerender({ named: null });
    frames.frame();
    expect(q('[data-label]')).toHaveAttribute('visibility', 'hidden');
    expect(container.querySelector('[data-testid="globe-named"]')).toBeNull();
  });

  it('reads out in Spanish, with the zenith and the pole in Spanish too', () => {
    const { container, box, q } = mount({ language: 'es' });
    expect(q('[data-zenith-name]').textContent).toBe('cenit');
    expect(q('[data-pole-name="south"]').textContent).toBe('PCS');
    const star = centreStar(container);
    fireEvent.pointerMove(box, { pointerId: 3, pointerType: 'mouse', clientX: star.x, clientY: star.y });
    frames.frame();
    expect(q('[data-testid="globe-named"]').textContent).toMatch(/ · mag .* · \d+° de altura · /);
  });
});

describe('the frame and the place (FR-GLOBE-5, FR-GLOBE-9)', () => {
  it('a turn switch keeps the direction at the view’s centre: the picture turns about it and nothing jumps', () => {
    const { container, box, rerender } = mount();
    const star = centreStar(container);
    const fromCentre = (): number => Math.hypot(num(node, 'x') - W / 2, num(node, 'y') - H / 2);
    const node = starNode(container, star.index);
    const before = fromCentre();
    rerender({ turn: 'stars' });
    expect(box).toHaveAttribute('data-turn', 'stars');
    // The centre direction is kept: a star's distance from the centre is what it was (the frame's pole is up, so the picture has rolled).
    expect(fromCentre()).toBeCloseTo(before, 0);
    const rolled = { x: num(node, 'x'), y: num(node, 'y') };
    // With the stars, an hour later the star has not moved; with you, it has.
    rerender({ turn: 'stars', instant: T + 3_600_000 });
    expect(num(node, 'x')).toBeCloseTo(rolled.x, 0);
    expect(num(node, 'y')).toBeCloseTo(rolled.y, 0);
    rerender({ turn: 'you', instant: T + 3_600_000 });
    const back = { x: num(node, 'x'), y: num(node, 'y') };
    rerender({ turn: 'you', instant: T + 7_200_000 });
    expect(Math.hypot(num(node, 'x') - back.x, num(node, 'y') - back.y)).toBeGreaterThan(5);
  });

  it('a switch that comes with a new place converts the centre from the frame last drawn, so nothing jumps', () => {
    const { container, rerender } = mount();
    const star = centreStar(container);
    const node = starNode(container, star.index);
    const before = Math.hypot(num(node, 'x') - W / 2, num(node, 'y') - H / 2);
    rerender({ turn: 'stars', place: LONDON, instant: T + 6 * 3_600_000 });
    expect(Math.hypot(num(node, 'x') - W / 2, num(node, 'y') - H / 2)).toBeCloseTo(before, 0);
  });

  it('a new place re-opens the view while turning with you, and keeps it while turning with the stars', () => {
    const { q, rerender } = mount();
    expect(q('[data-pole="south"]')).toHaveAttribute('visibility', 'visible');
    rerender({ place: LONDON });
    expect(q('[data-pole="north"]')).toHaveAttribute('visibility', 'visible');
    expect(q('[data-pole="south"]')).toHaveAttribute('visibility', 'hidden');
    // With the stars the view is kept: the poles stay where they were drawn.
    rerender({ place: LONDON, turn: 'stars' });
    const north = num(q('[data-pole="north"]'), 'y');
    rerender({ place: BUENOS_AIRES, turn: 'stars' });
    expect(num(q('[data-pole="north"]'), 'y')).toBeCloseTo(north, 1);
  });
});

describe('the faint stars (FR-GLOBE-10)', () => {
  const dotLength = (container: Element): number => [...container.querySelectorAll('[data-dots] path')].reduce((sum, path) => sum + (path.getAttribute('d')?.length ?? 0), 0);

  it('off, no fetch; on, one fetch and the dot paths longer, no new node', async () => {
    vi.mocked(loadDeepChunk).mockResolvedValue(DEEP);
    const { container, rerender } = mount();
    expect(loadDeepChunk).not.toHaveBeenCalled();
    const nodes = container.querySelectorAll('svg *').length;
    const before = dotLength(container);
    rerender({ faint: true });
    expect(loadDeepChunk).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    frames.frame();
    expect(dotLength(container)).toBeGreaterThan(before);
    expect(container.querySelectorAll('svg *').length).toBe(nodes);
    rerender({ faint: false });
    expect(dotLength(container)).toBe(before);
    rerender({ faint: true });
    expect(loadDeepChunk).toHaveBeenCalledTimes(1);
    expect(dotLength(container)).toBeGreaterThan(before);
  });

  it('a load cut short by faint off and on again is asked for again, and a new callback does not re-run it', async () => {
    const resolvers: ((deep: typeof DEEP) => void)[] = [];
    vi.mocked(loadDeepChunk).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { container, rerender } = mount();
    const before = dotLength(container);
    rerender({ faint: true, onFaintFailed: () => undefined });
    rerender({ faint: true, onFaintFailed: () => undefined });
    expect(loadDeepChunk).toHaveBeenCalledTimes(1);
    rerender({ faint: false });
    rerender({ faint: true });
    expect(loadDeepChunk).toHaveBeenCalledTimes(2);
    await act(async () => {
      for (const resolve of resolvers) resolve(DEEP);
      await Promise.resolve();
    });
    frames.frame();
    expect(dotLength(container)).toBeGreaterThan(before);
  });

  it('a failed load tells the page, and the next press fetches again', async () => {
    vi.mocked(loadDeepChunk).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(DEEP);
    const onFaintFailed = vi.fn();
    const { container, rerender } = mount({ onFaintFailed });
    const before = dotLength(container);
    rerender({ faint: true, onFaintFailed });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onFaintFailed).toHaveBeenCalledTimes(1);
    rerender({ faint: false, onFaintFailed });
    rerender({ faint: true, onFaintFailed });
    expect(loadDeepChunk).toHaveBeenCalledTimes(2);
    await act(async () => {
      await Promise.resolve();
    });
    frames.frame();
    expect(dotLength(container)).toBeGreaterThan(before);
  });
});

/** R184 (FR-WIDE-3, FR-WIDE-7, FR-NAME-3; D-1099): three live passes over Buenos Aires's southern sky at `T`. */
function testPass(k: number): Pass {
  const start = T - 60_000 * (k + 1);
  const track: PassPoint[] = Array.from({ length: 37 }, (_, i) => ({ t: start + i * 10_000, azDeg: 110 + 140 * (i / 36) + k * 8, elDeg: 20 + 40 * Math.sin((Math.PI * i) / 36) + k * 6, rangeKm: 900 }));
  return { id: `p${String(k)}`, name: `SAT ${String(k)}`, track, start: track[0], peak: track[18], end: track[36] } as unknown as Pass;
}
const PASSES = [testPass(0), testPass(1), testPass(2)];
const arcPaths = (container: Element): SVGPathElement[] => [...container.querySelectorAll<SVGPathElement>('[data-arc-series]')].filter((path) => (path.getAttribute('d') ?? '') !== '');

describe('the passes (FR-WIDE-3, FR-WIDE-7)', () => {
  it('FR-WIDE-3: three passes draw three arc paths in the legend’s tokens, with their keys, under GLOBE_MAX_NODES', () => {
    const { container } = mount({ passes: PASSES, t: T });
    const paths = arcPaths(container);
    expect(paths).toHaveLength(3);
    const rows = legendRows({ passes: PASSES.map((pass) => ({ ...pass, arc: 'live' as const })), highlightedPassId: null, now: T, colorBy: 'pass' });
    for (const row of rows) {
      const path = paths.find((node) => node.getAttribute('data-pass-ids') === row.passId);
      expect(path?.getAttribute('data-color'), row.passId).toBe(row.colorToken);
      expect(path?.getAttribute('data-state')).toBe('live');
      const key = container.querySelector(`[data-arc-key="${String(path?.getAttribute('data-arc-series'))}"]`);
      expect(key).toHaveAttribute('visibility', 'visible');
      expect(key?.textContent).toBe(row.key);
    }
    expect(container.querySelectorAll('svg *').length + 1).toBeLessThanOrEqual(GLOBE_MAX_NODES);
    // No pass highlighted: no ticks, no arrow, nothing dimmed.
    expect(container.querySelector('[data-arc-ticks]')?.getAttribute('d')).toBe('');
    expect(container.querySelector('[data-arc-arrow]')?.getAttribute('d')).toBe('');
  });

  it('FR-WIDE-7: the highlighted pass carries its ticks and arrow in its colour, the others dimmed', () => {
    const { container } = mount({ passes: PASSES, t: T, highlightedPassId: 'p2' });
    const ticks = container.querySelector('[data-arc-ticks]');
    // Three minutes in: ticks at one and two minutes after the rise; the third minute is the marker's own instant, not past it.
    expect((ticks?.getAttribute('d')?.match(/M/g) ?? []).length).toBe(2);
    expect(ticks).toHaveAttribute('data-color', 'series-3');
    expect(container.querySelector('[data-arc-arrow]')?.getAttribute('d')).toMatch(/Z$/);
    const dims = arcPaths(container).map((path) => [path.getAttribute('data-pass-ids'), path.getAttribute('data-dim')]);
    expect(dims).toEqual([['p0', 'true'], ['p1', 'true'], ['p2', 'false']]);
  });

  it('FR-WIDE-7: tells the page which arc is under the mouse at most once a frame, and null on leaving; a tap on an arc picks it', () => {
    const onPassHover = vi.fn();
    const onPick = vi.fn();
    const { container, box } = mount({ passes: PASSES, t: T, onPassHover, onPick });
    // A point on p1's drawn line: the midpoint of its first segment.
    const d = arcPaths(container)[1]?.getAttribute('d') ?? '';
    const [x1, y1, x2, y2] = (/^M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)/.exec(d) ?? []).slice(1).map(Number) as [number, number, number, number];
    const x = (x1 + x2) / 2;
    const y = (y1 + y2) / 2;
    fireEvent.pointerMove(box, { pointerId: 3, pointerType: 'mouse', clientX: x + 3, clientY: y });
    fireEvent.pointerMove(box, { pointerId: 3, pointerType: 'mouse', clientX: x, clientY: y + 3 });
    expect(onPassHover).not.toHaveBeenCalled();
    frames.frame();
    expect(onPassHover.mock.calls).toEqual([['p1']]);
    fireEvent.pointerMove(box, { pointerId: 3, pointerType: 'mouse', clientX: x, clientY: y + 2 });
    frames.frame();
    expect(onPassHover).toHaveBeenCalledTimes(1);
    fireEvent.pointerLeave(box, { pointerId: 3, pointerType: 'mouse' });
    expect(onPassHover.mock.calls).toEqual([['p1'], [null]]);
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
    fireEvent.pointerUp(box, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y });
    const picked = onPick.mock.calls.at(-1)?.[0] as GlobePick | null;
    // A mark within the hit distance comes first; otherwise the arc.
    if (picked?.kind !== 'pass') expect(picked).not.toBeNull();
    else expect(picked).toEqual({ kind: 'pass', passId: 'p1' });
  });
});

describe('the planets (FR-NAME-3)', () => {
  it('with names off, labels the five planets and no star', () => {
    // London at 01:00 UTC on 2027-04-20: all five planets on the opening view's near side.
    const { container } = mount({ place: LONDON, instant: Date.parse('2027-04-20T01:00:00Z'), layers: { ...LAYERS, names: false } });
    const names = [...container.querySelectorAll('[data-names] text[visibility="visible"]')];
    expect(names.map((node) => node.getAttribute('data-body-name')).sort()).toEqual(['Jupiter', 'Mars', 'Mercury', 'Saturn', 'Venus']);
    expect(container.querySelectorAll('[data-star-name][visibility="visible"]')).toHaveLength(0);
    expect(container.querySelectorAll('circle[data-planet][visibility="visible"]')).toHaveLength(5);
  });
});
