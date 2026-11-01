/**
 * R114 (FR-STAR-6 as amended, FR-DS-8 as amended, FR-STAR-9; US-38 AC5;
 * D-746, D-752, D-753, D-754): the star field drawn by ref in a hand-driven
 * window — the node set made once; per rotation each glyph's `x`, `y` and
 * `visibility` from the projection, the ladder's glyph, size and tone on each
 * node, the collision rule across stars and planets together, the figure
 * lines with their gap at both ends, the short and the buried segments hidden,
 * the sky-side clip and the ground fill switching sides of the horizon's
 * image with the centre of the field, the layer switches, and the ink offsets
 * at 0 in jsdom (the browser project's `inkOffsets.integration.test.ts` has
 * the measured ones).
 */
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import type { Observer } from '../../../../../model';
import { createHandCamera } from './camera';
import { resetOrientationAccess } from './orientationAccess';
import { project, uprightRotation, WINDOW_FOV, type View } from './projection';
import type { StarField as StarFieldData } from './scene';
import { bloomRadiusPx } from './bloom';
import { galacticToEquatorial } from './milkyWay';
import { SkyWindow } from './SkyWindow';
import { COLLISION_PX, dotRadiusPx } from './starGlyphs';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
/** jsdom measures nothing, so the box is the window's `UNMEASURED` square. */
const view: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };

/**
 * Nine stars in magnitude order and three planets, around a hand camera at
 * S 35° up. 0 is at the centre; 1 is 5° above it; 2 and 3 to either side; 4
 * is 0.3° from 0 (about 2 px: collides with it); 5 and 8 are below the
 * horizon; 6 is behind the camera; 7 is 15° under the centre, up and in view.
 * Jupiter is up and alone, Mars sits 0.5° from star 0 and is fainter than it
 * (hidden by the merged walk), Saturn earns the middle size.
 */
const field: StarFieldData = {
  catalog: {
    ra: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    dec: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    mag: [-0.5, 1.0, 2.0, 2.2, 3.0, 4.0, 4.2, 4.4, 4.5],
    name: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    desig: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
    con: ['Ori', 'Ori', 'Ori', 'Ori', 'Ori', 'Ori', 'Ori', 'Ori', 'Ori'],
    figures: [
      {
        con: 'Ori',
        part: '',
        segments: [
          [0, 1], // centre to 5° up: drawn, with the gap
          [0, 4], // 2 px long: shorter than the two gaps, hidden
          [3, 5], // one end below the horizon: drawn, clipped to the sky side
          [5, 8], // both ends below the horizon: hidden
        ],
      },
    ],
  },
  positions: {
    //        0    1    2    3    4      5    6    7      8
    altDeg: [35, 40, 35, 20, 35, -5, 35, 35, -8],
    azDeg: [180, 180, 185, 180, 180.3, 180, 0, 175, 170],
    planets: [
      { body: 'Jupiter', azDeg: 190, altDeg: 40, mag: -2.3 },
      { body: 'Mars', azDeg: 180.5, altDeg: 35, mag: 1.2 },
      { body: 'Saturn', azDeg: 170, altDeg: 45, mag: 0.7 },
    ],
  },
  layers: { stars: true, figures: true, planets: true, names: false },
};

const at = (azDeg: number, altDeg: number, facing = 180, tilt = 35): { x: number; y: number } => {
  const p = project(uprightRotation(facing, tilt), azDeg, altDeg, view);
  return { x: p.x, y: p.y };
};
const star = (container: HTMLElement, i: number): SVGElement => container.querySelector(`[data-marks] > [data-star="${String(i)}"]`) as SVGElement;
const planet = (container: HTMLElement, body: string): SVGTextElement => container.querySelector(`[data-planet="${body}"]`) as SVGTextElement;
const lines = (container: HTMLElement): SVGLineElement[] => [...container.querySelectorAll<SVGLineElement>('[data-figures] > line')];
const num = (el: Element, name: string): number => Number(el.getAttribute(name));
/** R155: a `*` is placed by `x`/`y`, a dot (a `<circle>`) by `cx`/`cy`. */
const pos = (el: Element): { x: number; y: number } => (el.tagName === 'circle' ? { x: num(el, 'cx'), y: num(el, 'cy') } : { x: num(el, 'x'), y: num(el, 'y') });

/** Is the point inside the closed `M … L … Z` polygon? A ray cast to the right (`SkyWindow.test.tsx`'s, R56). */
function encloses(d: string, x: number, y: number): boolean {
  const points = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])] as const);
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i] ?? [0, 0];
    const [xj, yj] = points[j] ?? [0, 0];
    if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
  }
  return inside;
}

const BOX = 'M0 0H390.0V390.0H0Z';
/** A test ring of the galactic plane is sampled every 15° of longitude: coarse enough to read, fine enough that its chords stay inside the band. */
const LONGITUDES = Array.from({ length: 24 }, (_, k) => k * 15);

function mount(layers = field.layers) {
  const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
  const utils = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: { ...field, layers } }} />);
  const box = utils.container.querySelector('[tabindex="0"]') as HTMLElement;
  return { ...utils, camera, box };
}

describe('the star field (FR-STAR-6 as amended, FR-STAR-9; D-752..D-754)', () => {
  beforeEach(() => {
    resetOrientationAccess();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes one node per star, per planet and per segment, in the marks’ glyph or dot, size and tone, the ink shift on each `*`, under the horizon and the rings', () => {
    const { container } = mount();
    const group = container.querySelector('[data-layer="stars"]') as SVGGElement;
    // R127: the landmark's ring (a circle) over the marks, and its name node before the tap's label. R155 (FR-STAR-6 as amended v2.10): the surface, the ground, the band, the haze, the bloom, the figures, the deep pool, the marks, the planets.
    const named = (child: Element): string => ['data-figures', 'data-sky-surface', 'data-horizon-band', 'data-milky-way', 'data-blooms', 'data-deep-pool', 'data-marks', 'data-planet-marks', 'data-names'].find((name) => child.hasAttribute(name))?.slice(5) ?? '';
    expect([...group.children].map((child) => `${child.tagName}${named(child) ? `.${named(child)}` : ''}`)).toEqual(['defs', 'rect.sky-surface', 'path', 'g.horizon-band', 'g.milky-way', 'g.blooms', 'g.figures', 'g.deep-pool', 'g.marks', 'g.planet-marks', 'circle', 'g.names', 'text', 'text']);
    expect(group.compareDocumentPosition(container.querySelector('[data-horizon]') as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // FR-LOOK-4: `*` at 20, 16 and 13 px to V 2.5, a dot of the magnitude's radius below it; FR-LOOK-5: a catalogue with no B−V is white.
    const marks = [...container.querySelectorAll<SVGElement>('[data-marks] > *')];
    expect(marks).toHaveLength(9);
    expect(marks.map((node) => [node.tagName, node.textContent, node.getAttribute('data-px') ?? node.getAttribute('r'), node.getAttribute('data-tone')])).toEqual([
      ['text', '*', '20', 'chart-star'],
      ['text', '*', '16', 'chart-star'],
      ['text', '*', '13', 'chart-star'],
      ['text', '*', '13', 'chart-star'],
      ['circle', '', String(dotRadiusPx(3.0)), 'chart-star'],
      ['circle', '', String(dotRadiusPx(4.0)), 'chart-star'],
      ['circle', '', String(dotRadiusPx(4.2)), 'chart-star'],
      ['circle', '', String(dotRadiusPx(4.4)), 'chart-star'],
      ['circle', '', String(dotRadiusPx(4.5)), 'chart-star'],
    ]);
    for (const node of marks.filter((node) => node.tagName === 'text')) expect(node).toHaveAttribute('font-size', node.getAttribute('data-px') ?? '');
    // A bright-catalogue dot is at full opacity: the fade is the deep pool's.
    for (const node of marks.filter((node) => node.tagName === 'circle')) expect(node).not.toHaveAttribute('fill-opacity');
    const planets = [...container.querySelectorAll<SVGTextElement>('[data-planet-marks] > text')];
    expect(planets.map((node) => [node.getAttribute('data-planet'), node.textContent, node.getAttribute('data-px'), node.getAttribute('data-tone')])).toEqual([
      ['Jupiter', '@', '20', 'chart-planet'],
      ['Mars', '@', '16', 'chart-planet'],
      ['Saturn', '@', '16', 'chart-planet'],
    ]);
    // R122 (D-813): the tone is the shared sheet's, keyed by `data-tone` under the group's class; a mark carries no class of its own.
    expect(container.querySelector('[data-layer="stars"]')?.classList).toHaveLength(2);
    for (const node of [...marks, ...planets]) expect(node.classList).toHaveLength(0);
    for (const node of [...marks.filter((node) => node.tagName === 'text'), ...planets]) {
      // D-752: jsdom has no text metrics, so every ink shift is 0 — written as an attribute all the same, so the measured ones land in the same place.
      expect(node).toHaveAttribute('dx', '0');
      expect(node).toHaveAttribute('dy', '0');
    }
    expect(lines(container)).toHaveLength(4);
    // The figures are clipped to the sky side of the horizon's image, by a clip of this group's own.
    const figures = container.querySelector('[data-figures]') as SVGGElement;
    const clipId = /^url\(#(.+)\)$/.exec(figures.getAttribute('clip-path') ?? '')?.[1];
    expect(clipId).toBeTruthy();
    const clip = container.querySelector(`#${String(clipId)}`) as SVGClipPathElement;
    expect(clip.tagName).toBe('clipPath');
    expect(clip.querySelector('path')).toHaveAttribute('clip-rule', 'evenodd');
    expect(container.querySelector('[data-ground-fill]')).toHaveAttribute('fill-rule', 'evenodd');
  });

  it('places each glyph where the projection puts it, hides the ones below the horizon, behind the camera or outside the box, and the fainter of a close pair', () => {
    const { container } = mount();
    for (const [i, az, alt] of [
      [0, 180, 35],
      [1, 180, 40],
      [2, 185, 35],
      [3, 180, 20],
      [7, 175, 35],
    ] as const) {
      const node = star(container, i);
      const p = at(az, alt);
      expect(node, `star ${String(i)}`).toHaveAttribute('visibility', 'visible');
      expect(pos(node).x, `star ${String(i)} x`).toBeCloseTo(p.x, 1);
      expect(pos(node).y, `star ${String(i)} y`).toBeCloseTo(p.y, 1);
    }
    expect(star(container, 0)).toHaveAttribute('x', '195.0');
    expect(star(container, 0)).toHaveAttribute('y', '195.0');
    // 4 is within half the small size of 0 and fainter: not drawn. 5 and 8 are below the horizon; 6 is behind.
    for (const i of [4, 5, 6, 8]) expect(star(container, i), `star ${String(i)}`).toHaveAttribute('visibility', 'hidden');
    // The planets walk with the stars by magnitude: Mars is 0.5° from star 0 and fainter than it, so the star stays and Mars goes.
    expect(planet(container, 'Mars')).toHaveAttribute('visibility', 'hidden');
    expect(planet(container, 'Jupiter')).toHaveAttribute('visibility', 'visible');
    expect(num(planet(container, 'Jupiter'), 'x')).toBeCloseTo(at(190, 40).x, 1);
    expect(num(planet(container, 'Jupiter'), 'y')).toBeCloseTo(at(190, 40).y, 1);
    expect(planet(container, 'Saturn')).toHaveAttribute('visibility', 'visible');
  });

  it('stops each figure line short of its stars by the collision distance, hides a segment shorter than the two gaps and one with both ends below the horizon, and draws one with one end below', () => {
    const { container } = mount();
    const [toB, toE, toF, buried] = lines(container);
    const b = at(180, 40);
    const gap = COLLISION_PX;
    expect(toB).toHaveAttribute('visibility', 'visible');
    // From the centre (195, 195) straight up to B: each end moves 6 px toward the other.
    expect(num(toB as Element, 'x1')).toBeCloseTo(195, 1);
    expect(num(toB as Element, 'y1')).toBeCloseTo(195 - gap, 1);
    expect(num(toB as Element, 'x2')).toBeCloseTo(b.x, 1);
    expect(num(toB as Element, 'y2')).toBeCloseTo(b.y + gap, 1);
    expect(Math.hypot(b.x - 195, b.y - 195)).toBeGreaterThan(2 * gap);
    expect(toE).toHaveAttribute('visibility', 'hidden');
    expect(toF).toHaveAttribute('visibility', 'visible');
    const d = at(180, 20);
    const f = at(180, -5);
    const length = Math.hypot(f.x - d.x, f.y - d.y);
    expect(num(toF as Element, 'x1')).toBeCloseTo(d.x + ((f.x - d.x) / length) * gap, 1);
    expect(num(toF as Element, 'y1')).toBeCloseTo(d.y + ((f.y - d.y) / length) * gap, 1);
    expect(num(toF as Element, 'y2')).toBeCloseTo(f.y - ((f.y - d.y) / length) * gap, 1);
    expect(buried).toHaveAttribute('visibility', 'hidden');
  });

  it('fills the ground and clips the figures on the right side of the horizon’s image, whichever side of the horizon the centre is on', () => {
    const { container, box } = mount();
    const ground = container.querySelector('[data-ground-fill]') as SVGPathElement;
    const clip = container.querySelector('[data-sky-clip]') as SVGPathElement;
    const wrapper = container.querySelector('[data-look-az]') as Element;
    // At S 35° up the horizon is out of the box (the half-field is 30°): the sky-side clip is the image alone, which encloses the whole box.
    expect(wrapper).toHaveAttribute('data-ground', 'sky');
    expect(clip.getAttribute('d')).toMatch(/^M-?[\d.]+ -?[\d.]+ L/);
    expect(ground.getAttribute('d')?.startsWith(BOX)).toBe(true);
    for (const [x, y] of [
      [0, 0],
      [390, 390],
      [195, 195],
    ] as const)
      expect(encloses(clip.getAttribute('d') ?? '', x, y)).toBe(true);

    // Tilted to 20° up the horizon crosses the lower part of the box: the centre is sky, the bottom edge is ground.
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(wrapper).toHaveAttribute('data-look-alt', '20');
    expect(wrapper).toHaveAttribute('data-ground', 'sky');
    const horizonY = at(180, 0, 180, 20).y;
    expect(horizonY).toBeGreaterThan(195);
    expect(horizonY).toBeLessThan(390);
    const skyClip = clip.getAttribute('d') ?? '';
    expect(skyClip.startsWith(BOX)).toBe(false);
    expect(encloses(skyClip, 195, 195)).toBe(true);
    expect(encloses(skyClip, 195, horizonY + 20)).toBe(false);
    const groundFill = ground.getAttribute('d') ?? '';
    expect(groundFill.startsWith(BOX)).toBe(true);
    // The image inside the ground path is the same closed curve the clip is: against the box with `evenodd`, the bottom is filled and the centre is not.
    expect(groundFill.slice(BOX.length)).toBe(skyClip);

    // Pointed 10° under the horizon (FR-FOL-5's `ground` state) the sides swap: the ground is the inside of the image, the sky is the box less it.
    for (let i = 0; i < 6; i += 1) fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(wrapper).toHaveAttribute('data-look-alt', '-10');
    expect(wrapper).toHaveAttribute('data-ground', 'ground');
    const image = ground.getAttribute('d') ?? '';
    expect(image.startsWith(BOX)).toBe(false);
    expect(encloses(image, 195, 195)).toBe(true);
    expect(encloses(image, 195, 5)).toBe(false);
    expect(clip.getAttribute('d')).toBe(`${BOX}${image}`);
    // And it is the same closed image the window's own hatch is clipped to (F-57's one projection of the horizon, D-754).
    const hatchClip = container.querySelector('clipPath:not([id$="-sky"]) path') as SVGPathElement;
    expect(hatchClip.getAttribute('d')).toBe(image);
    expect(container.querySelector('[data-layer="stars"]')).toHaveAttribute('visibility', 'visible');
  });

  it('rewrites the nodes on each rotation the window draws, without a render', () => {
    const { container, box } = mount();
    const a = star(container, 0);
    const before = { x: a.getAttribute('x'), y: a.getAttribute('y') };
    // Two steps right (15° each): facing 210°. Every star in the upper field is still in the box, moved left by the projection's measure of its azimuth.
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(star(container, 0)).toBe(a);
    const after = at(180, 35, 210, 35);
    expect(num(a, 'x')).toBeCloseTo(after.x, 1);
    expect(num(a, 'y')).toBeCloseTo(after.y, 1);
    expect(a.getAttribute('x')).not.toBe(before.x);
    for (const [i, az] of [
      [0, 180],
      [2, 185],
      [7, 175],
    ] as const) {
      const p = at(az, 35, 210, 35);
      expect(p.x).toBeGreaterThanOrEqual(-9);
      expect(star(container, i), `star ${String(i)}`).toHaveAttribute('visibility', 'visible');
      expect(pos(star(container, i)).x).toBeCloseTo(p.x, 1);
    }
    // Two more: facing 240°. Star 0 is 60° of azimuth off and past the box's left edge, with its margin of half the top size (9 px).
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(at(180, 35, 240, 35).x).toBeLessThan(-9);
    expect(a).toHaveAttribute('visibility', 'hidden');
    expect(star(container, 0)).toBe(a);
  });

  it('hides a layer that is off and keeps its nodes, so a switch is a visibility and not a mount', () => {
    const { container } = mount({ stars: false, figures: false, planets: false, names: false });
    expect(container.querySelector('[data-marks]')).toHaveAttribute('visibility', 'hidden');
    expect(container.querySelector('[data-figures]')).toHaveAttribute('visibility', 'hidden');
    expect(container.querySelector('[data-planet-marks]')).toHaveAttribute('visibility', 'hidden');
    expect(container.querySelectorAll('[data-marks] > *')).toHaveLength(9);
    expect(lines(container)).toHaveLength(4);
    expect(container.querySelectorAll('[data-planet-marks] > text')).toHaveLength(3);
    // The ground still has its floor: the scene carries stars whatever the layers say. R155: so do the surface and the band; the haze and the pool go with the stars.
    expect(container.querySelector('[data-ground-fill]')?.getAttribute('d')).not.toBe('');
    expect(container.querySelector('[data-sky-surface]')).toHaveAttribute('data-tint', 'deep');
    expect(container.querySelector('[data-horizon-band]')).not.toHaveAttribute('display');
    expect(container.querySelector('[data-milky-way]')).toHaveAttribute('display', 'none');
    expect(container.querySelector('[data-deep-pool]')).toHaveAttribute('display', 'none');

    // Planets alone: with no star drawn, Mars no longer has a brighter neighbour and is drawn.
    const alone = mount({ stars: false, figures: false, planets: true, names: false });
    expect(planet(alone.container, 'Mars')).toHaveAttribute('visibility', 'visible');
    expect(alone.container.querySelector('[data-marks]')).toHaveAttribute('visibility', 'hidden');
  });

  it('takes a drawn layer out when it is switched off, though its nodes were written visible', () => {
    const { container, camera, rerender } = mount();
    expect(star(container, 0)).toHaveAttribute('visibility', 'visible');
    expect(planet(container, 'Jupiter')).toHaveAttribute('visibility', 'visible');
    expect(lines(container).some((line) => line.getAttribute('visibility') === 'visible')).toBe(true);
    // In SVG a child's own `visible` beats an inherited `hidden`, so a layer that is off is `display: none`.
    rerender(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: { ...field, layers: { stars: false, figures: false, planets: false, names: false } } }} />);
    for (const layer of ['[data-marks]', '[data-figures]', '[data-planet-marks]']) expect(container.querySelector(layer), layer).toHaveAttribute('display', 'none');
    rerender(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: field }} />);
    for (const layer of ['[data-marks]', '[data-figures]', '[data-planet-marks]']) expect(container.querySelector(layer), layer).not.toHaveAttribute('display');

  });

  /** R155 (FR-LOOK-1, FR-LOOK-2): the surface in the step's tone at the three altitudes, and the band's five strips written per rotation. */
  it('fills the box with the sky surface in the Sun’s step and draws the horizon band in five strips', () => {
    const { container, box } = mount();
    const surface = container.querySelector('[data-sky-surface]') as SVGRectElement;
    expect(surface).toHaveAttribute('width', '390');
    expect(surface).toHaveAttribute('height', '390');
    expect(surface).toHaveAttribute('data-tint', 'deep');
    expect(surface.compareDocumentPosition(container.querySelector('[data-ground-fill]') as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const strips = [...container.querySelectorAll<SVGPathElement>('[data-horizon-band] > path')];
    expect(strips).toHaveLength(5);
    expect(strips.map((node) => node.getAttribute('fill-opacity'))).toEqual(['0.27', '0.21', '0.15', '0.09', '0.03']);
    // At S 35° up the horizon is out of the box, but the rings' closed images are drawn all the same (the SVG clips them).
    for (const strip of strips) expect(strip.getAttribute('d')).toMatch(/^M-?[\d.]+ -?[\d.]+ L/);
    // Tilted to 20° the band is in the lower part of the box, and every strip is rewritten.
    const before = strips.map((node) => node.getAttribute('d'));
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(strips.map((node) => node.getAttribute('d'))).not.toEqual(before);
    expect(encloses((strips[0]?.getAttribute('d') ?? '').split('Z')[0] ?? '', 195, at(180, 1, 180, 20).y)).not.toBe(encloses((strips[0]?.getAttribute('d') ?? '').split('Z')[1] ?? '', 195, at(180, 1, 180, 20).y));

    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const tinted = (sunAltDeg: number) => <SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: { ...field, positions: { ...field.positions, sunAltDeg } } }} />;
    const twilight = render(tinted(-3));
    expect(twilight.container.querySelector('[data-sky-surface]')).toHaveAttribute('data-tint', 'twilight');
    twilight.rerender(tinted(2));
    expect(twilight.container.querySelector('[data-sky-surface]')).toHaveAttribute('data-tint', 'day');
    twilight.rerender(tinted(-6));
    expect(twilight.container.querySelector('[data-sky-surface]')).toHaveAttribute('data-tint', 'deep');
  });

  /** R155 (FR-LOOK-3): the haze's three bands, from the outline the catalogue carries, clipped to the sky side; none without an outline. */
  it('draws the Milky Way’s three bands under the figures and over the surface, clipped to the sky, and none without an outline', () => {
    const { container } = mount();
    expect(container.querySelectorAll('[data-milky-way] > path')).toHaveLength(0);
    // Three rings of the galactic plane, as `milkyWay.json` lays them out (along +b, back along −b), sampled every 15° of longitude.
    const ring = (b: number): number[][] => LONGITUDES.map((l) => galacticToEquatorial(l, b)).concat(LONGITUDES.map((l) => galacticToEquatorial(l, -b)).reverse()).map(({ raDeg, decDeg }) => [raDeg, decDeg]);
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const outline = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: { ...field, catalog: { ...field.catalog, ra: [0, 90, 180, 270, 45, 135, 225, 315, 10], dec: [35, 35, 35, 35, 10, 10, 10, 10, -40], milkyWay: [ring(12), ring(7), ring(3)] } } }} />);
    const haze = outline.container.querySelector('[data-milky-way]') as SVGGElement;
    const paths = [...haze.querySelectorAll<SVGPathElement>('path')];
    expect(paths).toHaveLength(3);
    expect(paths.map((node) => node.getAttribute('fill-opacity'))).toEqual(['0.018', '0.024', '0.03']);
    for (const node of paths) expect(node.getAttribute('d')).toMatch(/^(M0 0H390\.0V390\.0H0Z)?M-?[\d.]+ -?[\d.]+ L/);
    expect(haze.getAttribute('clip-path')).toBe(outline.container.querySelector('[data-figures]')?.getAttribute('clip-path'));
    expect(haze.compareDocumentPosition(outline.container.querySelector('[data-figures]') as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((outline.container.querySelector('[data-sky-surface]') as Element).compareDocumentPosition(haze) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /** R155 (FR-LOOK-6): one bloom per star and planet brighter than BLOOM_MAG, where its mark is drawn and only then. */
  it('blooms the two stars and the planets brighter than 1.8 under the figures, each where its mark is, hidden with it', () => {
    const { container } = mount();
    const blooms = [...container.querySelectorAll<SVGCircleElement>('[data-blooms] > circle')];
    // Stars −0.5 and 1.0; the three planets' nodes, Mars at 1.2 bloomed, Jupiter at −2.3, Saturn at 0.7.
    expect(blooms.map((node) => node.getAttribute('data-bloom'))).toEqual(['0', '1', '9', '10', '11']);
    expect(blooms.map((node) => node.getAttribute('r'))).toEqual([bloomRadiusPx(-0.5), bloomRadiusPx(1), bloomRadiusPx(-2.3), bloomRadiusPx(1.2), bloomRadiusPx(0.7)].map(String));
    for (const node of blooms) expect(node.getAttribute('fill')).toMatch(/^url\(#.+-bloom-chart-(star|planet)\)$/);
    expect(blooms[3]?.getAttribute('fill')).toMatch(/chart-planet\)$/);
    expect(container.querySelectorAll('radialGradient')).toHaveLength(5);
    expect(container.querySelectorAll('[data-bloom-tone] > stop')).toHaveLength(15);
    // Written per rotation beside the marks: star 0 and 1 drawn, Jupiter and Saturn drawn, Mars hidden by the collision walk.
    expect(blooms[0]).toHaveAttribute('visibility', 'visible');
    expect(num(blooms[0] as Element, 'cx')).toBeCloseTo(195, 1);
    expect(blooms[1]).toHaveAttribute('visibility', 'visible');
    expect(num(blooms[1] as Element, 'cy')).toBeCloseTo(at(180, 40).y, 1);
    expect(blooms[2]).toHaveAttribute('visibility', 'visible');
    expect(blooms[3]).toHaveAttribute('visibility', 'hidden');
    expect(blooms[4]).toHaveAttribute('visibility', 'visible');
    const drawn = [...container.querySelectorAll('[data-blooms] > circle[visibility="visible"]')].length;
    expect(drawn).toBe(4);
    const group = container.querySelector('[data-blooms]') as Element;
    expect(group.compareDocumentPosition(container.querySelector('[data-figures]') as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /** R155 (FR-LOOK-9): the pool exists once, hidden until the chunk lands. */
  it('makes the deep pool once, hidden, and none of it carries a star identity', () => {
    const { container } = mount();
    const pool = [...container.querySelectorAll<SVGCircleElement>('[data-deep-pool] > circle')];
    expect(pool).toHaveLength(600);
    for (const node of pool.slice(0, 5)) {
      expect(node).toHaveAttribute('visibility', 'hidden');
      expect(node).not.toHaveAttribute('data-star');
    }
    expect(container.querySelector('[data-layer="stars"]')).toHaveAttribute('data-deep', '0');
    expect(container.querySelectorAll('[data-drawing] [data-star]')).toHaveLength(9);
  });

  it('draws nothing of the field in a window whose scene has no stars (FR-STAR-11)', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: null }} />);
    expect(container.querySelector('[data-layer="stars"]')).toBeNull();
    expect(container.querySelector('[data-ground-fill]')).toBeNull();
    expect(container.querySelector('[data-sky-surface]')).toBeNull();
    expect(container.querySelectorAll('clipPath')).toHaveLength(0);
  });

  /**
   * R155 (FR-LOOK-1, FR-LOOK-3, FR-LOOK-4, FR-LOOK-6, FR-LOOK-7): the window's snapshot — the field's group as drawn
   * for the fixture above at S 35° up with a Milky Way outline and a bright-catalogue B−V column, and the Moon's
   * disc beside it, reviewed in the PR and regenerated deliberately. Class names and the ids are dropped: the
   * sheet's and React's business; this file is about the geometry and the attributes.
   */
  it('draws the look as the committed SVG', async () => {
    const ring = (b: number): number[][] => LONGITUDES.map((l) => galacticToEquatorial(l, b)).concat(LONGITUDES.map((l) => galacticToEquatorial(l, -b)).reverse()).map(({ raDeg, decDeg }) => [raDeg, decDeg]);
    const camera = createHandCamera({ azDeg: 180, altDeg: 20 });
    const scene = { stars: { ...field, catalog: { ...field.catalog, ra: [0, 90, 180, 270, 45, 135, 225, 315, 10], dec: [35, 35, 35, 35, 10, 10, 10, 10, -40], bv: [-0.2, 0.1, 0.6, 1.2, 0.3, 0.5, 0.9, 0.0, 0.7], milkyWay: [ring(12), ring(7), ring(3)] }, positions: { ...field.positions, sunAltDeg: -12 } } };
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={scene} sun={{ t: 0, azDeg: 250, altDeg: -12 }} moon={{ t: 0, phaseAngleDeg: 300, illuminatedFraction: 0.28, phase: 'waningCrescent', azDeg: 200, elDeg: 30, eclipticLonDeg: 0 }} />);
    const group = container.querySelector('[data-layer="stars"]');
    const moon = container.querySelector('[data-body="moon"]');
    if (!group || !moon) throw new Error('no field or no Moon');
    const markup = `${group.outerHTML}\n${moon.outerHTML}`
      .replace(/ class="[^"]*"/g, '')
      .replace(/ id="[^"]*"/g, ' id="…"')
      .replace(/url\(#[^)]*\)/g, 'url(#…)')
      .replace(/></g, '>\n<');
    await expect(markup).toMatchFileSnapshot('./__snapshots__/SkyWindow.stars.svg');
  });
});
