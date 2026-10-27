import { useMemo } from 'react';
import type { Among, SkyPoint } from '../../../../lib/landmark';
import type { EpochMs, Locale, Observer } from '../../../../model';
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
 * applied once per scene — since D-837 by the source this hook is handed
 * (`starScene.ts`, in the `stars` chunk) — so no view changes for it and one rule thins every
 * drawing of the sky. The source carries `lib/skyStars.ts`'s `drawnRungs` and
 * `drawnMagLimit` with the positions, and the positions carry the Sun's
 * altitude at the same instant — so at 3600× the step follows the shown `t`
 * exactly, not the page's once-a-second bodies (FR-LIVE-5) — and the hook
 * still imports none of it, so `astronomy-engine` stays in the `stars` chunk.
 * With every rung drawn the scene is the whole field; with fewer (the Sun
 * above −6°) the catalogue is cut to the drawn rungs' magnitude, which in
 * D-748's magnitude order is a prefix (`catalogCut.ts`'s `cutCatalog`, the views'
 * own cut), and the figures are left out, since their lines would run to stars
 * the step hides; above 0° the scene carries no stars at all. The planets go
 * with the first two rungs (`planetsDrawn` is true wherever a rung is drawn),
 * so the step needs no planet switch of its own.
 *
 * The names layer is off in every scene this hook builds: the live page and the
 * pass detail do not offer it (FR-SKY-3, FR-LEG-1 as amended, OQ-45) — a tap
 * names a star (FR-STAR-7), which the window draws apart from the layer.
 *
 * R127 (FR-SKY-11, FR-SKY-12; D-796, D-826): the **landmark** is the scene's.
 * The page names the highlighted pass — the headline's on the live page, the
 * explained one on the pass detail — and the hook finds the bright star
 * nearest its peak and the figure the peak is among, through the source's
 * `sceneAt` (`starScene.ts`, over `lib/landmark.ts`'s `landmark` and
 * `constellationAt`, in the `stars` chunk since D-837), so every view rings the same
 * star. The stars are taken **at the peak's own instant** (one more rotation,
 * once per pass, not per tick): the peak is a fixed point of the sky over
 * which the stars drift a degree every four minutes, so a landmark picked at
 * the shown instant would change under a scrub while the pass did not, which
 * FR-SKY-11 rules out ("moves with a scrub only when the highlighted pass
 * changes"), and it is what the reader sees beside the pass at its peak — the
 * column's rule too (FR-SKY-12, each point at its own instant). The twilight
 * step is the shown instant's, the drawing's: a star the step hides now is no
 * landmark and leaves no line (FR-SKY-11), so the scene then carries
 * `landmark: null` even where a figure is near. The names (D-832) come the
 * same way, as closures over the catalogue, so the pages word the line and the
 * column without the chunk's modules.
 */

/**
 * Where the stars come from: the loaded `stars` chunk, as the scene at an instant (D-837). `starScene.ts`'s
 * `starSourceOf` builds it in the chunk — the positions, the twilight step and the cut — so none of that is in
 * `main`; the same call twice is expected to return the same object (the positions are memoised on the instant).
 */
/** D-832's three readers of a name, as the page reaches them without the `stars` chunk's modules. */
export interface StarNames {
  /** Star `i`'s name in `lang`: the Spanish one where there is one, else the IAU name, else the designation. */
  star: (i: number, lang: Locale) => string;
  /** One drawn part's name (`Serpens Caput`), or `undefined` for a part the table does not have. */
  figure: (con: string, part: number, lang: Locale) => string | undefined;
  /** A constellation's one name (`Serpens` / `Serpiente` whole), or `undefined`. */
  constellation: (con: string, lang: Locale) => string | undefined;
}

export interface StarSource {
  /**
   * The scene at `t`; R127 (FR-SKY-11; D-826): with the highlighted pass, its landmark too — among the stars at the
   * peak's own instant, kept per pass in the chunk, under the twilight step drawn at `t` (`null` where there is none).
   */
  sceneAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs, pass?: ScenePass | null) => SkyScene;
  /** The catalogue in the scene's shape, for the pages' names (a star's constellation, D-832). */
  catalog: StarField['catalog'];
  /** Every star and planet for the observer at `t` (`starsAt`), for FR-SKY-12's column at each point's own instant. */
  positionsAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs) => StarField['positions'];
  /** R127 (FR-SKY-12, D-795): the figure `point` is among, over the catalogue's figures at `positions`. */
  constellationAt: (point: SkyPoint, positions: StarField['positions']) => Among | null;
  /** R127 (D-832): the names, in the reader's language. */
  names: StarNames;
}

/** R127: the highlighted pass as the scene needs it — its id and its peak, with the peak's instant. */
export interface ScenePass {
  id: string;
  peak: { azDeg: number; elDeg: number; t: EpochMs };
}

export interface SkySceneInput {
  observer: Observer;
  /** The shown instant — the live page's `t`, the pass detail's own. Without one there are no stars to place. */
  now: EpochMs | undefined;
  /** FR-SKY-3's `[ stars ]`: off, the scene carries no stars whatever the source. */
  starsLayer: boolean;
  /** `null` until the chunk is loaded. */
  source: StarSource | null;
  /** R127 (FR-SKY-11): the highlighted pass, whose peak the landmark is of; absent or `null`, the scene carries none. */
  pass?: ScenePass | null | undefined;
}

/** The one scene with no stars, so a view's memo on the scene holds across ticks that change nothing; frozen, shared with `starScene.ts`. */
export const NO_STARS: SkyScene = Object.freeze({ stars: null });

export function useSkyScene({ observer, now, starsLayer, source, pass = null }: SkySceneInput): SkyScene {
  const { lat, lon } = observer;
  const sceneAt = source?.sceneAt;
  // R127: keyed on the pass's id and peak, not the object — the live page's set is rebuilt with its arc states each tick.
  const passId = pass?.id;
  const peakAz = pass?.peak.azDeg;
  const peakEl = pass?.peak.elDeg;
  const peakT = pass?.peak.t;
  return useMemo<SkyScene>(() => {
    if (!starsLayer || sceneAt === undefined || now === undefined) return NO_STARS;
    const highlighted = passId === undefined || peakAz === undefined || peakEl === undefined || peakT === undefined ? null : { id: passId, peak: { azDeg: peakAz, elDeg: peakEl, t: peakT } };
    return sceneAt({ lat, lon }, now, highlighted);
  }, [lat, lon, now, starsLayer, sceneAt, passId, peakAz, peakEl, peakT]);
}
