import type { EpochMs, NoradId, Pass, PassSort } from '../model';

/**
 * US-5 AC2 (R12): the two list orders. `chronological` is by start time.
 * `best` is by brightness × elevation: the brightness term is the flux
 * relative to magnitude 0, `10^(−0.4·m)`, so one magnitude brighter counts
 * 2.5× (the ISS at −2 outweighs a +0.5 rocket body 10 to 1, which is what a
 * casual observer would call "best"); the elevation term is the peak
 * elevation in degrees. The reference magnitude does not affect the order,
 * so no threshold is needed here. Ties fall back to start time; both orders
 * are stable and never mutate their input.
 */
export const DEFAULT_PASS_SORT: PassSort = 'chronological';
export const PASS_SORTS: readonly PassSort[] = ['chronological', 'best'];

export function isPassSort(value: unknown): value is PassSort {
  return typeof value === 'string' && (PASS_SORTS as readonly string[]).includes(value);
}

/** Brightness × elevation, higher is better. */
export function bestScore(pass: Pass): number {
  return 10 ** (-0.4 * pass.peakMagnitude) * pass.peak.elDeg;
}

const byStart = (a: Pass, b: Pass): number => a.start.t - b.start.t;
const byBest = (a: Pass, b: Pass): number => bestScore(b) - bestScore(a) || byStart(a, b);

export function sortPasses(passes: readonly Pass[], sort: PassSort): Pass[] {
  return [...passes].sort(sort === 'best' ? byBest : byStart);
}

/**
 * Spec §8 rank 1: the pass the hero card pins, the earliest pass of a
 * featured object that has not ended yet (a pass in progress counts: the
 * card then counts down to its peak or end). Null when no featured object
 * has such a pass in the window.
 */
export function nextFeaturedPass(passes: readonly Pass[], isFeatured: (noradId: NoradId) => boolean, now: EpochMs): Pass | null {
  return sortPasses(passes, 'chronological').find((pass) => isFeatured(pass.noradId) && pass.end.t > now) ?? null;
}
