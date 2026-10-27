import { useMemo } from 'react';
import type { EpochMs, Observer } from '../../../../model';
import type { SkyScene } from './window/scene';

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
 */

/**
 * Where the stars come from: the loaded `stars` chunk, as the scene at an instant (D-837). `starScene.ts`'s
 * `starSourceOf` builds it in the chunk — the positions, the twilight step and the cut — so none of that is in
 * `main`; the same call twice is expected to return the same object (the positions are memoised on the instant).
 */
export interface StarSource {
  sceneAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs) => SkyScene;
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

/** The one scene with no stars, so a view's memo on the scene holds across ticks that change nothing; frozen, shared with `starScene.ts`. */
export const NO_STARS: SkyScene = Object.freeze({ stars: null });

export function useSkyScene({ observer, now, starsLayer, source }: SkySceneInput): SkyScene {
  const { lat, lon } = observer;
  const sceneAt = source?.sceneAt;
  return useMemo<SkyScene>(() => (starsLayer && sceneAt !== undefined && now !== undefined ? sceneAt({ lat, lon }, now) : NO_STARS), [lat, lon, now, starsLayer, sceneAt]);
}
