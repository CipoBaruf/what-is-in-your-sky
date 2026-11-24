import { starCatalog } from '../../../data/stars/catalog';
import { constellationAt, landmark } from '../../../lib/landmark';
import { constellationName, figureName, starName, starsAt } from '../../../lib/skyStars';
import { starSourceOf } from '../guide/skychart/starScene';
import type { StarNames, StarSource } from '../guide/skychart/useSkyScene';
import { sceneCatalog } from './field';

/**
 * R123 (FR-SKY-3, FR-SKY-8, FR-SKY-10, FR-STAR-13; D-791, D-802): what the
 * live page and the pass detail draw their stars from — the catalogue in the
 * scene's shape, and the positions at an instant, as the
 * scene at an instant (`starScene.ts`, D-837) — built in
 * the `starSource` chunk (`starsChunk.ts`), the only place the catalogue and
 * `astronomy-engine` live, and the chunk's entry since R222 (D-1240). Built on first use and kept: the scene hook keys its memo on
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
    // R127 (FR-SKY-11, FR-SKY-12, D-832): the landmark, the column's figure and the names, closed over the catalogue here.
    landmark: (positions, peak, rungs) => landmark({ mag: catalog.mag, altDeg: positions.altDeg, azDeg: positions.azDeg }, peak, rungs),
    constellationAt: (point, positions) => constellationAt(point, catalog.figures, positions),
    names: Object.freeze({
      star: (i, lang) => starName(catalog, i, lang),
      figure: (con, part, lang) => figureName(catalog, con, part, lang),
      constellation: (con, lang) => constellationName(catalog, con, lang),
    } satisfies StarNames),
  });
  return source;
}

