/**
 * R79 (FR-GUT-2..6, US-28 AC1..AC3; PLAN D-450): the compass gutter's
 * geometry over a table of facings and bearings — inside the bracket, on the
 * band, off the band left, off the band right and exactly 180° behind — for
 * the branch and for `x`, in the style of `lib/timeStripe.ts`'s tests. Nothing
 * about the gutter is tested through the DOM (FR-GUT-5).
 */
import { describe, expect, it } from 'vitest';
import type { PassPoint } from '../../../../../model';
import { bandNames, bracketFor, edgeMarkers, GUTTER_HALF_SPAN_DEG, gutterMarks, gutterX, horizontalHalfFieldDeg, passBearing, turnTo, wrapDeg, type GutterBranch, type GutterPass } from './gutter';
import { project, uprightRotation, verticalHalfFieldDeg, WINDOW_FOV, type View } from './projection';

/** A phone held sideways and upright, as the sky screen measures them. */
const SIDEWAYS: View = { fovDeg: WINDOW_FOV, width: 844, height: 390, screenAngleDeg: 0 };
const UPRIGHT: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };

const pass = (bearingDeg: number, key = 'A', id = key): GutterPass => ({ id, name: `Sat ${key}`, key, color: 'series-1', bearingDeg });

describe('wrapDeg', () => {
  it('is the shorter signed turn, in (−180, 180]', () => {
    expect(wrapDeg(0)).toBe(0);
    expect(wrapDeg(20)).toBe(20);
    expect(wrapDeg(10 - 350)).toBe(20);
    expect(wrapDeg(350 - 10)).toBe(-20);
    expect(wrapDeg(-190)).toBe(170);
    expect(wrapDeg(725)).toBe(5);
  });

  it('resolves both half turns to +180, never −180, so a point behind cannot flip ends', () => {
    expect(wrapDeg(180)).toBe(180);
    expect(wrapDeg(-180)).toBe(180);
    expect(wrapDeg(540)).toBe(180);
  });

  it('is zero for every bearing against itself', () => {
    for (let b = 0; b < 360; b += 7) expect(wrapDeg(b - b)).toBe(0);
  });
});

describe('gutterX', () => {
  it('maps the facing ± 90° linearly onto the width', () => {
    expect(gutterX(0, 0, 844)).toBe(422);
    expect(gutterX(90, 0, 844)).toBe(844);
    expect(gutterX(-90, 0, 844)).toBe(0);
    expect(gutterX(45, 0, 400)).toBe(300);
  });

  it('wraps at north, in the mapping and not only in the difference', () => {
    expect(gutterX(20, 350, 180)).toBe(120);
    expect(gutterX(305, 350, 180)).toBe(45);
    expect(gutterX(80, 350, 180)).toBe(180);
  });

  it('puts a bearing clockwise of the facing on the same side the drawing does (east on the right)', () => {
    const m = uprightRotation(0, 0);
    const right = project(m, 20, 0, SIDEWAYS);
    expect(right.x).toBeGreaterThan(SIDEWAYS.width / 2);
    expect(gutterX(20, 0, SIDEWAYS.width)).toBeGreaterThan(SIDEWAYS.width / 2);
    const left = project(m, 340, 0, SIDEWAYS);
    expect(left.x).toBeLessThan(SIDEWAYS.width / 2);
    expect(gutterX(340, 0, SIDEWAYS.width)).toBeLessThan(SIDEWAYS.width / 2);
  });
});

describe('bracketFor', () => {
  it('is WINDOW_FOV / 2 upright, where the field spans the width, and the vertical half-field’s twin', () => {
    expect(horizontalHalfFieldDeg(UPRIGHT)).toBeCloseTo(WINDOW_FOV / 2, 9);
    expect(horizontalHalfFieldDeg(UPRIGHT)).toBeCloseTo(verticalHalfFieldDeg(UPRIGHT), 9);
    const tall: View = { ...UPRIGHT, height: 844 };
    expect(horizontalHalfFieldDeg(tall)).toBeCloseTo(WINDOW_FOV / 2, 9);
  });

  it('is wider sideways — the "twice the sky" of FR-GUT-7 — from the same scale and no constant', () => {
    const { halfDeg, x0, x1 } = bracketFor(SIDEWAYS);
    expect(halfDeg).toBeCloseTo(60.2, 1);
    expect(halfDeg).toBeCloseTo(verticalHalfFieldDeg({ ...SIDEWAYS, width: 390, height: 844 }), 9);
    expect(x0).toBeCloseTo(844 * (90 - halfDeg) / 180, 9);
    expect(x1).toBeCloseTo(844 * (90 + halfDeg) / 180, 9);
    const upright = bracketFor(UPRIGHT);
    expect(upright.x0).toBeCloseTo(130, 9);
    expect(upright.x1).toBeCloseTo(260, 9);
  });

  it('stops at the band’s half span on a box whose field is wider than the band, so no mark in the bracket is off the band', () => {
    const wide: View = { ...SIDEWAYS, width: 4000, height: 300 };
    expect(horizontalHalfFieldDeg(wide)).toBeGreaterThan(GUTTER_HALF_SPAN_DEG);
    const { halfDeg, x0, x1 } = bracketFor(wide);
    expect(halfDeg).toBe(GUTTER_HALF_SPAN_DEG);
    expect(x0).toBe(0);
    expect(x1).toBe(wide.width);
    const [mark] = gutterMarks([pass(100)], 0, wide);
    expect(mark?.branch).not.toBe('in-bracket');
  });
});

describe('gutterMarks', () => {
  const H = bracketFor(SIDEWAYS).halfDeg;
  const table: { name: string; facing: number; bearing: number; view: View; branch: GutterBranch; x?: number; angle?: number }[] = [
    { name: 'dead ahead', facing: 0, bearing: 0, view: SIDEWAYS, branch: 'in-bracket', x: 422 },
    { name: 'in the bracket across north', facing: 350, bearing: 20, view: SIDEWAYS, branch: 'in-bracket', x: (844 * 120) / 180 },
    { name: 'on the bracket’s edge', facing: 100, bearing: 100 + H, view: SIDEWAYS, branch: 'in-bracket', x: (844 * (90 + H)) / 180 },
    { name: 'just past the bracket’s edge', facing: 100, bearing: 100 + H + 0.01, view: SIDEWAYS, branch: 'on-band', x: (844 * (90 + H + 0.01)) / 180 },
    { name: 'on the band, left', facing: 10, bearing: 300, view: SIDEWAYS, branch: 'on-band', x: (844 * 20) / 180 },
    { name: 'on the band upright, where the bracket is narrow', facing: 0, bearing: 60, view: UPRIGHT, branch: 'on-band', x: 325 },
    { name: 'on the band’s end', facing: 0, bearing: 90, view: SIDEWAYS, branch: 'on-band', x: 844 },
    { name: 'just off the band’s end', facing: 0, bearing: 90.4, view: SIDEWAYS, branch: 'off-right', angle: 90 },
    { name: 'off the band left', facing: 0, bearing: 250, view: SIDEWAYS, branch: 'off-left', angle: 110 },
    { name: 'off the band right', facing: 270, bearing: 20, view: SIDEWAYS, branch: 'off-right', angle: 110 },
    { name: 'exactly behind', facing: 90, bearing: 270, view: SIDEWAYS, branch: 'off-right', angle: 180 },
    { name: 'a hair past behind', facing: 0, bearing: 180.4, view: SIDEWAYS, branch: 'off-left', angle: 180 },
  ];

  it.each(table)('$name: facing $facing, bearing $bearing → $branch', ({ facing, bearing, view, branch, x, angle }) => {
    const [mark] = gutterMarks([pass(bearing)], facing, view);
    expect(mark?.branch).toBe(branch);
    if (x === undefined) expect(mark?.x).toBeNull();
    else expect(mark?.x).toBeCloseTo(x, 6);
    if (angle === undefined) expect(mark?.angleDeg).toBeNull();
    else expect(mark?.angleDeg).toBe(angle);
  });

  it('keeps each pass’s key, colour and legend order', () => {
    const marks = gutterMarks([{ ...pass(0, 'A'), color: 'series-2' }, pass(200, 'B')], 0, SIDEWAYS);
    expect(marks.map((mark) => [mark.key, mark.color, mark.branch])).toEqual([
      ['A', 'series-2', 'in-bracket'],
      ['B', 'series-1', 'off-left'],
    ]);
  });

  it('narrows the bracket upright: the same bearing is in the field sideways and on the band upright', () => {
    expect(gutterMarks([pass(45)], 0, SIDEWAYS)[0]?.branch).toBe('in-bracket');
    expect(gutterMarks([pass(45)], 0, UPRIGHT)[0]?.branch).toBe('on-band');
  });
});

describe('edgeMarkers', () => {
  it('stacks one end by the nearest angle first, then in legend order', () => {
    const marks = gutterMarks([pass(200, 'A'), pass(130, 'B'), pass(250, 'C'), pass(230, 'D'), pass(130, 'E')], 0, SIDEWAYS);
    expect(edgeMarkers(marks, 'off-left').map((mark) => `${mark.key} ${String(mark.angleDeg)}`)).toEqual(['C 110', 'D 130', 'A 160']);
    expect(edgeMarkers(marks, 'off-right').map((mark) => `${mark.key} ${String(mark.angleDeg)}`)).toEqual(['B 130', 'E 130']);
  });
});

describe('bandNames', () => {
  const names = (facing: number): string[] =>
    bandNames(facing, 180)
      .sort((a, b) => a.x - b.x)
      .map((n) => n.name);

  it('carries NW N NE facing north and not S; the reverse facing south', () => {
    expect(names(0)).toEqual(['W', 'NW', 'N', 'NE', 'E']);
    expect(names(180)).toEqual(['E', 'SE', 'S', 'SW', 'W']);
  });

  it('moves the names with the facing rather than jumping them', () => {
    const at = (facing: number): number | undefined => bandNames(facing, 180).find((n) => n.name === 'N')?.x;
    expect(at(0)).toBe(90);
    expect(at(1)).toBe(89);
    expect(at(10)).toBe(80);
    expect(at(350)).toBe(100);
  });

  it('holds every name on the band at most GUTTER_HALF_SPAN_DEG from the facing', () => {
    for (let facing = 0; facing < 360; facing += 5) {
      for (const n of bandNames(facing, 180)) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x).toBeLessThanOrEqual(180);
      }
      expect(bandNames(facing, 180).length).toBeGreaterThanOrEqual((2 * GUTTER_HALF_SPAN_DEG) / 45);
    }
  });
});

describe('passBearing', () => {
  const point = (t: number, azDeg: number): PassPoint => ({ t, azDeg, elDeg: 30, rangeKm: 800 });
  const track = [point(0, 200), point(50, 250), point(100, 300)];
  const p = { start: track[0] as PassPoint, end: track[2] as PassPoint, track };

  it('is the satellite’s azimuth while the pass is up', () => {
    expect(passBearing(p, 50)).toBe(250);
    expect(passBearing(p, 25)).toBeCloseTo(225, 6);
  });

  it('is the rise azimuth before the pass and after it — where to look next', () => {
    expect(passBearing(p, -1)).toBe(200);
    expect(passBearing(p, 101)).toBe(200);
    expect(passBearing(p, undefined)).toBe(200);
  });
});

describe('turnTo', () => {
  it('is the shorter way and the whole degrees', () => {
    expect(turnTo(110, 0)).toEqual({ side: 'right', angleDeg: 110 });
    expect(turnTo(250.4, 0)).toEqual({ side: 'left', angleDeg: 110 });
    expect(turnTo(180, 0)).toEqual({ side: 'right', angleDeg: 180 });
  });
});
