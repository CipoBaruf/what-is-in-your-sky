/**
 * R155 (FR-LOOK-1, FR-LOOK-2; D-974): the tint step at the three altitudes
 * and the band's strips — five, fading from `HORIZON_STRENGTH` × 0.5 at the
 * horizon, each the region between two altitude rings' images, flipped
 * against the box where the antipode of the look direction falls inside it.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../../../../physics/constants';
import { HORIZON_BAND_DEG, HORIZON_STRENGTH } from '../../../../../data/stars/constants';
import { project, uprightRotation, WINDOW_FOV, type View } from './projection';
import { BAND_ALPHA_AT_HORIZON, HORIZON_BAND_STEPS, horizonBand, stripOpacity, SURFACE_TOKENS, tintStep, TWILIGHT_SUN_DEG } from './skySurface';

const view: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };

/** Is the point inside the path under `evenodd`? Each `M…Z` subpath is a polygon; the parity over all of them is the fill. */
function filled(d: string, x: number, y: number): boolean {
  let inside = false;
  for (const sub of d.split('Z').filter((part) => part.trim() !== '')) {
    const points = [...sub.matchAll(/[MLHV]?(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    const box = /^M0 0H([\d.]+)V([\d.]+)H0$/.exec(sub.trim());
    const polygon = box ? ([[0, 0], [Number(box[1]), 0], [Number(box[1]), Number(box[2])], [0, Number(box[2])]] as const) : points;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const [xi, yi] = polygon[i] ?? [0, 0];
      const [xj, yj] = polygon[j] ?? [0, 0];
      if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
    }
  }
  return inside;
}

describe('the tint step (FR-LOOK-2)', () => {
  it('is day above 0°, twilight to −6°, deep at and below it, and deep with no Sun', () => {
    expect(tintStep(10)).toBe('day');
    expect(tintStep(0.01)).toBe('day');
    expect(tintStep(0)).toBe('twilight');
    expect(tintStep(-3)).toBe('twilight');
    expect(tintStep(-5.99)).toBe('twilight');
    expect(tintStep(-6)).toBe('deep');
    expect(tintStep(-18)).toBe('deep');
    expect(tintStep(undefined)).toBe('deep');
    expect(tintStep(Number.NaN)).toBe('deep');
  });

  it('draws the twilight line where FR-STAR-13 draws every rung, and names a surface token per step', () => {
    expect(TWILIGHT_SUN_DEG).toBe(DEFAULT_THRESHOLDS.sunAltMaxDeg);
    expect(SURFACE_TOKENS).toEqual({ day: 'chart-sky-day', twilight: 'chart-sky-twilight', deep: 'chart-sky-deep' });
  });
});

describe('the horizon band (FR-LOOK-1)', () => {
  it('is five strips over 15° of altitude, the lowest at HORIZON_STRENGTH × 0.5 and fading to nothing', () => {
    expect(HORIZON_BAND_STEPS).toBe(5);
    expect(HORIZON_BAND_DEG).toBe(15);
    expect(BAND_ALPHA_AT_HORIZON).toBe(HORIZON_STRENGTH * 0.5);
    const strips = horizonBand(uprightRotation(180, 20), view);
    expect(strips).toHaveLength(5);
    expect(strips.map((s) => s.opacity)).toEqual([0, 1, 2, 3, 4].map(stripOpacity));
    expect(strips[0]?.opacity).toBe(0.27);
    expect(strips[4]?.opacity).toBe(0.03);
    for (let k = 1; k < strips.length; k += 1) expect(strips[k]?.opacity).toBeLessThan(strips[k - 1]?.opacity ?? 0);
  });

  it('fills each strip between its two rings’ images and nothing above the band, with the horizon in the box', () => {
    const m = uprightRotation(180, 20);
    const strips = horizonBand(m, view);
    const at = (alt: number): { x: number; y: number } => {
      const p = project(m, 180, alt, view);
      return { x: p.x, y: p.y };
    };
    // Every strip is two closed images and no box: the antipode (at −20°) is under the horizon.
    for (const strip of strips) {
      expect(strip.d.startsWith('M0 0H')).toBe(false);
      expect(strip.d.split('Z').filter((part) => part.trim() !== '')).toHaveLength(2);
    }
    const p1 = at(1.5);
    const p10 = at(10.5);
    const p20 = at(20);
    const below = at(-2);
    expect(filled(strips[0]?.d ?? '', p1.x, p1.y)).toBe(true);
    expect(filled(strips[0]?.d ?? '', p10.x, p10.y)).toBe(false);
    expect(filled(strips[3]?.d ?? '', p10.x, p10.y)).toBe(true);
    expect(filled(strips[3]?.d ?? '', p1.x, p1.y)).toBe(false);
    for (const strip of strips) {
      expect(filled(strip.d, p20.x, p20.y)).toBe(false);
      expect(filled(strip.d, below.x, below.y)).toBe(false);
    }
  });

  it('draws the strip the antipode falls in against the box, so its fill is still the region between the rings', () => {
    // Pointed 10° under the horizon (FR-FOL-5's ground state): the antipode is at +10°, inside the fourth strip (9°–12°).
    const m = uprightRotation(180, -10);
    const strips = horizonBand(m, view);
    expect(strips.map((s) => s.d.startsWith('M0 0H390.0V390.0H0Z'))).toEqual([false, false, false, true, false]);
    const p10 = project(m, 180, 10.5, view);
    const p7 = project(m, 180, 7.5, view);
    expect(filled(strips[3]?.d ?? '', p10.x, p10.y)).toBe(true);
    expect(filled(strips[3]?.d ?? '', p7.x, p7.y)).toBe(false);
    expect(filled(strips[2]?.d ?? '', p7.x, p7.y)).toBe(true);
  });
});
