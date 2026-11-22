import type { Among, Landmark, SkyPoint } from '../../../../lib/landmark';
import type { EpochMs, Observer } from '../../../../model';
import type { ScenePass, StarNames, StarSource } from './useSkyScene';
import type { SkyLandmark, SkyScene, StarField } from './window/scene';

/**
 * D-837 (FR-SKY-10; R123's D-815): the scene's stars, built in the `stars`
 * chunk. `useSkyScene` is in `main` because the pass detail is, so what it
 * does with a loaded chunk — the field and the landmark — lives here, beside
 * the catalogue it works on, and the hook
 * only asks the source for the scene at an instant. `screens/stars/source.ts`
 * is the one caller in the app; nothing in `main` imports this module.
 */

/** What the `stars` chunk hands over: the catalogue in the scene's shape, the positions and the rungs drawn. */
export interface StarParts {
  catalog: StarField['catalog'];
  /**
   * Every star and planet for the observer at `t`, and the Sun's altitude then (degrees); the same call twice is
   * expected to return the same object (`starsAt`).
   */
  positionsAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs) => StarField['positions'];
  /** R127 (FR-SKY-11, D-795): the landmark of `peak` among the stars at `positions` that `rungs` drawn rungs show. */
  landmark: (positions: StarField['positions'], peak: SkyPoint, rungs: number) => Landmark | null;
  /** R127 (FR-SKY-12, D-795): the figure `point` is among, over the catalogue's figures at `positions`. */
  constellationAt: (point: SkyPoint, positions: StarField['positions']) => Among | null;
  /** R127 (D-832): the names, in the reader's language. */
  names: StarNames;
}

/** How many passes' peaks a source keeps: a page's highlighted pass and another page's, with room for a change. */
const PEAKS_KEPT = 4;

/** FR-DARK-2: every rung, so the landmark is the full night's at any hour (`drawnMagLimit(Infinity)` is the last rung's). */
const EVERY_RUNG = Number.POSITIVE_INFINITY;

/** FR-SKY-11: the landmark for `pass` at `positions`, or `null` where there is no star and no figure. */
function landmarkOf(parts: Pick<StarParts, 'landmark' | 'constellationAt'>, positions: StarField['positions'], pass: ScenePass): SkyLandmark | null {
  const peak: SkyPoint = { azDeg: pass.peak.azDeg, altDeg: pass.peak.elDeg };
  const star = parts.landmark(positions, peak, EVERY_RUNG);
  const near = parts.constellationAt(peak, positions);
  const among = near === null ? null : { con: near.con, part: near.part };
  if (star === null && among === null) return null;
  return { passId: pass.id, star: star === null ? null : { index: star.index, sepDeg: star.sepDeg, word: star.word }, among };
}

/** Frozen: every scene shares it, so no page or test may change it under the others. No names: see `useSkyScene`. */
const ALL_LAYERS: StarField['layers'] = Object.freeze({ stars: true, figures: true, planets: true, names: false });

/**
 * The source `useSkyScene` takes, from the chunk's parts: the scene at an instant — the whole field, every rung and
 * the figures, whatever the Sun's altitude (FR-DARK-2, D-1234). Built once per set of parts, so the hook's memo on
 * `sceneAt` holds.
 *
 * R127 (FR-SKY-11; D-826): handed the highlighted pass, the scene carries its landmark, picked among the stars at
 * the pass's peak instant and kept here (a few passes', so two pages do not evict each other), so a tick places
 * only the shown instant's; the source also carries the closures and names the pages word the line and the column
 * with.
 */
export function starSourceOf({ catalog, positionsAt, landmark, constellationAt, names }: StarParts): StarSource {
  const peaks = new Map<string, SkyLandmark | null>();
  return Object.freeze({
    catalog,
    positionsAt,
    constellationAt,
    names,
    sceneAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs, pass?: ScenePass | null): SkyScene => {
      const stars: StarField = { catalog, positions: positionsAt(observer, t), layers: ALL_LAYERS };
      if (!pass) return { stars };
      // FR-SKY-11 (D-826): among the stars at the peak's own instant, found once per pass, so a playback frame searches nothing again.
      const key = `${String(observer.lat)},${String(observer.lon)},${pass.id},${String(pass.peak.t)},${String(pass.peak.azDeg)},${String(pass.peak.elDeg)}`;
      let found = peaks.get(key);
      if (found === undefined) {
        found = landmarkOf({ landmark, constellationAt }, positionsAt(observer, pass.peak.t), pass);
        peaks.set(key, found);
        // A few passes at once — the live page's and an open pass detail's — and never the night's whole list.
        if (peaks.size > PEAKS_KEPT) peaks.delete(peaks.keys().next().value ?? key);
      }
      return { stars, landmark: found };
    },
  });
}
