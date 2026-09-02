/**
 * 16-point compass (FR-GUIDE-1, US-6 AC2). Each point owns a 22.5° sector
 * centred on its bearing, so N covers [348.75°, 11.25°). Pure.
 */
export const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

export const SECTOR_DEG = 360 / COMPASS_POINTS.length; // 22.5

/** Normalise any bearing into [0, 360). */
export function normalizeAzimuthDeg(azDeg: number): number {
  const a = azDeg % 360;
  return a < 0 ? a + 360 : a;
}

/** The 16-point abbreviation for a bearing in degrees clockwise from north. */
export function compassPoint(azDeg: number): CompassPoint {
  if (!Number.isFinite(azDeg)) throw new RangeError(`compassPoint: azimuth must be finite, got ${String(azDeg)}`);
  const index = Math.round(normalizeAzimuthDeg(azDeg) / SECTOR_DEG) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index] ?? 'N';
}
