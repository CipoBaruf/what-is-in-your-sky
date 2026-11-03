/**
 * v2.12 (FR-GYRO-2 as amended, D-1018): the following window draws its aim `followAimShiftPx` below the box's centre.
 * A level phone's horizon is then a straight line `FOLLOW_HORIZON_SHARE` of the height above the bottom edge, the
 * picture moves with the phone exactly as the centred one does, and the ground state reads the box's centre.
 */
import { describe, expect, it } from 'vitest';
import { handRotation } from './camera';
import { drawableDeg, FOLLOW_HORIZON_SHARE, FOLLOW_VERTICAL_FIELD_DEG, followAimShiftPx, followFovDeg, groundState, project, verticalHalfFieldDeg, WINDOW_FOV, type View } from './projection';

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

describe('the following window’s field', () => {
  it('narrows a portrait drawing to FOLLOW_VERTICAL_FIELD_DEG top to bottom, and its top stops short of the zenith', () => {
    const fov = followFovDeg(WINDOW_FOV, 390, 844);
    expect(fov).toBeLessThan(WINDOW_FOV);
    const view: View = { fovDeg: fov, width: 390, height: 844, screenAngleDeg: 0, aimShiftPx: followAimShiftPx(844) };
    expect(2 * verticalHalfFieldDeg(view)).toBeCloseTo(FOLLOW_VERTICAL_FIELD_DEG, 6);
    // Level: the box's top edge, straight up from the aim, is well under the zenith.
    const top = project(handRotation({ azDeg: 0, altDeg: 0 }), 0, 63, view);
    expect(top.y).toBeGreaterThan(0);
    expect(project(handRotation({ azDeg: 0, altDeg: 0 }), 0, 0, view).y).toBeCloseTo(844 * (1 - FOLLOW_HORIZON_SHARE), 6);
  });

  it('scales a pinched field from there, and leaves a wide drawing alone', () => {
    expect(followFovDeg(WINDOW_FOV * 0.75, 390, 844)).toBeCloseTo(followFovDeg(WINDOW_FOV, 390, 844) * 0.75, 6);
    expect(followFovDeg(WINDOW_FOV, 844, 390)).toBe(WINDOW_FOV);
  });
});
