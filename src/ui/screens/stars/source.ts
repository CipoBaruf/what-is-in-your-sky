import { starCatalog } from '../../../data/stars/catalog';
import { constellationAt, landmark } from '../../../lib/landmark';
import { STARS_PAGE_CATALOGS } from '../../../i18n/starsPageT';
import type { CompassPoint } from '../../../lib/compass';
import { brightestDrawn, constellationName, drawnMagLimit, drawnRungs, figureName, starName, starsAt } from '../../../lib/skyStars';
import type { EpochMs, Locale, Observer } from '../../../model';
import { starSourceOf } from '../../components/guide/skychart/starScene';
import type { StarNames, StarSource } from '../../components/guide/skychart/useSkyScene';
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

/**
 * R130 (FR-FLOW-1, D-843): the home's Stars door's second line — the brightest star or planet the twilight step
 * draws above 0° for `observer` at `t` (`brightestDrawn`), named in `lang` with its 16-point direction, or `null`
 * with nothing drawn (the Sun up). Here, in the `stars` chunk, beside the catalogue and the planets' names.
 */
export function brightestNow(observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs, lang: Locale): { name: string; dir: CompassPoint } | null {
  const catalog = starCatalog();
  const found = brightestDrawn({ mag: catalog.mag, positions: starsAt(catalog, observer, t) });
  if (found === null) return null;
  const name = found.kind === 'star' ? starName(catalog, found.index, lang) : STARS_PAGE_CATALOGS[lang].planets[found.body];
  return { name, dir: found.dir };
}
