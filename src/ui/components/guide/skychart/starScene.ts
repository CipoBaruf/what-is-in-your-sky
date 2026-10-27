import type { Among, Landmark, SkyPoint } from '../../../../lib/landmark';
import type { EpochMs, Observer } from '../../../../model';
import { cutCatalog } from './catalogCut';
import { NO_STARS, type ScenePass, type StarNames, type StarSource } from './useSkyScene';
import type { SkyLandmark, SkyScene, StarField } from './window/scene';

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
  /** R127 (FR-SKY-11, D-795): the landmark of `peak` among the stars at `positions` that `rungs` drawn rungs show. */
  landmark: (positions: StarField['positions'], peak: SkyPoint, rungs: number) => Landmark | null;
  /** R127 (FR-SKY-12, D-795): the figure `point` is among, over the catalogue's figures at `positions`. */
  constellationAt: (point: SkyPoint, positions: StarField['positions']) => Among | null;
  /** R127 (D-832): the names, in the reader's language. */
  names: StarNames;
}

/** How many passes' peaks a source keeps: a page's highlighted pass and another page's, with room for a change. */
const PEAKS_KEPT = 4;

/** The whole ladder, for the landmark the full night would give (`drawnMagLimit(Infinity)` is the last rung's). */
const EVERY_RUNG = Number.POSITIVE_INFINITY;

/**
 * FR-SKY-11: the landmark for `pass` at `positions` under `rungs` drawn rungs,
 * or `null` — where there is no star and no figure, or where the twilight step
 * hides the star the full night would show (then there is no line at all, not
 * the figure's, and not another star within reach that the step still draws).
 */
function landmarkOf(parts: Pick<StarParts, 'landmark' | 'constellationAt'>, positions: StarField['positions'], pass: ScenePass, rungs: number): SkyLandmark | null {
  const peak: SkyPoint = { azDeg: pass.peak.azDeg, altDeg: pass.peak.elDeg };
  const star = parts.landmark(positions, peak, rungs);
  // The full night's landmark or none: a step that hides it leaves no line, not a farther star the step still draws.
  const night = parts.landmark(positions, peak, EVERY_RUNG);
  if (night !== null && star?.index !== night.index) return null;
  const near = parts.constellationAt(peak, positions);
  const among = near === null ? null : { con: near.con, part: near.part };
  if (star === null && among === null) return null;
  return { passId: pass.id, star: star === null ? null : { index: star.index, sepDeg: star.sepDeg, word: star.word }, among };
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
 *
 * R127 (FR-SKY-11; D-826): handed the highlighted pass, the scene carries its landmark, picked among the stars at
 * the pass's peak instant — placed once per pass and kept here (a few passes', so two pages do not evict each other), so a tick places only the shown
 * instant's — under the shown instant's step; the source also carries the closures and names the pages word the
 * line and the column with.
 */
export function starSourceOf({ catalog, positionsAt, drawnRungs, drawnMagLimit, landmark, constellationAt, names }: StarParts): StarSource {
  const peaks = new Map<string, { positions: StarField['positions']; byRungs: Map<number, SkyLandmark | null> }>();
  return Object.freeze({
    catalog,
    positionsAt,
    constellationAt,
    names,
    sceneAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs, pass?: ScenePass | null): SkyScene => {
      const positions = positionsAt(observer, t);
      const rungs = drawnRungs(positions.sunAltDeg);
      if (rungs === 0) return NO_STARS;
      const limit = drawnMagLimit(rungs);
      const stars: StarField = limit === Number.POSITIVE_INFINITY ? { catalog, positions, layers: ALL_LAYERS } : { catalog: cutCatalog(catalog, limit), positions, layers: TWILIGHT_LAYERS };
      if (!pass) return { stars };
      // FR-SKY-11 (D-826): among the stars at the peak's own instant, placed once per pass, under the step at `t`;
      // the answer is kept per pass and rung count, so a playback frame searches nothing again.
      const key = `${String(observer.lat)},${String(observer.lon)},${pass.id},${String(pass.peak.t)},${String(pass.peak.azDeg)},${String(pass.peak.elDeg)}`;
      let entry = peaks.get(key);
      if (entry === undefined) {
        entry = { positions: positionsAt(observer, pass.peak.t), byRungs: new Map() };
        peaks.set(key, entry);
        // A few passes at once — the live page's and an open pass detail's — and never the night's whole list.
        if (peaks.size > PEAKS_KEPT) peaks.delete(peaks.keys().next().value ?? key);
      }
      let found = entry.byRungs.get(rungs);
      if (found === undefined) {
        found = landmarkOf({ landmark, constellationAt }, entry.positions, pass, rungs);
        entry.byRungs.set(rungs, found);
      }
      return { stars, landmark: found };
    },
  });
}
