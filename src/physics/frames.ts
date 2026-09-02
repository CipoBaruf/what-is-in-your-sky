import {
  degreesToRadians,
  ecfToEci,
  ecfToLookAngles,
  eciToEcf,
  geodeticToEcf,
  gstime,
  radiansToDegrees,
} from 'satellite.js';
import type { EpochMs, Observer } from '../model';
import { msToJulianDate } from './time';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LookAngles {
  azDeg: number; // 0..360, clockwise from north
  elDeg: number;
  rangeKm: number;
}

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const norm = (a: Vec3): number => Math.sqrt(dot(a, a));
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export function unit(a: Vec3): Vec3 {
  const n = norm(a);
  if (n === 0) throw new Error('Cannot normalise a zero vector');
  return scale(a, 1 / n);
}

/** Greenwich mean sidereal time in radians at `t`. */
export function gmstRad(t: EpochMs): number {
  return gstime(msToJulianDate(t));
}

/** Observer geodetic position in the units satellite.js expects: radians (east-positive) and km. */
export function observerGeodetic(observer: Observer): { longitude: number; latitude: number; height: number } {
  return {
    longitude: degreesToRadians(observer.lon),
    latitude: degreesToRadians(observer.lat),
    height: observer.altM / 1000,
  };
}

/** Observer position in the TEME/ECI frame at `t`, km. */
export function observerEci(observer: Observer, t: EpochMs): Vec3 {
  return ecfToEci(geodeticToEcf(observerGeodetic(observer)), gmstRad(t));
}

/** Azimuth, elevation and range of an ECI position as seen from the observer at `t`. */
export function lookAnglesFrom(observer: Observer, posEci: Vec3, t: EpochMs): LookAngles {
  const ecf = eciToEcf(posEci, gmstRad(t));
  const la = ecfToLookAngles(observerGeodetic(observer), ecf);
  return {
    azDeg: normaliseAzimuthDeg(radiansToDegrees(la.azimuth)),
    elDeg: radiansToDegrees(la.elevation),
    rangeKm: la.rangeSat,
  };
}

export function normaliseAzimuthDeg(az: number): number {
  const a = az % 360;
  return a < 0 ? a + 360 : a;
}

/** Smallest absolute difference between two azimuths, 0..180. */
export function azimuthDeltaDeg(a: number, b: number): number {
  const d = Math.abs(normaliseAzimuthDeg(a) - normaliseAzimuthDeg(b));
  return d > 180 ? 360 - d : d;
}
