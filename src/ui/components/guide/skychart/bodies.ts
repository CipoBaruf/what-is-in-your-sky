import type { MoonPhaseName, MoonState } from '../../../../model';

/**
 * FR-DOME-6 (R22): the Sun's and the Moon's *reading* — when each one is
 * drawn, when the Sun has its legend line, and which glyph carries
 * the phase — in one pure module both views import, so the dome and the polar
 * chart tell the same story (FR-DOME-7) rather than each inventing its own
 * thresholds. The shapes themselves belong to the views: the dome builds
 * polygons in `dome/domeGeometry.ts`, the polar chart SVG in `SkyPolar.tsx`.
 *
 * Nothing here imports physics: the Sun and the Moon arrive as values
 * (`lib/skyBodies.ts` evaluates them, D-80), so this file stays in the main
 * chunk and `astronomy-engine` does not.
 */

/** FR-DOME-6, FR-LEG-3: the Sun keeps its legend line down to here, the end of astronomical twilight. */
const SUN_LINE_MIN_ALT_DEG = -18;

/** Whether the Sun has its line in the legend (D-1262): through twilight too, when the drawing has no dot. */
export const sunListed = (sun: { altDeg: number }): boolean => sun.altDeg > SUN_LINE_MIN_ALT_DEG;

/** FR-DARK-2 (D-1262): the dome and the polar chart draw the Sun's dot while its centre is up, as they do the Moon. */
export const sunVisible = (sun: { altDeg: number }): boolean => sun.altDeg > 0;

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
