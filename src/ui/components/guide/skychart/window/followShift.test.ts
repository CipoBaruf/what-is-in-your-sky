/**
 * v2.12 (FR-GYRO-2 as amended, D-1018): the following window draws its aim `followAimShiftPx` below the box's centre.
 * A level phone's horizon is then a straight line `FOLLOW_HORIZON_SHARE` of the height above the bottom edge, the
 * picture moves with the phone exactly as the centred one does, and the ground state reads the box's centre.
 */
import { describe, expect, it } from 'vitest';
import { handRotation } from './camera';
import { drawableDeg, FOLLOW_HORIZON_SHARE, followAimShiftPx, groundState, project, type View } from './projection';

const CENTRED: View = { fovDeg: 60, width: 390, height: 844, screenAngleDeg: 0 };
const SHIFTED: View = { ...CENTRED, aimShiftPx: followAimShiftPx(CENTRED.height) };

describe('the following window’s aim shift', () => {
  it('puts a level phone’s horizon on one straight line FOLLOW_HORIZON_SHARE above the bottom', () => {
    const level = handRotation({ azDeg: 120, altDeg: 0 });
    const line = (1 - FOLLOW_HORIZON_SHARE) * SHIFTED.height;
    for (const azDeg of [100, 110, 120, 130, 140]) expect(project(level, azDeg, 0, SHIFTED).y).toBeCloseTo(line, 6);
  });

  it('moves the picture with the phone exactly as the centred window does: a pure shift of the image', () => {
    for (const altDeg of [-30, 0, 15, 45, 80]) {
      const m = handRotation({ azDeg: 200, altDeg });
      for (const [az, alt] of [[190, 10], [210, 40], [200, 70]] as const) {
        const a = project(m, az, alt, CENTRED);
        const b = project(m, az, alt, SHIFTED);
        expect(b.x).toBeCloseTo(a.x, 9);
        expect(b.y - a.y).toBeCloseTo(SHIFTED.aimShiftPx ?? 0, 9);
      }
    }
  });

  it('draws as far as the corners the shift moved away, and reads the ground at the box’s centre', () => {
    expect(drawableDeg(SHIFTED)).toBeGreaterThan(drawableDeg(CENTRED));
    // A little under the horizon, most of the shifted box is still sky: no ground state until the centre is under it.
    expect(groundState(-10, CENTRED)).toBe('ground');
    expect(groundState(-10, SHIFTED)).toBe('sky');
    expect(groundState(-60, SHIFTED)).toBe('ground');
    expect(groundState(-120, SHIFTED)).toBe('buried');
  });
});
