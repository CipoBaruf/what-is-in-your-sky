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
 * names off the polar chart and the dome. The twilight step that dims the
 * stars by the Sun's altitude (FR-SKY-3, FR-STAR-13) is applied here by R123,
 * which adds `sunAltDeg` to the memo's key when it adds the step.
 */

/** Where the stars come from: the loaded `stars` chunk, in the scene's shape. */
export interface StarSource {
  catalog: StarField['catalog'];
  /** Every star and planet for the observer at `t`; the same call twice is expected to return the same object (`starsAt`). */
  positionsAt: (observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs) => StarField['positions'];
}

export interface SkySceneInput {
  observer: Observer;
  /** The shown instant — the live page's `t`, the pass detail's own, the stars page's now. Without one there are no stars to place. */
  now: EpochMs | undefined;
  /** FR-SKY-3's `[ stars ]`: off, the scene carries no stars whatever the source. */
  starsLayer: boolean;
  /** `null` until the chunk is loaded. */
  source: StarSource | null;
}

const ALL_LAYERS: StarField['layers'] = { stars: true, figures: true, planets: true, names: true };

/** The one scene with no stars, so a view's memo on the scene holds across ticks that change nothing. */
const NO_STARS: SkyScene = { stars: null };

export function useSkyScene({ observer, now, starsLayer, source }: SkySceneInput): SkyScene {
  const { lat, lon } = observer;
  return useMemo<SkyScene>(() => {
    if (!starsLayer || source === null || now === undefined) return NO_STARS;
    return { stars: { catalog: source.catalog, positions: source.positionsAt({ lat, lon }, now), layers: ALL_LAYERS } };
  }, [lat, lon, now, starsLayer, source]);
}
