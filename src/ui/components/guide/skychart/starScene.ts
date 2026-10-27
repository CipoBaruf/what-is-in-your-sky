import type { EpochMs, Observer } from '../../../../model';
import { cutCatalog } from './catalogCut';
import { NO_STARS, type StarSource } from './useSkyScene';
import type { SkyScene, StarField } from './window/scene';

/**
 * D-837 (FR-SKY-10; R123's D-815): the scene's stars, built in the `stars`
 * chunk. `useSkyScene` is in `main` because the pass detail is, so what it
 * does with a loaded chunk — the twilight step, the catalogue's cut, the two
 * layer sets — lives here, beside the catalogue it works on, and the hook
 * only asks the source for the scene at an instant. `screens/stars/source.ts`
 * is the one caller in the app; nothing in `main` imports this module.
 */

/** What the `stars` chunk hands over: the catalogue in the scene's shape, the positions and FR-STAR-13's steps. */
export interface StarParts {
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

/** Frozen: every scene shares it, so no page or test may change it under the others. No names: see `useSkyScene`. */
const ALL_LAYERS: StarField['layers'] = Object.freeze({ stars: true, figures: true, planets: true, names: false });

/** FR-STAR-13 in twilight: the drawn rungs and the planets — never the figures, whose lines would reach hidden stars. */
const TWILIGHT_LAYERS: StarField['layers'] = Object.freeze({ stars: true, figures: false, planets: true, names: false });

/**
 * The source `useSkyScene` takes, from the chunk's parts: the scene at an instant with the twilight step applied
 * (D-815) — the whole field with every rung drawn, the catalogue cut to the drawn rungs' magnitude (a prefix in
 * D-748's order, `cutCatalog`, made once per catalogue and limit) with no figures in twilight, and the shared
 * `NO_STARS` with no rung drawn. Built once per set of parts, so the hook's memo on `sceneAt` holds.
 */
export function starSourceOf({ catalog, positionsAt, drawnRungs, drawnMagLimit }: StarParts): StarSource {
  return Object.freeze({
    sceneAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs): SkyScene => {
      const positions = positionsAt(observer, t);
      const rungs = drawnRungs(positions.sunAltDeg);
      if (rungs === 0) return NO_STARS;
      const limit = drawnMagLimit(rungs);
      if (limit === Number.POSITIVE_INFINITY) return { stars: { catalog, positions, layers: ALL_LAYERS } };
      return { stars: { catalog: cutCatalog(catalog, limit), positions, layers: TWILIGHT_LAYERS } };
    },
  });
}
