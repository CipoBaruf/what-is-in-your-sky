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
import { SkyWindow } from './SkyWindow';
import { COLLISION_PX } from './starGlyphs';

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
const star = (container: HTMLElement, i: number): SVGTextElement => container.querySelector(`[data-star="${String(i)}"]`) as SVGTextElement;
const planet = (container: HTMLElement, body: string): SVGTextElement => container.querySelector(`[data-planet="${body}"]`) as SVGTextElement;
const lines = (container: HTMLElement): SVGLineElement[] => [...container.querySelectorAll<SVGLineElement>('[data-figures] > line')];
const num = (el: Element, name: string): number => Number(el.getAttribute(name));

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

  it('makes one node per star, per planet and per segment, in the ladder’s glyph, size and tone, the ink shift on each, under the horizon and the rings', () => {
    const { container } = mount();
    const group = container.querySelector('[data-layer="stars"]') as SVGGElement;
    // R127: the landmark's ring (a circle) over the marks, and its name node before the tap's label.
    expect([...group.children].map((child) => `${child.tagName}${child.getAttribute('data-figures') !== null ? '.figures' : ''}`)).toEqual(['defs', 'path', 'g.figures', 'g', 'g', 'circle', 'g', 'text', 'text']);
    expect(group.compareDocumentPosition(container.querySelector('[data-horizon]') as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const marks = [...container.querySelectorAll<SVGTextElement>('[data-marks] > text')];
    expect(marks).toHaveLength(9);
    expect(marks.map((node) => [node.textContent, node.getAttribute('data-size'), node.getAttribute('data-tone')])).toEqual([
      ['*', 'chart-text-18', 'chart-star'],
      ['*', 'chart-text-15', 'chart-star'],
      ['+', 'chart-text-12', 'chart-star'],
      ['+', 'chart-text-12', 'chart-star'],
      ['.', 'chart-text-12', 'chart-star-dim'],
      ['.', 'chart-text-12', 'chart-star-faint'],
      ['.', 'chart-text-12', 'chart-star-faint'],
      ['.', 'chart-text-12', 'chart-star-faint'],
      ['.', 'chart-text-12', 'chart-star-faint'],
    ]);
    const planets = [...container.querySelectorAll<SVGTextElement>('[data-planet-marks] > text')];
    expect(planets.map((node) => [node.getAttribute('data-planet'), node.textContent, node.getAttribute('data-size'), node.getAttribute('data-tone')])).toEqual([
      ['Jupiter', '@', 'chart-text-18', 'chart-planet'],
      ['Mars', '@', 'chart-text-15', 'chart-planet'],
      ['Saturn', '@', 'chart-text-15', 'chart-planet'],
    ]);
    // R122 (D-813): the size and the tone are the shared sheet's, keyed by `data-size` and `data-tone` under the group's class; a glyph carries no class of its own.
    expect(container.querySelector('[data-layer="stars"]')?.classList).toHaveLength(2);
    for (const node of [...marks, ...planets]) {
      expect(node.classList).toHaveLength(0);
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
      expect(num(node, 'x'), `star ${String(i)} x`).toBeCloseTo(p.x, 1);
      expect(num(node, 'y'), `star ${String(i)} y`).toBeCloseTo(p.y, 1);
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
      expect(num(star(container, i), 'x')).toBeCloseTo(p.x, 1);
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
    expect(container.querySelectorAll('[data-marks] > text')).toHaveLength(9);
    expect(lines(container)).toHaveLength(4);
    expect(container.querySelectorAll('[data-planet-marks] > text')).toHaveLength(3);
    // The ground still has its floor: the scene carries stars whatever the layers say.
    expect(container.querySelector('[data-ground-fill]')?.getAttribute('d')).not.toBe('');

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

  it('draws nothing of the field in a window whose scene has no stars (FR-STAR-11)', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={{ stars: null }} />);
    expect(container.querySelector('[data-layer="stars"]')).toBeNull();
    expect(container.querySelector('[data-ground-fill]')).toBeNull();
    expect(container.querySelectorAll('clipPath')).toHaveLength(0);
  });
});
