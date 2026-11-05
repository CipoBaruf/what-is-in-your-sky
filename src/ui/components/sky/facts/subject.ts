import type { OrbitHeight } from '../../../../lib/orbitHeight';
import type { PLANETS, StarNamesSource } from '../../../../lib/skyStars';
import type { NoradId } from '../../../../model';

/**
 * R188 (FR-FACT-2, FR-FACT-3; D-1101): what a facts group is about — the page's side of the `facts` chunk, types
 * only, so a page names its subject without loading the group.
 */

/** FR-FACT-3: a star, a planet or the Moon picked on the globe or the window; a star by its catalogue index. */
export type SkyPick = { kind: 'star'; index: number } | { kind: 'planet'; body: (typeof PLANETS)[number] } | { kind: 'moon' };

export type FactsSubject = { kind: 'satellite'; noradId: NoradId; name: string; description: string | undefined; height: OrbitHeight | null } | { kind: 'sky'; pick: SkyPick };

/** What a sky object's facts read of the star catalogue: the names, the designation, the constellation, the place. */
export interface FactsStars extends StarNamesSource {
  ra: ArrayLike<number>;
  dec: ArrayLike<number>;
  mag: ArrayLike<number>;
  con: readonly string[];
}

export const sameSkyPick = (a: SkyPick, b: SkyPick): boolean => (a.kind === 'star' && b.kind === 'star' ? a.index === b.index : a.kind === 'planet' && b.kind === 'planet' ? a.body === b.body : a.kind === b.kind);
