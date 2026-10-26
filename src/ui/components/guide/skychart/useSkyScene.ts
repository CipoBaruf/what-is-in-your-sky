import { useMemo } from 'react';
import type { EpochMs, Observer } from '../../../../model';
import { cutCatalog } from './layers';
import type { SkyScene, StarField } from './window/scene';

/**
 * R119 (FR-SKY-1, FR-SKY-8, FR-LIVE-10 as amended; PLAN D-788, D-802): the one
 * scene a page builds per tick and hands to whichever views it draws — the
 * live page, the pass detail, the stars page — called once per page and never
 * per view, so a page with two drawings shares one. Each view then takes its
 * layers from the table (`layers.ts`), not from a condition of its own.
 *
 * The stars come through a **source**: the catalogue in the scene's shape and
 * the positions function, which is `lib/skyStars.ts`'s `starsAt` once the
 * `stars` chunk has loaded (D-802). The hook never imports either, so the
 * catalogue and `astronomy-engine` stay in that chunk whatever page calls
 * this; a page without the chunk yet, or with `[ stars ]` off, passes `null`
 * and the scene carries no stars — the window then draws `v2.3.0`'s picture,
 * the polar chart and the dome `ece8bfd`'s. The positions function memoises
 * on the instant itself, so one rotation per tick serves every view (FR-SKY-8).
 *
 * Three of FR-STAR-3's four layer switches are on under one `starsLayer`
 * (FR-SKY-3's toggle) and the names are off (below): the table, not the
 * switches, is what keeps the figures off the polar chart and the dome.
 *
 * R123 (FR-SKY-3, FR-STAR-13 as amended; D-791, D-814): the twilight step is
 * applied here, once, so no view changes for it and one rule thins every
 * drawing of the sky. The source carries `lib/skyStars.ts`'s `drawnRungs` and
 * `drawnMagLimit` with the positions, and the positions carry the Sun's
 * altitude at the same instant — so at 3600× the step follows the shown `t`
 * exactly, not the page's once-a-second bodies (FR-LIVE-5) — and the hook
 * still imports none of it, so `astronomy-engine` stays in the `stars` chunk.
 * With every rung drawn the scene is the whole field; with fewer (the Sun
 * above −6°) the catalogue is cut to the drawn rungs' magnitude, which in
 * D-748's magnitude order is a prefix (`layers.ts`'s `cutCatalog`, the views'
 * own cut), and the figures are left out, since their lines would run to stars
 * the step hides; above 0° the scene carries no stars at all. The planets go
 * with the first two rungs (`planetsDrawn` is true wherever a rung is drawn),
 * so the step needs no planet switch of its own.
 *
 * The names layer is off in every scene this hook builds: the live page and the
 * pass detail do not offer it (FR-SKY-3, FR-LEG-1 as amended, OQ-45) — a tap
 * names a star (FR-STAR-7), which the window draws apart from the layer.
 */

/** Where the stars come from: the loaded `stars` chunk, in the scene's shape. */
export interface StarSource {
  catalog: StarField['catalog'];
  /**
   * Every star and planet for the observer at `t`, and the Sun's altitude then (degrees); the same call twice is
   * expected to return the same object (`starsAt`).
   */
  positionsAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs) => StarField['positions'] & { sunAltDeg: number };
  /** FR-STAR-13's steps (`skyStars.ts`): how many of the ladder's rungs are drawn at a Sun altitude, … */
  drawnRungs: (sunAltDeg: number) => number;
  /** … and the faintest magnitude that many rungs show (`Infinity` for the whole ladder). */
  drawnMagLimit: (rungs: number) => number;
}

export interface SkySceneInput {
  observer: Observer;
  /** The shown instant — the live page's `t`, the pass detail's own. Without one there are no stars to place. */
  now: EpochMs | undefined;
  /** FR-SKY-3's `[ stars ]`: off, the scene carries no stars whatever the source. */
  starsLayer: boolean;
  /** `null` until the chunk is loaded. */
  source: StarSource | null;
}

/** Frozen: every scene shares it, so no page or test may change it under the others. No names: see above. */
const ALL_LAYERS: StarField['layers'] = Object.freeze({ stars: true, figures: true, planets: true, names: false });

/** FR-STAR-13 in twilight: the drawn rungs and the planets — never the figures, whose lines would reach hidden stars. */
const TWILIGHT_LAYERS: StarField['layers'] = Object.freeze({ stars: true, figures: false, planets: true, names: false });

/** The one scene with no stars, so a view's memo on the scene holds across ticks that change nothing; frozen like `ALL_LAYERS`. */
const NO_STARS: SkyScene = Object.freeze({ stars: null });

export function useSkyScene({ observer, now, starsLayer, source }: SkySceneInput): SkyScene {
  const { lat, lon } = observer;
  // Keyed on the source's fields, not on the object: a page may build the source inline each render.
  const catalog = source?.catalog;
  const positionsAt = source?.positionsAt;
  const drawnRungs = source?.drawnRungs;
  const drawnMagLimit = source?.drawnMagLimit;
  return useMemo<SkyScene>(() => {
    if (!starsLayer || catalog === undefined || positionsAt === undefined || drawnRungs === undefined || drawnMagLimit === undefined || now === undefined) return NO_STARS;
    const positions = positionsAt({ lat, lon }, now);
    // FR-STAR-13: the step at the Sun of this very instant.
    const rungs = drawnRungs(positions.sunAltDeg);
    if (rungs === 0) return NO_STARS;
    const limit = drawnMagLimit(rungs);
    if (limit === Number.POSITIVE_INFINITY) return { stars: { catalog, positions, layers: ALL_LAYERS } };
    // A view counts its stars by the catalogue's length, so the positions stay whole and only the catalogue is cut.
    return { stars: { catalog: cutCatalog(catalog, limit), positions, layers: TWILIGHT_LAYERS } };
  }, [lat, lon, now, starsLayer, catalog, positionsAt, drawnRungs, drawnMagLimit]);
}
