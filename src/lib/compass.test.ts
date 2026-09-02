import { describe, expect, it } from 'vitest';
import { COMPASS_POINTS, compassPoint, normalizeAzimuthDeg } from './compass';

describe('compassPoint', () => {
  it('has the sixteen points in clockwise order from north', () => {
    expect(COMPASS_POINTS).toHaveLength(16);
    expect(COMPASS_POINTS[0]).toBe('N');
    expect(COMPASS_POINTS[4]).toBe('E');
    expect(COMPASS_POINTS[8]).toBe('S');
    expect(COMPASS_POINTS[12]).toBe('W');
  });

  it('handles the boundaries stated in TASKS R3', () => {
    expect(compassPoint(11.24)).toBe('N');
    expect(compassPoint(11.25)).toBe('NNE');
    expect(compassPoint(359.9)).toBe('N');
  });

  it('maps each exact bearing to its own point', () => {
    COMPASS_POINTS.forEach((point, i) => {
      expect(compassPoint(i * 22.5)).toBe(point);
    });
  });

  it('maps the cardinal and intercardinal directions', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(45)).toBe('NE');
    expect(compassPoint(225)).toBe('SW');
    expect(compassPoint(53.33)).toBe('NE'); // the R1 golden pass peak
  });

  it('normalises bearings outside [0, 360)', () => {
    expect(compassPoint(360)).toBe('N');
    expect(compassPoint(-10)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
    expect(compassPoint(450)).toBe('E');
    expect(normalizeAzimuthDeg(-0.5)).toBeCloseTo(359.5, 9);
  });

  it('rejects non-finite input', () => {
    expect(() => compassPoint(Number.NaN)).toThrow(RangeError);
  });
});
