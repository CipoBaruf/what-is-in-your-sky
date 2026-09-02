import { EARTH_RADIUS_KM } from './constants';
import { dot, norm, scale, sub, type Vec3 } from './frames';

/**
 * Cylindrical umbra test (PLAN §6.3, D-8). With `r` the satellite ECI position
 * and `s` the sun unit vector, `d = r·s`; the satellite is in umbra iff it is on
 * the night side (`d < 0`) and its distance from the Earth–sun axis is less
 * than the Earth's radius.
 */
export function inUmbra(posEci: Vec3, sunUnit: Vec3, earthRadiusKm: number = EARTH_RADIUS_KM): boolean {
  const d = dot(posEci, sunUnit);
  if (d >= 0) return false;
  const perpendicular = sub(posEci, scale(sunUnit, d));
  return norm(perpendicular) < earthRadiusKm;
}
