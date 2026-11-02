/**
 * R158 (FR-PHONE-9, D-969): the window's field on the whole sky. The inverse
 * projection is the window's own run backwards (a round trip through
 * `project`), and the outline has the spec's shapes at three poses: a 60°
 * field facing south at 35° is a trapezoid low on the southern edge, the
 * zenith-facing field a loop round the centre, and a field facing north at 10°
 * loses its part under the horizon and ends on the horizon ring.
 */
import { describe, expect, it } from 'vitest';
import { toPolar } from '../../../../../lib/skyGeometry';
import type { ChartOrientation } from '../../../../../model';
import { handRotation } from '../window/camera';
import { project, skyVector, type View } from '../window/projection';
import { FIELD_OUTLINE_SAMPLES, fieldOutline, unprojectBox, type PolarProjection } from './fieldOutline';

const R = 100;
const polarOf =
  (orientation: ChartOrientation): PolarProjection =>
  ({ azDeg, elDeg }) => {
    const p = toPolar(azDeg, elDeg, orientation);
    return { x: p.x * R, y: p.y * R };
  };
const square: View = { fovDeg: 60, width: 360, height: 360, screenAngleDeg: 0 };

/** The path's sub-paths as point lists. */
function subPaths(d: string): { x: number; y: number }[][] {
  return d
    .split('M')
    .filter(Boolean)
    .map((part) =>
      part
        .replace('Z', '')
        .split('L')
        .map((pair) => {
          const [x, y] = pair.trim().split(' ').map(Number);
          return { x: x ?? Number.NaN, y: y ?? Number.NaN };
        }),
    );
}

describe('unprojectBox (D-969)', () => {
  it('is the window projection run backwards, at any screen angle and field', () => {
    for (const view of [square, { fovDeg: 20, width: 390, height: 600, screenAngleDeg: 90 }, { fovDeg: 90, width: 844, height: 390, screenAngleDeg: -90 }]) {
      const m = handRotation({ azDeg: 200, altDeg: 40 });
      for (const [az, alt] of [
        [200, 40],
        [210, 50],
        [185, 30],
      ] as const) {
        const p = project(m, az, alt, view);
        const back = unprojectBox(m, view, p.x, p.y);
        const want = skyVector(az, alt);
        for (let k = 0; k < 3; k += 1) expect(back[k]).toBeCloseTo(want[k] ?? 0, 9);
      }
    }
  });
});

describe('fieldOutline (FR-PHONE-9)', () => {
  it('draws a 60° field facing south at 35° as a closed trapezoid low on the southern edge', () => {
    const d = fieldOutline({ azDeg: 180, altDeg: 35 }, square, polarOf('looking-up'));
    expect(d.endsWith('Z')).toBe(true);
    const [points] = subPaths(d);
    expect(subPaths(d)).toHaveLength(1);
    expect(points).toHaveLength(4 * FIELD_OUTLINE_SAMPLES);
    // South is down on the chart in both conventions: every point in the southern half, inside the horizon.
    for (const p of points ?? []) {
      expect(p.y).toBeGreaterThan(0);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R);
    }
    const corner = (i: number): { x: number; y: number } => points?.[i * FIELD_OUTLINE_SAMPLES] ?? { x: 0, y: 0 };
    const [topLeft, topRight, bottomRight, bottomLeft] = [corner(0), corner(1), corner(2), corner(3)];
    // The bottom edge is near the horizon (35° − 30° = 5° up) and wider than the top edge, which is higher: a trapezoid.
    expect(Math.hypot(bottomLeft.x, bottomLeft.y)).toBeGreaterThan(85);
    expect(Math.abs(bottomRight.x - bottomLeft.x)).toBeGreaterThan(Math.abs(topRight.x - topLeft.x));
    expect(bottomLeft.y).toBeGreaterThan(topLeft.y);
    // Facing south the box's left edge is east of south: on the left looking up (negative x), on the right on the map.
    expect(topLeft.x).toBeLessThan(0);
    const [mapped] = subPaths(fieldOutline({ azDeg: 180, altDeg: 35 }, square, polarOf('map')));
    expect(mapped?.[0]?.x).toBeCloseTo(-topLeft.x, 1);
  });

  it('draws the zenith-facing field as a closed loop round the centre', () => {
    const d = fieldOutline({ azDeg: 0, altDeg: 90 }, square, polarOf('looking-up'));
    expect(d.endsWith('Z')).toBe(true);
    const [points] = subPaths(d);
    const radii = (points ?? []).map((p) => Math.hypot(p.x, p.y));
    // The box's edge is 30° to 42° from its centre: every point a third to a half of the way out.
    for (const r of radii) {
      expect(r).toBeGreaterThan((28 / 90) * R);
      expect(r).toBeLessThan((44 / 90) * R);
    }
    // It goes once round the centre: the angles sweep a full turn.
    let turn = 0;
    const list = points ?? [];
    list.forEach((p, i) => {
      const q = list[(i + 1) % list.length] ?? p;
      let delta = Math.atan2(q.y, q.x) - Math.atan2(p.y, p.x);
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      turn += delta;
    });
    expect(Math.abs(turn)).toBeCloseTo(2 * Math.PI, 5);
  });

  it('drops the part under the horizon: a field facing north at 10° is one open run ending on the horizon ring', () => {
    const d = fieldOutline({ azDeg: 0, altDeg: 10 }, square, polarOf('looking-up'));
    expect(d).not.toContain('Z');
    const runs = subPaths(d);
    expect(runs).toHaveLength(1);
    const run = runs[0] ?? [];
    for (const p of run) {
      expect(p.y).toBeLessThan(0);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 0.01);
    }
    expect(Math.hypot(run[0]?.x ?? 0, run[0]?.y ?? 0)).toBeCloseTo(R, 1);
    expect(Math.hypot(run.at(-1)?.x ?? 0, run.at(-1)?.y ?? 0)).toBeCloseTo(R, 1);
  });

  it('takes a rotation as the camera as well as a hand pose, and draws nothing for a field under the ground or a box with no size', () => {
    const polar = polarOf('looking-up');
    expect(fieldOutline(handRotation({ azDeg: 180, altDeg: 35 }), square, polar)).toBe(fieldOutline({ azDeg: 180, altDeg: 35 }, square, polar));
    expect(fieldOutline({ azDeg: 0, altDeg: -60 }, square, polar)).toBe('');
    expect(fieldOutline({ azDeg: 0, altDeg: 35 }, { ...square, width: 0 }, polar)).toBe('');
  });
});
