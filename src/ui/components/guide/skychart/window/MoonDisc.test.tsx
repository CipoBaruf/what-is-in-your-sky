/**
 * R155 (FR-LOOK-7; D-974): the Moon's disc at four phases and two limb
 * angles — the lit path from the fraction, turned to the Sun's side on the
 * drawing — with the window's marker attributes kept.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOON_FIXTURE } from '../../../../../../tests/support/moonFixtures';
import { MOON_DISC_PX } from '../../../../../data/stars/constants';
import { brightLimbPoint } from '../useSkyBodies';
import { limbAngleDeg, litPath, MoonDisc } from './MoonDisc';
import { project, uprightRotation, WINDOW_FOV, type View } from './projection';

const view: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };
const m = uprightRotation(180, 35);

describe('litPath (FR-LOOK-7)', () => {
  it('is the whole disc when full, half when half, a crescent bulging toward the Sun under half and a gibbous away from it', () => {
    expect(litPath(1, 5)).toBe('M0 -5.00A5.00 5.00 0 0 1 0 5.00A5.00 5.00 0 0 1 0 -5.00Z');
    expect(litPath(0.5, 5)).toBe('M0 -5.00A5.00 5.00 0 0 1 0 5.00A0.00 5.00 0 0 1 0 -5.00Z');
    // 28 % lit: the terminator is a half-ellipse 2.2 wide bulging toward +x, the Sun's side (sweep 0).
    expect(litPath(0.28, 5)).toBe('M0 -5.00A5.00 5.00 0 0 1 0 5.00A2.20 5.00 0 0 0 0 -5.00Z');
    // 72 % lit: the same width bulging away (sweep 1).
    expect(litPath(0.72, 5)).toBe('M0 -5.00A5.00 5.00 0 0 1 0 5.00A2.20 5.00 0 0 1 0 -5.00Z');
    expect(litPath(0, 5)).toBe('M0 -5.00A5.00 5.00 0 0 1 0 5.00A5.00 5.00 0 0 0 0 -5.00Z');
    expect(litPath(1.4, 5)).toBe(litPath(1, 5));
  });

  it('reads the limb’s direction on the drawing, clockwise from +x', () => {
    expect(limbAngleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(limbAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);
    expect(limbAngleDeg({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe(180);
    expect(limbAngleDeg({ x: 5, y: 5 }, { x: 5, y: -5 })).toBe(-90);
  });
});

describe('MoonDisc', () => {
  const moon = { ...MOON_FIXTURE, azDeg: 180, elDeg: 35 };

  it('draws the dark disc with the marker and the lit path turned to the Sun’s side: right of the Moon, then below it', () => {
    const { container } = render(
      <svg>
        <MoonDisc moon={{ ...moon, illuminatedFraction: 0.28, phase: 'waningCrescent' }} limb={{ azDeg: 181, elDeg: 35 }} m={m} view={view} />
      </svg>,
    );
    const group = container.querySelector('[data-body="moon"]');
    expect(group).toHaveAttribute('data-phase', 'waningCrescent');
    expect(group).toHaveAttribute('data-lit', '0.28');
    expect(group).toHaveAttribute('data-in-view', 'true');
    const at = project(m, 180, 35, view);
    expect(group).toHaveAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
    const disc = container.querySelector('[data-marker="moon"]');
    expect(disc).toHaveAttribute('r', String(MOON_DISC_PX / 2));
    const lit = container.querySelector('[data-moon-lit]');
    expect(lit).toHaveAttribute('d', litPath(0.28, MOON_DISC_PX / 2));
    // A degree toward the west of a Moon due south is to the right on the drawing: the limb points along +x.
    expect(group).toHaveAttribute('data-limb', '0');
    expect(lit?.getAttribute('transform')).toMatch(/^rotate\(-?0\.\d\)$/);

    const below = render(
      <svg>
        <MoonDisc moon={moon} limb={{ azDeg: 180, elDeg: 34 }} m={m} view={view} />
      </svg>,
    );
    expect(below.container.querySelector('[data-body="moon"]')).toHaveAttribute('data-limb', '90');
    expect(below.container.querySelector('[data-moon-lit]')).toHaveAttribute('transform', 'rotate(90.0)');
  });

  it('turns to the east as the Sun does', () => {
    const { container } = render(
      <svg>
        <MoonDisc moon={moon} limb={brightLimbPoint({ azDeg: 180, elDeg: 35 }, { azDeg: 90, altDeg: -10 })} m={m} view={view} />
      </svg>,
    );
    const limb = Number(container.querySelector('[data-body="moon"]')?.getAttribute('data-limb'));
    // East is to the left facing south and the Sun is lower: between 90° and 180°, well past the horizontal.
    expect(limb).toBeGreaterThan(135);
    expect(limb).toBeLessThan(180);
  });

  it('faces up without a Sun, and is hidden out of the box', () => {
    const { container } = render(
      <svg>
        <MoonDisc moon={{ ...moon, azDeg: 90 }} limb={null} m={m} view={view} />
      </svg>,
    );
    const group = container.querySelector('[data-body="moon"]');
    expect(group).toHaveAttribute('data-limb', '-90');
    expect(group).toHaveAttribute('data-in-view', 'false');
    expect(group).toHaveAttribute('visibility', 'hidden');
  });
});

/** R155 (FR-LOOK-7, D-974): the bright limb's point, a degree from the Moon toward the Sun (`useSkyBodies.ts`). */
describe('brightLimbPoint', () => {
  it('is a degree from the Moon along the great circle toward the Sun', () => {
    const below = brightLimbPoint({ azDeg: 180, elDeg: 30 }, { azDeg: 180, altDeg: -10 });
    expect(below?.azDeg).toBeCloseTo(180, 6);
    expect(below?.elDeg).toBeCloseTo(29, 6);
    const west = brightLimbPoint({ azDeg: 180, elDeg: 0 }, { azDeg: 270, altDeg: 0 });
    expect(west?.azDeg).toBeCloseTo(181, 6);
    expect(west?.elDeg).toBeCloseTo(0, 6);
    const high = brightLimbPoint({ azDeg: 90, elDeg: 89 }, { azDeg: 270, altDeg: -45 });
    expect(high?.elDeg).toBeCloseTo(90, 6);
  });

  it('is null when the Sun is at the Moon or opposite it', () => {
    expect(brightLimbPoint({ azDeg: 180, elDeg: 30 }, { azDeg: 180, altDeg: 30 })).toBeNull();
    expect(brightLimbPoint({ azDeg: 180, elDeg: 30 }, { azDeg: 0, altDeg: -30 })).toBeNull();
  });
});
