import type { MoonPhaseName, MoonState } from '../../../../model';

/**
 * FR-DOME-6 (R22): the Sun's and the Moon's *reading* — when each one is
 * drawn, how wide and how bright the Sun's glow is, and which glyph carries
 * the phase — in one pure module both views import, so the dome and the polar
 * chart tell the same story (FR-DOME-7) rather than each inventing its own
 * thresholds. The shapes themselves belong to the views: the dome builds
 * polygons in `dome/domeGeometry.ts`, the polar chart SVG in `SkyPolar.tsx`.
 *
 * Nothing here imports physics: the Sun and the Moon arrive as values
 * (`lib/skyBodies.ts` evaluates them, D-80), so this file stays in the main
 * chunk and `astronomy-engine` does not.
 */

/** FR-DOME-6: below this Sun altitude the sky is dark and there is no glow at all (astronomical twilight). */
export const GLOW_MIN_ALT_DEG = -18;

/**
 * FR-DOME-6: how wide and how bright the Sun's glow is at a Sun altitude —
 * nothing at −18°, full at the horizon. Above the horizon it stays at full
 * strength rather than switching off: the requirement's band is where the glow
 * *grows*, and a live page at midday that drew no Sun at all would be telling
 * a worse lie than one that draws it at its brightest (R22).
 */
export function glowStrength(sunAltDeg: number): number {
  if (sunAltDeg > 0) return 1;
  if (sunAltDeg < GLOW_MIN_ALT_DEG) return 0;
  return 1 + sunAltDeg / -GLOW_MIN_ALT_DEG;
}

/** Whether the Sun is drawn at all. */
export const sunVisible = (sun: { altDeg: number }): boolean => glowStrength(sun.altDeg) > 0;

/** How far the glow reaches either side of the Sun's azimuth, in degrees of sky (D-92's shape). */
export const glowHalfWidthDeg = (strength: number): number => 12 + 28 * strength;
/** How far the glow rises off the horizon, in degrees of sky. */
export const glowHeightDeg = (strength: number): number => 6 + 18 * strength;

/**
 * FR-DOME-6: the Moon is drawn while it is above the horizon. Its centre, not
 * its limb: the marker is a symbol, not a disc, so there is nothing to argue
 * about at the horizon.
 */
export const moonVisible = (moon: { elDeg: number }): boolean => moon.elDeg > 0;

/**
 * FR-DOME-6's phase glyph. Monochrome by design (FR-X-5, FR-THEME-3): the
 * emoji moons 🌑–🌘 map one-to-one onto these eight names but carry their own
 * colour into the night theme, which no other element is allowed to do, so the
 * geometric shapes are used instead. They cover seven of the eight readings —
 * lit on the right while waxing, on the left while waning — and the two
 * gibbous phases share one glyph, there being no mirrored three-quarter circle
 * in Unicode. Nothing is lost by that: both read as "nearly full", and the
 * phase's name is written out on the Moon line and in the Now panel (R30).
 */
export const MOON_PHASE_GLYPH: Record<MoonPhaseName, string> = {
  new: '○',
  waxingCrescent: '☽',
  firstQuarter: '◑',
  waxingGibbous: '◕',
  full: '●',
  waningGibbous: '◕',
  lastQuarter: '◐',
  waningCrescent: '☾',
};

export const moonGlyph = (moon: Pick<MoonState, 'phase'>): string => MOON_PHASE_GLYPH[moon.phase];
