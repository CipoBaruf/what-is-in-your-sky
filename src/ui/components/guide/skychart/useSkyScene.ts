import { useMemo } from 'react';
import type { EpochMs, Observer } from '../../../../model';
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
 * The four layer switches of FR-STAR-3 are all on under one `starsLayer`
 * (FR-SKY-3's toggle): the table, not the switches, is what keeps figures and
 * names off the polar chart and the dome.
 *
 * R123 (FR-SKY-3, FR-STAR-13 as amended; D-791, D-814): the twilight step is
 * applied here, once, so no view changes for it and one rule thins every
 * drawing of the sky. The source carries `lib/skyStars.ts`'s `drawnRungs`,
 * `planetsDrawn` and `drawnMagLimit` with the positions — the hook still
 * imports neither, so `astronomy-engine` stays in the `stars` chunk — and the
 * page hands in the Sun's altitude it already has (FR-DOME-6). With every rung
 * drawn the scene is the whole field; with fewer (the Sun above −6°) the
 * catalogue is cut to the drawn rungs' magnitude, which in D-748's magnitude
 * order is a prefix, and the figures are left out, since their lines would
 * run to stars the step hides; above 0° the scene carries no stars at all.
 * An unknown Sun draws no stars, so a daytime sky is never shown as night
 * while the bodies load. The memo is keyed on the step's answer rather than
 * the altitude itself: the altitude changes every tick, the step three times
 * a day.
 */

/** Where the stars come from: the loaded `stars` chunk, in the scene's shape. */
export interface StarSource {
  catalog: StarField['catalog'];
  /** Every star and planet for the observer at `t`; the same call twice is expected to return the same object (`starsAt`). */
  positionsAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs) => StarField['positions'];
  /** FR-STAR-13's steps (`skyStars.ts`): how many of the ladder's rungs are drawn at a Sun altitude, … */
  drawnRungs: (sunAltDeg: number) => number;
  /** … whether the planets are, … */
  planetsDrawn: (sunAltDeg: number) => boolean;
  /** … and the faintest magnitude that many rungs show (`Infinity` for the whole ladder). */
  drawnMagLimit: (rungs: number) => number;
}

export interface SkySceneInput {
  observer: Observer;
  /** The shown instant — the live page's `t`, the pass detail's own, the stars page's now. Without one there are no stars to place. */
  now: EpochMs | undefined;
  /** FR-SKY-3's `[ stars ]`: off, the scene carries no stars whatever the source. */
  starsLayer: boolean;
  /** `null` until the chunk is loaded. */
  source: StarSource | null;
  /** FR-STAR-13: the Sun's altitude at `now`, degrees, as the page's bodies have it; `undefined` until they are known. */
  sunAltDeg: number | undefined;
}

/** Frozen: every scene shares it, so no page or test may change it under the others. */
const ALL_LAYERS: StarField['layers'] = Object.freeze({ stars: true, figures: true, planets: true, names: true });

/** FR-STAR-13 in twilight: the drawn rungs and, by the step, the planets — never the figures, whose lines would reach hidden stars. */
const TWILIGHT_LAYERS: StarField['layers'] = Object.freeze({ stars: true, figures: false, planets: true, names: true });
const TWILIGHT_NO_PLANETS: StarField['layers'] = Object.freeze({ stars: true, figures: false, planets: false, names: true });

type Catalog = StarField['catalog'];

/** The catalogue cut to a magnitude, once per catalogue and limit, so a view's memo on the catalogue holds from tick to tick. */
const cuts = new WeakMap<Catalog, Map<number, Catalog>>();

function cutTo(catalog: Catalog, limit: number): Catalog {
  let byLimit = cuts.get(catalog);
  if (!byLimit) {
    byLimit = new Map();
    cuts.set(catalog, byLimit);
  }
  let cut = byLimit.get(limit);
  if (!cut) {
    // One past the last star at the limit or brighter: in D-748's order exactly the drawn rungs, and out of order no bright star is lost.
    let n = 0;
    for (let i = catalog.mag.length - 1; i >= 0; i -= 1) {
      if ((catalog.mag[i] ?? Number.NaN) <= limit) {
        n = i + 1;
        break;
      }
    }
    const take = <T>(column: ArrayLike<T>): ArrayLike<T> => (n >= column.length ? column : Array.prototype.slice.call(column, 0, n));
    cut = Object.freeze({ ra: take(catalog.ra), dec: take(catalog.dec), mag: take(catalog.mag), name: catalog.name.slice(0, n), desig: catalog.desig.slice(0, n), con: catalog.con.slice(0, n), figures: [] });
    byLimit.set(limit, cut);
  }
  return cut;
}

/** The one scene with no stars, so a view's memo on the scene holds across ticks that change nothing; frozen like `ALL_LAYERS`. */
const NO_STARS: SkyScene = Object.freeze({ stars: null });

export function useSkyScene({ observer, now, starsLayer, source, sunAltDeg }: SkySceneInput): SkyScene {
  const { lat, lon } = observer;
  // Keyed on the source's fields, not on the object: a page may build the source inline each render.
  const catalog = source?.catalog;
  const positionsAt = source?.positionsAt;
  // FR-STAR-13: the step's answer at this Sun, outside the memo, so the memo is keyed on what the step decides.
  const known = source !== null && sunAltDeg !== undefined;
  const rungs = known ? source.drawnRungs(sunAltDeg) : 0;
  const planets = known ? source.planetsDrawn(sunAltDeg) : false;
  const limit = source !== null && rungs > 0 ? source.drawnMagLimit(rungs) : Number.NEGATIVE_INFINITY;
  return useMemo<SkyScene>(() => {
    if (!starsLayer || catalog === undefined || positionsAt === undefined || now === undefined) return NO_STARS;
    // The steps go together (`skyStars.ts`): no rung is drawn only where no planet is, and every rung only where every planet is.
    if (rungs === 0) return NO_STARS;
    const positions = positionsAt({ lat, lon }, now);
    if (limit === Number.POSITIVE_INFINITY) return { stars: { catalog, positions, layers: ALL_LAYERS } };
    // A view counts its stars by the catalogue's length, so the positions stay whole and only the catalogue is cut.
    return { stars: { catalog: cutTo(catalog, limit), positions, layers: planets ? TWILIGHT_LAYERS : TWILIGHT_NO_PLANETS } };
  }, [lat, lon, now, starsLayer, catalog, positionsAt, rungs, planets, limit]);
}
