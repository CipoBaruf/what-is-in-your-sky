import { starCatalog } from '../../../data/stars/catalog';
import { drawnMagLimit, drawnRungs, starsAt } from '../../../lib/skyStars';
import { starSourceOf } from '../../components/guide/skychart/starScene';
import type { StarSource } from '../../components/guide/skychart/useSkyScene';
import { sceneCatalog } from './field';

/**
 * R123 (FR-SKY-3, FR-SKY-8, FR-SKY-10, FR-STAR-13; D-791, D-802): what the
 * live page and the pass detail draw their stars from — the catalogue in the
 * scene's shape, the positions at an instant and the twilight steps, as the
 * scene at an instant (`starScene.ts`, D-837) — built in
 * the `stars` chunk, which is the only place the catalogue and
 * `astronomy-engine` live. `Stars.tsx` re-exports it, so the pages reach it
 * through `starsChunk.ts`'s one request and the chunk gains no entry of its
 * own. Built on first use and kept: the scene hook keys its memo on
 * `sceneAt`, so every call must hand back the same function.
 */
let source: StarSource | undefined;

export function starSource(): StarSource {
  if (source) return source;
  const catalog = starCatalog();
  source = starSourceOf({
    catalog: sceneCatalog(catalog),
    // `starsAt` memoises on the instant itself: one rotation per tick, whatever number of views reads it (FR-SKY-8).
    positionsAt: (observer, t) => starsAt(catalog, observer, t),
    drawnRungs,
    drawnMagLimit,
  });
  return source;
}
