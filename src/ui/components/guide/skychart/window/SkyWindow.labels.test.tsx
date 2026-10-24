/**
 * R116 (FR-STAR-6 as amended, FR-STAR-7; US-38 AC4, US-39 AC2; D-751, D-755):
 * the names and the tap in a hand-driven window — the name nodes made once and
 * written by ref, a figure's spaced name, the tap that names a mark and the
 * second tap or the tap on nothing that clears it, the hover on a desk, the
 * label beside the mark and the readout's second line, and the placement held
 * while the rotation has not moved past `converged()`.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Observer } from '../../../../../model';
import { createHandCamera } from './camera';
import { resetOrientationAccess } from './orientationAccess';
import { project, uprightRotation, WINDOW_FOV, type View } from './projection';
import type { StarField as StarFieldData } from './scene';
import { SkyWindow } from './SkyWindow';

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const view: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };

/**
 * Four stars around a hand camera at S 35° up, and Jupiter: 0 (Canopus-like,
 * named) at the centre, 1 named and 6° up, 2 with no proper name 6° to the
 * east, 3 faint, 6° to the west. The figure joins 0–2 and 0–3, so it has two
 * drawn segments and is named.
 */
const field: StarFieldData = {
  catalog: {
    ra: [0, 0, 0, 0],
    dec: [0, 0, 0, 0],
    mag: [-0.7, 1.2, 2.0, 3.0],
    name: ['Canopus', 'Bravo', '', ''],
    desig: ['α Car', 'β Car', 'ε Car', 'ι Car'],
    con: ['Car', 'Car', 'Car', 'Car'],
    figures: [{ con: 'Car', part: '', segments: [[0, 2], [0, 3]] }],
  },
  positions: { altDeg: [35, 41, 35, 35], azDeg: [180, 180, 172, 188], planets: [{ body: 'Jupiter', azDeg: 180, altDeg: 47, mag: -2.3 }] },
  layers: { stars: true, figures: true, planets: true, names: true },
};

const at = (azDeg: number, altDeg: number, facing = 180, tilt = 35): { x: number; y: number } => {
  const p = project(uprightRotation(facing, tilt), azDeg, altDeg, view);
  return { x: p.x, y: p.y };
};

function mount(namedStar: number | null = null, onNameStar = vi.fn<(i: number | null) => void>(), layers = field.layers) {
  const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
  const ui = (named: number | null) => <SkyWindow passes={[]} observer={observer} highlightedPassId={null} camera={camera} scene={{ stars: { ...field, layers } }} namedStar={named} onNameStar={onNameStar} />;
  const utils = render(ui(namedStar));
  const box = utils.container.querySelector('[tabindex="0"]') as HTMLElement;
  const q = (selector: string): SVGTextElement => utils.container.querySelector(selector) as SVGTextElement;
  return { ...utils, camera, box, onNameStar, q, rename: (named: number | null) => utils.rerender(ui(named)) };
}

const tap = (box: HTMLElement, p: { x: number; y: number }, pointerId = 1): void => {
  fireEvent.pointerDown(box, { button: 0, pointerId, clientX: p.x, clientY: p.y });
  fireEvent.pointerUp(box, { button: 0, pointerId, clientX: p.x, clientY: p.y });
};

describe('the names (FR-STAR-6 as amended, D-755)', () => {
  beforeEach(() => {
    resetOrientationAccess();
  });

  it('makes one name node per star of V ≤ 1.5 with a proper name and one per figure, and writes them by ref', () => {
    const { container, q } = mount();
    expect([...container.querySelectorAll('[data-star-name]')].map((n) => n.textContent)).toEqual(['Canopus', 'Bravo']);
    expect(container.querySelectorAll('[data-figure-name]')).toHaveLength(1);
    // Bravo's name to the right of its mark, the first free place, and not on it.
    const bravo = q('[data-star-name="1"]');
    expect(bravo).toHaveAttribute('visibility', 'visible');
    expect(Number(bravo.getAttribute('x'))).toBeGreaterThan(at(180, 41).x);
    expect(Number(bravo.getAttribute('y'))).toBeCloseTo(at(180, 41).y, 0);
    // The figure keeps its name: its lines take the centroid's row, the row above was Canopus's name, and the name gave way.
    const figure = q('[data-figure-name="0"]');
    expect(figure).toHaveTextContent('C A R I N A');
    expect(figure).toHaveAttribute('visibility', 'visible');
    expect(Number(figure.getAttribute('y'))).toBeLessThan(at(180, 35).y);
    expect(q('[data-star-name="0"]')).toHaveAttribute('visibility', 'hidden');
  });

  it('draws no star or figure name with the names layer off, and still draws a named mark’s label', () => {
    const { container, q } = mount(0, undefined, { ...field.layers, names: false });
    expect(container.querySelector('[data-names]')).toHaveAttribute('display', 'none');
    expect(q('[data-star-label]')).toHaveAttribute('visibility', 'visible');
  });
});

describe('the tap, the hover and the readout (FR-STAR-7)', () => {
  beforeEach(() => {
    resetOrientationAccess();
  });

  it('a tap on a mark names it; a tap on nothing clears it; a second tap on the named mark clears it', () => {
    const { box, onNameStar, rename } = mount();
    tap(box, at(180, 35));
    expect(onNameStar).toHaveBeenLastCalledWith(0);
    // Jupiter is past the catalogue: index 4.
    tap(box, at(180, 47));
    expect(onNameStar).toHaveBeenLastCalledWith(4);
    tap(box, { x: 5, y: 5 });
    expect(onNameStar).toHaveBeenLastCalledWith(null);
    rename(0);
    tap(box, at(180, 35));
    expect(onNameStar).toHaveBeenLastCalledWith(null);
  });

  it('a press that travels is a drag, not a tap', () => {
    const { box, onNameStar } = mount();
    const p = at(180, 35);
    fireEvent.pointerDown(box, { button: 0, pointerId: 2, clientX: p.x, clientY: p.y });
    fireEvent.pointerMove(box, { pointerId: 2, clientX: p.x + 40, clientY: p.y });
    fireEvent.pointerUp(box, { button: 0, pointerId: 2, clientX: p.x + 40, clientY: p.y });
    expect(onNameStar).not.toHaveBeenCalled();
  });

  it('labels the named mark beside it, a designation where there is no proper name, and puts it on the readout’s second line', () => {
    const { q, getByTestId, rename } = mount(0);
    const label = q('[data-star-label]');
    expect(label).toHaveTextContent('Canopus · mag −0.7');
    expect(label).toHaveAttribute('visibility', 'visible');
    expect(Number(label.getAttribute('x'))).toBeGreaterThan(at(180, 35).x);
    // The named star's own name is not drawn twice.
    expect(q('[data-star-name="0"]')).toHaveAttribute('visibility', 'hidden');
    expect(getByTestId('window-named')).toHaveTextContent('Canopus · mag −0.7 · 35° up · S');
    rename(2);
    expect(q('[data-star-label]')).toHaveTextContent('ε Car · mag 2.0');
    expect(getByTestId('window-named')).toHaveTextContent(/^ε Car · mag 2\.0 · 35° up · S$/);
    rename(4);
    expect(q('[data-star-label]')).toHaveTextContent('Jupiter · mag −2.3');
    rename(null);
    expect(q('[data-star-label]')).toHaveAttribute('visibility', 'hidden');
    expect(() => getByTestId('window-named')).toThrow();
  });

  it('on a desk the hover shows the label while the pointer is over the mark', () => {
    const { box, q } = mount();
    const p = at(180, 41);
    fireEvent.pointerMove(box, { pointerType: 'mouse', pointerId: 1, clientX: p.x, clientY: p.y });
    expect(q('[data-star-label]')).toHaveTextContent('Bravo · mag 1.2');
    expect(q('[data-star-label]')).toHaveAttribute('visibility', 'visible');
    fireEvent.pointerLeave(box, { pointerType: 'mouse', pointerId: 1 });
    expect(q('[data-star-label]')).toHaveAttribute('visibility', 'hidden');
  });
});

describe('the placement and the rotation (D-751)', () => {
  beforeEach(() => {
    resetOrientationAccess();
  });

  it('places the names again only once the rotation has moved past converged()', () => {
    const { camera, q } = mount();
    const name = q('[data-star-name="1"]');
    const before = Number(name.getAttribute('x'));
    const mark = q('[data-star="0"]');
    // A hundredth of a degree: the marks move, the names stay where they were placed.
    act(() => {
      camera.dragTo(-0.04, 0); // the dome's 4 px a degree
    });
    expect(Number(mark.getAttribute('x'))).not.toBe(at(180, 35).x);
    expect(Number(name.getAttribute('x'))).toBe(before);
    // Two degrees: they are placed again, with the field.
    act(() => {
      camera.dragTo(-8, 0);
    });
    expect(Number(name.getAttribute('x'))).not.toBe(before);
  });
});
