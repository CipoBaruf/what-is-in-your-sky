import type { Speed } from '../../../../../lib/playback';

/**
 * R167 (SPEC §4.55's constants table, FR-GLOBE-17; PLAN D-1036, D-1037): every
 * number the celestial globe draws or turns by, in one place. The values are the
 * spec's; `constants.test.ts` holds them to it.
 */

/** FR-GLOBE-2: the globe's radius at zoom 1, as a share of the box's shorter side. */
export const GLOBE_RADIUS_SHARE = 0.45;

/** FR-GLOBE-5, D-1036: the opening view's centre, this far above the horizon toward the visible celestial pole, degrees. */
export const GLOBE_OPEN_ALT_DEG = 25;

/** FR-GLOBE-6: the zoom's bounds. */
export const GLOBE_ZOOM_MIN = 0.5;
export const GLOBE_ZOOM_MAX = 4;

/** FR-GLOBE-6: one wheel notch or one `+` / `-` multiplies (or divides) the zoom by this. */
export const GLOBE_ZOOM_STEP = 1.25;

/** FR-GLOBE-6: an arrow key turns the view this far, degrees (`YAW_STEP_DEG`'s value). */
export const GLOBE_KEY_STEP_DEG = 15;

/** FR-GLOBE-3: what is under the shown place's horizon is drawn at this opacity, never removed. */
export const GLOBE_DIM_OPACITY = 0.4;

/** FR-GLOBE-3: the ground side's shade in `--chart-ground`. */
export const GLOBE_GROUND_OPACITY = 0.85;

/** FR-GLOBE-2: the equatorial grid's step, degrees (hour circles every 2 h, parallels every 30°). */
export const GLOBE_GRID_STEP_DEG = 30;

/** FR-GLOBE-7: how far the globe's instant may run either side of now, days. */
export const GLOBE_SPAN_DAYS = 366;

/** FR-GLOBE-7: the time-lapse's three rates, the live page's `SPEEDS` past real time — typed as `Speed` so `usePlayback`'s `setSpeed` takes them. */
export const GLOBE_SPEEDS = [60, 600, 3600] as const satisfies readonly Speed[];

/** FR-GLOBE-4: the SVG's node ceiling; the faint stars add none. */
export const GLOBE_MAX_NODES = 400;

/** D-1034: the `globe` chunk's budget, KB gzipped. */
export const GLOBE_BUDGET_KB = 15;

/** §4.55: what `main` may grow over 2.11.0's measure, KB gzipped. */
export const GLOBE_MAIN_KB = 1.5;

/** §4.55: what the `stars` chunk may grow, KB gzipped. */
export const GLOBE_STARS_KB = 1.5;

/** R184 (SPEC §4.57, FR-WIDE-7): the highlighted pass's arc carries a tick at every whole this many minutes of its track. */
export const ARC_TICK_MIN = 1;

/** FR-WIDE-7: the arrow stands at this share of the drawn part, or at the marker while the pass is up. */
export const ARC_ARROW_SHARE = 0.5;

/** FR-NAME-3: a planet's disc radius at zoom 1, px; the window takes it in R185. */
export const PLANET_MARK_PX = 5;

/** FR-WIDE-11: what the `globe` chunk may grow over 2.13.0's measure, KB gzipped. */
export const SKY_GLOBE_KB = 4;

/** FR-GLOBE-7: the bodies are recomputed at most this often in wall time, as the live page's are (one constant, `lib/playback.ts`'s). */
export { BODIES_EVERY_MS } from '../../../../../lib/playback';
