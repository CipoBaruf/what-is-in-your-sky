import { describe, expect, it } from 'vitest';
import { ecfToEci, geodeticToEcf } from 'satellite.js';
import type { Observer } from '../model';
import { loadReferenceValues, referenceObserver } from '../../tests/support/reference';
import {
  azimuthDeltaDeg,
  dot,
  gmstRad,
  lookAnglesFrom,
  norm,
  normaliseAzimuthDeg,
  observerEci,
  observerGeodetic,
  scale,
  sub,
  unit,
} from './frames';

const neuquen: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquen', source: 'coords', timeZone: 'UTC' };
const ref = loadReferenceValues();

describe('frames', () => {
  it('GMST at J2000.0 is 280.46061837° (Vallado / USNO)', () => {
    expect((gmstRad(Date.UTC(2000, 0, 1, 12)) * 180) / Math.PI).toBeCloseTo(280.46061837, 6);
  });

  it('GMST advances one sidereal day per 23h 56m 04.09s', () => {
    const t0 = Date.UTC(2026, 8, 2);
    const sidereal = 86_164_090.5; // ms
    const d = gmstRad(t0 + sidereal) - gmstRad(t0);
    expect(Math.abs(((d + Math.PI) % (2 * Math.PI)) - Math.PI)).toBeLessThan(1e-6);
  });

  it('observer geodetic is radians, east-positive, km', () => {
    const gd = observerGeodetic({ ...neuquen, altM: 250 });
    expect(gd.latitude).toBeCloseTo((-38.93 * Math.PI) / 180, 12);
    expect(gd.longitude).toBeCloseTo((-67.99 * Math.PI) / 180, 12);
    expect(gd.height).toBe(0.25);
  });

  it('vector helpers behave', () => {
    const a = { x: 3, y: 0, z: 4 };
    expect(norm(a)).toBe(5);
    const u = unit(a);
    expect(u.x).toBeCloseTo(0.6, 12);
    expect(u.y).toBe(0);
    expect(u.z).toBeCloseTo(0.8, 12);
    expect(dot(a, { x: 1, y: 1, z: 1 })).toBe(7);
    expect(sub(a, { x: 1, y: 1, z: 1 })).toEqual({ x: 2, y: -1, z: 3 });
    expect(scale(a, 2)).toEqual({ x: 6, y: 0, z: 8 });
    expect(() => unit({ x: 0, y: 0, z: 0 })).toThrow(/zero vector/);
  });

  it('a satellite straight above the observer has el = 90°', () => {
    const t = Date.UTC(2026, 8, 2, 3, 0, 0);
    const above = scale(unit(observerEci(neuquen, t)), 6371 + 400);
    // Geodetic "up" is not exactly geocentric "up"; the difference at 39° latitude is ~0.19°.
    // Use the geodetic normal instead: move the observer to 400 km altitude in the same geodetic position.
    const geodeticAbove = ecfToEci(geodeticToEcf(observerGeodetic({ ...neuquen, altM: 400_000 })), gmstRad(t));
    expect(lookAnglesFrom(neuquen, geodeticAbove, t).elDeg).toBeCloseTo(90, 6);
    expect(lookAnglesFrom(neuquen, above, t).elDeg).toBeGreaterThan(89.5);
  });

  it('a satellite at the geometric horizon distance has el ≈ 0°', () => {
    const t = Date.UTC(2026, 8, 2, 3, 0, 0);
    // Put the satellite 400 km up at the point where the observer's horizon plane is tangent.
    const obs = observerEci({ ...neuquen, lat: 0, lon: 0 }, t);
    const up = unit(obs);
    const north = { x: 0, y: 0, z: 1 }; // for lat 0 the ECI z axis is a horizontal direction
    const R = 6378.137; // WGS84 equatorial radius: at lat 0 the geodetic normal is exactly radial
    const h = 400;
    const theta = Math.acos(R / (R + h)); // central angle to the horizon tangent point
    const sat = {
      x: (R + h) * (Math.cos(theta) * up.x + Math.sin(theta) * north.x),
      y: (R + h) * (Math.cos(theta) * up.y + Math.sin(theta) * north.y),
      z: (R + h) * (Math.cos(theta) * up.z + Math.sin(theta) * north.z),
    };
    const look = lookAnglesFrom({ ...neuquen, lat: 0, lon: 0 }, sat, t);
    expect(Math.abs(look.elDeg)).toBeLessThan(0.01);
    expect(look.azDeg).toBeCloseTo(0, 3); // due north
  });

  it('azimuth runs clockwise from north: a point east of an equatorial observer is at 90°', () => {
    const t = Date.UTC(2026, 8, 2, 3, 0, 0);
    const equator: Observer = { ...neuquen, lat: 0, lon: 0 };
    const obs = observerEci(equator, t);
    const up = unit(obs);
    const north = { x: 0, y: 0, z: 1 };
    const east = { x: north.y * up.z - north.z * up.y, y: north.z * up.x - north.x * up.z, z: north.x * up.y - north.y * up.x };
    const sat = { x: obs.x + 500 * up.x + 500 * east.x, y: obs.y + 500 * up.y + 500 * east.y, z: obs.z + 500 * up.z + 500 * east.z };
    const look = lookAnglesFrom(equator, sat, t);
    expect(look.azDeg).toBeCloseTo(90, 2);
    expect(look.elDeg).toBeCloseTo(45, 1);
    expect(look.rangeKm).toBeCloseTo(Math.SQRT2 * 500, 3);
  });

  it('normalises and wraps azimuths', () => {
    expect(normaliseAzimuthDeg(-10)).toBe(350);
    expect(normaliseAzimuthDeg(370)).toBe(10);
    expect(normaliseAzimuthDeg(360)).toBe(0);
    expect(azimuthDeltaDeg(350, 10)).toBe(20);
    expect(azimuthDeltaDeg(10, 350)).toBe(20);
    expect(azimuthDeltaDeg(0, 180)).toBe(180);
  });

  it('reproduces the reference GMST, observer ECI and look angles at capturedAt (reference-values.json)', () => {
    const observer = referenceObserver(ref);
    expect(gmstRad(ref.t)).toBeCloseTo(ref.gmstRad, 12);
    const look = lookAnglesFrom(observer, ref.eci.position, ref.t);
    expect(look.azDeg).toBeCloseTo(ref.lookAngles.azDeg, 6);
    expect(look.elDeg).toBeCloseTo(ref.lookAngles.elDeg, 6);
    expect(look.rangeKm).toBeCloseTo(ref.lookAngles.rangeKm, 6);
    // Range is the straight-line distance observer → satellite in ECI.
    expect(norm(sub(ref.eci.position, observerEci(observer, ref.t)))).toBeCloseTo(ref.lookAngles.rangeKm, 6);
  });
});
