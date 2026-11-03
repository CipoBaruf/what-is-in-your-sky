import { afterEach, describe, expect, it, vi } from 'vitest';
import { starCatalog } from '../../../../../data/stars/catalog';
import { STAR_DOT_MAG } from '../../../../../data/stars/constants';
import { parseDeepCatalog } from '../../../../../data/stars/deepChunk';
import { compassPoint } from '../../../../../lib/compass';
import { degrees } from '../../../../../lib/format';
import { starName } from '../../../../../lib/skyStars';
import type { Observer } from '../../../../../model';
import { formatStarMag } from '../../../../screens/stars/field';
import { GLOBE_DIM_OPACITY, GLOBE_GROUND_OPACITY, GLOBE_MAX_NODES, GLOBE_RADIUS_SHARE } from './constants';
import { DOT_STEPS, GlobeRenderer, type GlobeState } from './GlobeRenderer';
import { openView, project, type Vec3 } from './projection';
import { altAz, globeSky, starVectors, surfaceAt } from './scene';
import styles from './SkyGlobe.module.css';

/**
 * R169 (FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-4, FR-GLOBE-10, FR-GLOBE-11,
 * FR-GLOBE-13; PLAN §9.14, D-1038): the drawing by structure, in jsdom — the
 * node count fixed across the faint toggle and under `GLOBE_MAX_NODES`, a
 * bucket's segments equal to its near-side stars, the dimmed stars present
 * with the dimmed class, a frame's attributes, the deep stars' append, the
 * words in both languages, the hit test and the readout line.
 */

const place = (lat: number, lon: number, timeZone: string | null = null): Observer => ({ lat, lon, altM: 0, label: `${String(lat)}, ${String(lon)}`, source: 'coords', timeZone });
const BUENOS_AIRES = place(-34.6, -58.38, 'America/Argentina/Buenos_Aires');
/** 22:00 at Buenos Aires on 2026-11-03: dark, Orion rising (scene.test.ts's instant). */
const T = Date.parse('2026-11-04T01:00:00Z');
/** The box the wide stars page gives the globe at 1280 × 800, about. */
const W = 1100;
const H = 700;

const catalog = starCatalog();
const dirs = starVectors(catalog);
const starDir = (i: number): Vec3 => [dirs[3 * i] ?? 0, dirs[3 * i + 1] ?? 0, dirs[3 * i + 2] ?? 0];

function stateAt(over: Partial<GlobeState> = {}): GlobeState {
  const sky = globeSky(BUENOS_AIRES, T);
  const view = openView(sky);
  return { place: BUENOS_AIRES, t: T, turn: 'you', lon: view.lon, lat: view.lat, zoom: 1, layers: { stars: true, figures: true, planets: true, names: true }, faint: false, lang: 'en', width: W, height: H, named: null, ...over };
}

/** Sixty deep stars spread over the sphere, 4.6 to 6.5, in the four tones. */
const DEEP = parseDeepCatalog({
  ra: Array.from({ length: 60 }, (_, i) => Math.round(i * 6 * 100)),
  dec: Array.from({ length: 60 }, (_, i) => Math.round((-80 + ((i * 37) % 160)) * 100)),
  mag: Array.from({ length: 60 }, (_, i) => 46 + (i % 20)),
  bv: Array.from({ length: 60 }, (_, i) => -2 + (i % 14)),
});

let made: GlobeRenderer[] = [];
/** The component's shape: an empty `<svg>` in a box, the renderer filling it. */
function mount(over: Partial<GlobeState> = {}): { host: HTMLDivElement; r: GlobeRenderer } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('role', 'img');
  host.appendChild(svg);
  const r = new GlobeRenderer(svg, catalog, stateAt(over));
  r.draw();
  made.push(r);
  return { host, r };
}
afterEach(() => {
  for (const r of made) r.dispose();
  made = [];
  document.body.innerHTML = '';
});

const nodeCount = (r: GlobeRenderer): number => r.svg.querySelectorAll('*').length + 1;
const q = <T extends Element = Element>(r: GlobeRenderer, selector: string): T => {
  const node = r.svg.querySelector<T>(selector);
  if (!node) throw new Error(`no ${selector}`);
  return node;
};
const dotLength = (r: GlobeRenderer): number => [...r.svg.querySelectorAll('[data-dots] path')].reduce((sum, path) => sum + (path.getAttribute('d')?.length ?? 0), 0);
const segments = (d: string): number => (d.match(/M/g) ?? []).length;

describe('the nodes (FR-GLOBE-4, FR-GLOBE-10; D-1038)', () => {
  it('are fixed at mount, under GLOBE_MAX_NODES, and the faint stars add none', () => {
    const { r } = mount();
    const atMount = nodeCount(r);
    expect(atMount).toBeLessThanOrEqual(GLOBE_MAX_NODES);
    expect(atMount).toBeGreaterThan(200);
    const before = dotLength(r);
    r.setDeep(DEEP);
    r.draw();
    // Appended, not drawn: the toggle is off.
    expect(nodeCount(r)).toBe(atMount);
    expect(dotLength(r)).toBe(before);
    r.set({ faint: true });
    r.draw();
    expect(nodeCount(r)).toBe(atMount);
    expect(dotLength(r)).toBeGreaterThan(before);
    expect(r.deepSize).toBe(60);
    // Off again: the bright paths alone, the members kept for the next press.
    r.set({ faint: false });
    r.draw();
    expect(dotLength(r)).toBe(before);
    expect(r.buckets.reduce((n, b) => n + (b.dirs.length - b.bright) / 3, 0)).toBe(60);
  });

  it('has 40 dot paths, 4 tones × 5 sizes × 2 sides, each stroke twice its step', () => {
    const { r } = mount();
    const paths = [...r.svg.querySelectorAll('[data-dots] path')];
    expect(paths).toHaveLength(40);
    expect(r.buckets).toHaveLength(20);
    expect(DOT_STEPS).toEqual([0.6, 1.05, 1.5, 1.95, 2.4]);
    for (const bucket of r.buckets) {
      expect(bucket.above.getAttribute('stroke-width')).toBe(String(bucket.r * 2));
      expect(bucket.below.getAttribute('data-side')).toBe('below');
      expect(bucket.below.getAttribute('opacity')).toBe(String(GLOBE_DIM_OPACITY));
      expect(bucket.below.classList.contains(styles.dim ?? 'dim')).toBe(true);
      expect(bucket.above.hasAttribute('opacity')).toBe(false);
    }
    // Every dot star of the bright catalogue is in one bucket, and no `*` star is.
    const dotStars = Array.from({ length: catalog.size }, (_, i) => i).filter((i) => (catalog.mag[i] ?? 0) > STAR_DOT_MAG).length;
    expect(r.buckets.reduce((n, b) => n + b.bright / 3, 0)).toBe(dotStars);
    expect(r.svg.querySelectorAll('[data-stars] text').length).toBe(catalog.size - dotStars);
  });

  it('a bucket’s segments equal its stars on the near side, split by the horizon', () => {
    const { r } = mount({ faint: true });
    r.setDeep(DEEP);
    r.draw();
    const p = r.projector;
    const sky = r.sky;
    if (!p || !sky) throw new Error('no frame');
    let total = 0;
    for (const bucket of r.buckets) {
      let above = 0;
      let below = 0;
      for (let k = 0; k + 2 < bucket.dirs.length; k += 3) {
        const v: Vec3 = [bucket.dirs[k] ?? 0, bucket.dirs[k + 1] ?? 0, bucket.dirs[k + 2] ?? 0];
        if (project(p, v)[2] <= 0) continue;
        if (altAz(sky, v).altDeg >= 0) above += 1;
        else below += 1;
      }
      expect(segments(bucket.above.getAttribute('d') ?? '')).toBe(above);
      expect(segments(bucket.below.getAttribute('d') ?? '')).toBe(below);
      total += above + below;
    }
    expect(total).toBeGreaterThan(300);
  });

  it('draws no dot and no mark with the stars layer off, and keeps every node', () => {
    const { r } = mount({ layers: { stars: false, figures: true, planets: true, names: true } });
    const count = nodeCount(r);
    expect(dotLength(r)).toBe(0);
    expect(r.svg.querySelectorAll('[data-stars] text[visibility="visible"]')).toHaveLength(0);
    r.set({ layers: { stars: true, figures: true, planets: true, names: true } });
    r.draw();
    expect(nodeCount(r)).toBe(count);
    expect(dotLength(r)).toBeGreaterThan(0);
  });
});

describe('the ground side (FR-GLOBE-3)', () => {
  it('keeps a star below the horizon in the DOM, dimmed by class and opacity; one above is neither', () => {
    const { r } = mount();
    const sky = globeSky(BUENOS_AIRES, T);
    const p = r.projector;
    if (!p) throw new Error('no frame');
    const glyphs = [...r.svg.querySelectorAll<SVGTextElement>('[data-stars] text[visibility="visible"]')];
    const below = glyphs.find((node) => altAz(sky, starDir(Number(node.dataset.star))).altDeg < 0);
    const above = glyphs.find((node) => altAz(sky, starDir(Number(node.dataset.star))).altDeg > 0);
    if (!below || !above) throw new Error('both sides of the horizon are on the near side at the opening view');
    expect(r.svg.contains(below)).toBe(true);
    expect(below.classList.contains(styles.dim ?? 'dim')).toBe(true);
    expect(below.getAttribute('opacity')).toBe(String(GLOBE_DIM_OPACITY));
    expect(above.classList.contains(styles.dim ?? 'dim')).toBe(false);
    expect(above.hasAttribute('opacity')).toBe(false);
    // Where it is drawn is where the projection puts it.
    const [x, y] = project(p, starDir(Number(below.dataset.star)));
    expect(Number(below.getAttribute('x'))).toBeCloseTo(x, 0);
    expect(Number(below.getAttribute('y'))).toBeCloseTo(y, 0);
    // The figure path below the horizon is dimmed the same way and holds segments.
    const figuresBelow = q(r, '[data-figures="below"]');
    expect(figuresBelow.classList.contains(styles.dim ?? 'dim')).toBe(true);
    expect(segments(figuresBelow.getAttribute('d') ?? '')).toBeGreaterThan(0);
    expect(segments(q(r, '[data-figures="above"]').getAttribute('d') ?? '')).toBeGreaterThan(0);
  });

  it('shades the near disc’s ground at GLOBE_GROUND_OPACITY and draws the horizon’s near half', () => {
    const { r } = mount();
    const ground = q(r, '[data-ground]');
    expect(ground.getAttribute('fill-opacity')).toBe(String(GLOBE_GROUND_OPACITY));
    expect(ground.getAttribute('d')).toMatch(/^M.*Z$/);
    expect(q(r, '[data-horizon]').getAttribute('d')).toMatch(/^M/);
  });
});

describe('a frame’s attributes (FR-GLOBE-2, FR-GLOBE-13)', () => {
  it('centres the disc in the box at GLOBE_RADIUS_SHARE of the shorter side times the zoom, tinted by the Sun', () => {
    const { r } = mount();
    const disc = q(r, '[data-disc]');
    expect(disc.getAttribute('cx')).toBe('550.0');
    expect(disc.getAttribute('cy')).toBe('350.0');
    expect(disc.getAttribute('r')).toBe((H * GLOBE_RADIUS_SHARE).toFixed(1));
    expect(disc.getAttribute('data-tint')).toBe(surfaceAt(globeSky(BUENOS_AIRES, T)));
    expect(disc.getAttribute('data-tint')).toBe('deep');
    expect(r.svg.getAttribute('viewBox')).toBe('0 0 1100 700');
    r.set({ zoom: 2, width: 1000, height: 700 });
    r.draw();
    expect(disc.getAttribute('r')).toBe((700 * GLOBE_RADIUS_SHARE * 2).toFixed(1));
    expect(disc.getAttribute('cx')).toBe('500.0');
    // A noon instant: the day surface.
    r.set({ t: Date.parse('2026-11-04T15:00:00Z') });
    r.draw();
    expect(disc.getAttribute('data-tint')).toBe('day');
  });

  it('draws the grid, the ecliptic, the Milky Way and the figures as paths, the figures only with the layer on', () => {
    const { r } = mount();
    expect(segments(q(r, '[data-grid]').getAttribute('d') ?? '')).toBeGreaterThanOrEqual(10);
    expect(q(r, '[data-ecliptic]').getAttribute('d')).toMatch(/^M/);
    expect(q(r, '[data-milky-way]').getAttribute('d')).toMatch(/^M/);
    r.set({ layers: { stars: true, figures: false, planets: true, names: true } });
    r.draw();
    expect(q(r, '[data-figures="above"]').getAttribute('d')).toBe('');
    expect(q(r, '[data-figures="below"]').getAttribute('d')).toBe('');
    expect(r.lines.every((line) => line === null)).toBe(true);
  });

  it('marks the zenith and the visible pole with a `+` and its label; Buenos Aires opens on the south pole', () => {
    const { r } = mount();
    expect(q(r, '[data-zenith]').getAttribute('visibility')).toBe('visible');
    expect(q(r, '[data-zenith-name]').textContent).toBe('zenith');
    expect(q(r, '[data-pole="south"]').getAttribute('visibility')).toBe('visible');
    expect(q(r, '[data-pole-name="south"]').textContent).toBe('SCP');
    expect(q(r, '[data-pole="north"]').getAttribute('visibility')).toBe('hidden');
    // The compass: S stands on the horizon at the near side's centre; N is behind.
    expect(q(r, '[data-compass="S"]').getAttribute('visibility')).toBe('visible');
    expect(q(r, '[data-compass="N"]').getAttribute('visibility')).toBe('hidden');
    const south = q(r, '[data-compass="S"]');
    expect(Number(south.getAttribute('x'))).toBeCloseTo(W / 2, 0);
  });

  it('places the Sun, the Moon with its phase, and the planets as `@` where the sky has them', () => {
    const { r } = mount();
    const sky = globeSky(BUENOS_AIRES, T);
    const p = r.projector;
    if (!p) throw new Error('no frame');
    const sun = q(r, '[data-body="sun"]');
    const [sx, sy, sz] = project(p, sky.sun.dir);
    expect(sun.getAttribute('visibility')).toBe(sz > 0 ? 'visible' : 'hidden');
    if (sz > 0) {
      expect(Number(sun.getAttribute('cx'))).toBeCloseTo(sx, 0);
      expect(Number(sun.getAttribute('cy'))).toBeCloseTo(sy, 0);
    }
    const moon = q(r, '[data-body="moon"]');
    expect(moon.getAttribute('data-phase')).toBe(sky.moon.state.phase);
    expect(moon.getAttribute('data-lit')).toBe(sky.moon.state.illuminatedFraction.toFixed(2));
    expect(q(r, '[data-moon-lit]').getAttribute('d')).toMatch(/^M0/);
    for (const planet of sky.planets) {
      const node = q(r, `[data-planet="${planet.body}"]`);
      const [x, , z] = project(p, planet.dir);
      expect(node.getAttribute('visibility')).toBe(z > 0 ? 'visible' : 'hidden');
      if (z > 0) expect(Number(node.getAttribute('x'))).toBeCloseTo(x, 0);
      expect(node.textContent).toBe('@');
    }
    r.set({ layers: { stars: true, figures: true, planets: false, names: true } });
    r.draw();
    expect(r.svg.querySelectorAll('[data-planet][visibility="visible"]')).toHaveLength(0);
    expect(r.svg.querySelectorAll('[data-body-name][visibility="visible"]').length).toBeLessThanOrEqual(2);
  });
});

describe('the names (FR-GLOBE-11, D-1041)', () => {
  it('draws star names and figure names with the layer on, none with it off, and the bodies’ names as fixed labels', () => {
    const { r } = mount();
    // Thirteen named stars are on the near side at the opening view; D-755's rule (no name over a mark, a line or another name) keeps about eight.
    expect(r.svg.querySelectorAll('[data-star-name][visibility="visible"]').length).toBeGreaterThanOrEqual(7);
    expect(r.svg.querySelectorAll('[data-figure-name][visibility="visible"]').length).toBeGreaterThan(10);
    const bodyNames = [...r.svg.querySelectorAll<SVGTextElement>('[data-body-name][visibility="visible"]')];
    const sky = globeSky(BUENOS_AIRES, T);
    const p = r.projector;
    if (!p) throw new Error('no frame');
    const visiblePlanets = sky.planets.filter((planet) => project(p, planet.dir)[2] > 0).length;
    expect(bodyNames.length).toBeGreaterThanOrEqual(visiblePlanets);
    r.set({ layers: { stars: true, figures: true, planets: true, names: false } });
    r.draw();
    expect(r.svg.querySelectorAll('[data-names] text[visibility="visible"]')).toHaveLength(0);
  });

  it('labels the named star beside its mark, in the second language too, and clears it', () => {
    const { r } = mount();
    const canopus = catalog.name.indexOf('Canopus');
    r.set({ named: { kind: 'star', index: canopus } });
    r.draw();
    const label = q(r, '[data-label]');
    expect(label.getAttribute('visibility')).toBe('visible');
    expect(label.textContent).toBe(`Canopus · mag ${formatStarMag(catalog.mag[canopus] ?? 0, 'en')}`);
    expect(q(r, `[data-star-name="${String(canopus)}"]`).getAttribute('visibility')).toBe('hidden');
    r.set({ lang: 'es' });
    r.draw();
    expect(label.textContent).toBe(`${starName(catalog, canopus, 'es')} · mag ${formatStarMag(catalog.mag[canopus] ?? 0, 'es')}`);
    expect(q(r, '[data-zenith-name]').textContent).toBe('cenit');
    expect(q(r, '[data-pole-name="south"]').textContent).toBe('PCS');
    expect(r.svg.getAttribute('aria-label')).toBe('El globo celeste: arrastrarlo, o usar las flechas del teclado');
    r.set({ named: null });
    r.draw();
    expect(label.getAttribute('visibility')).toBe('hidden');
  });

  it('names what is under a point: a mark within the hit distance, a figure’s line without one, nothing elsewhere', () => {
    const { r } = mount();
    const canopus = catalog.name.indexOf('Canopus');
    const hit = r.hits[canopus];
    if (!hit) throw new Error('Canopus is on the near side at the opening view');
    expect(r.targetAt(hit.x + 3, hit.y - 2)).toEqual({ kind: 'star', index: canopus });
    const sunHit = r.hits[catalog.size + 5];
    if (sunHit) expect(r.targetAt(sunHit.x, sunHit.y)).toEqual({ kind: 'sun' });
    // A long drawn line, tested at its middle, far from any mark.
    const segment = r.lines.findIndex((line, k) => line !== null && Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > 60 && r.hits.every((h) => h === null || Math.hypot(h.x - (line.x1 + line.x2) / 2, h.y - (line.y1 + line.y2) / 2) > 14) && k >= 0);
    const line = r.lines[segment];
    if (!line) throw new Error('no long segment clear of marks');
    const figure = r.targetAt((line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2);
    expect(figure?.kind).toBe('figure');
    if (figure?.kind === 'figure') expect(figure.segment).toBe(segment);
    expect(r.targetAt(1, 1)).toBeNull();
  });

  it('reads the named object out as FR-STAR-7 does, with "below" on the ground side', () => {
    const { r } = mount();
    const sky = globeSky(BUENOS_AIRES, T);
    const canopus = catalog.name.indexOf('Canopus');
    const up = altAz(sky, starDir(canopus));
    expect(up.altDeg).toBeGreaterThan(0);
    expect(r.readoutFor({ kind: 'star', index: canopus })).toBe(`Canopus · mag ${formatStarMag(catalog.mag[canopus] ?? 0, 'en')} · ${degrees(up.altDeg)} up · ${compassPoint(up.azDeg)}`);
    const polaris = catalog.name.indexOf('Polaris');
    const down = altAz(sky, starDir(polaris));
    expect(down.altDeg).toBeLessThan(0);
    expect(r.readoutFor({ kind: 'star', index: polaris })).toBe(`Polaris · mag ${formatStarMag(catalog.mag[polaris] ?? 0, 'en')} · ${degrees(-down.altDeg)} below · ${compassPoint(down.azDeg)}`);
    r.set({ lang: 'es' });
    r.draw();
    expect(r.readoutFor({ kind: 'star', index: polaris })).toBe(`${starName(catalog, polaris, 'es')} · mag ${formatStarMag(catalog.mag[polaris] ?? 0, 'es')} · ${degrees(-down.altDeg)} bajo el horizonte · ${compassPoint(down.azDeg)}`);
    // The Sun carries no magnitude; its line is the same without the `mag` part.
    const sunLine = r.readoutFor({ kind: 'sun' });
    expect(sunLine.startsWith('Sol · ')).toBe(true);
    expect(sunLine).not.toContain('mag');
    expect(sunLine).toContain(sky.sun.altDeg >= 0 ? 'de altura' : 'bajo el horizonte');
    // A figure's is its name.
    const orion = catalog.figures.findIndex((f) => f.con === 'Ori');
    expect(r.readoutFor({ kind: 'figure', index: orion, segment: 0 })).toBe('Orión');
    expect(r.labelFor({ kind: 'moon' })).toBe('Luna');
  });

  it('reads the Sun and the Moon out by their own sentence, with no magnitude, in both languages', () => {
    const { r } = mount();
    const sky = globeSky(BUENOS_AIRES, T);
    const line = (alt: number, az: number, name: string, up: string, below: string): string => `${name} · ${degrees(Math.abs(alt))} ${alt >= 0 ? up : below} · ${compassPoint(az)}`;
    expect(r.readoutFor({ kind: 'sun' })).toBe(line(sky.sun.altDeg, sky.sun.azDeg, 'Sun', 'up', 'below'));
    expect(r.readoutFor({ kind: 'moon' })).toBe(line(sky.moon.altDeg, sky.moon.azDeg, 'Moon', 'up', 'below'));
    r.set({ lang: 'es' });
    expect(r.readoutFor({ kind: 'moon' })).toBe(line(sky.moon.altDeg, sky.moon.azDeg, 'Luna', 'de altura', 'bajo el horizonte'));
  });

  it('dims a named figure’s label by the side its line is drawn on, the segment’s midpoint, not by its ends', () => {
    const { r } = mount({ layers: { stars: true, figures: true, planets: true, names: false } });
    const sky = globeSky(BUENOS_AIRES, T);
    const ends: { a: number; b: number; figure: number }[] = [];
    catalog.figures.forEach((figure, f) => {
      for (let k = 0; k + 1 < figure.segments.length; k += 2) ends.push({ a: figure.segments[k] ?? 0, b: figure.segments[k + 1] ?? 0, figure: f });
    });
    const height = (i: number): number => starDir(i).reduce((sum, v, k) => sum + v * (sky.zenith[k] ?? 0), 0);
    // A drawn segment across the horizon with its midpoint on the ground side: one end up, so "both ends below" says up.
    const k = ends.findIndex((seg, j) => r.lines[j] !== null && (height(seg.a) >= 0) !== (height(seg.b) >= 0) && height(seg.a) + height(seg.b) < 0);
    const seg = ends[k];
    if (!seg) throw new Error('no drawn segment across the horizon with its midpoint below');
    r.set({ named: { kind: 'figure', index: seg.figure, segment: k } });
    r.draw();
    const label = q(r, '[data-label]');
    expect(label).toHaveAttribute('visibility', 'visible');
    expect(label.classList.contains(styles.dim ?? 'dim')).toBe(true);
    expect(label).toHaveAttribute('opacity', String(GLOBE_DIM_OPACITY));
  });
});

describe('frames (D-1038)', () => {
  it('schedules the first frame itself, so a set that repeats the opening state still draws', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const r = new GlobeRenderer(svg, catalog, stateAt());
    made.push(r);
    expect(raf).toHaveBeenCalledTimes(1);
    expect(r.set({ width: W, height: H })).toBe(false);
    expect(raf).toHaveBeenCalledTimes(1);
    const first = raf.mock.calls[0]?.[0];
    first?.(16);
    expect(r.frames).toBe(1);
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${String(W)} ${String(H)}`);
    raf.mockRestore();
  });

  it('schedules one frame for a change and none for a set that changes nothing', () => {
    let pending: FrameRequestCallback | null = null;
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pending = callback;
      return 1;
    });
    const { r } = mount();
    // The constructor's own first frame, run, so the next request is a new one.
    (pending as FrameRequestCallback | null)?.(16);
    raf.mockClear();
    const same = stateAt();
    expect(r.set({ lon: same.lon, lat: same.lat, zoom: 1, layers: { ...same.layers }, place: { ...BUENOS_AIRES }, named: null })).toBe(false);
    expect(raf).not.toHaveBeenCalled();
    expect(r.set({ lon: same.lon + 1 })).toBe(true);
    expect(r.set({ zoom: 1.25 })).toBe(true);
    expect(raf).toHaveBeenCalledTimes(1);
    raf.mockRestore();
  });

  it('counts its frames, and dispose drops the pending frame and empties the SVG, which stays the caller’s', () => {
    const { host, r } = mount();
    expect(r.frames).toBe(1);
    expect(r.svg.namespaceURI).toBe(r.svg.firstElementChild?.namespaceURI);
    r.draw();
    expect(r.frames).toBe(2);
    r.set({ zoom: 2 });
    r.dispose();
    expect(host.querySelector('svg')).toBe(r.svg);
    expect(r.svg.childElementCount).toBe(0);
    expect(r.svg.hasAttribute('aria-label')).toBe(false);
  });
});
